-- ==============================================================================
-- 076_USERS_PRIVILEGE_GUARD.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Guarda de privilegios sobre public.users para sesiones del navegador (PostgREST).
--
-- Problema (auditoría C2):
--   Las políticas "Tenant isolation insert/update users" (025) solo exigen la misma empresa y
--   users.create / users.update / users.activate. Cualquier rol con esos permisos (p. ej.
--   RECURSOS_HUMANOS) podía, desde el navegador:
--     - ponerse role_id = ADMIN o asignarlo a otro / crear usuarios ADMIN;
--     - degradar o desactivar a un SUPERADMIN o a un ADMIN;
--     - cambiar su propio rol, estado o empresa.
--
-- Cambio (sin reconstruir el RBAC, sin tocar políticas ni filas):
--   Trigger BEFORE INSERT OR UPDATE en public.users que solo actúa cuando la sentencia la
--   ejecuta directamente el rol `authenticated` o `anon` (API REST con el JWT del usuario).
--   service_role, postgres, supabase_auth_admin y las funciones SECURITY DEFINER (en las que
--   current_user es el propietario) son contexto de servidor confiable y no se ven afectados:
--   el alta y la administración de usuarios pasan por /api/users (service_role), que aplica la
--   matriz de asignación de roles y valida permisos.
--
--   Reglas para `authenticated` / `anon`:
--     - anon o sesión sin auth.uid(): rechazado.
--     - INSERT: solo un administrador (is_admin()); nunca con rol SUPERADMIN; solo en su empresa.
--     - UPDATE: nadie cambia id ni company_id.
--     - Sobre su propia fila: no puede cambiar role_id ni is_active (sí datos de perfil y
--       last_login_at).
--     - Sobre la fila de OTRO usuario:
--         * una cuenta SUPERADMIN no se modifica desde el navegador;
--         * nadie asigna SUPERADMIN;
--         * solo un administrador cambia role_id;
--         * solo un administrador modifica (incluye activar/desactivar) una cuenta ADMIN o
--           asigna el rol ADMIN.
--
-- Datos: no modifica filas. Los SUPERADMIN existentes no cambian.
-- Re-ejecutable: CREATE OR REPLACE + DROP TRIGGER IF EXISTS dentro de una transacción.
-- Rollback:
--   DROP TRIGGER IF EXISTS trg_users_privilege_guard ON public.users;
--   DROP FUNCTION IF EXISTS public.fn_guard_users_privileges();
-- ==============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL search_path = pg_catalog, public;

-- SECURITY INVOKER a propósito: current_user debe reflejar el rol que ejecuta la sentencia
-- (authenticated/anon frente a service_role o el propietario de una función SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.fn_guard_users_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_actor UUID;
    v_actor_is_admin BOOLEAN;
    v_actor_company UUID;
    v_superadmin_role UUID;
    v_admin_role UUID;
    v_old_is_superadmin BOOLEAN;
    v_touches_admin BOOLEAN;
BEGIN
    IF current_user NOT IN ('authenticated', 'anon') THEN
        RETURN NEW;
    END IF;

    v_actor := auth.uid();
    IF current_user = 'anon' OR v_actor IS NULL THEN
        RAISE EXCEPTION 'Acceso denegado: operación no permitida sobre usuarios.'
            USING ERRCODE = '42501';
    END IF;

    v_actor_is_admin := COALESCE(public.is_admin(), false);
    v_actor_company := public.get_auth_company_id();

    SELECT r.id INTO v_superadmin_role FROM public.roles r WHERE r.code = 'SUPERADMIN';
    SELECT r.id INTO v_admin_role FROM public.roles r WHERE r.code = 'ADMIN';

    IF TG_OP = 'INSERT' THEN
        IF NOT v_actor_is_admin THEN
            RAISE EXCEPTION 'Acceso denegado: solo un administrador puede registrar usuarios y asignar roles.'
                USING ERRCODE = '42501';
        END IF;
        IF v_superadmin_role IS NOT NULL AND NEW.role_id = v_superadmin_role THEN
            RAISE EXCEPTION 'Acceso denegado: el rol SUPERADMIN no se asigna desde la aplicación.'
                USING ERRCODE = '42501';
        END IF;
        IF v_actor_company IS NULL OR NEW.company_id IS DISTINCT FROM v_actor_company THEN
            RAISE EXCEPTION 'Acceso denegado: el usuario debe pertenecer a su empresa.'
                USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
    END IF;

    -- UPDATE
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.company_id IS DISTINCT FROM OLD.company_id THEN
        RAISE EXCEPTION 'Acceso denegado: no se puede cambiar la identidad ni la empresa de un usuario.'
            USING ERRCODE = '42501';
    END IF;

    IF OLD.id = v_actor THEN
        IF NEW.role_id IS DISTINCT FROM OLD.role_id OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
            RAISE EXCEPTION 'Acceso denegado: no puede cambiar su propio rol ni su estado.'
                USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
    END IF;

    v_old_is_superadmin := v_superadmin_role IS NOT NULL AND OLD.role_id = v_superadmin_role;
    IF v_old_is_superadmin THEN
        RAISE EXCEPTION 'Acceso denegado: las cuentas SUPERADMIN no se modifican desde la aplicación.'
            USING ERRCODE = '42501';
    END IF;

    IF v_superadmin_role IS NOT NULL AND NEW.role_id = v_superadmin_role THEN
        RAISE EXCEPTION 'Acceso denegado: el rol SUPERADMIN no se asigna desde la aplicación.'
            USING ERRCODE = '42501';
    END IF;

    IF NEW.role_id IS DISTINCT FROM OLD.role_id AND NOT v_actor_is_admin THEN
        RAISE EXCEPTION 'Acceso denegado: solo un administrador puede cambiar el rol de un usuario.'
            USING ERRCODE = '42501';
    END IF;

    v_touches_admin := v_admin_role IS NOT NULL
        AND (OLD.role_id = v_admin_role OR NEW.role_id = v_admin_role);
    IF v_touches_admin AND NOT v_actor_is_admin THEN
        RAISE EXCEPTION 'Acceso denegado: solo un administrador puede modificar cuentas de administrador.'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_guard_users_privileges() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_users_privilege_guard ON public.users;
CREATE TRIGGER trg_users_privilege_guard
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_users_privileges();

COMMIT;
