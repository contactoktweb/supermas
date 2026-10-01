-- ==============================================================================
-- 025_PRE_PRODUCTION_HARDENING.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL (Staging / Pre-Production)
-- ==============================================================================
-- OBJETIVO DE HARDENING Y COBERTURA FINAL:
-- 1. Habilitar políticas RLS para las 14 tablas que tenían RLS activado sin políticas.
-- 2. Habilitar RLS y políticas en tablas auxiliares (product_prices, supplier_payments, etc.).
-- 3. Blindar las 8 funciones financieras avanzadas de la migración 024 con SET search_path.
-- 4. Crear índices en 24 llaves foráneas de alto tráfico para evitar Sequential Scans y bloqueos.
-- 5. Preservar estricta separación de roles (SUPERADMIN, ADMIN, ACCOUNTANT, WAREHOUSE_ADMIN, SELLER, CASHIER).
-- ==============================================================================

-- ==============================================================================
-- 1. HABILITAR ROW LEVEL SECURITY EN TABLAS AUXILIARES
-- ==============================================================================
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dian_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exogena_formats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exogena_records ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 2. POLÍTICAS RLS: CATEGORÍAS Y MARCAS (CATÁLOGO PÚBLICO E INTERNO)
-- ==============================================================================
-- categories
DROP POLICY IF EXISTS "Tenant isolation select categories" ON public.categories;
CREATE POLICY "Tenant isolation select categories" ON public.categories
FOR SELECT TO authenticated
USING (company_id = public.get_auth_company_id());

DROP POLICY IF EXISTS "Tenant isolation insert categories" ON public.categories;
CREATE POLICY "Tenant isolation insert categories" ON public.categories
FOR INSERT TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.has_permission('products.create'))
);

DROP POLICY IF EXISTS "Tenant isolation update categories" ON public.categories;
CREATE POLICY "Tenant isolation update categories" ON public.categories
FOR UPDATE TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.has_permission('products.update'))
)
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.has_permission('products.update'))
);

DROP POLICY IF EXISTS "Tenant isolation delete categories" ON public.categories;
CREATE POLICY "Tenant isolation delete categories" ON public.categories
FOR DELETE TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.has_permission('products.delete'))
);

-- brands
DROP POLICY IF EXISTS "Tenant isolation select brands" ON public.brands;
CREATE POLICY "Tenant isolation select brands" ON public.brands
FOR SELECT TO authenticated
USING (company_id = public.get_auth_company_id());

DROP POLICY IF EXISTS "Tenant isolation insert brands" ON public.brands;
CREATE POLICY "Tenant isolation insert brands" ON public.brands
FOR INSERT TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.has_permission('products.create'))
);

DROP POLICY IF EXISTS "Tenant isolation update brands" ON public.brands;
CREATE POLICY "Tenant isolation update brands" ON public.brands
FOR UPDATE TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.has_permission('products.update'))
)
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.has_permission('products.update'))
);

DROP POLICY IF EXISTS "Tenant isolation delete brands" ON public.brands;
CREATE POLICY "Tenant isolation delete brands" ON public.brands
FOR DELETE TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.has_permission('products.delete'))
);

-- ==============================================================================
-- 3. POLÍTICAS RLS: USUARIOS Y ASIGNACIÓN DE SEDES (USERS Y USER_LOCATIONS)
-- ==============================================================================
-- users: Los usuarios pueden ver su propio registro o los de su empresa si tienen permiso users.read
DROP POLICY IF EXISTS "Tenant isolation select users" ON public.users;
CREATE POLICY "Tenant isolation select users" ON public.users
FOR SELECT TO authenticated
USING (
    id = auth.uid()
    OR (company_id = public.get_auth_company_id() AND (public.is_admin() OR public.has_permission('users.read')))
);

DROP POLICY IF EXISTS "Tenant isolation insert users" ON public.users;
CREATE POLICY "Tenant isolation insert users" ON public.users
FOR INSERT TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.has_permission('users.create'))
);

DROP POLICY IF EXISTS "Tenant isolation update users" ON public.users;
CREATE POLICY "Tenant isolation update users" ON public.users
FOR UPDATE TO authenticated
USING (
    id = auth.uid()
    OR (company_id = public.get_auth_company_id() AND (public.is_admin() OR public.has_permission('users.update') OR public.has_permission('users.activate')))
)
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.has_permission('users.update') OR public.has_permission('users.activate'))
);

