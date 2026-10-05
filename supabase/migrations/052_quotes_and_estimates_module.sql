-- ==============================================================================
-- 052_QUOTES_AND_ESTIMATES_MODULE.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Módulo oficial de Cotizaciones y Presupuestos Comerciales
-- ==============================================================================

-- 1. Tabla de Cotizaciones Comerciales (public.quotes)
CREATE TABLE IF NOT EXISTS public.quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    quote_number VARCHAR(50) NOT NULL,
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT,
    customer_name VARCHAR(255) NOT NULL,
    customer_document VARCHAR(50),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    seller_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED'
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until DATE NOT NULL,
    subtotal_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (subtotal_amount >= 0),
    discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    total_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    notes TEXT,
    terms_conditions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT quotes_company_id_quote_number_key UNIQUE (company_id, quote_number)
);

-- 2. Tabla de Líneas de Cotización (public.quote_items)
CREATE TABLE IF NOT EXISTS public.quote_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(15,2) NOT NULL CHECK (unit_price >= 0),
    unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
    discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
    discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    tax_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (tax_rate_percent >= 0),
    tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    subtotal NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    total NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Índices de rendimiento y búsqueda
CREATE INDEX IF NOT EXISTS idx_quotes_company ON public.quotes(company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_company_status ON public.quotes(company_id, status);
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON public.quotes(company_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_dates ON public.quotes(company_id, issue_date, valid_until);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON public.quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_product ON public.quote_items(product_id);

-- 4. Habilitar RLS en public.quotes y public.quote_items
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Aislamiento multiempresa para quotes" ON public.quotes;
CREATE POLICY "Aislamiento multiempresa para quotes"
    ON public.quotes
    FOR ALL
    USING (
        company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
    )
    WITH CHECK (
        company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
    );

DROP POLICY IF EXISTS "Aislamiento multiempresa para quote_items" ON public.quote_items;
CREATE POLICY "Aislamiento multiempresa para quote_items"
    ON public.quote_items
    FOR ALL
    USING (
        company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
    )
    WITH CHECK (
        company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
    );
