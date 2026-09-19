-- ==============================================================================
-- 009_RLS_POLICIES.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- ==============================================================================

-- 1. Activar Row Level Security en todas las tablas operativas
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remission_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.electronic_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 2. Funciones auxiliares de seguridad (Contexto del usuario autenticado)
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS VARCHAR AS $$
    SELECT r.code
    FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT public.get_auth_role() = 'SUPERADMIN';
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_location_access(p_location_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_locations ul
        WHERE ul.user_id = auth.uid() AND ul.location_id = p_location_id
    ) OR public.is_admin();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 3. Políticas para Administrador General (SUPERADMIN ve y gestiona todo)
CREATE POLICY "Superadmin full access companies" ON public.companies FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Superadmin full access locations" ON public.locations FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Superadmin full access products" ON public.products FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Superadmin full access stock" ON public.stock_levels FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Superadmin full access sales" ON public.sales FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Superadmin full access purchases" ON public.purchases FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Superadmin full access accounting" ON public.accounting_entries FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Superadmin full access audit" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin());

-- 4. Políticas para Usuarios Operativos (Cajeros, Bodegueros y Vendedores por Sede)
-- Lectura de productos y categorías (todos los usuarios autenticados)
CREATE POLICY "Authenticated users can read categories" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read brands" ON public.brands FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read products" ON public.products FOR SELECT TO authenticated USING (is_active = true OR public.is_admin());

-- Lectura de existencias restringida a sedes autorizadas
CREATE POLICY "Users can view stock of their authorized locations"
ON public.stock_levels FOR SELECT TO authenticated
USING (public.has_location_access(location_id));

-- Ventas y POS: Cajeros y vendedores solo interactúan con su sede asignada
CREATE POLICY "Users can create sales in their location"
ON public.sales FOR INSERT TO authenticated
WITH CHECK (public.has_location_access(location_id));

CREATE POLICY "Users can view sales of their location"
ON public.sales FOR SELECT TO authenticated
USING (public.has_location_access(location_id));

-- Inserción de líneas de venta vinculada a ventas válidas
CREATE POLICY "Users can insert sale items"
ON public.sale_items FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.sales s
        WHERE s.id = sale_id AND public.has_location_access(s.location_id)
    )
);

CREATE POLICY "Users can view sale items of their sales"
ON public.sale_items FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.sales s
        WHERE s.id = sale_id AND public.has_location_access(s.location_id)
    )
);

-- Auditoría: Inserción permitida a usuarios autenticados, lectura exclusiva a administradores
CREATE POLICY "Allow authenticated users to insert audit log"
ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR public.is_admin());
