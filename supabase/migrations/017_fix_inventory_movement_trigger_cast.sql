-- ==============================================================================
-- 017_FIX_INVENTORY_MOVEMENT_TRIGGER_CAST.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Corrección de tipo enum stock_health_status y propagación de company_id en stock_levels
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.process_inventory_movement()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
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
            company_id,
            product_id,
            location_id,
            quantity,
            average_cost,
            min_stock,
            health_status,
            last_movement_at
        ) VALUES (
            NEW.company_id,
            NEW.product_id,
            NEW.location_id,
            (NEW.quantity_in - NEW.quantity_out),
            NEW.unit_cost,
            p_min_stock,
            (CASE
                WHEN (NEW.quantity_in - NEW.quantity_out) <= 0 THEN 'OUT_OF_STOCK'
                WHEN (NEW.quantity_in - NEW.quantity_out) <= p_min_stock THEN 'LOW_STOCK'
                ELSE 'AVAILABLE'
            END)::stock_health_status,
            NEW.created_at
        );
    ELSE
        -- Actualizar saldo de existencias
        current_qty := current_qty + NEW.quantity_in - NEW.quantity_out;

        -- Actualizar costo promedio ponderado si fue entrada con costo
        IF NEW.quantity_in > 0 AND current_qty > 0 THEN
            current_avg_cost := ((current_qty - NEW.quantity_in) * current_avg_cost + NEW.total_cost) / current_qty;
        END IF;

        -- Calcular nuevo estado de salud con casteo explícito al enum stock_health_status
        IF current_qty <= 0 THEN
            calculated_health := 'OUT_OF_STOCK'::stock_health_status;
        ELSIF current_qty <= p_min_stock THEN
            calculated_health := 'LOW_STOCK'::stock_health_status;
        ELSE
            calculated_health := 'AVAILABLE'::stock_health_status;
        END IF;

        UPDATE public.stock_levels
        SET quantity = current_qty,
            average_cost = current_avg_cost,
            health_status = calculated_health,
            company_id = COALESCE(public.stock_levels.company_id, NEW.company_id),
            last_movement_at = NEW.created_at,
            updated_at = NOW()
        WHERE product_id = NEW.product_id AND location_id = NEW.location_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Restringir privilegios de ejecución únicamente al motor interno
REVOKE ALL ON FUNCTION public.process_inventory_movement() FROM PUBLIC, anon, authenticated;
