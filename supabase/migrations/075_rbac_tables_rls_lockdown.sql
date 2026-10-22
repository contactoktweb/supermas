-- ==============================================================================
-- 075_RBAC_TABLES_RLS_LOCKDOWN.sql
-- ERP SUPER MÁS S.A.S. - Cierre de escritura sobre las tablas del RBAC
--
-- roles, permissions y role_permissions no tenían RLS y conservaban los permisos por
-- defecto de Supabase: cualquier cliente con la anon key podía insertar en
-- role_permissions o cambiar roles, es decir, otorgarse todos los permisos.
-- Desde ahora solo se leen (usuarios autenticados); la escritura queda para el
-- servidor (service_role) y las migraciones. No modifica roles, permisos ni usuarios.
-- Se puede re-ejecutar.
-- ==============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.roles, public.permissions, public.role_permissions
  FROM PUBLIC, anon, authenticated;
REVOKE SELECT ON public.roles, public.permissions, public.role_permissions FROM anon;
GRANT SELECT ON public.roles, public.permissions, public.role_permissions TO authenticated;
GRANT ALL ON public.roles, public.permissions, public.role_permissions TO service_role;

-- El catálogo de roles y permisos es de solo lectura para cualquier usuario autenticado:
-- la app lo usa para resolver el perfil y los permisos del usuario.
DROP POLICY IF EXISTS "RBAC read roles" ON public.roles;
CREATE POLICY "RBAC read roles" ON public.roles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "RBAC read permissions" ON public.permissions;
CREATE POLICY "RBAC read permissions" ON public.permissions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "RBAC read role_permissions" ON public.role_permissions;
CREATE POLICY "RBAC read role_permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

COMMIT;
