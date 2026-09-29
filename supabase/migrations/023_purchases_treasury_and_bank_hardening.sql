-- ==============================================================================
-- 023_PURCHASES_TREASURY_AND_BANK_HARDENING.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Hardening para Módulos de Compras, Tesorería, Cuentas Bancarias y RBAC
-- ==============================================================================

-- 1. ASIGNAR PERMISO suppliers.read AL ROL ACCOUNTANT
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'ACCOUNTANT'
  AND p.code = 'suppliers.read'
ON CONFLICT DO NOTHING;

-- 2. POLÍTICAS RLS MULTI-TENANT PARA CUENTAS BANCARIAS (bank_accounts)
DROP POLICY IF EXISTS bank_accounts_policy ON public.bank_accounts;
DROP POLICY IF EXISTS "Tenant isolation select bank_accounts" ON public.bank_accounts;
CREATE POLICY "Tenant isolation select bank_accounts" ON public.bank_accounts
FOR SELECT TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.has_permission('treasury.read') OR public.get_auth_role() = 'ACCOUNTANT')
    AND (location_id IS NULL OR public.has_location_access(location_id) OR public.is_admin())
);

DROP POLICY IF EXISTS "Tenant isolation insert bank_accounts" ON public.bank_accounts;
CREATE POLICY "Tenant isolation insert bank_accounts" ON public.bank_accounts
FOR INSERT TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.get_auth_role() = 'ACCOUNTANT' OR public.has_permission('treasury.create'))
);

DROP POLICY IF EXISTS "Tenant isolation update bank_accounts" ON public.bank_accounts;
CREATE POLICY "Tenant isolation update bank_accounts" ON public.bank_accounts
FOR UPDATE TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.get_auth_role() = 'ACCOUNTANT' OR public.has_permission('treasury.create'))
)
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.get_auth_role() = 'ACCOUNTANT' OR public.has_permission('treasury.create'))
);

DROP POLICY IF EXISTS "Tenant isolation delete bank_accounts" ON public.bank_accounts;
CREATE POLICY "Tenant isolation delete bank_accounts" ON public.bank_accounts
FOR DELETE TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND public.is_admin()
);

-- 3. POLÍTICAS RLS MULTI-TENANT PARA MOVIMIENTOS BANCARIOS (bank_movements)
DROP POLICY IF EXISTS bank_movements_policy ON public.bank_movements;
DROP POLICY IF EXISTS "Tenant isolation select bank_movements" ON public.bank_movements;
CREATE POLICY "Tenant isolation select bank_movements" ON public.bank_movements
FOR SELECT TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.has_permission('treasury.read') OR public.get_auth_role() = 'ACCOUNTANT')
    AND (location_id IS NULL OR public.has_location_access(location_id) OR public.is_admin())
);

DROP POLICY IF EXISTS "Tenant isolation insert bank_movements" ON public.bank_movements;
CREATE POLICY "Tenant isolation insert bank_movements" ON public.bank_movements
FOR INSERT TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.get_auth_role() = 'ACCOUNTANT' OR public.has_permission('treasury.create'))
);

-- 4. POLÍTICA UPDATE PARA PAGOS DE TESORERÍA (treasury_payments)
DROP POLICY IF EXISTS "Tenant isolation update treasury_payments" ON public.treasury_payments;
CREATE POLICY "Tenant isolation update treasury_payments" ON public.treasury_payments
FOR UPDATE TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.has_permission('treasury.create') OR public.get_auth_role() = 'ACCOUNTANT')
)
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.has_permission('treasury.create') OR public.get_auth_role() = 'ACCOUNTANT')
);

-- 5. INMUTABILIDAD DE PAGOS DESEMBOLSADOS EN TESORERÍA
CREATE OR REPLACE FUNCTION public.fn_prevent_paid_payment_deletion()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF OLD.status = 'PAID' THEN
        RAISE EXCEPTION 'Tesorería inmutable: No está permitido eliminar comprobantes de pago ya desembolsados (Pago: %). Las reversiones deben tramitarse mediante anulación contable.',
            OLD.payment_number
            USING ERRCODE = '23506';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION public.fn_prevent_paid_payment_deletion() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prevent_paid_payment_deletion ON public.treasury_payments;
CREATE TRIGGER trg_prevent_paid_payment_deletion
BEFORE DELETE ON public.treasury_payments
FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_paid_payment_deletion();
