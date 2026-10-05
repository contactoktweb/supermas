-- ============================================================================
-- MIGRACIÓN 044: MÓDULO DE DEVOLUCIONES (CLIENTE Y PROVEEDOR) CON KARDEX REAL
-- ============================================================================

-- 1. Tabla de Devoluciones (Cabecera)
CREATE TABLE IF NOT EXISTS public.returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL UNIQUE,
    return_type VARCHAR(20) NOT NULL CHECK (return_type IN ('CUSTOMER_RETURN', 'SUPPLIER_RETURN')),
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
    source_document_type VARCHAR(30) NOT NULL CHECK (source_document_type IN ('SALE', 'PURCHASE')),
    source_document_id UUID NOT NULL,
    source_document_code VARCHAR(50),
    customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    total_items INTEGER NOT NULL DEFAULT 0,
    total_units NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    reason TEXT NOT NULL,
    notes TEXT,
    created_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabla de Ítems de Devolución
CREATE TABLE IF NOT EXISTS public.return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    unit_price NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Índices de rendimiento y multiempresa
CREATE INDEX IF NOT EXISTS idx_returns_company ON public.returns(company_id);
CREATE INDEX IF NOT EXISTS idx_returns_code ON public.returns(code);
CREATE INDEX IF NOT EXISTS idx_returns_source_doc ON public.returns(source_document_id);
CREATE INDEX IF NOT EXISTS idx_returns_customer ON public.returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_returns_supplier ON public.returns(supplier_id);
CREATE INDEX IF NOT EXISTS idx_returns_location ON public.returns(location_id);
CREATE INDEX IF NOT EXISTS idx_return_items_return ON public.return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_return_items_product ON public.return_items(product_id);

-- 4. Habilitar RLS
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation select returns" ON public.returns;
CREATE POLICY "Tenant isolation select returns" ON public.returns
    FOR SELECT TO authenticated
    USING (company_id = public.get_auth_company_id());

DROP POLICY IF EXISTS "Tenant isolation insert returns" ON public.returns;
CREATE POLICY "Tenant isolation insert returns" ON public.returns
    FOR INSERT TO authenticated
    WITH CHECK (company_id = public.get_auth_company_id());

DROP POLICY IF EXISTS "Tenant isolation update returns" ON public.returns;
CREATE POLICY "Tenant isolation update returns" ON public.returns
    FOR UPDATE TO authenticated
    USING (company_id = public.get_auth_company_id())
    WITH CHECK (company_id = public.get_auth_company_id());

DROP POLICY IF EXISTS "Tenant isolation select return_items" ON public.return_items;
CREATE POLICY "Tenant isolation select return_items" ON public.return_items
    FOR SELECT TO authenticated
    USING (company_id = public.get_auth_company_id());

DROP POLICY IF EXISTS "Tenant isolation insert return_items" ON public.return_items;
CREATE POLICY "Tenant isolation insert return_items" ON public.return_items
    FOR INSERT TO authenticated
    WITH CHECK (company_id = public.get_auth_company_id());

-- 5. Generador de Consecutivos de Devolución
CREATE OR REPLACE FUNCTION public.fn_next_return_code(
    p_company_id UUID,
    p_type VARCHAR
)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_prefix VARCHAR(10);
    v_next_val BIGINT;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('return_consecutive_' || p_company_id::text));

    IF p_type = 'CUSTOMER_RETURN' THEN
        v_prefix := 'DEV-CLI';
    ELSE
        v_prefix := 'DEV-PRV';
    END IF;

    SELECT COALESCE(MAX(
        CASE 
            WHEN code ~ ('^' || v_prefix || '-[0-9]+$') THEN SUBSTRING(code FROM LENGTH(v_prefix) + 2)::BIGINT
            ELSE 0 
        END
    ), 0) + 1
    INTO v_next_val
    FROM public.returns
    WHERE company_id = p_company_id AND return_type = p_type;

    RETURN v_prefix || '-' || LPAD(v_next_val::TEXT, 6, '0');
