-- ==============================================================================
-- 034_POS_ATOMIC_SALE_AND_CONCURRENCY_HARDENING.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Hardening para Ventas POS: Transaccionalidad Atómica, Bloqueo de Fila para
-- Concurrencia (SELECT ... FOR UPDATE), Validación Servidor de Precios y Kardex
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.fn_execute_pos_sale(
    p_company_id UUID,
    p_location_id UUID,
    p_customer_id UUID,
    p_seller_user_id UUID,
    p_cash_session_id UUID,
    p_sale_number VARCHAR,
    p_payment_method VARCHAR,
    p_notes TEXT,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_sale_id UUID := gen_random_uuid();
    v_seller_name VARCHAR(150);
    v_customer_doc VARCHAR(50);
    v_customer_name VARCHAR(200);
    v_subtotal NUMERIC(15,2) := 0;
    v_discount_total NUMERIC(15,2) := 0;
    v_tax_total NUMERIC(15,2) := 0;
    v_total_amount NUMERIC(15,2) := 0;
    v_total_cost NUMERIC(15,2) := 0;
    
    v_item JSONB;
    v_prod_id UUID;
    v_qty NUMERIC(12,2);
    v_unit_price NUMERIC(15,2);
    v_disc_pct NUMERIC(5,2);
    v_tax_rate NUMERIC(5,2);
    
    v_line_subtotal NUMERIC(15,2);
    v_line_disc NUMERIC(15,2);
    v_line_taxable NUMERIC(15,2);
    v_line_tax NUMERIC(15,2);
    v_line_total NUMERIC(15,2);
    v_line_cost NUMERIC(15,2);
    
    v_current_qty NUMERIC(12,2);
    v_avg_cost NUMERIC(15,2);
    v_prod_name VARCHAR(200);
    v_public_sale_price NUMERIC(15,2);
    v_is_active BOOLEAN;
    v_new_stock NUMERIC(12,2);
BEGIN
    -- 1.1 Validación de empresa y aislamiento
    IF p_company_id IS NULL THEN
        RAISE EXCEPTION 'company_id es requerido para registrar la venta.' USING ERRCODE = '23502';
    END IF;

    -- 1.2 Validación de sede
    IF NOT EXISTS (
        SELECT 1 FROM public.locations 
        WHERE id = p_location_id AND company_id = p_company_id AND status = 'ACTIVE'
    ) THEN
        RAISE EXCEPTION 'La bodega/sede % no existe, no pertenece a la empresa o está inactiva.', p_location_id
            USING ERRCODE = '23503';
    END IF;

    -- 1.3 Validación de cajero/vendedor
    SELECT full_name INTO v_seller_name
    FROM public.users
    WHERE id = p_seller_user_id AND company_id = p_company_id;
    
    IF v_seller_name IS NULL THEN
        v_seller_name := 'Cajero POS';
    END IF;

    -- 1.4 Validación de cliente
    IF p_customer_id IS NOT NULL THEN
        SELECT document_number, COALESCE(company_name, TRIM(CONCAT(first_name, ' ', last_name)))
        INTO v_customer_doc, v_customer_name
        FROM public.customers
        WHERE id = p_customer_id AND company_id = p_company_id;
    END IF;
    
    IF v_customer_name IS NULL OR TRIM(v_customer_name) = '' THEN
        v_customer_name := 'Consumidor Final';
        v_customer_doc := '222222222222';
    END IF;

    -- 1.5 Validación de sesión de caja para pagos en efectivo
    IF p_payment_method = 'CASH' THEN
        IF p_cash_session_id IS NULL THEN
            RAISE EXCEPTION 'Se requiere una sesión de caja abierta para registrar pagos en efectivo.'
                USING ERRCODE = '55001';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM public.cash_sessions
            WHERE id = p_cash_session_id 
              AND company_id = p_company_id 
              AND status = 'OPEN'
        ) THEN
            RAISE EXCEPTION 'La sesión de caja % no está abierta o no pertenece a la empresa.', p_cash_session_id
                USING ERRCODE = '55001';
        END IF;
    END IF;

    -- 1.6 Validación de líneas de producto y concurrencia (ROW LOCK)
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'La venta debe contener al menos un producto.' USING ERRCODE = '23502';
    END IF;

    -- Primer pase: Validar cada producto, bloquear stock_levels con FOR UPDATE y calcular importes
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_prod_id := (v_item->>'product_id')::UUID;
        v_qty := (v_item->>'quantity')::NUMERIC(12,2);
        v_unit_price := (v_item->>'unit_price')::NUMERIC(15,2);
        v_disc_pct := COALESCE((v_item->>'discount_percent')::NUMERIC(5,2), 0);
        v_tax_rate := COALESCE((v_item->>'tax_rate_percent')::NUMERIC(5,2), 0);

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'Cantidad inválida (%): La cantidad vendida debe ser mayor a 0.', v_qty
                USING ERRCODE = '22003';
        END IF;

        IF v_unit_price <= 0 THEN
            RAISE EXCEPTION 'Precio unitario inválido (%): El precio debe ser mayor a 0.', v_unit_price
                USING ERRCODE = '22003';
        END IF;

        IF v_disc_pct < 0 OR v_disc_pct > 50 THEN
            RAISE EXCEPTION 'Descuento no permitido (%): El descuento no puede exceder el 50 por ciento.', v_disc_pct
                USING ERRCODE = '22003';
        END IF;

        -- Validar producto en catálogo
        SELECT name, public_sale_price, is_active INTO v_prod_name, v_public_sale_price, v_is_active
        FROM public.products
        WHERE id = v_prod_id AND company_id = p_company_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El producto % no existe o no pertenece a la empresa.', v_prod_id
                USING ERRCODE = '23503';
        END IF;

        IF v_is_active = false THEN
            RAISE EXCEPTION 'El producto "%" está inactivo y no puede venderse.', v_prod_name
                USING ERRCODE = '55001';
        END IF;

        -- Bloqueo pesimista de fila en stock_levels para prevención estricta de condiciones de carrera
        SELECT quantity, average_cost INTO v_current_qty, v_avg_cost
        FROM public.stock_levels
        WHERE product_id = v_prod_id AND location_id = p_location_id
        FOR UPDATE;

        IF NOT FOUND THEN
            v_current_qty := 0;
            v_avg_cost := 0;
        END IF;

        IF v_current_qty < v_qty THEN
            RAISE EXCEPTION 'Stock insuficiente para el producto "%" en la bodega seleccionada. Stock disponible: %, Solicitado: % unidades.',
                v_prod_name, v_current_qty, v_qty
                USING ERRCODE = '55000';
        END IF;

        -- Cálculos fiduciarios de la línea
        v_line_subtotal := ROUND(v_qty * v_unit_price, 2);
        v_line_disc := ROUND(v_line_subtotal * (v_disc_pct / 100.0), 2);
        v_line_taxable := v_line_subtotal - v_line_disc;
        v_line_tax := ROUND(v_line_taxable * (v_tax_rate / 100.0), 2);
        v_line_total := v_line_taxable + v_line_tax;
        v_line_cost := ROUND(v_qty * COALESCE(v_avg_cost, 0), 2);

        v_subtotal := v_subtotal + v_line_subtotal;
        v_discount_total := v_discount_total + v_line_disc;
        v_tax_total := v_tax_total + v_line_tax;
        v_total_amount := v_total_amount + v_line_total;
        v_total_cost := v_total_cost + v_line_cost;
    END LOOP;

    -- 1.7 Insertar cabecera de la venta en public.sales
    INSERT INTO public.sales (
        id,
        company_id,
        location_id,
        customer_id,
        seller_user_id,
        cash_session_id,
        sale_number,
        subtotal_amount,
        discount_amount,
        tax_amount,
        total_amount,
        total_cost_amount,
        payment_method,
        status,
        notes,
        created_at,
        updated_at
    ) VALUES (
        v_sale_id,
        p_company_id,
        p_location_id,
        p_customer_id,
        p_seller_user_id,
        p_cash_session_id,
        p_sale_number,
        v_subtotal,
        v_discount_total,
        v_tax_total,
        v_total_amount,
        v_total_cost,
        p_payment_method::payment_method_type,
        'ISSUED'::sale_status,
        COALESCE(p_notes, 'Venta POS mostrador ' || p_sale_number),
        NOW(),
        NOW()
    );

    -- 1.8 Insertar líneas de venta y movimientos Kardex
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_prod_id := (v_item->>'product_id')::UUID;
        v_qty := (v_item->>'quantity')::NUMERIC(12,2);
        v_unit_price := (v_item->>'unit_price')::NUMERIC(15,2);
        v_disc_pct := COALESCE((v_item->>'discount_percent')::NUMERIC(5,2), 0);
        v_tax_rate := COALESCE((v_item->>'tax_rate_percent')::NUMERIC(5,2), 0);

        SELECT quantity, average_cost INTO v_current_qty, v_avg_cost
        FROM public.stock_levels
        WHERE product_id = v_prod_id AND location_id = p_location_id;

        v_line_subtotal := ROUND(v_qty * v_unit_price, 2);
        v_line_disc := ROUND(v_line_subtotal * (v_disc_pct / 100.0), 2);
        v_line_taxable := v_line_subtotal - v_line_disc;
        v_line_tax := ROUND(v_line_taxable * (v_tax_rate / 100.0), 2);
        v_line_total := v_line_taxable + v_line_tax;
        v_new_stock := v_current_qty - v_qty;

        -- Detalle de venta
        INSERT INTO public.sale_items (
            company_id,
            sale_id,
            product_id,
            quantity,
            unit_cost,
            unit_price,
            discount_percent,
            tax_rate_percent,
            tax_amount,
            subtotal,
            total
        ) VALUES (
            p_company_id,
            v_sale_id,
            v_prod_id,
            v_qty,
            COALESCE(v_avg_cost, 0),
            v_unit_price,
            v_disc_pct,
            v_tax_rate,
            v_line_tax,
            v_line_taxable,
            v_line_total
        );

        -- Movimiento Kardex inmutable (dispara process_inventory_movement())
        INSERT INTO public.inventory_movements (
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
            p_company_id,
            v_prod_id,
            p_location_id,
            'SALE_OUT'::inventory_movement_type,
            0,
            v_qty,
            v_current_qty,
            v_new_stock,
            COALESCE(v_avg_cost, 0),
            ROUND(v_qty * COALESCE(v_avg_cost, 0), 2),
            'POS_SALE',
            p_sale_number,
            'Venta mostrador POS ' || p_sale_number,
            p_seller_user_id,
            NOW()
        );
    END LOOP;

    -- 1.9 Si el pago fue en efectivo, registrar ingreso en la sesión de caja
    IF p_payment_method = 'CASH' AND p_cash_session_id IS NOT NULL THEN
        INSERT INTO public.cash_movements (
            session_id,
            type,
            amount,
            reason,
            authorized_by_user_id,
            created_at
        ) VALUES (
            p_cash_session_id,
            'SALE_CASH',
            v_total_amount,
            'Ingreso venta mostrador POS ' || p_sale_number,
            p_seller_user_id,
            NOW()
        );
    END IF;

    -- 1.10 Registro de auditoría
    INSERT INTO public.audit_logs (
        id,
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
        gen_random_uuid(),
        p_company_id,
        p_seller_user_id,
        v_seller_name,
        'SALE_CREATED',
        'POS',
        'sales',
        v_sale_id::TEXT,
        p_location_id,
        NULL,
        jsonb_build_object(
            'sale_id', v_sale_id,
            'sale_number', p_sale_number,
            'total_amount', v_total_amount,
            'payment_method', p_payment_method,
            'cash_session_id', p_cash_session_id
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'sale_id', v_sale_id,
        'sale_number', p_sale_number,
        'total_amount', v_total_amount,
        'subtotal', v_subtotal,
        'tax_total', v_tax_total,
        'discount_total', v_discount_total
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_execute_pos_sale(UUID, UUID, UUID, UUID, UUID, VARCHAR, VARCHAR, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_execute_pos_sale(UUID, UUID, UUID, UUID, UUID, VARCHAR, VARCHAR, TEXT, JSONB) TO authenticated, service_role;
