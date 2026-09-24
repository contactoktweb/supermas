-- ==============================================================================
-- 011_ACCOUNTING_TREASURY_AND_DIAN_SEPARATION.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Separación arquitectónica de Tesorería, Prefijos DIAN vs ERP, y Cuentas de Inventario
-- Incluye Auditoría Completa (created_by, updated_by, created_at, updated_at)
-- y Multi-Tenancy / Multi-Bodega (company_id, location_id) con RLS
-- ==============================================================================

-- 1. Tabla: dian_resolutions (Autorizaciones y Rangos Numéricos Oficiales DIAN)
CREATE TABLE IF NOT EXISTS public.dian_resolutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    dian_prefix VARCHAR(10) NOT NULL, -- Ej: 'FE', 'POS', 'NC', 'ND'
    resolution_number VARCHAR(50) NOT NULL, -- Ej: '18764000001'
    resolution_date DATE NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL,
    initial_range BIGINT NOT NULL CHECK (initial_range >= 1),
    final_range BIGINT NOT NULL,
    current_number BIGINT NOT NULL,
    document_type VARCHAR(30) NOT NULL DEFAULT 'ELECTRONICA', -- 'ELECTRONICA', 'POS', 'NOTA_CREDITO', 'NOTA_DEBITO'
    technical_key VARCHAR(120),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_dian_ranges CHECK (final_range >= initial_range),
    CONSTRAINT chk_dian_current CHECK (current_number >= initial_range AND current_number <= final_range)
);

CREATE INDEX IF NOT EXISTS idx_dian_resolutions_company ON public.dian_resolutions(company_id);
CREATE INDEX IF NOT EXISTS idx_dian_resolutions_location ON public.dian_resolutions(location_id);
CREATE INDEX IF NOT EXISTS idx_dian_resolutions_prefix ON public.dian_resolutions(dian_prefix);
CREATE INDEX IF NOT EXISTS idx_dian_resolutions_active ON public.dian_resolutions(is_active);

-- 2. Alteración a electronic_invoices para separación estricta ERP vs DIAN
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'electronic_invoices' AND column_name = 'internal_number'
    ) THEN
        ALTER TABLE public.electronic_invoices
        ADD COLUMN internal_number VARCHAR(50),
        ADD COLUMN dian_prefix VARCHAR(10),
        ADD COLUMN dian_number BIGINT,
        ADD COLUMN dian_resolution VARCHAR(50);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_electronic_invoices_internal_number ON public.electronic_invoices(internal_number);
CREATE INDEX IF NOT EXISTS idx_electronic_invoices_dian_full ON public.electronic_invoices(dian_prefix, dian_number);

-- 3. Asegurar company_id y location_id en accounting_entries (si no existen)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'accounting_entries' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE public.accounting_entries
        ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'accounting_entries' AND column_name = 'location_id'
    ) THEN
        ALTER TABLE public.accounting_entries
        ADD COLUMN location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_accounting_entries_company ON public.accounting_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_location ON public.accounting_entries(location_id);

-- 4. MÓDULO DE TESORERÍA (Separado de Contabilidad pero integrado en causación)
-- 4.1. Tabla: bank_accounts (Cuentas Bancarias y Fondos de Caja de la Empresa)
CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL, -- Asignada a bodega (ej: Caja General de Sede) o NULL (Corporativa central)
    bank_name VARCHAR(100) NOT NULL, -- 'Bancolombia', 'Banco de Bogotá', 'Caja General Efectivo'
    account_number VARCHAR(50) NOT NULL UNIQUE,
    account_type VARCHAR(30) NOT NULL DEFAULT 'CORRIENTE', -- 'CORRIENTE', 'AHORROS', 'CAJA_EFECTIVO'
    currency VARCHAR(10) NOT NULL DEFAULT 'COP',
    current_balance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    accounting_account_id UUID REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    created_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_company ON public.bank_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_location ON public.bank_accounts(location_id);

