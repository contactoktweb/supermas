-- ==============================================================================
-- 031_PURCHASES_ORDERS_RECEPTIONS_AND_CXP.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- FASE 5: Órdenes de compra, Recepción Parcial/Total, Kardex y Cuentas por Pagar
-- ==============================================================================

-- 1. HARDENING DE LÍNEAS DE COMPRA (purchase_items)
ALTER TABLE public.purchase_items 
    ADD COLUMN IF NOT EXISTS received_quantity NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (received_quantity >= 0);

-- 2. HARDENING DE CABECERA DE COMPRAS (purchases)
ALTER TABLE public.purchases 
    ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS confirmed_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_purchases_inventory_status ON public.purchases(company_id, inventory_status);
CREATE INDEX IF NOT EXISTS idx_purchases_payment_status ON public.purchases(company_id, payment_status);

-- 3. TABLA: purchase_receipts (Actas de Recepción Fiduciaria de Mercancía)
CREATE TABLE IF NOT EXISTS public.purchase_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE RESTRICT,
    reception_number VARCHAR(50) NOT NULL,
    reception_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    supplier_remission_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT purchase_receipts_company_number_key UNIQUE (company_id, reception_number)
);

CREATE INDEX IF NOT EXISTS idx_purchase_receipts_purchase ON public.purchase_receipts(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_company ON public.purchase_receipts(company_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_location ON public.purchase_receipts(location_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_date ON public.purchase_receipts(reception_date);

-- 4. TABLA: purchase_receipt_items (Detalle de Unidades Recibidas por Acta)
CREATE TABLE IF NOT EXISTS public.purchase_receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    reception_id UUID NOT NULL REFERENCES public.purchase_receipts(id) ON DELETE CASCADE,
    purchase_item_id UUID NOT NULL REFERENCES public.purchase_items(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity_received NUMERIC(12,2) NOT NULL CHECK (quantity_received > 0),
    unit_cost NUMERIC(15,2) NOT NULL CHECK (unit_cost >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_receipt_items_reception ON public.purchase_receipt_items(reception_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipt_items_product ON public.purchase_receipt_items(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipt_items_item ON public.purchase_receipt_items(purchase_item_id);

-- 5. POLÍTICAS RLS PARA purchase_receipts y purchase_receipt_items
ALTER TABLE public.purchase_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_receipt_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation select purchase_receipts" ON public.purchase_receipts;
CREATE POLICY "Tenant isolation select purchase_receipts" ON public.purchase_receipts
FOR SELECT TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND (public.has_location_access(location_id) OR public.is_admin())
    AND (public.has_permission('purchases.read') OR public.is_admin())
);

DROP POLICY IF EXISTS "Tenant isolation insert purchase_receipts" ON public.purchase_receipts;
CREATE POLICY "Tenant isolation insert purchase_receipts" ON public.purchase_receipts
FOR INSERT TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (public.has_location_access(location_id) OR public.is_admin())
    AND (public.has_permission('purchases.create') OR public.is_admin())
);

DROP POLICY IF EXISTS "Tenant isolation select purchase_receipt_items" ON public.purchase_receipt_items;
CREATE POLICY "Tenant isolation select purchase_receipt_items" ON public.purchase_receipt_items
FOR SELECT TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND (
        EXISTS (
            SELECT 1 FROM public.purchase_receipts pr
            WHERE pr.id = reception_id
              AND (public.has_location_access(pr.location_id) OR public.is_admin())
        )
    )
);

DROP POLICY IF EXISTS "Tenant isolation insert purchase_receipt_items" ON public.purchase_receipt_items;
CREATE POLICY "Tenant isolation insert purchase_receipt_items" ON public.purchase_receipt_items
FOR INSERT TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (public.has_permission('purchases.create') OR public.is_admin())
);

-- 6. ACTUALIZACIÓN DE POLÍTICAS RLS EN purchases Y purchase_items
DROP POLICY IF EXISTS "Tenant isolation update purchases" ON public.purchases;
CREATE POLICY "Tenant isolation update purchases" ON public.purchases
FOR UPDATE TO authenticated
USING (
    company_id = public.get_auth_company_id() 
    AND (public.has_location_access(location_id) OR public.is_admin())
    AND (public.has_permission('purchases.create') OR public.is_admin())
)
WITH CHECK (
    company_id = public.get_auth_company_id() 
    AND (public.has_location_access(location_id) OR public.is_admin())
    AND (public.has_permission('purchases.create') OR public.is_admin())
);

DROP POLICY IF EXISTS "Tenant isolation insert purchase_items" ON public.purchase_items;
CREATE POLICY "Tenant isolation insert purchase_items" ON public.purchase_items
FOR INSERT TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (public.has_permission('purchases.create') OR public.is_admin())
    AND EXISTS (
        SELECT 1 FROM public.purchases p
        WHERE p.id = purchase_id
          AND p.company_id = public.get_auth_company_id()
          AND (public.has_location_access(p.location_id) OR public.is_admin())
    )
);

DROP POLICY IF EXISTS "Tenant isolation update purchase_items" ON public.purchase_items;
CREATE POLICY "Tenant isolation update purchase_items" ON public.purchase_items
FOR UPDATE TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND (public.has_permission('purchases.create') OR public.is_admin())
)
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (public.has_permission('purchases.create') OR public.is_admin())
);

