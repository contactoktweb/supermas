-- ==============================================================================
-- 038_PURCHASE_ORDER_RECEPTION_ATOMIC_RPC.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- FASE 5.2: Recepción Física Atómica de Mercancía, Kardex, Costo Promedio y Actas
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FUNCIÓN DE CONSECUTIVO ATÓMICO MULTIEMPRESA PARA RECEPCIONES
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_next_reception_number(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_last_num INT;
    v_next_num TEXT;
BEGIN
    IF p_company_id IS NULL THEN
        RAISE EXCEPTION 'fn_next_reception_number: company_id no puede ser nulo.'
            USING ERRCODE = '23502';
    END IF;

    -- Candado transaccional consultivo por empresa para serializar generación de consecutivos
    PERFORM pg_advisory_xact_lock(hashtext('purchase_receipts_consecutive_' || p_company_id::text));

    -- Obtener el número máximo existente con formato REC-XXXXXX para esta compañía
    SELECT COALESCE(MAX(
        NULLIF(SUBSTRING(reception_number FROM 'REC-([0-9]+)'), '')::INT
    ), 0)
    INTO v_last_num
    FROM public.purchase_receipts
    WHERE company_id = p_company_id
      AND reception_number ~ '^REC-[0-9]+$';

    v_next_num := 'REC-' || LPAD((v_last_num + 1)::TEXT, 6, '0');
    RETURN v_next_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.fn_next_reception_number(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_next_reception_number(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. RPC ATÓMICA PRINCIPAL: fn_receive_purchase_order
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_receive_purchase_order(
    p_purchase_id UUID,
    p_supplier_remission_number VARCHAR DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_company_id UUID;
    v_purchase_row RECORD;
    v_reception_id UUID;
    v_reception_number VARCHAR(50);
    v_item_json JSONB;
    v_item_id UUID;
    v_qty_received NUMERIC(12,2);
    v_p_item RECORD;
    v_pending_qty NUMERIC(12,2);
    v_prev_stock NUMERIC(12,2);
    v_new_stock NUMERIC(12,2);
    v_processed_items UUID[] := ARRAY[]::UUID[];
    v_total_received_this_time NUMERIC(12,2) := 0;
    v_received_items_json JSONB := '[]'::JSONB;
    v_total_ordered NUMERIC(12,2) := 0;
    v_total_received_all NUMERIC(12,2) := 0;
    v_new_purchase_status VARCHAR(50);
BEGIN
    -- 2.1 Validar autenticación
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No se detectó un usuario autenticado.'
            USING ERRCODE = '42501';
    END IF;

    -- 2.2 Derivar empresa del usuario
    v_company_id := public.get_auth_company_id();
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo resolver la empresa del usuario autenticado.'
            USING ERRCODE = '42501';
    END IF;

    -- 2.3 Validar permisos RBAC
    IF NOT (public.has_permission('purchases.create') OR public.is_admin()) THEN
        RAISE EXCEPTION 'No tienes permisos suficientes para registrar recepciones (purchases.create requerido).'
            USING ERRCODE = '42501';
    END IF;

    -- 2.4 Candado consultivo de concurrencia sobre la orden de compra
    PERFORM pg_advisory_xact_lock(hashtext('purchase_order_reception_' || p_purchase_id::text));

    -- 2.5 Bloquear y leer orden de compra
    SELECT id, company_id, location_id, purchase_number, UPPER(COALESCE(inventory_status, '')) AS inventory_status
    INTO v_purchase_row
    FROM public.purchases
    WHERE id = p_purchase_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La orden de compra no existe.'
            USING ERRCODE = '23503';
    END IF;

    -- 2.6 Validar pertenencia multiempresa
    IF v_purchase_row.company_id <> v_company_id THEN
        RAISE EXCEPTION 'La orden de compra pertenece a otra empresa.'
            USING ERRCODE = '42501';
    END IF;

    -- 2.7 Validar acceso a la bodega asignada
    IF NOT (public.has_location_access(v_purchase_row.location_id) OR public.is_admin()) THEN
        RAISE EXCEPTION 'El usuario no tiene acceso a la bodega asignada a la orden.'
            USING ERRCODE = '42501';
    END IF;

    -- 2.8 Validar que la bodega pertenece a la misma empresa
    PERFORM 1 FROM public.locations WHERE id = v_purchase_row.location_id AND company_id = v_company_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La bodega asignada no pertenece a la empresa de la orden.'
            USING ERRCODE = '23503';
    END IF;

    -- 2.9 Validar estado apto para recepción
    IF v_purchase_row.inventory_status IN ('DRAFT', 'BORRADOR') THEN
        RAISE EXCEPTION 'No se puede recibir una orden en estado BORRADOR. Debe confirmarse primero.'
            USING ERRCODE = '23514';
    ELSIF v_purchase_row.inventory_status IN ('CANCELLED', 'CANCELADA') THEN
        RAISE EXCEPTION 'No se puede recibir una orden en estado CANCELADA.'
            USING ERRCODE = '23514';
    ELSIF v_purchase_row.inventory_status IN ('RECEIVED', 'RECIBIDA') THEN
        RAISE EXCEPTION 'La orden de compra ya ha sido RECIBIDA en su totalidad.'
            USING ERRCODE = '23514';
    ELSIF v_purchase_row.inventory_status NOT IN ('CONFIRMADA', 'CONFIRMED', 'RECIBIDA_PARCIALMENTE', 'PARTIALLY_RECEIVED') THEN
        RAISE EXCEPTION 'La orden de compra no se encuentra en un estado apto para recepción (Estado: %).', v_purchase_row.inventory_status
            USING ERRCODE = '23514';
    END IF;

    -- 2.10 Validar payload de ítems
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Debe incluir al menos un ítem con cantidad a recibir.'
            USING ERRCODE = '23514';
    END IF;

    -- 2.11 Generar consecutivo atómico del acta de recepción
    v_reception_number := public.fn_next_reception_number(v_company_id);
    v_reception_id := gen_random_uuid();

    -- 2.12 Insertar cabecera del acta de recepción
    INSERT INTO public.purchase_receipts (
        id,
        company_id,
        location_id,
        purchase_id,
        reception_number,
        reception_date,
        received_by_user_id,
        supplier_remission_number,
        notes,
        created_at
    ) VALUES (
        v_reception_id,
        v_company_id,
        v_purchase_row.location_id,
        p_purchase_id,
        v_reception_number,
        NOW(),
        v_user_id,
        NULLIF(TRIM(p_supplier_remission_number), ''),
        NULLIF(TRIM(p_notes), ''),
        NOW()
    );

    -- 2.13 Iterar y procesar cada línea recibida
    FOR v_item_json IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := COALESCE(v_item_json->>'item_id', v_item_json->>'purchase_item_id')::UUID;
        v_qty_received := (v_item_json->>'quantity_received')::NUMERIC;

        IF v_item_id IS NULL THEN
            RAISE EXCEPTION 'Cada ítem debe especificar item_id o purchase_item_id.'
                USING ERRCODE = '23502';
        END IF;

        IF v_item_id = ANY(v_processed_items) THEN
            RAISE EXCEPTION 'El ítem % está duplicado en la solicitud de recepción.', v_item_id
                USING ERRCODE = '23514';
        END IF;
        v_processed_items := array_append(v_processed_items, v_item_id);

        IF v_qty_received IS NULL OR v_qty_received <= 0 THEN
            RAISE EXCEPTION 'La cantidad a recibir debe ser estrictamente mayor a 0 (Ítem: %).', v_item_id
                USING ERRCODE = '23514';
        END IF;

        -- Bloquear línea de compra
        SELECT id, company_id, purchase_id, product_id, quantity, received_quantity, unit_cost
        INTO v_p_item
        FROM public.purchase_items
        WHERE id = v_item_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El ítem de compra con ID % no existe.', v_item_id
                USING ERRCODE = '23503';
        END IF;

        IF v_p_item.purchase_id <> p_purchase_id THEN
            RAISE EXCEPTION 'El ítem % no pertenece a la orden de compra %.', v_item_id, v_purchase_row.purchase_number
                USING ERRCODE = '23514';
        END IF;

        IF v_p_item.company_id <> v_company_id THEN
            RAISE EXCEPTION 'El ítem de compra pertenece a otra empresa.'
                USING ERRCODE = '42501';
        END IF;

        -- Validar producto en catálogo de la empresa
        PERFORM 1 FROM public.products WHERE id = v_p_item.product_id AND company_id = v_company_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'El producto asociado al ítem % no pertenece a la empresa de la orden.', v_item_id
                USING ERRCODE = '23503';
        END IF;

        -- Validar saldo pendiente (no exceder)
        v_pending_qty := v_p_item.quantity - v_p_item.received_quantity;
        IF v_qty_received > v_pending_qty THEN
            RAISE EXCEPTION 'Exceso de recepción: El ítem % tiene pendiente % unidades y se intentó recibir %.', 
                v_item_id, v_pending_qty, v_qty_received
                USING ERRCODE = '23514';
        END IF;

        -- Actualizar received_quantity en purchase_items
        UPDATE public.purchase_items
        SET received_quantity = received_quantity + v_qty_received
        WHERE id = v_p_item.id;

        -- Insertar línea de acta de recepción
        INSERT INTO public.purchase_receipt_items (
            id,
            company_id,
            reception_id,
            purchase_item_id,
            product_id,
            quantity_received,
            unit_cost,
            created_at
        ) VALUES (
            gen_random_uuid(),
            v_company_id,
            v_reception_id,
            v_p_item.id,
            v_p_item.product_id,
            v_qty_received,
            v_p_item.unit_cost,
            NOW()
        );

        -- Obtener saldo anterior de existencias para este producto y bodega
        SELECT quantity
        INTO v_prev_stock
        FROM public.stock_levels
        WHERE product_id = v_p_item.product_id AND location_id = v_purchase_row.location_id
        FOR UPDATE;

        IF NOT FOUND THEN
            v_prev_stock := 0.00;
        END IF;

        v_new_stock := v_prev_stock + v_qty_received;

        -- Insertar movimiento en el Kardex (activa trigger process_inventory_movement)
        INSERT INTO public.inventory_movements (
            id,
            company_id,
            product_id,
            location_id,
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
            gen_random_uuid(),
            v_company_id,
            v_p_item.product_id,
            v_purchase_row.location_id,
            'PURCHASE_ENTRY',
            v_qty_received,
            0.00,
            v_prev_stock,
            v_new_stock,
            v_p_item.unit_cost,
            ROUND(v_qty_received * v_p_item.unit_cost, 2),
            'PURCHASE_RECEIPT',
            v_reception_number,
            'Recepción de orden de compra ' || v_purchase_row.purchase_number,
            v_user_id,
            NOW()
        );

        v_total_received_this_time := v_total_received_this_time + v_qty_received;
        v_received_items_json := v_received_items_json || jsonb_build_object(
            'item_id', v_p_item.id,
            'product_id', v_p_item.product_id,
            'quantity_received', v_qty_received,
            'unit_cost', v_p_item.unit_cost
        );
    END LOOP;

    -- 2.14 Calcular nuevo estado global de la orden
    SELECT 
        COALESCE(SUM(quantity), 0),
        COALESCE(SUM(received_quantity), 0)
    INTO v_total_ordered, v_total_received_all
    FROM public.purchase_items
    WHERE purchase_id = p_purchase_id;

    IF v_total_received_all >= v_total_ordered THEN
        v_new_purchase_status := 'RECIBIDA';
    ELSE
        v_new_purchase_status := 'RECIBIDA_PARCIALMENTE';
    END IF;

    -- 2.15 Actualizar cabecera de compra
    UPDATE public.purchases SET
        inventory_status = v_new_purchase_status,
        received_at = NOW(),
        received_by_user_id = v_user_id,
        updated_at = NOW()
    WHERE id = p_purchase_id;

    -- 2.16 Retornar payload estructurado para la UI
    RETURN jsonb_build_object(
        'reception_id', v_reception_id,
        'reception_number', v_reception_number,
        'purchase_id', p_purchase_id,
        'new_purchase_status', v_new_purchase_status,
        'received_items', v_received_items_json,
        'total_received', v_total_received_this_time,
        'remaining_quantity', (v_total_ordered - v_total_received_all)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.fn_receive_purchase_order(UUID, VARCHAR, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_receive_purchase_order(UUID, VARCHAR, TEXT, JSONB) TO authenticated, service_role;