END;
$$;

-- 6. RPC: fn_process_customer_return (Devolución de cliente -> CUSTOMER_RETURN reingresa a Kardex)
CREATE OR REPLACE FUNCTION public.fn_process_customer_return(
    p_sale_id UUID,
    p_items JSONB,
    p_reason TEXT,
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
    v_sale RECORD;
    v_item JSONB;
    v_prod_id UUID;
    v_qty NUMERIC(12,2);
    v_sale_item RECORD;
    v_already_returned NUMERIC(12,2);
    v_return_id UUID;
    v_return_code VARCHAR(50);
    v_prev_stock NUMERIC(12,2);
    v_new_stock NUMERIC(12,2);
    v_total_units NUMERIC(12,2) := 0;
    v_total_amount NUMERIC(15,2) := 0;
    v_items_count INTEGER := 0;
BEGIN
    v_user_id := auth.uid();
    v_company_id := public.get_auth_company_id();

    IF v_company_id IS NULL THEN
        SELECT company_id INTO v_company_id FROM public.sales WHERE id = p_sale_id;
    END IF;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo determinar la empresa del usuario autenticado.'
            USING ERRCODE = '42501';
    END IF;

    IF NOT (public.has_permission('sales.create') OR public.has_permission('inventory.adjust') OR public.is_admin()) THEN
        RAISE EXCEPTION 'No tienes permisos para procesar devoluciones de venta.'
            USING ERRCODE = '42501';
    END IF;

    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Debe especificar al menos un producto a devolver.'
            USING ERRCODE = '42200';
    END IF;

    -- Bloqueo pesimista de la venta
    PERFORM pg_advisory_xact_lock(hashtext('sale_operation_' || p_sale_id::text));

    SELECT id, company_id, sale_number, customer_id, location_id, status
    INTO v_sale
    FROM public.sales
    WHERE id = p_sale_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La venta especificada no existe.' USING ERRCODE = '23503';
    END IF;

    IF v_sale.company_id != v_company_id THEN
        RAISE EXCEPTION 'La venta pertenece a otra empresa.' USING ERRCODE = '42501';
    END IF;

    IF v_sale.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'No se pueden procesar devoluciones sobre una venta anulada.'
            USING ERRCODE = '42200';
    END IF;

    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Usuario Sistema';
    END IF;

    v_return_code := public.fn_next_return_code(v_company_id, 'CUSTOMER_RETURN');
    v_return_id := gen_random_uuid();

    -- Validar y procesar cada ítem
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_prod_id := (v_item->>'product_id')::UUID;
        v_qty := (v_item->>'quantity')::NUMERIC;

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'La cantidad a devolver debe ser estrictamente mayor a 0.'
                USING ERRCODE = '42200';
        END IF;

        -- Consultar ítem original en la venta
        SELECT si.id, si.product_id, si.quantity, si.unit_cost, si.unit_price, p.name AS product_name
        INTO v_sale_item
        FROM public.sale_items si
        JOIN public.products p ON p.id = si.product_id
        WHERE si.sale_id = p_sale_id AND si.product_id = v_prod_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El producto % no formó parte de la venta %.', v_prod_id, v_sale.sale_number
                USING ERRCODE = '42200';
        END IF;

        -- Validar devoluciones previas del mismo producto en esta venta
        SELECT COALESCE(SUM(ri.quantity), 0)
        INTO v_already_returned
        FROM public.return_items ri
        JOIN public.returns r ON r.id = ri.return_id
        WHERE r.source_document_id = p_sale_id 
          AND ri.product_id = v_prod_id 
          AND r.status != 'CANCELLED';

        IF (v_already_returned + v_qty) > v_sale_item.quantity THEN
            RAISE EXCEPTION 'No se puede devolver % unidades de "%". Vendidas: %, ya devueltas: %, máximo restante: %.',
                v_qty,
                v_sale_item.product_name,
                v_sale_item.quantity,
                v_already_returned,
                (v_sale_item.quantity - v_already_returned)
                USING ERRCODE = '42200';
        END IF;

        -- Consultar stock actual en bodega para Kardex
        SELECT COALESCE(quantity, 0)
        INTO v_prev_stock
        FROM public.stock_levels
        WHERE product_id = v_prod_id AND location_id = v_sale.location_id
        FOR UPDATE;

        v_prev_stock := COALESCE(v_prev_stock, 0.00);
        v_new_stock := v_prev_stock + v_qty;

        -- Reingreso a inventario (Kardex CUSTOMER_RETURN)
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
            v_company_id,
            v_sale.location_id,
            v_prod_id,
            'CUSTOMER_RETURN',
            v_qty,
            0.00,
            v_prev_stock,
            v_new_stock,
            v_sale_item.unit_cost,
            ROUND(v_qty * v_sale_item.unit_cost, 2),
            'SALE_RETURN',
            v_return_code,
            'Devolución de cliente por venta ' || v_sale.sale_number || ': ' || p_reason,
            v_user_id,
            NOW()
        );

        -- Registrar ítem de devolución
        INSERT INTO public.return_items (
            id,
            return_id,
            company_id,
            product_id,
            quantity,
            unit_cost,
            unit_price,
            total_amount,
            reason,
            created_at
        ) VALUES (
            gen_random_uuid(),
            v_return_id,
            v_company_id,
            v_prod_id,
            v_qty,
            v_sale_item.unit_cost,
            v_sale_item.unit_price,
            ROUND(v_qty * v_sale_item.unit_price, 2),
            v_item->>'reason',
            NOW()
        );

        v_total_units := v_total_units + v_qty;
        v_total_amount := v_total_amount + ROUND(v_qty * v_sale_item.unit_price, 2);
        v_items_count := v_items_count + 1;
    END LOOP;

    -- Insertar cabecera de devolución
    INSERT INTO public.returns (
        id,
        company_id,
        code,
        return_type,
        status,
        source_document_type,
        source_document_id,
        source_document_code,
        customer_id,
        location_id,
        total_items,
        total_units,
        total_amount,
        reason,
        notes,
        created_by_user_id,
        created_at,
        updated_at
    ) VALUES (
        v_return_id,
        v_company_id,
        v_return_code,
        'CUSTOMER_RETURN',
        'COMPLETED',
        'SALE',
        p_sale_id,
        v_sale.sale_number,
        v_sale.customer_id,
        v_sale.location_id,
        v_items_count,
        v_total_units,
        v_total_amount,
        p_reason,
        p_notes,
        v_user_id,
        NOW(),
        NOW()
    );

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
        'CUSTOMER_RETURN_PROCESSED',
        'SALES',
        'returns',
        v_return_id::TEXT,
        v_sale.location_id,
        jsonb_build_object(
            'code', v_return_code,
            'sale_id', p_sale_id,
            'sale_number', v_sale.sale_number,
            'total_units', v_total_units,
            'total_amount', v_total_amount,
            'reason', p_reason
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'return_id', v_return_id,
        'code', v_return_code,
        'return_type', 'CUSTOMER_RETURN',
        'status', 'COMPLETED',
        'total_units', v_total_units,
        'total_amount', v_total_amount,
        'message', 'Devolución de cliente procesada exitosamente y mercancía reingresada a inventario.'
    );
