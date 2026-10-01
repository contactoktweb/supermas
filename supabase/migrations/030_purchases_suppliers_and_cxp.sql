-- ==============================================================================
-- 030_PURCHASES_SUPPLIERS_AND_CXP.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Hardening fiduciario para Proveedores, Compras y Cuentas por Pagar:
-- 1. Campos completos en suppliers (person_type, commercial_name, whatsapp, credit_limit, notes).
-- 2. Obligatoriedad estricta de company_id y unicidad multiempresa en NIT y número de compra.
-- 3. Campos de pagos, descuentos y recepción en purchases y purchase_items.
-- 4. Soporte multiempresa y RLS para supplier_payments (Abonos CxP).
-- 5. Triggers de auditoría automática SECURITY DEFINER hacia public.audit_logs.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HARDENING DE PROVEEDORES (public.suppliers)
-- ------------------------------------------------------------------------------

-- 1.1 Agregar columnas faltantes para perfil fiduciario de proveedor
ALTER TABLE public.suppliers 
    ADD COLUMN IF NOT EXISTS person_type VARCHAR(20) NOT NULL DEFAULT 'JURIDICA',
    ADD COLUMN IF NOT EXISTS commercial_name VARCHAR(200),
    ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(50),
    ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (credit_limit >= 0),
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- 1.2 Asegurar que company_id sea estrictamente NOT NULL
ALTER TABLE public.suppliers ALTER COLUMN company_id SET NOT NULL;

-- 1.3 Reemplazar unicidad global de tax_id por unicidad multiempresa
ALTER TABLE public.suppliers DROP CONSTRAINT IF EXISTS suppliers_tax_id_key;
ALTER TABLE public.suppliers DROP CONSTRAINT IF EXISTS suppliers_company_id_tax_id_key;
ALTER TABLE public.suppliers 
    ADD CONSTRAINT suppliers_company_id_tax_id_key UNIQUE (company_id, tax_id);

CREATE INDEX IF NOT EXISTS idx_suppliers_company ON public.suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_tax_id ON public.suppliers(company_id, tax_id);

-- ------------------------------------------------------------------------------
-- 2. HARDENING DE COMPRAS (public.purchases)
-- ------------------------------------------------------------------------------

-- 2.1 Agregar columnas de control de pagos, descuentos y recepción
ALTER TABLE public.purchases 
    ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS received_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 2.2 Asegurar que company_id sea estrictamente NOT NULL
ALTER TABLE public.purchases ALTER COLUMN company_id SET NOT NULL;

-- 2.3 Reemplazar unicidad global de purchase_number por unicidad multiempresa
ALTER TABLE public.purchases DROP CONSTRAINT IF EXISTS purchases_purchase_number_key;
ALTER TABLE public.purchases DROP CONSTRAINT IF EXISTS purchases_company_id_purchase_number_key;
ALTER TABLE public.purchases 
    ADD CONSTRAINT purchases_company_id_purchase_number_key UNIQUE (company_id, purchase_number);

CREATE INDEX IF NOT EXISTS idx_purchases_company ON public.purchases(company_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON public.purchases(company_id, inventory_status, payment_status);

-- ------------------------------------------------------------------------------
-- 3. HARDENING DE DETALLE DE COMPRAS (public.purchase_items)
-- ------------------------------------------------------------------------------

ALTER TABLE public.purchase_items 
    ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00;

ALTER TABLE public.purchase_items ALTER COLUMN company_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_items_company ON public.purchase_items(company_id);

-- ------------------------------------------------------------------------------
-- 4. HARDENING DE ABONOS A CUENTAS POR PAGAR (public.supplier_payments)
-- ------------------------------------------------------------------------------

ALTER TABLE public.supplier_payments 
    ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS payment_number VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_company ON public.supplier_payments(company_id);

-- RLS para supplier_payments
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation select supplier_payments" ON public.supplier_payments;
CREATE POLICY "Tenant isolation select supplier_payments" ON public.supplier_payments
FOR SELECT TO authenticated
USING (
    company_id = public.get_auth_company_id()
    OR EXISTS (
        SELECT 1 FROM public.purchases p
        WHERE p.id = purchase_id
          AND p.company_id = public.get_auth_company_id()
    )
);

DROP POLICY IF EXISTS "Tenant isolation insert supplier_payments" ON public.supplier_payments;
CREATE POLICY "Tenant isolation insert supplier_payments" ON public.supplier_payments
FOR INSERT TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (public.has_permission('purchases.create') OR public.has_permission('treasury.create') OR public.is_admin())
);

