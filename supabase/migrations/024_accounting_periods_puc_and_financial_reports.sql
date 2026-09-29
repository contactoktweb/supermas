-- ==============================================================================
-- 024_ACCOUNTING_PERIODS_PUC_AND_FINANCIAL_REPORTS.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Hardening Módulo Contable: Centros de Costo Multiempresa, RLS PUC,
-- Periodos Contables Aislados, Cierre/Reapertura y Motor de Reportes Financieros
-- ==============================================================================

-- 1. Centros de Costo: Aislamiento Multiempresa y RLS
ALTER TABLE public.cost_centers 
    ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT;

-- Ajustar unicidad: el código es único por empresa
ALTER TABLE public.cost_centers DROP CONSTRAINT IF EXISTS cost_centers_code_key;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cost_centers_company_code_key'
    ) THEN
        ALTER TABLE public.cost_centers 
            ADD CONSTRAINT cost_centers_company_code_key UNIQUE (company_id, code);
    END IF;
END $$;

ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation cost_centers_select" ON public.cost_centers;
CREATE POLICY "Tenant isolation cost_centers_select" ON public.cost_centers
    FOR SELECT TO authenticated
    USING (
        company_id = public.get_auth_company_id() OR public.is_admin()
    );

DROP POLICY IF EXISTS "Tenant isolation cost_centers_manage" ON public.cost_centers;
CREATE POLICY "Tenant isolation cost_centers_manage" ON public.cost_centers
    FOR ALL TO authenticated
    USING (
        (company_id = public.get_auth_company_id() AND (public.is_admin() OR public.get_auth_role() = 'ACCOUNTANT' OR public.has_permission('accounting.manage')))
        OR public.is_admin()
    )
    WITH CHECK (
        (company_id = public.get_auth_company_id() AND (public.is_admin() OR public.get_auth_role() = 'ACCOUNTANT' OR public.has_permission('accounting.manage')))
        OR public.is_admin()
    );

-- 2. Plan Único de Cuentas (PUC): Políticas RLS
ALTER TABLE public.accounting_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated to read accounting_accounts" ON public.accounting_accounts;
CREATE POLICY "Allow authenticated to read accounting_accounts" ON public.accounting_accounts
    FOR SELECT TO authenticated
    USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Allow superadmin or accountant to manage accounting_accounts" ON public.accounting_accounts;
CREATE POLICY "Allow superadmin or accountant to manage accounting_accounts" ON public.accounting_accounts
    FOR ALL TO authenticated
    USING (public.is_admin() OR public.get_auth_role() = 'ACCOUNTANT')
    WITH CHECK (public.is_admin() OR public.get_auth_role() = 'ACCOUNTANT');

-- 3. Periodos Contables: Unicidad Multiempresa y RLS
ALTER TABLE public.accounting_periods DROP CONSTRAINT IF EXISTS accounting_periods_period_code_key;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'accounting_periods_company_period_code_key'
    ) THEN
        ALTER TABLE public.accounting_periods 
            ADD CONSTRAINT accounting_periods_company_period_code_key UNIQUE (company_id, period_code);
    END IF;
END $$;

