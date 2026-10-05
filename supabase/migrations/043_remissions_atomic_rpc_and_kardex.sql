-- ============================================================================
-- MIGRACIÓN 043: MÓDULO DE REMISIONES ATÓMICAS, MULTIEMPRESA Y KARDEX REAL
-- ============================================================================

-- 1. Agregar 'DRAFT' a remission_status enum si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
        WHERE pg_type.typname = 'remission_status' AND enumlabel = 'DRAFT'
    ) THEN
        ALTER TYPE public.remission_status ADD VALUE 'DRAFT' BEFORE 'CREATED';
    END IF;
END $$;

-- 2. Campos logísticos y de trazabilidad en public.remissions
ALTER TABLE public.remissions 
    ADD COLUMN IF NOT EXISTS carrier_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS driver_doc VARCHAR(50),
    ADD COLUMN IF NOT EXISTS delivery_address VARCHAR(250),
    ADD COLUMN IF NOT EXISTS delivery_city VARCHAR(100),
    ADD COLUMN IF NOT EXISTS contact_person VARCHAR(150),
    ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES public.users(id),
    ADD COLUMN IF NOT EXISTS dispatched_by_user_id UUID REFERENCES public.users(id),
    ADD COLUMN IF NOT EXISTS delivered_by_user_id UUID REFERENCES public.users(id),
    ADD COLUMN IF NOT EXISTS received_by VARCHAR(150),
    ADD COLUMN IF NOT EXISTS received_doc VARCHAR(50),
    ADD COLUMN IF NOT EXISTS delivery_evidence_notes TEXT,
    ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
    ADD COLUMN IF NOT EXISTS cancelled_by_user_id UUID REFERENCES public.users(id),
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- 3. Campos adicionales en public.remission_items
ALTER TABLE public.remission_items
    ADD COLUMN IF NOT EXISTS delivered_quantity NUMERIC(12,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- 4. Generador de consecutivos de remisión por empresa
CREATE OR REPLACE FUNCTION public.fn_next_remission_code(p_company_id UUID)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_next_val BIGINT;
    v_current_year TEXT;
    v_prefix VARCHAR(50);
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('remission_consecutive_' || p_company_id::text));

    SELECT COALESCE(MAX(
        CASE 
            WHEN code ~ '^REM-[0-9]+$' THEN SUBSTRING(code FROM 5)::BIGINT
            WHEN code ~ '^REM-[0-9]{4}-[0-9]+$' THEN SUBSTRING(code FROM 10)::BIGINT
            ELSE 0 
        END
    ), 0) + 1
    INTO v_next_val
    FROM public.remissions
    WHERE company_id = p_company_id;

    RETURN 'REM-' || LPAD(v_next_val::TEXT, 6, '0');
END;
$$;

