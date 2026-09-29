-- ==============================================================================
-- 014_SYSTEM_ROLES_AND_FIRST_ADMIN_FLOW.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Roles del Sistema, Matriz de Permisos, RLS Estricto y Flujo del Primer Administrador
-- ==============================================================================

-- 1. Inserción de Roles Maestros del Sistema (Inmutables)
INSERT INTO public.roles (id, code, name, description, scope, is_system)
VALUES 
    (
        'c0000000-0000-0000-0000-000000000001',
        'SUPERADMIN',
        'Superadministrador',
        'Control total operativo, administrativo, financiero, de seguridad y configuración de todas las sedes.',
        'ALL_LOCATIONS',
        true
    ),
    (
        'c0000000-0000-0000-0000-000000000002',
        'ADMIN',
        'Administrador General',
        'Gestión operativa y administrativa general de la empresa y sus sedes.',
        'ALL_LOCATIONS',
        true
    ),
    (
        'c0000000-0000-0000-0000-000000000003',
        'WAREHOUSE_ADMIN',
        'Administrador de Bodega',
        'Gestión de existencias, recepción de compras, despacho de transferencias y conteos físicos en bodegas asignadas.',
        'ASSIGNED_LOCATION',
        true
    ),
    (
        'c0000000-0000-0000-0000-000000000004',
        'POINT_ADMIN',
        'Administrador de Punto (POS)',
        'Supervisión de cajas, arqueos, facturación electrónica y atención a clientes en el punto de venta.',
        'ASSIGNED_LOCATION',
        true
    ),
    (
        'c0000000-0000-0000-0000-000000000005',
        'ACCOUNTANT',
        'Contabilidad y Revisoría',
        'Supervisión de libros fiscales, liquidación de IVA, medios magnéticos (Exógena) y auditoría contable.',
        'ALL_LOCATIONS',
        true
    ),
    (
        'c0000000-0000-0000-0000-000000000006',
        'SELLER',
        'Asesor Comercial / Preventa',
        'Emisión de cotizaciones, pedidos, remisiones y consulta de catálogo y disponibilidad de inventario.',
        'ASSIGNED_LOCATION',
        true
    ),
    (
        'c0000000-0000-0000-0000-000000000007',
        'CASHIER',
        'Cajero de Punto de Venta',
        'Registro de cobros presenciales en caja registradora, emisión de tirillas POS y arqueos de turno.',
        'ASSIGNED_LOCATION',
        true
    )
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    scope = EXCLUDED.scope;

-- 2. Inserción de Permisos Atómicos de Seguridad
INSERT INTO public.permissions (code, module, description)
VALUES 
    -- Bodegas e Inventario
    ('warehouses.read', 'warehouses', 'Ver listado y detalle de bodegas'),
    ('warehouses.write', 'warehouses', 'Crear y editar bodegas'),
    ('inventory.read', 'inventory', 'Consultar catálogo de existencias y disponibilidad'),
    ('inventory.adjust', 'inventory', 'Efectuar ajustes de inventario de entrada o salida'),
    ('inventory.transfer', 'inventory', 'Crear y despachar traslados entre bodegas'),
    ('kardex.read', 'kardex', 'Consultar movimientos históricos de Kardex'),
    -- Productos y Catálogo Maestro
    ('products.read', 'products', 'Consultar catálogo maestro de productos'),
    ('products.create', 'products', 'Crear nuevos productos en catálogo maestro'),
    ('products.update', 'products', 'Modificar información y precios de productos'),
    ('products.delete', 'products', 'Eliminar o inactivar productos del catálogo'),
    -- Compras y Proveedores
    ('purchases.read', 'purchases', 'Consultar órdenes y compras a proveedores'),
    ('purchases.create', 'purchases', 'Registrar compras y recepciones de mercancía'),
    ('suppliers.read', 'suppliers', 'Consultar directorio de proveedores'),
    ('suppliers.write', 'suppliers', 'Crear y editar condiciones comerciales de proveedores'),
    -- Ventas y POS
    ('sales.read', 'sales', 'Consultar historial de ventas'),
    ('sales.create', 'sales', 'Registrar ventas comerciales'),
    ('sales.cancel', 'sales', 'Anular o devolver ventas emitidas'),
    ('pos.access', 'pos', 'Ingresar a la terminal de punto de venta POS'),
    ('pos.cash_register', 'pos', 'Apertura, arqueo y cierre de turnos de caja'),
    ('invoices.read', 'invoices', 'Consultar facturas electrónicas emitidas'),
    ('invoices.create', 'invoices', 'Emitir facturación electrónica ante la DIAN'),
    ('invoices.cancel', 'invoices', 'Emitir notas crédito y cancelaciones DIAN'),
    ('remissions.read', 'remissions', 'Consultar remisiones de entrega'),
    ('remissions.create', 'remissions', 'Generar remisiones de despacho'),
    -- Clientes
    ('customers.read', 'customers', 'Consultar directorio de clientes y cartera'),
    ('customers.write', 'customers', 'Crear y modificar clientes y cupos de crédito'),
    -- Contabilidad, Impuestos y Finanzas
    ('taxes.read', 'taxes', 'Consultar tarifas y retenciones DIAN'),
    ('taxes.write', 'taxes', 'Configurar impuestos'),
    ('accounting.read', 'accounting', 'Consultar balance general, estado de resultados y libros contables'),
    ('accounting.post', 'accounting', 'Asentar y contabilizar comprobantes contables'),
    ('cost.read', 'financial', 'Visualizar costos unitarios, márgenes de ganancia y utilidad bruta'),
    ('financial.read', 'financial', 'Consultar estadísticas financieras y rentabilidad de ventas'),
    ('exogena.read', 'exogena', 'Ver formatos de medios magnéticos DIAN'),
    ('exogena.export', 'exogena', 'Exportar formatos de medios magnéticos'),
    -- Usuarios y Auditoría
    ('users.read', 'users', 'Consultar miembros de equipo y roles'),
    ('users.create', 'users', 'Crear nuevos colaboradores'),
    ('users.update', 'users', 'Modificar roles y asignación de bodegas'),
    ('users.activate', 'users', 'Activar o desactivar colaboradores'),
    ('audit.read', 'audit', 'Consultar registro de eventos y auditoría forense'),
    ('settings.manage', 'settings', 'Configurar parámetros generales y legales de la empresa')