DROP POLICY IF EXISTS accounting_periods_policy ON public.accounting_periods;
DROP POLICY IF EXISTS "Tenant isolation accounting_periods_select" ON public.accounting_periods;
CREATE POLICY "Tenant isolation accounting_periods_select" ON public.accounting_periods
    FOR SELECT TO authenticated
    USING (
        (company_id = public.get_auth_company_id() AND (public.is_admin() OR public.get_auth_role() = 'ACCOUNTANT' OR public.has_permission('accounting.read')))
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "Tenant isolation accounting_periods_manage" ON public.accounting_periods;
CREATE POLICY "Tenant isolation accounting_periods_manage" ON public.accounting_periods
    FOR ALL TO authenticated
    USING (
        (company_id = public.get_auth_company_id() AND (public.is_admin() OR public.get_auth_role() = 'ACCOUNTANT' OR public.has_permission('accounting.manage')))
        OR public.is_admin()
    )
    WITH CHECK (
        (company_id = public.get_auth_company_id() AND (public.is_admin() OR public.get_auth_role() = 'ACCOUNTANT' OR public.has_permission('accounting.manage')))
        OR public.is_admin()
    );

-- 4. Actualización del Trigger de Periodos Cerrados con Filtro por Empresa
CREATE OR REPLACE FUNCTION public.fn_prevent_entries_on_closed_period()
RETURNS TRIGGER AS $$
DECLARE
    v_period_code VARCHAR(7);
    v_period_status VARCHAR(20);
BEGIN
    v_period_code := TO_CHAR(NEW.date, 'YYYY-MM');

    SELECT status INTO v_period_status
    FROM public.accounting_periods
    WHERE company_id = NEW.company_id AND period_code = v_period_code;

    -- Si el periodo existe y está marcado como CERRADO para esta empresa, bloquear la operación
    IF v_period_status = 'CLOSED' THEN
        RAISE EXCEPTION 'El periodo contable % de la empresa se encuentra CERRADO. Operación rechazada: no es posible crear, modificar ni anular comprobantes en periodos clausurados sin una reapertura autorizada.', v_period_code
            USING ERRCODE = '23506';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Procedimientos de Cierre y Reapertura de Periodos Contables
CREATE OR REPLACE FUNCTION public.fn_close_accounting_period(
    p_company_id UUID,
    p_period_code VARCHAR,
    p_closed_by UUID
)
RETURNS JSONB AS $$
DECLARE
    v_period RECORD;
    v_entries_count INTEGER;
    v_total_debits NUMERIC(15,2);
    v_total_credits NUMERIC(15,2);
    v_drafts_count INTEGER;
    v_user_name VARCHAR(150);
    v_result JSONB;
BEGIN
    SELECT * INTO v_period
    FROM public.accounting_periods
    WHERE company_id = p_company_id AND period_code = p_period_code
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El periodo contable % no existe para la empresa especificada.', p_period_code;
    END IF;

    IF v_period.status = 'CLOSED' THEN
        RAISE EXCEPTION 'El periodo contable % ya se encuentra CERRADO.', p_period_code;
    END IF;

    -- Obtener nombre del usuario para auditoría
    SELECT COALESCE(full_name, email, 'Sistema') INTO v_user_name
    FROM public.users
    WHERE id = p_closed_by;
    IF v_user_name IS NULL THEN
        v_user_name := 'Usuario Autorizado';
    END IF;

    -- Verificar si existen comprobantes en borrador (DRAFT) dentro del rango del periodo
    SELECT COUNT(*) INTO v_drafts_count
    FROM public.accounting_entries
    WHERE company_id = p_company_id
      AND date BETWEEN v_period.start_date AND v_period.end_date
      AND status = 'DRAFT';

    IF v_drafts_count > 0 THEN
        RAISE EXCEPTION 'No es posible cerrar el periodo %: Existen % comprobantes en estado DRAFT (Borrador). Deben ser publicados (POSTED) o anulados antes del cierre.', p_period_code, v_drafts_count;
    END IF;

    -- Calcular totales de comprobantes POSTED
    SELECT 
        COUNT(DISTINCT ae.id),
        COALESCE(SUM(ael.debit_amount), 0.00),
        COALESCE(SUM(ael.credit_amount), 0.00)
    INTO v_entries_count, v_total_debits, v_total_credits
    FROM public.accounting_entries ae
    JOIN public.accounting_entry_lines ael ON ael.entry_id = ae.id
    WHERE ae.company_id = p_company_id
      AND ae.date BETWEEN v_period.start_date AND v_period.end_date
      AND ae.status = 'POSTED';

    IF v_total_debits <> v_total_credits THEN
        RAISE EXCEPTION 'Inconsistencia contable crítica: Total Débitos (%) no coincide con Total Créditos (%) en el periodo %.', v_total_debits, v_total_credits, p_period_code;
    END IF;

    -- Actualizar periodo a CLOSED
    UPDATE public.accounting_periods
    SET status = 'CLOSED',
        closed_at = NOW(),
        closed_by_user_id = p_closed_by,
        entries_count = v_entries_count,
        total_debits = v_total_debits,
        total_credits = v_total_credits,
        updated_at = NOW()
    WHERE id = v_period.id;

    -- Registrar auditoría
    INSERT INTO public.audit_logs (
        id, company_id, user_id, user_name, action, module, entity_name, entity_id,
        previous_value, new_value, created_at
    ) VALUES (
        gen_random_uuid(), p_company_id, p_closed_by, v_user_name, 'CLOSE_ACCOUNTING_PERIOD', 'ACCOUNTING', 'accounting_periods', v_period.id::VARCHAR,
        jsonb_build_object('status', 'OPEN'),
        jsonb_build_object('status', 'CLOSED', 'entries_count', v_entries_count, 'total_debits', v_total_debits, 'total_credits', v_total_credits),
        NOW()
    );

    v_result := jsonb_build_object(
        'period_id', v_period.id,
        'period_code', p_period_code,
        'status', 'CLOSED',
        'entries_count', v_entries_count,
        'total_debits', v_total_debits,
        'total_credits', v_total_credits,
        'closed_at', NOW()
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.fn_reopen_accounting_period(
    p_company_id UUID,
    p_period_code VARCHAR,
    p_reopened_by UUID,
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_period RECORD;
    v_user_name VARCHAR(150);
BEGIN
    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RAISE EXCEPTION 'Debe proporcionar una justificación obligatoria para la reapertura del periodo contable.';
    END IF;

    SELECT * INTO v_period
    FROM public.accounting_periods
    WHERE company_id = p_company_id AND period_code = p_period_code
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El periodo contable % no existe para la empresa especificada.', p_period_code;
    END IF;

    IF v_period.status = 'OPEN' THEN
        RAISE EXCEPTION 'El periodo contable % ya se encuentra ABIERTO.', p_period_code;
    END IF;

    -- Obtener nombre del usuario para auditoría
    SELECT COALESCE(full_name, email, 'Sistema') INTO v_user_name
    FROM public.users
    WHERE id = p_reopened_by;
    IF v_user_name IS NULL THEN
        v_user_name := 'Usuario Autorizado';
    END IF;

    UPDATE public.accounting_periods
    SET status = 'OPEN',
        reopened_at = NOW(),
        reopened_by_user_id = p_reopened_by,
        reopened_reason = p_reason,
        updated_at = NOW()
    WHERE id = v_period.id;

    -- Registrar auditoría
    INSERT INTO public.audit_logs (
        id, company_id, user_id, user_name, action, module, entity_name, entity_id,
        previous_value, new_value, created_at
    ) VALUES (
        gen_random_uuid(), p_company_id, p_reopened_by, v_user_name, 'REOPEN_ACCOUNTING_PERIOD', 'ACCOUNTING', 'accounting_periods', v_period.id::VARCHAR,
        jsonb_build_object('status', 'CLOSED'),
        jsonb_build_object('status', 'OPEN', 'reason', p_reason),
        NOW()
    );

    RETURN jsonb_build_object(
        'period_id', v_period.id,
        'period_code', p_period_code,
        'status', 'OPEN',
        'reopened_at', NOW(),
        'reopened_reason', p_reason
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Motor de Reportes Financieros

-- 6.1 Balance de Comprobación (Trial Balance / Sumas y Saldos)
CREATE OR REPLACE FUNCTION public.fn_financial_trial_balance(
    p_company_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    account_code VARCHAR,
    account_name VARCHAR,
    account_class INTEGER,
    level INTEGER,
    nature VARCHAR,
    total_debit NUMERIC(15,2),
    total_credit NUMERIC(15,2),
    final_balance NUMERIC(15,2)
) AS $$
BEGIN
    RETURN QUERY
    WITH account_sums AS (
        SELECT 
            aa.id AS account_id,
            aa.code,
            aa.name,
            aa.account_class,
            aa.level,
            aa.nature,
            COALESCE(SUM(ael.debit_amount), 0.00) AS sum_debit,
            COALESCE(SUM(ael.credit_amount), 0.00) AS sum_credit
        FROM public.accounting_accounts aa
        LEFT JOIN public.accounting_entry_lines ael ON ael.account_id = aa.id
        LEFT JOIN public.accounting_entries ae ON ae.id = ael.entry_id 
             AND ae.company_id = p_company_id 
             AND ae.status = 'POSTED' 
             AND ae.date BETWEEN p_start_date AND p_end_date
        GROUP BY aa.id, aa.code, aa.name, aa.account_class, aa.level, aa.nature
    )
    SELECT 
        s.code::VARCHAR,
        s.name::VARCHAR,
        s.account_class,
        s.level,
        s.nature::VARCHAR,
        ROUND(s.sum_debit, 2) AS total_debit,
        ROUND(s.sum_credit, 2) AS total_credit,
        CASE 
            WHEN s.nature = 'DEBIT' THEN ROUND(s.sum_debit - s.sum_credit, 2)
            ELSE ROUND(s.sum_credit - s.sum_debit, 2)
        END AS final_balance
    FROM account_sums s
    WHERE s.sum_debit > 0 OR s.sum_credit > 0
    ORDER BY s.code;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 6.2 Libro Diario (General Journal)
CREATE OR REPLACE FUNCTION public.fn_financial_daily_journal(
    p_company_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    entry_id UUID,
    consecutive BIGINT,
    entry_number VARCHAR,
    entry_date DATE,
    document_type VARCHAR,
    document_reference VARCHAR,
    concept TEXT,
    account_code VARCHAR,
    account_name VARCHAR,
    third_party_doc VARCHAR,
    third_party_name VARCHAR,
    cost_center_code VARCHAR,
    debit_amount NUMERIC(15,2),
    credit_amount NUMERIC(15,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ae.id AS entry_id,
        ae.consecutive,
        ae.entry_number,
        ae.date AS entry_date,
        ae.document_type,
        ae.document_reference,
        ae.concept,
        aa.code AS account_code,
        aa.name AS account_name,
        ael.third_party_doc,
        ael.third_party_name,
        cc.code AS cost_center_code,
        ael.debit_amount,
        ael.credit_amount
    FROM public.accounting_entries ae
    JOIN public.accounting_entry_lines ael ON ael.entry_id = ae.id
    JOIN public.accounting_accounts aa ON aa.id = ael.account_id
    LEFT JOIN public.cost_centers cc ON cc.id = ael.cost_center_id
    WHERE ae.company_id = p_company_id
      AND ae.status = 'POSTED'
      AND ae.date BETWEEN p_start_date AND p_end_date
    ORDER BY ae.date ASC, ae.consecutive ASC, ael.created_at ASC, ael.id ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 6.3 Libro Mayor (General Ledger)
CREATE OR REPLACE FUNCTION public.fn_financial_general_ledger(
    p_company_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_account_code VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    account_code VARCHAR,
    account_name VARCHAR,
    nature VARCHAR,
    entry_date DATE,
    entry_number VARCHAR,
    concept TEXT,
    third_party_name VARCHAR,
    debit_amount NUMERIC(15,2),
    credit_amount NUMERIC(15,2),
    running_balance NUMERIC(15,2)
) AS $$
BEGIN
    RETURN QUERY
    WITH ledger_base AS (
        SELECT 
            aa.code AS acc_code,
            aa.name AS acc_name,
            aa.nature AS acc_nature,
            ae.date AS e_date,
            ae.entry_number AS e_num,
            ae.concept AS e_concept,
            ael.third_party_name AS tp_name,
            ael.debit_amount AS d_amount,
            ael.credit_amount AS c_amount,
            ae.consecutive,
            ael.id AS line_id
        FROM public.accounting_entry_lines ael
        JOIN public.accounting_entries ae ON ae.id = ael.entry_id
        JOIN public.accounting_accounts aa ON aa.id = ael.account_id
        WHERE ae.company_id = p_company_id
          AND ae.status = 'POSTED'
          AND ae.date BETWEEN p_start_date AND p_end_date
          AND (p_account_code IS NULL OR aa.code LIKE p_account_code || '%')
    )
    SELECT 
        lb.acc_code::VARCHAR,
        lb.acc_name::VARCHAR,
        lb.acc_nature::VARCHAR,
        lb.e_date,
        lb.e_num::VARCHAR,
        lb.e_concept,
        lb.tp_name::VARCHAR,
        lb.d_amount,
        lb.c_amount,
        SUM(
            CASE 
                WHEN lb.acc_nature = 'DEBIT' THEN (lb.d_amount - lb.c_amount)
                ELSE (lb.c_amount - lb.d_amount)
            END
        ) OVER (
            PARTITION BY lb.acc_code 
            ORDER BY lb.e_date ASC, lb.consecutive ASC, lb.line_id ASC
        ) AS running_balance
    FROM ledger_base lb
    ORDER BY lb.acc_code ASC, lb.e_date ASC, lb.consecutive ASC, lb.line_id ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 6.4 Estado de Resultados (Income Statement / Pérdidas y Ganancias)
CREATE OR REPLACE FUNCTION public.fn_financial_income_statement(
    p_company_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS JSONB AS $$
DECLARE
    v_total_ingresos NUMERIC(15,2) := 0.00;
    v_total_costos NUMERIC(15,2) := 0.00;
    v_total_gastos NUMERIC(15,2) := 0.00;
    v_utilidad_bruta NUMERIC(15,2) := 0.00;
    v_utilidad_operativa NUMERIC(15,2) := 0.00;
BEGIN
    -- Ingresos Operacionales (Clase 4: Crédito - Débito)
    SELECT COALESCE(SUM(ael.credit_amount - ael.debit_amount), 0.00)
    INTO v_total_ingresos
    FROM public.accounting_entry_lines ael
    JOIN public.accounting_entries ae ON ae.id = ael.entry_id
    JOIN public.accounting_accounts aa ON aa.id = ael.account_id
    WHERE ae.company_id = p_company_id
      AND ae.status = 'POSTED'
      AND ae.date BETWEEN p_start_date AND p_end_date
      AND aa.account_class = 4;

    -- Costos de Ventas y Producción (Clases 6 y 7: Débito - Crédito)
    SELECT COALESCE(SUM(ael.debit_amount - ael.credit_amount), 0.00)
    INTO v_total_costos
    FROM public.accounting_entry_lines ael
    JOIN public.accounting_entries ae ON ae.id = ael.entry_id
    JOIN public.accounting_accounts aa ON aa.id = ael.account_id
    WHERE ae.company_id = p_company_id
      AND ae.status = 'POSTED'
      AND ae.date BETWEEN p_start_date AND p_end_date
      AND aa.account_class IN (6, 7);

    -- Gastos Operacionales y Administrativos (Clase 5: Débito - Crédito)
    SELECT COALESCE(SUM(ael.debit_amount - ael.credit_amount), 0.00)
    INTO v_total_gastos
    FROM public.accounting_entry_lines ael
    JOIN public.accounting_entries ae ON ae.id = ael.entry_id
    JOIN public.accounting_accounts aa ON aa.id = ael.account_id
    WHERE ae.company_id = p_company_id
      AND ae.status = 'POSTED'
      AND ae.date BETWEEN p_start_date AND p_end_date
      AND aa.account_class = 5;

    v_utilidad_bruta := v_total_ingresos - v_total_costos;
    v_utilidad_operativa := v_utilidad_bruta - v_total_gastos;

    RETURN jsonb_build_object(
        'start_date', p_start_date,
        'end_date', p_end_date,
        'total_ingresos', v_total_ingresos,
        'total_costos', v_total_costos,
        'utilidad_bruta', v_utilidad_bruta,
        'total_gastos', v_total_gastos,
        'utilidad_operativa', v_utilidad_operativa
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 6.5 Balance General (Balance Sheet / Ecuación Patrimonial)
CREATE OR REPLACE FUNCTION public.fn_financial_balance_sheet(
    p_company_id UUID,
    p_as_of_date DATE
)
RETURNS JSONB AS $$
DECLARE
    v_total_activos NUMERIC(15,2) := 0.00;
    v_total_pasivos NUMERIC(15,2) := 0.00;
    v_patrimonio_base NUMERIC(15,2) := 0.00;
    v_resultado_ejercicio NUMERIC(15,2) := 0.00;
    v_total_patrimonio NUMERIC(15,2) := 0.00;
    v_pasivo_mas_patrimonio NUMERIC(15,2) := 0.00;
    v_diferencia NUMERIC(15,2) := 0.00;
BEGIN
    -- Activos (Clase 1: Débito - Crédito)
    SELECT COALESCE(SUM(ael.debit_amount - ael.credit_amount), 0.00)
    INTO v_total_activos
    FROM public.accounting_entry_lines ael
    JOIN public.accounting_entries ae ON ae.id = ael.entry_id
    JOIN public.accounting_accounts aa ON aa.id = ael.account_id
    WHERE ae.company_id = p_company_id
      AND ae.status = 'POSTED'
      AND ae.date <= p_as_of_date
      AND aa.account_class = 1;

    -- Pasivos (Clase 2: Crédito - Débito)
    SELECT COALESCE(SUM(ael.credit_amount - ael.debit_amount), 0.00)
    INTO v_total_pasivos
    FROM public.accounting_entry_lines ael
    JOIN public.accounting_entries ae ON ae.id = ael.entry_id
    JOIN public.accounting_accounts aa ON aa.id = ael.account_id
    WHERE ae.company_id = p_company_id
      AND ae.status = 'POSTED'
      AND ae.date <= p_as_of_date
      AND aa.account_class = 2;

    -- Patrimonio Base (Clase 3: Crédito - Débito)
    SELECT COALESCE(SUM(ael.credit_amount - ael.debit_amount), 0.00)
    INTO v_patrimonio_base
    FROM public.accounting_entry_lines ael
    JOIN public.accounting_entries ae ON ae.id = ael.entry_id
    JOIN public.accounting_accounts aa ON aa.id = ael.account_id
    WHERE ae.company_id = p_company_id
      AND ae.status = 'POSTED'
      AND ae.date <= p_as_of_date
      AND aa.account_class = 3;

    -- Resultado del Ejercicio acumulado (Ingresos - Gastos - Costos)
    SELECT COALESCE(
        SUM(
            CASE 
                WHEN aa.account_class = 4 THEN (ael.credit_amount - ael.debit_amount)
                WHEN aa.account_class IN (5, 6, 7) THEN -(ael.debit_amount - ael.credit_amount)
                ELSE 0
            END
        ), 0.00
    )
    INTO v_resultado_ejercicio
    FROM public.accounting_entry_lines ael
    JOIN public.accounting_entries ae ON ae.id = ael.entry_id
    JOIN public.accounting_accounts aa ON aa.id = ael.account_id
    WHERE ae.company_id = p_company_id
      AND ae.status = 'POSTED'
      AND ae.date <= p_as_of_date
      AND aa.account_class IN (4, 5, 6, 7);

    v_total_patrimonio := v_patrimonio_base + v_resultado_ejercicio;
    v_pasivo_mas_patrimonio := v_total_pasivos + v_total_patrimonio;
    v_diferencia := ROUND(ABS(v_total_activos - v_pasivo_mas_patrimonio), 2);

    RETURN jsonb_build_object(
        'as_of_date', p_as_of_date,
        'total_activos', v_total_activos,
        'total_pasivos', v_total_pasivos,
        'patrimonio_base', v_patrimonio_base,
        'resultado_ejercicio', v_resultado_ejercicio,
        'total_patrimonio', v_total_patrimonio,
        'pasivo_mas_patrimonio', v_pasivo_mas_patrimonio,
        'diferencia_balance', v_diferencia,
        'esta_balanceado', (v_diferencia = 0.00)
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 6.6 Resumen Tributario (IVA Generado, Descontable y Retenciones)
CREATE OR REPLACE FUNCTION public.fn_financial_tax_summary(
    p_company_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS JSONB AS $$
DECLARE
    v_iva_generado NUMERIC(15,2) := 0.00;
    v_iva_descontable NUMERIC(15,2) := 0.00;
    v_retefuente_compras NUMERIC(15,2) := 0.00;
    v_saldo_iva NUMERIC(15,2) := 0.00;
BEGIN
    -- IVA Generado (Cuentas 240805, 240806 o grupo 2408 crédito de ventas)
    SELECT COALESCE(SUM(ael.credit_amount - ael.debit_amount), 0.00)
    INTO v_iva_generado
    FROM public.accounting_entry_lines ael
    JOIN public.accounting_entries ae ON ae.id = ael.entry_id
    JOIN public.accounting_accounts aa ON aa.id = ael.account_id
    WHERE ae.company_id = p_company_id
      AND ae.status = 'POSTED'
      AND ae.date BETWEEN p_start_date AND p_end_date
      AND (aa.code IN ('240805', '240806') OR (aa.code LIKE '2408%' AND aa.nature = 'CREDIT'));

    -- IVA Descontable (Cuentas 240810, 240811 o grupo 2408 débito de compras)
    SELECT COALESCE(SUM(ael.debit_amount - ael.credit_amount), 0.00)
    INTO v_iva_descontable
    FROM public.accounting_entry_lines ael
    JOIN public.accounting_entries ae ON ae.id = ael.entry_id
    JOIN public.accounting_accounts aa ON aa.id = ael.account_id
    WHERE ae.company_id = p_company_id
      AND ae.status = 'POSTED'
      AND ae.date BETWEEN p_start_date AND p_end_date
      AND (aa.code IN ('240810', '240811') OR (aa.code LIKE '2408%' AND aa.nature = 'DEBIT'));

    -- Retención en la fuente practicada en compras (236540 o grupo 2365 crédito)
    SELECT COALESCE(SUM(ael.credit_amount - ael.debit_amount), 0.00)
    INTO v_retefuente_compras
    FROM public.accounting_entry_lines ael
    JOIN public.accounting_entries ae ON ae.id = ael.entry_id
    JOIN public.accounting_accounts aa ON aa.id = ael.account_id
    WHERE ae.company_id = p_company_id
      AND ae.status = 'POSTED'
      AND ae.date BETWEEN p_start_date AND p_end_date
      AND (aa.code LIKE '2365%');

    v_saldo_iva := v_iva_generado - v_iva_descontable;

    RETURN jsonb_build_object(
        'start_date', p_start_date,
        'end_date', p_end_date,
        'iva_generado', v_iva_generado,
        'iva_descontable', v_iva_descontable,
        'saldo_iva_neto', v_saldo_iva,
        'saldo_a_favor', CASE WHEN v_saldo_iva < 0 THEN ABS(v_saldo_iva) ELSE 0.00 END,
        'saldo_a_pagar', CASE WHEN v_saldo_iva > 0 THEN v_saldo_iva ELSE 0.00 END,
        'retefuente_compras_por_pagar', v_retefuente_compras
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
