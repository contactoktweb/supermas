-- ==============================================================================
-- 015_SECURITY_DEFINER_HARDENING.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Hardening y restricción estricta de privilegios para funciones SECURITY DEFINER
-- ==============================================================================

-- 1. SEARCH_PATH HARDENING
-- Garantizar search_path inmutable para el trigger de cálculo de inventario Kardex
ALTER FUNCTION public.process_inventory_movement() SET search_path = public, pg_catalog;

-- 2. REVOCACIÓN TOTAL EN FUNCIONES DE TIPO TRIGGER
-- Los triggers no deben ser invocables vía RPC ni directa desde la API pública.
-- Su ejecución queda restringida a eventos del motor (postgres / triggers de sistema).
REVOKE ALL ON FUNCTION public.process_inventory_movement() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

-- 3. RESTRICCIÓN DE PRIVILEGIOS EN FUNCIONES RBAC AUXILIARES
-- Revocar privilegios implícitos a PUBLIC y anon.
-- Otorgar EXECUTE exclusivamente a authenticated y service_role para evaluación en políticas RLS.

-- get_auth_company_id()
REVOKE ALL ON FUNCTION public.get_auth_company_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_company_id() TO authenticated, service_role;

-- get_auth_role()
REVOKE ALL ON FUNCTION public.get_auth_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO authenticated, service_role;

-- is_admin()
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- has_permission(character varying)
REVOKE ALL ON FUNCTION public.has_permission(character varying) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(character varying) TO authenticated, service_role;

-- has_any_permission(character varying[])
REVOKE ALL ON FUNCTION public.has_any_permission(character varying[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_any_permission(character varying[]) TO authenticated, service_role;

-- has_location_access(uuid)
REVOKE ALL ON FUNCTION public.has_location_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_location_access(uuid) TO authenticated, service_role;