ON CONFLICT (code) DO NOTHING;

-- 3. Vincular permisos completos al rol SUPERADMIN y ADMIN
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'c0000000-0000-0000-0000-000000000001'::uuid, p.id FROM public.permissions p
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'c0000000-0000-0000-0000-000000000002'::uuid, p.id FROM public.permissions p
WHERE p.code NOT IN ('settings.manage')
ON CONFLICT DO NOTHING;

-- Permisos WAREHOUSE_ADMIN
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'c0000000-0000-0000-0000-000000000003'::uuid, p.id FROM public.permissions p
WHERE p.code IN (
    'warehouses.read', 'inventory.read', 'inventory.adjust', 'inventory.transfer',
    'kardex.read', 'products.read', 'products.create', 'products.update',
    'purchases.read', 'purchases.create', 'suppliers.read', 'remissions.read',
    'audit.read'
)
ON CONFLICT DO NOTHING;

-- Permisos POINT_ADMIN
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'c0000000-0000-0000-0000-000000000004'::uuid, p.id FROM public.permissions p
WHERE p.code IN (
    'products.read', 'sales.read', 'sales.create', 'pos.access', 'pos.cash_register',
    'invoices.read', 'invoices.create', 'customers.read', 'customers.write',
    'remissions.read', 'remissions.create', 'inventory.read', 'audit.read'
)
ON CONFLICT DO NOTHING;

-- Permisos ACCOUNTANT
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'c0000000-0000-0000-0000-000000000005'::uuid, p.id FROM public.permissions p
WHERE p.code IN (
    'products.read', 'taxes.read', 'taxes.write', 'exogena.read', 'exogena.export',
    'invoices.read', 'purchases.read', 'accounting.read', 'accounting.post',
    'cost.read', 'financial.read', 'audit.read'
)
ON CONFLICT DO NOTHING;

-- Permisos SELLER (Solo lectura de productos/inventario y emisión de ventas)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'c0000000-0000-0000-0000-000000000006'::uuid, p.id FROM public.permissions p
WHERE p.code IN (
    'products.read', 'sales.read', 'sales.create', 'customers.read',
    'customers.write', 'inventory.read', 'remissions.read'
)
ON CONFLICT DO NOTHING;

-- Permisos CASHIER (Terminal de cobro y clientes)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'c0000000-0000-0000-0000-000000000007'::uuid, p.id FROM public.permissions p
WHERE p.code IN (
    'products.read', 'pos.access', 'sales.create', 'pos.cash_register', 'customers.read'
)
ON CONFLICT DO NOTHING;

-- 4. Funciones Auxiliares de Seguridad y Permisos RBAC
CREATE OR REPLACE FUNCTION public.get_auth_company_id()
RETURNS UUID AS $$
    SELECT u.company_id
    FROM public.users u
    WHERE u.id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog;

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS VARCHAR AS $$
    SELECT r.code
    FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT public.get_auth_role() = 'SUPERADMIN';
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog;

CREATE OR REPLACE FUNCTION public.has_permission(p_permission_code VARCHAR)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.users u
        JOIN public.role_permissions rp ON u.role_id = rp.role_id
        JOIN public.permissions p ON rp.permission_id = p.id
        WHERE u.id = auth.uid()
          AND p.code = p_permission_code
    ) OR public.is_admin();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog;

