-- ==============================================================================
-- 027_LOCATIONS_AUDIT_TRIGGER.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Trigger de auditoría automática SECURITY DEFINER para public.locations
-- Inmutable, multi-inquilino y protegido contra manipulación desde clientes.
-- ==============================================================================

-- 1. Función de auditoría automática para locations
CREATE OR REPLACE FUNCTION public.fn_audit_locations()
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
        v_action := 'LOCATION_CREATED';
        v_company_id := NEW.company_id;
        v_prev := NULL;
        v_new := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_company_id := NEW.company_id;
        v_prev := to_jsonb(OLD);
        v_new := to_jsonb(NEW);

        -- Distinguir transición de estados (Activar / Desactivar / Edición general)
        IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status = 'INACTIVE' THEN
            v_action := 'LOCATION_DEACTIVATED';
        ELSIF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status = 'ACTIVE' THEN
            v_action := 'LOCATION_ACTIVATED';
        ELSE
            v_action := 'LOCATION_UPDATED';
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'LOCATION_DELETED';
        v_company_id := OLD.company_id;
        v_prev := to_jsonb(OLD);
        v_new := NULL;
    END IF;

    -- Inserción fiduciaria en public.audit_logs
    -- Nota: location_id se mantiene NULL porque la entidad auditada es la propia 'locations' (almacenada en entity_id).
    -- Esto previene que una cascada ON DELETE SET NULL intente mutar audit_logs protegida por trg_prevent_audit_log_mutation.
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
        'WAREHOUSES',
        'locations',
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

-- 2. Restringir permisos de ejecución (Función de trigger no invocable directamente por anon)
REVOKE ALL ON FUNCTION public.fn_audit_locations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_audit_locations() TO authenticated, service_role;

-- 3. Crear el trigger sobre public.locations
DROP TRIGGER IF EXISTS trg_audit_locations ON public.locations;
CREATE TRIGGER trg_audit_locations
AFTER INSERT OR UPDATE OR DELETE ON public.locations
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_locations();
