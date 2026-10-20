-- ==============================================================================
-- 057_DEFINITIVE_RBAC_7_ROLES_AND_PRICE_APPROVALS.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Implementación Definitiva de los 7 Roles del ERP, Flujo de Aprobación de Precios
-- y Restricciones de Ubicación (Bodega / Punto de Venta / Caja)
-- ==============================================================================

-- 1. Inserción / Configuración de los 7 Roles Definitivos del ERP
-- (Los roles legacy como SUPERADMIN, WAREHOUSE_ADMIN, etc. se preservan intactos)
INSERT INTO public.roles (id, code, name, description, scope, is_system)
VALUES 
    (
        'c0000000-0000-0000-0000-000000000002',
        'ADMIN',
        'Administrador General',
        'Control administrativo, operativo, financiero y de seguridad completo del ERP en todas las sedes.',
        'ALL_LOCATIONS',
        true
    ),
    (
        'c0000000-0000-0000-0000-000000000010',
        'JEFE_INGRESOS_SALIDAS',
        'Jefe de Ingresos y Salidas Operativa',
        'Gestión de entradas y salidas operativas, transferencias, costos, caja menor y solicitud de cambios de precios.',
        'ALL_LOCATIONS',
        true
    ),
    (
        'c0000000-0000-0000-0000-000000000011',
        'FACTURACION_POS',
        'Facturación POS',
        'Operación de terminal de facturación POS y consulta de facturas POS emitidas en su sede.',
        'ASSIGNED_LOCATION',
        true
    ),
    (
        'c0000000-0000-0000-0000-000000000012',
        'ENCARGADA_VENTA',
        'Encargada de Venta',
        'Operación de caja asignada, recepción y cobro de tickets de venta, movimiento y descargo de inventario en su punto.',
        'ASSIGNED_LOCATION',
        true
    ),
    (
        'c0000000-0000-0000-0000-000000000013',
        'VENDEDORES',
        'Vendedores',
        'Creación y registro de ventas comerciales y generación de tickets preventa para cobro posterior.',
        'ASSIGNED_LOCATION',
        true
    ),
    (
        'c0000000-0000-0000-0000-000000000014',
        'JEFE_BODEGA',
        'Jefe de Bodega',
        'Gestión física, consulta de existencias, recepciones y transferencias de la bodega asignada.',
        'ASSIGNED_LOCATION',
        true
    ),
    (
        'c0000000-0000-0000-0000-000000000015',
        'RECURSOS_HUMANOS',
        'Recursos Humanos',
        'Gestión de colaboradores, información laboral, terceros de nómina y consulta de personal.',
        'ALL_LOCATIONS',
        true
    )
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    scope = EXCLUDED.scope,
    is_system = true;

-- 2. Inserción de Permisos Granulares Adicionales
INSERT INTO public.permissions (code, module, description)
VALUES 
    ('prices.request', 'products', 'Solicitar modificaciones de precios para aprobación administrativa'),
    ('prices.approve', 'products', 'Aprobar o rechazar solicitudes de cambio de precios'),
    ('costs.manage', 'financial', 'Registrar y modificar costos unitarios de adquisición'),
    ('treasury.petty_cash', 'treasury', 'Apertura y gestión de fondos de caja menor')
ON CONFLICT (code) DO UPDATE
SET description = EXCLUDED.description;

-- 3. Asignación de Permisos en public.role_permissions para los 7 Roles

-- A. ADMIN: Acceso completo a todos los permisos existentes y nuevos
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'c0000000-0000-0000-0000-000000000002'::uuid, p.id
FROM public.permissions p
ON CONFLICT DO NOTHING;

-- Asegurar también SUPERADMIN legacy con permisos completos
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'c0000000-0000-0000-0000-000000000001'::uuid, p.id
FROM public.permissions p
ON CONFLICT DO NOTHING;

-- B. JEFE DE INGRESOS Y SALIDAS OPERATIVA
-- Permisos: proponer precios (NO aprobar), costos, transferencias, caja menor, clientes, mover inventario
DELETE FROM public.role_permissions WHERE role_id = 'c0000000-0000-0000-0000-000000000010'::uuid;
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'c0000000-0000-0000-0000-000000000010'::uuid, p.id
FROM public.permissions p
WHERE p.code IN (
    'prices.request',          -- Solicitar cambios de precios (queda PENDIENTE)
    'costs.manage',            -- Agregar y modificar costos
    'cost.read',               -- Visualizar costos
    'inventory.read',          -- Consultar inventario
    'inventory.adjust',        -- Mover inventario de puntos y bodegas
    'inventory.transfer',      -- Realizar transferencias interlogísticas
    'kardex.read',             -- Consultar movimientos históricos de Kardex
    'warehouses.read',         -- Ver bodegas
    'products.read',           -- Consultar catálogo de productos
    'customers.read',          -- Consultar clientes
    'customers.write',         -- Agregar y editar clientes
    'purchases.read',          -- Consultar compras y recepciones
    'remissions.read',         -- Consultar remisiones
    'remissions.create',       -- Crear remisiones
    'treasury.read',           -- Consultar tesorería
    'treasury.create',         -- Crear operaciones de tesorería
    'treasury.petty_cash',     -- Gestionar caja menor
    'audit.read'               -- Consultar auditoría operativa
)
ON CONFLICT DO NOTHING;

