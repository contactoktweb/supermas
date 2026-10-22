-- ==============================================================================
-- MIGRACIÓN 072: CIERRE DE PERIODO Y REPORTES FINANCIEROS DE 024 CON REVERSIONES
-- SUPER MÁS ERP/POS
-- ==============================================================================
--
-- Problemas que resuelve:
--   a) fn_close_accounting_period y los fn_financial_* de 024 solo sumaban comprobantes POSTED.
--      Al reversar un asiento (fn_reverse_accounting_entry, 048/067) el original pasa a REVERSED y
--      la reversión (líneas invertidas) queda POSTED: los reportes mostraban la reversión SIN el
--      original (el asiento con signo contrario) y el cierre registraba totales incompletos.
--      Ambos comprobantes son parte de los libros: se cuentan POSTED + REVERSED (neto cero), igual
--      que fn_accounting_account_balances desde 065. DRAFT nunca.
--   b) Todas eran SECURITY DEFINER con p_company_id libre y sin permiso: cualquier usuario
--      autenticado podía leer los libros de otra empresa, cerrar o reabrir sus periodos.
--
-- Qué hace (mismas firmas y mismo formato de respuesta que 024):
--   1. fn_accounting_assert_company_access(p_company_id, p_manage): empresa efectiva y permiso.
--      Usuario autenticado: SIEMPRE su empresa (p_company_id solo se admite si coincide o es NULL);
--      lectura = admin, rol ACCOUNTANT o accounting.read; gestión de periodos = admin, ACCOUNTANT o
--      accounting.manage (las mismas condiciones de las políticas RLS de 014/024).
--      Contexto de servidor de confianza (service_role, 058): p_company_id obligatorio.
--   2. fn_close_accounting_period / fn_reopen_accounting_period: control anterior; quien cierra o
--      reabre es auth.uid() (el p_closed_by / p_reopened_by del cliente solo se usa en servidor).
--      El cierre totaliza POSTED + REVERSED.
--   3. fn_financial_daily_journal, fn_financial_general_ledger, fn_financial_income_statement,
--      fn_financial_balance_sheet y fn_financial_tax_summary: POSTED + REVERSED, SECURITY INVOKER
--      (RLS del invocador, como fn_financial_trial_balance en 065) con el control anterior.
--      Fechas NULL: fin = hoy en America/Bogota; inicio = primer día del mes de la fecha final.
--   fn_financial_trial_balance ya quedó corregida en 065 y no se toca.
--
-- No modifica datos. Re-ejecutable (CREATE OR REPLACE). Requiere 058 (fn_is_trusted_server_context)
-- y 065.
-- ==============================================================================

BEGIN;

-- Si una tabla está bloqueada por otra sesión, se falla rápido en vez de esperar (y bloquear a otros).
SET LOCAL lock_timeout = '5s';
SET LOCAL search_path = pg_catalog, public;