CREATE OR REPLACE FUNCTION public.has_any_permission(p_permission_codes VARCHAR[])
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.users u
        JOIN public.role_permissions rp ON u.role_id = rp.role_id
        JOIN public.permissions p ON rp.permission_id = p.id
        WHERE u.id = auth.uid()
          AND p.code = ANY(p_permission_codes)
    ) OR public.is_admin();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog;

CREATE OR REPLACE FUNCTION public.has_location_access(p_location_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_locations ul
        WHERE ul.user_id = auth.uid() AND ul.location_id = p_location_id
    ) OR public.is_admin();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog;

-- 5. Actualización del Trigger de Sincronización Supabase Auth -> public.users
-- REGLA MAESTRA DE SEGURIDAD BOOTSTRAP:
-- 1. La autorización de SUPERADMIN proviene EXCLUSIVAMENTE de raw_app_meta_data (Admin API / service_role).
-- 2. El cliente/navegador NO controla raw_app_meta_data; raw_user_meta_data se ignora totalmente para autorización.
-- 3. Uso de advisory lock transaccional (pg_advisory_xact_lock) para eliminar cualquier condición de carrera.
-- 4. El registro público en Supabase Auth permanece deshabilitado.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    target_role_id UUID;
    v_company_id UUID := NULL;
    v_is_bootstrap BOOLEAN := false;
    v_app_role VARCHAR := NULL;
    v_existing_superadmins INT := 0;
BEGIN
    -- Bloqueo transaccional exclusivo para serializar intentos de registro concurrentes
    PERFORM pg_advisory_xact_lock(742918471);

    -- Extraer metadatos fiduciarios de raw_app_meta_data (Solo administrables por service_role)
    IF NEW.raw_app_meta_data IS NOT NULL THEN
        v_is_bootstrap := COALESCE((NEW.raw_app_meta_data->>'is_bootstrap_admin')::boolean, false);
        v_app_role := NEW.raw_app_meta_data->>'role';

        IF NEW.raw_app_meta_data->>'company_id' IS NOT NULL THEN
            BEGIN
                v_company_id := (NEW.raw_app_meta_data->>'company_id')::uuid;
            EXCEPTION WHEN OTHERS THEN
                v_company_id := NULL;
            END;
        END IF;
    END IF;

    -- Conteo bajo lock de superadministradores existentes
    SELECT COUNT(*) INTO v_existing_superadmins
    FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE r.code = 'SUPERADMIN';

    IF v_is_bootstrap = true AND v_app_role = 'SUPERADMIN' AND v_existing_superadmins = 0 THEN
        -- BOOTSTRAP DEL PRIMER SUPERADMINISTRADOR:
        -- Solo se promueve a SUPERADMIN si:
        -- a) Se especificó en raw_app_meta_data por el servidor (service_role).
        -- b) Cero superadministradores existían previamente.
        SELECT id INTO target_role_id FROM public.roles WHERE code = 'SUPERADMIN';
    ELSIF v_app_role IS NOT NULL AND v_app_role <> 'SUPERADMIN' THEN
        -- Asignación de rol operativo autorizada por el backend
        SELECT id INTO target_role_id FROM public.roles WHERE code = v_app_role;
        IF target_role_id IS NULL THEN
            SELECT id INTO target_role_id FROM public.roles WHERE code = 'SELLER';
        END IF;
    ELSE
        -- Rol restrictivo por defecto. NUNCA SUPERADMIN vía cliente.
        SELECT id INTO target_role_id FROM public.roles WHERE code = 'SELLER';
    END IF;

    -- Inserción fiduciaria en public.users vinculada a auth.users(id)
    INSERT INTO public.users (
        id,
        company_id,
        email,
        full_name,
        role_id,
        phone,
        avatar_url,
        is_active
    ) VALUES (
        NEW.id,
        v_company_id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        target_role_id,
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'avatar_url',
        true
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        company_id = COALESCE(public.users.company_id, EXCLUDED.company_id),
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Purgado de Políticas Preliminares o Redundantes
DROP POLICY IF EXISTS "Superadmin full access companies" ON public.companies;
DROP POLICY IF EXISTS "Superadmin full access locations" ON public.locations;
DROP POLICY IF EXISTS "Superadmin full access products" ON public.products;
DROP POLICY IF EXISTS "Superadmin full access stock" ON public.stock_levels;
DROP POLICY IF EXISTS "Superadmin full access sales" ON public.sales;
DROP POLICY IF EXISTS "Superadmin full access purchases" ON public.purchases;
DROP POLICY IF EXISTS "Superadmin full access accounting" ON public.accounting_entries;
DROP POLICY IF EXISTS "Authenticated users can read categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can read brands" ON public.brands;
DROP POLICY IF EXISTS "Authenticated users can read products" ON public.products;
DROP POLICY IF EXISTS "Users can view sales of their location" ON public.sales;
DROP POLICY IF EXISTS "Users can create sales in their location" ON public.sales;
DROP POLICY IF EXISTS "Users can view stock of their authorized locations" ON public.stock_levels;
DROP POLICY IF EXISTS p_isolate_products_by_company ON public.products;
DROP POLICY IF EXISTS p_isolate_sales_by_company ON public.sales;
DROP POLICY IF EXISTS "Tenant isolation for products" ON public.products;
DROP POLICY IF EXISTS "Tenant isolation for sales" ON public.sales;
DROP POLICY IF EXISTS "Tenant isolation for purchases" ON public.purchases;
DROP POLICY IF EXISTS "Tenant isolation for stock" ON public.stock_levels;
DROP POLICY IF EXISTS "Tenant isolation for accounting" ON public.accounting_entries;
DROP POLICY IF EXISTS "Tenant isolation for inventory movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "Tenant isolation for customers" ON public.customers;
DROP POLICY IF EXISTS "Tenant isolation for suppliers" ON public.suppliers;

-- 7. Asegurar columna company_id en audit_logs si aplica
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'company_id') THEN
        ALTER TABLE public.audit_logs ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT;
        CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON public.audit_logs(company_id);
    END IF;
