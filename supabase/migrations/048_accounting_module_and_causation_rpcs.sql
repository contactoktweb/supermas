-- ==============================================================================
-- 048_ACCOUNTING_MODULE_AND_CAUSATION_RPCS.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Módulo Integral de Contabilidad: Partida Doble, Asientos Atómicos,
-- Causación Automática (Ventas, Compras, Pagos, Recaudos) y Reportes Fiduciarios
-- ==============================================================================

-- 1. Aislamiento Multiempresa Estricto en accounting_entries
ALTER TABLE public.accounting_entries DROP CONSTRAINT IF EXISTS accounting_entries_entry_number_key;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'accounting_entries_company_entry_number_key'
    ) THEN
        ALTER TABLE public.accounting_entries
            ADD CONSTRAINT accounting_entries_company_entry_number_key UNIQUE (company_id, entry_number);
    END IF;
END $$;

-- 2. Actualización de triggers de inmutabilidad para permitir limpieza segura de pruebas
CREATE OR REPLACE FUNCTION public.fn_prevent_posted_accounting_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('app.is_test_cleanup', true) = 'true' THEN
        RETURN OLD;
    END IF;

    IF OLD.status = 'POSTED' THEN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'Contabilidad inmutable: No está permitido eliminar un comprobante contable en estado POSTED (Asiento: %). Debe anularse mediante reversión formal.', OLD.entry_number
                USING ERRCODE = '23506';
        ELSIF TG_OP = 'UPDATE' AND (NEW.status <> 'REVERSED' OR OLD.date <> NEW.date OR OLD.concept <> NEW.concept) THEN
            RAISE EXCEPTION 'Contabilidad inmutable: No está permitido modificar un comprobante contable en estado POSTED (Asiento: %).', OLD.entry_number
                USING ERRCODE = '23506';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.fn_prevent_posted_entry_lines_mutation()
RETURNS TRIGGER AS $$
DECLARE
    parent_status accounting_entry_status;
BEGIN
    IF current_setting('app.is_test_cleanup', true) = 'true' THEN
        RETURN OLD;
    END IF;

    SELECT status INTO parent_status FROM public.accounting_entries WHERE id = OLD.entry_id;
    IF parent_status = 'POSTED' THEN
        RAISE EXCEPTION 'Contabilidad inmutable: No está permitido alterar líneas de un comprobante contable en estado POSTED.'
            USING ERRCODE = '23506';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 3. Generador de Consecutivos Contables Fiduciarios por Empresa
CREATE OR REPLACE FUNCTION public.fn_next_accounting_consecutive(
    p_company_id UUID,
    p_doc_type VARCHAR DEFAULT 'AST'
)
RETURNS VARCHAR AS $$
DECLARE
    v_year VARCHAR(4);
    v_prefix VARCHAR(60);
    v_next_val BIGINT;
    v_clean_type VARCHAR(10);
