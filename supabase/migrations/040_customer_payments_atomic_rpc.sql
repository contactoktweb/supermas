-- ==============================================================================
-- 040_CUSTOMER_PAYMENTS_ATOMIC_RPC.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Hardening fiduciario atómico para Cuentas por Cobrar (CxC), Recaudos y Tesorería
-- 
-- 1. Enlaces fiduciarios en customer_payments, bank_movements y cash_movements.
-- 2. fn_next_customer_payment_number (Consecutivo atómico multiempresa: REC-XXXXXX).
-- 3. fn_register_customer_payment (RPC atómica transaccional SECURITY DEFINER):
--    - Bloqueo pesimista de Venta (SELECT FOR UPDATE)
--    - Candado transaccional consultivo por venta
--    - Aislamiento multiempresa estricto
--    - Validación de estado de la venta (rechaza ventas anuladas)
--    - Prevención estricta de sobrepagos y pagos inválidos (<= 0)
--    - Afectación automática y atómica de Tesorería (Caja POS / Extracto Bancario)
--    - Actualización automática de saldo de la venta y de cartera del cliente
--    - Auditoría transaccional automática en audit_logs (RECEIVABLE_PAYMENT / RECEIVABLE_PAID)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ESTRUCTURA Y ENLACES FIDUCIARIOS BIDIRECCIONALES
-- ------------------------------------------------------------------------------