-- ------------------------------------------------------------------------------
-- 1. CONTROL DE ACCESO COMÚN
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_accounting_assert_company_access(
    p_company_id UUID,
    p_manage BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_company UUID;
BEGIN
    IF auth.uid() IS NOT NULL THEN
        v_company := public.get_auth_company_id();
        IF v_company IS NULL THEN
            RAISE EXCEPTION 'Acceso denegado: el usuario no tiene empresa asignada.' USING ERRCODE = '42501';
        END IF;
        IF p_company_id IS NOT NULL AND p_company_id IS DISTINCT FROM v_company THEN
            RAISE EXCEPTION 'Acceso denegado: no tiene acceso a la contabilidad de otra empresa.' USING ERRCODE = '42501';
        END IF;

        IF p_manage THEN
            IF NOT (public.is_admin() OR public.get_auth_role() = 'ACCOUNTANT' OR public.has_permission('accounting.manage')) THEN
                RAISE EXCEPTION 'Acceso denegado: requiere el permiso accounting.manage.' USING ERRCODE = '42501';
            END IF;
        ELSIF NOT (public.is_admin() OR public.get_auth_role() = 'ACCOUNTANT' OR public.has_permission('accounting.read')) THEN
            RAISE EXCEPTION 'Acceso denegado: requiere el permiso accounting.read.' USING ERRCODE = '42501';
        END IF;

        RETURN v_company;
    END IF;

    IF public.fn_is_trusted_server_context() THEN
        IF p_company_id IS NULL THEN
            RAISE EXCEPTION 'Debe indicar la empresa.' USING ERRCODE = '22023';
        END IF;
        RETURN p_company_id;
    END IF;

    RAISE EXCEPTION 'Acceso denegado.' USING ERRCODE = '28000';
END;
$$;

COMMENT ON FUNCTION public.fn_accounting_assert_company_access(UUID, BOOLEAN) IS
    'Empresa efectiva para RPC contables: la del usuario autenticado (lectura: admin/ACCOUNTANT/accounting.read; p_manage: admin/ACCOUNTANT/accounting.manage) o p_company_id en contexto de servidor de confianza.';

REVOKE ALL ON FUNCTION public.fn_accounting_assert_company_access(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_accounting_assert_company_access(UUID, BOOLEAN) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. CIERRE Y REAPERTURA DE PERIODOS (firmas de 024)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_close_accounting_period(
    p_company_id UUID,
    p_period_code VARCHAR,
    p_closed_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_company UUID;
    v_closed_by UUID;
    v_period RECORD;
    v_entries_count INTEGER;
    v_total_debits NUMERIC(15,2);
    v_total_credits NUMERIC(15,2);
    v_drafts_count INTEGER;
    v_user_name VARCHAR(150);
    v_closed_at TIMESTAMPTZ := NOW();
BEGIN
    v_company := public.fn_accounting_assert_company_access(p_company_id, true);
    -- Quien cierra es el usuario de la sesión; el parámetro solo se acepta desde el servidor.
    v_closed_by := COALESCE(auth.uid(), p_closed_by);

    SELECT * INTO v_period
    FROM public.accounting_periods
    WHERE company_id = v_company AND period_code = p_period_code
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El periodo contable % no existe para la empresa especificada.', p_period_code
            USING ERRCODE = 'P0002';
    END IF;

    IF v_period.status = 'CLOSED' THEN
        RAISE EXCEPTION 'El periodo contable % ya se encuentra CERRADO.', p_period_code USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(full_name, email, 'Sistema') INTO v_user_name
    FROM public.users
    WHERE id = v_closed_by;
    IF v_user_name IS NULL THEN
        v_user_name := 'Usuario Autorizado';
    END IF;

    SELECT COUNT(*) INTO v_drafts_count
    FROM public.accounting_entries
    WHERE company_id = v_company
      AND date BETWEEN v_period.start_date AND v_period.end_date
      AND status = 'DRAFT';

    IF v_drafts_count > 0 THEN
        RAISE EXCEPTION 'No es posible cerrar el periodo %: Existen % comprobantes en estado DRAFT (Borrador). Deben ser publicados (POSTED) o anulados antes del cierre.', p_period_code, v_drafts_count
            USING ERRCODE = '22023';
    END IF;

    -- 072: POSTED + REVERSED. Un asiento reversado y su reversión son parte de los libros.
    SELECT
        COUNT(DISTINCT ae.id),
        COALESCE(SUM(ael.debit_amount), 0.00),
        COALESCE(SUM(ael.credit_amount), 0.00)
    INTO v_entries_count, v_total_debits, v_total_credits
    FROM public.accounting_entries ae
    JOIN public.accounting_entry_lines ael ON ael.entry_id = ae.id
    WHERE ae.company_id = v_company
      AND ae.date BETWEEN v_period.start_date AND v_period.end_date
      AND ae.status IN ('POSTED', 'REVERSED');

    IF v_total_debits <> v_total_credits THEN
        RAISE EXCEPTION 'Inconsistencia contable crítica: Total Débitos (%) no coincide con Total Créditos (%) en el periodo %.', v_total_debits, v_total_credits, p_period_code
            USING ERRCODE = '23514';
    END IF;

    UPDATE public.accounting_periods
    SET status = 'CLOSED',
        closed_at = v_closed_at,
        closed_by_user_id = v_closed_by,
        entries_count = v_entries_count,
        total_debits = v_total_debits,
        total_credits = v_total_credits,
        updated_at = v_closed_at
    WHERE id = v_period.id;

    INSERT INTO public.audit_logs (
        id, company_id, user_id, user_name, action, module, entity_name, entity_id,
        previous_value, new_value, created_at
    ) VALUES (
        gen_random_uuid(), v_company, v_closed_by, v_user_name, 'CLOSE_ACCOUNTING_PERIOD', 'ACCOUNTING', 'accounting_periods', v_period.id::VARCHAR,
        jsonb_build_object('status', 'OPEN'),
        jsonb_build_object('status', 'CLOSED', 'entries_count', v_entries_count, 'total_debits', v_total_debits, 'total_credits', v_total_credits),
        v_closed_at
    );

    RETURN jsonb_build_object(
        'period_id', v_period.id,
        'period_code', p_period_code,
        'status', 'CLOSED',
        'entries_count', v_entries_count,
        'total_debits', v_total_debits,
        'total_credits', v_total_credits,
        'closed_at', v_closed_at
    );
END;
$$;

COMMENT ON FUNCTION public.fn_close_accounting_period(UUID, VARCHAR, UUID) IS
    'Cierra un periodo de la empresa del usuario (admin/ACCOUNTANT/accounting.manage). Totaliza comprobantes POSTED y REVERSED (072).';

REVOKE ALL ON FUNCTION public.fn_close_accounting_period(UUID, VARCHAR, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_close_accounting_period(UUID, VARCHAR, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_reopen_accounting_period(
    p_company_id UUID,
    p_period_code VARCHAR,
    p_reopened_by UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_company UUID;
    v_reopened_by UUID;
    v_period RECORD;
    v_user_name VARCHAR(150);
    v_reopened_at TIMESTAMPTZ := NOW();
BEGIN
    v_company := public.fn_accounting_assert_company_access(p_company_id, true);
    v_reopened_by := COALESCE(auth.uid(), p_reopened_by);

    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RAISE EXCEPTION 'Debe proporcionar una justificación obligatoria para la reapertura del periodo contable.'
            USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_period
    FROM public.accounting_periods
    WHERE company_id = v_company AND period_code = p_period_code
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El periodo contable % no existe para la empresa especificada.', p_period_code
            USING ERRCODE = 'P0002';
    END IF;

    IF v_period.status = 'OPEN' THEN
        RAISE EXCEPTION 'El periodo contable % ya se encuentra ABIERTO.', p_period_code USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(full_name, email, 'Sistema') INTO v_user_name
    FROM public.users
    WHERE id = v_reopened_by;
    IF v_user_name IS NULL THEN
        v_user_name := 'Usuario Autorizado';
    END IF;

    UPDATE public.accounting_periods
    SET status = 'OPEN',
        reopened_at = v_reopened_at,
        reopened_by_user_id = v_reopened_by,
        reopened_reason = p_reason,
        updated_at = v_reopened_at
    WHERE id = v_period.id;

    INSERT INTO public.audit_logs (
        id, company_id, user_id, user_name, action, module, entity_name, entity_id,
        previous_value, new_value, created_at
    ) VALUES (
        gen_random_uuid(), v_company, v_reopened_by, v_user_name, 'REOPEN_ACCOUNTING_PERIOD', 'ACCOUNTING', 'accounting_periods', v_period.id::VARCHAR,
        jsonb_build_object('status', 'CLOSED'),
        jsonb_build_object('status', 'OPEN', 'reason', p_reason),
        v_reopened_at
    );

    RETURN jsonb_build_object(
        'period_id', v_period.id,
        'period_code', p_period_code,
        'status', 'OPEN',
        'reopened_at', v_reopened_at,
        'reopened_reason', p_reason
    );
END;
$$;

COMMENT ON FUNCTION public.fn_reopen_accounting_period(UUID, VARCHAR, UUID, TEXT) IS
    'Reabre un periodo de la empresa del usuario (admin/ACCOUNTANT/accounting.manage) con justificación obligatoria (072).';

REVOKE ALL ON FUNCTION public.fn_reopen_accounting_period(UUID, VARCHAR, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_reopen_accounting_period(UUID, VARCHAR, UUID, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. REPORTES FINANCIEROS (firmas y columnas de 024)
-- ------------------------------------------------------------------------------

-- 3.1 Libro Diario
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
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_company UUID := public.fn_accounting_assert_company_access(p_company_id, false);
    v_end DATE := COALESCE(p_end_date, (NOW() AT TIME ZONE 'America/Bogota')::DATE);
    v_start DATE := COALESCE(p_start_date, date_trunc('month', COALESCE(p_end_date, (NOW() AT TIME ZONE 'America/Bogota')::DATE))::DATE);
BEGIN
    IF v_start > v_end THEN
        RAISE EXCEPTION 'La fecha inicial (%) es posterior a la final (%).', v_start, v_end USING ERRCODE = '22023';
    END IF;

    RETURN QUERY
    SELECT
        ae.id,
        ae.consecutive,
        ae.entry_number,
        ae.date,
        ae.document_type,
        ae.document_reference,
        ae.concept,
        aa.code,
        aa.name,
        ael.third_party_doc,
        ael.third_party_name,
        cc.code,
        ael.debit_amount,
        ael.credit_amount
    FROM public.accounting_entries ae
    JOIN public.accounting_entry_lines ael ON ael.entry_id = ae.id
    JOIN public.accounting_accounts aa ON aa.id = ael.account_id
    LEFT JOIN public.cost_centers cc ON cc.id = ael.cost_center_id
    WHERE ae.company_id = v_company
      AND ae.status IN ('POSTED', 'REVERSED')
      AND ae.date BETWEEN v_start AND v_end
    ORDER BY ae.date ASC, ae.consecutive ASC, ael.created_at ASC, ael.id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_financial_daily_journal(UUID, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_financial_daily_journal(UUID, DATE, DATE) TO authenticated, service_role;

-- 3.2 Libro Mayor
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
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_company UUID := public.fn_accounting_assert_company_access(p_company_id, false);
    v_end DATE := COALESCE(p_end_date, (NOW() AT TIME ZONE 'America/Bogota')::DATE);
    v_start DATE := COALESCE(p_start_date, date_trunc('month', COALESCE(p_end_date, (NOW() AT TIME ZONE 'America/Bogota')::DATE))::DATE);
BEGIN
    IF v_start > v_end THEN
        RAISE EXCEPTION 'La fecha inicial (%) es posterior a la final (%).', v_start, v_end USING ERRCODE = '22023';
    END IF;

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
            ae.consecutive AS e_consecutive,
            ael.id AS line_id
        FROM public.accounting_entry_lines ael
        JOIN public.accounting_entries ae ON ae.id = ael.entry_id
        JOIN public.accounting_accounts aa ON aa.id = ael.account_id
        WHERE ae.company_id = v_company
          AND ae.status IN ('POSTED', 'REVERSED')
          AND ae.date BETWEEN v_start AND v_end
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
            ORDER BY lb.e_date ASC, lb.e_consecutive ASC, lb.line_id ASC
        )::NUMERIC(15,2)
    FROM ledger_base lb
    ORDER BY lb.acc_code ASC, lb.e_date ASC, lb.e_consecutive ASC, lb.line_id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_financial_general_ledger(UUID, DATE, DATE, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_financial_general_ledger(UUID, DATE, DATE, VARCHAR) TO authenticated, service_role;

-- 3.3 Estado de Resultados
CREATE OR REPLACE FUNCTION public.fn_financial_income_statement(
    p_company_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_company UUID := public.fn_accounting_assert_company_access(p_company_id, false);
    v_end DATE := COALESCE(p_end_date, (NOW() AT TIME ZONE 'America/Bogota')::DATE);
    v_start DATE := COALESCE(p_start_date, date_trunc('month', COALESCE(p_end_date, (NOW() AT TIME ZONE 'America/Bogota')::DATE))::DATE);
    v_total_ingresos NUMERIC(15,2);
    v_total_costos NUMERIC(15,2);
    v_total_gastos NUMERIC(15,2);
    v_utilidad_bruta NUMERIC(15,2);
    v_utilidad_operativa NUMERIC(15,2);
BEGIN
    IF v_start > v_end THEN
        RAISE EXCEPTION 'La fecha inicial (%) es posterior a la final (%).', v_start, v_end USING ERRCODE = '22023';
    END IF;

    SELECT
        -- Ingresos (clase 4: crédito − débito); costos (6 y 7) y gastos (5): débito − crédito.
        COALESCE(SUM(ael.credit_amount - ael.debit_amount) FILTER (WHERE aa.account_class = 4), 0.00),
        COALESCE(SUM(ael.debit_amount - ael.credit_amount) FILTER (WHERE aa.account_class IN (6, 7)), 0.00),
        COALESCE(SUM(ael.debit_amount - ael.credit_amount) FILTER (WHERE aa.account_class = 5), 0.00)
    INTO v_total_ingresos, v_total_costos, v_total_gastos
    FROM public.accounting_entry_lines ael
    JOIN public.accounting_entries ae ON ae.id = ael.entry_id
    JOIN public.accounting_accounts aa ON aa.id = ael.account_id
    WHERE ae.company_id = v_company
      AND ae.status IN ('POSTED', 'REVERSED')
      AND ae.date BETWEEN v_start AND v_end
      AND aa.account_class IN (4, 5, 6, 7);

    v_utilidad_bruta := v_total_ingresos - v_total_costos;
    v_utilidad_operativa := v_utilidad_bruta - v_total_gastos;

    RETURN jsonb_build_object(
        'start_date', v_start,
        'end_date', v_end,
        'total_ingresos', v_total_ingresos,
        'total_costos', v_total_costos,
        'utilidad_bruta', v_utilidad_bruta,
        'total_gastos', v_total_gastos,
        'utilidad_operativa', v_utilidad_operativa
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_financial_income_statement(UUID, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_financial_income_statement(UUID, DATE, DATE) TO authenticated, service_role;

-- 3.4 Balance General
CREATE OR REPLACE FUNCTION public.fn_financial_balance_sheet(
    p_company_id UUID,
    p_as_of_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_company UUID := public.fn_accounting_assert_company_access(p_company_id, false);
    v_as_of DATE := COALESCE(p_as_of_date, (NOW() AT TIME ZONE 'America/Bogota')::DATE);
    v_total_activos NUMERIC(15,2);
    v_total_pasivos NUMERIC(15,2);
    v_patrimonio_base NUMERIC(15,2);
    v_resultado_ejercicio NUMERIC(15,2);
    v_total_patrimonio NUMERIC(15,2);
    v_pasivo_mas_patrimonio NUMERIC(15,2);
    v_diferencia NUMERIC(15,2);
BEGIN
    SELECT
        COALESCE(SUM(ael.debit_amount - ael.credit_amount) FILTER (WHERE aa.account_class = 1), 0.00),
        COALESCE(SUM(ael.credit_amount - ael.debit_amount) FILTER (WHERE aa.account_class = 2), 0.00),
        COALESCE(SUM(ael.credit_amount - ael.debit_amount) FILTER (WHERE aa.account_class = 3), 0.00),
        -- Resultado del ejercicio no cerrado: Ingresos (4) − Gastos (5) − Costos (6 y 7).
        COALESCE(SUM(ael.credit_amount - ael.debit_amount) FILTER (WHERE aa.account_class IN (4, 5, 6, 7)), 0.00)
    INTO v_total_activos, v_total_pasivos, v_patrimonio_base, v_resultado_ejercicio
    FROM public.accounting_entry_lines ael
    JOIN public.accounting_entries ae ON ae.id = ael.entry_id
    JOIN public.accounting_accounts aa ON aa.id = ael.account_id
    WHERE ae.company_id = v_company
      AND ae.status IN ('POSTED', 'REVERSED')
      AND ae.date <= v_as_of
      AND aa.account_class IN (1, 2, 3, 4, 5, 6, 7);

    v_total_patrimonio := v_patrimonio_base + v_resultado_ejercicio;
    v_pasivo_mas_patrimonio := v_total_pasivos + v_total_patrimonio;
    v_diferencia := ROUND(ABS(v_total_activos - v_pasivo_mas_patrimonio), 2);

    RETURN jsonb_build_object(
        'as_of_date', v_as_of,
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
$$;

REVOKE ALL ON FUNCTION public.fn_financial_balance_sheet(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_financial_balance_sheet(UUID, DATE) TO authenticated, service_role;

-- 3.5 Resumen tributario (IVA y retención en la fuente)
CREATE OR REPLACE FUNCTION public.fn_financial_tax_summary(
    p_company_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_company UUID := public.fn_accounting_assert_company_access(p_company_id, false);
    v_end DATE := COALESCE(p_end_date, (NOW() AT TIME ZONE 'America/Bogota')::DATE);
    v_start DATE := COALESCE(p_start_date, date_trunc('month', COALESCE(p_end_date, (NOW() AT TIME ZONE 'America/Bogota')::DATE))::DATE);
    v_iva_generado NUMERIC(15,2);
    v_iva_descontable NUMERIC(15,2);
    v_retefuente_compras NUMERIC(15,2);
    v_saldo_iva NUMERIC(15,2);
BEGIN
    IF v_start > v_end THEN
        RAISE EXCEPTION 'La fecha inicial (%) es posterior a la final (%).', v_start, v_end USING ERRCODE = '22023';
    END IF;

    -- Mismas cuentas que 024: IVA generado 240805/240806 o 2408 crédito; descontable 240810/240811
    -- o 2408 débito; retención en la fuente 2365.
    SELECT
        COALESCE(SUM(ael.credit_amount - ael.debit_amount)
            FILTER (WHERE aa.code IN ('240805', '240806') OR (aa.code LIKE '2408%' AND aa.nature = 'CREDIT')), 0.00),
        COALESCE(SUM(ael.debit_amount - ael.credit_amount)
            FILTER (WHERE aa.code IN ('240810', '240811') OR (aa.code LIKE '2408%' AND aa.nature = 'DEBIT')), 0.00),
        COALESCE(SUM(ael.credit_amount - ael.debit_amount) FILTER (WHERE aa.code LIKE '2365%'), 0.00)
    INTO v_iva_generado, v_iva_descontable, v_retefuente_compras
    FROM public.accounting_entry_lines ael
    JOIN public.accounting_entries ae ON ae.id = ael.entry_id
    JOIN public.accounting_accounts aa ON aa.id = ael.account_id
    WHERE ae.company_id = v_company
      AND ae.status IN ('POSTED', 'REVERSED')
      AND ae.date BETWEEN v_start AND v_end
      AND (aa.code LIKE '2408%' OR aa.code LIKE '2365%');

    v_saldo_iva := v_iva_generado - v_iva_descontable;

    RETURN jsonb_build_object(
        'start_date', v_start,
        'end_date', v_end,
        'iva_generado', v_iva_generado,
        'iva_descontable', v_iva_descontable,
        'saldo_iva_neto', v_saldo_iva,
        'saldo_a_favor', CASE WHEN v_saldo_iva < 0 THEN ABS(v_saldo_iva) ELSE 0.00 END,
        'saldo_a_pagar', CASE WHEN v_saldo_iva > 0 THEN v_saldo_iva ELSE 0.00 END,
        'retefuente_compras_por_pagar', v_retefuente_compras
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_financial_tax_summary(UUID, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_financial_tax_summary(UUID, DATE, DATE) TO authenticated, service_role;

COMMIT;
