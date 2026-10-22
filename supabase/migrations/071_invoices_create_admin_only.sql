-- ==============================================================================
-- 071_INVOICES_CREATE_ADMIN_ONLY.sql
-- ERP SUPER MÁS S.A.S. - Emisión de factura electrónica solo por administradores
--
-- Decisión del dueño (2026-10-21): solo el rol ADMIN emite factura electrónica
-- (SUPERADMIN también, por is_admin()). Se retira el permiso invoices.create de los
-- demás roles; hoy lo tenían los roles heredados CASHIER y POINT_ADMIN.
-- No modifica usuarios ni elimina roles. Se puede re-ejecutar.
-- ==============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

DELETE FROM public.role_permissions rp
USING public.roles r, public.permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND p.code = 'invoices.create'
  AND r.code NOT IN ('ADMIN', 'SUPERADMIN');

COMMIT;
