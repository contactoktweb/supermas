-- ==============================================================================
-- 022_SALES_INVOICING_AND_STOCK_GUARD.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Hardening para Ventas, Facturación Electrónica DIAN y Prevención de Overselling
-- ==============================================================================

-- 1. PREVENCIÓN ATÓMICA DE OVERSELLING EN STOCK_LEVELS
-- Añadir restricción CHECK para que el stock nunca pueda ser negativo a nivel de esquema
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_stock_levels_non_negative' AND conrelid = 'public.stock_levels'::regclass
    ) THEN
        ALTER TABLE public.stock_levels
        ADD CONSTRAINT chk_stock_levels_non_negative CHECK (quantity >= 0);
    END IF;
END $$;

-- 2. CONTROL ESTRICTO DE DISPONIBILIDAD EN PROCESS_INVENTORY_MOVEMENT
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
        -- Si no existe registro y se intenta una salida (overselling inicial)
        IF (NEW.quantity_in - NEW.quantity_out) < 0 THEN
            RAISE EXCEPTION 'Stock insuficiente: No existen existencias registradas del producto % en la bodega % para procesar la salida solicitada de % unidades.',
                NEW.product_id, NEW.location_id, NEW.quantity_out
                USING ERRCODE = '55000';
        END IF;

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
        -- Validar que la salida no supere el saldo disponible (prevención de overselling)
        IF (current_qty + NEW.quantity_in - NEW.quantity_out) < 0 THEN
            RAISE EXCEPTION 'Stock insuficiente para el producto % en la bodega %. Stock disponible: %, Solicitado: % unidades.',
                NEW.product_id, NEW.location_id, current_qty, NEW.quantity_out
                USING ERRCODE = '55000';
        END IF;

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

-- 3. INMUTABILIDAD DE FACTURACIÓN ELECTRÓNICA DIAN (PREVENCIÓN DE ELIMINACIÓN FÍSICA)
CREATE OR REPLACE FUNCTION public.fn_prevent_invoice_deletion()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    RAISE EXCEPTION 'Facturación inmutable: No está permitido eliminar físicamente registros de facturación electrónica (Factura: % - CUFE: %). Las notas o anulaciones deben realizarse según la normativa DIAN.',
        OLD.full_number, OLD.cufe
        USING ERRCODE = '23506';
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION public.fn_prevent_invoice_deletion() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prevent_invoice_deletion ON public.electronic_invoices;
CREATE TRIGGER trg_prevent_invoice_deletion
BEFORE DELETE ON public.electronic_invoices
FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_invoice_deletion();

-- 4. POLÍTICAS RLS PARA ELECTRONIC_INVOICES (MULTI-TENANT Y AISLAMIENTO POR BODEGA)
ALTER TABLE public.electronic_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation select electronic_invoices" ON public.electronic_invoices;
CREATE POLICY "Tenant isolation select electronic_invoices" ON public.electronic_invoices
FOR SELECT TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND (public.has_location_access(location_id) OR public.is_admin())
    AND (public.has_permission('invoices.read') OR public.has_permission('sales.read') OR public.is_admin())
);

DROP POLICY IF EXISTS "Tenant isolation insert electronic_invoices" ON public.electronic_invoices;
CREATE POLICY "Tenant isolation insert electronic_invoices" ON public.electronic_invoices
FOR INSERT TO authenticated
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (public.has_location_access(location_id) OR public.is_admin())
    AND (public.has_permission('invoices.create') OR public.has_permission('sales.create') OR public.is_admin())
);

DROP POLICY IF EXISTS "Tenant isolation update electronic_invoices" ON public.electronic_invoices;
CREATE POLICY "Tenant isolation update electronic_invoices" ON public.electronic_invoices
FOR UPDATE TO authenticated
USING (
    company_id = public.get_auth_company_id()
    AND (public.has_location_access(location_id) OR public.is_admin())
    AND (public.has_permission('invoices.cancel') OR public.is_admin())
)
WITH CHECK (
    company_id = public.get_auth_company_id()
    AND (public.has_location_access(location_id) OR public.is_admin())
    AND (public.has_permission('invoices.cancel') OR public.is_admin())
);

-- 5. ASIGNAR PERMISOS DE FACTURACIÓN POS AL ROL CASHIER
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'CASHIER'
  AND p.code IN ('invoices.create', 'invoices.read')
ON CONFLICT DO NOTHING;