ALTER TABLE public.customer_payments
    ADD COLUMN IF NOT EXISTS bank_movement_id UUID REFERENCES public.bank_movements(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS cash_movement_id UUID REFERENCES public.cash_movements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customer_payments_bank_movement ON public.customer_payments(bank_movement_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_cash_movement ON public.customer_payments(cash_movement_id);

ALTER TABLE public.bank_movements
    ADD COLUMN IF NOT EXISTS customer_payment_id UUID REFERENCES public.customer_payments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bank_movements_customer_payment ON public.bank_movements(customer_payment_id);

ALTER TABLE public.cash_movements
    ADD COLUMN IF NOT EXISTS customer_payment_id UUID REFERENCES public.customer_payments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cash_movements_customer_payment ON public.cash_movements(customer_payment_id);

-- ------------------------------------------------------------------------------
-- 2. GENERADOR DE CONSECUTIVO ATÓMICO MULTIEMPRESA: REC-XXXXXX
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_next_customer_payment_number(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_last_num INT;
    v_next_num TEXT;
BEGIN
    IF p_company_id IS NULL THEN
        RAISE EXCEPTION 'fn_next_customer_payment_number: company_id no puede ser nulo.'
            USING ERRCODE = '23502';
    END IF;

    -- Candado transaccional consultivo por empresa para serializar generación de consecutivos de recaudo
    PERFORM pg_advisory_xact_lock(hashtext('customer_payments_consecutive_' || p_company_id::text));

    SELECT COALESCE(MAX(NULLIF(SUBSTRING(payment_number FROM 'REC-([0-9]+)'), '')::INT), 0)
    INTO v_last_num
    FROM public.customer_payments
    WHERE company_id = p_company_id;

    v_next_num := 'REC-' || LPAD((v_last_num + 1)::TEXT, 6, '0');
    RETURN v_next_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.fn_next_customer_payment_number(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_next_customer_payment_number(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. RPC ATÓMICA: fn_register_customer_payment
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_register_customer_payment(
    p_sale_id UUID,
    p_amount NUMERIC(15,2),
    p_payment_date DATE DEFAULT CURRENT_DATE,
    p_payment_method VARCHAR(50) DEFAULT 'EFECTIVO',
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
    v_sale RECORD;
    v_customer RECORD;
    v_customer_name VARCHAR(250);
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
    v_new_customer_balance NUMERIC(15,2);
BEGIN
    -- 3.1 Identificación de usuario y empresa
    v_user_id := auth.uid();
    v_company_id := public.get_auth_company_id();

    -- Fallback administrativo si se invoca desde scripts autenticados vía service_role
    IF v_company_id IS NULL THEN
        SELECT company_id INTO v_company_id FROM public.sales WHERE id = p_sale_id;
    END IF;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo resolver la empresa para procesar el recaudo.'
            USING ERRCODE = '42501';
    END IF;

    -- 3.2 Control de permisos RBAC
    IF NOT (public.has_permission('sales.create') OR public.has_permission('treasury.create') OR public.has_permission('customers.write') OR public.is_admin()) THEN
        RAISE EXCEPTION 'No tienes permisos suficientes para registrar recaudos de clientes.'
            USING ERRCODE = '42501';
    END IF;

    -- Resolver nombre de usuario para auditoría
    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Usuario Sistema';
    END IF;

    -- 3.3 Candado transaccional consultivo sobre la venta
    PERFORM pg_advisory_xact_lock(hashtext('sale_customer_payment_' || p_sale_id::text));

    -- 3.4 Bloqueo pesimista y lectura de la venta (FOR UPDATE)
    SELECT 
        id, 
        company_id, 
        location_id, 
        customer_id, 
        sale_number, 
        total_amount, 
        paid_amount, 
        payment_status,
        UPPER(COALESCE(status::text, '')) AS sale_st
    INTO v_sale
    FROM public.sales
    WHERE id = p_sale_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La venta / cuenta por cobrar especificada no existe.'
            USING ERRCODE = '23503';
    END IF;

    -- 3.5 Validación de aislamiento multiempresa
    IF v_sale.company_id != v_company_id THEN
        RAISE EXCEPTION 'La cuenta por cobrar pertenece a otra empresa.'
            USING ERRCODE = '42501';
    END IF;

    -- 3.6 Validación de estados comerciales
    IF v_sale.sale_st = 'CANCELLED' OR v_sale.sale_st = 'ANULADA' THEN
        RAISE EXCEPTION 'No se pueden registrar pagos a una venta anulada.'
            USING ERRCODE = '42200';
    END IF;

    -- 3.7 Validación estricta del monto y sobrepago
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'El monto del recaudo debe ser estrictamente mayor a 0.'
            USING ERRCODE = '42200';
    END IF;

    v_pending_balance := v_sale.total_amount - v_sale.paid_amount;

    IF v_pending_balance <= 0 THEN
        RAISE EXCEPTION 'Esta venta ya se encuentra totalmente saldada (saldo pendiente: 0).'
            USING ERRCODE = '42200';
    END IF;

    IF p_amount > v_pending_balance THEN
        RAISE EXCEPTION 'El monto a recaudar (%) supera el saldo pendiente de la venta (%).', p_amount, v_pending_balance
            USING ERRCODE = '42200';
    END IF;

    -- 3.8 Obtener y bloquear registro del cliente
    SELECT id, company_id, current_balance, company_name, first_name, last_name
    INTO v_customer
    FROM public.customers
    WHERE id = v_sale.customer_id
    FOR UPDATE;

    v_customer_name := COALESCE(
        v_customer.company_name,
        NULLIF(TRIM(COALESCE(v_customer.first_name, '') || ' ' || COALESCE(v_customer.last_name, '')), ''),
        'Cliente'
    );

    -- 3.9 Normalización del medio de pago
    v_normalized_method := UPPER(TRIM(COALESCE(p_payment_method, 'EFECTIVO')));
    IF v_normalized_method IN ('EFECTIVO', 'CASH') THEN
        v_normalized_method := 'EFECTIVO';
    ELSIF v_normalized_method IN ('TRANSFERENCIA', 'BANK_TRANSFER', 'TRANSFER') THEN
        v_normalized_method := 'TRANSFERENCIA';
    ELSIF v_normalized_method IN ('TARJETA', 'CARD', 'DATAFONO') THEN
        v_normalized_method := 'TARJETA';
    ELSIF v_normalized_method IN ('CHEQUE', 'CHECK') THEN
        v_normalized_method := 'CHEQUE';
    END IF;

    -- Generar consecutivo oficial
    v_payment_number := public.fn_next_customer_payment_number(v_sale.company_id);
    v_payment_id := gen_random_uuid();

    -- 3.10 Afectación fiduciaria de Tesorería (Caja / Banco)
    IF v_normalized_method = 'EFECTIVO' THEN
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
            SELECT id, company_id, location_id, status
            INTO v_cash_session
            FROM public.cash_sessions
            WHERE company_id = v_sale.company_id
              AND (location_id = v_sale.location_id OR location_id IS NULL)
              AND status = 'OPEN'
            ORDER BY created_at DESC
            LIMIT 1
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'No existe una sesión de caja abierta para registrar el recaudo en efectivo.'
                    USING ERRCODE = '42200';
            END IF;
        END IF;

        IF v_cash_session.company_id != v_sale.company_id THEN
            RAISE EXCEPTION 'La sesión de caja pertenece a otra empresa.'
                USING ERRCODE = '42501';
        END IF;

        IF v_cash_session.status != 'OPEN' THEN
            RAISE EXCEPTION 'La sesión de caja no está abierta (estado actual: %).', v_cash_session.status
                USING ERRCODE = '42200';
        END IF;

        v_final_cash_session_id := v_cash_session.id;

        -- Registrar ingreso a caja
        INSERT INTO public.cash_movements (
            session_id,
            type,
            amount,
            reason,
            authorized_by_user_id,
            created_at
        ) VALUES (
            v_cash_session.id,
            'SALE_CASH',
            p_amount,
            'Recaudo cliente ' || v_customer_name || ' (Venta ' || v_sale.sale_number || ' - ' || v_payment_number || ')',
            v_user_id,
            NOW()
        ) RETURNING id INTO v_cash_movement_id;

    ELSIF v_normalized_method IN ('TRANSFERENCIA', 'TARJETA', 'CHEQUE') OR p_bank_account_id IS NOT NULL THEN
        -- Validación y afectación de Cuenta Bancaria
        IF p_bank_account_id IS NULL THEN
            SELECT id INTO p_bank_account_id
            FROM public.bank_accounts
            WHERE company_id = v_sale.company_id
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

        IF v_bank_row.company_id != v_sale.company_id THEN
            RAISE EXCEPTION 'La cuenta bancaria pertenece a otra empresa.'
                USING ERRCODE = '42501';
        END IF;

        IF NOT v_bank_row.is_active THEN
            RAISE EXCEPTION 'La cuenta bancaria se encuentra inactiva.'
                USING ERRCODE = '42200';
        END IF;

        -- Aumentar saldo bancario (Ingreso / Crédito para extracto bancario de la empresa)
        v_new_bank_balance := v_bank_row.current_balance + p_amount;
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

        -- Registrar movimiento en extracto bancario (CREDIT = Entrada de dinero)
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
            customer_payment_id,
            is_reconciled,
            created_by_user_id,
            created_at
        ) VALUES (
            v_sale.company_id,
            v_sale.location_id,
            v_bank_row.id,
            v_bm_number,
            p_payment_date,
            'CREDIT',
            p_amount,
            v_new_bank_balance,
            'Recaudo cliente ' || v_customer_name || ' (Venta ' || v_sale.sale_number || ' - ' || v_payment_number || ')',
            p_transaction_reference,
            NULL, -- se actualiza después de insertar el pago
            false,
            v_user_id,
            NOW()
        ) RETURNING id INTO v_bank_movement_id;
    END IF;

    -- 3.11 Insertar comprobante en public.customer_payments
    INSERT INTO public.customer_payments (
        id,
        company_id,
        location_id,
        sale_id,
        customer_id,
        payment_number,
        payment_date,
        amount,
        payment_method,
        transaction_reference,
        bank_account_id,
        cash_session_id,
        bank_movement_id,
        cash_movement_id,
        notes,
        created_by_user_id,
        created_at
    ) VALUES (
        v_payment_id,
        v_sale.company_id,
        v_sale.location_id,
        v_sale.id,
        v_sale.customer_id,
        v_payment_number,
        p_payment_date,
        p_amount,
        v_normalized_method,
        p_transaction_reference,
        v_final_bank_account_id,
        v_final_cash_session_id,
        v_bank_movement_id,
        v_cash_movement_id,
        p_notes,
        v_user_id,
        NOW()
    );

    -- Vincular extracto bancario y movimiento de caja con el pago oficial
    IF v_bank_movement_id IS NOT NULL THEN
        UPDATE public.bank_movements
        SET customer_payment_id = v_payment_id
        WHERE id = v_bank_movement_id;
    END IF;

    IF v_cash_movement_id IS NOT NULL THEN
        UPDATE public.cash_movements
        SET customer_payment_id = v_payment_id
        WHERE id = v_cash_movement_id;
    END IF;

    -- 3.12 Actualizar saldo y estado de la Venta (public.sales)
    v_new_paid_amount := v_sale.paid_amount + p_amount;
    v_new_payment_status := CASE
        WHEN v_new_paid_amount >= v_sale.total_amount THEN 'PAID'
        ELSE 'PARTIAL'
    END;

    UPDATE public.sales
    SET paid_amount = v_new_paid_amount,
        payment_status = v_new_payment_status,
        updated_at = NOW()
    WHERE id = v_sale.id;

    -- 3.13 Actualizar saldo de cartera del Cliente (public.customers)
    v_new_customer_balance := GREATEST(0.00, COALESCE(v_customer.current_balance, 0.00) - p_amount);
    UPDATE public.customers
    SET current_balance = v_new_customer_balance,
        updated_at = NOW()
    WHERE id = v_customer.id;

    -- 3.14 Registro de Auditoría Transaccional
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
        v_sale.company_id,
        v_user_id,
        v_user_name,
        'CUSTOMER_PAYMENT_CREATED',
        'SALES',
        'customer_payments',
        v_payment_id::TEXT,
        v_sale.location_id,
        jsonb_build_object(
            'sale_paid_amount', v_sale.paid_amount,
            'sale_payment_status', v_sale.payment_status,
            'customer_balance', v_customer.current_balance
        ),
        jsonb_build_object(
            'payment_id', v_payment_id,
            'payment_number', v_payment_number,
            'sale_id', v_sale.id,
            'sale_number', v_sale.sale_number,
            'customer_id', v_sale.customer_id,
            'customer_name', v_customer_name,
            'amount', p_amount,
            'payment_method', v_normalized_method,
            'transaction_reference', p_transaction_reference,
            'payment_date', p_payment_date,
            'new_sale_paid_amount', v_new_paid_amount,
            'new_sale_payment_status', v_new_payment_status,
            'remaining_sale_balance', v_sale.total_amount - v_new_paid_amount,
            'new_customer_balance', v_new_customer_balance,
            'bank_movement_id', v_bank_movement_id,
            'cash_movement_id', v_cash_movement_id
        ),
        NOW()
    );

    -- 3.15 Retornar payload consolidado
    RETURN jsonb_build_object(
        'payment_id', v_payment_id,
        'payment_number', v_payment_number,
        'sale_id', v_sale.id,
        'sale_number', v_sale.sale_number,
        'customer_id', v_customer.id,
        'customer_name', v_customer_name,
        'amount', p_amount,
        'payment_date', p_payment_date,
        'payment_method', v_normalized_method,
        'transaction_reference', p_transaction_reference,
        'total_amount', v_sale.total_amount,
        'paid_amount', v_new_paid_amount,
        'pending_balance', v_sale.total_amount - v_new_paid_amount,
        'payment_status', v_new_payment_status,
        'customer_balance', v_new_customer_balance,
        'bank_movement_id', v_bank_movement_id,
        'cash_movement_id', v_cash_movement_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.fn_register_customer_payment(UUID, NUMERIC, DATE, VARCHAR, VARCHAR, TEXT, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_register_customer_payment(UUID, NUMERIC, DATE, VARCHAR, VARCHAR, TEXT, UUID, UUID) TO authenticated, service_role;
