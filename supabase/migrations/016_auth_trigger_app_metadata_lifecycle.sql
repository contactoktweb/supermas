-- ==============================================================================
-- 016_AUTH_TRIGGER_APP_METADATA_LIFECYCLE.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Escuchar eventos AFTER INSERT OR UPDATE OF raw_app_meta_data en auth.users
-- y eliminar reglas reescritura obsoletas en audit_logs para permitir integridad referencial estándar
-- ==============================================================================

-- 1. Eliminar reglas de reescritura (RULES) obsoletas en audit_logs.
-- Las reglas DO INSTEAD NOTHING rompen las comprobaciones de integridad referencial en PostgreSQL (código XX000).
-- La inmutabilidad de audit_logs ya está garantizada por el trigger trg_prevent_audit_log_mutation (BEFORE UPDATE OR DELETE).
DROP RULE IF EXISTS no_delete_audit_logs ON public.audit_logs;
DROP RULE IF EXISTS no_update_audit_logs ON public.audit_logs;

-- 2. Actualizar handle_new_auth_user() para persistir role_id fiduciario ante cambios de raw_app_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    target_role_id UUID;
    v_company_id UUID := NULL;
    v_is_bootstrap BOOLEAN := false;
    v_app_role VARCHAR := NULL;
    v_existing_superadmins INT := 0;
BEGIN
    -- Bloqueo transaccional exclusivo para serializar intentos de registro concurrentes
    PERFORM pg_advisory_xact_lock(742918471);

    -- Extraer metadatos fiduciarios de raw_app_meta_data (Solo administrables por service_role)
    IF NEW.raw_app_meta_data IS NOT NULL THEN
        v_is_bootstrap := COALESCE((NEW.raw_app_meta_data->>'is_bootstrap_admin')::boolean, false);
        v_app_role := NEW.raw_app_meta_data->>'role';

        IF NEW.raw_app_meta_data->>'company_id' IS NOT NULL THEN
            BEGIN
                v_company_id := (NEW.raw_app_meta_data->>'company_id')::uuid;
            EXCEPTION WHEN OTHERS THEN
                v_company_id := NULL;
            END;
        END IF;
    END IF;

    -- Conteo bajo lock de superadministradores existentes (excluyendo al propio usuario si ya existe)
    SELECT COUNT(*) INTO v_existing_superadmins
    FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE r.code = 'SUPERADMIN' AND u.id <> NEW.id;

    IF v_is_bootstrap = true AND v_app_role = 'SUPERADMIN' AND v_existing_superadmins = 0 THEN
        -- BOOTSTRAP DEL PRIMER SUPERADMINISTRADOR:
        -- Solo se promueve a SUPERADMIN si:
        -- a) Se especificó en raw_app_meta_data por el servidor (service_role).
        -- b) Cero superadministradores existían previamente.
        SELECT id INTO target_role_id FROM public.roles WHERE code = 'SUPERADMIN';
    ELSIF v_app_role IS NOT NULL AND v_app_role <> 'SUPERADMIN' THEN
        -- Asignación de rol operativo autorizada por el backend
        SELECT id INTO target_role_id FROM public.roles WHERE code = v_app_role;
        IF target_role_id IS NULL THEN
            SELECT id INTO target_role_id FROM public.roles WHERE code = 'SELLER';
        END IF;
    ELSE
        -- Rol restrictivo por defecto. NUNCA SUPERADMIN vía cliente.
        SELECT id INTO target_role_id FROM public.roles WHERE code = 'SELLER';
    END IF;

    -- Inserción / sincronización fiduciaria en public.users vinculada a auth.users(id)
    INSERT INTO public.users (
        id,
        company_id,
        email,
        full_name,
        role_id,
        phone,
        avatar_url,
        is_active
    ) VALUES (
        NEW.id,
        v_company_id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        target_role_id,
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'avatar_url',
        true
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role_id = EXCLUDED.role_id,
        company_id = COALESCE(public.users.company_id, EXCLUDED.company_id),
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. El trigger debe escuchar tanto INSERT como UPDATE de raw_app_meta_data
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT OR UPDATE OF raw_app_meta_data ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user();

-- 4. Hardening de privilegios EXECUTE
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
