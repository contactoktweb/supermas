-- ==============================================================================
-- 012_ACCOUNTING_PERIODS_AND_NOTES.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Periodos Contables, Cierres Mensuales, Bloqueo de Meses Cerrados y Tipos de Notas
-- ==============================================================================

-- 1. Tabla: accounting_periods (Periodos Contables y Cierres Mensuales)
CREATE TABLE IF NOT EXISTS public.accounting_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    period_code VARCHAR(7) NOT NULL UNIQUE, -- Formato 'YYYY-MM', ej: '2026-08', '2026-09'
    year INTEGER NOT NULL CHECK (year >= 2020),
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    month_name VARCHAR(25) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    closed_at TIMESTAMPTZ,
    closed_by_user_id UUID REFERENCES public.users(id),
    reopened_at TIMESTAMPTZ,
    reopened_by_user_id UUID REFERENCES public.users(id),
    reopened_reason TEXT,
    entries_count INTEGER NOT NULL DEFAULT 0,
    total_debits NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_credits NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_period_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_accounting_periods_code ON public.accounting_periods(period_code);
CREATE INDEX IF NOT EXISTS idx_accounting_periods_status ON public.accounting_periods(status);
CREATE INDEX IF NOT EXISTS idx_accounting_periods_company ON public.accounting_periods(company_id);

-- 2. Trigger de Validación: Bloquear Asientos en Periodos Cerrados
CREATE OR REPLACE FUNCTION public.fn_prevent_entries_on_closed_period()
RETURNS TRIGGER AS $$
DECLARE
    v_period_code VARCHAR(7);
    v_period_status VARCHAR(20);
BEGIN
    v_period_code := TO_CHAR(NEW.date, 'YYYY-MM');

    SELECT status INTO v_period_status
    FROM public.accounting_periods
    WHERE period_code = v_period_code;

    -- Si el periodo existe y está marcado como CERRADO, bloquear la operación
    IF v_period_status = 'CLOSED' THEN
        RAISE EXCEPTION 'El periodo contable % se encuentra CERRADO. Operación rechazada: no es posible crear, modificar ni anular comprobantes en periodos clausurados sin una reapertura autorizada.', v_period_code;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_entry_period_open ON public.accounting_entries;
CREATE TRIGGER trg_check_entry_period_open
    BEFORE INSERT OR UPDATE ON public.accounting_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_entries_on_closed_period();

-- 3. Ampliación de tipos de comprobante en electronic_invoices o accounting_entries
-- Permite: 'SALE', 'PURCHASE', 'PAYMENT', 'CUSTOMER_PAYMENT', 'SUPPLIER_PAYMENT', 
-- 'CREDIT_NOTE', 'DEBIT_NOTE', 'ACCOUNTING_ADJUSTMENT', 'CLOSING_ENTRY', 'REVERSAL'
COMMENT ON COLUMN public.accounting_entries.document_type IS 'Tipos de comprobante: SALE, PURCHASE, PAYMENT, CUSTOMER_PAYMENT, SUPPLIER_PAYMENT, CREDIT_NOTE, DEBIT_NOTE, ACCOUNTING_ADJUSTMENT, CLOSING_ENTRY, REVERSAL';

-- 4. Seguridad y Row Level Security (RLS)
ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY accounting_periods_policy ON public.accounting_periods
    FOR ALL
    USING (public.is_admin() OR public.get_auth_role() = 'ACCOUNTANT');
