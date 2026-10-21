-- ==============================================================================
-- 078_INACTIVE_USERS_AND_TENANT_POLICIES.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Usuarios desactivados sin acceso por RLS/RPC y aislamiento por empresa en las
-- políticas que todavía no lo tenían.
--
-- A5  get_auth_company_id, get_auth_role, has_permission, has_any_permission y
--     has_location_access exigen users.is_active (cuerpos de 074 + esa condición,
--     mismas firmas y mismos EXECUTE). is_admin() (057) depende de get_auth_role().
--     El login sigue funcionando: la política de users permite leer la fila propia
--     (id = auth.uid()) sin pasar por estas funciones, así la app muestra
--     "usuario inactivo" y cierra la sesión.
-- A6  Aislamiento multiempresa:
--     - user_locations: el usuario y la sede deben ser de la empresa de quien opera.
--     - cost_centers / accounting_periods: "... OR is_admin()" pasa a ser AND empresa.
--     - accounting_accounts (PUC): global por diseño (code UNIQUE sin company_id; lo
--       usan todas las empresas y las FK de asientos, bancos y productos). Lectura para
--       usuarios activos; alta/edición solo ADMIN, ACCOUNTANT o accounting.post; borrado
--       solo ADMIN y solo si la cuenta no tiene movimientos, subcuentas ni productos.
--     - exogena_formats: catálogo DIAN global, solo lectura; escritura solo servidor.
--     - exogena_records: tenía datos de terceros sin company_id. Se añade company_id
--       (nullable, sin backfill: no hay forma fiable de inferirlo). Las filas antiguas
--       sin empresa quedan visibles solo para service_role. La app no usa esta tabla.
--     - alert_rules: las reglas globales (company_id NULL) son de solo lectura; solo se
--       modifican las de la propia empresa (settings.manage / ADMIN).
--     - system_alerts: SELECT/INSERT/UPDATE/DELETE por empresa.
--     - system_settings: global por diseño (key UNIQUE, parámetros operativos sin
--       secretos: company.profile, inventory.policies, pos.terminal_rules,
--       ecommerce.dispatch_node). Lectura para usuarios activos, escritura solo ADMIN.
--     - Storage privado (invoices, suppliers, documents): la ruta debe empezar por
--       "{company_id}/". Los archivos antiguos sin prefijo quedan solo para service_role
--       (ver nota al final). Sin UPDATE/DELETE desde el cliente: son soportes fiscales.
-- M2  audit_logs INSERT: company_id = empresa propia y user_id = auth.uid().
-- M3  quotes / quote_items y system_alerts / alert_rules usan get_auth_company_id()
--     (respeta is_active y la bandera must_change_password de 074) y permisos reales.
--     No existen permisos quotes.* ni alerts.* en la base (014/019/057): cotizaciones
--     usan sales.read / sales.create / sales.cancel; alertas usan audit.read (el mismo
--     permiso del menú) y settings.manage para las reglas. No se crean permisos nuevos.
-- M5  Buckets públicos products/company/users: solo imágenes jpg/png/webp de hasta
--     5 MB, carga/edición/borrado con permiso y prefijo "{company_id}/".
-- B1  fn_next_*_number/_code y fn_dian_active_environment: nadie las llama desde la app;
--     solo las usan funciones SECURITY DEFINER (corren como su dueño). Se quita EXECUTE
--     a authenticated; quedan para service_role. fn_assert_bank_ledger_account se deja
--     como está: la invoca el trigger SECURITY INVOKER fn_validate_bank_account_ledger
--     (059) con el rol del usuario, no recibe empresa y solo lee el PUC global.
--
-- Datos: no modifica usuarios, roles ni permisos. Solo agrega la columna nullable
-- exogena_records.company_id y ajusta límites de tres buckets públicos.
-- Re-ejecutable: CREATE OR REPLACE, DROP POLICY IF EXISTS + CREATE, ADD COLUMN IF NOT EXISTS.
-- Rollback: re-ejecutar 074 (helpers) y las políticas de 010, 024, 025, 051, 052 y 055;
-- GRANT EXECUTE ... TO authenticated en las funciones de B1.
-- ==============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL search_path = pg_catalog, public;

-- ==============================================================================
-- A5. FUNCIONES RBAC AUXILIARES: USUARIO ACTIVO (cuerpos de 074 + u.is_active)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_auth_company_id()
RETURNS UUID AS $$
    SELECT u.company_id
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.is_active
      AND NOT public.auth_password_change_pending();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog;

