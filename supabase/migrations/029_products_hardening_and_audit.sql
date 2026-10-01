-- ==============================================================================
-- 029_PRODUCTS_HARDENING_AND_AUDIT.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Hardening fiduciario para Productos:
-- 1. Obligatoriedad estricta de company_id (NOT NULL).
-- 2. Unicidad multiempresa en SKU (UNIQUE compuesto con company_id).
-- 3. Unicidad multiempresa en slug (UNIQUE compuesto con company_id).
-- 4. Trigger de auditoría automática SECURITY DEFINER hacia public.audit_logs.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HARDENING DE NULABILIDAD Y CONSTRAINTS MULTIEMPRESA
-- ------------------------------------------------------------------------------

-- 1.1 Asegurar que company_id sea estrictamente NOT NULL en public.products
ALTER TABLE public.products ALTER COLUMN company_id SET NOT NULL;

-- 1.2 En public.products: Reemplazar unicidad global de SKU por unicidad por empresa
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_sku_key;

ALTER TABLE public.products 
    ADD CONSTRAINT products_company_id_sku_key UNIQUE (company_id, sku);

-- 1.3 En public.products: Reemplazar unicidad global de slug por unicidad por empresa
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_slug_key;

ALTER TABLE public.products 
    ADD CONSTRAINT products_company_id_slug_key UNIQUE (company_id, slug);

-- ------------------------------------------------------------------------------
-- 2. AUDITORÍA AUTOMÁTICA SECURITY DEFINER PARA PRODUCTOS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_audit_products()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_user_name VARCHAR(150);
    v_company_id UUID;
    v_action VARCHAR(50);
    v_prev JSONB;
    v_new JSONB;
BEGIN
    -- Capturar el usuario autenticado desde el contexto de sesión Supabase
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
        v_action := 'PRODUCT_CREATED';
        v_company_id := NEW.company_id;
        v_prev := NULL;
        v_new := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_company_id := NEW.company_id;
        v_prev := to_jsonb(OLD);
        v_new := to_jsonb(NEW);

        -- Distinguir transición de estados (Activar / Desactivar / Edición general)
        IF (OLD.is_active IS DISTINCT FROM NEW.is_active) AND NEW.is_active = false THEN
            v_action := 'PRODUCT_DEACTIVATED';
        ELSIF (OLD.is_active IS DISTINCT FROM NEW.is_active) AND NEW.is_active = true THEN
            v_action := 'PRODUCT_ACTIVATED';
        ELSE
            v_action := 'PRODUCT_UPDATED';
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'PRODUCT_DELETED';
        v_company_id := OLD.company_id;
        v_prev := to_jsonb(OLD);
        v_new := NULL;
    END IF;

    -- Inserción fiduciaria en public.audit_logs
    -- Nota: location_id se mantiene NULL porque la entidad auditada es el catálogo maestro 'products' (en entity_id).
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
        'CATALOG',
        'products',
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

-- Restringir permisos de ejecución (No invocable directamente por usuarios anónimos)
REVOKE ALL ON FUNCTION public.fn_audit_products() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_audit_products() TO authenticated, service_role;

-- Crear el trigger sobre public.products
DROP TRIGGER IF EXISTS trg_audit_products ON public.products;
CREATE TRIGGER trg_audit_products
AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_products();