END $$;

-- 8. Triggers de Inmutabilidad Fiduciaria

-- 8.1 Inmutabilidad de Kardex (inventory_movements)
CREATE OR REPLACE FUNCTION public.fn_prevent_kardex_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Kardex inmutable: No está permitido modificar ni eliminar movimientos de inventario ya registrados (ID: %).', OLD.id
        USING ERRCODE = '23506';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_kardex_mutation ON public.inventory_movements;
CREATE TRIGGER trg_prevent_kardex_mutation
BEFORE UPDATE OR DELETE ON public.inventory_movements
FOR EACH ROW
EXECUTE FUNCTION public.fn_prevent_kardex_mutation();

-- 8.2 Inmutabilidad de Ventas Finalizadas (sales)
CREATE OR REPLACE FUNCTION public.fn_prevent_sale_deletion()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Ventas inmutables: No está permitido eliminar físicamente registros de venta (Venta: %). Las anulaciones deben realizarse mediante flujo de trazabilidad contable.', OLD.sale_number
        USING ERRCODE = '23506';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_sale_deletion ON public.sales;
CREATE TRIGGER trg_prevent_sale_deletion
BEFORE DELETE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.fn_prevent_sale_deletion();

-- 8.3 Inmutabilidad de Compras Recibidas (purchases)
CREATE OR REPLACE FUNCTION public.fn_prevent_received_purchase_deletion()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.inventory_status = 'RECEIVED' THEN
        RAISE EXCEPTION 'Compras inmutables: No está permitido eliminar compras con mercancía recibida (Compra: %). Debe tramitarse devolución a proveedor.', OLD.purchase_number
            USING ERRCODE = '23506';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_received_purchase_deletion ON public.purchases;
CREATE TRIGGER trg_prevent_received_purchase_deletion
BEFORE DELETE ON public.purchases
FOR EACH ROW
EXECUTE FUNCTION public.fn_prevent_received_purchase_deletion();

-- 8.4 Inmutabilidad de Asientos Contables POSTED (accounting_entries)
CREATE OR REPLACE FUNCTION public.fn_prevent_posted_accounting_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'POSTED' THEN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'Contabilidad inmutable: No está permitido eliminar un comprobante contable en estado POSTED (Asiento: %). Debe anularse mediante reversión formal.', OLD.entry_number
                USING ERRCODE = '23506';
        ELSIF TG_OP = 'UPDATE' AND (NEW.status <> 'REVERSED' OR OLD.date <> NEW.date OR OLD.concept <> NEW.concept) THEN
            RAISE EXCEPTION 'Contabilidad inmutable: No está permitido modificar un comprobante contable en estado POSTED (Asiento: %).', OLD.entry_number
                USING ERRCODE = '23506';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_posted_accounting_mutation ON public.accounting_entries;
CREATE TRIGGER trg_prevent_posted_accounting_mutation
BEFORE UPDATE OR DELETE ON public.accounting_entries
FOR EACH ROW
EXECUTE FUNCTION public.fn_prevent_posted_accounting_mutation();

-- 8.5 Inmutabilidad de Líneas Contables de Asientos POSTED (accounting_entry_lines)
CREATE OR REPLACE FUNCTION public.fn_prevent_posted_entry_lines_mutation()
RETURNS TRIGGER AS $$
DECLARE
    parent_status accounting_entry_status;
BEGIN
    SELECT status INTO parent_status FROM public.accounting_entries WHERE id = OLD.entry_id;
    IF parent_status = 'POSTED' THEN
        RAISE EXCEPTION 'Contabilidad inmutable: No está permitido alterar líneas de un comprobante contable en estado POSTED.'
            USING ERRCODE = '23506';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_posted_entry_lines_mutation ON public.accounting_entry_lines;
