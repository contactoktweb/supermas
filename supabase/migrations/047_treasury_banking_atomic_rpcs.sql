-- ============================================================================
-- MIGRACIÓN 047: Cuentas Bancarias, Movimientos, Pagos, Recaudos y Conciliación
-- ============================================================================

-- 1. Asegurar Aislamiento Multiempresa en Restricciones Únicas
ALTER TABLE public.bank_accounts DROP CONSTRAINT IF EXISTS bank_accounts_account_number_key;
ALTER TABLE public.bank_accounts DROP CONSTRAINT IF EXISTS bank_accounts_company_account_number_key;
ALTER TABLE public.bank_accounts ADD CONSTRAINT bank_accounts_company_account_number_key UNIQUE (company_id, account_number);

ALTER TABLE public.treasury_receipts DROP CONSTRAINT IF EXISTS treasury_receipts_receipt_number_key;
ALTER TABLE public.treasury_receipts DROP CONSTRAINT IF EXISTS treasury_receipts_company_receipt_number_key;
ALTER TABLE public.treasury_receipts ADD CONSTRAINT treasury_receipts_company_receipt_number_key UNIQUE (company_id, receipt_number);

ALTER TABLE public.treasury_payments DROP CONSTRAINT IF EXISTS treasury_payments_payment_number_key;
ALTER TABLE public.treasury_payments DROP CONSTRAINT IF EXISTS treasury_payments_company_payment_number_key;
ALTER TABLE public.treasury_payments ADD CONSTRAINT treasury_payments_company_payment_number_key UNIQUE (company_id, payment_number);

-- 2. Habilitar política de UPDATE en bank_movements
DROP POLICY IF EXISTS "Tenant isolation update bank_movements" ON public.bank_movements;
CREATE POLICY "Tenant isolation update bank_movements" ON public.bank_movements
    FOR UPDATE TO authenticated
    USING (company_id = public.get_auth_company_id())
    WITH CHECK (company_id = public.get_auth_company_id());

-- 3. Generador de Consecutivos Fiduciarios de Tesorería
CREATE OR REPLACE FUNCTION public.fn_next_treasury_consecutive(
    p_company_id UUID,
    p_doc_type VARCHAR
)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_prefix VARCHAR(15);
    v_year VARCHAR(4);
    v_pattern VARCHAR(30);
    v_next_val BIGINT;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('treasury_consecutive_' || p_company_id::text || '_' || p_doc_type));

    v_year := TO_CHAR(CURRENT_DATE, 'YYYY');

    IF p_doc_type = 'RECEIPT' THEN
        v_prefix := 'TES-REC-' || v_year;
        v_pattern := '^TES-REC-' || v_year || '-[0-9]+$';

        SELECT COALESCE(MAX(
            CASE 
                WHEN receipt_number ~ v_pattern THEN SUBSTRING(receipt_number FROM LENGTH(v_prefix) + 2)::BIGINT
                ELSE 0 
            END
        ), 0) + 1
        INTO v_next_val
        FROM public.treasury_receipts
        WHERE company_id = p_company_id;

    ELSIF p_doc_type = 'PAYMENT' THEN
        v_prefix := 'TES-PAG-' || v_year;
        v_pattern := '^TES-PAG-' || v_year || '-[0-9]+$';

        SELECT COALESCE(MAX(
            CASE 
                WHEN payment_number ~ v_pattern THEN SUBSTRING(payment_number FROM LENGTH(v_prefix) + 2)::BIGINT
                ELSE 0 
            END
        ), 0) + 1
        INTO v_next_val
        FROM public.treasury_payments
        WHERE company_id = p_company_id;

    ELSIF p_doc_type = 'BANK_MOV' THEN
        v_prefix := 'MOV-BNC-' || v_year;
        v_pattern := '^MOV-BNC-' || v_year || '-[0-9]+$';

        SELECT COALESCE(MAX(
            CASE 
                WHEN movement_number ~ v_pattern THEN SUBSTRING(movement_number FROM LENGTH(v_prefix) + 2)::BIGINT
                ELSE 0 
            END
        ), 0) + 1
        INTO v_next_val
        FROM public.bank_movements
        WHERE company_id = p_company_id;

    ELSE
        RAISE EXCEPTION 'Tipo de documento de tesorería no reconocido: %', p_doc_type
            USING ERRCODE = '42200';
    END IF;

    RETURN v_prefix || '-' || LPAD(v_next_val::TEXT, 5, '0');