END;
$$;

-- 7. RPC: fn_process_supplier_return (Devolución a proveedor -> SUPPLIER_RETURN descuenta de Kardex)
CREATE OR REPLACE FUNCTION public.fn_process_supplier_return(
    p_purchase_id UUID,
    p_items JSONB,
    p_reason TEXT,
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
    v_purchase RECORD;
    v_item JSONB;
    v_prod_id UUID;
    v_qty NUMERIC(12,2);
    v_pur_item RECORD;
    v_already_returned NUMERIC(12,2);
    v_return_id UUID;
    v_return_code VARCHAR(50);
    v_current_stock NUMERIC(12,2);
    v_prev_stock NUMERIC(12,2);
    v_new_stock NUMERIC(12,2);
    v_total_units NUMERIC(12,2) := 0;
    v_total_amount NUMERIC(15,2) := 0;
    v_items_count INTEGER := 0;
BEGIN
    v_user_id := auth.uid();
    v_company_id := public.get_auth_company_id();

    IF v_company_id IS NULL THEN
        SELECT company_id INTO v_company_id FROM public.purchases WHERE id = p_purchase_id;
    END IF;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo determinar la empresa del usuario autenticado.'
            USING ERRCODE = '42501';
    END IF;

    IF NOT (public.has_permission('purchases.create') OR public.has_permission('inventory.adjust') OR public.is_admin()) THEN
        RAISE EXCEPTION 'No tienes permisos para procesar devoluciones a proveedor.'
            USING ERRCODE = '42501';
    END IF;

    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Debe especificar al menos un producto a devolver.'
            USING ERRCODE = '42200';
    END IF;

    -- Bloqueo pesimista de la compra
    PERFORM pg_advisory_xact_lock(hashtext('purchase_operation_' || p_purchase_id::text));

    SELECT id, company_id, purchase_number, supplier_id, location_id, inventory_status
    INTO v_purchase
    FROM public.purchases
    WHERE id = p_purchase_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La compra especificada no existe.' USING ERRCODE = '23503';
    END IF;

    IF v_purchase.company_id != v_company_id THEN
        RAISE EXCEPTION 'La compra pertenece a otra empresa.' USING ERRCODE = '42501';
    END IF;

    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Usuario Sistema';
    END IF;

    v_return_code := public.fn_next_return_code(v_company_id, 'SUPPLIER_RETURN');
    v_return_id := gen_random_uuid();

    -- Validar y procesar cada ítem
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_prod_id := (v_item->>'product_id')::UUID;
        v_qty := (v_item->>'quantity')::NUMERIC;

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'La cantidad a devolver debe ser estrictamente mayor a 0.'
                USING ERRCODE = '42200';
        END IF;

        -- Consultar ítem de compra original
        SELECT pi.id, pi.product_id, pi.quantity, COALESCE(pi.received_quantity, pi.quantity) as effective_received, pi.unit_cost, p.name AS product_name
        INTO v_pur_item
        FROM public.purchase_items pi
        JOIN public.products p ON p.id = pi.product_id
        WHERE pi.purchase_id = p_purchase_id AND pi.product_id = v_prod_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El producto % no formó parte de la compra %.', v_prod_id, v_purchase.purchase_number
                USING ERRCODE = '42200';
        END IF;

        -- Validar devoluciones previas a proveedor de esta compra
        SELECT COALESCE(SUM(ri.quantity), 0)
        INTO v_already_returned
        FROM public.return_items ri
        JOIN public.returns r ON r.id = ri.return_id
        WHERE r.source_document_id = p_purchase_id 
          AND ri.product_id = v_prod_id 
          AND r.status != 'CANCELLED';

        IF (v_already_returned + v_qty) > v_pur_item.effective_received THEN
            RAISE EXCEPTION 'No se puede devolver % unidades de "%". Recibidas: %, ya devueltas: %, máximo restante: %.',
                v_qty,
                v_pur_item.product_name,
                v_pur_item.effective_received,
                v_already_returned,
                (v_pur_item.effective_received - v_already_returned)
                USING ERRCODE = '42200';
        END IF;

        -- Consultar y bloquear stock actual en bodega para verificar disponibilidad de salida
        SELECT COALESCE(quantity, 0)
        INTO v_current_stock
        FROM public.stock_levels
        WHERE product_id = v_prod_id AND location_id = v_purchase.location_id
        FOR UPDATE;

        IF v_current_stock IS NULL OR v_current_stock < v_qty THEN
            RAISE EXCEPTION 'Stock insuficiente en bodega para "%" (disponible: %, a devolver: %). Devolución abortada.',
                v_pur_item.product_name,
                COALESCE(v_current_stock, 0),
                v_qty
                USING ERRCODE = '42200';
        END IF;

        v_prev_stock := v_current_stock;
        v_new_stock := v_prev_stock - v_qty;

        -- Salida de inventario a proveedor (Kardex SUPPLIER_RETURN)
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
            v_company_id,
            v_purchase.location_id,
            v_prod_id,
            'SUPPLIER_RETURN',
            0.00,
            v_qty,
            v_prev_stock,
            v_new_stock,
            v_pur_item.unit_cost,
            ROUND(v_qty * v_pur_item.unit_cost, 2),
            'PURCHASE_RETURN',
            v_return_code,
            'Devolución a proveedor por compra ' || v_purchase.purchase_number || ': ' || p_reason,
            v_user_id,
            NOW()
        );

        -- Registrar ítem de devolución
        INSERT INTO public.return_items (
            id,
            return_id,
            company_id,
            product_id,
            quantity,
            unit_cost,
            unit_price,
            total_amount,
            reason,
            created_at
        ) VALUES (
            gen_random_uuid(),
            v_return_id,
            v_company_id,
            v_prod_id,
            v_qty,
            v_pur_item.unit_cost,
            0.00,
            ROUND(v_qty * v_pur_item.unit_cost, 2),
            v_item->>'reason',
            NOW()
        );

        v_total_units := v_total_units + v_qty;
        v_total_amount := v_total_amount + ROUND(v_qty * v_pur_item.unit_cost, 2);
        v_items_count := v_items_count + 1;
    END LOOP;

    -- Insertar cabecera de devolución
    INSERT INTO public.returns (
        id,
        company_id,
        code,
        return_type,
        status,
        source_document_type,
        source_document_id,
        source_document_code,
        supplier_id,
        location_id,
        total_items,
        total_units,
        total_amount,
        reason,
        notes,
        created_by_user_id,
        created_at,
        updated_at
    ) VALUES (
        v_return_id,
        v_company_id,
        v_return_code,
        'SUPPLIER_RETURN',
        'COMPLETED',
        'PURCHASE',
        p_purchase_id,
        v_purchase.purchase_number,
        v_purchase.supplier_id,
        v_purchase.location_id,
        v_items_count,
        v_total_units,
        v_total_amount,
        p_reason,
        p_notes,
        v_user_id,
        NOW(),
        NOW()
    );

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
        'SUPPLIER_RETURN_PROCESSED',
        'PURCHASES',
        'returns',
        v_return_id::TEXT,
        v_purchase.location_id,
        jsonb_build_object(
            'code', v_return_code,
            'purchase_id', p_purchase_id,
            'purchase_number', v_purchase.purchase_number,
            'total_units', v_total_units,
            'total_amount', v_total_amount,
            'reason', p_reason
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'return_id', v_return_id,
        'code', v_return_code,
        'return_type', 'SUPPLIER_RETURN',
        'status', 'COMPLETED',
        'total_units', v_total_units,
        'total_amount', v_total_amount,
        'message', 'Devolución a proveedor procesada exitosamente y salida registrada en Kardex.'
    );
END;
$$;

-- Permisos de ejecución
REVOKE ALL ON FUNCTION public.fn_next_return_code(UUID, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_next_return_code(UUID, VARCHAR) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_process_customer_return(UUID, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_process_customer_return(UUID, JSONB, TEXT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_process_supplier_return(UUID, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_process_supplier_return(UUID, JSONB, TEXT, TEXT) TO authenticated, service_role;