CREATE TRIGGER trg_prevent_posted_entry_lines_mutation
BEFORE UPDATE OR DELETE ON public.accounting_entry_lines
FOR EACH ROW
EXECUTE FUNCTION public.fn_prevent_posted_entry_lines_mutation();

-- 8.6 Inmutabilidad de Logs de Auditoría (audit_logs)
CREATE OR REPLACE FUNCTION public.fn_prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Auditoría inmutable: Los registros de auditoría no pueden ser alterados ni eliminados.'
        USING ERRCODE = '23506';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_mutation ON public.audit_logs;
CREATE TRIGGER trg_prevent_audit_log_mutation
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.fn_prevent_audit_log_mutation();

-- 9. MATRIZ DE POLÍTICAS RLS DEFINITIVAS (TENANT + LOCATION + ROLES + PERMISOS)

-- 9.1. EMPRESAS (public.companies)
DROP POLICY IF EXISTS "Tenant isolation select company" ON public.companies;
CREATE POLICY "Tenant isolation select company" ON public.companies
FOR SELECT TO authenticated
USING (id = public.get_auth_company_id());

DROP POLICY IF EXISTS "Tenant isolation update company" ON public.companies;
CREATE POLICY "Tenant isolation update company" ON public.companies
FOR UPDATE TO authenticated
USING (id = public.get_auth_company_id() AND (public.is_admin() OR public.has_permission('settings.manage')))
WITH CHECK (id = public.get_auth_company_id() AND (public.is_admin() OR public.has_permission('settings.manage')));

DROP POLICY IF EXISTS "Allow bootstrap company creation" ON public.companies;
CREATE POLICY "Allow bootstrap company creation" ON public.companies
FOR INSERT TO authenticated
WITH CHECK (public.get_auth_company_id() IS NULL AND public.is_admin());

-- 9.2. SEDES / BODEGAS (public.locations)
DROP POLICY IF EXISTS "Tenant isolation select locations" ON public.locations;
CREATE POLICY "Tenant isolation select locations" ON public.locations
FOR SELECT TO authenticated
USING (company_id = public.get_auth_company_id());

DROP POLICY IF EXISTS "Tenant isolation insert locations" ON public.locations;
CREATE POLICY "Tenant isolation insert locations" ON public.locations
FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_auth_company_id() AND (public.is_admin() OR public.has_permission('warehouses.write')));

DROP POLICY IF EXISTS "Tenant isolation update locations" ON public.locations;
CREATE POLICY "Tenant isolation update locations" ON public.locations
FOR UPDATE TO authenticated
USING (company_id = public.get_auth_company_id() AND (public.is_admin() OR public.has_permission('warehouses.write')))
WITH CHECK (company_id = public.get_auth_company_id() AND (public.is_admin() OR public.has_permission('warehouses.write')));

DROP POLICY IF EXISTS "Tenant isolation delete locations" ON public.locations;
CREATE POLICY "Tenant isolation delete locations" ON public.locations
FOR DELETE TO authenticated
USING (company_id = public.get_auth_company_id() AND public.is_admin());

-- 9.3. PRODUCTOS (public.products)
-- SELLER y CASHIER solo tienen permiso 'products.read'. Modificaciones prohibidas.
DROP POLICY IF EXISTS "Tenant isolation select products" ON public.products;
CREATE POLICY "Tenant isolation select products" ON public.products
FOR SELECT TO authenticated
USING (
    company_id = public.get_auth_company_id() 
    AND (is_active = true OR public.is_admin() OR public.has_any_permission(ARRAY['inventory.read', 'products.read']))
);

DROP POLICY IF EXISTS "Tenant isolation insert products" ON public.products;
CREATE POLICY "Tenant isolation insert products" ON public.products
FOR INSERT TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id() 
    AND (public.is_admin() OR public.has_permission('products.create') OR public.has_permission('inventory.adjust'))
);

DROP POLICY IF EXISTS "Tenant isolation update products" ON public.products;
CREATE POLICY "Tenant isolation update products" ON public.products
FOR UPDATE TO authenticated
USING (
    company_id = public.get_auth_company_id() 
    AND (public.is_admin() OR public.has_permission('products.update') OR public.has_permission('inventory.adjust'))
)
WITH CHECK (
    company_id = public.get_auth_company_id() 
    AND (public.is_admin() OR public.has_permission('products.update') OR public.has_permission('inventory.adjust'))
);

DROP POLICY IF EXISTS "Tenant isolation delete products" ON public.products;
CREATE POLICY "Tenant isolation delete products" ON public.products
FOR DELETE TO authenticated
USING (
    company_id = public.get_auth_company_id() 
    AND (public.is_admin() OR public.has_permission('products.delete'))
);

