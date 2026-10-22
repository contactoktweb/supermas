-- ==============================================================================
-- 074_MUST_CHANGE_PASSWORD_RLS_GUARD.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- La bandera must_change_password (063) también bloquea las consultas directas a
-- PostgREST/RLS, no solo las páginas y Route Handlers.
--
-- Contexto:
--   - El middleware y requireServerUser() ya bloquean el ERP mientras el JWT trae
--     app_metadata.must_change_password = true. Las consultas que el navegador hace
--     directo a Supabase solo pasan por RLS, que no revisaba la bandera.
--   - app_metadata solo se escribe con service_role y viaja firmado en el JWT.
--
-- Cambio (sin reconstruir el RBAC, mismas firmas y mismos permisos EXECUTE):
--   - Nueva public.auth_password_change_pending(): true si el JWT de la petición trae
--     app_metadata.must_change_password = true. Sin JWT (service_role, cron, triggers
--     del servidor) devuelve false.
--   - get_auth_company_id() devuelve NULL, get_auth_role() NULL (=> is_admin() false),
--     y has_permission / has_any_permission / has_location_access devuelven false
--     mientras la bandera esté activa. Toda política por empresa/permiso niega el acceso.
--
-- Lo que sigue funcionando con la bandera activa:
--   - Login y carga del perfil propio: las políticas de users/user_locations permiten
--     id = auth.uid() / user_id = auth.uid() sin pasar por estas funciones.
--   - /api/auth/cambiar-contrasena: cambia la contraseña con GoTrue y quita la bandera con
--     service_role; luego el cliente refresca la sesión y obtiene un JWT sin la bandera.
--
-- Datos: no modifica filas. Los usuarios sin la bandera (incluidos los SUPERADMIN) no
-- cambian de comportamiento.
--
-- Re-ejecutable: CREATE OR REPLACE con las mismas firmas, dentro de una transacción.
-- Rollback: volver a ejecutar las definiciones de 014 (get_auth_company_id, get_auth_role,
-- has_permission, has_any_permission, has_location_access) y
-- DROP FUNCTION public.auth_password_change_pending().
-- ==============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- 1. Detector de la bandera en el JWT de la petición
CREATE OR REPLACE FUNCTION public.auth_password_change_pending()
RETURNS BOOLEAN AS $$
    SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'must_change_password', 'false') = 'true';
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.auth_password_change_pending() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_password_change_pending() TO authenticated, service_role;

-- 2. Funciones RBAC auxiliares con la guarda (cuerpos de 014 + condición de la bandera)
CREATE OR REPLACE FUNCTION public.get_auth_company_id()
RETURNS UUID AS $$
    SELECT u.company_id
    FROM public.users u
    WHERE u.id = auth.uid()
      AND NOT public.auth_password_change_pending();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog;

-- is_admin() (057) se basa en get_auth_role(): queda en false sin redefinirla.
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS VARCHAR AS $$
    SELECT r.code
    FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
      AND NOT public.auth_password_change_pending();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog;

CREATE OR REPLACE FUNCTION public.has_permission(p_permission_code VARCHAR)
RETURNS BOOLEAN AS $$
    SELECT NOT public.auth_password_change_pending()
       AND (
            EXISTS (
                SELECT 1
                FROM public.users u
                JOIN public.role_permissions rp ON u.role_id = rp.role_id
                JOIN public.permissions p ON rp.permission_id = p.id
                WHERE u.id = auth.uid()
                  AND p.code = p_permission_code
            )
            OR public.is_admin()
       );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog;

CREATE OR REPLACE FUNCTION public.has_any_permission(p_permission_codes VARCHAR[])
RETURNS BOOLEAN AS $$
    SELECT NOT public.auth_password_change_pending()
       AND (
            EXISTS (
                SELECT 1
                FROM public.users u
                JOIN public.role_permissions rp ON u.role_id = rp.role_id
                JOIN public.permissions p ON rp.permission_id = p.id
                WHERE u.id = auth.uid()
                  AND p.code = ANY(p_permission_codes)
            )
            OR public.is_admin()
       );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog;

CREATE OR REPLACE FUNCTION public.has_location_access(p_location_id UUID)
RETURNS BOOLEAN AS $$
    SELECT NOT public.auth_password_change_pending()
       AND (
            EXISTS (
                SELECT 1 FROM public.user_locations ul
                WHERE ul.user_id = auth.uid() AND ul.location_id = p_location_id
            )
            OR public.is_admin()
       );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog;

COMMIT;
