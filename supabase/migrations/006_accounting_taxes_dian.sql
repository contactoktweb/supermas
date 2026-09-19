-- ==============================================================================
-- 006_ACCOUNTING_TAXES_DIAN.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- ==============================================================================

-- 1. Tabla: tax_rates (Configuraciones de IVA y Retenciones)
CREATE TABLE IF NOT EXISTS public.tax_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) NOT NULL UNIQUE, -- 'IVA_19', 'IVA_5', 'EXENTO', 'RETEFUENTE_2_5'
    name VARCHAR(100) NOT NULL,
    percentage NUMERIC(5,2) NOT NULL,
    type VARCHAR(30) NOT NULL, -- 'IVA', 'RETEFUENTE', 'RETEICA', 'RETEIVA'
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabla: electronic_invoices (Facturación Electrónica DIAN)
CREATE TABLE IF NOT EXISTS public.electronic_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    prefix VARCHAR(10) NOT NULL, -- PENDIENTE DE DEFINICIÓN: Prefijo autorizado DIAN
    number BIGINT NOT NULL,
    full_number VARCHAR(30) GENERATED ALWAYS AS (prefix || '-' || number::text) STORED,
    document_type VARCHAR(30) NOT NULL DEFAULT 'INVOICE', -- 'INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE'
    cufe VARCHAR(120) UNIQUE, -- Código Único de Factura Electrónica
    qr_code_data TEXT,
    xml_signed_url TEXT,
    pdf_url TEXT,
    subtotal_amount NUMERIC(15,2) NOT NULL,
    tax_amount NUMERIC(15,2) NOT NULL,
    total_amount NUMERIC(15,2) NOT NULL,
    dian_status dian_status_type NOT NULL DEFAULT 'PENDING',
    dian_response_message TEXT,
    dian_response_date TIMESTAMPTZ,
    technical_key VARCHAR(100), -- PENDIENTE DE DEFINICIÓN DIAN
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_prefix_number UNIQUE (prefix, number)
);

CREATE INDEX IF NOT EXISTS idx_electronic_invoices_cufe ON public.electronic_invoices(cufe);
CREATE INDEX IF NOT EXISTS idx_electronic_invoices_status ON public.electronic_invoices(dian_status);
CREATE INDEX IF NOT EXISTS idx_electronic_invoices_sale ON public.electronic_invoices(sale_id);

-- 3. Tabla: dian_events (Registro cronológico de comunicación con la DIAN)
CREATE TABLE IF NOT EXISTS public.dian_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.electronic_invoices(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- 'XML_GENERATED', 'SIGNED', 'SENT_TO_DIAN', 'DIAN_RESPONSE'
    status VARCHAR(30) NOT NULL,
    payload_sent JSONB,
    response_received JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Tablas del Núcleo Contable PUC (Partida Doble)
CREATE TABLE IF NOT EXISTS public.cost_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.accounting_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) NOT NULL UNIQUE, -- Código PUC (ej: 110505, 143501, 413501, 613501)
    name VARCHAR(150) NOT NULL,
    account_class INTEGER NOT NULL, -- 1: Activo, 2: Pasivo, 3: Patrimonio, 4: Ingresos, 5: Gastos, 6: Costos
    level INTEGER NOT NULL, -- 1: Clase, 2: Grupo, 3: Cuenta, 4: Subcuenta, 5: Auxiliar
    parent_id UUID REFERENCES public.accounting_accounts(id),
    nature VARCHAR(10) NOT NULL CHECK (nature IN ('DEBIT', 'CREDIT')),
    requires_third_party BOOLEAN NOT NULL DEFAULT false,
    requires_cost_center BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounting_accounts_code ON public.accounting_accounts(code);

CREATE TABLE IF NOT EXISTS public.accounting_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consecutive BIGSERIAL,
    entry_number VARCHAR(50) NOT NULL UNIQUE,
    date DATE NOT NULL,
    concept TEXT NOT NULL,
    document_type VARCHAR(40) NOT NULL, -- 'SALE', 'PURCHASE', 'PAYMENT', 'INVENTORY_ADJUSTMENT'
    document_reference VARCHAR(100) NOT NULL,
    status accounting_entry_status NOT NULL DEFAULT 'DRAFT',
    created_by_user_id UUID REFERENCES public.users(id),
    posted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.accounting_entry_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL REFERENCES public.accounting_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT,
    third_party_doc VARCHAR(30),
    third_party_name VARCHAR(150),
    cost_center_id UUID REFERENCES public.cost_centers(id),
    description TEXT,
    debit_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (debit_amount >= 0),
    credit_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (credit_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_at_least_one_amount CHECK (debit_amount > 0 OR credit_amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_accounting_entry_lines_entry ON public.accounting_entry_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entry_lines_account ON public.accounting_entry_lines(account_id);

-- 5. Tablas: exogena_formats y exogena_records (Información Exógena DIAN)
CREATE TABLE IF NOT EXISTS public.exogena_formats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    format_code VARCHAR(10) NOT NULL, -- '1001', '1007', '1008', '1009'
    format_version VARCHAR(5) NOT NULL DEFAULT '10',
    tax_year INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_format_year UNIQUE (format_code, tax_year)
);

CREATE TABLE IF NOT EXISTS public.exogena_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    format_id UUID NOT NULL REFERENCES public.exogena_formats(id) ON DELETE CASCADE,
    concept_code VARCHAR(10) NOT NULL,
    third_party_type VARCHAR(10) NOT NULL,
    third_party_doc VARCHAR(30) NOT NULL,
    third_party_dv VARCHAR(1),
    first_surname VARCHAR(50),
    second_surname VARCHAR(50),
    first_name VARCHAR(50),
    company_name VARCHAR(150),
    address TEXT,
    department_code VARCHAR(5),
    municipality_code VARCHAR(5),
    cumulative_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