-- 5. fn_create_remission
CREATE OR REPLACE FUNCTION public.fn_create_remission(
    p_customer_id UUID,
    p_origin_location_id UUID,
    p_items JSONB,
    p_sale_id UUID DEFAULT NULL,
    p_delivery_address TEXT DEFAULT NULL,
    p_delivery_city TEXT DEFAULT NULL,
    p_contact_person TEXT DEFAULT NULL,
    p_contact_phone TEXT DEFAULT NULL,
    p_carrier_name TEXT DEFAULT NULL,
    p_vehicle_plate TEXT DEFAULT NULL,
    p_driver_name TEXT DEFAULT NULL,
    p_driver_doc TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_as_draft BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_company_id UUID;
    v_user_name VARCHAR(150);
    v_remission_id UUID;
    v_code VARCHAR(50);
    v_customer RECORD;
    v_location RECORD;
    v_initial_status remission_status;
    v_item JSONB;
    v_prod_id UUID;
    v_qty NUMERIC(12,2);
    v_unit_cost NUMERIC(15,2);
    v_unit_price NUMERIC(15,2);
    v_items_count INTEGER := 0;
    v_total_units NUMERIC(12,2) := 0;
BEGIN
    v_user_id := auth.uid();
    v_company_id := public.get_auth_company_id();

    IF v_company_id IS NULL THEN
        SELECT company_id INTO v_company_id FROM public.locations WHERE id = p_origin_location_id;
    END IF;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo determinar la empresa del usuario autenticado.'
            USING ERRCODE = '42501';
    END IF;

    IF NOT (public.has_permission('sales.create') OR public.has_permission('inventory.transfer') OR public.is_admin()) THEN
        RAISE EXCEPTION 'No tienes permisos para crear remisiones.'
            USING ERRCODE = '42501';
    END IF;

    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'La remisión debe contener al menos un producto.'
            USING ERRCODE = '42200';
    END IF;

    -- Validar cliente
    SELECT id, company_id, is_active, address, city INTO v_customer
    FROM public.customers WHERE id = p_customer_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El cliente especificado no existe.' USING ERRCODE = '23503';
    END IF;

    IF v_customer.company_id != v_company_id THEN
        RAISE EXCEPTION 'El cliente pertenece a otra empresa.' USING ERRCODE = '42501';
    END IF;

    IF NOT v_customer.is_active THEN
        RAISE EXCEPTION 'El cliente seleccionado está inactivo.' USING ERRCODE = '42200';
    END IF;

    -- Validar bodega origen
    SELECT id, company_id, status, allow_sales, allow_inventory_ops INTO v_location
    FROM public.locations WHERE id = p_origin_location_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La bodega de origen no existe.' USING ERRCODE = '23503';
    END IF;

    IF v_location.company_id != v_company_id THEN
        RAISE EXCEPTION 'La bodega pertenece a otra empresa.' USING ERRCODE = '42501';
    END IF;

    IF v_location.status != 'ACTIVE' OR (NOT v_location.allow_sales AND NOT v_location.allow_inventory_ops) THEN
        RAISE EXCEPTION 'La bodega no está habilitada para despachos o ventas.' USING ERRCODE = '42200';
    END IF;

    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Usuario Sistema';
    END IF;

    v_initial_status := CASE WHEN p_as_draft THEN 'DRAFT'::remission_status ELSE 'CREATED'::remission_status END;
    v_code := public.fn_next_remission_code(v_company_id);
    v_remission_id := gen_random_uuid();

    INSERT INTO public.remissions (
        id,
        company_id,
        code,
        customer_id,
        origin_location_id,
        sale_id,
        status,
        delivery_address,
        delivery_city,
        contact_person,
        contact_phone,
        carrier_name,
        vehicle_plate,
        driver_name,
        driver_doc,
        notes,
        created_by_user_id,
        created_at,
        updated_at
    ) VALUES (
        v_remission_id,
        v_company_id,
        v_code,
        p_customer_id,
        p_origin_location_id,
        p_sale_id,
        v_initial_status,
        COALESCE(p_delivery_address, v_customer.address),
        COALESCE(p_delivery_city, v_customer.city),
        p_contact_person,
        p_contact_phone,
        p_carrier_name,
        p_vehicle_plate,
        p_driver_name,
        p_driver_doc,
        p_notes,
        v_user_id,
        NOW(),
        NOW()
    );

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_prod_id := (v_item->>'product_id')::UUID;
        v_qty := (v_item->>'quantity')::NUMERIC;

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'La cantidad del ítem debe ser mayor a 0.'
                USING ERRCODE = '42200';
        END IF;

        -- Obtener costos y precios
        SELECT 
            COALESCE(sl.average_cost, p.cost_price, 0.00),
            COALESCE((v_item->>'unit_price')::NUMERIC, p.public_sale_price, 0.00)
        INTO v_unit_cost, v_unit_price
        FROM public.products p
        LEFT JOIN public.stock_levels sl ON sl.product_id = p.id AND sl.location_id = p_origin_location_id
        WHERE p.id = v_prod_id AND p.company_id = v_company_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El producto % no pertenece a la empresa.', v_prod_id
                USING ERRCODE = '23503';
        END IF;

        INSERT INTO public.remission_items (
            id,
            remission_id,
            company_id,
            product_id,
            quantity,
            delivered_quantity,
            unit_cost,
            unit_price,
            notes,
            created_at
        ) VALUES (
            gen_random_uuid(),
            v_remission_id,
            v_company_id,
            v_prod_id,
            v_qty,
            0.00,
            COALESCE(v_unit_cost, 0.00),
            COALESCE(v_unit_price, 0.00),
            v_item->>'notes',
            NOW()
        );

        v_items_count := v_items_count + 1;
        v_total_units := v_total_units + v_qty;
    END LOOP;

    -- Auditoría
    INSERT INTO public.audit_logs (
        company_id,
        user_id,
        user_name,
        action,
        module,
        entity_name,
        entity_id,
        location_id,
        new_value,
        created_at
    ) VALUES (
        v_company_id,
        v_user_id,
        v_user_name,
        'REMISSION_CREATED',
        'SALES',
        'remissions',
        v_remission_id::TEXT,
        p_origin_location_id,
        jsonb_build_object(
            'code', v_code,
            'customer_id', p_customer_id,
            'origin_location_id', p_origin_location_id,
            'status', v_initial_status,
            'items_count', v_items_count,
            'total_units', v_total_units
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'remission_id', v_remission_id,
        'code', v_code,
        'status', v_initial_status,
        'items_count', v_items_count,
        'total_units', v_total_units
    );
END;
$$;

-- 6. fn_update_remission_draft
CREATE OR REPLACE FUNCTION public.fn_update_remission_draft(
    p_remission_id UUID,
    p_customer_id UUID,
    p_origin_location_id UUID,
    p_items JSONB,
    p_delivery_address TEXT DEFAULT NULL,
    p_delivery_city TEXT DEFAULT NULL,
    p_contact_person TEXT DEFAULT NULL,
    p_contact_phone TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_company_id UUID;
    v_user_name VARCHAR(150);
    v_rem RECORD;
    v_customer RECORD;
    v_location RECORD;
    v_item JSONB;
    v_prod_id UUID;
    v_qty NUMERIC(12,2);
    v_unit_cost NUMERIC(15,2);
    v_unit_price NUMERIC(15,2);
    v_items_count INTEGER := 0;
    v_total_units NUMERIC(12,2) := 0;
BEGIN
    v_user_id := auth.uid();
    v_company_id := public.get_auth_company_id();

    IF v_company_id IS NULL THEN
        SELECT company_id INTO v_company_id FROM public.remissions WHERE id = p_remission_id;
    END IF;

    IF NOT (public.has_permission('sales.create') OR public.is_admin()) THEN
        RAISE EXCEPTION 'No tienes permisos para editar remisiones.'
            USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_rem FROM public.remissions WHERE id = p_remission_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La remisión no existe.' USING ERRCODE = '23503';
    END IF;

    IF v_rem.company_id != v_company_id THEN
        RAISE EXCEPTION 'La remisión pertenece a otra empresa.' USING ERRCODE = '42501';
    END IF;

    IF v_rem.status != 'DRAFT' THEN
        RAISE EXCEPTION 'Solo se pueden editar remisiones en estado DRAFT (estado actual: %).', v_rem.status
            USING ERRCODE = '42200';
    END IF;

    SELECT id, company_id, is_active INTO v_customer FROM public.customers WHERE id = p_customer_id;
    IF NOT FOUND OR v_customer.company_id != v_company_id OR NOT v_customer.is_active THEN
        RAISE EXCEPTION 'El cliente seleccionado no es válido.' USING ERRCODE = '42200';
    END IF;

    SELECT id, company_id, status, allow_sales, allow_inventory_ops INTO v_location
    FROM public.locations WHERE id = p_origin_location_id;
    IF NOT FOUND OR v_location.company_id != v_company_id OR v_location.status != 'ACTIVE' THEN
        RAISE EXCEPTION 'La bodega de origen no es válida.' USING ERRCODE = '42200';
    END IF;

    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Usuario Sistema';
    END IF;

    -- Actualizar cabecera
    UPDATE public.remissions
    SET customer_id = p_customer_id,
        origin_location_id = p_origin_location_id,
        delivery_address = p_delivery_address,
        delivery_city = p_delivery_city,
        contact_person = p_contact_person,
        contact_phone = p_contact_phone,
        notes = p_notes,
        updated_at = NOW()
    WHERE id = p_remission_id;

    -- Reemplazar líneas
    DELETE FROM public.remission_items WHERE remission_id = p_remission_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_prod_id := (v_item->>'product_id')::UUID;
        v_qty := (v_item->>'quantity')::NUMERIC;

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'La cantidad debe ser mayor a 0.' USING ERRCODE = '42200';
        END IF;

        SELECT 
            COALESCE(sl.average_cost, p.cost_price, 0.00),
            COALESCE((v_item->>'unit_price')::NUMERIC, p.public_sale_price, 0.00)
        INTO v_unit_cost, v_unit_price
        FROM public.products p
        LEFT JOIN public.stock_levels sl ON sl.product_id = p.id AND sl.location_id = p_origin_location_id
        WHERE p.id = v_prod_id AND p.company_id = v_company_id;

        INSERT INTO public.remission_items (
            id, remission_id, company_id, product_id, quantity, delivered_quantity, unit_cost, unit_price, notes, created_at
        ) VALUES (
            gen_random_uuid(), p_remission_id, v_company_id, v_prod_id, v_qty, 0.00, v_unit_cost, v_unit_price, v_item->>'notes', NOW()
        );

        v_items_count := v_items_count + 1;
        v_total_units := v_total_units + v_qty;
    END LOOP;

    INSERT INTO public.audit_logs (
        company_id, user_id, user_name, action, module, entity_name, entity_id, location_id, new_value, created_at
    ) VALUES (
        v_company_id, v_user_id, v_user_name, 'REMISSION_UPDATED', 'SALES', 'remissions', p_remission_id::TEXT, p_origin_location_id,
        jsonb_build_object('items_count', v_items_count, 'total_units', v_total_units), NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'remission_id', p_remission_id,
        'code', v_rem.code,
        'items_count', v_items_count,
        'total_units', v_total_units
    );
END;
$$;

-- 7. fn_dispatch_remission (Despacho físico y salida Kardex)
CREATE OR REPLACE FUNCTION public.fn_dispatch_remission(
    p_remission_id UUID,
    p_carrier_name TEXT DEFAULT NULL,
    p_vehicle_plate TEXT DEFAULT NULL,
    p_driver_name TEXT DEFAULT NULL,
    p_driver_doc TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_company_id UUID;
    v_user_name VARCHAR(150);
    v_rem RECORD;
    v_item RECORD;
    v_current_stock NUMERIC(12,2);
    v_prev_stock NUMERIC(12,2);
    v_new_stock NUMERIC(12,2);
    v_prod_name VARCHAR(200);
    v_cust_name VARCHAR(200);
    v_dispatched_units NUMERIC(12,2) := 0;
BEGIN
    v_user_id := auth.uid();
    v_company_id := public.get_auth_company_id();

    IF v_company_id IS NULL THEN
        SELECT company_id INTO v_company_id FROM public.remissions WHERE id = p_remission_id;
    END IF;

    IF NOT (public.has_permission('sales.create') OR public.has_permission('inventory.transfer') OR public.is_admin()) THEN
        RAISE EXCEPTION 'No tienes permisos para despachar remisiones.'
            USING ERRCODE = '42501';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('remission_operation_' || p_remission_id::text));

    SELECT * INTO v_rem FROM public.remissions WHERE id = p_remission_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La remisión especificada no existe.' USING ERRCODE = '23503';
    END IF;

    IF v_rem.company_id != v_company_id THEN
        RAISE EXCEPTION 'La remisión pertenece a otra empresa.' USING ERRCODE = '42501';
    END IF;

    IF v_rem.status NOT IN ('DRAFT', 'CREATED') THEN
        RAISE EXCEPTION 'No se puede despachar una remisión en estado % (debe estar en DRAFT o CREATED).', v_rem.status
            USING ERRCODE = '42200';
    END IF;

    SELECT COALESCE(company_name, commercial_name, first_name || ' ' || COALESCE(last_name, ''))
    INTO v_cust_name
    FROM public.customers WHERE id = v_rem.customer_id;

    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Usuario Sistema';
    END IF;

    -- Validar y bloquear stock para cada producto
    FOR v_item IN (
        SELECT ri.id, ri.product_id, ri.quantity, ri.unit_cost, p.name AS product_name
        FROM public.remission_items ri
        JOIN public.products p ON p.id = ri.product_id
        WHERE ri.remission_id = p_remission_id
        FOR UPDATE
    )
    LOOP
        SELECT COALESCE(quantity, 0)
        INTO v_current_stock
        FROM public.stock_levels
        WHERE product_id = v_item.product_id AND location_id = v_rem.origin_location_id
        FOR UPDATE;

        IF v_current_stock IS NULL OR v_current_stock < v_item.quantity THEN
            RAISE EXCEPTION 'Stock insuficiente en bodega para "%" (disponible: %, solicitado: %). Despacho abortado.',
                v_item.product_name,
                COALESCE(v_current_stock, 0),
                v_item.quantity
                USING ERRCODE = '42200';
        END IF;

        v_prev_stock := v_current_stock;
        v_new_stock := v_prev_stock - v_item.quantity;

        -- Registrar movimiento SALE_OUT con document_type 'REMISSION' (dispara trigger process_inventory_movement)
        INSERT INTO public.inventory_movements (
            company_id,
            location_id,
            product_id,
            movement_type,
            quantity_in,
            quantity_out,
            previous_stock,
            new_stock,
            unit_cost,
            total_cost,
            document_type,
            document_reference,
            reason,
            user_id,
            created_at
        ) VALUES (
            v_rem.company_id,
            v_rem.origin_location_id,
            v_item.product_id,
            'SALE_OUT',
            0.00,
            v_item.quantity,
            v_prev_stock,
            v_new_stock,
            v_item.unit_cost,
            (v_item.quantity * v_item.unit_cost),
            'REMISSION',
            v_rem.code,
            'Despacho de remisión ' || v_rem.code || ' para cliente ' || COALESCE(v_cust_name, ''),
            v_user_id,
            NOW()
        );

        UPDATE public.remission_items
        SET delivered_quantity = v_item.quantity
        WHERE id = v_item.id;

        v_dispatched_units := v_dispatched_units + v_item.quantity;
    END LOOP;

    -- Actualizar estado a DISPATCHED
    UPDATE public.remissions
    SET status = 'DISPATCHED',
        dispatch_date = NOW(),
        dispatched_by_user_id = v_user_id,
        carrier_name = COALESCE(p_carrier_name, carrier_name),
        vehicle_plate = COALESCE(p_vehicle_plate, vehicle_plate),
        driver_name = COALESCE(p_driver_name, driver_name),
        driver_doc = COALESCE(p_driver_doc, driver_doc),
        notes = CASE 
            WHEN p_notes IS NOT NULL AND TRIM(p_notes) != '' THEN TRIM(COALESCE(notes, '') || ' [Despacho: ' || p_notes || ']')
            ELSE notes 
        END,
        updated_at = NOW()
    WHERE id = p_remission_id;

    INSERT INTO public.audit_logs (
        company_id, user_id, user_name, action, module, entity_name, entity_id, location_id,
        previous_value, new_value, created_at
    ) VALUES (
        v_rem.company_id, v_user_id, v_user_name, 'REMISSION_DISPATCHED', 'SALES', 'remissions', p_remission_id::TEXT, v_rem.origin_location_id,
        jsonb_build_object('status', v_rem.status),
        jsonb_build_object('status', 'DISPATCHED', 'dispatched_units', v_dispatched_units, 'code', v_rem.code),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'remission_id', p_remission_id,
        'code', v_rem.code,
        'status', 'DISPATCHED',
        'dispatched_units', v_dispatched_units
    );
END;
$$;

-- 8. fn_deliver_remission (Entrega efectiva al cliente)
CREATE OR REPLACE FUNCTION public.fn_deliver_remission(
    p_remission_id UUID,
    p_received_by TEXT,
    p_received_doc TEXT DEFAULT NULL,
    p_delivery_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_company_id UUID;
    v_user_name VARCHAR(150);
    v_rem RECORD;
BEGIN
    v_user_id := auth.uid();
    v_company_id := public.get_auth_company_id();

    IF v_company_id IS NULL THEN
        SELECT company_id INTO v_company_id FROM public.remissions WHERE id = p_remission_id;
    END IF;

    IF NOT (public.has_permission('sales.create') OR public.is_admin()) THEN
        RAISE EXCEPTION 'No tienes permisos para registrar entrega de remisiones.'
            USING ERRCODE = '42501';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('remission_operation_' || p_remission_id::text));

    SELECT * INTO v_rem FROM public.remissions WHERE id = p_remission_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La remisión no existe.' USING ERRCODE = '23503';
    END IF;

    IF v_rem.company_id != v_company_id THEN
        RAISE EXCEPTION 'La remisión pertenece a otra empresa.' USING ERRCODE = '42501';
    END IF;

    IF v_rem.status != 'DISPATCHED' THEN
        RAISE EXCEPTION 'Solo se puede confirmar entrega de remisiones en estado DISPATCHED (actual: %).', v_rem.status
            USING ERRCODE = '42200';
    END IF;

    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Usuario Sistema';
    END IF;

    UPDATE public.remissions
    SET status = 'DELIVERED',
        delivery_date = NOW(),
        delivered_by_user_id = v_user_id,
        received_by = p_received_by,
        received_doc = p_received_doc,
        delivery_evidence_notes = p_delivery_notes,
        updated_at = NOW()
    WHERE id = p_remission_id;

    INSERT INTO public.audit_logs (
        company_id, user_id, user_name, action, module, entity_name, entity_id, location_id,
        previous_value, new_value, created_at
    ) VALUES (
        v_rem.company_id, v_user_id, v_user_name, 'REMISSION_DELIVERED', 'SALES', 'remissions', p_remission_id::TEXT, v_rem.origin_location_id,
        jsonb_build_object('status', 'DISPATCHED'),
        jsonb_build_object('status', 'DELIVERED', 'received_by', p_received_by, 'code', v_rem.code),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'remission_id', p_remission_id,
        'code', v_rem.code,
        'status', 'DELIVERED'
    );
END;
$$;

-- 9. fn_cancel_remission (Anulación con reversión de inventario si estaba despachada)
CREATE OR REPLACE FUNCTION public.fn_cancel_remission(
    p_remission_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_company_id UUID;
    v_user_name VARCHAR(150);
    v_rem RECORD;
    v_item RECORD;
    v_prev_stock NUMERIC(12,2);
    v_new_stock NUMERIC(12,2);
BEGIN
    v_user_id := auth.uid();
    v_company_id := public.get_auth_company_id();

    IF v_company_id IS NULL THEN
        SELECT company_id INTO v_company_id FROM public.remissions WHERE id = p_remission_id;
    END IF;

    IF NOT (public.has_permission('sales.cancel') OR public.is_admin()) THEN
        RAISE EXCEPTION 'No tienes permisos para anular remisiones.'
            USING ERRCODE = '42501';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('remission_operation_' || p_remission_id::text));

    SELECT * INTO v_rem FROM public.remissions WHERE id = p_remission_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La remisión no existe.' USING ERRCODE = '23503';
    END IF;

    IF v_rem.company_id != v_company_id THEN
        RAISE EXCEPTION 'La remisión pertenece a otra empresa.' USING ERRCODE = '42501';
    END IF;

    IF v_rem.status = 'DELIVERED' THEN
        RAISE EXCEPTION 'No se puede anular una remisión que ya ha sido entregada al cliente (estado DELIVERED).'
            USING ERRCODE = '42200';
    END IF;

    IF v_rem.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'La remisión ya se encuentra anulada.'
            USING ERRCODE = '42200';
    END IF;

    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Usuario Sistema';
    END IF;

    -- Si estaba en DISPATCHED, revertir físicamente las unidades al inventario
    IF v_rem.status = 'DISPATCHED' THEN
        FOR v_item IN (
            SELECT product_id, delivered_quantity, unit_cost
            FROM public.remission_items
            WHERE remission_id = p_remission_id AND delivered_quantity > 0
            FOR UPDATE
        )
        LOOP
            SELECT COALESCE(quantity, 0)
            INTO v_prev_stock
            FROM public.stock_levels
            WHERE product_id = v_item.product_id AND location_id = v_rem.origin_location_id
            FOR UPDATE;

            v_prev_stock := COALESCE(v_prev_stock, 0.00);
            v_new_stock := v_prev_stock + v_item.delivered_quantity;

            -- Movimiento CUSTOMER_RETURN hacia inventario de la bodega origen
            INSERT INTO public.inventory_movements (
                company_id,
                location_id,
                product_id,
                movement_type,
                quantity_in,
                quantity_out,
                previous_stock,
                new_stock,
                unit_cost,
                total_cost,
                document_type,
                document_reference,
                reason,
                user_id,
                created_at
            ) VALUES (
                v_rem.company_id,
                v_rem.origin_location_id,
                v_item.product_id,
                'CUSTOMER_RETURN',
                v_item.delivered_quantity,
                0.00,
                v_prev_stock,
                v_new_stock,
                v_item.unit_cost,
                (v_item.delivered_quantity * v_item.unit_cost),
                'REMISSION_CANCEL',
                v_rem.code,
                'Reversión a bodega origen por anulación de remisión en despacho: ' || COALESCE(p_reason, 'Sin motivo'),
                v_user_id,
                NOW()
            );
        END LOOP;
    END IF;

    UPDATE public.remissions
    SET status = 'CANCELLED',
        cancellation_reason = p_reason,
        cancelled_by_user_id = v_user_id,
        cancelled_at = NOW(),
        notes = TRIM(COALESCE(notes, '') || ' [ANULADA: ' || COALESCE(p_reason, 'Sin motivo') || ']'),
        updated_at = NOW()
    WHERE id = p_remission_id;

    INSERT INTO public.audit_logs (
        company_id, user_id, user_name, action, module, entity_name, entity_id, location_id,
        previous_value, new_value, created_at
    ) VALUES (
        v_rem.company_id, v_user_id, v_user_name, 'REMISSION_CANCELLED', 'SALES', 'remissions', p_remission_id::TEXT, v_rem.origin_location_id,
        jsonb_build_object('status', v_rem.status),
        jsonb_build_object('status', 'CANCELLED', 'reason', p_reason, 'code', v_rem.code),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'remission_id', p_remission_id,
        'code', v_rem.code,
        'status', 'CANCELLED',
        'reason', p_reason
    );
END;
$$;

-- Permisos de ejecución
REVOKE ALL ON FUNCTION public.fn_next_remission_code(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_next_remission_code(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_create_remission(UUID, UUID, JSONB, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_create_remission(UUID, UUID, JSONB, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_update_remission_draft(UUID, UUID, UUID, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_update_remission_draft(UUID, UUID, UUID, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_dispatch_remission(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_dispatch_remission(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_deliver_remission(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_deliver_remission(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_cancel_remission(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_cancel_remission(UUID, TEXT) TO authenticated, service_role;
