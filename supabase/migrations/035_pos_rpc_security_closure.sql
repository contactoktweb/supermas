-- ==============================================================================
-- 035_POS_RPC_SECURITY_CLOSURE.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Cierre de Seguridad para fn_execute_pos_sale:
-- 1. Determinación de identidad fiduciaria via auth.uid()
-- 2. Validación de company_id estricta contra get_auth_company_id() (aislamiento multi-tenant infalible)
-- 3. Autorización RBAC (pos.access, sales.create o superadmin)
-- 4. Protección contra impersonación de vendedor (p_seller_user_id)
-- 5. Validación de bodega autorizada (locations activa, de la empresa y con acceso de usuario)
-- 6. Validación de sesión de caja (cash_session OPEN, de la empresa, de la bodega, y asignada al cajero)
-- 7. Validación de cliente aislado por tenant y activo (Consumidor Final seguro)
-- 8. Protección fiduciaria de Precios de Catálogo (anti price-tampering)
-- 9. Protección fiduciaria de Impuestos de Catálogo (anti tax-tampering)
-- 10. Validación estricta de porcentajes de descuento (0% a 50%)
-- 11. Validación de método de pago enum
-- 12. Idempotencia y anti-colisión en sale_number
-- 13. SET search_path = public, pg_catalog y SECURITY DEFINER auditado
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
    v_caller_id UUID;
    v_auth_company_id UUID;
    v_is_superadmin BOOLEAN := false;
    v_has_pos_access BOOLEAN := false;
    v_has_sales_create BOOLEAN := false;

    v_sale_id UUID := gen_random_uuid();
    v_seller_name VARCHAR(150);
    v_seller_active BOOLEAN;
    v_seller_company_id UUID;
    
    v_loc_name VARCHAR(200);
    v_loc_status VARCHAR(20);
    v_loc_company_id UUID;

    v_cs_company_id UUID;
    v_cs_location_id UUID;
    v_cs_user_id UUID;
    v_cs_status VARCHAR(20);

    v_customer_doc VARCHAR(50);
    v_customer_name VARCHAR(200);
    v_cust_company_id UUID;
    v_cust_is_active BOOLEAN;

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
    v_prod_tax_rate NUMERIC(5,2);
    v_is_tax_exempt BOOLEAN;
    
    v_line_subtotal NUMERIC(15,2);
    v_line_disc NUMERIC(15,2);
    v_line_taxable NUMERIC(15,2);
    v_line_tax NUMERIC(15,2);
    v_line_total NUMERIC(15,2);
    v_line_cost NUMERIC(15,2);
    
    v_current_qty NUMERIC(12,2);
    v_avg_cost NUMERIC(15,2);
    v_prod_name VARCHAR(200);
    v_prod_company_id UUID;
    v_public_sale_price NUMERIC(15,2);
    v_wholesale_price NUMERIC(15,2);
    v_min_wholesale_qty INTEGER;
    v_is_active BOOLEAN;
    v_new_stock NUMERIC(12,2);