-- user_locations
DROP POLICY IF EXISTS "Tenant isolation select user_locations" ON public.user_locations;
CREATE POLICY "Tenant isolation select user_locations" ON public.user_locations
FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR public.has_permission('users.read')
);

DROP POLICY IF EXISTS "Tenant isolation insert user_locations" ON public.user_locations;
CREATE POLICY "Tenant isolation insert user_locations" ON public.user_locations
FOR INSERT TO authenticated
WITH CHECK (
    public.is_admin()
    OR public.has_permission('users.create')
    OR public.has_permission('users.update')
);

DROP POLICY IF EXISTS "Tenant isolation update user_locations" ON public.user_locations;
CREATE POLICY "Tenant isolation update user_locations" ON public.user_locations
FOR UPDATE TO authenticated
USING (
    public.is_admin()
    OR public.has_permission('users.update')
)
WITH CHECK (
    public.is_admin()
    OR public.has_permission('users.update')
);

DROP POLICY IF EXISTS "Tenant isolation delete user_locations" ON public.user_locations;
CREATE POLICY "Tenant isolation delete user_locations" ON public.user_locations
FOR DELETE TO authenticated
USING (
    public.is_admin()
    OR public.has_permission('users.update')
);

-- ==============================================================================
-- 4. POLÍTICAS RLS: CAJAS, SESIONES Y MOVIMIENTOS DE CAJA (POS / CASH REGISTERS)
-- ==============================================================================
-- cash_registers
DROP POLICY IF EXISTS "Tenant isolation select cash_registers" ON public.cash_registers;
CREATE POLICY "Tenant isolation select cash_registers" ON public.cash_registers
FOR SELECT TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND (public.has_location_access(location_id) OR public.is_admin() OR public.has_permission('pos.cash_register'))
);

DROP POLICY IF EXISTS "Tenant isolation insert cash_registers" ON public.cash_registers;
CREATE POLICY "Tenant isolation insert cash_registers" ON public.cash_registers
FOR INSERT TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.has_permission('pos.cash_register'))
);

DROP POLICY IF EXISTS "Tenant isolation update cash_registers" ON public.cash_registers;
CREATE POLICY "Tenant isolation update cash_registers" ON public.cash_registers
FOR UPDATE TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.has_permission('pos.cash_register'))
)
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.has_permission('pos.cash_register'))
);

-- cash_sessions: Cajeros solo ven su sesión o administradores de la sede
DROP POLICY IF EXISTS "Tenant isolation select cash_sessions" ON public.cash_sessions;
CREATE POLICY "Tenant isolation select cash_sessions" ON public.cash_sessions
FOR SELECT TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND (user_id = auth.uid() OR public.has_location_access(location_id) OR public.is_admin() OR public.has_permission('pos.cash_register'))
);

DROP POLICY IF EXISTS "Tenant isolation insert cash_sessions" ON public.cash_sessions;
CREATE POLICY "Tenant isolation insert cash_sessions" ON public.cash_sessions
FOR INSERT TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (user_id = auth.uid() OR public.is_admin())
    AND (public.has_permission('pos.cash_register') OR public.has_permission('pos.access'))
);

DROP POLICY IF EXISTS "Tenant isolation update cash_sessions" ON public.cash_sessions;
CREATE POLICY "Tenant isolation update cash_sessions" ON public.cash_sessions
FOR UPDATE TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND (user_id = auth.uid() OR public.is_admin() OR public.has_permission('pos.cash_register'))
)
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (user_id = auth.uid() OR public.is_admin() OR public.has_permission('pos.cash_register'))
);

-- cash_movements (Arqueos, ingresos y egresos de caja)
DROP POLICY IF EXISTS "Tenant isolation select cash_movements" ON public.cash_movements;
CREATE POLICY "Tenant isolation select cash_movements" ON public.cash_movements
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.cash_sessions cs
        WHERE cs.id = session_id
          AND cs.company_id = public.get_auth_company_id()
          AND (cs.user_id = auth.uid() OR public.has_location_access(cs.location_id) OR public.is_admin() OR public.has_permission('pos.cash_register'))
    )
);

DROP POLICY IF EXISTS "Tenant isolation insert cash_movements" ON public.cash_movements;
CREATE POLICY "Tenant isolation insert cash_movements" ON public.cash_movements
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.cash_sessions cs
        WHERE cs.id = session_id
          AND cs.company_id = public.get_auth_company_id()
          AND (cs.user_id = auth.uid() OR public.is_admin())
          AND (public.has_permission('pos.cash_register') OR public.has_permission('pos.access'))
    )
);