END;
$$;


-- 4. RPC: fn_create_bank_account (Creación de cuenta bancaria)
CREATE OR REPLACE FUNCTION public.fn_create_bank_account(
    p_bank_name VARCHAR,
    p_account_number VARCHAR,
    p_account_type VARCHAR DEFAULT 'CORRIENTE',
    p_currency VARCHAR DEFAULT 'COP',
    p_initial_balance NUMERIC(15,2) DEFAULT 0.00,
    p_location_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_company_id UUID;
    v_user_name VARCHAR(150);
    v_account_id UUID;
    v_mov_number VARCHAR(50);
BEGIN
    v_user_id := auth.uid();
    v_company_id := public.get_auth_company_id();

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo determinar la empresa del usuario autenticado.'
            USING ERRCODE = '42501';
    END IF;

    IF p_bank_name IS NULL OR TRIM(p_bank_name) = '' THEN
        RAISE EXCEPTION 'El nombre del banco es obligatorio.' USING ERRCODE = '42200';
    END IF;

    IF p_account_number IS NULL OR TRIM(p_account_number) = '' THEN
        RAISE EXCEPTION 'El número de cuenta bancaria es obligatorio.' USING ERRCODE = '42200';
    END IF;

    IF p_initial_balance < 0 THEN
        RAISE EXCEPTION 'El saldo inicial no puede ser negativo.' USING ERRCODE = '42200';
    END IF;

    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Usuario Sistema';
    END IF;

    v_account_id := gen_random_uuid();

    -- 1. Crear cuenta bancaria
    INSERT INTO public.bank_accounts (
        id,
        company_id,
        location_id,
        bank_name,
        account_number,
        account_type,
        currency,
        current_balance,
        is_active,
        description,
        created_by_user_id,
        created_at,
        updated_at
    ) VALUES (
        v_account_id,
        v_company_id,
        p_location_id,
        TRIM(p_bank_name),
        TRIM(p_account_number),
        COALESCE(p_account_type, 'CORRIENTE'),
        COALESCE(p_currency, 'COP'),
        p_initial_balance,
        true,
        p_description,
        v_user_id,
        NOW(),
        NOW()
    );

    -- 2. Si el saldo inicial > 0, registrar movimiento bancario de apertura
    IF p_initial_balance > 0 THEN
        v_mov_number := public.fn_next_treasury_consecutive(v_company_id, 'BANK_MOV');

        INSERT INTO public.bank_movements (
            id,
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
            is_reconciled,
            reconciled_at,
            created_by_user_id,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            v_company_id,
            p_location_id,
            v_account_id,
            v_mov_number,
            CURRENT_DATE,
            'CREDIT',
            p_initial_balance,
            p_initial_balance,
            'Saldo inicial de apertura de cuenta bancaria',
            'APERTURA',
            true,
            NOW(),
            v_user_id,
            NOW(),
            NOW()
        );
    END IF;

    -- 3. Auditoría
    INSERT INTO public.audit_logs (
        company_id,
        user_id,
        user_name,
        action,
        module,
        entity_name,
        entity_id,
        location_id,
        new_value,
        created_at
    ) VALUES (
        v_company_id,
        v_user_id,
        v_user_name,
        'BANK_ACCOUNT_CREATED',
        'TREASURY',
        'bank_accounts',
        v_account_id,
        p_location_id,
        jsonb_build_object(
            'account_id', v_account_id,
            'bank_name', p_bank_name,
            'account_number', p_account_number,
            'initial_balance', p_initial_balance
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'bank_account_id', v_account_id,
        'bank_name', p_bank_name,
        'account_number', p_account_number,
        'current_balance', p_initial_balance
    );
END;
$$;


-- 5. RPC: fn_schedule_treasury_payment (Programación de pago a proveedor / CxP)
CREATE OR REPLACE FUNCTION public.fn_schedule_treasury_payment(
    p_supplier_id UUID,
    p_bank_account_id UUID,
    p_amount NUMERIC(15,2),
    p_payment_date DATE DEFAULT CURRENT_DATE,
    p_due_date DATE DEFAULT NULL,
    p_purchase_id UUID DEFAULT NULL,
    p_payment_method VARCHAR DEFAULT 'TRANSFERENCIA',
    p_reference_number TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_company_id UUID;
    v_user_name VARCHAR(150);
    v_payment_id UUID;
    v_payment_number VARCHAR(50);
    v_supplier RECORD;
    v_bank RECORD;
    v_purchase RECORD;
BEGIN
    v_user_id := auth.uid();
    v_company_id := public.get_auth_company_id();

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo determinar la empresa del usuario autenticado.'
            USING ERRCODE = '42501';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'El monto del pago debe ser estrictamente mayor a 0.'
            USING ERRCODE = '42200';
    END IF;

    -- Validar proveedor
    SELECT id, company_id, name, legal_name, tax_id
    INTO v_supplier
    FROM public.suppliers
    WHERE id = p_supplier_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El proveedor especificado no existe.' USING ERRCODE = '23503';
    END IF;
    IF v_supplier.company_id != v_company_id THEN
        RAISE EXCEPTION 'El proveedor pertenece a otra empresa.' USING ERRCODE = '42501';
    END IF;

    -- Validar cuenta bancaria
    SELECT id, company_id, location_id, bank_name, account_number, is_active
    INTO v_bank
    FROM public.bank_accounts
    WHERE id = p_bank_account_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La cuenta bancaria especificada no existe.' USING ERRCODE = '23503';
    END IF;
    IF v_bank.company_id != v_company_id THEN
        RAISE EXCEPTION 'La cuenta bancaria pertenece a otra empresa.' USING ERRCODE = '42501';
    END IF;

    -- Validar compra si se especifica
    IF p_purchase_id IS NOT NULL THEN
        SELECT id, company_id, purchase_number, total_amount, paid_amount
        INTO v_purchase
        FROM public.purchases
        WHERE id = p_purchase_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'La factura de compra especificada no existe.' USING ERRCODE = '23503';
        END IF;
        IF v_purchase.company_id != v_company_id THEN
            RAISE EXCEPTION 'La compra pertenece a otra empresa.' USING ERRCODE = '42501';
        END IF;
    END IF;

    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Usuario Sistema';
    END IF;

    v_payment_id := gen_random_uuid();
    v_payment_number := public.fn_next_treasury_consecutive(v_company_id, 'PAYMENT');

    INSERT INTO public.treasury_payments (
        id,
        company_id,
        location_id,
        payment_number,
        payment_type,
        purchase_id,
        supplier_id,
        bank_account_id,
        amount,
        payment_date,
        due_date,
        payment_method,
        reference_number,
        status,
        notes,
        created_by_user_id,
        created_at,
        updated_at
    ) VALUES (
        v_payment_id,
        v_company_id,
        v_bank.location_id,
        v_payment_number,
        'SUPPLIER_PAYMENT',
        p_purchase_id,
        p_supplier_id,
        p_bank_account_id,
        p_amount,
        COALESCE(p_payment_date, CURRENT_DATE),
        p_due_date,
        COALESCE(p_payment_method, 'TRANSFERENCIA'),
        p_reference_number,
        'SCHEDULED',
        p_notes,
        v_user_id,
        NOW(),
        NOW()
    );

    -- Auditoría
    INSERT INTO public.audit_logs (
        company_id,
        user_id,
        user_name,
        action,
        module,
        entity_name,
        entity_id,
        location_id,
        new_value,
        created_at
    ) VALUES (
        v_company_id,
        v_user_id,
        v_user_name,
        'TREASURY_PAYMENT_SCHEDULED',
        'TREASURY',
        'treasury_payments',
        v_payment_id,
        v_bank.location_id,
        jsonb_build_object(
            'payment_id', v_payment_id,
            'payment_number', v_payment_number,
            'supplier_id', p_supplier_id,
            'amount', p_amount,
            'purchase_id', p_purchase_id
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'payment_number', v_payment_number,
        'amount', p_amount,
        'status', 'SCHEDULED'
    );
END;
$$;


-- 6. RPC: fn_execute_treasury_payment (Desembolso atómico de pago a proveedor)
CREATE OR REPLACE FUNCTION public.fn_execute_treasury_payment(
    p_payment_id UUID,
    p_bank_account_id UUID DEFAULT NULL,
    p_reference_number TEXT DEFAULT NULL,
    p_support_document_url TEXT DEFAULT NULL,
    p_payment_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_company_id UUID;
    v_user_name VARCHAR(150);
    v_payment RECORD;
    v_bank_id UUID;
    v_bank RECORD;
    v_new_balance NUMERIC(15,2);
    v_mov_number VARCHAR(50);
    v_mov_id UUID;
    v_new_paid NUMERIC(15,2);
    v_new_status VARCHAR(20);
BEGIN
    v_user_id := auth.uid();
    v_company_id := public.get_auth_company_id();

    -- Bloqueo pesimista del pago
    PERFORM pg_advisory_xact_lock(hashtext('treasury_payment_' || p_payment_id::text));

    SELECT *
    INTO v_payment
    FROM public.treasury_payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El pago programado especificado no existe.' USING ERRCODE = '23503';
    END IF;

    IF v_company_id IS NULL THEN
        v_company_id := v_payment.company_id;
    END IF;

    IF v_payment.company_id != v_company_id THEN
        RAISE EXCEPTION 'El pago programado pertenece a otra empresa.' USING ERRCODE = '42501';
    END IF;

    IF v_payment.status != 'SCHEDULED' THEN
        RAISE EXCEPTION 'El pago ya fue procesado o se encuentra en estado %.', v_payment.status
            USING ERRCODE = '42200';
    END IF;

    v_bank_id := COALESCE(p_bank_account_id, v_payment.bank_account_id);

    -- Bloqueo pesimista de la cuenta bancaria
    PERFORM pg_advisory_xact_lock(hashtext('bank_account_' || v_bank_id::text));

    SELECT *
    INTO v_bank
    FROM public.bank_accounts
    WHERE id = v_bank_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La cuenta bancaria seleccionada no existe.' USING ERRCODE = '23503';
    END IF;

    IF v_bank.company_id != v_company_id THEN
        RAISE EXCEPTION 'La cuenta bancaria pertenece a otra empresa.' USING ERRCODE = '42501';
    END IF;

    IF v_bank.is_active != true THEN
        RAISE EXCEPTION 'La cuenta bancaria "%" está inactiva.', v_bank.bank_name
            USING ERRCODE = '42200';
    END IF;

    -- Validar fondos suficientes
    IF v_bank.current_balance < v_payment.amount THEN
        RAISE EXCEPTION 'Fondos insuficientes en la cuenta bancaria "% (%)". Saldo disponible: %, Monto requerido: %.',
            v_bank.bank_name, v_bank.account_number, v_bank.current_balance, v_payment.amount
            USING ERRCODE = '42200';
    END IF;

    v_new_balance := v_bank.current_balance - v_payment.amount;

    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Usuario Sistema';
    END IF;

    -- 1. Actualizar saldo bancario
    UPDATE public.bank_accounts
    SET current_balance = v_new_balance,
        updated_at = NOW()
    WHERE id = v_bank_id;

    -- 2. Registrar movimiento bancario (DEBIT)
    v_mov_number := public.fn_next_treasury_consecutive(v_company_id, 'BANK_MOV');
    v_mov_id := gen_random_uuid();

    INSERT INTO public.bank_movements (
        id,
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
        treasury_payment_id,
        is_reconciled,
        created_by_user_id,
        created_at,
        updated_at
    ) VALUES (
        v_mov_id,
        v_company_id,
        v_bank.location_id,
        v_bank_id,
        v_mov_number,
        COALESCE(p_payment_date, CURRENT_DATE),
        'DEBIT',
        v_payment.amount,
        v_new_balance,
        'Desembolso pago ' || v_payment.payment_number,
        COALESCE(p_reference_number, v_payment.reference_number),
        p_payment_id,
        false,
        v_user_id,
        NOW(),
        NOW()
    );

    -- 3. Actualizar estado del pago a PAID
    UPDATE public.treasury_payments
    SET status = 'PAID',
        bank_account_id = v_bank_id,
        reference_number = COALESCE(p_reference_number, reference_number),
        support_document_url = COALESCE(p_support_document_url, support_document_url),
        payment_date = COALESCE(p_payment_date, payment_date),
        paid_at = NOW(),
        updated_at = NOW()
    WHERE id = p_payment_id;

    -- 4. Si está vinculado a una compra (CxP), actualizar saldo de la compra
    IF v_payment.purchase_id IS NOT NULL THEN
        UPDATE public.purchases
        SET paid_amount = paid_amount + v_payment.amount,
            payment_status = CASE 
                WHEN (paid_amount + v_payment.amount) >= total_amount THEN 'PAID'
                ELSE 'PARTIAL'
            END,
            updated_at = NOW()
        WHERE id = v_payment.purchase_id;
    END IF;

    -- 5. Auditoría
    INSERT INTO public.audit_logs (
        company_id,
        user_id,
        user_name,
        action,
        module,
        entity_name,
        entity_id,
        location_id,
        new_value,
        created_at
    ) VALUES (
        v_company_id,
        v_user_id,
        v_user_name,
        'TREASURY_PAYMENT_EXECUTED',
        'TREASURY',
        'treasury_payments',
        p_payment_id,
        v_bank.location_id,
        jsonb_build_object(
            'payment_id', p_payment_id,
            'payment_number', v_payment.payment_number,
            'amount', v_payment.amount,
            'bank_account_id', v_bank_id,
            'bank_movement_id', v_mov_id,
            'previous_bank_balance', v_bank.current_balance,
            'new_bank_balance', v_new_balance,
            'purchase_id', v_payment.purchase_id
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', p_payment_id,
        'payment_number', v_payment.payment_number,
        'amount', v_payment.amount,
        'bank_movement_id', v_mov_id,
        'bank_movement_number', v_mov_number,
        'new_bank_balance', v_new_balance,
        'status', 'PAID'
    );
END;
$$;


-- 7. RPC: fn_register_treasury_receipt (Registro atómico de recaudo de cliente)
CREATE OR REPLACE FUNCTION public.fn_register_treasury_receipt(
    p_customer_id UUID,
    p_bank_account_id UUID,
    p_amount NUMERIC(15,2),
    p_receipt_date DATE DEFAULT CURRENT_DATE,
    p_payment_method VARCHAR DEFAULT 'TRANSFERENCIA',
    p_reference_number TEXT DEFAULT NULL,
    p_invoice_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_company_id UUID;
    v_user_name VARCHAR(150);
    v_customer RECORD;
    v_bank RECORD;
    v_receipt_id UUID;
    v_receipt_number VARCHAR(50);
    v_mov_id UUID;
    v_mov_number VARCHAR(50);
    v_new_balance NUMERIC(15,2);
BEGIN
    v_user_id := auth.uid();
    v_company_id := public.get_auth_company_id();

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo determinar la empresa del usuario autenticado.'
            USING ERRCODE = '42501';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'El monto del recaudo debe ser estrictamente mayor a 0.'
            USING ERRCODE = '42200';
    END IF;

    -- Validar cliente
    SELECT id, company_id, current_balance, credit_limit
    INTO v_customer
    FROM public.customers
    WHERE id = p_customer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El cliente especificado no existe.' USING ERRCODE = '23503';
    END IF;

    IF v_customer.company_id != v_company_id THEN
        RAISE EXCEPTION 'El cliente pertenece a otra empresa.' USING ERRCODE = '42501';
    END IF;

    -- Bloqueo pesimista de cuenta bancaria
    PERFORM pg_advisory_xact_lock(hashtext('bank_account_' || p_bank_account_id::text));

    SELECT *
    INTO v_bank
    FROM public.bank_accounts
    WHERE id = p_bank_account_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La cuenta bancaria especificada no existe.' USING ERRCODE = '23503';
    END IF;

    IF v_bank.company_id != v_company_id THEN
        RAISE EXCEPTION 'La cuenta bancaria pertenece a otra empresa.' USING ERRCODE = '42501';
    END IF;

    IF v_bank.is_active != true THEN
        RAISE EXCEPTION 'La cuenta bancaria "%" está inactiva.', v_bank.bank_name
            USING ERRCODE = '42200';
    END IF;

    v_new_balance := v_bank.current_balance + p_amount;

    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Usuario Sistema';
    END IF;

    v_receipt_id := gen_random_uuid();
    v_receipt_number := public.fn_next_treasury_consecutive(v_company_id, 'RECEIPT');
    v_mov_id := gen_random_uuid();
    v_mov_number := public.fn_next_treasury_consecutive(v_company_id, 'BANK_MOV');

    -- 1. Actualizar saldo bancario
    UPDATE public.bank_accounts
    SET current_balance = v_new_balance,
        updated_at = NOW()
    WHERE id = p_bank_account_id;

    -- 2. Insertar recibo de caja
    INSERT INTO public.treasury_receipts (
        id,
        company_id,
        location_id,
        receipt_number,
        customer_id,
        invoice_id,
        bank_account_id,
        amount,
        receipt_date,
        payment_method,
        reference_number,
        status,
        notes,
        created_by_user_id,
        created_at,
        updated_at
    ) VALUES (
        v_receipt_id,
        v_company_id,
        v_bank.location_id,
        v_receipt_number,
        p_customer_id,
        p_invoice_id,
        p_bank_account_id,
        p_amount,
        COALESCE(p_receipt_date, CURRENT_DATE),
        COALESCE(p_payment_method, 'TRANSFERENCIA'),
        p_reference_number,
        'COLLECTED',
        p_notes,
        v_user_id,
        NOW(),
        NOW()
    );

    -- 3. Insertar movimiento bancario (CREDIT)
    INSERT INTO public.bank_movements (
        id,
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
        treasury_receipt_id,
        is_reconciled,
        created_by_user_id,
        created_at,
        updated_at
    ) VALUES (
        v_mov_id,
        v_company_id,
        v_bank.location_id,
        p_bank_account_id,
        v_mov_number,
        COALESCE(p_receipt_date, CURRENT_DATE),
        'CREDIT',
        p_amount,
        v_new_balance,
        'Recaudo cliente ' || v_receipt_number,
        p_reference_number,
        v_receipt_id,
        false,
        v_user_id,
        NOW(),
        NOW()
    );

    -- 4. Disminuir saldo pendiente del cliente (CxC)
    UPDATE public.customers
    SET current_balance = GREATEST(0.00, current_balance - p_amount),
        updated_at = NOW()
    WHERE id = p_customer_id;

    -- 5. Auditoría
    INSERT INTO public.audit_logs (
        company_id,
        user_id,
        user_name,
        action,
        module,
        entity_name,
        entity_id,
        location_id,
        new_value,
        created_at
    ) VALUES (
        v_company_id,
        v_user_id,
        v_user_name,
        'TREASURY_RECEIPT_REGISTERED',
        'TREASURY',
        'treasury_receipts',
        v_receipt_id,
        v_bank.location_id,
        jsonb_build_object(
            'receipt_id', v_receipt_id,
            'receipt_number', v_receipt_number,
            'customer_id', p_customer_id,
            'amount', p_amount,
            'bank_account_id', p_bank_account_id,
            'bank_movement_id', v_mov_id,
            'previous_bank_balance', v_bank.current_balance,
            'new_bank_balance', v_new_balance
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'receipt_id', v_receipt_id,
        'receipt_number', v_receipt_number,
        'amount', p_amount,
        'bank_movement_id', v_mov_id,
        'bank_movement_number', v_mov_number,
        'new_bank_balance', v_new_balance,
        'status', 'COLLECTED'
    );
END;
$$;


-- 8. RPC: fn_reconcile_bank_movement (Conciliación bancaria fiduciaria)
CREATE OR REPLACE FUNCTION public.fn_reconcile_bank_movement(
    p_movement_id UUID,
    p_reconciled BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_company_id UUID;
    v_user_name VARCHAR(150);
    v_mov RECORD;
BEGIN
    v_user_id := auth.uid();
    v_company_id := public.get_auth_company_id();

    SELECT *
    INTO v_mov
    FROM public.bank_movements
    WHERE id = p_movement_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El movimiento bancario especificado no existe.' USING ERRCODE = '23503';
    END IF;

    IF v_company_id IS NOT NULL AND v_mov.company_id != v_company_id THEN
        RAISE EXCEPTION 'El movimiento bancario pertenece a otra empresa.' USING ERRCODE = '42501';
    END IF;

    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Usuario Sistema';
    END IF;

    UPDATE public.bank_movements
    SET is_reconciled = p_reconciled,
        reconciled_at = CASE WHEN p_reconciled THEN NOW() ELSE NULL END,
        updated_at = NOW()
    WHERE id = p_movement_id;

    -- Auditoría
    INSERT INTO public.audit_logs (
        company_id,
        user_id,
        user_name,
        action,
        module,
        entity_name,
        entity_id,
        location_id,
        new_value,
        created_at
    ) VALUES (
        v_mov.company_id,
        v_user_id,
        v_user_name,
        'BANK_MOVEMENT_RECONCILED',
        'TREASURY',
        'bank_movements',
        p_movement_id,
        v_mov.location_id,
        jsonb_build_object(
            'movement_id', p_movement_id,
            'movement_number', v_mov.movement_number,
            'is_reconciled', p_reconciled
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'movement_id', p_movement_id,
        'movement_number', v_mov.movement_number,
        'is_reconciled', p_reconciled
    );
END;
$$;