-- ------------------------------------------------------------------------------
-- 5. AUDITORÍA AUTOMÁTICA SECURITY DEFINER PARA PROVEEDORES
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_audit_suppliers()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_user_name VARCHAR(150);
    v_company_id UUID;
    v_action VARCHAR(50);
    v_prev JSONB;
    v_new JSONB;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NOT NULL THEN
        SELECT u.full_name
        INTO v_user_name
        FROM public.users u
        WHERE u.id = v_user_id;

        IF NOT FOUND THEN
            v_user_id := NULL;
        END IF;
    END IF;

    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Sistema';
    END IF;

    IF TG_OP = 'INSERT' THEN
        v_action := 'PROVEEDOR_CREATED';
        v_company_id := NEW.company_id;
        v_prev := NULL;
        v_new := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_company_id := NEW.company_id;
        v_prev := to_jsonb(OLD);
        v_new := to_jsonb(NEW);

        IF (OLD.is_active IS DISTINCT FROM NEW.is_active) AND NEW.is_active = false THEN
            v_action := 'PROVEEDOR_DEACTIVATED';
        ELSIF (OLD.is_active IS DISTINCT FROM NEW.is_active) AND NEW.is_active = true THEN
            v_action := 'PROVEEDOR_ACTIVATED';
        ELSE
            v_action := 'PROVEEDOR_UPDATED';
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'PROVEEDOR_DELETED';
        v_company_id := OLD.company_id;
        v_prev := to_jsonb(OLD);
        v_new := NULL;
    END IF;

    INSERT INTO public.audit_logs (
        id,
        company_id,
        user_id,
        user_name,
        action,
        module,
        entity_name,
        entity_id,
        location_id,
        previous_value,
        new_value,
        created_at
    ) VALUES (
        gen_random_uuid(),
        v_company_id,
        v_user_id,
        v_user_name,
        v_action,
        'PURCHASES',
        'suppliers',
        COALESCE(NEW.id, OLD.id)::TEXT,
        NULL,
        v_prev,
        v_new,
        NOW()
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.fn_audit_suppliers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_audit_suppliers() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_audit_suppliers ON public.suppliers;
CREATE TRIGGER trg_audit_suppliers
AFTER INSERT OR UPDATE OR DELETE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_suppliers();

-- ------------------------------------------------------------------------------
-- 6. AUDITORÍA AUTOMÁTICA SECURITY DEFINER PARA COMPRAS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_audit_purchases()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_user_name VARCHAR(150);
    v_company_id UUID;
    v_action VARCHAR(50);
    v_prev JSONB;
    v_new JSONB;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NOT NULL THEN
        SELECT u.full_name
        INTO v_user_name
        FROM public.users u
        WHERE u.id = v_user_id;

        IF NOT FOUND THEN
            v_user_id := NULL;
        END IF;
    END IF;

    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Sistema';
    END IF;

    IF TG_OP = 'INSERT' THEN
        v_action := 'PURCHASE_CREATED';
        v_company_id := NEW.company_id;
        v_prev := NULL;
        v_new := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_company_id := NEW.company_id;
        v_prev := to_jsonb(OLD);
        v_new := to_jsonb(NEW);

        IF (OLD.inventory_status IS DISTINCT FROM NEW.inventory_status) AND NEW.inventory_status = 'RECEIVED' THEN
            v_action := 'PURCHASE_CONFIRMED';
        ELSIF (OLD.inventory_status IS DISTINCT FROM NEW.inventory_status) AND NEW.inventory_status = 'CANCELLED' THEN
            v_action := 'PURCHASE_CANCELLED';
        ELSE
            v_action := 'PURCHASE_UPDATED';
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'PURCHASE_DELETED';
        v_company_id := OLD.company_id;
        v_prev := to_jsonb(OLD);
        v_new := NULL;
    END IF;

    INSERT INTO public.audit_logs (
        id,
        company_id,
        user_id,
        user_name,
        action,
        module,
        entity_name,
        entity_id,
        location_id,
        previous_value,
        new_value,
        created_at
    ) VALUES (
        gen_random_uuid(),
        v_company_id,
        v_user_id,
        v_user_name,
        v_action,
        'PURCHASES',
        'purchases',
        COALESCE(NEW.id, OLD.id)::TEXT,
        COALESCE(NEW.location_id, OLD.location_id),
        v_prev,
        v_new,
        NOW()
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.fn_audit_purchases() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_audit_purchases() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_audit_purchases ON public.purchases;
CREATE TRIGGER trg_audit_purchases
AFTER INSERT OR UPDATE OR DELETE ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_purchases();

-- ------------------------------------------------------------------------------
-- 7. AUDITORÍA AUTOMÁTICA SECURITY DEFINER PARA ABONOS / PAGOS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_audit_supplier_payments()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_user_name VARCHAR(150);
    v_company_id UUID;
    v_action VARCHAR(50);
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NOT NULL THEN
        SELECT u.full_name
        INTO v_user_name
        FROM public.users u
        WHERE u.id = v_user_id;

        IF NOT FOUND THEN
            v_user_id := NULL;
        END IF;
    END IF;

    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Sistema';
    END IF;

    v_company_id := NEW.company_id;
    IF v_company_id IS NULL THEN
        SELECT p.company_id INTO v_company_id FROM public.purchases p WHERE p.id = NEW.purchase_id;
    END IF;

    v_action := 'PURCHASE_PAYMENT';

    INSERT INTO public.audit_logs (
        id,
        company_id,
        user_id,
        user_name,
        action,
        module,
        entity_name,
        entity_id,
        location_id,
        previous_value,
        new_value,
        created_at
    ) VALUES (
        gen_random_uuid(),
        v_company_id,
        v_user_id,
        v_user_name,
        v_action,
        'PURCHASES',
        'supplier_payments',
        NEW.id::TEXT,
        NEW.location_id,
        NULL,
        to_jsonb(NEW),
        NOW()
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.fn_audit_supplier_payments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_audit_supplier_payments() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_audit_supplier_payments ON public.supplier_payments;
CREATE TRIGGER trg_audit_supplier_payments
AFTER INSERT ON public.supplier_payments
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_supplier_payments();