-- ==============================================================================
-- 5. POLÍTICAS RLS: TRASLADOS Y REMISIONES LOGÍSTICAS (TRANSFERS Y REMISSIONS)
-- ==============================================================================
-- transfers
DROP POLICY IF EXISTS "Tenant isolation select transfers" ON public.transfers;
CREATE POLICY "Tenant isolation select transfers" ON public.transfers
FOR SELECT TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND (
        public.has_location_access(origin_location_id)
        OR public.has_location_access(destination_location_id)
        OR public.is_admin()
        OR public.has_permission('inventory.transfer')
        OR public.has_permission('inventory.read')
    )
);

DROP POLICY IF EXISTS "Tenant isolation insert transfers" ON public.transfers;
CREATE POLICY "Tenant isolation insert transfers" ON public.transfers
FOR INSERT TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.has_permission('inventory.transfer'))
    AND public.has_location_access(origin_location_id)
);

DROP POLICY IF EXISTS "Tenant isolation update transfers" ON public.transfers;
CREATE POLICY "Tenant isolation update transfers" ON public.transfers
FOR UPDATE TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.has_permission('inventory.transfer'))
    AND (public.has_location_access(origin_location_id) OR public.has_location_access(destination_location_id))
)
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.has_permission('inventory.transfer'))
);

-- transfer_items
DROP POLICY IF EXISTS "Tenant isolation select transfer_items" ON public.transfer_items;
CREATE POLICY "Tenant isolation select transfer_items" ON public.transfer_items
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.transfers t
        WHERE t.id = transfer_id
          AND t.company_id = public.get_auth_company_id()
          AND (
              public.has_location_access(t.origin_location_id)
              OR public.has_location_access(t.destination_location_id)
              OR public.is_admin()
              OR public.has_permission('inventory.read')
          )
    )
);

DROP POLICY IF EXISTS "Tenant isolation insert transfer_items" ON public.transfer_items;
CREATE POLICY "Tenant isolation insert transfer_items" ON public.transfer_items
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.transfers t
        WHERE t.id = transfer_id
          AND t.company_id = public.get_auth_company_id()
          AND (public.is_admin() OR public.has_permission('inventory.transfer'))
          AND public.has_location_access(t.origin_location_id)
    )
);

DROP POLICY IF EXISTS "Tenant isolation update transfer_items" ON public.transfer_items;
CREATE POLICY "Tenant isolation update transfer_items" ON public.transfer_items
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.transfers t
        WHERE t.id = transfer_id
          AND t.company_id = public.get_auth_company_id()
          AND (public.is_admin() OR public.has_permission('inventory.transfer'))
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.transfers t
        WHERE t.id = transfer_id
          AND t.company_id = public.get_auth_company_id()
          AND (public.is_admin() OR public.has_permission('inventory.transfer'))
    )
);

-- remissions
DROP POLICY IF EXISTS "Tenant isolation select remissions" ON public.remissions;
CREATE POLICY "Tenant isolation select remissions" ON public.remissions
FOR SELECT TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND (
        public.has_location_access(origin_location_id)
        OR public.is_admin()
        OR public.has_permission('remissions.read')
    )
);

DROP POLICY IF EXISTS "Tenant isolation insert remissions" ON public.remissions;
CREATE POLICY "Tenant isolation insert remissions" ON public.remissions
FOR INSERT TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.has_permission('remissions.create'))
    AND public.has_location_access(origin_location_id)
);

DROP POLICY IF EXISTS "Tenant isolation update remissions" ON public.remissions;
CREATE POLICY "Tenant isolation update remissions" ON public.remissions
FOR UPDATE TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.has_permission('remissions.create'))
    AND public.has_location_access(origin_location_id)
)
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (public.is_admin() OR public.has_permission('remissions.create'))
);

-- remission_items
DROP POLICY IF EXISTS "Tenant isolation select remission_items" ON public.remission_items;
CREATE POLICY "Tenant isolation select remission_items" ON public.remission_items
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.remissions r
        WHERE r.id = remission_id
          AND r.company_id = public.get_auth_company_id()
          AND (public.has_location_access(r.origin_location_id) OR public.is_admin() OR public.has_permission('remissions.read'))
    )
);

