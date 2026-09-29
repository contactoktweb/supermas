-- ==============================================================================
-- 020_GRANULAR_INVENTORY_MOVEMENT_RLS.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Validación granular por tipo de movimiento en la política INSERT de inventory_movements
-- ==============================================================================

DROP POLICY IF EXISTS "Tenant isolation insert movements" ON public.inventory_movements;

CREATE POLICY "Tenant isolation insert movements" ON public.inventory_movements
FOR INSERT TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id() 
    AND (public.has_location_access(location_id) OR public.is_admin())
    AND (
        public.is_admin()
        OR (movement_type IN ('POSITIVE_ADJUSTMENT', 'NEGATIVE_ADJUSTMENT') AND public.has_permission('inventory.adjust'))
        OR (movement_type IN ('TRANSFER_IN', 'TRANSFER_OUT') AND public.has_permission('inventory.transfer'))
        OR (movement_type = 'PURCHASE_ENTRY' AND public.has_permission('purchases.create'))
        OR (movement_type IN ('SALE_OUT', 'CUSTOMER_RETURN') AND public.has_permission('sales.create'))
        OR (movement_type = 'SUPPLIER_RETURN' AND (public.has_permission('purchases.create') OR public.has_permission('inventory.adjust')))
    )
);