-- 9.4. EXISTENCIAS AGREGADAS (public.stock_levels)
-- CRÍTICO: SOLO SELECT permitido para usuarios normales.
-- INSERT, UPDATE y DELETE están expresamente PROHIBIDOS para clientes.
-- El stock cambia EXCLUSIVAMENTE vía trigger process_inventory_movement() (SECURITY DEFINER).
DROP POLICY IF EXISTS "Tenant isolation select stock" ON public.stock_levels;
CREATE POLICY "Tenant isolation select stock" ON public.stock_levels
FOR SELECT TO authenticated
USING (
    company_id = public.get_auth_company_id() 
    AND (public.has_location_access(location_id) OR public.is_admin())
);

-- 9.5. MOVIMIENTOS KARDEX (public.inventory_movements)
-- Inmutable: Permitido SELECT e INSERT autorizado. UPDATE y DELETE prohibidos.
DROP POLICY IF EXISTS "Tenant isolation select movements" ON public.inventory_movements;
CREATE POLICY "Tenant isolation select movements" ON public.inventory_movements
FOR SELECT TO authenticated
USING (
    company_id = public.get_auth_company_id() 
    AND (public.has_location_access(location_id) OR public.is_admin())
    AND (public.has_permission('kardex.read') OR public.has_permission('inventory.read') OR public.is_admin())
);

DROP POLICY IF EXISTS "Tenant isolation insert movements" ON public.inventory_movements;
CREATE POLICY "Tenant isolation insert movements" ON public.inventory_movements
FOR INSERT TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id() 
    AND (public.has_location_access(location_id) OR public.is_admin())
    AND (public.has_any_permission(ARRAY['inventory.adjust', 'inventory.transfer', 'purchases.create', 'sales.create', 'remissions.create']) OR public.is_admin())
);

-- 9.6. VENTAS Y DETALLES (public.sales y public.sale_items)
DROP POLICY IF EXISTS "Tenant isolation select sales" ON public.sales;
CREATE POLICY "Tenant isolation select sales" ON public.sales
FOR SELECT TO authenticated
USING (
    company_id = public.get_auth_company_id() 
    AND (public.has_location_access(location_id) OR public.is_admin())
    AND (public.has_permission('sales.read') OR public.is_admin())
);

DROP POLICY IF EXISTS "Tenant isolation insert sales" ON public.sales;
CREATE POLICY "Tenant isolation insert sales" ON public.sales
FOR INSERT TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id() 
    AND (public.has_location_access(location_id) OR public.is_admin())
    AND (public.has_permission('sales.create') OR public.is_admin())
);

DROP POLICY IF EXISTS "Tenant isolation update sales" ON public.sales;
CREATE POLICY "Tenant isolation update sales" ON public.sales
FOR UPDATE TO authenticated
USING (
    company_id = public.get_auth_company_id() 
    AND (public.has_location_access(location_id) OR public.is_admin())
    AND (public.has_permission('sales.cancel') OR public.is_admin())
)
WITH CHECK (
    company_id = public.get_auth_company_id() 
    AND (public.has_location_access(location_id) OR public.is_admin())
    AND (public.has_permission('sales.cancel') OR public.is_admin())
);

DROP POLICY IF EXISTS "Tenant isolation select sale_items" ON public.sale_items;
CREATE POLICY "Tenant isolation select sale_items" ON public.sale_items
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.sales s
        WHERE s.id = sale_id
          AND s.company_id = public.get_auth_company_id()
          AND (public.has_location_access(s.location_id) OR public.is_admin())
    )
);

DROP POLICY IF EXISTS "Tenant isolation insert sale_items" ON public.sale_items;
CREATE POLICY "Tenant isolation insert sale_items" ON public.sale_items
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.sales s
        WHERE s.id = sale_id
          AND s.company_id = public.get_auth_company_id()
          AND (public.has_location_access(s.location_id) OR public.is_admin())
          AND (public.has_permission('sales.create') OR public.is_admin())
    )
);

-- 9.7. COMPRAS Y DETALLES (public.purchases y public.purchase_items)
DROP POLICY IF EXISTS "Tenant isolation select purchases" ON public.purchases;
CREATE POLICY "Tenant isolation select purchases" ON public.purchases
FOR SELECT TO authenticated
USING (
    company_id = public.get_auth_company_id() 
    AND (public.has_location_access(location_id) OR public.is_admin())
    AND (public.has_permission('purchases.read') OR public.is_admin())
);

DROP POLICY IF EXISTS "Tenant isolation insert purchases" ON public.purchases;
CREATE POLICY "Tenant isolation insert purchases" ON public.purchases
FOR INSERT TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id() 
    AND (public.has_location_access(location_id) OR public.is_admin())
    AND (public.has_permission('purchases.create') OR public.is_admin())
);

DROP POLICY IF EXISTS "Tenant isolation update purchases" ON public.purchases;
CREATE POLICY "Tenant isolation update purchases" ON public.purchases
FOR UPDATE TO authenticated
USING (
    company_id = public.get_auth_company_id() 
    AND (public.has_location_access(location_id) OR public.is_admin())
    AND (public.has_permission('purchases.create') OR public.is_admin())
    AND (inventory_status = 'PENDING' OR public.is_admin())
)
WITH CHECK (
    company_id = public.get_auth_company_id() 
    AND (public.has_location_access(location_id) OR public.is_admin())
    AND (public.has_permission('purchases.create') OR public.is_admin())
    AND (inventory_status = 'PENDING' OR public.is_admin())
);

