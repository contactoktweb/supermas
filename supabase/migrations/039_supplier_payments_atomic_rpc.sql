-- ==============================================================================
-- 039_SUPPLIER_PAYMENTS_ATOMIC_RPC.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- FASE 5.3: Cuentas por Pagar (CxP), Abonos y Pagos Atómicos con Afectación
--           Financiera en Caja/Bancos, Auditoría y Control de Concurrencia
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIÓN DE MODELO: ENLACES FINANCIEROS Y TRAZABILIDAD
-- ------------------------------------------------------------------------------

-- Columnas de enlace en public.supplier_payments
ALTER TABLE public.supplier_payments
    ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS bank_movement_id UUID REFERENCES public.bank_movements(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS cash_session_id UUID REFERENCES public.cash_sessions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS cash_movement_id UUID REFERENCES public.cash_movements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_payments_bank_account ON public.supplier_payments(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_cash_session ON public.supplier_payments(cash_session_id);

-- Enlace inverso en extracto bancario (public.bank_movements)
ALTER TABLE public.bank_movements
    ADD COLUMN IF NOT EXISTS supplier_payment_id UUID REFERENCES public.supplier_payments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bank_movements_supplier_payment ON public.bank_movements(supplier_payment_id);

-- ------------------------------------------------------------------------------
-- 2. GENERADOR DE CONSECUTIVO ATÓMICO MULTIEMPRESA: PAG-XXXXXX
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_next_supplier_payment_number(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_last_num INT;
    v_next_num TEXT;
BEGIN
    IF p_company_id IS NULL THEN
        RAISE EXCEPTION 'fn_next_supplier_payment_number: company_id no puede ser nulo.'
            USING ERRCODE = '23502';
    END IF;

    -- Candado transaccional consultivo por empresa para serializar generación de consecutivos de pago
    PERFORM pg_advisory_xact_lock(hashtext('supplier_payments_consecutive_' || p_company_id::text));

    -- Obtener el número máximo existente con formato PAG-XXXXXX para esta compañía
    SELECT COALESCE(MAX(
        NULLIF(SUBSTRING(payment_number FROM 'PAG-([0-9]+)'), '')::INT
    ), 0)
    INTO v_last_num
    FROM public.supplier_payments
    WHERE company_id = p_company_id
      AND payment_number ~ '^PAG-[0-9]+$';

    v_next_num := 'PAG-' || LPAD((v_last_num + 1)::TEXT, 6, '0');
    RETURN v_next_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.fn_next_supplier_payment_number(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_next_supplier_payment_number(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. RPC ATÓMICA PRINCIPAL: fn_register_supplier_payment
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_register_supplier_payment(
    p_purchase_id UUID,
    p_amount NUMERIC(15,2),
    p_payment_date DATE DEFAULT CURRENT_DATE,
    p_payment_method VARCHAR(30) DEFAULT 'BANK_TRANSFER',
    p_transaction_reference VARCHAR(100) DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_bank_account_id UUID DEFAULT NULL,
    p_cash_session_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_user_name VARCHAR(150);
    v_company_id UUID;
    v_purchase RECORD;
    v_supplier_name VARCHAR(200);
    v_pending_balance NUMERIC(15,2);
    v_payment_id UUID;
    v_payment_number VARCHAR(50);
    v_new_paid_amount NUMERIC(15,2);
    v_new_payment_status VARCHAR(30);
    v_normalized_method VARCHAR(30);
    
    -- Variables financieras
    v_bank_row RECORD;
    v_new_bank_balance NUMERIC(15,2);
    v_bm_seq INT;
    v_bm_number VARCHAR(50);
    v_bank_movement_id UUID := NULL;
    v_cash_session RECORD;
    v_cash_movement_id UUID := NULL;
    v_final_bank_account_id UUID := NULL;
    v_final_cash_session_id UUID := NULL;
BEGIN
    -- 3.1 Identificación de usuario y empresa
    v_user_id := auth.uid();
    v_company_id := public.get_auth_company_id();

    -- Fallback administrativo si se invoca desde scripts autenticados vía service_role
    IF v_company_id IS NULL THEN
        SELECT company_id INTO v_company_id FROM public.purchases WHERE id = p_purchase_id;
    END IF;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo resolver la empresa para procesar el pago.'
            USING ERRCODE = '42501';
    END IF;

    -- 3.2 Control de permisos RBAC
    IF NOT (public.has_permission('purchases.create') OR public.has_permission('treasury.create') OR public.is_admin()) THEN
        RAISE EXCEPTION 'No tienes permisos suficientes para registrar pagos a proveedores (purchases.create o treasury.create requerido).'
            USING ERRCODE = '42501';
    END IF;

    -- Resolver nombre de usuario para auditoría
    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Usuario Sistema';
    END IF;

    -- 3.3 Candado transaccional consultivo sobre la orden de compra
    PERFORM pg_advisory_xact_lock(hashtext('purchase_supplier_payment_' || p_purchase_id::text));

    -- 3.4 Bloqueo pesimista y lectura de la orden de compra
    SELECT 
        id, 
        company_id, 
        location_id, 
        supplier_id, 
        purchase_number, 
        total_amount, 
        paid_amount, 
        payment_status,
        UPPER(COALESCE(inventory_status, '')) AS inv_status
    INTO v_purchase
    FROM public.purchases
    WHERE id = p_purchase_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La orden de compra especificada no existe.'
            USING ERRCODE = '23503';
    END IF;

    -- 3.5 Validación de aislamiento multiempresa
    IF v_purchase.company_id != v_company_id THEN
        RAISE EXCEPTION 'La orden de compra pertenece a otra empresa.'
            USING ERRCODE = '42501';
    END IF;

    -- 3.6 Validación de estados comerciales
    IF v_purchase.inv_status = 'CANCELLED' OR v_purchase.inv_status = 'CANCELADA' THEN
        RAISE EXCEPTION 'No se pueden registrar pagos en una orden de compra anulada.'
            USING ERRCODE = '42200';
    END IF;

    IF v_purchase.inv_status = 'DRAFT' OR v_purchase.inv_status = 'BORRADOR' THEN
        RAISE EXCEPTION 'No se pueden registrar pagos en órdenes de compra en estado borrador. Debe confirmarse primero.'
            USING ERRCODE = '42200';
    END IF;

    -- 3.7 Validación estricta del monto
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'El monto del pago debe ser estrictamente mayor a 0.'
            USING ERRCODE = '42200';
    END IF;

    v_pending_balance := v_purchase.total_amount - v_purchase.paid_amount;

    IF v_pending_balance <= 0 THEN
        RAISE EXCEPTION 'La orden de compra ya se encuentra totalmente pagada (saldo pendiente: 0).'
            USING ERRCODE = '42200';
    END IF;

    IF p_amount > v_pending_balance THEN
        RAISE EXCEPTION 'El monto a pagar (%) excede el saldo pendiente de la compra (%).', p_amount, v_pending_balance
            USING ERRCODE = '42200';
    END IF;

    -- Obtener nombre del proveedor para glosas bancarias y de caja
    SELECT COALESCE(name, legal_name, 'Proveedor')
    INTO v_supplier_name
    FROM public.suppliers
    WHERE id = v_purchase.supplier_id;

    -- 3.8 Normalización del medio de pago
    v_normalized_method := UPPER(TRIM(COALESCE(p_payment_method, 'BANK_TRANSFER')));
    IF v_normalized_method IN ('EFECTIVO', 'CASH') THEN
        v_normalized_method := 'CASH';
    ELSIF v_normalized_method IN ('TRANSFERENCIA', 'BANK_TRANSFER', 'CONSIGNACION') THEN
        v_normalized_method := 'BANK_TRANSFER';
    ELSIF v_normalized_method IN ('CHEQUE', 'CHECK') THEN
        v_normalized_method := 'CHECK';
    ELSE
        v_normalized_method := 'OTHER';
    END IF;

    -- Generar consecutivo de pago oficial
    v_payment_number := public.fn_next_supplier_payment_number(v_purchase.company_id);
    v_payment_id := gen_random_uuid();

    -- 3.9 Procesamiento de la única salida financiera (Atomicidad total)
    IF v_normalized_method = 'CASH' THEN
        -- Validación y afectación de Sesión de Caja
        IF p_cash_session_id IS NOT NULL THEN
            SELECT id, company_id, location_id, status
            INTO v_cash_session
            FROM public.cash_sessions
            WHERE id = p_cash_session_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'La sesión de caja especificada no existe.'
                    USING ERRCODE = '23503';
            END IF;
        ELSE
            -- Buscar sesión abierta en la sede de la compra o empresa
            SELECT id, company_id, location_id, status
            INTO v_cash_session
            FROM public.cash_sessions
            WHERE company_id = v_purchase.company_id
              AND status = 'OPEN'
              AND (location_id = v_purchase.location_id OR location_id IS NULL)
            ORDER BY created_at DESC
            LIMIT 1
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'No existe una sesión de caja abierta para registrar el egreso en efectivo.'
                    USING ERRCODE = '42200';
            END IF;
        END IF;

        IF v_cash_session.company_id != v_purchase.company_id THEN
            RAISE EXCEPTION 'La sesión de caja pertenece a otra empresa.'
                USING ERRCODE = '42501';
        END IF;

        IF v_cash_session.status != 'OPEN' THEN
            RAISE EXCEPTION 'La sesión de caja no está abierta (estado actual: %).', v_cash_session.status
                USING ERRCODE = '42200';
        END IF;

        v_final_cash_session_id := v_cash_session.id;

        -- Registrar egreso de caja
        INSERT INTO public.cash_movements (
            session_id,
            type,
            amount,
            reason,
            authorized_by_user_id,
            created_at
        ) VALUES (
            v_cash_session.id,
            'WITHDRAWAL',
            p_amount,
            'Pago a proveedor ' || v_supplier_name || ' (Compra ' || v_purchase.purchase_number || ' - ' || v_payment_number || ')',
            v_user_id,
            NOW()
        ) RETURNING id INTO v_cash_movement_id;

    ELSIF v_normalized_method = 'BANK_TRANSFER' OR (v_normalized_method = 'CHECK' AND p_bank_account_id IS NOT NULL) THEN
        -- Validación y afectación de Cuenta Bancaria
        IF p_bank_account_id IS NULL THEN
            SELECT id INTO p_bank_account_id
            FROM public.bank_accounts
            WHERE company_id = v_purchase.company_id
              AND is_active = true
            ORDER BY created_at ASC
            LIMIT 1;
        END IF;

        IF p_bank_account_id IS NULL THEN
            RAISE EXCEPTION 'Debe especificar una cuenta bancaria activa para transferencias.'
                USING ERRCODE = '42200';
        END IF;

        SELECT id, company_id, location_id, bank_name, account_number, current_balance, is_active
        INTO v_bank_row
        FROM public.bank_accounts
        WHERE id = p_bank_account_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'La cuenta bancaria especificada no existe.'
                USING ERRCODE = '23503';
        END IF;

        v_final_bank_account_id := v_bank_row.id;

        IF v_bank_row.company_id != v_purchase.company_id THEN
            RAISE EXCEPTION 'La cuenta bancaria pertenece a otra empresa.'
                USING ERRCODE = '42501';
        END IF;

        IF NOT v_bank_row.is_active THEN
            RAISE EXCEPTION 'La cuenta bancaria se encuentra inactiva.'
                USING ERRCODE = '42200';
        END IF;

        -- Descontar saldo bancario
        v_new_bank_balance := v_bank_row.current_balance - p_amount;
        UPDATE public.bank_accounts
        SET current_balance = v_new_bank_balance,
            updated_at = NOW()
        WHERE id = v_bank_row.id;

        -- Generar consecutivo de extracto bancario
        SELECT COALESCE(MAX(NULLIF(SUBSTRING(movement_number FROM 'BM-([0-9]+)'), '')::INT), 0) + 1
        INTO v_bm_seq
        FROM public.bank_movements
        WHERE bank_account_id = v_bank_row.id;

        v_bm_number := 'BM-' || LPAD(v_bm_seq::TEXT, 6, '0');

        -- Registrar movimiento en extracto bancario (DEBIT)
        INSERT INTO public.bank_movements (
            company_id,
            location_id,
            bank_account_id,
            movement_number,
            movement_date,
            movement_type,
            amount,
            balance_after,
            concept,
            reference,
            supplier_payment_id,
            is_reconciled,
            created_by_user_id,
            created_at
        ) VALUES (
            v_purchase.company_id,
            v_purchase.location_id,
            v_bank_row.id,
            v_bm_number,
            p_payment_date,
            'DEBIT',
            p_amount,
            v_new_bank_balance,
            CASE 
                WHEN v_normalized_method = 'CHECK' THEN 'Giro de cheque ' || COALESCE(p_transaction_reference, '') || ' a ' || v_supplier_name || ' (Compra ' || v_purchase.purchase_number || ')'
                ELSE 'Pago a proveedor ' || v_supplier_name || ' (Compra ' || v_purchase.purchase_number || ' - ' || v_payment_number || ')'
            END,
            p_transaction_reference,
            NULL, -- supplier_payment_id se actualiza inmediatamente después de insertar el pago
            false,
            v_user_id,
            NOW()
        ) RETURNING id INTO v_bank_movement_id;
    END IF;

    -- 3.10 Insertar registro oficial en public.supplier_payments
    INSERT INTO public.supplier_payments (
        id,
        purchase_id,
        company_id,
        location_id,
        payment_number,
        payment_date,
        amount,
        payment_method,
        transaction_reference,
        notes,
        created_by_user_id,
        bank_account_id,
        bank_movement_id,
        cash_session_id,
        cash_movement_id,
        created_at
    ) VALUES (
        v_payment_id,
        v_purchase.id,
        v_purchase.company_id,
        v_purchase.location_id,
        v_payment_number,
        p_payment_date,
        p_amount,
        v_normalized_method,
        p_transaction_reference,
        p_notes,
        v_user_id,
        v_final_bank_account_id,
        v_bank_movement_id,
        v_final_cash_session_id,
        v_cash_movement_id,
        NOW()
    );

    -- Vincular movimiento bancario al pago registrado
    IF v_bank_movement_id IS NOT NULL THEN
        UPDATE public.bank_movements
        SET supplier_payment_id = v_payment_id
        WHERE id = v_bank_movement_id;
    END IF;

    -- 3.11 Actualizar saldo y estado de la Cuenta por Pagar (public.purchases)
    v_new_paid_amount := v_purchase.paid_amount + p_amount;
    v_new_payment_status := CASE
        WHEN v_new_paid_amount >= v_purchase.total_amount THEN 'PAID'
        ELSE 'PARTIAL'
    END;

    UPDATE public.purchases
    SET paid_amount = v_new_paid_amount,
        payment_status = v_new_payment_status,
        updated_at = NOW()
    WHERE id = v_purchase.id;

    -- 3.12 Auditoría explícita SUPPLIER_PAYMENT_CREATED
    INSERT INTO public.audit_logs (
        id,
        company_id,
        user_id,
        user_name,
        action,
        module,
        entity_name,
        entity_id,
        location_id,
        previous_value,
        new_value,
        created_at
    ) VALUES (
        gen_random_uuid(),
        v_purchase.company_id,
        v_user_id,
        v_user_name,
        'SUPPLIER_PAYMENT_CREATED',
        'PURCHASES',
        'supplier_payments',
        v_payment_id::TEXT,
        v_purchase.location_id,
        jsonb_build_object(
            'paid_amount', v_purchase.paid_amount,
            'payment_status', v_purchase.payment_status,
            'pending_balance', v_pending_balance
        ),
        jsonb_build_object(
            'payment_id', v_payment_id,
            'payment_number', v_payment_number,
            'purchase_id', v_purchase.id,
            'purchase_number', v_purchase.purchase_number,
            'supplier_id', v_purchase.supplier_id,
            'supplier_name', v_supplier_name,
            'amount', p_amount,
            'payment_method', v_normalized_method,
            'transaction_reference', p_transaction_reference,
            'payment_date', p_payment_date,
            'new_paid_amount', v_new_paid_amount,
            'new_payment_status', v_new_payment_status,
            'remaining_balance', v_purchase.total_amount - v_new_paid_amount,
            'bank_movement_id', v_bank_movement_id,
            'cash_movement_id', v_cash_movement_id
        ),
        NOW()
    );

    -- 3.13 Retornar payload consolidado
    RETURN jsonb_build_object(
        'payment_id', v_payment_id,
        'payment_number', v_payment_number,
        'purchase_id', v_purchase.id,
        'purchase_number', v_purchase.purchase_number,
        'amount', p_amount,
        'payment_date', p_payment_date,
        'payment_method', v_normalized_method,
        'transaction_reference', p_transaction_reference,
        'total_amount', v_purchase.total_amount,
        'paid_amount', v_new_paid_amount,
        'pending_balance', v_purchase.total_amount - v_new_paid_amount,
        'payment_status', v_new_payment_status,
        'bank_movement_id', v_bank_movement_id,
        'cash_movement_id', v_cash_movement_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.fn_register_supplier_payment(UUID, NUMERIC, DATE, VARCHAR, VARCHAR, TEXT, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_register_supplier_payment(UUID, NUMERIC, DATE, VARCHAR, VARCHAR, TEXT, UUID, UUID) TO authenticated, service_role;