-- 4.2. Tabla: treasury_payments (Dispersión y Pagos de Tesorería a Proveedores)
CREATE TABLE IF NOT EXISTS public.treasury_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL, -- Sede/Bodega de origen de la compra
    payment_number VARCHAR(50) NOT NULL UNIQUE, -- Ej: 'TES-PAG-2026-00001'
    payment_type VARCHAR(30) NOT NULL DEFAULT 'SUPPLIER_PAYMENT',
    purchase_id UUID REFERENCES public.purchases(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE RESTRICT,
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    payment_date DATE NOT NULL,
    due_date DATE,
    payment_method VARCHAR(30) NOT NULL DEFAULT 'TRANSFERENCIA',
    reference_number VARCHAR(80),
    support_document_url TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED', -- 'SCHEDULED', 'PAID', 'CANCELLED'
    accounting_entry_id UUID REFERENCES public.accounting_entries(id) ON DELETE SET NULL,
    notes TEXT,
    created_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_treasury_payments_company ON public.treasury_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_treasury_payments_location ON public.treasury_payments(location_id);
CREATE INDEX IF NOT EXISTS idx_treasury_payments_supplier ON public.treasury_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_treasury_payments_status ON public.treasury_payments(status);
CREATE INDEX IF NOT EXISTS idx_treasury_payments_bank ON public.treasury_payments(bank_account_id);

-- 4.3. Tabla: treasury_receipts (Recaudos de Tesorería de Clientes)
CREATE TABLE IF NOT EXISTS public.treasury_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL, -- Sede/Bodega donde se efectuó el recaudo
    receipt_number VARCHAR(50) NOT NULL UNIQUE, -- Ej: 'TES-REC-2026-00001'
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    invoice_id UUID REFERENCES public.electronic_invoices(id) ON DELETE SET NULL,
    bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE RESTRICT,
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    receipt_date DATE NOT NULL,
    payment_method VARCHAR(30) NOT NULL DEFAULT 'TRANSFERENCIA',
    reference_number VARCHAR(80),
    status VARCHAR(30) NOT NULL DEFAULT 'COLLECTED', -- 'COLLECTED', 'RECONCILED', 'CANCELLED'
    accounting_entry_id UUID REFERENCES public.accounting_entries(id) ON DELETE SET NULL,
    notes TEXT,
    created_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_treasury_receipts_company ON public.treasury_receipts(company_id);
CREATE INDEX IF NOT EXISTS idx_treasury_receipts_location ON public.treasury_receipts(location_id);
CREATE INDEX IF NOT EXISTS idx_treasury_receipts_customer ON public.treasury_receipts(customer_id);
CREATE INDEX IF NOT EXISTS idx_treasury_receipts_invoice ON public.treasury_receipts(invoice_id);

-- 4.4. Tabla: bank_movements (Extracto de Movimientos Bancarios para Conciliación)
CREATE TABLE IF NOT EXISTS public.bank_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
    movement_number VARCHAR(50) NOT NULL,
    movement_date DATE NOT NULL,
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('DEBIT', 'CREDIT')),
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    balance_after NUMERIC(15,2) NOT NULL,
    concept TEXT NOT NULL,
    reference VARCHAR(80),
    treasury_payment_id UUID REFERENCES public.treasury_payments(id) ON DELETE SET NULL,
    treasury_receipt_id UUID REFERENCES public.treasury_receipts(id) ON DELETE SET NULL,
    is_reconciled BOOLEAN NOT NULL DEFAULT false,
    reconciled_at TIMESTAMPTZ,
    created_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_movements_company ON public.bank_movements(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_movements_location ON public.bank_movements(location_id);
CREATE INDEX IF NOT EXISTS idx_bank_movements_account ON public.bank_movements(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_movements_date ON public.bank_movements(movement_date);

-- 5. Actualización a productos para Categoría Contable de Inventario (Materia Prima, En Proceso, Terminado, Mercancías)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'inventory_type'
    ) THEN
        ALTER TABLE public.products
        ADD COLUMN inventory_type VARCHAR(30) NOT NULL DEFAULT 'MERCHANDISE',
        ADD COLUMN accounting_category_id VARCHAR(50);
    END IF;
END $$;

-- 6. SEGURIDAD Y ROW LEVEL SECURITY (RLS) PARA LAS NUEVAS TABLAS
ALTER TABLE public.dian_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_movements ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: Administradores gestionan todo; usuarios de sede acceden según bodega asignada
CREATE POLICY dian_resolutions_policy ON public.dian_resolutions
    FOR ALL
    USING (
        public.is_admin() OR 
        location_id IS NULL OR 
        public.has_location_access(location_id)
    );

CREATE POLICY bank_accounts_policy ON public.bank_accounts
    FOR ALL
    USING (
        public.is_admin() OR 
        location_id IS NULL OR 
        public.has_location_access(location_id)
    );

CREATE POLICY treasury_payments_policy ON public.treasury_payments
    FOR ALL
    USING (
        public.is_admin() OR 
        location_id IS NULL OR 
        public.has_location_access(location_id)
    );

CREATE POLICY treasury_receipts_policy ON public.treasury_receipts
    FOR ALL
    USING (
        public.is_admin() OR 
        location_id IS NULL OR 
        public.has_location_access(location_id)
    );

CREATE POLICY bank_movements_policy ON public.bank_movements
    FOR ALL
    USING (
        public.is_admin() OR 
        location_id IS NULL OR 
        public.has_location_access(location_id)
    );
