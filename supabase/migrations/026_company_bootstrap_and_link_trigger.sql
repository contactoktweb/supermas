-- ==============================================================================
-- MIGRACIÓN 026: VINCULACIÓN AUTOMÁTICA SUPERADMIN A EMPRESA Y ACCESO BOOTSTRAP
-- ==============================================================================
-- Permite que durante el proceso de onboarding del primer SUPERADMIN:
-- 1. Si no tiene company_id asignado, pueda consultar si ya existe una empresa
--    para evitar duplicidades accidentales.
-- 2. Al crear la empresa en public.companies, un trigger fiduciario
--    actualiza automáticamente public.users.company_id = NEW.id para ese SUPERADMIN.
-- ==============================================================================

-- 1. Función y trigger para vincular automáticamente al superadmin creador
CREATE OR REPLACE FUNCTION public.fn_on_company_created_link_superadmin()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.uid() IS NOT NULL AND public.is_admin() AND public.get_auth_company_id() IS NULL THEN
        UPDATE public.users
        SET company_id = NEW.id,
            updated_at = NOW()
        WHERE id = auth.uid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

DROP TRIGGER IF EXISTS trg_link_superadmin_on_company_create ON public.companies;
CREATE TRIGGER trg_link_superadmin_on_company_create
AFTER INSERT ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.fn_on_company_created_link_superadmin();

-- 2. Política SELECT refinada para permitir consulta durante onboarding del superadmin
DROP POLICY IF EXISTS "Tenant isolation select company" ON public.companies;
CREATE POLICY "Tenant isolation select company" ON public.companies
FOR SELECT TO authenticated
USING (
    id = public.get_auth_company_id()
    OR (public.get_auth_company_id() IS NULL AND public.is_admin())
);