-- C. FACTURACIÓN POS
-- Permisos: ventas POS, consultar factura POS, catálogo y clientes básicos
DELETE FROM public.role_permissions WHERE role_id = 'c0000000-0000-0000-0000-000000000011'::uuid;
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'c0000000-0000-0000-0000-000000000011'::uuid, p.id
FROM public.permissions p
WHERE p.code IN (
    'pos.access',              -- Acceso a la terminal POS
    'sales.create',            -- Registrar venta POS
    'sales.read',              -- Consultar ventas realizadas
    'invoices.read',           -- Visualizar factura POS
    'products.read',           -- Consultar productos
    'inventory.read',          -- Consultar disponibilidad
    'customers.read'           -- Consultar clientes
)
ON CONFLICT DO NOTHING;

-- D. ENCARGADA DE VENTA
-- Permisos: operar caja asignada, escanear tickets, realizar cobro, mover/descargar inventario de su punto
-- DENEGADO ABSOLUTO: products.update, prices.request, prices.approve
DELETE FROM public.role_permissions WHERE role_id = 'c0000000-0000-0000-0000-000000000012'::uuid;
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'c0000000-0000-0000-0000-000000000012'::uuid, p.id
FROM public.permissions p
WHERE p.code IN (
    'pos.access',              -- Terminal POS
    'pos.cash_register',       -- Operación y arqueo de caja asignada
    'sales.create',            -- Finalizar y cobrar venta
    'sales.read',              -- Consultar tickets / ventas pendientes
    'invoices.read',           -- Visualizar factura POS emitida
    'inventory.read',          -- Consultar stock de su punto
    'inventory.adjust',        -- Mover inventario de su punto de venta
    'remissions.read',         -- Consultar remisiones
    'remissions.create',       -- Descargar mercancía de su punto asignado
    'products.read',           -- Consultar catálogo (solo lectura)
    'customers.read'           -- Consultar clientes
)
ON CONFLICT DO NOTHING;

-- E. VENDEDORES
-- Permisos: crear venta / ticket preventa, consultar productos y stock de su punto, clientes
-- DENEGADO: pos.cash_register (cobro final es de Encargada de Venta), prices.*, users.*
DELETE FROM public.role_permissions WHERE role_id = 'c0000000-0000-0000-0000-000000000013'::uuid;
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'c0000000-0000-0000-0000-000000000013'::uuid, p.id
FROM public.permissions p
WHERE p.code IN (
    'sales.create',            -- Crear venta / generar orden y ticket
    'sales.read',              -- Consultar sus ventas y tickets emitidos
    'products.read',           -- Consultar catálogo y precios vigentes
    'inventory.read',          -- Consultar existencias de su punto
    'customers.read',          -- Consultar clientes
    'customers.write'          -- Registrar clientes de venta
)
ON CONFLICT DO NOTHING;

-- F. JEFE DE BODEGA
-- Permisos: existencias, inventario, Kardex, ajustes, transferencias de su bodega
-- DENEGADO: prices.*, pos.*, sales.*, users.*, configuración
DELETE FROM public.role_permissions WHERE role_id = 'c0000000-0000-0000-0000-000000000014'::uuid;
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'c0000000-0000-0000-0000-000000000014'::uuid, p.id
FROM public.permissions p
WHERE p.code IN (
    'inventory.read',          -- Consultar inventario
    'inventory.adjust',        -- Ajustes físicos en su bodega asignada
    'inventory.transfer',      -- Despacho y recepción de traslados en su bodega
    'kardex.read',             -- Consultar movimientos históricos de Kardex
    'warehouses.read',         -- Ver bodegas
    'products.read',           -- Consultar catálogo
    'purchases.read',          -- Consultar recepciones de compras
    'remissions.read'          -- Consultar remisiones
)
ON CONFLICT DO NOTHING;

