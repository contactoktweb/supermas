-- ==============================================================================
-- 061_ACCOUNTING_BALANCES_RPC.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Saldos contables agregados en la base + índices de lectura del módulo contable.
--
-- Motivo: el cliente calculaba los saldos del PUC descargando TODAS las líneas de
-- comprobantes POSTED (accounting_entry_lines) y sumándolas en el navegador, varias
-- veces por carga. Esta función devuelve una fila por cuenta con débitos y créditos
-- de comprobantes POSTED; el cliente aplica la naturaleza (DEBIT/CREDIT) igual que antes.
--
-- Seguridad:
--   - SECURITY INVOKER: se aplican las RLS de accounting_entries / accounting_entry_lines
--     del usuario que llama (empresa propia + accounting.read / ACCOUNTANT / admin).
--   - Filtro explícito por public.get_auth_company_id() (aislamiento multiempresa).
--   - Solo lectura (STABLE). EXECUTE para authenticated; revocado a PUBLIC y anon.
--
-- Re-ejecutable: CREATE OR REPLACE + CREATE INDEX IF NOT EXISTS. No modifica datos.
-- ==============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- 1. Saldos por cuenta (débitos / créditos de comprobantes POSTED)
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
      AND ae.status = 'POSTED'
      AND (p_date_from IS NULL OR ae.date >= p_date_from)
      AND (p_date_to IS NULL OR ae.date <= p_date_to)
      AND (p_location_id IS NULL OR ae.location_id = p_location_id)
    GROUP BY ael.account_id;
$$;

COMMENT ON FUNCTION public.fn_accounting_account_balances(DATE, DATE, UUID) IS
    'Débitos y créditos acumulados por cuenta en comprobantes POSTED de la empresa del usuario (RLS del invocador). Opcional: rango de fechas y sede.';

REVOKE ALL ON FUNCTION public.fn_accounting_account_balances(DATE, DATE, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_accounting_account_balances(DATE, DATE, UUID) TO authenticated, service_role;

-- 2. Índices de lectura
-- Saldos y contadores: comprobantes por empresa y estado (y fecha para rangos).
CREATE INDEX IF NOT EXISTS idx_accounting_entries_company_status_date
    ON public.accounting_entries (company_id, status, date);

-- Listado de asientos: ORDER BY date DESC, created_at DESC dentro de la empresa.
CREATE INDEX IF NOT EXISTS idx_accounting_entries_company_date_created
    ON public.accounting_entries (company_id, date DESC, created_at DESC);

-- Agregación de líneas por comprobante sin visitar la tabla (importes incluidos).
CREATE INDEX IF NOT EXISTS idx_accounting_entry_lines_entry_account
    ON public.accounting_entry_lines (entry_id, account_id) INCLUDE (debit_amount, credit_amount);

COMMIT;