DROP POLICY IF EXISTS "Tenant isolation insert remission_items" ON public.remission_items;
CREATE POLICY "Tenant isolation insert remission_items" ON public.remission_items
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.remissions r
        WHERE r.id = remission_id
          AND r.company_id = public.get_auth_company_id()
          AND (public.is_admin() OR public.has_permission('remissions.create'))
          AND public.has_location_access(r.origin_location_id)
    )
);

-- ==============================================================================
-- 6. POLÍTICAS RLS: PRECIOS, PEDIDOS WEB, ALERTAS Y CONFIGURACIÓN
-- ==============================================================================
-- product_prices
DROP POLICY IF EXISTS "Tenant isolation select product_prices" ON public.product_prices;
CREATE POLICY "Tenant isolation select product_prices" ON public.product_prices
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = product_id
          AND p.company_id = public.get_auth_company_id()
    )
);

DROP POLICY IF EXISTS "Tenant isolation insert product_prices" ON public.product_prices;
CREATE POLICY "Tenant isolation insert product_prices" ON public.product_prices
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = product_id
          AND p.company_id = public.get_auth_company_id()
          AND (public.is_admin() OR public.has_permission('products.create') OR public.has_permission('products.update'))
    )
);

DROP POLICY IF EXISTS "Tenant isolation update product_prices" ON public.product_prices;
CREATE POLICY "Tenant isolation update product_prices" ON public.product_prices
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = product_id
          AND p.company_id = public.get_auth_company_id()
          AND (public.is_admin() OR public.has_permission('products.update'))
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = product_id
          AND p.company_id = public.get_auth_company_id()
          AND (public.is_admin() OR public.has_permission('products.update'))
    )
);

DROP POLICY IF EXISTS "Tenant isolation delete product_prices" ON public.product_prices;
CREATE POLICY "Tenant isolation delete product_prices" ON public.product_prices
FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = product_id
          AND p.company_id = public.get_auth_company_id()
          AND (public.is_admin() OR public.has_permission('products.delete'))
    )
);

-- web_orders y web_order_items
DROP POLICY IF EXISTS "Tenant isolation select web_orders" ON public.web_orders;
CREATE POLICY "Tenant isolation select web_orders" ON public.web_orders
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.locations l
        WHERE l.id = dispatch_location_id
          AND l.company_id = public.get_auth_company_id()
    )
    AND (public.is_admin() OR public.has_permission('sales.read'))
);

DROP POLICY IF EXISTS "Tenant isolation insert web_orders" ON public.web_orders;
CREATE POLICY "Tenant isolation insert web_orders" ON public.web_orders
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.locations l
        WHERE l.id = dispatch_location_id
          AND l.company_id = public.get_auth_company_id()
    )
    AND (public.is_admin() OR public.has_permission('sales.create'))
);

DROP POLICY IF EXISTS "Tenant isolation update web_orders" ON public.web_orders;
CREATE POLICY "Tenant isolation update web_orders" ON public.web_orders
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.locations l
        WHERE l.id = dispatch_location_id
          AND l.company_id = public.get_auth_company_id()
    )
    AND (public.is_admin() OR public.has_permission('sales.create') OR public.has_permission('sales.cancel'))
);

DROP POLICY IF EXISTS "Tenant isolation select web_order_items" ON public.web_order_items;
CREATE POLICY "Tenant isolation select web_order_items" ON public.web_order_items
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.web_orders wo
        JOIN public.locations l ON l.id = wo.dispatch_location_id
        WHERE wo.id = order_id
          AND l.company_id = public.get_auth_company_id()
    )
);

-- system_alerts
DROP POLICY IF EXISTS "Tenant isolation select system_alerts" ON public.system_alerts;
CREATE POLICY "Tenant isolation select system_alerts" ON public.system_alerts
FOR SELECT TO authenticated
USING (
    location_id IS NULL
    OR public.has_location_access(location_id)
    OR public.is_admin()
    OR public.has_permission('audit.read')
);

DROP POLICY IF EXISTS "Tenant isolation update system_alerts" ON public.system_alerts;
CREATE POLICY "Tenant isolation update system_alerts" ON public.system_alerts
FOR UPDATE TO authenticated
USING (
    assigned_user_id = auth.uid()
    OR public.is_admin()
    OR public.has_permission('audit.read')
);

