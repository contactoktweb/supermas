-- 083: Pagos a proveedores unificados entre Compras / Proveedores / Cuentas por Pagar y Tesorería.
--
-- Antes había dos flujos que no se veían entre sí:
--   - fn_register_supplier_payment (Compras, Proveedores, CxP): escribía supplier_payments y movía banco
--     o caja, pero no contabilizaba, no validaba saldo bancario, tomaba en silencio la cuenta más antigua
--     y registraba el efectivo como 'WITHDRAWAL' sin empresa (el arqueo de caja solo suma CASH_OUT).
--     Esos pagos no aparecían en Tesorería.
--   - fn_execute_treasury_payment (Tesorería): contabilizaba, pero no escribía supplier_payments (no
--     aparecía en el historial de CxP) ni validaba saldo pendiente, compra anulada o borrador.
--
-- Ahora cada pago a proveedor deja, en una sola transacción: supplier_payments (historial de CxP),
-- comprobante de egreso contable y, según el medio, movimiento bancario + treasury_payments PAID
-- (Tesorería maneja bancos) o egreso CASH_OUT en la caja abierta del usuario (módulo Cajas).
-- Misma firma y mismos campos de retorno (más los del asiento), así el front no cambia.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- Valida que la compra admita un pago y devuelve el saldo pendiente (bloquea la fila).
CREATE OR REPLACE FUNCTION public.fn_assert_purchase_payable_internal(p_purchase_id UUID, p_company_id UUID, p_amount NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_purchase RECORD;
    v_pending NUMERIC(15,2);
BEGIN
    SELECT id, company_id, purchase_number, total_amount, paid_amount,
           UPPER(COALESCE(inventory_status, '')) AS inv_status
    INTO v_purchase
    FROM public.purchases WHERE id = p_purchase_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La orden de compra especificada no existe.' USING ERRCODE = '23503';
    END IF;
    IF v_purchase.company_id <> p_company_id THEN
        RAISE EXCEPTION 'La orden de compra pertenece a otra empresa.' USING ERRCODE = '42501';
    END IF;
    IF v_purchase.inv_status IN ('CANCELADA', 'CANCELLED') THEN
        RAISE EXCEPTION 'No se pueden registrar pagos en una orden de compra anulada.' USING ERRCODE = '42200';
    END IF;
    IF v_purchase.inv_status IN ('BORRADOR', 'DRAFT') THEN
        RAISE EXCEPTION 'No se pueden registrar pagos en órdenes de compra en borrador. Debe confirmarse primero.' USING ERRCODE = '42200';
    END IF;
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'El monto del pago debe ser mayor a 0.' USING ERRCODE = '42200';
    END IF;

    v_pending := v_purchase.total_amount - v_purchase.paid_amount;
    IF v_pending <= 0 THEN
        RAISE EXCEPTION 'La compra % ya está totalmente pagada.', v_purchase.purchase_number USING ERRCODE = '42200';
    END IF;
    IF p_amount > v_pending THEN
        RAISE EXCEPTION 'El monto a pagar (%) excede el saldo pendiente de la compra % (%).',
            p_amount, v_purchase.purchase_number, v_pending USING ERRCODE = '42200';
    END IF;
    RETURN v_pending;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_assert_purchase_payable_internal(UUID, UUID, NUMERIC) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_register_supplier_payment(
    p_purchase_id uuid,
    p_amount numeric,
    p_payment_date date DEFAULT CURRENT_DATE,
    p_payment_method character varying DEFAULT 'BANK_TRANSFER'::character varying,
    p_transaction_reference character varying DEFAULT NULL::character varying,
    p_notes text DEFAULT NULL::text,
    p_bank_account_id uuid DEFAULT NULL::uuid,
    p_cash_session_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user RECORD;
    v_user_name VARCHAR(150);
    v_company_id UUID;
    v_purchase RECORD;
    v_supplier RECORD;
    v_pending NUMERIC(15,2);
    v_date DATE := COALESCE(p_payment_date, (NOW() AT TIME ZONE 'America/Bogota')::DATE);
    v_method VARCHAR(30);
    v_payment_id UUID := gen_random_uuid();
    v_treasury_id UUID;
    v_payment_number VARCHAR(50);
    v_bank RECORD;
    v_new_bank_balance NUMERIC(15,2);
    v_bank_movement_id UUID;
    v_bank_movement_number VARCHAR(50);
    v_cash_session_id UUID;
    v_session_cash NUMERIC(15,2);
    v_cs RECORD;
    v_cash_movement_id UUID;
    v_new_paid NUMERIC(15,2);
    v_new_status VARCHAR(30);
    v_entry JSONB;
BEGIN
    -- 1. Usuario, empresa y permisos
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Acceso denegado: usuario no autenticado.' USING ERRCODE = '28000';
    END IF;
    v_company_id := public.get_auth_company_id();
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Acceso denegado: el usuario no tiene empresa asignada.' USING ERRCODE = '42501';
    END IF;
    IF NOT (public.is_admin() OR public.has_permission('purchases.create') OR public.has_permission('treasury.create')) THEN
        RAISE EXCEPTION 'No tienes permisos para registrar pagos a proveedores.' USING ERRCODE = '42501';
    END IF;
    SELECT full_name, assigned_cash_register_id INTO v_user FROM public.users WHERE id = v_user_id;
    v_user_name := COALESCE(NULLIF(TRIM(v_user.full_name), ''), 'Usuario');

    -- 2. Compra pagable y saldo
    PERFORM pg_advisory_xact_lock(hashtext('purchase_supplier_payment_' || p_purchase_id::text));
    v_pending := public.fn_assert_purchase_payable_internal(p_purchase_id, v_company_id, p_amount);
    SELECT id, location_id, supplier_id, purchase_number, total_amount, paid_amount
    INTO v_purchase FROM public.purchases WHERE id = p_purchase_id;
    SELECT COALESCE(name, legal_name, 'Proveedor') AS name, tax_id INTO v_supplier
    FROM public.suppliers WHERE id = v_purchase.supplier_id AND company_id = v_company_id;

    -- 3. Medio de pago: efectivo sale de la caja del usuario; los demás, de una cuenta bancaria elegida.
    v_method := UPPER(TRIM(COALESCE(p_payment_method, 'BANK_TRANSFER')));
    v_method := CASE
        WHEN v_method IN ('EFECTIVO', 'CASH') THEN 'CASH'
        WHEN v_method IN ('TRANSFERENCIA', 'BANK_TRANSFER', 'CONSIGNACION') THEN 'BANK_TRANSFER'
        WHEN v_method IN ('CHEQUE', 'CHECK') THEN 'CHECK'
        ELSE 'OTHER'
    END;

    v_payment_number := public.fn_next_supplier_payment_number(v_company_id);

    IF v_method = 'CASH' THEN
        SELECT cs.id INTO v_cash_session_id
        FROM public.cash_sessions cs
        LEFT JOIN public.cash_registers cr ON cr.id = cs.cash_register_id
        WHERE cs.company_id = v_company_id
          AND cs.user_id = v_user_id
          AND cs.status = 'OPEN'
          AND (p_cash_session_id IS NULL OR cs.id = p_cash_session_id)
          AND COALESCE(cs.location_id, cr.location_id) = v_purchase.location_id
          AND (v_user.assigned_cash_register_id IS NULL OR cs.cash_register_id = v_user.assigned_cash_register_id)
        ORDER BY cs.opening_time DESC
        LIMIT 1;
        IF v_cash_session_id IS NULL THEN
            RAISE EXCEPTION 'Para pagar en efectivo debe tener su caja abierta en la sede de la compra.' USING ERRCODE = '55001';
        END IF;

        -- Misma llave que los demás movimientos de caja (046/079)
        PERFORM pg_advisory_xact_lock(hashtext('cash_session_' || v_cash_session_id::TEXT));
        SELECT id, opening_float, status INTO v_cs FROM public.cash_sessions WHERE id = v_cash_session_id FOR UPDATE;
        SELECT COALESCE(v_cs.opening_float, 0)
               + COALESCE(SUM(amount) FILTER (WHERE type IN ('CASH_IN', 'SALE_CASH')), 0)
               - COALESCE(SUM(amount) FILTER (WHERE type = 'CASH_OUT'), 0)
        INTO v_session_cash
        FROM public.cash_movements WHERE session_id = v_cash_session_id;
        IF v_session_cash < p_amount THEN
            RAISE EXCEPTION 'La caja no tiene efectivo suficiente para pagar % (disponible: %).', p_amount, v_session_cash
                USING ERRCODE = '55000';
        END IF;

        INSERT INTO public.cash_movements (company_id, session_id, type, amount, reason, authorized_by_user_id, created_at)
        VALUES (v_company_id, v_cash_session_id, 'CASH_OUT', p_amount,
                'Pago a proveedor ' || v_supplier.name || ' (' || v_purchase.purchase_number || ' - ' || v_payment_number || ')',
                v_user_id, NOW())
        RETURNING id INTO v_cash_movement_id;
    ELSE
        IF p_bank_account_id IS NULL THEN
            RAISE EXCEPTION 'Seleccione la cuenta bancaria de la que sale el pago.' USING ERRCODE = '42200';
        END IF;
        PERFORM pg_advisory_xact_lock(hashtext('bank_account_' || p_bank_account_id::text));
        SELECT id, company_id, location_id, bank_name, account_number, current_balance, is_active
        INTO v_bank FROM public.bank_accounts WHERE id = p_bank_account_id FOR UPDATE;
        IF NOT FOUND OR v_bank.company_id <> v_company_id THEN
            RAISE EXCEPTION 'La cuenta bancaria no existe o pertenece a otra empresa.' USING ERRCODE = '42501';
        END IF;
        IF NOT v_bank.is_active THEN
            RAISE EXCEPTION 'La cuenta bancaria "%" está inactiva.', v_bank.bank_name USING ERRCODE = '42200';
        END IF;
        IF v_bank.current_balance < p_amount THEN
            RAISE EXCEPTION 'Fondos insuficientes en "% (%)". Saldo disponible: %, monto requerido: %.',
                v_bank.bank_name, v_bank.account_number, v_bank.current_balance, p_amount USING ERRCODE = '42200';
        END IF;

        v_new_bank_balance := v_bank.current_balance - p_amount;
        UPDATE public.bank_accounts SET current_balance = v_new_bank_balance, updated_at = NOW() WHERE id = v_bank.id;

        v_bank_movement_number := public.fn_next_treasury_consecutive(v_company_id, 'BANK_MOV');
        v_bank_movement_id := gen_random_uuid();
        INSERT INTO public.bank_movements (
            id, company_id, location_id, bank_account_id, movement_number, movement_date, movement_type,
            amount, balance_after, concept, reference, treasury_payment_id, is_reconciled,
            created_by_user_id, created_at, updated_at
        ) VALUES (
            v_bank_movement_id, v_company_id, v_bank.location_id, v_bank.id, v_bank_movement_number, v_date, 'DEBIT',
            p_amount, v_new_bank_balance,
            'Pago a proveedor ' || v_supplier.name || ' (' || v_purchase.purchase_number || ' - ' || v_payment_number || ')',
            p_transaction_reference, NULL, false, v_user_id, NOW(), NOW()
        );
    END IF;

    -- 4. Pago bancario visible en Tesorería (ejecutado)
    IF v_method <> 'CASH' THEN
    v_treasury_id := gen_random_uuid();
    INSERT INTO public.treasury_payments (
        id, company_id, location_id, payment_number, payment_type, purchase_id, supplier_id, bank_account_id,
        amount, payment_date, payment_method, reference_number, status, notes, created_by_user_id,
        updated_by_user_id, paid_at, created_at, updated_at
    ) VALUES (
        v_treasury_id, v_company_id, v_purchase.location_id, v_payment_number, 'SUPPLIER_PAYMENT', v_purchase.id,
        v_purchase.supplier_id, p_bank_account_id, p_amount, v_date,
        CASE v_method WHEN 'CHECK' THEN 'CHEQUE' WHEN 'BANK_TRANSFER' THEN 'TRANSFERENCIA' ELSE 'OTRO' END,
        p_transaction_reference, 'PAID', p_notes, v_user_id, v_user_id, NOW(), NOW(), NOW()
    );
    UPDATE public.bank_movements SET treasury_payment_id = v_treasury_id WHERE id = v_bank_movement_id;
    END IF;

    -- 5. Historial de Cuentas por Pagar
    INSERT INTO public.supplier_payments (
        id, purchase_id, company_id, location_id, payment_number, payment_date, amount, payment_method,
        transaction_reference, notes, created_by_user_id, bank_account_id, bank_movement_id,
        cash_session_id, cash_movement_id, created_at
    ) VALUES (
        v_payment_id, v_purchase.id, v_company_id, v_purchase.location_id, v_payment_number, v_date, p_amount, v_method,
        p_transaction_reference, p_notes, v_user_id,
        CASE WHEN v_method = 'CASH' THEN NULL ELSE p_bank_account_id END,
        v_bank_movement_id, v_cash_session_id, v_cash_movement_id, NOW()
    );
    IF v_bank_movement_id IS NOT NULL THEN
        UPDATE public.bank_movements SET supplier_payment_id = v_payment_id WHERE id = v_bank_movement_id;
    END IF;

    -- 6. Saldo de la compra
    v_new_paid := v_purchase.paid_amount + p_amount;
    v_new_status := CASE WHEN v_new_paid >= v_purchase.total_amount THEN 'PAID' ELSE 'PARTIAL' END;
    UPDATE public.purchases SET paid_amount = v_new_paid, payment_status = v_new_status, updated_at = NOW()
    WHERE id = v_purchase.id;

    -- 7. Comprobante de egreso: Dr proveedores / Cr banco (subcuenta de la cuenta) o caja
    IF v_method = 'CASH' THEN
        v_entry := public.fn_create_accounting_entry(
            p_date := v_date,
            p_concept := 'Pago a proveedor ' || v_supplier.name || ' en efectivo (' || v_payment_number || ')',
            p_document_type := 'SUPPLIER_PAYMENT',
            p_document_reference := v_payment_number,
            p_lines := jsonb_build_array(
                jsonb_build_object(
                    'account_id', public.fn_get_default_account(v_company_id, 'SUPPLIERS_PAYABLE'),
                    'debit_amount', p_amount, 'credit_amount', 0,
                    'third_party_doc', v_supplier.tax_id, 'third_party_name', v_supplier.name,
                    'description', 'Abono a proveedor ' || v_supplier.name || ' pago ' || v_payment_number),
                jsonb_build_object(
                    'account_id', public.fn_get_default_account(v_company_id, 'CASH'),
                    'debit_amount', 0, 'credit_amount', p_amount,
                    'third_party_doc', v_supplier.tax_id, 'third_party_name', v_supplier.name,
                    'description', 'Egreso de caja pago ' || v_payment_number)
            ),
            p_location_id := v_purchase.location_id,
            p_auto_post := true,
            p_company_id := v_company_id
        );
    ELSE
        v_entry := public.fn_cause_payment_accounting_internal(v_treasury_id);
    END IF;

    -- 8. Auditoría
    INSERT INTO public.audit_logs (
        company_id, user_id, user_name, action, module, entity_name, entity_id, location_id,
        previous_value, new_value, created_at
    ) VALUES (
        v_company_id, v_user_id, v_user_name, 'SUPPLIER_PAYMENT_CREATED', 'PURCHASES', 'supplier_payments',
        v_payment_id::TEXT, v_purchase.location_id,
        jsonb_build_object('paid_amount', v_purchase.paid_amount, 'pending_balance', v_pending),
        jsonb_build_object(
            'payment_number', v_payment_number, 'purchase_number', v_purchase.purchase_number,
            'supplier_name', v_supplier.name, 'amount', p_amount, 'payment_method', v_method,
            'treasury_payment_id', v_treasury_id, 'bank_movement_id', v_bank_movement_id,
            'cash_movement_id', v_cash_movement_id, 'accounting_entry_number', v_entry->>'entry_number'),
        NOW()
    );

    RETURN jsonb_build_object(
        'payment_id', v_payment_id,
        'payment_number', v_payment_number,
        'purchase_id', v_purchase.id,
        'purchase_number', v_purchase.purchase_number,
        'amount', p_amount,
        'payment_date', v_date,
        'payment_method', v_method,
        'transaction_reference', p_transaction_reference,
        'total_amount', v_purchase.total_amount,
        'paid_amount', v_new_paid,
        'pending_balance', v_purchase.total_amount - v_new_paid,
        'payment_status', v_new_status,
        'bank_movement_id', v_bank_movement_id,
        'cash_movement_id', v_cash_movement_id,
        'treasury_payment_id', v_treasury_id,
        'accounting_entry_id', v_entry->>'entry_id',
        'accounting_entry_number', v_entry->>'entry_number'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_register_supplier_payment(uuid, numeric, date, character varying, character varying, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_register_supplier_payment(uuid, numeric, date, character varying, character varying, text, uuid, uuid) TO authenticated, service_role;

-- Tesorería: el pago ejecutado de una compra valida su saldo y queda en el historial de CxP.
CREATE OR REPLACE FUNCTION public.fn_sync_treasury_payment_to_supplier_payments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF NEW.purchase_id IS NULL OR NEW.status <> 'PAID' OR OLD.status = 'PAID' THEN
        RETURN NEW;
    END IF;
    -- Los pagos creados por fn_register_supplier_payment ya escribieron su historial.
    IF EXISTS (SELECT 1 FROM public.supplier_payments sp
               WHERE sp.company_id = NEW.company_id AND sp.payment_number = NEW.payment_number) THEN
        RETURN NEW;
    END IF;
    INSERT INTO public.supplier_payments (
        purchase_id, company_id, location_id, payment_number, payment_date, amount, payment_method,
        transaction_reference, notes, created_by_user_id, bank_account_id, bank_movement_id, created_at
    ) VALUES (
        NEW.purchase_id, NEW.company_id, NEW.location_id, NEW.payment_number, NEW.payment_date, NEW.amount,
        CASE UPPER(COALESCE(NEW.payment_method, '')) WHEN 'EFECTIVO' THEN 'CASH' WHEN 'CHEQUE' THEN 'CHECK'
             WHEN 'TRANSFERENCIA' THEN 'BANK_TRANSFER' WHEN 'CONSIGNACION' THEN 'BANK_TRANSFER' ELSE 'OTHER' END,
        NEW.reference_number, NEW.notes, COALESCE(NEW.updated_by_user_id, NEW.created_by_user_id),
        NEW.bank_account_id,
        (SELECT bm.id FROM public.bank_movements bm WHERE bm.treasury_payment_id = NEW.id ORDER BY bm.created_at DESC LIMIT 1),
        NOW()
    );
    RETURN NEW;
END;
$$;

-- Antes de ejecutar: la compra debe admitir el pago (no anulada, no borrador, sin exceder el saldo).
CREATE OR REPLACE FUNCTION public.fn_guard_treasury_payment_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF NEW.purchase_id IS NOT NULL AND NEW.status = 'PAID' AND COALESCE(OLD.status, '') <> 'PAID'
       AND NOT EXISTS (SELECT 1 FROM public.supplier_payments sp
                       WHERE sp.company_id = NEW.company_id AND sp.payment_number = NEW.payment_number) THEN
        PERFORM public.fn_assert_purchase_payable_internal(NEW.purchase_id, NEW.company_id, NEW.amount);
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_sync_treasury_payment_to_supplier_payments() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_guard_treasury_payment_purchase() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_treasury_payment_purchase ON public.treasury_payments;
CREATE TRIGGER trg_guard_treasury_payment_purchase
    BEFORE UPDATE OF status ON public.treasury_payments
    FOR EACH ROW EXECUTE FUNCTION public.fn_guard_treasury_payment_purchase();

DROP TRIGGER IF EXISTS trg_sync_treasury_payment_to_supplier_payments ON public.treasury_payments;
CREATE TRIGGER trg_sync_treasury_payment_to_supplier_payments
    AFTER UPDATE OF status ON public.treasury_payments
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_treasury_payment_to_supplier_payments();

COMMIT;