-- is_admin() (057) se basa en get_auth_role(): queda en false sin redefinirla.
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS VARCHAR AS $$
    SELECT r.code
    FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
      AND u.is_active
      AND NOT public.auth_password_change_pending();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog;

CREATE OR REPLACE FUNCTION public.has_permission(p_permission_code VARCHAR)
RETURNS BOOLEAN AS $$
    SELECT NOT public.auth_password_change_pending()
       AND (
            EXISTS (
                SELECT 1
                FROM public.users u
                JOIN public.role_permissions rp ON u.role_id = rp.role_id
                JOIN public.permissions p ON rp.permission_id = p.id
                WHERE u.id = auth.uid()
                  AND u.is_active
                  AND p.code = p_permission_code
            )
            OR public.is_admin()
       );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog;

CREATE OR REPLACE FUNCTION public.has_any_permission(p_permission_codes VARCHAR[])
RETURNS BOOLEAN AS $$
    SELECT NOT public.auth_password_change_pending()
       AND (
            EXISTS (
                SELECT 1
                FROM public.users u
                JOIN public.role_permissions rp ON u.role_id = rp.role_id
                JOIN public.permissions p ON rp.permission_id = p.id
                WHERE u.id = auth.uid()
                  AND u.is_active
                  AND p.code = ANY(p_permission_codes)
            )
            OR public.is_admin()
       );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog;