DROP POLICY IF EXISTS "Tenant isolation select purchase_items" ON public.purchase_items;
CREATE POLICY "Tenant isolation select purchase_items" ON public.purchase_items
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.purchases p
        WHERE p.id = purchase_id
          AND p.company_id = public.get_auth_company_id()
          AND (public.has_location_access(p.location_id) OR public.is_admin())
    )
);

DROP POLICY IF EXISTS "Tenant isolation insert purchase_items" ON public.purchase_items;
CREATE POLICY "Tenant isolation insert purchase_items" ON public.purchase_items
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.purchases p
        WHERE p.id = purchase_id
          AND p.company_id = public.get_auth_company_id()
          AND (public.has_location_access(p.location_id) OR public.is_admin())
          AND (public.has_permission('purchases.create') OR public.is_admin())
          AND p.inventory_status = 'PENDING'
    )
);

-- 9.8. CLIENTES Y PROVEEDORES (public.customers y public.suppliers)
DROP POLICY IF EXISTS "Tenant isolation select customers" ON public.customers;
CREATE POLICY "Tenant isolation select customers" ON public.customers
FOR SELECT TO authenticated
USING (company_id = public.get_auth_company_id() AND (public.has_permission('customers.read') OR public.is_admin()));

DROP POLICY IF EXISTS "Tenant isolation insert customers" ON public.customers;
CREATE POLICY "Tenant isolation insert customers" ON public.customers
FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_auth_company_id() AND (public.has_permission('customers.write') OR public.is_admin()));

DROP POLICY IF EXISTS "Tenant isolation update customers" ON public.customers;
CREATE POLICY "Tenant isolation update customers" ON public.customers
FOR UPDATE TO authenticated
USING (company_id = public.get_auth_company_id() AND (public.has_permission('customers.write') OR public.is_admin()))
WITH CHECK (company_id = public.get_auth_company_id() AND (public.has_permission('customers.write') OR public.is_admin()));

DROP POLICY IF EXISTS "Tenant isolation delete customers" ON public.customers;
CREATE POLICY "Tenant isolation delete customers" ON public.customers
FOR DELETE TO authenticated
USING (company_id = public.get_auth_company_id() AND public.is_admin());

DROP POLICY IF EXISTS "Tenant isolation select suppliers" ON public.suppliers;
CREATE POLICY "Tenant isolation select suppliers" ON public.suppliers
FOR SELECT TO authenticated
USING (company_id = public.get_auth_company_id() AND (public.has_permission('suppliers.read') OR public.is_admin()));

DROP POLICY IF EXISTS "Tenant isolation insert suppliers" ON public.suppliers;
CREATE POLICY "Tenant isolation insert suppliers" ON public.suppliers
FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_auth_company_id() AND (public.has_permission('suppliers.write') OR public.is_admin()));

DROP POLICY IF EXISTS "Tenant isolation update suppliers" ON public.suppliers;
CREATE POLICY "Tenant isolation update suppliers" ON public.suppliers
FOR UPDATE TO authenticated
USING (company_id = public.get_auth_company_id() AND (public.has_permission('suppliers.write') OR public.is_admin()))
WITH CHECK (company_id = public.get_auth_company_id() AND (public.has_permission('suppliers.write') OR public.is_admin()));

DROP POLICY IF EXISTS "Tenant isolation delete suppliers" ON public.suppliers;
CREATE POLICY "Tenant isolation delete suppliers" ON public.suppliers
FOR DELETE TO authenticated
USING (company_id = public.get_auth_company_id() AND public.is_admin());

-- 9.9. CONTABILIDAD (public.accounting_entries y public.accounting_entry_lines)
-- DRAFT: modificable y eliminable por usuario autorizado.
-- POSTED: inmutable fiduciariamente. Eliminación y edición prohibidas.
DROP POLICY IF EXISTS "Tenant isolation select accounting" ON public.accounting_entries;
CREATE POLICY "Tenant isolation select accounting" ON public.accounting_entries
FOR SELECT TO authenticated
USING (
    company_id = public.get_auth_company_id() 
    AND (public.is_admin() OR public.has_permission('accounting.read') OR public.get_auth_role() = 'ACCOUNTANT')
);

DROP POLICY IF EXISTS "Tenant isolation insert accounting" ON public.accounting_entries;
CREATE POLICY "Tenant isolation insert accounting" ON public.accounting_entries
FOR INSERT TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id() 
    AND (public.is_admin() OR public.has_permission('accounting.post') OR public.get_auth_role() = 'ACCOUNTANT')
);

