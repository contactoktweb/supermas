-- ==============================================================================
-- MIGRACIÓN 065: REPORTES CONTABLES — RANGO DE CUENTAS PUC Y SALDOS CORREGIDOS
-- SUPER MÁS ERP/POS
-- ==============================================================================
--
-- Problemas que resuelve:
--   a) Rango de cuentas (cuenta inicial / final) en libros y exportaciones. Los códigos PUC llevan
--      punto en los auxiliares ('110505.01') y la colación de idioma de PostgreSQL ignora la
--      puntuación al ordenar, así que `code BETWEEN '1105' AND '1110'` no es confiable.
--   b) fn_accounting_account_balances (061) solo sumaba comprobantes POSTED. Al reversar un
--      asiento (fn_reverse_accounting_entry, 048) el original pasa a REVERSED y el comprobante de
--      reversión (líneas invertidas) queda POSTED: el saldo mostraba la reversión SIN el original,
--      es decir, el valor del asiento con el signo contrario. Ambos comprobantes forman parte de
--      los libros, así que se suman POSTED + REVERSED (neto cero tras una reversión). DRAFT nunca.
--   c) fn_financial_trial_balance (024) unía las líneas con LEFT JOIN y ponía los filtros de
--      empresa/estado/fecha en el ON del segundo LEFT JOIN: sumaba líneas de cualquier estado,
--      fecha y empresa. Además era SECURITY DEFINER con p_company_id libre (cualquier usuario
--      autenticado podía leer otra empresa).
--
-- Qué hace:
--   1. public.fn_puc_code_sort_key(code): clave de orden del PUC. El primer segmento (dígitos) se
--      conserva; cada segmento tras un punto se rellena con ceros a 6 caracteres. Comparada con
--      COLLATE "C" ordena: 1105 < 110505 < 110505.01 < 110505.02 < 110510 < 1110.
--      Rango [desde, hasta]: clave >= clave(desde) AND clave <= clave(hasta) || '~'
--      ('~' > dígitos y punto: incluye la cuenta final y todas sus subcuentas/auxiliares).
--      Es la misma regla que features/accounting/utils/puc-code-range.ts.
--   2. accounting_accounts.code_sort_key: columna generada (COLLATE "C") + índice, para filtrar
--      por rango desde PostgREST (libro auxiliar / movimientos).
--   3. fn_accounting_account_balances: misma firma, ahora POSTED + REVERSED.
--   4. fn_accounting_account_balances_range: igual que la anterior con rango de cuentas.
--   5. fn_financial_trial_balance: misma firma y columnas; agrega solo comprobantes POSTED/REVERSED
--      de p_company_id en el rango de fechas, SECURITY INVOKER (RLS del invocador) y, si hay
--      usuario autenticado, exige que p_company_id sea su empresa.
--
-- Seguridad: funciones de lectura (STABLE), search_path fijo, filtro por get_auth_company_id()
-- en las RPC del cliente, EXECUTE solo para authenticated/service_role. No modifica datos.
-- Re-ejecutable: CREATE OR REPLACE, ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS.
-- ==============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ------------------------------------------------------------------------------
-- 1. CLAVE DE ORDEN DEL PUC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_puc_code_sort_key(p_code TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
    SELECT CASE
        WHEN p_code IS NULL OR btrim(p_code) = '' THEN NULL
        ELSE array_to_string(
            ARRAY(
                SELECT CASE
                    WHEN s.ord = 1 OR length(s.seg) >= 6 THEN s.seg
                    ELSE lpad(s.seg, 6, '0')
                END
                FROM unnest(string_to_array(btrim(p_code), '.')) WITH ORDINALITY AS s(seg, ord)
                ORDER BY s.ord
            ),
            '.'
        )
    END;
$$;

COMMENT ON FUNCTION public.fn_puc_code_sort_key(TEXT) IS
    'Clave de orden jerárquico del PUC (comparar con COLLATE "C"): 1105 < 110505 < 110505.01 < 110510 < 1110. Rango: clave >= clave(desde) AND clave <= clave(hasta) || ''~''.';

REVOKE ALL ON FUNCTION public.fn_puc_code_sort_key(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_puc_code_sort_key(TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. COLUMNA GENERADA PARA FILTRAR POR RANGO DESDE POSTGREST
-- ------------------------------------------------------------------------------
-- Si algún día cambia fn_puc_code_sort_key, recalcular con: UPDATE ... SET code = code.
ALTER TABLE public.accounting_accounts
    ADD COLUMN IF NOT EXISTS code_sort_key TEXT COLLATE "C"
    GENERATED ALWAYS AS (public.fn_puc_code_sort_key(code::TEXT)) STORED;

COMMENT ON COLUMN public.accounting_accounts.code_sort_key IS
    'Clave de orden del PUC (fn_puc_code_sort_key). Filtrar rangos con >= clave(desde) y <= clave(hasta)||''~''.';

CREATE INDEX IF NOT EXISTS idx_accounting_accounts_code_sort_key
    ON public.accounting_accounts (code_sort_key);

-- ------------------------------------------------------------------------------
-- 3. SALDOS POR CUENTA (firma de 061): POSTED + REVERSED
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_accounting_account_balances(
    p_date_from DATE DEFAULT NULL,
    p_date_to DATE DEFAULT NULL,
    p_location_id UUID DEFAULT NULL
)
RETURNS TABLE (
    account_id UUID,
    total_debit NUMERIC,
    total_credit NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
    SELECT
        ael.account_id,
        COALESCE(SUM(ael.debit_amount), 0)::NUMERIC AS total_debit,
        COALESCE(SUM(ael.credit_amount), 0)::NUMERIC AS total_credit
    FROM public.accounting_entries ae
    JOIN public.accounting_entry_lines ael ON ael.entry_id = ae.id
    WHERE ae.company_id = public.get_auth_company_id()
      AND ae.status IN ('POSTED', 'REVERSED')
      AND (p_date_from IS NULL OR ae.date >= p_date_from)
      AND (p_date_to IS NULL OR ae.date <= p_date_to)
      AND (p_location_id IS NULL OR ae.location_id = p_location_id)
    GROUP BY ael.account_id;
$$;

COMMENT ON FUNCTION public.fn_accounting_account_balances(DATE, DATE, UUID) IS
    'Débitos y créditos por cuenta de comprobantes POSTED y REVERSED (el original reversado y su reversión se compensan) de la empresa del usuario. Opcional: rango de fechas y sede.';

REVOKE ALL ON FUNCTION public.fn_accounting_account_balances(DATE, DATE, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_accounting_account_balances(DATE, DATE, UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. SALDOS POR CUENTA CON RANGO DE CUENTAS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_accounting_account_balances_range(
    p_date_from DATE DEFAULT NULL,
    p_date_to DATE DEFAULT NULL,
    p_location_id UUID DEFAULT NULL,
    p_account_from TEXT DEFAULT NULL,
    p_account_to TEXT DEFAULT NULL
)
RETURNS TABLE (
    account_id UUID,
    total_debit NUMERIC,
    total_credit NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
    SELECT
        ael.account_id,
        COALESCE(SUM(ael.debit_amount), 0)::NUMERIC AS total_debit,
        COALESCE(SUM(ael.credit_amount), 0)::NUMERIC AS total_credit
    FROM public.accounting_entries ae
    JOIN public.accounting_entry_lines ael ON ael.entry_id = ae.id
    JOIN public.accounting_accounts aa ON aa.id = ael.account_id
    WHERE ae.company_id = public.get_auth_company_id()
      AND ae.status IN ('POSTED', 'REVERSED')
      AND (p_date_from IS NULL OR ae.date >= p_date_from)
      AND (p_date_to IS NULL OR ae.date <= p_date_to)
      AND (p_location_id IS NULL OR ae.location_id = p_location_id)
      AND (
          NULLIF(btrim(p_account_from), '') IS NULL
          OR public.fn_puc_code_sort_key(aa.code::TEXT) COLLATE "C"
             >= public.fn_puc_code_sort_key(p_account_from) COLLATE "C"
      )
      AND (
          NULLIF(btrim(p_account_to), '') IS NULL
          OR public.fn_puc_code_sort_key(aa.code::TEXT) COLLATE "C"
             <= (public.fn_puc_code_sort_key(p_account_to) || '~') COLLATE "C"
      )
    GROUP BY ael.account_id;
$$;

COMMENT ON FUNCTION public.fn_accounting_account_balances_range(DATE, DATE, UUID, TEXT, TEXT) IS
    'Como fn_accounting_account_balances, limitado al rango de cuentas PUC [desde, hasta] (la cuenta final incluye sus subcuentas y auxiliares).';

REVOKE ALL ON FUNCTION public.fn_accounting_account_balances_range(DATE, DATE, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_accounting_account_balances_range(DATE, DATE, UUID, TEXT, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. BALANCE DE PRUEBA (firma y columnas de 024) CORREGIDO
-- ------------------------------------------------------------------------------
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
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
    -- Un usuario autenticado solo consulta su empresa (las conexiones de servicio no tienen auth.uid()).
    IF auth.uid() IS NOT NULL AND p_company_id IS DISTINCT FROM public.get_auth_company_id() THEN
        RAISE EXCEPTION 'No tiene acceso al balance de prueba de la empresa solicitada.'
            USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    WITH line_sums AS (
        SELECT
            ael.account_id,
            COALESCE(SUM(ael.debit_amount), 0) AS sum_debit,
            COALESCE(SUM(ael.credit_amount), 0) AS sum_credit
        FROM public.accounting_entries ae
        JOIN public.accounting_entry_lines ael ON ael.entry_id = ae.id
        WHERE ae.company_id = p_company_id
          AND ae.status IN ('POSTED', 'REVERSED')
          AND ae.date BETWEEN p_start_date AND p_end_date
        GROUP BY ael.account_id
    )
    SELECT
        aa.code::VARCHAR,
        aa.name::VARCHAR,
        aa.account_class,
        aa.level,
        aa.nature::VARCHAR,
        ROUND(ls.sum_debit, 2),
        ROUND(ls.sum_credit, 2),
        CASE
            WHEN aa.nature = 'DEBIT' THEN ROUND(ls.sum_debit - ls.sum_credit, 2)
            ELSE ROUND(ls.sum_credit - ls.sum_debit, 2)
        END
    FROM line_sums ls
    JOIN public.accounting_accounts aa ON aa.id = ls.account_id
    WHERE ls.sum_debit > 0 OR ls.sum_credit > 0
    ORDER BY public.fn_puc_code_sort_key(aa.code::TEXT) COLLATE "C";
END;
$$;

COMMENT ON FUNCTION public.fn_financial_trial_balance(UUID, DATE, DATE) IS
    'Balance de prueba por cuenta: comprobantes POSTED/REVERSED de la empresa en el rango de fechas (065: corrige el LEFT JOIN que sumaba cualquier estado y empresa).';

REVOKE ALL ON FUNCTION public.fn_financial_trial_balance(UUID, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_financial_trial_balance(UUID, DATE, DATE) TO authenticated, service_role;

COMMIT;