CREATE OR REPLACE FUNCTION public.has_location_access(p_location_id UUID)
RETURNS BOOLEAN AS $$
    SELECT NOT public.auth_password_change_pending()
       AND (
            EXISTS (
                SELECT 1 FROM public.user_locations ul
                JOIN public.users u ON u.id = ul.user_id
                WHERE ul.user_id = auth.uid() AND ul.location_id = p_location_id
                  AND u.is_active
            )
            OR public.is_admin()
       );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.get_auth_company_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_company_id() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_auth_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.has_permission(VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(VARCHAR) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.has_any_permission(VARCHAR[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_any_permission(VARCHAR[]) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.has_location_access(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_location_access(UUID) TO authenticated, service_role;

-- ==============================================================================
-- Funciones de apoyo para políticas (SECURITY DEFINER: no dependen del RLS de
-- users/locations ni de los permisos de lectura de quien consulta).
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.fn_auth_company_owns_user(p_user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = p_user_id
          AND u.company_id = public.get_auth_company_id()
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog;

CREATE OR REPLACE FUNCTION public.fn_auth_company_owns_location(p_location_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.locations l
        WHERE l.id = p_location_id
          AND l.company_id = public.get_auth_company_id()
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog;

-- Una cuenta del PUC está en uso si tiene movimientos, subcuentas o productos enlazados
-- (products.accounting_account_id es ON DELETE SET NULL: borrarla los desenlazaría en
-- silencio). Las demás FK son RESTRICT y ya bloquean el borrado.
CREATE OR REPLACE FUNCTION public.fn_accounting_account_in_use(p_account_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (SELECT 1 FROM public.accounting_entry_lines l WHERE l.account_id = p_account_id)
        OR EXISTS (SELECT 1 FROM public.accounting_accounts c WHERE c.parent_id = p_account_id)
        OR EXISTS (SELECT 1 FROM public.products p WHERE p.accounting_account_id = p_account_id);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.fn_auth_company_owns_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_auth_company_owns_user(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_auth_company_owns_location(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_auth_company_owns_location(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_accounting_account_in_use(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_accounting_account_in_use(UUID) TO authenticated, service_role;

-- ==============================================================================
-- Esquema: exogena_records sin empresa (A6)
-- ==============================================================================
ALTER TABLE public.exogena_records
    ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_exogena_records_company ON public.exogena_records(company_id);

-- ==============================================================================
-- Limpieza de políticas previas en las tablas que se redefinen (incluye las de 051/052
-- creadas sin TO, que aplicaban también a anon). Así no queda ninguna política
-- permisiva antigua que reabra el acceso por OR.
-- ==============================================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN (
              'user_locations', 'accounting_accounts', 'accounting_periods', 'cost_centers',
              'exogena_formats', 'exogena_records', 'alert_rules', 'system_alerts',
              'system_settings', 'quotes', 'quote_items'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exogena_formats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exogena_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Privilegios de tabla explícitos: anon no usa ninguna de estas tablas; TRUNCATE salta
-- RLS, así que nadie fuera del servidor lo conserva.
REVOKE ALL ON public.user_locations, public.accounting_accounts, public.accounting_periods,
    public.cost_centers, public.exogena_formats, public.exogena_records, public.alert_rules,
    public.system_alerts, public.system_settings, public.quotes, public.quote_items,
    public.audit_logs
    FROM PUBLIC, anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.user_locations, public.accounting_accounts,
    public.accounting_periods, public.cost_centers, public.exogena_formats,
    public.exogena_records, public.alert_rules, public.system_alerts, public.system_settings,
    public.quotes, public.quote_items, public.audit_logs
    FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_locations, public.accounting_accounts,
    public.accounting_periods, public.cost_centers, public.exogena_records, public.alert_rules,
    public.system_alerts, public.system_settings, public.quotes, public.quote_items
    TO authenticated;
-- Catálogo DIAN global: solo lectura para usuarios.
REVOKE INSERT, UPDATE, DELETE ON public.exogena_formats FROM authenticated;
GRANT SELECT ON public.exogena_formats TO authenticated;
-- audit_logs es inmutable (trigger 014): solo lectura e inserción.
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.user_locations, public.accounting_accounts, public.accounting_periods,
    public.cost_centers, public.exogena_formats, public.exogena_records, public.alert_rules,
    public.system_alerts, public.system_settings, public.quotes, public.quote_items,
    public.audit_logs
    TO service_role;

-- ==============================================================================
-- A6. user_locations
-- ==============================================================================
DROP POLICY IF EXISTS "Tenant isolation select user_locations" ON public.user_locations;
CREATE POLICY "Tenant isolation select user_locations" ON public.user_locations
FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    OR (
        public.has_permission('users.read')
        AND public.fn_auth_company_owns_user(user_id)
    )
);

DROP POLICY IF EXISTS "Tenant isolation insert user_locations" ON public.user_locations;
CREATE POLICY "Tenant isolation insert user_locations" ON public.user_locations
FOR INSERT TO authenticated
WITH CHECK (
    public.has_any_permission(ARRAY['users.create', 'users.update']::VARCHAR[])
    AND public.fn_auth_company_owns_user(user_id)
    AND public.fn_auth_company_owns_location(location_id)
);

DROP POLICY IF EXISTS "Tenant isolation update user_locations" ON public.user_locations;
CREATE POLICY "Tenant isolation update user_locations" ON public.user_locations
FOR UPDATE TO authenticated
USING (
    public.has_permission('users.update')
    AND public.fn_auth_company_owns_user(user_id)
)
WITH CHECK (
    public.has_permission('users.update')
    AND public.fn_auth_company_owns_user(user_id)
    AND public.fn_auth_company_owns_location(location_id)
);

DROP POLICY IF EXISTS "Tenant isolation delete user_locations" ON public.user_locations;
CREATE POLICY "Tenant isolation delete user_locations" ON public.user_locations
FOR DELETE TO authenticated
USING (
    public.has_permission('users.update')
    AND public.fn_auth_company_owns_user(user_id)
);

-- ==============================================================================
-- A6. cost_centers y accounting_periods (empresa obligatoria también para ADMIN)
-- ==============================================================================
DROP POLICY IF EXISTS "Tenant isolation cost_centers_select" ON public.cost_centers;
CREATE POLICY "Tenant isolation cost_centers_select" ON public.cost_centers
    FOR SELECT TO authenticated
    USING (company_id = public.get_auth_company_id());

DROP POLICY IF EXISTS "Tenant isolation cost_centers_manage" ON public.cost_centers;
CREATE POLICY "Tenant isolation cost_centers_manage" ON public.cost_centers
    FOR ALL TO authenticated
    USING (
        company_id = public.get_auth_company_id()
        AND (public.is_admin() OR public.get_auth_role() = 'ACCOUNTANT' OR public.has_permission('accounting.manage'))
    )
    WITH CHECK (
        company_id = public.get_auth_company_id()
        AND (public.is_admin() OR public.get_auth_role() = 'ACCOUNTANT' OR public.has_permission('accounting.manage'))
    );

DROP POLICY IF EXISTS "Tenant isolation accounting_periods_select" ON public.accounting_periods;
CREATE POLICY "Tenant isolation accounting_periods_select" ON public.accounting_periods
    FOR SELECT TO authenticated
    USING (
        company_id = public.get_auth_company_id()
        AND (public.is_admin() OR public.get_auth_role() = 'ACCOUNTANT' OR public.has_permission('accounting.read'))
    );

DROP POLICY IF EXISTS "Tenant isolation accounting_periods_manage" ON public.accounting_periods;
CREATE POLICY "Tenant isolation accounting_periods_manage" ON public.accounting_periods
    FOR ALL TO authenticated
    USING (
        company_id = public.get_auth_company_id()
        AND (public.is_admin() OR public.get_auth_role() = 'ACCOUNTANT' OR public.has_permission('accounting.manage'))
    )
    WITH CHECK (
        company_id = public.get_auth_company_id()
        AND (public.is_admin() OR public.get_auth_role() = 'ACCOUNTANT' OR public.has_permission('accounting.manage'))
    );

-- ==============================================================================
-- A6. accounting_accounts (PUC global)
-- ==============================================================================
DROP POLICY IF EXISTS "PUC read accounting_accounts" ON public.accounting_accounts;
CREATE POLICY "PUC read accounting_accounts" ON public.accounting_accounts
    FOR SELECT TO authenticated
    USING (
        public.get_auth_company_id() IS NOT NULL
        AND (is_active = true OR public.is_admin())
    );

DROP POLICY IF EXISTS "PUC insert accounting_accounts" ON public.accounting_accounts;
CREATE POLICY "PUC insert accounting_accounts" ON public.accounting_accounts
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_admin() OR public.get_auth_role() = 'ACCOUNTANT' OR public.has_permission('accounting.post')
    );

DROP POLICY IF EXISTS "PUC update accounting_accounts" ON public.accounting_accounts;
CREATE POLICY "PUC update accounting_accounts" ON public.accounting_accounts
    FOR UPDATE TO authenticated
    USING (
        public.is_admin() OR public.get_auth_role() = 'ACCOUNTANT' OR public.has_permission('accounting.post')
    )
    WITH CHECK (
        public.is_admin() OR public.get_auth_role() = 'ACCOUNTANT' OR public.has_permission('accounting.post')
    );

DROP POLICY IF EXISTS "PUC delete unused accounting_accounts" ON public.accounting_accounts;
CREATE POLICY "PUC delete unused accounting_accounts" ON public.accounting_accounts
    FOR DELETE TO authenticated
    USING (
        public.is_admin()
        AND NOT public.fn_accounting_account_in_use(id)
    );

-- ==============================================================================
-- A6. exogena_formats (catálogo DIAN global) y exogena_records (por empresa)
-- ==============================================================================
DROP POLICY IF EXISTS "Exogena read formats" ON public.exogena_formats;
CREATE POLICY "Exogena read formats" ON public.exogena_formats
FOR SELECT TO authenticated
USING (
    public.get_auth_company_id() IS NOT NULL
    AND (is_active = true OR public.has_any_permission(ARRAY['accounting.read', 'exogena.read']::VARCHAR[]))
);

DROP POLICY IF EXISTS "Tenant isolation select exogena_records" ON public.exogena_records;
CREATE POLICY "Tenant isolation select exogena_records" ON public.exogena_records
FOR SELECT TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND public.has_any_permission(ARRAY['accounting.read', 'exogena.read']::VARCHAR[])
);

DROP POLICY IF EXISTS "Tenant isolation modify exogena_records" ON public.exogena_records;
CREATE POLICY "Tenant isolation modify exogena_records" ON public.exogena_records
FOR ALL TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND public.has_any_permission(ARRAY['accounting.post', 'exogena.export']::VARCHAR[])
)
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND public.has_any_permission(ARRAY['accounting.post', 'exogena.export']::VARCHAR[])
);

-- ==============================================================================
-- A6 / M3. alert_rules (globales de solo lectura) y system_alerts
-- ==============================================================================
DROP POLICY IF EXISTS "Tenant isolation select alert_rules" ON public.alert_rules;
CREATE POLICY "Tenant isolation select alert_rules" ON public.alert_rules
FOR SELECT TO authenticated
USING (
    public.get_auth_company_id() IS NOT NULL
    AND (company_id IS NULL OR company_id = public.get_auth_company_id())
);

DROP POLICY IF EXISTS "Tenant isolation insert alert_rules" ON public.alert_rules;
CREATE POLICY "Tenant isolation insert alert_rules" ON public.alert_rules
FOR INSERT TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND public.has_permission('settings.manage')
);

DROP POLICY IF EXISTS "Tenant isolation update alert_rules" ON public.alert_rules;
CREATE POLICY "Tenant isolation update alert_rules" ON public.alert_rules
FOR UPDATE TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND public.has_permission('settings.manage')
)
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND public.has_permission('settings.manage')
);

DROP POLICY IF EXISTS "Tenant isolation delete alert_rules" ON public.alert_rules;
CREATE POLICY "Tenant isolation delete alert_rules" ON public.alert_rules
FOR DELETE TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND public.has_permission('settings.manage')
);

DROP POLICY IF EXISTS "Tenant isolation select system_alerts" ON public.system_alerts;
CREATE POLICY "Tenant isolation select system_alerts" ON public.system_alerts
FOR SELECT TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND (
        location_id IS NULL
        OR public.has_location_access(location_id)
        OR public.has_permission('audit.read')
    )
);

DROP POLICY IF EXISTS "Tenant isolation insert system_alerts" ON public.system_alerts;
CREATE POLICY "Tenant isolation insert system_alerts" ON public.system_alerts
FOR INSERT TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (
        location_id IS NULL
        OR public.has_location_access(location_id)
        OR public.has_permission('audit.read')
    )
);

DROP POLICY IF EXISTS "Tenant isolation update system_alerts" ON public.system_alerts;
CREATE POLICY "Tenant isolation update system_alerts" ON public.system_alerts
FOR UPDATE TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND (
        assigned_user_id = auth.uid()
        OR public.has_permission('audit.read')
        OR (location_id IS NOT NULL AND public.has_location_access(location_id))
    )
)
WITH CHECK (company_id = public.get_auth_company_id());

