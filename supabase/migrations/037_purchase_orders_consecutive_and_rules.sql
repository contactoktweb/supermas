-- ==============================================================================
-- 037_PURCHASE_ORDERS_CONSECUTIVE_AND_RULES.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- FASE 5.1: Órdenes de Compra Reales, Numeración Consecutiva Multiempresa y Reglas de Estado
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. INTEGRIDAD ESTRUCTURAL: CONSTRAINTS E ÍNDICES MULTIEMPRESA
-- ------------------------------------------------------------------------------

-- Constraint UNIQUE (company_id, purchase_number)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'purchases_company_id_purchase_number_key'
    ) THEN
        ALTER TABLE public.purchases 
        ADD CONSTRAINT purchases_company_id_purchase_number_key UNIQUE (company_id, purchase_number);
    END IF;
END $$;

-- Constraints de integridad para montos, cantidades y costos
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_items_quantity_check') THEN
        ALTER TABLE public.purchase_items ADD CONSTRAINT purchase_items_quantity_check CHECK (quantity > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_items_unit_cost_check') THEN
        ALTER TABLE public.purchase_items ADD CONSTRAINT purchase_items_unit_cost_check CHECK (unit_cost >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchases_subtotal_amount_check') THEN
        ALTER TABLE public.purchases ADD CONSTRAINT purchases_subtotal_amount_check CHECK (subtotal_amount >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchases_total_amount_check') THEN
        ALTER TABLE public.purchases ADD CONSTRAINT purchases_total_amount_check CHECK (total_amount >= 0);
    END IF;
END $$;

-- Índices de consulta y rendimiento multiempresa
CREATE INDEX IF NOT EXISTS idx_purchases_company_inventory_status ON public.purchases(company_id, inventory_status);
CREATE INDEX IF NOT EXISTS idx_purchases_company_supplier ON public.purchases(company_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_company_location ON public.purchases(company_id, location_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON public.purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product_id ON public.purchase_items(product_id);

-- ------------------------------------------------------------------------------
-- 1. FUNCIÓN DE CONSECUTIVO ATÓMICO MULTIEMPRESA PARA COMPRAS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_next_purchase_number(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_last_num INT;
    v_next_num TEXT;
BEGIN
    IF p_company_id IS NULL THEN
        RAISE EXCEPTION 'fn_next_purchase_number: company_id no puede ser nulo.'
            USING ERRCODE = '23502';
    END IF;

    -- Candado transaccional consultivo por empresa para prevenir colisiones en concurrencia
    PERFORM pg_advisory_xact_lock(hashtext('purchases_consecutive_' || p_company_id::text));

    -- Obtener el número máximo existente con formato COM-XXXXXX para esta compañía
    SELECT COALESCE(MAX(
        NULLIF(SUBSTRING(purchase_number FROM 'COM-([0-9]+)'), '')::INT
    ), 0)
    INTO v_last_num
    FROM public.purchases
    WHERE company_id = p_company_id
      AND purchase_number ~ '^COM-[0-9]+$';

    v_next_num := 'COM-' || LPAD((v_last_num + 1)::TEXT, 6, '0');
    RETURN v_next_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.fn_next_purchase_number(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_next_purchase_number(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. TRIGGER PARA ASIGNACIÓN AUTOMÁTICA DE CONSECUTIVO
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_assign_purchase_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.purchase_number IS NULL 
       OR TRIM(NEW.purchase_number) = '' 
       OR NEW.purchase_number = 'AUTO' 
       OR NEW.purchase_number ~ '^COM-TEMP' THEN
        NEW.purchase_number := public.fn_next_purchase_number(NEW.company_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.fn_assign_purchase_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_assign_purchase_number() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_assign_purchase_number ON public.purchases;
CREATE TRIGGER trg_assign_purchase_number
BEFORE INSERT ON public.purchases
FOR EACH ROW
EXECUTE FUNCTION public.fn_assign_purchase_number();

-- ------------------------------------------------------------------------------
-- 3. REGLAS DE NEGOCIO Y TRANSICIÓN DE ESTADOS (public.purchases)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_guard_purchase_status_transitions()
RETURNS TRIGGER AS $$
DECLARE
    v_old_st VARCHAR;
    v_new_st VARCHAR;
    v_has_received_items BOOLEAN;
BEGIN
    v_old_st := UPPER(COALESCE(OLD.inventory_status, ''));
    v_new_st := UPPER(COALESCE(NEW.inventory_status, ''));

    -- 3.1 No se puede alterar una compra cancelada
    IF v_old_st IN ('CANCELLED', 'CANCELADA') THEN
        IF current_setting('app.is_test_cleanup', true) = 'true' THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'Regla de negocio compras: La orden de compra % está CANCELADA y no admite modificaciones.', OLD.purchase_number
            USING ERRCODE = '23514';
    END IF;

    -- 3.2 Si la compra ya está recibida (total o parcial), proteger términos comerciales
    IF v_old_st IN ('RECEIVED', 'RECIBIDA', 'PARTIALLY_RECEIVED', 'RECIBIDA_PARCIALMENTE') THEN
        IF current_setting('app.is_test_cleanup', true) = 'true' THEN
            RETURN NEW;
        END IF;

        IF v_new_st IN ('DRAFT', 'BORRADOR', 'CONFIRMADA', 'CONFIRMED') THEN
            RAISE EXCEPTION 'Regla de negocio compras: Una orden recibida (%) no puede revertir a estado %.', OLD.purchase_number, v_new_st
                USING ERRCODE = '23514';
        END IF;

        IF OLD.supplier_id <> NEW.supplier_id 
           OR OLD.location_id <> NEW.location_id 
           OR OLD.subtotal_amount <> NEW.subtotal_amount 
           OR OLD.tax_amount <> NEW.tax_amount 
           OR OLD.total_amount <> NEW.total_amount THEN
            RAISE EXCEPTION 'Regla de negocio compras: No se pueden alterar proveedor, bodega ni montos de una orden recibida (%).', OLD.purchase_number
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- 3.3 Si la compra está CONFIRMADA:
    IF v_old_st IN ('CONFIRMADA', 'CONFIRMED') THEN
        -- No puede revertir a DRAFT
        IF v_new_st IN ('DRAFT', 'BORRADOR') THEN
            RAISE EXCEPTION 'Regla de negocio compras: Una orden de compra CONFIRMADA (%) no puede retornar a borrador.', OLD.purchase_number
                USING ERRCODE = '23514';
        END IF;

        -- No se pueden modificar proveedor, bodega o montos arbitrariamente si se mantiene en CONFIRMADA
        IF v_new_st IN ('CONFIRMADA', 'CONFIRMED') THEN
            IF OLD.supplier_id <> NEW.supplier_id 
               OR OLD.location_id <> NEW.location_id 
               OR OLD.subtotal_amount <> NEW.subtotal_amount 
               OR OLD.tax_amount <> NEW.tax_amount 
               OR OLD.total_amount <> NEW.total_amount THEN
                RAISE EXCEPTION 'Regla de negocio compras: La orden % está confirmada y es inmutable. Para modificar productos o condiciones debe cancelarse y emitir una nueva.', OLD.purchase_number
                    USING ERRCODE = '23514';
            END IF;
        END IF;

        -- Si se intenta cancelar, validar que no tenga ítems recibidos
        IF v_new_st IN ('CANCELLED', 'CANCELADA') THEN
            SELECT EXISTS (
                SELECT 1 FROM public.purchase_items
                WHERE purchase_id = OLD.id AND received_quantity > 0
            ) INTO v_has_received_items;

            IF v_has_received_items THEN
                RAISE EXCEPTION 'Regla de negocio compras: No se puede cancelar la orden % porque tiene mercancía ya recibida.', OLD.purchase_number
                    USING ERRCODE = '23514';
            END IF;
        END IF;
    END IF;

    -- 3.4 Si la orden pasa a CONFIRMADA, registrar timestamp y usuario si no estaban presentes
    IF (v_old_st IN ('DRAFT', 'BORRADOR') OR v_old_st = '') AND v_new_st IN ('CONFIRMADA', 'CONFIRMED') THEN
        IF NEW.confirmed_at IS NULL THEN
            NEW.confirmed_at := NOW();
        END IF;
        IF NEW.confirmed_by_user_id IS NULL AND auth.uid() IS NOT NULL THEN
            NEW.confirmed_by_user_id := auth.uid();
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.fn_guard_purchase_status_transitions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_guard_purchase_status_transitions() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_guard_purchase_status_transitions ON public.purchases;
CREATE TRIGGER trg_guard_purchase_status_transitions
BEFORE UPDATE ON public.purchases
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_purchase_status_transitions();

-- ------------------------------------------------------------------------------
-- 4. REGLAS DE NEGOCIO PARA LÍNEAS DE COMPRA (public.purchase_items)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_guard_purchase_items()
RETURNS TRIGGER AS $$
DECLARE
    v_parent_status VARCHAR;
BEGIN
    IF current_setting('app.is_test_cleanup', true) = 'true' THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        SELECT UPPER(COALESCE(inventory_status, '')) INTO v_parent_status
        FROM public.purchases
        WHERE id = OLD.purchase_id;

        IF v_parent_status IS NOT NULL AND v_parent_status NOT IN ('DRAFT', 'BORRADOR') THEN
            RAISE EXCEPTION 'Regla de negocio compras: No se pueden eliminar líneas de una orden de compra en estado %.', v_parent_status
                USING ERRCODE = '23514';
        END IF;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        SELECT UPPER(COALESCE(inventory_status, '')) INTO v_parent_status
        FROM public.purchases
        WHERE id = OLD.purchase_id;

        IF v_parent_status IS NOT NULL AND v_parent_status NOT IN ('DRAFT', 'BORRADOR') THEN
            -- Solo se permite actualizar received_quantity cuando no es borrador
            IF OLD.product_id IS DISTINCT FROM NEW.product_id
               OR OLD.quantity IS DISTINCT FROM NEW.quantity
               OR OLD.unit_cost IS DISTINCT FROM NEW.unit_cost
               OR OLD.discount_percent IS DISTINCT FROM NEW.discount_percent
               OR OLD.tax_rate_percent IS DISTINCT FROM NEW.tax_rate_percent THEN
                RAISE EXCEPTION 'Regla de negocio compras: Los productos, cantidades y costos no son editables en órdenes en estado %.', v_parent_status
                    USING ERRCODE = '23514';
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.fn_guard_purchase_items() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_guard_purchase_items() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_guard_purchase_items ON public.purchase_items;
CREATE TRIGGER trg_guard_purchase_items
BEFORE UPDATE OR DELETE ON public.purchase_items
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_purchase_items();

-- ------------------------------------------------------------------------------
-- 5. ACTUALIZACIÓN DE TRIGGER DE AUDITORÍA DE COMPRAS (PURCHASE_CONFIRMED)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_audit_purchases()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_user_name VARCHAR(150);
    v_company_id UUID;
    v_action VARCHAR(50);
    v_prev JSONB;
    v_new JSONB;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NOT NULL THEN
        SELECT u.full_name
        INTO v_user_name
        FROM public.users u
        WHERE u.id = v_user_id;

        IF NOT FOUND THEN
            v_user_id := NULL;
        END IF;
    END IF;

    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Sistema';
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.inventory_status IN ('CONFIRMADA', 'CONFIRMED') THEN
            v_action := 'PURCHASE_CONFIRMED';
        ELSE
            v_action := 'PURCHASE_CREATED';
        END IF;
        v_company_id := NEW.company_id;
        v_prev := NULL;
        v_new := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_company_id := NEW.company_id;
        v_prev := to_jsonb(OLD);
        v_new := to_jsonb(NEW);

        IF (OLD.inventory_status IS DISTINCT FROM NEW.inventory_status) 
           AND NEW.inventory_status IN ('CONFIRMADA', 'CONFIRMED') THEN
            v_action := 'PURCHASE_CONFIRMED';
        ELSIF (OLD.inventory_status IS DISTINCT FROM NEW.inventory_status) 
           AND NEW.inventory_status IN ('CANCELLED', 'CANCELADA') THEN
            v_action := 'PURCHASE_CANCELLED';
        ELSIF (OLD.inventory_status IS DISTINCT FROM NEW.inventory_status) 
           AND NEW.inventory_status IN ('RECEIVED', 'RECIBIDA') THEN
            v_action := 'PURCHASE_RECEIVED';
        ELSE
            v_action := 'PURCHASE_UPDATED';
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'PURCHASE_DELETED';
        v_company_id := OLD.company_id;
        v_prev := to_jsonb(OLD);
        v_new := NULL;
    END IF;

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
        v_company_id,
        v_user_id,
        v_user_name,
        v_action,
        'PURCHASES',
        'purchases',
        COALESCE(NEW.id, OLD.id)::TEXT,
        COALESCE(NEW.location_id, OLD.location_id),
        v_prev,
        v_new,
        NOW()
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.fn_audit_purchases() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_audit_purchases() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_audit_purchases ON public.purchases;
CREATE TRIGGER trg_audit_purchases
AFTER INSERT OR UPDATE OR DELETE ON public.purchases
FOR EACH ROW
EXECUTE FUNCTION public.fn_audit_purchases();

-- ------------------------------------------------------------------------------
-- 6. RPC: fn_create_purchase_order (CREACIÓN ATÓMICA DE ÓRDENES DE COMPRA)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_create_purchase_order(
    p_supplier_id UUID,
    p_location_id UUID,
    p_supplier_invoice_number VARCHAR,
    p_issue_date DATE,
    p_due_date DATE,
    p_payment_terms VARCHAR,
    p_notes TEXT,
    p_save_as_draft BOOLEAN,
    p_items JSONB
)
RETURNS UUID AS $$
DECLARE
    v_company_id UUID;
    v_supplier_active BOOLEAN;
    v_location_status VARCHAR;
    v_location_allow_purchases BOOLEAN;
    v_purchase_id UUID;
    v_purchase_number VARCHAR;
    v_inventory_status VARCHAR;
    v_item JSONB;
    v_product_id UUID;
    v_product_active BOOLEAN;
    v_quantity NUMERIC(12,2);
    v_unit_cost NUMERIC(15,2);
    v_discount_percent NUMERIC(5,2);
    v_discount_amount NUMERIC(15,2);
    v_tax_rate NUMERIC(5,2);
    v_tax_amount NUMERIC(15,2);
    v_line_subtotal NUMERIC(15,2);
    v_line_total NUMERIC(15,2);
    v_total_subtotal NUMERIC(15,2) := 0;
    v_total_discount NUMERIC(15,2) := 0;
    v_total_tax NUMERIC(15,2) := 0;
    v_total_amount NUMERIC(15,2) := 0;
    v_issue_date DATE;
    v_due_date DATE;
BEGIN
    -- 6.1 Derivar empresa y validar autenticación
    v_company_id := public.get_auth_company_id();
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo resolver la empresa del usuario autenticado.'
            USING ERRCODE = '42501';
    END IF;

    -- 6.2 Validar permisos de creación
    IF NOT (public.has_permission('purchases.create') OR public.is_admin()) THEN
        RAISE EXCEPTION 'No tienes permisos suficientes para registrar compras (purchases.create requerido).'
            USING ERRCODE = '42501';
    END IF;

    -- 6.3 Validar acceso a la bodega
    IF NOT (public.has_location_access(p_location_id) OR public.is_admin()) THEN
        RAISE EXCEPTION 'El usuario no tiene acceso a la bodega seleccionada.'
            USING ERRCODE = '42501';
    END IF;

    -- 6.4 Validar proveedor real, activo y de la empresa
    SELECT is_active INTO v_supplier_active
    FROM public.suppliers
    WHERE id = p_supplier_id AND company_id = v_company_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El proveedor no existe o pertenece a otra empresa.'
            USING ERRCODE = '23503';
    END IF;

    IF NOT v_supplier_active THEN
        RAISE EXCEPTION 'El proveedor seleccionado se encuentra inactivo.'
            USING ERRCODE = '23514';
    END IF;

    -- 6.5 Validar bodega real, activa, de la empresa y con allow_purchases
    SELECT status, allow_purchases INTO v_location_status, v_location_allow_purchases
    FROM public.locations
    WHERE id = p_location_id AND company_id = v_company_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La bodega de destino no existe o pertenece a otra empresa.'
            USING ERRCODE = '23503';
    END IF;

    IF v_location_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'La bodega de destino seleccionada se encuentra inactiva.'
            USING ERRCODE = '23514';
    END IF;

    IF NOT v_location_allow_purchases THEN
        RAISE EXCEPTION 'La bodega de destino no tiene habilitadas operaciones de compra (allow_purchases = false).'
            USING ERRCODE = '23514';
    END IF;

    -- 6.6 Validar que existan líneas
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Debe incluir al menos un producto en la orden de compra.'
            USING ERRCODE = '23514';
    END IF;

    -- 6.7 Validar cada producto de las líneas y calcular montos
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity := (v_item->>'quantity')::NUMERIC;
        v_unit_cost := (v_item->>'unit_cost')::NUMERIC;
        v_discount_percent := COALESCE((v_item->>'discount_percent')::NUMERIC, 0);
        v_tax_rate := COALESCE((v_item->>'tax_rate_percent')::NUMERIC, 19);

        IF v_quantity IS NULL OR v_quantity <= 0 THEN
            RAISE EXCEPTION 'La cantidad de cada producto debe ser estrictamente mayor a 0 (Producto: %).', v_product_id
                USING ERRCODE = '23514';
        END IF;

        IF v_unit_cost IS NULL OR v_unit_cost < 0 THEN
            RAISE EXCEPTION 'El costo unitario no puede ser negativo (Producto: %).', v_product_id
                USING ERRCODE = '23514';
        END IF;

        -- Validar pertenencia y vigencia del producto
        SELECT is_active INTO v_product_active
        FROM public.products
        WHERE id = v_product_id AND company_id = v_company_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El producto con ID % no existe o pertenece a otra empresa.', v_product_id
                USING ERRCODE = '23503';
        END IF;

        IF NOT v_product_active THEN
            RAISE EXCEPTION 'El producto con ID % se encuentra inactivo.', v_product_id
                USING ERRCODE = '23514';
        END IF;

        -- Cálculos matemáticos de línea (enteros redondeados COP)
        v_line_subtotal := ROUND(v_quantity * v_unit_cost);
        v_discount_amount := ROUND(v_line_subtotal * (v_discount_percent / 100));
        v_tax_amount := ROUND((v_line_subtotal - v_discount_amount) * (v_tax_rate / 100));
        v_line_total := (v_line_subtotal - v_discount_amount) + v_tax_amount;

        v_total_subtotal := v_total_subtotal + v_line_subtotal;
        v_total_discount := v_total_discount + v_discount_amount;
        v_total_tax := v_total_tax + v_tax_amount;
        v_total_amount := v_total_amount + v_line_total;
    END LOOP;

    -- Fechas
    v_issue_date := COALESCE(p_issue_date, CURRENT_DATE);
    v_due_date := COALESCE(p_due_date, CASE WHEN p_payment_terms = 'CONTADO' THEN v_issue_date ELSE v_issue_date + INTERVAL '30 days' END);
    v_inventory_status := CASE WHEN p_save_as_draft THEN 'BORRADOR' ELSE 'CONFIRMADA' END;

    -- Consecutivo atómico
    v_purchase_number := public.fn_next_purchase_number(v_company_id);

    -- 6.8 Insertar cabecera de orden de compra
    INSERT INTO public.purchases (
        id,
        company_id,
        purchase_number,
        supplier_invoice_number,
        supplier_id,
        location_id,
        issue_date,
        due_date,
        subtotal_amount,
        discount_amount,
        tax_amount,
        total_amount,
        paid_amount,
        payment_terms,
        payment_status,
        inventory_status,
        notes,
        confirmed_at,
        confirmed_by_user_id,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        v_company_id,
        v_purchase_number,
        TRIM(p_supplier_invoice_number),
        p_supplier_id,
        p_location_id,
        v_issue_date,
        v_due_date,
        v_total_subtotal,
        v_total_discount,
        v_total_tax,
        v_total_amount,
        0.00,
        COALESCE(p_payment_terms, 'CONTADO'),
        'PENDING',
        v_inventory_status,
        NULLIF(TRIM(p_notes), ''),
        CASE WHEN v_inventory_status = 'CONFIRMADA' THEN NOW() ELSE NULL END,
        CASE WHEN v_inventory_status = 'CONFIRMADA' THEN auth.uid() ELSE NULL END,
        NOW(),
        NOW()
    ) RETURNING id INTO v_purchase_id;

    -- 6.9 Insertar líneas de compra
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity := (v_item->>'quantity')::NUMERIC;
        v_unit_cost := (v_item->>'unit_cost')::NUMERIC;
        v_discount_percent := COALESCE((v_item->>'discount_percent')::NUMERIC, 0);
        v_tax_rate := COALESCE((v_item->>'tax_rate_percent')::NUMERIC, 19);

        v_line_subtotal := ROUND(v_quantity * v_unit_cost);
        v_discount_amount := ROUND(v_line_subtotal * (v_discount_percent / 100));
        v_tax_amount := ROUND((v_line_subtotal - v_discount_amount) * (v_tax_rate / 100));
        v_line_total := (v_line_subtotal - v_discount_amount) + v_tax_amount;

        INSERT INTO public.purchase_items (
            id,
            company_id,
            purchase_id,
            product_id,
            quantity,
            received_quantity,
            unit_cost,
            discount_percent,
            discount_amount,
            tax_rate_percent,
            tax_amount,
            subtotal,
            total,
            created_at
        ) VALUES (
            gen_random_uuid(),
            v_company_id,
            v_purchase_id,
            v_product_id,
            v_quantity,
            0.00,
            v_unit_cost,
            v_discount_percent,
            v_discount_amount,
            v_tax_rate,
            v_tax_amount,
            v_line_subtotal,
            v_line_total,
            NOW()
        );
    END LOOP;

    RETURN v_purchase_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.fn_create_purchase_order(UUID, UUID, VARCHAR, DATE, DATE, VARCHAR, TEXT, BOOLEAN, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_create_purchase_order(UUID, UUID, VARCHAR, DATE, DATE, VARCHAR, TEXT, BOOLEAN, JSONB) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. RPC: fn_update_purchase_order (EDICIÓN EXCLUSIVA DE ÓRDENES EN BORRADOR)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_update_purchase_order(
    p_purchase_id UUID,
    p_supplier_id UUID,
    p_location_id UUID,
    p_supplier_invoice_number VARCHAR,
    p_issue_date DATE,
    p_due_date DATE,
    p_payment_terms VARCHAR,
    p_notes TEXT,
    p_save_as_draft BOOLEAN,
    p_items JSONB
)
RETURNS UUID AS $$
DECLARE
    v_company_id UUID;
    v_current_status VARCHAR;
    v_supplier_active BOOLEAN;
    v_location_status VARCHAR;
    v_location_allow_purchases BOOLEAN;
    v_item JSONB;
    v_product_id UUID;
    v_product_active BOOLEAN;
    v_quantity NUMERIC(12,2);
    v_unit_cost NUMERIC(15,2);
    v_discount_percent NUMERIC(5,2);
    v_discount_amount NUMERIC(15,2);
    v_tax_rate NUMERIC(5,2);
    v_tax_amount NUMERIC(15,2);
    v_line_subtotal NUMERIC(15,2);
    v_line_total NUMERIC(15,2);
    v_total_subtotal NUMERIC(15,2) := 0;
    v_total_discount NUMERIC(15,2) := 0;
    v_total_tax NUMERIC(15,2) := 0;
    v_total_amount NUMERIC(15,2) := 0;
    v_new_status VARCHAR;
BEGIN
    v_company_id := public.get_auth_company_id();
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo resolver la empresa del usuario autenticado.'
            USING ERRCODE = '42501';
    END IF;

    IF NOT (public.has_permission('purchases.create') OR public.is_admin()) THEN
        RAISE EXCEPTION 'No tienes permisos para modificar compras (purchases.create requerido).'
            USING ERRCODE = '42501';
    END IF;

    -- Validar compra existente y pertenencia
    SELECT UPPER(COALESCE(inventory_status, '')) INTO v_current_status
    FROM public.purchases
    WHERE id = p_purchase_id AND company_id = v_company_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La orden de compra no existe o pertenece a otra empresa.'
            USING ERRCODE = '23503';
    END IF;

    IF v_current_status NOT IN ('DRAFT', 'BORRADOR') THEN
        RAISE EXCEPTION 'Solo las órdenes de compra en borrador pueden ser modificadas (Estado actual: %).', v_current_status
            USING ERRCODE = '23514';
    END IF;

    -- Validar bodega
    IF NOT (public.has_location_access(p_location_id) OR public.is_admin()) THEN
        RAISE EXCEPTION 'El usuario no tiene acceso a la bodega seleccionada.'
            USING ERRCODE = '42501';
    END IF;

    SELECT is_active INTO v_supplier_active
    FROM public.suppliers
    WHERE id = p_supplier_id AND company_id = v_company_id;

    IF NOT FOUND OR NOT v_supplier_active THEN
        RAISE EXCEPTION 'El proveedor no existe, pertenece a otra empresa o está inactivo.'
            USING ERRCODE = '23503';
    END IF;

    SELECT status, allow_purchases INTO v_location_status, v_location_allow_purchases
    FROM public.locations
    WHERE id = p_location_id AND company_id = v_company_id;

    IF NOT FOUND OR v_location_status <> 'ACTIVE' OR NOT v_location_allow_purchases THEN
        RAISE EXCEPTION 'La bodega de destino no es válida o no permite compras.'
            USING ERRCODE = '23503';
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Debe incluir al menos un producto en la orden de compra.'
            USING ERRCODE = '23514';
    END IF;

    -- Validar líneas
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity := (v_item->>'quantity')::NUMERIC;
        v_unit_cost := (v_item->>'unit_cost')::NUMERIC;
        v_discount_percent := COALESCE((v_item->>'discount_percent')::NUMERIC, 0);
        v_tax_rate := COALESCE((v_item->>'tax_rate_percent')::NUMERIC, 19);

        IF v_quantity IS NULL OR v_quantity <= 0 THEN
            RAISE EXCEPTION 'La cantidad de cada producto debe ser mayor a 0 (Producto: %).', v_product_id
                USING ERRCODE = '23514';
        END IF;

        IF v_unit_cost IS NULL OR v_unit_cost < 0 THEN
            RAISE EXCEPTION 'El costo unitario no puede ser negativo (Producto: %).', v_product_id
                USING ERRCODE = '23514';
        END IF;

        SELECT is_active INTO v_product_active
        FROM public.products
        WHERE id = v_product_id AND company_id = v_company_id;

        IF NOT FOUND OR NOT v_product_active THEN
            RAISE EXCEPTION 'El producto con ID % no existe, pertenece a otra empresa o está inactivo.', v_product_id
                USING ERRCODE = '23503';
        END IF;

        v_line_subtotal := ROUND(v_quantity * v_unit_cost);
        v_discount_amount := ROUND(v_line_subtotal * (v_discount_percent / 100));
        v_tax_amount := ROUND((v_line_subtotal - v_discount_amount) * (v_tax_rate / 100));
        v_line_total := (v_line_subtotal - v_discount_amount) + v_tax_amount;

        v_total_subtotal := v_total_subtotal + v_line_subtotal;
        v_total_discount := v_total_discount + v_discount_amount;
        v_total_tax := v_total_tax + v_tax_amount;
        v_total_amount := v_total_amount + v_line_total;
    END LOOP;

    v_new_status := CASE WHEN p_save_as_draft THEN 'BORRADOR' ELSE 'CONFIRMADA' END;

    -- Actualizar cabecera
    UPDATE public.purchases SET
        supplier_id = p_supplier_id,
        location_id = p_location_id,
        supplier_invoice_number = TRIM(p_supplier_invoice_number),
        issue_date = COALESCE(p_issue_date, issue_date),
        due_date = COALESCE(p_due_date, due_date),
        payment_terms = COALESCE(p_payment_terms, payment_terms),
        notes = NULLIF(TRIM(p_notes), ''),
        subtotal_amount = v_total_subtotal,
        discount_amount = v_total_discount,
        tax_amount = v_total_tax,
        total_amount = v_total_amount,
        inventory_status = v_new_status,
        confirmed_at = CASE WHEN v_new_status = 'CONFIRMADA' THEN NOW() ELSE NULL END,
        confirmed_by_user_id = CASE WHEN v_new_status = 'CONFIRMADA' THEN auth.uid() ELSE NULL END,
        updated_at = NOW()
    WHERE id = p_purchase_id AND company_id = v_company_id;

    -- Reemplazar líneas
    DELETE FROM public.purchase_items WHERE purchase_id = p_purchase_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity := (v_item->>'quantity')::NUMERIC;
        v_unit_cost := (v_item->>'unit_cost')::NUMERIC;
        v_discount_percent := COALESCE((v_item->>'discount_percent')::NUMERIC, 0);
        v_tax_rate := COALESCE((v_item->>'tax_rate_percent')::NUMERIC, 19);

        v_line_subtotal := ROUND(v_quantity * v_unit_cost);
        v_discount_amount := ROUND(v_line_subtotal * (v_discount_percent / 100));
        v_tax_amount := ROUND((v_line_subtotal - v_discount_amount) * (v_tax_rate / 100));
        v_line_total := (v_line_subtotal - v_discount_amount) + v_tax_amount;

        INSERT INTO public.purchase_items (
            id,
            company_id,
            purchase_id,
            product_id,
            quantity,
            received_quantity,
            unit_cost,
            discount_percent,
            discount_amount,
            tax_rate_percent,
            tax_amount,
            subtotal,
            total,
            created_at
        ) VALUES (
            gen_random_uuid(),
            v_company_id,
            p_purchase_id,
            v_product_id,
            v_quantity,
            0.00,
            v_unit_cost,
            v_discount_percent,
            v_discount_amount,
            v_tax_rate,
            v_tax_amount,
            v_line_subtotal,
            v_line_total,
            NOW()
        );
    END LOOP;

    RETURN p_purchase_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.fn_update_purchase_order(UUID, UUID, UUID, VARCHAR, DATE, DATE, VARCHAR, TEXT, BOOLEAN, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_update_purchase_order(UUID, UUID, UUID, VARCHAR, DATE, DATE, VARCHAR, TEXT, BOOLEAN, JSONB) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 8. RPC: fn_confirm_purchase_order (CONFIRMACIÓN FORMAL DE BORRADOR)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_confirm_purchase_order(p_purchase_id UUID)
RETURNS UUID AS $$
DECLARE
    v_company_id UUID;
    v_status VARCHAR;
BEGIN
    v_company_id := public.get_auth_company_id();
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo resolver la empresa del usuario autenticado.'
            USING ERRCODE = '42501';
    END IF;

    IF NOT (public.has_permission('purchases.create') OR public.is_admin()) THEN
        RAISE EXCEPTION 'No tienes permisos para confirmar compras (purchases.create requerido).'
            USING ERRCODE = '42501';
    END IF;

    SELECT UPPER(COALESCE(inventory_status, '')) INTO v_status
    FROM public.purchases
    WHERE id = p_purchase_id AND company_id = v_company_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Orden de compra no encontrada.'
            USING ERRCODE = '23503';
    END IF;

    IF v_status NOT IN ('DRAFT', 'BORRADOR') THEN
        RAISE EXCEPTION 'La orden de compra ya fue confirmada o se encuentra en estado %.', v_status
            USING ERRCODE = '23514';
    END IF;

    UPDATE public.purchases SET
        inventory_status = 'CONFIRMADA',
        confirmed_at = NOW(),
        confirmed_by_user_id = auth.uid(),
        updated_at = NOW()
    WHERE id = p_purchase_id AND company_id = v_company_id;

    RETURN p_purchase_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.fn_confirm_purchase_order(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_confirm_purchase_order(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 9. RPC: fn_cancel_purchase_order (ANULACIÓN SEGURA)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_cancel_purchase_order(
    p_purchase_id UUID,
    p_reason TEXT
)
RETURNS UUID AS $$
DECLARE
    v_company_id UUID;
    v_status VARCHAR;
    v_has_received BOOLEAN;
BEGIN
    v_company_id := public.get_auth_company_id();
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo resolver la empresa del usuario autenticado.'
            USING ERRCODE = '42501';
    END IF;

    IF NOT (public.has_permission('purchases.create') OR public.is_admin()) THEN
        RAISE EXCEPTION 'No tienes permisos para anular compras (purchases.create requerido).'
            USING ERRCODE = '42501';
    END IF;

    SELECT UPPER(COALESCE(inventory_status, '')) INTO v_status
    FROM public.purchases
    WHERE id = p_purchase_id AND company_id = v_company_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Orden de compra no encontrada.'
            USING ERRCODE = '23503';
    END IF;

    IF v_status IN ('RECEIVED', 'RECIBIDA', 'PARTIALLY_RECEIVED', 'RECIBIDA_PARCIALMENTE') THEN
        RAISE EXCEPTION 'No está permitido anular órdenes con mercancía recibida en bodega. Debe tramitarse devolución a proveedor.'
            USING ERRCODE = '23514';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.purchase_items
        WHERE purchase_id = p_purchase_id AND received_quantity > 0
    ) INTO v_has_received;

    IF v_has_received THEN
        RAISE EXCEPTION 'No se puede anular la orden porque tiene ítems con cantidades recibidas.'
            USING ERRCODE = '23514';
    END IF;

    UPDATE public.purchases SET
        inventory_status = 'CANCELADA',
        payment_status = 'CANCELLED',
        notes = TRIM(COALESCE(notes, '') || ' [ANULADA: ' || COALESCE(p_reason, 'Sin motivo') || ']'),
        updated_at = NOW()
    WHERE id = p_purchase_id AND company_id = v_company_id;

    RETURN p_purchase_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.fn_cancel_purchase_order(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_cancel_purchase_order(UUID, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 10. POLÍTICA RLS DELETE PARA LÍNEAS DE COMPRA (public.purchase_items)
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Tenant isolation delete purchase_items" ON public.purchase_items;
CREATE POLICY "Tenant isolation delete purchase_items" ON public.purchase_items
FOR DELETE TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND (public.has_permission('purchases.create') OR public.is_admin())
);