-- system_settings
DROP POLICY IF EXISTS "Authenticated users can read system_settings" ON public.system_settings;
CREATE POLICY "Authenticated users can read system_settings" ON public.system_settings
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Superadmin full access system_settings" ON public.system_settings;
CREATE POLICY "Superadmin full access system_settings" ON public.system_settings
FOR ALL TO authenticated
USING (public.is_admin() OR public.has_permission('settings.manage'))
WITH CHECK (public.is_admin() OR public.has_permission('settings.manage'));

-- tax_rates
DROP POLICY IF EXISTS "Authenticated users can read tax_rates" ON public.tax_rates;
CREATE POLICY "Authenticated users can read tax_rates" ON public.tax_rates
FOR SELECT TO authenticated
USING (is_active = true OR public.is_admin() OR public.has_permission('taxes.read'));

DROP POLICY IF EXISTS "Admin write tax_rates" ON public.tax_rates;
CREATE POLICY "Admin write tax_rates" ON public.tax_rates
FOR ALL TO authenticated
USING (public.is_admin() OR public.has_permission('taxes.write'))
WITH CHECK (public.is_admin() OR public.has_permission('taxes.write'));

-- supplier_payments
DROP POLICY IF EXISTS "Tenant isolation select supplier_payments" ON public.supplier_payments;
CREATE POLICY "Tenant isolation select supplier_payments" ON public.supplier_payments
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.purchases p
        WHERE p.id = purchase_id
          AND p.company_id = public.get_auth_company_id()
          AND (public.has_location_access(p.location_id) OR public.is_admin())
          AND (public.has_permission('purchases.read') OR public.has_permission('treasury.manage') OR public.is_admin())
    )
);

DROP POLICY IF EXISTS "Tenant isolation insert supplier_payments" ON public.supplier_payments;
CREATE POLICY "Tenant isolation insert supplier_payments" ON public.supplier_payments
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.purchases p
        WHERE p.id = purchase_id
          AND p.company_id = public.get_auth_company_id()
          AND (public.has_location_access(p.location_id) OR public.is_admin())
          AND (public.has_permission('treasury.manage') OR public.has_permission('purchases.create') OR public.is_admin())
    )
);

-- dian_events
DROP POLICY IF EXISTS "Tenant isolation select dian_events" ON public.dian_events;
CREATE POLICY "Tenant isolation select dian_events" ON public.dian_events
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.electronic_invoices ei
        WHERE ei.id = invoice_id
          AND ei.company_id = public.get_auth_company_id()
          AND (public.has_location_access(ei.location_id) OR public.is_admin())
          AND (public.has_permission('invoices.read') OR public.has_permission('dian.manage') OR public.is_admin())
    )
);

DROP POLICY IF EXISTS "Tenant isolation insert dian_events" ON public.dian_events;
CREATE POLICY "Tenant isolation insert dian_events" ON public.dian_events
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.electronic_invoices ei
        WHERE ei.id = invoice_id
          AND ei.company_id = public.get_auth_company_id()
          AND (public.has_permission('dian.manage') OR public.has_permission('invoices.create') OR public.is_admin())
    )
);

-- alert_rules
DROP POLICY IF EXISTS "Tenant isolation select alert_rules" ON public.alert_rules;
CREATE POLICY "Tenant isolation select alert_rules" ON public.alert_rules
FOR SELECT TO authenticated
USING (is_enabled = true OR public.is_admin() OR public.has_permission('audit.read'));

DROP POLICY IF EXISTS "Tenant isolation modify alert_rules" ON public.alert_rules;
CREATE POLICY "Tenant isolation modify alert_rules" ON public.alert_rules
FOR ALL TO authenticated
USING (public.is_admin() OR public.has_permission('settings.manage'))
WITH CHECK (public.is_admin() OR public.has_permission('settings.manage'));

-- exogena_formats y exogena_records
DROP POLICY IF EXISTS "Tenant isolation select exogena_formats" ON public.exogena_formats;
CREATE POLICY "Tenant isolation select exogena_formats" ON public.exogena_formats
FOR SELECT TO authenticated
USING (is_active = true OR public.is_admin() OR public.has_permission('accounting.read'));

DROP POLICY IF EXISTS "Tenant isolation modify exogena_formats" ON public.exogena_formats;
CREATE POLICY "Tenant isolation modify exogena_formats" ON public.exogena_formats
FOR ALL TO authenticated
USING (public.is_admin() OR public.has_permission('accounting.post'))
WITH CHECK (public.is_admin() OR public.has_permission('accounting.post'));

