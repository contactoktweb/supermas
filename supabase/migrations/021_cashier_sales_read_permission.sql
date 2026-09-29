-- ==============================================================================
-- 021_CASHIER_SALES_READ_PERMISSION.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Otorgar permiso sales.read al rol CASHIER para consulta y emisión en terminal POS
-- ==============================================================================

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'CASHIER'
  AND p.code = 'sales.read'
ON CONFLICT DO NOTHING;
