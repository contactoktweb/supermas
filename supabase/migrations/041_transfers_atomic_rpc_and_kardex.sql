-- ==============================================================================
-- 041_TRANSFERS_ATOMIC_RPC_AND_KARDEX.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Hardening fiduciario y transaccional para Traslados entre Bodegas
-- 
-- 1. Ampliación de columnas en public.transfers y public.transfer_items.
-- 2. Consecutivo atómico multiempresa: fn_next_transfer_code(company_id) -> TR-XXXXXX.
-- 3. fn_create_transfer: Creación atómica de traslado y líneas en estado PENDING.
-- 4. fn_dispatch_transfer: Despacho atómico:
--    - Bloqueo pesimista de stock en origen (FOR UPDATE)
--    - Validación estricta anti-stock negativo
--    - Inserción de TRANSFER_OUT en public.inventory_movements (Kardex real)
--    - Cambio a estado IN_TRANSIT
-- 5. fn_receive_transfer: Recepción atómica en destino:
--    - Inserción de TRANSFER_IN en public.inventory_movements (Kardex real)
--    - Detección de discrepancias / incidencias
--    - Cambio a estado RECEIVED
-- 6. fn_cancel_transfer: Anulación / Rechazo de traslado:
--    - Si estaba PENDING: cancelación sin movimiento físico.
--    - Si estaba IN_TRANSIT: reversión atómica a bodega origen vía TRANSFER_IN.
-- 7. Auditoría transaccional en public.audit_logs.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIÓN DE TABLAS: transfers y transfer_items
-- ------------------------------------------------------------------------------

ALTER TABLE public.transfers
    ADD COLUMN IF NOT EXISTS dispatched_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS rejected_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS has_incident BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incident_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_transfers_company_status ON public.transfers(company_id, status);
CREATE INDEX IF NOT EXISTS idx_transfers_dispatch ON public.transfers(dispatched_by_user_id);

ALTER TABLE public.transfer_items
    ADD COLUMN IF NOT EXISTS has_discrepancy BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS discrepancy_note TEXT;

