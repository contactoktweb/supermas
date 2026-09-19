-- ==============================================================================
-- 008_TRIGGERS_AND_FUNCTIONS.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- ==============================================================================

-- 1. Función y Trigger: Actualización automática de updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a tablas maestras
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'companies',
        'locations',
        'users',
        'categories',
        'brands',
        'products',
        'stock_levels',
        'transfers',
        'customers',
        'sales',
        'remissions',
        'web_orders',
        'suppliers',
        'purchases',
        'electronic_invoices',
        'accounting_entries',
        'system_settings'
    ])
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I;
            CREATE TRIGGER trg_set_updated_at
            BEFORE UPDATE ON public.%I
            FOR EACH ROW
            EXECUTE FUNCTION public.handle_updated_at();
        ', t, t);
    END LOOP;
END $$;

-- 2. Función y Trigger: Sincronización atómica de StockLevel tras InventoryMovement
CREATE OR REPLACE FUNCTION public.process_inventory_movement()
RETURNS TRIGGER AS $$
DECLARE
    current_qty NUMERIC(12,2);
    current_avg_cost NUMERIC(15,2);
    calculated_health stock_health_status;
    p_min_stock INTEGER;
BEGIN
    -- Obtener umbrales mínimos del producto
    SELECT min_stock_threshold INTO p_min_stock FROM public.products WHERE id = NEW.product_id;
    IF p_min_stock IS NULL THEN
        p_min_stock := 10;
    END IF;

    -- Obtener o crear registro en stock_levels
    SELECT quantity, average_cost INTO current_qty, current_avg_cost
    FROM public.stock_levels
    WHERE product_id = NEW.product_id AND location_id = NEW.location_id;

    IF NOT FOUND THEN
        current_qty := 0;
        current_avg_cost := NEW.unit_cost;
        INSERT INTO public.stock_levels (
            product_id,
            location_id,
            quantity,
            average_cost,
            min_stock,
            health_status,
            last_movement_at
        ) VALUES (
            NEW.product_id,
            NEW.location_id,
            (NEW.quantity_in - NEW.quantity_out),
            NEW.unit_cost,
            p_min_stock,
            CASE
                WHEN (NEW.quantity_in - NEW.quantity_out) <= 0 THEN 'OUT_OF_STOCK'
                WHEN (NEW.quantity_in - NEW.quantity_out) <= p_min_stock THEN 'LOW_STOCK'
                ELSE 'AVAILABLE'
            END,
            NEW.created_at
        );
    ELSE
        -- Actualizar saldo de existencias
        current_qty := current_qty + NEW.quantity_in - NEW.quantity_out;

        -- Actualizar costo promedio ponderado si fue entrada con costo
        IF NEW.quantity_in > 0 AND current_qty > 0 THEN
            current_avg_cost := ((current_qty - NEW.quantity_in) * current_avg_cost + NEW.total_cost) / current_qty;
        END IF;

        -- Calcular nuevo estado de salud
        IF current_qty <= 0 THEN
            calculated_health := 'OUT_OF_STOCK';
        ELSIF current_qty <= p_min_stock THEN
            calculated_health := 'LOW_STOCK';
        ELSE
            calculated_health := 'AVAILABLE';
        END IF;

        UPDATE public.stock_levels
        SET quantity = current_qty,
            average_cost = current_avg_cost,
            health_status = calculated_health,
            last_movement_at = NEW.created_at,
            updated_at = NOW()
        WHERE product_id = NEW.product_id AND location_id = NEW.location_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_after_inventory_movement ON public.inventory_movements;
CREATE TRIGGER trg_after_inventory_movement
AFTER INSERT ON public.inventory_movements
FOR EACH ROW
EXECUTE FUNCTION public.process_inventory_movement();

-- 3. Función: Validación de Partida Doble en Asientos Contables
CREATE OR REPLACE FUNCTION public.verify_accounting_entry_balance(p_entry_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    total_debit NUMERIC(15,2);
    total_credit NUMERIC(15,2);
BEGIN
    SELECT COALESCE(SUM(debit_amount), 0), COALESCE(SUM(credit_amount), 0)
    INTO total_debit, total_credit
    FROM public.accounting_entry_lines
    WHERE entry_id = p_entry_id;

    IF total_debit <> total_credit THEN
        RAISE EXCEPTION 'El asiento contable % no cumple con la partida doble. Débito: %, Crédito: %',
            p_entry_id, total_debit, total_credit;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql;