DROP POLICY IF EXISTS "Tenant isolation select exogena_records" ON public.exogena_records;
CREATE POLICY "Tenant isolation select exogena_records" ON public.exogena_records
FOR SELECT TO authenticated
USING (public.is_admin() OR public.has_permission('accounting.read'));

DROP POLICY IF EXISTS "Tenant isolation modify exogena_records" ON public.exogena_records;
CREATE POLICY "Tenant isolation modify exogena_records" ON public.exogena_records
FOR ALL TO authenticated
USING (public.is_admin() OR public.has_permission('accounting.post'))
WITH CHECK (public.is_admin() OR public.has_permission('accounting.post'));

-- ==============================================================================
-- 7. BLINDAR FUNCIONES FINANCIERAS SECURITY DEFINER CON SET SEARCH_PATH
-- ==============================================================================
ALTER FUNCTION public.fn_close_accounting_period(UUID, VARCHAR, UUID)
    SET search_path = public, pg_catalog;

ALTER FUNCTION public.fn_reopen_accounting_period(UUID, VARCHAR, UUID, TEXT)
    SET search_path = public, pg_catalog;

ALTER FUNCTION public.fn_financial_trial_balance(UUID, DATE, DATE)
    SET search_path = public, pg_catalog;

ALTER FUNCTION public.fn_financial_daily_journal(UUID, DATE, DATE)
    SET search_path = public, pg_catalog;

ALTER FUNCTION public.fn_financial_general_ledger(UUID, DATE, DATE, VARCHAR)
    SET search_path = public, pg_catalog;

ALTER FUNCTION public.fn_financial_income_statement(UUID, DATE, DATE)
    SET search_path = public, pg_catalog;

ALTER FUNCTION public.fn_financial_balance_sheet(UUID, DATE)
    SET search_path = public, pg_catalog;

ALTER FUNCTION public.fn_financial_tax_summary(UUID, DATE, DATE)
    SET search_path = public, pg_catalog;

-- ==============================================================================
-- 8. ÍNDICES DE PERFORMANCE EN CLAVES FORÁNEAS (PREVENCIÓN DE SEQUENTIAL SCANS)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.electronic_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_location ON public.electronic_invoices(location_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company ON public.electronic_invoices(company_id);

CREATE INDEX IF NOT EXISTS idx_sales_cash_session ON public.sales(cash_session_id);
CREATE INDEX IF NOT EXISTS idx_sales_seller ON public.sales(seller_user_id);

CREATE INDEX IF NOT EXISTS idx_remissions_sale ON public.remissions(sale_id);
CREATE INDEX IF NOT EXISTS idx_remissions_customer ON public.remissions(customer_id);
CREATE INDEX IF NOT EXISTS idx_remissions_origin ON public.remissions(origin_location_id);
CREATE INDEX IF NOT EXISTS idx_remission_items_remission ON public.remission_items(remission_id);
CREATE INDEX IF NOT EXISTS idx_remission_items_product ON public.remission_items(product_id);

CREATE INDEX IF NOT EXISTS idx_transfers_creator ON public.transfers(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_receiver ON public.transfers(received_by_user_id);
CREATE INDEX IF NOT EXISTS idx_transfer_items_product ON public.transfer_items(product_id);

CREATE INDEX IF NOT EXISTS idx_treasury_pmts_accounting ON public.treasury_payments(accounting_entry_id);
CREATE INDEX IF NOT EXISTS idx_treasury_pmts_purchase ON public.treasury_payments(purchase_id);
CREATE INDEX IF NOT EXISTS idx_treasury_rcpts_accounting ON public.treasury_receipts(accounting_entry_id);
CREATE INDEX IF NOT EXISTS idx_treasury_rcpts_bank_acc ON public.treasury_receipts(bank_account_id);

CREATE INDEX IF NOT EXISTS idx_bank_mov_pmt ON public.bank_movements(treasury_payment_id);
CREATE INDEX IF NOT EXISTS idx_bank_mov_rcpt ON public.bank_movements(treasury_receipt_id);

CREATE INDEX IF NOT EXISTS idx_acc_lines_cost_center ON public.accounting_entry_lines(cost_center_id);

CREATE INDEX IF NOT EXISTS idx_cash_mov_session ON public.cash_movements(session_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_register ON public.cash_sessions(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_user ON public.cash_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_system_alerts_user ON public.system_alerts(assigned_user_id);
