-- ==============================================================================
-- 036_cleanup_duplicate_sale_items_policies.sql
-- Eliminación de políticas RLS duplicadas en sale_items (Supabase Advisor 0024)
-- ERP SUPER MÁS S.A.S.
-- ==============================================================================

-- Eliminar políticas permisivas heredadas de la migración inicial 001
-- que no incluían la validación estricta de company_id
DROP POLICY IF EXISTS "Users can insert sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Users can view sale items of their sales" ON public.sale_items;

-- Las políticas fiduciarias y herméticas vigentes son:
-- 'Tenant isolation insert sale_items' (con verificación de company_id y location_access)
-- 'Tenant isolation select sale_items' (con verificación de company_id y location_access)