DROP POLICY IF EXISTS "Tenant isolation delete system_alerts" ON public.system_alerts;
CREATE POLICY "Tenant isolation delete system_alerts" ON public.system_alerts
FOR DELETE TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND public.is_admin()
);

-- ==============================================================================
-- A6. system_settings (global por diseño)
-- ==============================================================================
DROP POLICY IF EXISTS "Active users read system_settings" ON public.system_settings;
CREATE POLICY "Active users read system_settings" ON public.system_settings
FOR SELECT TO authenticated
USING (public.get_auth_company_id() IS NOT NULL);

DROP POLICY IF EXISTS "Admin insert system_settings" ON public.system_settings;
CREATE POLICY "Admin insert system_settings" ON public.system_settings
FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin update system_settings" ON public.system_settings;
CREATE POLICY "Admin update system_settings" ON public.system_settings
FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin delete system_settings" ON public.system_settings;
CREATE POLICY "Admin delete system_settings" ON public.system_settings
FOR DELETE TO authenticated
USING (public.is_admin());

-- ==============================================================================
-- M3. quotes y quote_items (sin permisos quotes.*: se usan los de ventas)
-- ==============================================================================
DROP POLICY IF EXISTS "Tenant isolation select quotes" ON public.quotes;
CREATE POLICY "Tenant isolation select quotes" ON public.quotes
FOR SELECT TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND public.has_any_permission(ARRAY['sales.read', 'sales.create']::VARCHAR[])
);

