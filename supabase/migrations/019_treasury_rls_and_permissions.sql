-- ==============================================================================
-- 019_TREASURY_RLS_AND_PERMISSIONS.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Aislamiento Multi-Tenant y Permisos RBAC para el Módulo de Tesorería
-- ==============================================================================

-- 1. Registrar permisos atómicos de tesorería
INSERT INTO public.permissions (code, module, description)
VALUES 
    ('treasury.read', 'treasury', 'Consultar dispersión de pagos y recaudos de tesorería'),
    ('treasury.create', 'treasury', 'Registrar dispersión de pagos y recaudos de tesorería')
ON CONFLICT (code) DO NOTHING;

-- 2. Asignar permisos a roles SUPERADMIN, ADMIN y ACCOUNTANT
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code IN ('SUPERADMIN', 'ADMIN', 'ACCOUNTANT')
  AND p.code IN ('treasury.read', 'treasury.create')
ON CONFLICT DO NOTHING;

-- 3. Políticas RLS para treasury_payments (Pagos)
DROP POLICY IF EXISTS treasury_payments_policy ON public.treasury_payments;
DROP POLICY IF EXISTS "Tenant isolation select treasury_payments" ON public.treasury_payments;
CREATE POLICY "Tenant isolation select treasury_payments" ON public.treasury_payments
FOR SELECT TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.has_permission('treasury.read') OR public.get_auth_role() = 'ACCOUNTANT')
);

DROP POLICY IF EXISTS "Tenant isolation insert treasury_payments" ON public.treasury_payments;
CREATE POLICY "Tenant isolation insert treasury_payments" ON public.treasury_payments
FOR INSERT TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.has_permission('treasury.create') OR public.get_auth_role() = 'ACCOUNTANT')
);

-- 4. Políticas RLS para treasury_receipts (Recaudos)
DROP POLICY IF EXISTS treasury_receipts_policy ON public.treasury_receipts;
DROP POLICY IF EXISTS "Tenant isolation select treasury_receipts" ON public.treasury_receipts;
CREATE POLICY "Tenant isolation select treasury_receipts" ON public.treasury_receipts
FOR SELECT TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.has_permission('treasury.read') OR public.get_auth_role() = 'ACCOUNTANT')
);

DROP POLICY IF EXISTS "Tenant isolation insert treasury_receipts" ON public.treasury_receipts;
CREATE POLICY "Tenant isolation insert treasury_receipts" ON public.treasury_receipts
FOR INSERT TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.has_permission('treasury.create') OR public.get_auth_role() = 'ACCOUNTANT')
);