-- ------------------------------------------------------------------------------
-- 2. GENERADOR DE CONSECUTIVO ATÓMICO MULTIEMPRESA: TR-XXXXXX
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_next_transfer_code(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_last_num INT;
    v_next_num TEXT;
BEGIN
    IF p_company_id IS NULL THEN
        RAISE EXCEPTION 'fn_next_transfer_code: company_id no puede ser nulo.'
            USING ERRCODE = '23502';
    END IF;

    -- Candado transaccional consultivo por empresa
    PERFORM pg_advisory_xact_lock(hashtext('transfers_consecutive_' || p_company_id::text));

    SELECT COALESCE(MAX(NULLIF(SUBSTRING(code FROM 'TR-([0-9]+)'), '')::INT), 0)
    INTO v_last_num
    FROM public.transfers
    WHERE company_id = p_company_id;

    v_next_num := 'TR-' || LPAD((v_last_num + 1)::TEXT, 6, '0');
    RETURN v_next_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.fn_next_transfer_code(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_next_transfer_code(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. RPC: fn_create_transfer (Creación atómica de traslado)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_create_transfer(
    p_origin_location_id UUID,
    p_destination_location_id UUID,
    p_notes TEXT DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_user_name VARCHAR(150);
    v_company_id UUID;
    v_origin_loc RECORD;
    v_dest_loc RECORD;
    v_transfer_id UUID;
    v_transfer_code VARCHAR(30);
    v_item JSONB;
    v_prod_id UUID;
    v_req_qty NUMERIC(12,2);
    v_unit_cost NUMERIC(15,2);
    v_items_count INT := 0;
    v_total_units NUMERIC(12,2) := 0;
BEGIN
    v_user_id := auth.uid();
    v_company_id := public.get_auth_company_id();

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo resolver la empresa del usuario autenticado.'
            USING ERRCODE = '42501';
    END IF;

    IF NOT (public.has_permission('inventory.transfer') OR public.is_admin()) THEN
        RAISE EXCEPTION 'No tienes permisos para crear traslados de inventario (inventory.transfer requerido).'
            USING ERRCODE = '42501';
    END IF;

    IF p_origin_location_id = p_destination_location_id THEN
        RAISE EXCEPTION 'La bodega de origen y destino no pueden ser la misma.'
            USING ERRCODE = '42200';
    END IF;

    -- Validar bodega origen
    SELECT id, company_id, name, code, status
    INTO v_origin_loc
    FROM public.locations
    WHERE id = p_origin_location_id;

    IF NOT FOUND OR v_origin_loc.company_id != v_company_id THEN
        RAISE EXCEPTION 'La bodega de origen no existe o pertenece a otra empresa.'
            USING ERRCODE = '42501';
    END IF;

    IF v_origin_loc.status != 'ACTIVE' THEN
        RAISE EXCEPTION 'La bodega de origen no se encuentra activa.'
            USING ERRCODE = '42200';
    END IF;

    -- Validar bodega destino
    SELECT id, company_id, name, code, status
    INTO v_dest_loc
    FROM public.locations
    WHERE id = p_destination_location_id;

    IF NOT FOUND OR v_dest_loc.company_id != v_company_id THEN
        RAISE EXCEPTION 'La bodega de destino no existe o pertenece a otra empresa.'
            USING ERRCODE = '42501';
    END IF;

    IF v_dest_loc.status != 'ACTIVE' THEN
        RAISE EXCEPTION 'La bodega de destino no se encuentra activa.'
            USING ERRCODE = '42200';
    END IF;

    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'El traslado debe contener al menos un producto.'
            USING ERRCODE = '42200';
    END IF;

    -- Resolver usuario
    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Usuario Sistema';
    END IF;

    -- Consecutivo e inserción de cabecera
    v_transfer_code := public.fn_next_transfer_code(v_company_id);
    v_transfer_id := gen_random_uuid();

    INSERT INTO public.transfers (
        id,
        company_id,
        code,
        origin_location_id,
        destination_location_id,
        status,
        created_by_user_id,
        notes,
        created_at,
        updated_at
    ) VALUES (
        v_transfer_id,
        v_company_id,
        v_transfer_code,
        p_origin_location_id,
        p_destination_location_id,
        'PENDING',
        v_user_id,
        p_notes,
        NOW(),
        NOW()
    );

    -- Inserción de líneas
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_prod_id := (v_item->>'product_id')::UUID;
        v_req_qty := (v_item->>'quantity')::NUMERIC;

        IF v_req_qty <= 0 THEN
            RAISE EXCEPTION 'La cantidad del ítem debe ser estrictamente mayor a 0.'
                USING ERRCODE = '42200';
        END IF;

        -- Obtener costo unitario actual del producto o inventario
        SELECT COALESCE(sl.average_cost, p.cost, 0.00)
        INTO v_unit_cost
        FROM public.products p
        LEFT JOIN public.stock_levels sl ON sl.product_id = p.id AND sl.location_id = p_origin_location_id
        WHERE p.id = v_prod_id AND p.company_id = v_company_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El producto % no existe en la empresa.', v_prod_id
                USING ERRCODE = '23503';
        END IF;

        INSERT INTO public.transfer_items (
            transfer_id,
            company_id,
            product_id,
            requested_quantity,
            sent_quantity,
            received_quantity,
            unit_cost,
            created_at
        ) VALUES (
            v_transfer_id,
            v_company_id,
            v_prod_id,
            v_req_qty,
            0.00,
            0.00,
            v_unit_cost,
            NOW()
        );

        v_items_count := v_items_count + 1;
        v_total_units := v_total_units + v_req_qty;
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
        'TRANSFER_CREATED',
        'INVENTORY',
        'transfers',
        v_transfer_id::TEXT,
        p_origin_location_id,
        jsonb_build_object(
            'code', v_transfer_code,
            'origin_location_id', p_origin_location_id,
            'destination_location_id', p_destination_location_id,
            'items_count', v_items_count,
            'total_units', v_total_units,
            'status', 'PENDING'
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'transfer_id', v_transfer_id,
        'code', v_transfer_code,
        'status', 'PENDING',
        'items_count', v_items_count,
        'total_units', v_total_units
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.fn_create_transfer(UUID, UUID, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_create_transfer(UUID, UUID, TEXT, JSONB) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. RPC: fn_dispatch_transfer (Despacho con salida real de stock Kardex)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_dispatch_transfer(
    p_transfer_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_user_name VARCHAR(150);
    v_company_id UUID;
    v_transfer RECORD;
    v_item RECORD;
    v_current_stock NUMERIC(12,2);
    v_prod_name VARCHAR(255);
    v_dest_name VARCHAR(150);
    v_dispatched_units NUMERIC(12,2) := 0;
BEGIN
    v_user_id := auth.uid();
    v_company_id := public.get_auth_company_id();

    IF v_company_id IS NULL THEN
        SELECT company_id INTO v_company_id FROM public.transfers WHERE id = p_transfer_id;
    END IF;

    IF NOT (public.has_permission('inventory.transfer') OR public.is_admin()) THEN
        RAISE EXCEPTION 'No tienes permisos para despachar traslados de inventario.'
            USING ERRCODE = '42501';
    END IF;

    -- Bloqueo pesimista y lectura del traslado
    PERFORM pg_advisory_xact_lock(hashtext('transfer_operation_' || p_transfer_id::text));

    SELECT 
        id, company_id, code, origin_location_id, destination_location_id, status, notes
    INTO v_transfer
    FROM public.transfers
    WHERE id = p_transfer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El traslado especificado no existe.'
            USING ERRCODE = '23503';
    END IF;

    IF v_transfer.company_id != v_company_id THEN
        RAISE EXCEPTION 'El traslado pertenece a otra empresa.'
            USING ERRCODE = '42501';
    END IF;

    IF v_transfer.status != 'PENDING' THEN
        RAISE EXCEPTION 'No se puede despachar un traslado en estado % (debe estar en PENDING).', v_transfer.status
            USING ERRCODE = '42200';
    END IF;

    SELECT name INTO v_dest_name FROM public.locations WHERE id = v_transfer.destination_location_id;

    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Usuario Sistema';
    END IF;

    -- Procesar cada ítem del traslado con bloqueo pesimista de stock
    FOR v_item IN (
        SELECT id, product_id, requested_quantity, unit_cost
        FROM public.transfer_items
        WHERE transfer_id = p_transfer_id
        FOR UPDATE
    )
    LOOP
        -- Consultar nombre de producto para mensajes de error claros
        SELECT name INTO v_prod_name FROM public.products WHERE id = v_item.product_id;

        -- Bloquear y consultar stock en bodega origen
        SELECT COALESCE(quantity, 0)
        INTO v_current_stock
        FROM public.stock_levels
        WHERE product_id = v_item.product_id AND location_id = v_transfer.origin_location_id
        FOR UPDATE;

        IF v_current_stock IS NULL OR v_current_stock < v_item.requested_quantity THEN
            RAISE EXCEPTION 'Stock insuficiente en bodega de origen para "%" (disponible: %, solicitado: %). Traslado abortado.',
                COALESCE(v_prod_name, v_item.product_id::text),
                COALESCE(v_current_stock, 0),
                v_item.requested_quantity
                USING ERRCODE = '42200';
        END IF;

        -- Registrar movimiento TRANSFER_OUT en inventario (Kardex real)
        INSERT INTO public.inventory_movements (
            company_id,
            location_id,
            product_id,
            movement_type,
            quantity_in,
            quantity_out,
            unit_cost,
            total_cost,
            document_reference,
            notes,
            created_by_user_id,
            created_at
        ) VALUES (
            v_transfer.company_id,
            v_transfer.origin_location_id,
            v_item.product_id,
            'TRANSFER_OUT',
            0.00,
            v_item.requested_quantity,
            v_item.unit_cost,
            (v_item.requested_quantity * v_item.unit_cost),
            v_transfer.code,
            'Despacho de traslado ' || v_transfer.code || ' hacia bodega ' || COALESCE(v_dest_name, ''),
            v_user_id,
            NOW()
        );

        -- Actualizar ítem con unidades despachadas
        UPDATE public.transfer_items
        SET sent_quantity = v_item.requested_quantity
        WHERE id = v_item.id;

        v_dispatched_units := v_dispatched_units + v_item.requested_quantity;
    END LOOP;

    -- Actualizar estado del traslado a IN_TRANSIT
    UPDATE public.transfers
    SET status = 'IN_TRANSIT',
        dispatch_date = NOW(),
        dispatched_by_user_id = v_user_id,
        notes = CASE 
            WHEN p_notes IS NOT NULL AND TRIM(p_notes) != '' THEN TRIM(COALESCE(notes, '') || ' [Despacho: ' || p_notes || ']')
            ELSE notes 
        END,
        updated_at = NOW()
    WHERE id = p_transfer_id;

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
        previous_value,
        new_value,
        created_at
    ) VALUES (
        v_transfer.company_id,
        v_user_id,
        v_user_name,
        'TRANSFER_DISPATCHED',
        'INVENTORY',
        'transfers',
        p_transfer_id::TEXT,
        v_transfer.origin_location_id,
        jsonb_build_object('status', 'PENDING'),
        jsonb_build_object('status', 'IN_TRANSIT', 'dispatched_units', v_dispatched_units, 'code', v_transfer.code),
        NOW()
    );

    RETURN jsonb_build_object(
        'transfer_id', p_transfer_id,
        'code', v_transfer.code,
        'status', 'IN_TRANSIT',
        'dispatched_units', v_dispatched_units
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.fn_dispatch_transfer(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_dispatch_transfer(UUID, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. RPC: fn_receive_transfer (Recepción en destino con entrada real Kardex)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_receive_transfer(
    p_transfer_id UUID,
    p_received_items JSONB DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_user_name VARCHAR(150);
    v_company_id UUID;
    v_transfer RECORD;
    v_item RECORD;
    v_orig_name VARCHAR(150);
    v_recv_units NUMERIC(12,2);
    v_custom_item JSONB;
    v_has_incident BOOLEAN := false;
    v_incident_summary TEXT := '';
    v_total_received NUMERIC(12,2) := 0;
BEGIN
    v_user_id := auth.uid();
    v_company_id := public.get_auth_company_id();

    IF v_company_id IS NULL THEN
        SELECT company_id INTO v_company_id FROM public.transfers WHERE id = p_transfer_id;
    END IF;

    IF NOT (public.has_permission('inventory.transfer') OR public.is_admin()) THEN
        RAISE EXCEPTION 'No tienes permisos para recibir traslados de inventario.'
            USING ERRCODE = '42501';
    END IF;

    -- Bloqueo pesimista del traslado
    PERFORM pg_advisory_xact_lock(hashtext('transfer_operation_' || p_transfer_id::text));

    SELECT 
        id, company_id, code, origin_location_id, destination_location_id, status, notes
    INTO v_transfer
    FROM public.transfers
    WHERE id = p_transfer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El traslado especificado no existe.'
            USING ERRCODE = '23503';
    END IF;

    IF v_transfer.company_id != v_company_id THEN
        RAISE EXCEPTION 'El traslado pertenece a otra empresa.'
            USING ERRCODE = '42501';
    END IF;

    IF v_transfer.status != 'IN_TRANSIT' THEN
        RAISE EXCEPTION 'No se puede recibir un traslado en estado % (debe estar en IN_TRANSIT).', v_transfer.status
            USING ERRCODE = '42200';
    END IF;

    SELECT name INTO v_orig_name FROM public.locations WHERE id = v_transfer.origin_location_id;

    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Usuario Sistema';
    END IF;

    -- Procesar cada ítem del traslado
    FOR v_item IN (
        SELECT ti.id, ti.product_id, ti.sent_quantity, ti.unit_cost, p.name AS product_name
        FROM public.transfer_items ti
        JOIN public.products p ON p.id = ti.product_id
        WHERE ti.transfer_id = p_transfer_id
        FOR UPDATE
    )
    LOOP
        v_recv_units := v_item.sent_quantity;

        -- Si se especificaron cantidades recibidas personalizadas
        IF p_received_items IS NOT NULL AND jsonb_array_length(p_received_items) > 0 THEN
            SELECT elem INTO v_custom_item
            FROM jsonb_array_elements(p_received_items) elem
            WHERE (elem->>'product_id')::UUID = v_item.product_id
            LIMIT 1;

            IF v_custom_item IS NOT NULL THEN
                v_recv_units := (v_custom_item->>'received_quantity')::NUMERIC;
            END IF;
        END IF;

        IF v_recv_units < 0 THEN
            RAISE EXCEPTION 'La cantidad recibida para "%" no puede ser negativa.', v_item.product_name
                USING ERRCODE = '42200';
        END IF;

        -- Detección de discrepancia
        IF v_recv_units != v_item.sent_quantity THEN
            v_has_incident := true;
            v_incident_summary := v_incident_summary || ' - ' || v_item.product_name || ': enviadas ' || v_item.sent_quantity || ', recibidas ' || v_recv_units;
            UPDATE public.transfer_items
            SET received_quantity = v_recv_units,
                has_discrepancy = true,
                discrepancy_note = 'Diferencia en recepción: ' || (v_recv_units - v_item.sent_quantity)::TEXT
            WHERE id = v_item.id;
        ELSE
            UPDATE public.transfer_items
            SET received_quantity = v_recv_units,
                has_discrepancy = false
            WHERE id = v_item.id;
        END IF;

        -- Si se recibieron unidades > 0, registrar TRANSFER_IN en bodega destino (Kardex real)
        IF v_recv_units > 0 THEN
            INSERT INTO public.inventory_movements (
                company_id,
                location_id,
                product_id,
                movement_type,
                quantity_in,
                quantity_out,
                unit_cost,
                total_cost,
                document_reference,
                notes,
                created_by_user_id,
                created_at
            ) VALUES (
                v_transfer.company_id,
                v_transfer.destination_location_id,
                v_item.product_id,
                'TRANSFER_IN',
                v_recv_units,
                0.00,
                v_item.unit_cost,
                (v_recv_units * v_item.unit_cost),
                v_transfer.code,
                'Recepción de traslado ' || v_transfer.code || ' desde bodega ' || COALESCE(v_orig_name, ''),
                v_user_id,
                NOW()
            );
        END IF;

        v_total_received := v_total_received + v_recv_units;
    END LOOP;

    -- Actualizar cabecera a RECEIVED
    UPDATE public.transfers
    SET status = 'RECEIVED',
        receipt_date = NOW(),
        received_by_user_id = v_user_id,
        has_incident = v_has_incident,
        incident_notes = CASE 
            WHEN v_has_incident THEN 'Discrepancias detectadas:' || v_incident_summary || COALESCE(' [Observación: ' || p_notes || ']', '')
            ELSE incident_notes
        END,
        notes = CASE 
            WHEN p_notes IS NOT NULL AND TRIM(p_notes) != '' THEN TRIM(COALESCE(notes, '') || ' [Recepción: ' || p_notes || ']')
            ELSE notes 
        END,
        updated_at = NOW()
    WHERE id = p_transfer_id;

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
        previous_value,
        new_value,
        created_at
    ) VALUES (
        v_transfer.company_id,
        v_user_id,
        v_user_name,
        'TRANSFER_RECEIVED',
        'INVENTORY',
        'transfers',
        p_transfer_id::TEXT,
        v_transfer.destination_location_id,
        jsonb_build_object('status', 'IN_TRANSIT'),
        jsonb_build_object('status', 'RECEIVED', 'total_received', v_total_received, 'has_incident', v_has_incident, 'code', v_transfer.code),
        NOW()
    );

    RETURN jsonb_build_object(
        'transfer_id', p_transfer_id,
        'code', v_transfer.code,
        'status', 'RECEIVED',
        'total_received', v_total_received,
        'has_incident', v_has_incident
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.fn_receive_transfer(UUID, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_receive_transfer(UUID, JSONB, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 6. RPC: fn_cancel_transfer (Anulación o rechazo seguro)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_cancel_transfer(
    p_transfer_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_user_name VARCHAR(150);
    v_company_id UUID;
    v_transfer RECORD;
    v_item RECORD;
    v_orig_name VARCHAR(150);
BEGIN
    v_user_id := auth.uid();
    v_company_id := public.get_auth_company_id();

    IF v_company_id IS NULL THEN
        SELECT company_id INTO v_company_id FROM public.transfers WHERE id = p_transfer_id;
    END IF;

    IF NOT (public.has_permission('inventory.transfer') OR public.is_admin()) THEN
        RAISE EXCEPTION 'No tienes permisos para cancelar o rechazar traslados.'
            USING ERRCODE = '42501';
    END IF;

    -- Bloqueo pesimista del traslado
    PERFORM pg_advisory_xact_lock(hashtext('transfer_operation_' || p_transfer_id::text));

    SELECT 
        id, company_id, code, origin_location_id, destination_location_id, status, notes
    INTO v_transfer
    FROM public.transfers
    WHERE id = p_transfer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El traslado especificado no existe.'
            USING ERRCODE = '23503';
    END IF;

    IF v_transfer.company_id != v_company_id THEN
        RAISE EXCEPTION 'El traslado pertenece a otra empresa.'
            USING ERRCODE = '42501';
    END IF;

    IF v_transfer.status = 'RECEIVED' THEN
        RAISE EXCEPTION 'No se puede anular un traslado ya recibido en destino. Debe tramitarse un contraslado.'
            USING ERRCODE = '42200';
    END IF;

    IF v_transfer.status = 'REJECTED' OR v_transfer.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'El traslado ya se encuentra cancelado o rechazado.'
            USING ERRCODE = '42200';
    END IF;

    SELECT name INTO v_orig_name FROM public.locations WHERE id = v_transfer.origin_location_id;

    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Usuario Sistema';
    END IF;

    -- Si estaba en tránsito, revertir mercancía a bodega origen
    IF v_transfer.status = 'IN_TRANSIT' THEN
        FOR v_item IN (
            SELECT id, product_id, sent_quantity, unit_cost
            FROM public.transfer_items
            WHERE transfer_id = p_transfer_id AND sent_quantity > 0
            FOR UPDATE
        )
        LOOP
            INSERT INTO public.inventory_movements (
                company_id,
                location_id,
                product_id,
                movement_type,
                quantity_in,
                quantity_out,
                unit_cost,
                total_cost,
                document_reference,
                notes,
                created_by_user_id,
                created_at
            ) VALUES (
                v_transfer.company_id,
                v_transfer.origin_location_id,
                v_item.product_id,
                'TRANSFER_IN',
                v_item.sent_quantity,
                0.00,
                v_item.unit_cost,
                (v_item.sent_quantity * v_item.unit_cost),
                v_transfer.code,
                'Reversión a bodega origen por cancelación de traslado en tránsito: ' || COALESCE(p_reason, 'Sin motivo'),
                v_user_id,
                NOW()
            );
        END LOOP;
    END IF;

    -- Actualizar cabecera a REJECTED
    UPDATE public.transfers
    SET status = 'REJECTED',
        rejected_at = NOW(),
        rejected_by_user_id = v_user_id,
        rejection_reason = p_reason,
        notes = TRIM(COALESCE(notes, '') || ' [RECHAZADO/CANCELADO: ' || COALESCE(p_reason, 'Sin motivo') || ']'),
        updated_at = NOW()
    WHERE id = p_transfer_id;

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
        previous_value,
        new_value,
        created_at
    ) VALUES (
        v_transfer.company_id,
        v_user_id,
        v_user_name,
        'TRANSFER_CANCELLED',
        'INVENTORY',
        'transfers',
        p_transfer_id::TEXT,
        v_transfer.origin_location_id,
        jsonb_build_object('status', v_transfer.status),
        jsonb_build_object('status', 'REJECTED', 'reason', p_reason, 'code', v_transfer.code),
        NOW()
    );

    RETURN jsonb_build_object(
        'transfer_id', p_transfer_id,
        'code', v_transfer.code,
        'status', 'REJECTED',
        'reason', p_reason
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.fn_cancel_transfer(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_cancel_transfer(UUID, TEXT) TO authenticated, service_role;