DROP POLICY IF EXISTS "Tenant isolation insert quotes" ON public.quotes;
CREATE POLICY "Tenant isolation insert quotes" ON public.quotes
FOR INSERT TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND public.has_permission('sales.create')
    AND public.fn_auth_company_owns_location(location_id)
);

DROP POLICY IF EXISTS "Tenant isolation update quotes" ON public.quotes;
CREATE POLICY "Tenant isolation update quotes" ON public.quotes
FOR UPDATE TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND public.has_permission('sales.create')
)
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND public.has_permission('sales.create')
    AND public.fn_auth_company_owns_location(location_id)
);

DROP POLICY IF EXISTS "Tenant isolation delete quotes" ON public.quotes;
CREATE POLICY "Tenant isolation delete quotes" ON public.quotes
FOR DELETE TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND public.has_permission('sales.cancel')
);

DROP POLICY IF EXISTS "Tenant isolation select quote_items" ON public.quote_items;
CREATE POLICY "Tenant isolation select quote_items" ON public.quote_items
FOR SELECT TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND public.has_any_permission(ARRAY['sales.read', 'sales.create']::VARCHAR[])
);

DROP POLICY IF EXISTS "Tenant isolation insert quote_items" ON public.quote_items;
CREATE POLICY "Tenant isolation insert quote_items" ON public.quote_items
FOR INSERT TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND public.has_permission('sales.create')
    AND EXISTS (
        SELECT 1 FROM public.quotes q
        WHERE q.id = quote_items.quote_id AND q.company_id = quote_items.company_id
    )
);