BEGIN
    -- =========================================================================
    -- 1. IDENTIFICACIÓN Y AISLAMIENTO MULTI-TENANT (auth.uid() + get_auth_company_id())
    -- =========================================================================
    v_caller_id := auth.uid();

    IF v_caller_id IS NOT NULL THEN
        -- Contexto de sesión autenticada (Supabase JWT / authenticated role)
        v_auth_company_id := public.get_auth_company_id();
        
        IF v_auth_company_id IS NULL THEN
            RAISE EXCEPTION 'Acceso denegado: El usuario autenticado no tiene una empresa asignada o su cuenta no está configurada.'
                USING ERRCODE = '42501';
        END IF;

        IF p_company_id IS NULL OR p_company_id != v_auth_company_id THEN
            RAISE EXCEPTION 'Acceso denegado: Violación multi-tenant detectada. La empresa solicitada (%) no coincide con la empresa autorizada (%).',
                p_company_id, v_auth_company_id
                USING ERRCODE = '42501';
        END IF;

        -- Verificación de permisos RBAC
        v_is_superadmin := public.is_admin();
        v_has_pos_access := public.has_permission('pos.access');
        v_has_sales_create := public.has_permission('sales.create');

        IF NOT (v_is_superadmin OR v_has_pos_access OR v_has_sales_create) THEN
            RAISE EXCEPTION 'Acceso denegado: El usuario no tiene permisos suficientes (pos.access o sales.create) para registrar ventas POS.'
                USING ERRCODE = '42501';
        END IF;
    ELSE
        -- Llamada directa por conexiones de servicio / mantenimiento administrativo interno
        IF CURRENT_USER NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
            RAISE EXCEPTION 'Acceso denegado: Usuario no autenticado.' USING ERRCODE = '28000';
        END IF;

        IF p_company_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id) THEN
            RAISE EXCEPTION 'company_id inválido o inexistente.' USING ERRCODE = '23502';
        END IF;
    END IF;

    -- =========================================================================
    -- 2. VALIDACIÓN DE CAJERO / VENDEDOR (Anti-Impersonation)
    -- =========================================================================
    IF v_caller_id IS NOT NULL THEN
        -- Si no se envía vendedor, el vendedor es obligatoriamente el usuario autenticado
        IF p_seller_user_id IS NULL THEN
            p_seller_user_id := v_caller_id;
        END IF;

        -- Si se intenta registrar a nombre de otro vendedor: solo permitido a administradores
        IF p_seller_user_id != v_caller_id THEN
            IF NOT v_is_superadmin THEN
                RAISE EXCEPTION 'Acceso denegado: No está autorizado para registrar ventas POS en nombre de otro usuario.'
                    USING ERRCODE = '42501';
            END IF;

            -- Si es admin, validar que el vendedor destino exista, sea de la misma empresa y esté activo
            SELECT full_name, is_active, company_id INTO v_seller_name, v_seller_active, v_seller_company_id
            FROM public.users
            WHERE id = p_seller_user_id;

            IF NOT FOUND OR v_seller_company_id != p_company_id THEN
                RAISE EXCEPTION 'El vendedor especificado no existe o no pertenece a la empresa.'
                    USING ERRCODE = '23503';
            END IF;

            IF v_seller_active = false THEN
                RAISE EXCEPTION 'El vendedor especificado está inactivo.'
                    USING ERRCODE = '55001';
            END IF;
        ELSE
            -- El vendedor es el mismo usuario autenticado
            SELECT full_name, is_active INTO v_seller_name, v_seller_active
            FROM public.users
            WHERE id = v_caller_id;

            IF v_seller_active = false THEN
                RAISE EXCEPTION 'El usuario autenticado se encuentra inactivo en el sistema.'
                    USING ERRCODE = '55001';
            END IF;
        END IF;
    ELSE
        -- Conexión de servicio directo
        SELECT full_name INTO v_seller_name
        FROM public.users
        WHERE id = p_seller_user_id AND company_id = p_company_id;
    END IF;

    IF v_seller_name IS NULL THEN
        v_seller_name := 'Cajero POS';
    END IF;

    -- =========================================================================
    -- 3. VALIDACIÓN DE SEDE / BODEGA (Anti-Location-Escape)
    -- =========================================================================
    IF p_location_id IS NULL THEN
        RAISE EXCEPTION 'location_id es requerido para registrar la venta.' USING ERRCODE = '23502';
    END IF;

    SELECT name, status, company_id INTO v_loc_name, v_loc_status, v_loc_company_id
    FROM public.locations
    WHERE id = p_location_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La bodega/sede % no existe.', p_location_id USING ERRCODE = '23503';
    END IF;

    IF v_loc_company_id != p_company_id THEN
        RAISE EXCEPTION 'Acceso denegado: La bodega/sede "%" no pertenece a la empresa de la venta.', v_loc_name
            USING ERRCODE = '42501';
    END IF;

    IF v_loc_status != 'ACTIVE' THEN
        RAISE EXCEPTION 'La bodega/sede "%" está inactiva.', v_loc_name USING ERRCODE = '55001';
    END IF;

    -- Validar que el usuario autenticado tenga asignación/acceso a la sede (o sea superadmin)
    IF v_caller_id IS NOT NULL AND NOT public.has_location_access(p_location_id) THEN
        RAISE EXCEPTION 'Acceso denegado: El usuario no tiene asignación ni acceso a la bodega "%".', v_loc_name
            USING ERRCODE = '42501';
    END IF;

    -- =========================================================================
    -- 4. VALIDACIÓN DE MÉTODO DE PAGO Y CAJA (Anti-Cash-Session-Escape)
    -- =========================================================================
    IF p_payment_method NOT IN ('CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'CREDIT', 'MIXED') THEN
        RAISE EXCEPTION 'Método de pago no válido: %. Métodos permitidos: CASH, CREDIT_CARD, DEBIT_CARD, BANK_TRANSFER, CREDIT, MIXED.', p_payment_method
            USING ERRCODE = '22023';
    END IF;

    IF p_payment_method = 'CASH' THEN
        IF p_cash_session_id IS NULL THEN
            RAISE EXCEPTION 'Se requiere una sesión de caja abierta para registrar pagos en efectivo.'
                USING ERRCODE = '55001';
        END IF;

        SELECT company_id, location_id, user_id, status
        INTO v_cs_company_id, v_cs_location_id, v_cs_user_id, v_cs_status
        FROM public.cash_sessions
        WHERE id = p_cash_session_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'La sesión de caja % no existe.', p_cash_session_id USING ERRCODE = '23503';
        END IF;

        IF v_cs_company_id != p_company_id THEN
            RAISE EXCEPTION 'Acceso denegado: La sesión de caja % no pertenece a la empresa de la venta.', p_cash_session_id
                USING ERRCODE = '42501';
        END IF;

        IF v_cs_location_id IS NOT NULL AND v_cs_location_id != p_location_id THEN
            RAISE EXCEPTION 'Acceso denegado: La sesión de caja % pertenece a una sede distinta a la sede de la venta.', p_cash_session_id
                USING ERRCODE = '42501';
        END IF;

        IF v_cs_status != 'OPEN' THEN
            RAISE EXCEPTION 'La sesión de caja % no está abierta (estado actual: %).', p_cash_session_id, v_cs_status
                USING ERRCODE = '55001';
        END IF;

        -- El cajero debe ser el dueño de la sesión (a menos que sea superadmin)
        IF v_caller_id IS NOT NULL AND v_cs_user_id != v_caller_id AND NOT v_is_superadmin THEN
            RAISE EXCEPTION 'Acceso denegado: La sesión de caja % pertenece a otro cajero.', p_cash_session_id
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- =========================================================================
    -- 5. VALIDACIÓN DE CLIENTE (Anti-Customer-Tenant-Leak & Consumidor Final)
    -- =========================================================================
    IF p_customer_id IS NOT NULL THEN
        SELECT document_number, COALESCE(company_name, TRIM(CONCAT(first_name, ' ', last_name))), company_id, is_active
        INTO v_customer_doc, v_customer_name, v_cust_company_id, v_cust_is_active
        FROM public.customers
        WHERE id = p_customer_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El cliente % no existe.', p_customer_id USING ERRCODE = '23503';
        END IF;

        IF v_cust_company_id != p_company_id THEN
            RAISE EXCEPTION 'Acceso denegado: El cliente % no pertenece a la empresa de la venta.', p_customer_id
                USING ERRCODE = '42501';
        END IF;

        IF v_cust_is_active = false THEN
            RAISE EXCEPTION 'El cliente "%" está inactivo y no puede realizar compras.', v_customer_name
                USING ERRCODE = '55001';
        END IF;
    ELSE
        -- Si no se suministra cliente, resolver o inicializar el cliente 'Consumidor Final' para esta empresa
        SELECT id, document_number, COALESCE(company_name, TRIM(CONCAT(first_name, ' ', last_name)))
        INTO p_customer_id, v_customer_doc, v_customer_name
        FROM public.customers
        WHERE company_id = p_company_id AND document_number = '222222222222'
        LIMIT 1;

        IF p_customer_id IS NULL THEN
            INSERT INTO public.customers (
                company_id, document_type, document_number, first_name, last_name, customer_category, is_active
            ) VALUES (
                p_company_id, 'CC', '222222222222', 'Consumidor', 'Final', 'FINAL_CONSUMER', true
            ) RETURNING id INTO p_customer_id;
            v_customer_doc := '222222222222';
            v_customer_name := 'Consumidor Final';
        END IF;
    END IF;

    -- =========================================================================
    -- 6. VALIDACIÓN DE IDEMPOTENCIA / RETRY (Anti-Duplicate-Sale)
    -- =========================================================================
    IF p_sale_number IS NULL OR TRIM(p_sale_number) = '' THEN
        RAISE EXCEPTION 'sale_number es requerido.' USING ERRCODE = '23502';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.sales 
        WHERE company_id = p_company_id AND sale_number = p_sale_number
    ) THEN
        RAISE EXCEPTION 'La venta con número "%" ya fue registrada previamente en la empresa.', p_sale_number
            USING ERRCODE = '23505';
    END IF;

    -- =========================================================================
    -- 7. VALIDACIÓN DE LÍNEAS DE PRODUCTO, PRECIO, IMPUESTO Y STOCK (LOCK FOR UPDATE)
    -- =========================================================================
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'La venta debe contener al menos un producto.' USING ERRCODE = '23502';
    END IF;

    -- Primer pase atómico: Validar integridad fiduciaria de cada producto
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_prod_id := (v_item->>'product_id')::UUID;
        v_qty := (v_item->>'quantity')::NUMERIC(12,2);
        v_unit_price := (v_item->>'unit_price')::NUMERIC(15,2);
        v_disc_pct := COALESCE((v_item->>'discount_percent')::NUMERIC(5,2), 0);

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'Cantidad inválida (%): La cantidad vendida debe ser mayor a 0.', v_qty
                USING ERRCODE = '22003';
        END IF;

        -- Validación de límites de descuento (0% a 50% permitido)
        IF v_disc_pct < 0 OR v_disc_pct > 50 THEN
            RAISE EXCEPTION 'Descuento no permitido (%): El descuento no puede exceder el 50 por ciento.', v_disc_pct
                USING ERRCODE = '22003';
        END IF;

        -- Validar producto en catálogo de la empresa
        SELECT name, company_id, public_sale_price, wholesale_price, min_wholesale_quantity, 
               tax_rate_percent, is_tax_exempt, is_active
        INTO v_prod_name, v_prod_company_id, v_public_sale_price, v_wholesale_price, v_min_wholesale_qty,
             v_prod_tax_rate, v_is_tax_exempt, v_is_active
        FROM public.products
        WHERE id = v_prod_id;

        IF NOT FOUND OR v_prod_company_id != p_company_id THEN
            RAISE EXCEPTION 'El producto % no existe o no pertenece a la empresa.', v_prod_id
                USING ERRCODE = '23503';
        END IF;

        IF v_is_active = false THEN
            RAISE EXCEPTION 'El producto "%" está inactivo y no puede venderse.', v_prod_name
                USING ERRCODE = '55001';
        END IF;

        -- Validación de Precio Fiduciario (Anti Price-Tampering)
        IF v_unit_price IS NOT NULL THEN
            IF ABS(v_unit_price - v_public_sale_price) > 0.01 THEN
                IF NOT (v_wholesale_price > 0 AND v_qty >= COALESCE(v_min_wholesale_qty, 12) AND ABS(v_unit_price - v_wholesale_price) <= 0.01) THEN
                    RAISE EXCEPTION 'Precio unitario inválido para el producto "%". Precio enviado: %, Precio oficial de catálogo: %.',
                        v_prod_name, v_unit_price, v_public_sale_price
                        USING ERRCODE = '22003';
                END IF;
            END IF;
        ELSE
            v_unit_price := v_public_sale_price;
        END IF;

        -- Determinación Fiduciaria de Impuesto (Anti Tax-Tampering)
        IF v_is_tax_exempt = true THEN
            v_tax_rate := 0.00;
        ELSE
            v_tax_rate := COALESCE(v_prod_tax_rate, 19.00);
        END IF;

        -- Bloqueo pesimista de fila en stock_levels
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

    -- =========================================================================
    -- 8. INSERCIÓN DE VENTA EN public.sales
    -- =========================================================================
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
        paid_amount,
        payment_status,
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
        v_total_amount,
        'PAID',
        p_payment_method::payment_method_type,
        'ISSUED'::sale_status,
        COALESCE(p_notes, 'Venta POS mostrador ' || p_sale_number),
        NOW(),
        NOW()
    );

    -- =========================================================================
    -- 9. INSERCIÓN DE LÍNEAS (sale_items) Y MOVIMIENTOS KARDEX (inventory_movements)
    -- =========================================================================
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_prod_id := (v_item->>'product_id')::UUID;
        v_qty := (v_item->>'quantity')::NUMERIC(12,2);
        v_unit_price := (v_item->>'unit_price')::NUMERIC(15,2);
        v_disc_pct := COALESCE((v_item->>'discount_percent')::NUMERIC(5,2), 0);

        SELECT public_sale_price, wholesale_price, min_wholesale_quantity, tax_rate_percent, is_tax_exempt
        INTO v_public_sale_price, v_wholesale_price, v_min_wholesale_qty, v_prod_tax_rate, v_is_tax_exempt
        FROM public.products
        WHERE id = v_prod_id;

        IF v_unit_price IS NULL OR ABS(v_unit_price - v_public_sale_price) <= 0.01 THEN
            v_unit_price := v_public_sale_price;
        ELSIF v_wholesale_price > 0 AND v_qty >= COALESCE(v_min_wholesale_qty, 12) AND ABS(v_unit_price - v_wholesale_price) <= 0.01 THEN
            v_unit_price := v_wholesale_price;
        ELSE
            v_unit_price := v_public_sale_price;
        END IF;

        IF v_is_tax_exempt = true THEN
            v_tax_rate := 0.00;
        ELSE
            v_tax_rate := COALESCE(v_prod_tax_rate, 19.00);
        END IF;

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

        -- Movimiento Kardex inmutable
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

    -- =========================================================================
    -- 10. INGRESO EN SESIÓN DE CAJA (Si es pago en efectivo)
    -- =========================================================================
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

    -- =========================================================================
    -- 11. REGISTRO DE AUDITORÍA
    -- =========================================================================
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
        COALESCE(v_caller_id, p_seller_user_id),
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
            'cash_session_id', p_cash_session_id,
            'seller_user_id', p_seller_user_id,
            'caller_user_id', v_caller_id
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
