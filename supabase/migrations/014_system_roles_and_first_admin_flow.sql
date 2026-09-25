-- ==============================================================================
-- 014_SYSTEM_ROLES_AND_FIRST_ADMIN_FLOW.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Roles del Sistema, Matriz de Permisos y Flujo del Primer Administrador
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
    ('inventory.read', 'inventory', 'Consultar catálogo de existencias y costos'),
    ('inventory.adjust', 'inventory', 'Efectuar ajustes de inventario de entrada o salida'),
    ('inventory.transfer', 'inventory', 'Crear y despachar traslados entre bodegas'),
    ('kardex.read', 'kardex', 'Consultar movimientos históricos de Kardex'),
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

-- 3. Vincular permisos completos al rol SUPERADMIN
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
    'c0000000-0000-0000-0000-000000000001'::uuid,
    p.id
FROM public.permissions p
ON CONFLICT DO NOTHING;

-- 4. Actualización del Trigger de Sincronización Supabase Auth -> public.users
-- REGLA MAESTRA:
-- El PRIMER usuario que se registre en Supabase Auth se convierte AUTOMÁTICAMENTE en SUPERADMIN.
-- Los siguientes usuarios se crean con el rol solicitado en metadata o SELLER por defecto.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    target_role_id UUID;
    total_users_count INT;
BEGIN
    -- Contar usuarios ya existentes en public.users
    SELECT COUNT(*) INTO total_users_count FROM public.users;

    IF total_users_count = 0 THEN
        -- PRIMER USUARIO DEL SISTEMA -> SUPERADMIN AUTOMÁTICO
        SELECT id INTO target_role_id FROM public.roles WHERE code = 'SUPERADMIN';
    ELSE
        -- USUARIOS SUBSIGUIENTES -> Rol en metadata o SELLER
        SELECT id INTO target_role_id FROM public.roles WHERE code = COALESCE(NEW.raw_user_meta_data->>'role', 'SELLER');
        IF target_role_id IS NULL THEN
            SELECT id INTO target_role_id FROM public.roles WHERE code = 'SELLER';
        END IF;
    END IF;

    -- Inserción fiduciaria en public.users vinculada a auth.users(id)
    INSERT INTO public.users (
        id,
        email,
        full_name,
        role_id,
        phone,
        avatar_url,
        is_active
    ) VALUES (
        NEW.id,
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
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
