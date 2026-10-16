-- ==============================================================================
-- 054_ACCOUNTING_THIRD_PARTIES_AND_DUE_DATE.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Módulo de Terceros Contables con Naturaleza Jurídica y Fecha de Vencimiento
-- ==============================================================================

-- 1. Agregar columna due_date a accounting_entries y accounting_entry_lines
ALTER TABLE public.accounting_entries
    ADD COLUMN IF NOT EXISTS due_date DATE;

ALTER TABLE public.accounting_entry_lines
    ADD COLUMN IF NOT EXISTS due_date DATE;

-- 2. Tabla oficial: third_parties (Terceros Contables / Fiscales DIAN)
CREATE TABLE IF NOT EXISTS public.third_parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT,
    document_type VARCHAR(20) NOT NULL DEFAULT 'NIT', -- 'CC', 'NIT', 'CE', 'PASSPORT', 'TI'
    document_number VARCHAR(30) NOT NULL,
    verification_digit VARCHAR(1),
    legal_nature VARCHAR(20) NOT NULL DEFAULT 'JURIDICA' CHECK (legal_nature IN ('NATURAL', 'JURIDICA')),
    first_name VARCHAR(100),
    other_names VARCHAR(100),
    first_surname VARCHAR(100),
    second_surname VARCHAR(100),
    company_name VARCHAR(200) NOT NULL, -- Razón Social o Nombre Completo
    commercial_name VARCHAR(200),
    third_party_type VARCHAR(30) NOT NULL DEFAULT 'OTRO' CHECK (third_party_type IN ('CLIENTE', 'PROVEEDOR', 'EMPLEADO', 'ACREEDOR', 'OTRO')),
    email VARCHAR(150),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100) DEFAULT 'Medellín',
    department VARCHAR(100) DEFAULT 'Antioquia',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_third_parties_company_doc UNIQUE (company_id, document_number)
);

CREATE INDEX IF NOT EXISTS idx_third_parties_doc ON public.third_parties(document_number);
CREATE INDEX IF NOT EXISTS idx_third_parties_name ON public.third_parties(company_name);
CREATE INDEX IF NOT EXISTS idx_third_parties_nature ON public.third_parties(legal_nature);
CREATE INDEX IF NOT EXISTS idx_third_parties_company ON public.third_parties(company_id);

-- 3. Habilitar RLS en public.third_parties
ALTER TABLE public.third_parties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation third_parties_select" ON public.third_parties;
CREATE POLICY "Tenant isolation third_parties_select" ON public.third_parties
    FOR SELECT TO authenticated
    USING (
        company_id = public.get_auth_company_id() OR public.is_admin()
    );

DROP POLICY IF EXISTS "Tenant isolation third_parties_manage" ON public.third_parties;
CREATE POLICY "Tenant isolation third_parties_manage" ON public.third_parties
    FOR ALL TO authenticated
    USING (
        (company_id = public.get_auth_company_id() AND (public.is_admin() OR public.get_auth_role() = 'ACCOUNTANT' OR public.has_permission('accounting.manage') OR public.has_permission('accounting.write') OR public.has_permission('sale.create') OR public.has_permission('purchase.create')))
        OR public.is_admin()
    )
    WITH CHECK (
        (company_id = public.get_auth_company_id() AND (public.is_admin() OR public.get_auth_role() = 'ACCOUNTANT' OR public.has_permission('accounting.manage') OR public.has_permission('accounting.write') OR public.has_permission('sale.create') OR public.has_permission('purchase.create')))
        OR public.is_admin()
    );

-- 4. Sincronización inicial desde customers
INSERT INTO public.third_parties (
    company_id, document_type, document_number, verification_digit, legal_nature,
    first_name, first_surname, company_name, third_party_type, email, phone, address, city, department, is_active
)
SELECT 
    c.company_id,
    c.document_type,
    c.document_number,
    c.verification_digit,
    CASE WHEN c.customer_type = 'COMPANY' OR c.person_type = 'JURIDICA' THEN 'JURIDICA' ELSE 'NATURAL' END,
    c.first_name,
    c.last_name,
    COALESCE(NULLIF(c.company_name, ''), CONCAT(c.first_name, ' ', c.last_name), c.document_number),
    'CLIENTE',
    c.email,
    c.phone,
    c.address,
    c.city,
    c.department,
    c.is_active
FROM public.customers c
ON CONFLICT (company_id, document_number) DO NOTHING;

-- 5. Sincronización inicial desde suppliers
INSERT INTO public.third_parties (
    company_id, document_type, document_number, verification_digit, legal_nature,
    company_name, third_party_type, email, phone, address, city, department, is_active
)
SELECT 
    s.company_id,
    'NIT',
    s.tax_id,
    s.verification_digit,
    CASE WHEN s.person_type = 'NATURAL' THEN 'NATURAL' ELSE 'JURIDICA' END,
    COALESCE(NULLIF(s.legal_name, ''), s.name),
    'PROVEEDOR',
    s.email,
    s.phone,
    s.address,
    s.city,
    s.department,
    s.is_active
FROM public.suppliers s
ON CONFLICT (company_id, document_number) DO NOTHING;
