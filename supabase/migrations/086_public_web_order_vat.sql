-- 086: Los pedidos de la tienda web suman el IVA, igual que la venta en la que se convierten.
--
-- El precio del producto (public_sale_price) se guarda ANTES de IVA. fn_create_public_web_order (084)
-- guardaba el total sin IVA, mientras que fn_convert_web_order_to_sale sí lo suma: el cliente veía
-- un total menor al de la venta. Ahora, por línea y con la misma regla y redondeo que la venta
-- (exento o tratamiento EXENTO / EXCLUIDO → 0 %, si no tax_rate_percent):
--   - web_order_items.unit_price y subtotal siguen antes de IVA (como sale_items);
--   - web_orders.subtotal es la suma antes de IVA y web_orders.total incluye el IVA.
-- El IVA del pedido es total - subtotal - shipping_fee. Los pedidos ya creados no cambian.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.fn_create_public_web_order(
    p_company_id UUID,
    p_customer JSONB,
    p_items JSONB,
    p_idempotency_key UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_existing RECORD;
    v_location_id UUID;
    v_item JSONB;
    v_product RECORD;
    v_product_id UUID;
    v_qty NUMERIC(12,2);
    v_stock NUMERIC(12,2);
    v_lines JSONB := '[]'::JSONB;
    v_subtotal NUMERIC(15,2) := 0;
    v_tax_total NUMERIC(15,2) := 0;
    v_tax_rate NUMERIC(5,2);
    v_gross NUMERIC(15,2);
    v_line_tax NUMERIC(15,2);
    v_order_id UUID;
    v_order_number VARCHAR(40);
    v_prefix TEXT;
    v_seq INTEGER;
    v_name TEXT := NULLIF(BTRIM(COALESCE(p_customer->>'name', '')), '');
    v_phone TEXT := NULLIF(BTRIM(COALESCE(p_customer->>'phone', '')), '');
    v_email TEXT := NULLIF(LOWER(BTRIM(COALESCE(p_customer->>'email', ''))), '');
    v_address TEXT := NULLIF(BTRIM(COALESCE(p_customer->>'address', '')), '');
    v_city TEXT := NULLIF(BTRIM(COALESCE(p_customer->>'city', '')), '');
    v_notes TEXT := NULLIF(BTRIM(COALESCE(p_customer->>'notes', '')), '');
BEGIN
    IF p_company_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.companies WHERE id = p_company_id AND status = 'ACTIVE'
    ) THEN
        RAISE EXCEPTION 'La tienda no está disponible para recibir pedidos.' USING ERRCODE = '42501';
    END IF;
    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'Se requiere la clave de idempotencia del pedido.' USING ERRCODE = '22023';
    END IF;
    IF v_name IS NULL OR v_phone IS NULL OR v_address IS NULL OR v_city IS NULL THEN
        RAISE EXCEPTION 'Faltan datos del cliente (nombre, teléfono, dirección o ciudad).' USING ERRCODE = '23502';
    END IF;
    IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'El pedido no tiene productos.' USING ERRCODE = '23502';
    END IF;
    IF jsonb_array_length(p_items) > 100 THEN
        RAISE EXCEPTION 'El pedido supera el máximo de 100 productos distintos.' USING ERRCODE = '22023';
    END IF;

    -- Idempotencia: el mismo intento de compra nunca crea dos pedidos.
    PERFORM pg_advisory_xact_lock(hashtext('web-order-intake:' || p_company_id::TEXT || ':' || p_idempotency_key::TEXT));
    SELECT id, order_number, total INTO v_existing
    FROM public.web_orders
    WHERE company_id = p_company_id AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
        RETURN jsonb_build_object('web_order_id', v_existing.id, 'order_number', v_existing.order_number,
                                  'total', v_existing.total, 'idempotent_replay', true);
    END IF;

    SELECT id INTO v_location_id
    FROM public.locations
    WHERE company_id = p_company_id AND status = 'ACTIVE'
    ORDER BY is_ecommerce_source DESC, created_at ASC
    LIMIT 1;
    IF v_location_id IS NULL THEN
        RAISE EXCEPTION 'La empresa no tiene una sede activa para despachar pedidos web.' USING ERRCODE = '55000';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        BEGIN
            v_product_id := (v_item->>'product_id')::UUID;
            v_qty := (v_item->>'quantity')::NUMERIC;
        EXCEPTION WHEN others THEN
            RAISE EXCEPTION 'Producto o cantidad inválidos en el pedido.' USING ERRCODE = '22023';
        END;
        IF v_product_id IS NULL OR v_qty IS NULL OR v_qty <= 0 OR v_qty <> TRUNC(v_qty) OR v_qty > 10000 THEN
            RAISE EXCEPTION 'Producto o cantidad inválidos en el pedido.' USING ERRCODE = '22023';
        END IF;
        IF v_lines @> jsonb_build_array(jsonb_build_object('product_id', v_product_id)) THEN
            RAISE EXCEPTION 'El pedido repite un producto; agrupe las cantidades.' USING ERRCODE = '22023';
        END IF;

        SELECT id, name, public_sale_price, is_active, is_published_supermas,
               tax_rate_percent, is_tax_exempt, iva_treatment
        INTO v_product
        FROM public.products
        WHERE id = v_product_id AND company_id = p_company_id;
        IF NOT FOUND OR NOT v_product.is_active OR NOT COALESCE(v_product.is_published_supermas, false) THEN
            RAISE EXCEPTION 'Un producto del pedido ya no está disponible en la tienda.' USING ERRCODE = 'P0002';
        END IF;
        IF COALESCE(v_product.public_sale_price, 0) <= 0 THEN
            RAISE EXCEPTION 'El producto % no tiene precio de venta publicado.', v_product.name USING ERRCODE = '55000';
        END IF;

        SELECT COALESCE(SUM(sl.quantity), 0) INTO v_stock
        FROM public.stock_levels sl
        JOIN public.locations l ON l.id = sl.location_id
        WHERE sl.product_id = v_product_id AND l.company_id = p_company_id AND l.status = 'ACTIVE';
        IF v_stock < v_qty THEN
            RAISE EXCEPTION 'No hay existencias suficientes de % (disponibles: %).', v_product.name, GREATEST(v_stock, 0)
                USING ERRCODE = '55000';
        END IF;

        -- IVA con la misma regla y redondeo que fn_create_sale_with_payments_internal (079)
        v_tax_rate := CASE
            WHEN v_product.is_tax_exempt IS TRUE OR v_product.iva_treatment IN ('EXENTO', 'EXCLUIDO') THEN 0
            ELSE COALESCE(v_product.tax_rate_percent, 0) END;
        v_gross := ROUND(v_qty * v_product.public_sale_price, 2);
        v_line_tax := ROUND(v_gross * v_tax_rate / 100.0, 2);

        v_lines := v_lines || jsonb_build_array(jsonb_build_object(
            'product_id', v_product_id, 'quantity', v_qty, 'unit_price', v_product.public_sale_price,
            'subtotal', v_gross));
        v_subtotal := v_subtotal + v_gross;
        v_tax_total := v_tax_total + v_line_tax;
    END LOOP;

    -- Consecutivo diario global (order_number es UNIQUE en toda la tabla).
    PERFORM pg_advisory_xact_lock(hashtext('web-order-number'));
    v_prefix := 'WEB-' || to_char(NOW() AT TIME ZONE 'America/Bogota', 'YYMMDD') || '-';
    SELECT COALESCE(MAX(NULLIF(regexp_replace(order_number, '^' || v_prefix, ''), '')::INTEGER), 0) + 1
    INTO v_seq
    FROM public.web_orders
    WHERE order_number ~ ('^' || v_prefix || '[0-9]+$');
    v_order_number := v_prefix || lpad(v_seq::TEXT, 4, '0');

    INSERT INTO public.web_orders (
        order_number, channel, company_id, customer_name, customer_phone, customer_email,
        shipping_address, shipping_city, dispatch_location_id, subtotal, shipping_fee, total,
        payment_status, fulfillment_status, notes, idempotency_key
    ) VALUES (
        v_order_number, 'SUPER_MAS', p_company_id, LEFT(v_name, 150), LEFT(v_phone, 50), LEFT(v_email, 150),
        v_address, LEFT(v_city, 100), v_location_id, v_subtotal, 0, v_subtotal + v_tax_total,
        'PENDING', 'PENDING', v_notes, p_idempotency_key
    )
    RETURNING id INTO v_order_id;

    INSERT INTO public.web_order_items (order_id, company_id, product_id, quantity, unit_price, subtotal)
    SELECT v_order_id, p_company_id, (l->>'product_id')::UUID, (l->>'quantity')::NUMERIC,
           (l->>'unit_price')::NUMERIC, (l->>'subtotal')::NUMERIC
    FROM jsonb_array_elements(v_lines) l;

    INSERT INTO public.audit_logs (company_id, user_id, user_name, action, module, entity_name, entity_id,
                                   location_id, previous_value, new_value, created_at)
    VALUES (p_company_id, NULL, 'Tienda web', 'WEB_ORDER_CREATED', 'WEB_ORDERS', 'web_orders',
            v_order_id::TEXT, v_location_id, NULL,
            jsonb_build_object('order_number', v_order_number, 'subtotal', v_subtotal,
                               'tax_amount', v_tax_total, 'total', v_subtotal + v_tax_total,
                               'items', jsonb_array_length(v_lines), 'channel', 'SUPER_MAS'),
            NOW());

    RETURN jsonb_build_object('web_order_id', v_order_id, 'order_number', v_order_number,
                              'subtotal', v_subtotal, 'tax_amount', v_tax_total,
                              'total', v_subtotal + v_tax_total, 'idempotent_replay', false);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_create_public_web_order(UUID, JSONB, JSONB, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_create_public_web_order(UUID, JSONB, JSONB, UUID) TO service_role;

COMMIT;