-- G. RECURSOS HUMANOS
-- Permisos: colaboradores, información laboral, terceros tipo empleado
-- DENEGADO: inventario, precios, ventas, compras, DIAN, cajas
DELETE FROM public.role_permissions WHERE role_id = 'c0000000-0000-0000-0000-000000000015'::uuid;
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'c0000000-0000-0000-0000-000000000015'::uuid, p.id
FROM public.permissions p
WHERE p.code IN (
    'users.read',              -- Consultar colaboradores y personal
    'users.create',            -- Registrar colaboradores
    'users.update',            -- Modificar datos de colaboradores
    'users.activate',          -- Activar o inactivar colaboradores
    'customers.read',          -- Consultar terceros / empleados en contabilidad
    'audit.read'               -- Consultar auditoría de eventos de personal
)
ON CONFLICT DO NOTHING;

-- 4. Actualización de la Función Maestra public.is_admin()
-- Soporta tanto el rol definitivo ADMIN como SUPERADMIN legacy
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT public.get_auth_role() IN ('ADMIN', 'SUPERADMIN');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog;

-- 5. Tabla: public.price_change_requests (Flujo de Aprobación de Precios)
CREATE TABLE IF NOT EXISTS public.price_change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    price_list_code VARCHAR(50) NOT NULL DEFAULT 'NORMAL',
    price_list_name VARCHAR(100) NOT NULL DEFAULT 'Precio Normal (Público)',
    previous_price NUMERIC(15,2) NOT NULL CHECK (previous_price >= 0),
    proposed_price NUMERIC(15,2) NOT NULL CHECK (proposed_price >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    requested_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT,
    reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_change_requests_company ON public.price_change_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_price_change_requests_product ON public.price_change_requests(product_id);
CREATE INDEX IF NOT EXISTS idx_price_change_requests_status ON public.price_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_price_change_requests_req_by ON public.price_change_requests(requested_by);

-- 6. RPC: fn_request_price_change
-- Permite solicitar un cambio de precio que queda PENDIENTE de aprobación
CREATE OR REPLACE FUNCTION public.fn_request_price_change(
    p_product_id UUID,
    p_price_list_code VARCHAR,
    p_proposed_price NUMERIC,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_caller_id UUID;
    v_company_id UUID;
    v_current_price NUMERIC(15,2);
    v_price_list_name VARCHAR(100);
    v_request_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado.' USING ERRCODE = '28000';
    END IF;

    v_company_id := public.get_auth_company_id();
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Empresa no identificada para el usuario.' USING ERRCODE = '42501';
    END IF;

    -- Validar permiso prices.request o is_admin()
    IF NOT (public.has_permission('prices.request') OR public.is_admin()) THEN
        RAISE EXCEPTION 'Acceso denegado: No tiene permiso para proponer cambios de precios.' USING ERRCODE = '42501';
    END IF;

    IF p_proposed_price IS NULL OR p_proposed_price < 0 THEN
        RAISE EXCEPTION 'El precio propuesto debe ser mayor o igual a 0.' USING ERRCODE = '22023';
    END IF;

    -- Obtener precio actual desde product_prices
    SELECT price, price_list_name INTO v_current_price, v_price_list_name
    FROM public.product_prices
    WHERE product_id = p_product_id AND price_list_code = p_price_list_code;

    IF NOT FOUND THEN
        -- Si no existe en product_prices, obtener de la tabla products
        IF p_price_list_code = 'MAYORISTA' THEN
            SELECT wholesale_price, 'Precio Mayorista' INTO v_current_price, v_price_list_name
            FROM public.products WHERE id = p_product_id;
        ELSE
            SELECT public_sale_price, 'Precio Normal (Público)' INTO v_current_price, v_price_list_name
            FROM public.products WHERE id = p_product_id;
        END IF;
    END IF;

    v_current_price := COALESCE(v_current_price, 0);
    v_price_list_name := COALESCE(v_price_list_name, 'Precio ' || p_price_list_code);

    -- Insertar solicitud en estado PENDING
    INSERT INTO public.price_change_requests (
        company_id,
        product_id,
        price_list_code,
        price_list_name,
        previous_price,
        proposed_price,
        status,
        requested_by,
        reason
    ) VALUES (
        v_company_id,
        p_product_id,
        p_price_list_code,
        v_price_list_name,
        v_current_price,
        p_proposed_price,
        'PENDING',
        v_caller_id,
        p_reason
    ) RETURNING id INTO v_request_id;

    RETURN jsonb_build_object(
        'success', true,
        'request_id', v_request_id,
        'status', 'PENDING',
        'previous_price', v_current_price,
        'proposed_price', p_proposed_price,
        'message', 'Solicitud de cambio de precio registrada. Pendiente de aprobación por un Administrador.'
    );
END;
$$;

-- 7. RPC: fn_review_price_change
-- Aprueba o rechaza una solicitud de precio. REGLA ESTRICTA: NO AUTOAPROBACIÓN (requested_by != reviewed_by)
CREATE OR REPLACE FUNCTION public.fn_review_price_change(
    p_request_id UUID,
    p_approved BOOLEAN,
    p_review_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_caller_id UUID;
    v_req RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado.' USING ERRCODE = '28000';
    END IF;

    -- Validar permiso prices.approve o is_admin()
    IF NOT (public.has_permission('prices.approve') OR public.is_admin()) THEN
        RAISE EXCEPTION 'Acceso denegado: No tiene permisos administrativos para aprobar o rechazar precios.'
            USING ERRCODE = '42501';
    END IF;

    -- Obtener la solicitud
    SELECT * INTO v_req
    FROM public.price_change_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La solicitud de cambio de precio no existe.' USING ERRCODE = '23503';
    END IF;

    IF v_req.status != 'PENDING' THEN
        RAISE EXCEPTION 'La solicitud ya fue procesada anteriormente (estado actual: %).', v_req.status
            USING ERRCODE = '55001';
    END IF;

    -- REGLA CRÍTICA: Impedir autoaprobación
    IF v_req.requested_by = v_caller_id THEN
        RAISE EXCEPTION 'Acceso denegado: No está permitido autoaprobar solicitudes de precio creadas por usted mismo.'
            USING ERRCODE = '42501';
    END IF;

    IF p_approved THEN
        -- Aplicar nuevo precio en public.product_prices
        UPDATE public.product_prices
        SET price = v_req.proposed_price,
            updated_at = NOW()
        WHERE product_id = v_req.product_id AND price_list_code = v_req.price_list_code;

        -- Actualizar también campo plano en public.products si corresponde
        IF v_req.price_list_code = 'NORMAL' THEN
            UPDATE public.products
            SET public_sale_price = v_req.proposed_price,
                updated_at = NOW()
            WHERE id = v_req.product_id;
        ELSIF v_req.price_list_code = 'MAYORISTA' THEN
            UPDATE public.products
            SET wholesale_price = v_req.proposed_price,
                updated_at = NOW()
            WHERE id = v_req.product_id;
        END IF;

        -- Actualizar solicitud a APPROVED
        UPDATE public.price_change_requests
        SET status = 'APPROVED',
            reviewed_by = v_caller_id,
            reviewed_at = NOW(),
            review_notes = p_review_notes,
            updated_at = NOW()
        WHERE id = p_request_id;

        RETURN jsonb_build_object(
            'success', true,
            'status', 'APPROVED',
            'product_id', v_req.product_id,
            'price_list_code', v_req.price_list_code,
            'applied_price', v_req.proposed_price,
            'message', 'Cambio de precio aprobado y aplicado exitosamente al catálogo.'
        );
    ELSE
        -- Actualizar solicitud a REJECTED
        UPDATE public.price_change_requests
        SET status = 'REJECTED',
            reviewed_by = v_caller_id,
            reviewed_at = NOW(),
            review_notes = p_review_notes,
            updated_at = NOW()
        WHERE id = p_request_id;

        RETURN jsonb_build_object(
            'success', true,
            'status', 'REJECTED',
            'product_id', v_req.product_id,
            'message', 'Solicitud de cambio de precio rechazada.'
        );
    END IF;
END;
$$;

-- 8. Asignación de Caja a Colaboradores (Encargada de Venta)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS assigned_cash_register_id UUID REFERENCES public.cash_registers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_assigned_cash_register ON public.users(assigned_cash_register_id);

-- 9. Políticas RLS para public.price_change_requests
ALTER TABLE public.price_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read price change requests in their company" ON public.price_change_requests;
CREATE POLICY "Users can read price change requests in their company"
ON public.price_change_requests
FOR SELECT
TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND (
        public.is_admin()
        OR public.has_permission('prices.request')
        OR public.has_permission('prices.approve')
    )
);

DROP POLICY IF EXISTS "Users with prices.request can insert price requests" ON public.price_change_requests;
CREATE POLICY "Users with prices.request can insert price requests"
ON public.price_change_requests
FOR INSERT
TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND requested_by = auth.uid()
    AND (public.has_permission('prices.request') OR public.is_admin())
);

DROP POLICY IF EXISTS "Users with prices.approve can update price requests" ON public.price_change_requests;
CREATE POLICY "Users with prices.approve can update price requests"
ON public.price_change_requests
FOR UPDATE
TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND (public.has_permission('prices.approve') OR public.is_admin())
)
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (public.has_permission('prices.approve') OR public.is_admin())
);

-- 10. Concesión de permisos de ejecución
GRANT EXECUTE ON FUNCTION public.fn_request_price_change(UUID, VARCHAR, NUMERIC, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_review_price_change(UUID, BOOLEAN, TEXT) TO authenticated, service_role;