BEGIN
    v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
    v_clean_type := CASE 
        WHEN UPPER(p_doc_type) = 'SUPPLIER_PAYMENT' THEN 'PAG'
        WHEN UPPER(p_doc_type) = 'CUSTOMER_PAYMENT' THEN 'REC'
        WHEN UPPER(p_doc_type) = 'SALE' THEN 'VTA'
        WHEN UPPER(p_doc_type) = 'PURCHASE' THEN 'COM'
        WHEN UPPER(p_doc_type) = 'REVERSAL' THEN 'REV'
        WHEN LENGTH(p_doc_type) > 6 THEN SUBSTRING(UPPER(p_doc_type) FROM 1 FOR 6)
        ELSE UPPER(p_doc_type)
    END;
    v_prefix := v_clean_type || '-' || v_year || '-';

    -- Obtener el consecutivo más alto para este prefijo y empresa
    SELECT COALESCE(MAX(
        CASE 
            WHEN entry_number ~ ('^' || v_prefix || '[0-9]+$') 
            THEN SUBSTRING(entry_number FROM LENGTH(v_prefix) + 1)::BIGINT
            ELSE 0 
        END
    ), 0) + 1
    INTO v_next_val
    FROM public.accounting_entries
    WHERE company_id = p_company_id AND entry_number LIKE (v_prefix || '%');

    RETURN v_prefix || LPAD(v_next_val::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Creación Atómica de Asiento Contable con Partida Doble (fn_create_accounting_entry)
CREATE OR REPLACE FUNCTION public.fn_create_accounting_entry(
    p_date DATE,
    p_concept TEXT,
    p_document_type VARCHAR,
    p_document_reference VARCHAR,
    p_lines JSONB,
    p_location_id UUID DEFAULT NULL,
    p_auto_post BOOLEAN DEFAULT TRUE,
    p_company_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_company_id UUID;
    v_user_id UUID;
    v_user_name VARCHAR(150);
    v_entry_id UUID;
    v_entry_number VARCHAR(50);
    v_line RECORD;
    v_account_id UUID;
    v_account_code VARCHAR(20);
    v_debit_sum NUMERIC(15,2) := 0.00;
    v_credit_sum NUMERIC(15,2) := 0.00;
    v_line_debit NUMERIC(15,2);
    v_line_credit NUMERIC(15,2);
    v_period_code VARCHAR(7);
    v_period_status VARCHAR(20);
BEGIN
    -- 1. Determinar Empresa
    v_company_id := COALESCE(p_company_id, public.get_auth_company_id());
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Contexto multiempresa no detectado para registrar el asiento contable.';
    END IF;

    -- 2. Determinar Usuario
    v_user_id := auth.uid();
    SELECT COALESCE(full_name, email, 'Sistema') INTO v_user_name
    FROM public.users WHERE id = v_user_id;
    IF v_user_name IS NULL THEN v_user_name := 'Sistema ERP'; END IF;

    -- 3. Validar Periodo Contable
    v_period_code := TO_CHAR(p_date, 'YYYY-MM');
    SELECT status INTO v_period_status
    FROM public.accounting_periods
    WHERE company_id = v_company_id AND period_code = v_period_code;

    IF v_period_status = 'CLOSED' THEN
        RAISE EXCEPTION 'El periodo contable % se encuentra CERRADO. No es posible asentar comprobantes en meses clausurados.', v_period_code;
    END IF;

    -- 4. Validar Líneas de Partida Doble
    IF p_lines IS NULL OR jsonb_array_length(p_lines) < 2 THEN
        RAISE EXCEPTION 'Un asiento contable requiere al menos 2 líneas para cumplir el principio de partida doble.';
    END IF;

    FOR v_line IN SELECT * FROM jsonb_to_recordset(p_lines) AS x(
        account_id UUID,
        account_code VARCHAR,
        debit_amount NUMERIC,
        credit_amount NUMERIC,
        third_party_doc VARCHAR,
        third_party_name VARCHAR,
        cost_center_id UUID,
        description TEXT
    ) LOOP
        v_line_debit := COALESCE(v_line.debit_amount, 0.00);
        v_line_credit := COALESCE(v_line.credit_amount, 0.00);

        IF v_line_debit < 0 OR v_line_credit < 0 THEN
            RAISE EXCEPTION 'Los valores de débito y crédito deben ser positivos o cero.';
        END IF;

        IF v_line_debit = 0 AND v_line_credit = 0 THEN
            RAISE EXCEPTION 'Cada línea contable debe tener un valor mayor a cero en Débito o Crédito.';
        END IF;

        v_debit_sum := v_debit_sum + v_line_debit;
        v_credit_sum := v_credit_sum + v_line_credit;
    END LOOP;

    IF ROUND(ABS(v_debit_sum - v_credit_sum), 2) > 0.01 THEN
        RAISE EXCEPTION 'Partida doble descuadrada: Total Débitos ($%) no es igual a Total Créditos ($%).',
            v_debit_sum, v_credit_sum;
    END IF;

    -- 5. Generar Consecutivo
    v_entry_number := public.fn_next_accounting_consecutive(v_company_id, COALESCE(p_document_type, 'AST'));
    v_entry_id := gen_random_uuid();

    -- 6. Insertar Cabecera de Comprobante en DRAFT
    INSERT INTO public.accounting_entries (
        id,
        company_id,
        location_id,
        entry_number,
        date,
        concept,
        document_type,
        document_reference,
        status,
        created_by_user_id,
        created_at,
        updated_at
    ) VALUES (
        v_entry_id,
        v_company_id,
        p_location_id,
        v_entry_number,
        p_date,
        p_concept,
        p_document_type,
        p_document_reference,
        'DRAFT',
        v_user_id,
        NOW(),
        NOW()
    );

    -- 7. Insertar Líneas del Comprobante
    FOR v_line IN SELECT * FROM jsonb_to_recordset(p_lines) AS x(
        account_id UUID,
        account_code VARCHAR,
        debit_amount NUMERIC,
        credit_amount NUMERIC,
        third_party_doc VARCHAR,
        third_party_name VARCHAR,
        cost_center_id UUID,
        description TEXT
    ) LOOP
        -- Resolver ID de la cuenta contable
        v_account_id := v_line.account_id;
        IF v_account_id IS NULL AND v_line.account_code IS NOT NULL THEN
            SELECT id INTO v_account_id
            FROM public.accounting_accounts
            WHERE code = v_line.account_code AND is_active = true
            LIMIT 1;

            -- Si no coincide exactamente, buscar cuenta padre más cercana
            IF v_account_id IS NULL THEN
                SELECT id INTO v_account_id
                FROM public.accounting_accounts
                WHERE code LIKE (SUBSTRING(v_line.account_code FROM 1 FOR 4) || '%') AND is_active = true
                ORDER BY code ASC
                LIMIT 1;
            END IF;
        END IF;

        IF v_account_id IS NULL THEN
            RAISE EXCEPTION 'Cuenta contable con código "%" o ID no encontrada en el catálogo PUC.',
                COALESCE(v_line.account_code, v_line.account_id::TEXT);
        END IF;

        INSERT INTO public.accounting_entry_lines (
            id,
            entry_id,
            account_id,
            third_party_doc,
            third_party_name,
            cost_center_id,
            description,
            debit_amount,
            credit_amount,
            created_at
        ) VALUES (
            gen_random_uuid(),
            v_entry_id,
            v_account_id,
            v_line.third_party_doc,
            v_line.third_party_name,
            v_line.cost_center_id,
            COALESCE(v_line.description, p_concept),
            COALESCE(v_line.debit_amount, 0.00),
            COALESCE(v_line.credit_amount, 0.00),
            NOW()
        );
    END LOOP;

    -- 8. Publicar (POSTED) si aplica
    IF p_auto_post THEN
        UPDATE public.accounting_entries
        SET status = 'POSTED',
            posted_at = NOW(),
            updated_at = NOW()
        WHERE id = v_entry_id;
    END IF;

    -- 9. Auditoría
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
        'ACCOUNTING_ENTRY_CREATED',
        'ACCOUNTING',
        'accounting_entries',
        v_entry_id,
        p_location_id,
        jsonb_build_object(
            'entry_id', v_entry_id,
            'entry_number', v_entry_number,
            'date', p_date,
            'concept', p_concept,
            'document_type', p_document_type,
            'total_debit', v_debit_sum,
            'total_credit', v_credit_sum,
            'status', CASE WHEN p_auto_post THEN 'POSTED' ELSE 'DRAFT' END
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'entry_id', v_entry_id,
        'entry_number', v_entry_number,
        'status', CASE WHEN p_auto_post THEN 'POSTED' ELSE 'DRAFT' END,
        'total_debit', v_debit_sum,
        'total_credit', v_credit_sum,
        'date', p_date
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Reversión Contable Formal (fn_reverse_accounting_entry)
CREATE OR REPLACE FUNCTION public.fn_reverse_accounting_entry(
    p_entry_id UUID,
    p_reason TEXT,
    p_company_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_company_id UUID;
    v_user_id UUID;
    v_user_name VARCHAR(150);
    v_orig RECORD;
    v_reversal_id UUID;
    v_reversal_number VARCHAR(50);
    v_line RECORD;
    v_total_amount NUMERIC(15,2) := 0.00;
BEGIN
    v_company_id := COALESCE(p_company_id, public.get_auth_company_id());
    v_user_id := auth.uid();
    SELECT COALESCE(full_name, email, 'Sistema') INTO v_user_name
    FROM public.users WHERE id = v_user_id;
    IF v_user_name IS NULL THEN v_user_name := 'Sistema ERP'; END IF;

    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RAISE EXCEPTION 'Debe proporcionar una justificación obligatoria para la reversión contable.';
    END IF;

    SELECT * INTO v_orig
    FROM public.accounting_entries
    WHERE id = p_entry_id AND (v_company_id IS NULL OR company_id = v_company_id)
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Comprobante contable no encontrado o no pertenece a la empresa.';
    END IF;

    IF v_orig.status <> 'POSTED' THEN
        RAISE EXCEPTION 'Solo es posible anular/revertir comprobantes en estado POSTED (Estado actual: %).', v_orig.status;
    END IF;

    v_reversal_number := public.fn_next_accounting_consecutive(v_orig.company_id, 'REV');
    v_reversal_id := gen_random_uuid();

    -- Crear comprobante de reversión en DRAFT
    INSERT INTO public.accounting_entries (
        id,
        company_id,
        location_id,
        entry_number,
        date,
        concept,
        document_type,
        document_reference,
        status,
        created_by_user_id,
        created_at,
        updated_at
    ) VALUES (
        v_reversal_id,
        v_orig.company_id,
        v_orig.location_id,
        v_reversal_number,
        CURRENT_DATE,
        'Reversión de ' || v_orig.entry_number || ': ' || p_reason,
        'REVERSAL',
        v_orig.entry_number,
        'DRAFT',
        v_user_id,
        NOW(),
        NOW()
    );

    -- Invertir líneas: Débito pasa a Crédito, Crédito pasa a Débito
    FOR v_line IN 
        SELECT * FROM public.accounting_entry_lines 
        WHERE entry_id = p_entry_id 
    LOOP
        INSERT INTO public.accounting_entry_lines (
            id,
            entry_id,
            account_id,
            third_party_doc,
            third_party_name,
            cost_center_id,
            description,
            debit_amount,
            credit_amount,
            created_at
        ) VALUES (
            gen_random_uuid(),
            v_reversal_id,
            v_line.account_id,
            v_line.third_party_doc,
            v_line.third_party_name,
            v_line.cost_center_id,
            'Reversión ' || v_orig.entry_number || ': ' || COALESCE(v_line.description, ''),
            v_line.credit_amount, -- Se invierte
            v_line.debit_amount,  -- Se invierte
            NOW()
        );
        v_total_amount := v_total_amount + v_line.debit_amount;
    END LOOP;

    -- Publicar comprobante de reversión
    UPDATE public.accounting_entries
    SET status = 'POSTED',
        posted_at = NOW(),
        updated_at = NOW()
    WHERE id = v_reversal_id;

    -- Marcar comprobante original como REVERSED
    UPDATE public.accounting_entries
    SET status = 'REVERSED',
        updated_at = NOW()
    WHERE id = p_entry_id;

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
        v_orig.company_id,
        v_user_id,
        v_user_name,
        'ACCOUNTING_ENTRY_REVERSED',
        'ACCOUNTING',
        'accounting_entries',
        p_entry_id,
        v_orig.location_id,
        jsonb_build_object(
            'original_entry_id', p_entry_id,
            'original_entry_number', v_orig.entry_number,
            'reversal_entry_id', v_reversal_id,
            'reversal_entry_number', v_reversal_number,
            'reason', p_reason
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'original_entry_id', p_entry_id,
        'original_entry_number', v_orig.entry_number,
        'reversal_entry_id', v_reversal_id,
        'reversal_entry_number', v_reversal_number
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Causación Automática de Ventas (fn_cause_sale_accounting)
CREATE OR REPLACE FUNCTION public.fn_cause_sale_accounting(p_sale_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_sale RECORD;
    v_customer RECORD;
    v_lines JSONB := '[]'::JSONB;
    v_cost_total NUMERIC(15,2) := 0.00;
    v_item RECORD;
    v_payment_account_code VARCHAR(20);
    v_customer_doc VARCHAR(30);
    v_customer_name VARCHAR(150);
BEGIN
    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Venta % no encontrada para causación contable.', p_sale_id;
    END IF;

    -- Obtener cliente
    SELECT document_number, COALESCE(company_name, first_name || ' ' || COALESCE(last_name, '')) INTO v_customer_doc, v_customer_name
    FROM public.customers WHERE id = v_sale.customer_id;

    -- Cuenta de contrapartida según forma de pago
    IF v_sale.payment_method::TEXT IN ('CASH', 'EFECTIVO') THEN
        v_payment_account_code := '1105'; -- Caja General
    ELSIF v_sale.payment_method::TEXT IN ('CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'TRANSFERENCIA') THEN
        v_payment_account_code := '1110'; -- Bancos
    ELSE
        v_payment_account_code := '1305'; -- Clientes Nacionales (Cartera)
    END IF;

    -- 1. Línea Débito: Caja / Bancos / Clientes por Total
    v_lines := v_lines || jsonb_build_object(
        'account_code', v_payment_account_code,
        'debit_amount', v_sale.total_amount,
        'credit_amount', 0.00,
        'third_party_doc', v_customer_doc,
        'third_party_name', v_customer_name,
        'description', 'Cobro / Cartera Venta ' || v_sale.sale_number
    );

    -- 2. Línea Crédito: Comercio al por mayor y al por menor (4135) por Subtotal
    v_lines := v_lines || jsonb_build_object(
        'account_code', '4135',
        'debit_amount', 0.00,
        'credit_amount', v_sale.subtotal_amount,
        'third_party_doc', v_customer_doc,
        'third_party_name', v_customer_name,
        'description', 'Ingreso operacional Venta ' || v_sale.sale_number
    );

    -- 3. Línea Crédito: IVA Generado (2408) si aplica
    IF COALESCE(v_sale.tax_amount, 0.00) > 0 THEN
        v_lines := v_lines || jsonb_build_object(
            'account_code', '2408',
            'debit_amount', 0.00,
            'credit_amount', v_sale.tax_amount,
            'third_party_doc', v_customer_doc,
            'third_party_name', v_customer_name,
            'description', 'IVA generado Venta ' || v_sale.sale_number
        );
    END IF;

    -- 4. Costo de Ventas (si hay items con costo registrado)
    SELECT COALESCE(SUM(quantity * unit_cost), 0.00) INTO v_cost_total
    FROM public.sale_items WHERE sale_id = p_sale_id;

    IF v_cost_total > 0 THEN
        -- Débito: Costo de Ventas (6135)
        v_lines := v_lines || jsonb_build_object(
            'account_code', '6135',
            'debit_amount', v_cost_total,
            'credit_amount', 0.00,
            'description', 'Costo de ventas mercancías Venta ' || v_sale.sale_number
        );
        -- Crédito: Mercancías no fabricadas (1435)
        v_lines := v_lines || jsonb_build_object(
            'account_code', '1435',
            'debit_amount', 0.00,
            'credit_amount', v_cost_total,
            'description', 'Salida de inventario por venta ' || v_sale.sale_number
        );
    END IF;

    -- Asentar mediante la función central
    RETURN public.fn_create_accounting_entry(
        p_date := COALESCE(v_sale.created_at::DATE, CURRENT_DATE),
        p_concept := 'Causación automática Venta ' || v_sale.sale_number || ' - ' || COALESCE(v_customer_name, 'Consumidor Final'),
        p_document_type := 'SALE',
        p_document_reference := v_sale.sale_number,
        p_lines := v_lines,
        p_location_id := v_sale.location_id,
        p_auto_post := true,
        p_company_id := v_sale.company_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Causación Automática de Compras (fn_cause_purchase_accounting)
CREATE OR REPLACE FUNCTION public.fn_cause_purchase_accounting(p_purchase_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_pur RECORD;
    v_supp RECORD;
    v_lines JSONB := '[]'::JSONB;
BEGIN
    SELECT * INTO v_pur FROM public.purchases WHERE id = p_purchase_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Compra % no encontrada para causación contable.', p_purchase_id;
    END IF;

    SELECT tax_id, name INTO v_supp FROM public.suppliers WHERE id = v_pur.supplier_id;

    -- 1. Línea Débito: Mercancías no fabricadas por la empresa (1435) por Subtotal
    v_lines := v_lines || jsonb_build_object(
        'account_code', '1435',
        'debit_amount', v_pur.subtotal_amount,
        'credit_amount', 0.00,
        'third_party_doc', v_supp.tax_id,
        'third_party_name', v_supp.name,
        'description', 'Entrada de mercancías Compra ' || v_pur.purchase_number
    );

    -- 2. Línea Débito: IVA Descontable (2408) si aplica
    IF COALESCE(v_pur.tax_amount, 0.00) > 0 THEN
        v_lines := v_lines || jsonb_build_object(
            'account_code', '2408',
            'debit_amount', v_pur.tax_amount,
            'credit_amount', 0.00,
            'third_party_doc', v_supp.tax_id,
            'third_party_name', v_supp.name,
            'description', 'IVA descontable Compra ' || v_pur.purchase_number
        );
    END IF;

    -- 3. Línea Crédito: Proveedores Nacionales (2205) por Total
    v_lines := v_lines || jsonb_build_object(
        'account_code', '2205',
        'debit_amount', 0.00,
        'credit_amount', v_pur.total_amount,
        'third_party_doc', v_supp.tax_id,
        'third_party_name', v_supp.name,
        'description', 'Obligación CxP Proveedor ' || v_supp.name || ' Factura: ' || COALESCE(v_pur.supplier_invoice_number, v_pur.purchase_number)
    );

    RETURN public.fn_create_accounting_entry(
        p_date := v_pur.issue_date,
        p_concept := 'Causación Compra ' || v_pur.purchase_number || ' - ' || v_supp.name,
        p_document_type := 'PURCHASE',
        p_document_reference := v_pur.purchase_number,
        p_lines := v_lines,
        p_location_id := v_pur.location_id,
        p_auto_post := true,
        p_company_id := v_pur.company_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Causación Automática de Desembolso / Pago en Tesorería (fn_cause_payment_accounting)
CREATE OR REPLACE FUNCTION public.fn_cause_payment_accounting(p_payment_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_pay RECORD;
    v_supp RECORD;
    v_lines JSONB := '[]'::JSONB;
    v_res JSONB;
BEGIN
    SELECT * INTO v_pay FROM public.treasury_payments WHERE id = p_payment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pago de tesorería % no encontrado para causación.', p_payment_id;
    END IF;

    SELECT tax_id, name INTO v_supp FROM public.suppliers WHERE id = v_pay.supplier_id;

    -- Débito: Proveedores Nacionales (2205) - Disminuye Pasivo
    v_lines := v_lines || jsonb_build_object(
        'account_code', '2205',
        'debit_amount', v_pay.amount,
        'credit_amount', 0.00,
        'third_party_doc', v_supp.tax_id,
        'third_party_name', v_supp.name,
        'description', 'Cancelación / Abono a Proveedor ' || v_supp.name || ' Comprobante: ' || v_pay.payment_number
    );

    -- Crédito: Bancos Nacionales (1110) - Disminuye Activo
    v_lines := v_lines || jsonb_build_object(
        'account_code', '1110',
        'debit_amount', 0.00,
        'credit_amount', v_pay.amount,
        'third_party_doc', v_supp.tax_id,
        'third_party_name', v_supp.name,
        'description', 'Egreso bancario pago ' || v_pay.payment_number || ' Ref: ' || COALESCE(v_pay.reference_number, '—')
    );

    v_res := public.fn_create_accounting_entry(
        p_date := v_pay.payment_date,
        p_concept := 'Pago a Proveedor ' || v_supp.name || ' (Ref: ' || COALESCE(v_pay.reference_number, v_pay.payment_number) || ')',
        p_document_type := 'SUPPLIER_PAYMENT',
        p_document_reference := v_pay.payment_number,
        p_lines := v_lines,
        p_location_id := v_pay.location_id,
        p_auto_post := true,
        p_company_id := v_pay.company_id
    );

    -- Vincular asiento a la orden de pago
    UPDATE public.treasury_payments
    SET accounting_entry_id = (v_res->>'entry_id')::UUID
    WHERE id = p_payment_id;

    RETURN v_res;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Causación Automática de Recaudo en Tesorería (fn_cause_receipt_accounting)
CREATE OR REPLACE FUNCTION public.fn_cause_receipt_accounting(p_receipt_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_rec RECORD;
    v_cust_doc VARCHAR(30);
    v_cust_name VARCHAR(150);
    v_lines JSONB := '[]'::JSONB;
    v_res JSONB;
BEGIN
    SELECT * INTO v_rec FROM public.treasury_receipts WHERE id = p_receipt_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Recaudo de tesorería % no encontrado para causación.', p_receipt_id;
    END IF;

    SELECT document_number, COALESCE(company_name, first_name || ' ' || COALESCE(last_name, ''))
    INTO v_cust_doc, v_cust_name
    FROM public.customers WHERE id = v_rec.customer_id;

    -- Débito: Bancos Nacionales (1110) - Aumenta Activo
    v_lines := v_lines || jsonb_build_object(
        'account_code', '1110',
        'debit_amount', v_rec.amount,
        'credit_amount', 0.00,
        'third_party_doc', v_cust_doc,
        'third_party_name', v_cust_name,
        'description', 'Ingreso bancario recaudo ' || v_rec.receipt_number || ' Ref: ' || COALESCE(v_rec.reference_number, '—')
    );

    -- Crédito: Clientes Nacionales (1305) - Disminuye Cartera
    v_lines := v_lines || jsonb_build_object(
        'account_code', '1305',
        'debit_amount', 0.00,
        'credit_amount', v_rec.amount,
        'third_party_doc', v_cust_doc,
        'third_party_name', v_cust_name,
        'description', 'Abono a cartera de cliente ' || COALESCE(v_cust_name, '') || ' Recibo: ' || v_rec.receipt_number
    );

    v_res := public.fn_create_accounting_entry(
        p_date := v_rec.receipt_date,
        p_concept := 'Recaudo de Cartera ' || COALESCE(v_cust_name, 'Cliente') || ' (Ref: ' || COALESCE(v_rec.reference_number, v_rec.receipt_number) || ')',
        p_document_type := 'CUSTOMER_PAYMENT',
        p_document_reference := v_rec.receipt_number,
        p_lines := v_lines,
        p_location_id := v_rec.location_id,
        p_auto_post := true,
        p_company_id := v_rec.company_id
    );

    UPDATE public.treasury_receipts
    SET accounting_entry_id = (v_res->>'entry_id')::UUID
    WHERE id = p_receipt_id;

    RETURN v_res;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
