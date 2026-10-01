-- ==============================================================================
-- 028_CATEGORIES_AND_BRANDS_HARDENING.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Hardening fiduciario para Categorías y Marcas:
-- 1. Unicidad multiempresa (UNIQUE compuesto con company_id).
-- 2. Obligatoriedad de company_id (NOT NULL).
-- 3. Validación de integridad jerárquica de parent_id (mismo inquilino y sin ciclos).
-- 4. Triggers de auditoría automática SECURITY DEFINER hacia public.audit_logs.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HARDENING DE NULABILIDAD Y CONSTRAINTS MULTIEMPRESA
-- ------------------------------------------------------------------------------

-- 1.1 Asegurar que company_id sea estrictamente NOT NULL en ambas tablas
ALTER TABLE public.categories ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.brands ALTER COLUMN company_id SET NOT NULL;

-- 1.2 En public.categories: Reemplazar unicidad global por unicidad por empresa
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_code_key;
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_slug_key;

ALTER TABLE public.categories 
    ADD CONSTRAINT categories_company_id_code_key UNIQUE (company_id, code);

ALTER TABLE public.categories 
    ADD CONSTRAINT categories_company_id_slug_key UNIQUE (company_id, slug);

-- 1.3 En public.brands: Reemplazar unicidad global por unicidad por empresa
ALTER TABLE public.brands DROP CONSTRAINT IF EXISTS brands_name_key;
ALTER TABLE public.brands DROP CONSTRAINT IF EXISTS brands_slug_key;

ALTER TABLE public.brands 
    ADD CONSTRAINT brands_company_id_name_key UNIQUE (company_id, name);

ALTER TABLE public.brands 
    ADD CONSTRAINT brands_company_id_slug_key UNIQUE (company_id, slug);

-- ------------------------------------------------------------------------------
-- 2. INTEGRIDAD REFERENCIAL MULTIEMPRESA PARA parent_id EN CATEGORÍAS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_validate_category_parent_tenant()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.parent_id IS NOT NULL THEN
        -- 1. Prevenir que sea su propio padre (auto-referencia cíclica)
        IF NEW.id IS NOT NULL AND NEW.parent_id = NEW.id THEN
            RAISE EXCEPTION 'Una categoría no puede ser su propia categoría padre.'
                USING ERRCODE = '22000';
        END IF;

        -- 2. Garantizar que la categoría padre exista y pertenezca estrictamente a la misma empresa
        IF NOT EXISTS (
            SELECT 1 FROM public.categories
            WHERE id = NEW.parent_id AND company_id = NEW.company_id
        ) THEN
            RAISE EXCEPTION 'Violación multiempresa: La categoría padre debe pertenecer a la misma empresa.'
                USING ERRCODE = '23503';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.fn_validate_category_parent_tenant() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_validate_category_parent_tenant() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_validate_category_parent ON public.categories;
CREATE TRIGGER trg_validate_category_parent
BEFORE INSERT OR UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.fn_validate_category_parent_tenant();

-- ------------------------------------------------------------------------------
-- 3. AUDITORÍA AUTOMÁTICA SECURITY DEFINER PARA CATEGORÍAS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_audit_categories()
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
        v_action := 'CATEGORY_CREATED';
        v_company_id := NEW.company_id;
        v_prev := NULL;
        v_new := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_company_id := NEW.company_id;
        v_prev := to_jsonb(OLD);
        v_new := to_jsonb(NEW);

        -- Distinguir transición de estados (Activar / Desactivar / Edición general)
        IF (OLD.is_active IS DISTINCT FROM NEW.is_active) AND NEW.is_active = false THEN
            v_action := 'CATEGORY_DEACTIVATED';
        ELSIF (OLD.is_active IS DISTINCT FROM NEW.is_active) AND NEW.is_active = true THEN
            v_action := 'CATEGORY_ACTIVATED';
        ELSE
            v_action := 'CATEGORY_UPDATED';
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'CATEGORY_DELETED';
        v_company_id := OLD.company_id;
        v_prev := to_jsonb(OLD);
        v_new := NULL;
    END IF;

    -- Inserción fiduciaria en public.audit_logs
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
        'categories',
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

REVOKE ALL ON FUNCTION public.fn_audit_categories() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_audit_categories() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_audit_categories ON public.categories;
CREATE TRIGGER trg_audit_categories
AFTER INSERT OR UPDATE OR DELETE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_categories();

-- ------------------------------------------------------------------------------
-- 4. AUDITORÍA AUTOMÁTICA SECURITY DEFINER PARA MARCAS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_audit_brands()
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
        v_action := 'BRAND_CREATED';
        v_company_id := NEW.company_id;
        v_prev := NULL;
        v_new := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_company_id := NEW.company_id;
        v_prev := to_jsonb(OLD);
        v_new := to_jsonb(NEW);

        -- Distinguir transición de estados (Activar / Desactivar / Edición general)
        IF (OLD.is_active IS DISTINCT FROM NEW.is_active) AND NEW.is_active = false THEN
            v_action := 'BRAND_DEACTIVATED';
        ELSIF (OLD.is_active IS DISTINCT FROM NEW.is_active) AND NEW.is_active = true THEN
            v_action := 'BRAND_ACTIVATED';
        ELSE
            v_action := 'BRAND_UPDATED';
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'BRAND_DELETED';
        v_company_id := OLD.company_id;
        v_prev := to_jsonb(OLD);
        v_new := NULL;
    END IF;

    -- Inserción fiduciaria en public.audit_logs
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
        'brands',
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

REVOKE ALL ON FUNCTION public.fn_audit_brands() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_audit_brands() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_audit_brands ON public.brands;
CREATE TRIGGER trg_audit_brands
AFTER INSERT OR UPDATE OR DELETE ON public.brands
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_brands();