-- 7. INMUTABILIDAD DE RECEPCIONES Y COMPRAS RECIBIDAS
CREATE OR REPLACE FUNCTION public.fn_prevent_received_purchase_deletion()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.inventory_status IN ('RECEIVED', 'RECIBIDA', 'PARTIALLY_RECEIVED', 'RECIBIDA_PARCIALMENTE') THEN
        RAISE EXCEPTION 'Compras inmutables: No está permitido eliminar órdenes o compras con mercancía total o parcialmente recibida (Compra: %). Debe tramitarse devolución a proveedor.', OLD.purchase_number
            USING ERRCODE = '23506';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.fn_prevent_purchase_receipt_deletion()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Recepciones inmutables: No está permitido eliminar actas de recepción de mercancía ya ingresadas al Kardex (Recepción: %). Las regularizaciones deben tramitarse mediante devolución a proveedor o ajuste de inventario.', OLD.reception_number
        USING ERRCODE = '23506';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_purchase_receipt_deletion ON public.purchase_receipts;
CREATE TRIGGER trg_prevent_purchase_receipt_deletion
BEFORE DELETE ON public.purchase_receipts
FOR EACH ROW
EXECUTE FUNCTION public.fn_prevent_purchase_receipt_deletion();

-- 8. AUDITORÍA AUTOMÁTICA SECURITY DEFINER PARA RECEPCIONES
CREATE OR REPLACE FUNCTION public.fn_audit_purchase_receipts()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_user_name VARCHAR(150);
    v_company_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NOT NULL THEN
        SELECT u.full_name INTO v_user_name FROM public.users u WHERE u.id = v_user_id;
        IF NOT FOUND THEN v_user_id := NULL; END IF;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Sistema';
    END IF;

    v_company_id := NEW.company_id;

    INSERT INTO public.audit_logs (
        id, company_id, user_id, user_name, action, module,
        entity_name, entity_id, location_id, previous_value, new_value, created_at
    ) VALUES (
        gen_random_uuid(), v_company_id, v_user_id, v_user_name,
        'PURCHASE_RECEIPT', 'PURCHASES', 'purchase_receipts',
        NEW.id::TEXT, NEW.location_id, NULL, to_jsonb(NEW), NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.fn_audit_purchase_receipts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_audit_purchase_receipts() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_audit_purchase_receipts ON public.purchase_receipts;
CREATE TRIGGER trg_audit_purchase_receipts
AFTER INSERT ON public.purchase_receipts
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_purchase_receipts();