DROP POLICY IF EXISTS "Tenant isolation update quote_items" ON public.quote_items;
CREATE POLICY "Tenant isolation update quote_items" ON public.quote_items
FOR UPDATE TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND public.has_permission('sales.create')
)
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND public.has_permission('sales.create')
    AND EXISTS (
        SELECT 1 FROM public.quotes q
        WHERE q.id = quote_items.quote_id AND q.company_id = quote_items.company_id
    )
);

DROP POLICY IF EXISTS "Tenant isolation delete quote_items" ON public.quote_items;
CREATE POLICY "Tenant isolation delete quote_items" ON public.quote_items
FOR DELETE TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND public.has_permission('sales.create')
);

-- ==============================================================================
-- M2. audit_logs: inserción solo a nombre propio y en la empresa propia
-- (los triggers y RPC SECURITY DEFINER y service_role no pasan por esta política)
-- ==============================================================================
DROP POLICY IF EXISTS "Allow authenticated users to insert audit log" ON public.audit_logs;
DROP POLICY IF EXISTS "Tenant isolation insert audit_logs" ON public.audit_logs;
CREATE POLICY "Tenant isolation insert audit_logs" ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND user_id = auth.uid()
);

-- ==============================================================================
-- B1. Consecutivos y ambiente DIAN: solo servidor (los usan RPC SECURITY DEFINER)
-- ==============================================================================
REVOKE ALL ON FUNCTION public.fn_next_purchase_number(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_next_purchase_number(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.fn_next_reception_number(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_next_reception_number(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.fn_next_supplier_payment_number(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_next_supplier_payment_number(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.fn_next_customer_payment_number(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_next_customer_payment_number(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.fn_next_transfer_code(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_next_transfer_code(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.fn_next_remission_code(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_next_remission_code(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.fn_next_return_code(UUID, VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_next_return_code(UUID, VARCHAR) TO service_role;
REVOKE ALL ON FUNCTION public.fn_dian_active_environment(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_dian_active_environment(UUID) TO service_role;

-- fn_assert_bank_ledger_account(VARCHAR, UUID): sin cambios a propósito (ver encabezado).
REVOKE ALL ON FUNCTION public.fn_assert_bank_ledger_account(VARCHAR, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_assert_bank_ledger_account(VARCHAR, UUID) TO authenticated, service_role;

-- ==============================================================================
-- M5 / A6. STORAGE
-- Convención de rutas: "{company_id}/..." en todos los buckets de la app
-- (avatares: "{company_id}/{user_id}/..."). La app no sube archivos hoy a estos buckets
-- (solo RRHH, con su propio bucket hr-documents de 070, que no se toca).
-- ==============================================================================
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id IN ('products', 'company', 'users');

-- Cargas abiertas de 010 (cualquier autenticado, cualquier ruta)
DROP POLICY IF EXISTS "Authenticated upload products" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload company" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload users" ON storage.objects;
DROP POLICY IF EXISTS "Private invoices access" ON storage.objects;

-- products: imágenes de catálogo
DROP POLICY IF EXISTS "Tenant products images insert" ON storage.objects;
CREATE POLICY "Tenant products images insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'products'
    AND (storage.foldername(name))[1] = public.get_auth_company_id()::TEXT
    AND public.has_any_permission(ARRAY['products.create', 'products.update']::VARCHAR[])
);

DROP POLICY IF EXISTS "Tenant products images update" ON storage.objects;
CREATE POLICY "Tenant products images update" ON storage.objects
FOR UPDATE TO authenticated
USING (
    bucket_id = 'products'
    AND (storage.foldername(name))[1] = public.get_auth_company_id()::TEXT
    AND public.has_permission('products.update')
)
WITH CHECK (
    bucket_id = 'products'
    AND (storage.foldername(name))[1] = public.get_auth_company_id()::TEXT
    AND public.has_permission('products.update')
);

DROP POLICY IF EXISTS "Tenant products images delete" ON storage.objects;
CREATE POLICY "Tenant products images delete" ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id = 'products'
    AND (storage.foldername(name))[1] = public.get_auth_company_id()::TEXT
    AND public.has_any_permission(ARRAY['products.update', 'products.delete']::VARCHAR[])
);

-- company: logos e identidad (mismo criterio que la política de UPDATE de companies, 014)
DROP POLICY IF EXISTS "Tenant company assets insert" ON storage.objects;
CREATE POLICY "Tenant company assets insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'company'
    AND (storage.foldername(name))[1] = public.get_auth_company_id()::TEXT
    AND public.has_permission('settings.manage')
);

DROP POLICY IF EXISTS "Tenant company assets update" ON storage.objects;
CREATE POLICY "Tenant company assets update" ON storage.objects
FOR UPDATE TO authenticated
USING (
    bucket_id = 'company'
    AND (storage.foldername(name))[1] = public.get_auth_company_id()::TEXT
    AND public.has_permission('settings.manage')
)
WITH CHECK (
    bucket_id = 'company'
    AND (storage.foldername(name))[1] = public.get_auth_company_id()::TEXT
    AND public.has_permission('settings.manage')
);

DROP POLICY IF EXISTS "Tenant company assets delete" ON storage.objects;
CREATE POLICY "Tenant company assets delete" ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id = 'company'
    AND (storage.foldername(name))[1] = public.get_auth_company_id()::TEXT
    AND public.has_permission('settings.manage')
);

-- users: avatares (el propio usuario en su carpeta, o quien administra usuarios)
DROP POLICY IF EXISTS "Tenant user avatars insert" ON storage.objects;
CREATE POLICY "Tenant user avatars insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'users'
    AND (storage.foldername(name))[1] = public.get_auth_company_id()::TEXT
    AND ((storage.foldername(name))[2] = auth.uid()::TEXT OR public.has_permission('users.update'))
);

DROP POLICY IF EXISTS "Tenant user avatars update" ON storage.objects;
CREATE POLICY "Tenant user avatars update" ON storage.objects
FOR UPDATE TO authenticated
USING (
    bucket_id = 'users'
    AND (storage.foldername(name))[1] = public.get_auth_company_id()::TEXT
    AND ((storage.foldername(name))[2] = auth.uid()::TEXT OR public.has_permission('users.update'))
)
WITH CHECK (
    bucket_id = 'users'
    AND (storage.foldername(name))[1] = public.get_auth_company_id()::TEXT
    AND ((storage.foldername(name))[2] = auth.uid()::TEXT OR public.has_permission('users.update'))
);

DROP POLICY IF EXISTS "Tenant user avatars delete" ON storage.objects;
CREATE POLICY "Tenant user avatars delete" ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id = 'users'
    AND (storage.foldername(name))[1] = public.get_auth_company_id()::TEXT
    AND ((storage.foldername(name))[2] = auth.uid()::TEXT OR public.has_permission('users.update'))
);

-- Documentos privados (facturas DIAN, soportes de proveedores, documentos):
-- mismos roles que 010 (ADMIN/SUPERADMIN o ACCOUNTANT) + prefijo de empresa.
-- Solo lectura y carga: los soportes fiscales no se sobrescriben ni se borran desde el
-- cliente. Archivos antiguos sin prefijo: solo service_role puede leerlos o moverlos a
-- "{company_id}/..." (asignarlos a una empresa no se puede inferir con seguridad).
DROP POLICY IF EXISTS "Tenant private documents read" ON storage.objects;
CREATE POLICY "Tenant private documents read" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id IN ('invoices', 'suppliers', 'documents')
    AND (storage.foldername(name))[1] = public.get_auth_company_id()::TEXT
    AND (public.is_admin() OR public.get_auth_role() = 'ACCOUNTANT')
);

DROP POLICY IF EXISTS "Tenant private documents upload" ON storage.objects;
CREATE POLICY "Tenant private documents upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id IN ('invoices', 'suppliers', 'documents')
    AND (storage.foldername(name))[1] = public.get_auth_company_id()::TEXT
    AND (public.is_admin() OR public.get_auth_role() = 'ACCOUNTANT')
);

COMMIT;