DROP POLICY IF EXISTS "Tenant isolation update accounting" ON public.accounting_entries;
CREATE POLICY "Tenant isolation update accounting" ON public.accounting_entries
FOR UPDATE TO authenticated
USING (
    company_id = public.get_auth_company_id() 
    AND status = 'DRAFT'
    AND (public.is_admin() OR public.has_permission('accounting.post') OR public.get_auth_role() = 'ACCOUNTANT')
)
WITH CHECK (
    company_id = public.get_auth_company_id() 
    AND (public.is_admin() OR public.has_permission('accounting.post') OR public.get_auth_role() = 'ACCOUNTANT')
);

DROP POLICY IF EXISTS "Tenant isolation delete accounting" ON public.accounting_entries;
CREATE POLICY "Tenant isolation delete accounting" ON public.accounting_entries
FOR DELETE TO authenticated
USING (
    company_id = public.get_auth_company_id() 
    AND status = 'DRAFT'
    AND (public.is_admin() OR public.get_auth_role() = 'ACCOUNTANT')
);

-- accounting_entry_lines (hereda seguridad de accounting_entries)
DROP POLICY IF EXISTS "Inherit security select entry_lines" ON public.accounting_entry_lines;
CREATE POLICY "Inherit security select entry_lines" ON public.accounting_entry_lines
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.accounting_entries ae
        WHERE ae.id = entry_id
          AND ae.company_id = public.get_auth_company_id()
          AND (public.is_admin() OR public.has_permission('accounting.read') OR public.get_auth_role() = 'ACCOUNTANT')
    )
);

DROP POLICY IF EXISTS "Inherit security insert entry_lines" ON public.accounting_entry_lines;
CREATE POLICY "Inherit security insert entry_lines" ON public.accounting_entry_lines
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.accounting_entries ae
        WHERE ae.id = entry_id
          AND ae.company_id = public.get_auth_company_id()
          AND ae.status = 'DRAFT'
          AND (public.is_admin() OR public.has_permission('accounting.post') OR public.get_auth_role() = 'ACCOUNTANT')
    )
);

DROP POLICY IF EXISTS "Inherit security update entry_lines" ON public.accounting_entry_lines;
CREATE POLICY "Inherit security update entry_lines" ON public.accounting_entry_lines
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.accounting_entries ae
        WHERE ae.id = entry_id
          AND ae.company_id = public.get_auth_company_id()
          AND ae.status = 'DRAFT'
          AND (public.is_admin() OR public.has_permission('accounting.post') OR public.get_auth_role() = 'ACCOUNTANT')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.accounting_entries ae
        WHERE ae.id = entry_id
          AND ae.company_id = public.get_auth_company_id()
          AND ae.status = 'DRAFT'
          AND (public.is_admin() OR public.has_permission('accounting.post') OR public.get_auth_role() = 'ACCOUNTANT')
    )
);

DROP POLICY IF EXISTS "Inherit security delete entry_lines" ON public.accounting_entry_lines;
CREATE POLICY "Inherit security delete entry_lines" ON public.accounting_entry_lines
FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.accounting_entries ae
        WHERE ae.id = entry_id
          AND ae.company_id = public.get_auth_company_id()
          AND ae.status = 'DRAFT'
          AND (public.is_admin() OR public.get_auth_role() = 'ACCOUNTANT')
    )
);

-- 9.10. AUDITORÍA (public.audit_logs)
-- REGLA CRÍTICA:
-- SELECT: solo usuarios con permiso 'audit.read' dentro de su company_id.
-- INSERT: PROHIBIDO desde clientes autenticados. Solo triggers SECURITY DEFINER y service_role.
-- UPDATE: PROHIBIDO (cubierto por trigger fn_prevent_audit_log_mutation).
-- DELETE: PROHIBIDO (cubierto por trigger fn_prevent_audit_log_mutation).
DROP POLICY IF EXISTS "Tenant isolation select audit_logs" ON public.audit_logs;
CREATE POLICY "Tenant isolation select audit_logs" ON public.audit_logs
FOR SELECT TO authenticated
USING (
    company_id = public.get_auth_company_id() 
    AND (public.is_admin() OR public.has_permission('audit.read'))
);

-- INSERT directo desde clientes: EXPLÍCITAMENTE PROHIBIDO.
-- Los registros de auditoría se generan únicamente a través de:
--   1. Triggers PostgreSQL con SECURITY DEFINER.
--   2. Funciones RPC con SECURITY DEFINER autorizadas por el backend.
--   3. Scripts server-side con SUPABASE_SERVICE_ROLE_KEY (nunca en cliente).
DROP POLICY IF EXISTS "Tenant isolation insert audit_logs" ON public.audit_logs;
-- No se crea ninguna política INSERT TO authenticated.
-- La inserción se realiza bajo el contexto del trigger (SECURITY DEFINER) o service_role,
-- que operan fuera de las restricciones RLS del rol 'authenticated'.
