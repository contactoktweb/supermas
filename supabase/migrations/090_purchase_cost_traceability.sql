-- =============================================================================
-- 090 — Trazabilidad del costo unitario en las órdenes de compra
-- =============================================================================
-- Cada línea guarda el costo que tenía el producto al agregarla (costo de referencia).
-- Cuando el costo de la orden difiere del de referencia, o cambia al editar el borrador,
-- queda un registro con el costo anterior, el nuevo, quién lo hizo y cuándo.
-- Las líneas existentes quedan sin costo de referencia: no se inventa un valor histórico.
-- =============================================================================

ALTER TABLE public.purchase_items
    ADD COLUMN IF NOT EXISTS reference_unit_cost NUMERIC(18,2);

COMMENT ON COLUMN public.purchase_items.reference_unit_cost IS
    'Costo del producto (products.cost_price) cuando se agregó la línea a la orden.';

CREATE TABLE IF NOT EXISTS public.purchase_cost_changes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES public.companies(id),
    purchase_id         UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
    product_id          UUID NOT NULL REFERENCES public.products(id),
    previous_unit_cost  NUMERIC(18,2) NOT NULL,
    new_unit_cost       NUMERIC(18,2) NOT NULL,
    source              VARCHAR(20) NOT NULL CHECK (source IN ('PRODUCT_COST', 'ORDER_EDIT')),
    changed_by_user_id  UUID DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
    changed_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.purchase_cost_changes IS
    'Cambios de costo unitario en órdenes de compra: PRODUCT_COST = la orden se pactó a un costo distinto al del producto; ORDER_EDIT = se modificó el costo al editar la orden.';

CREATE INDEX IF NOT EXISTS idx_purchase_cost_changes_purchase
    ON public.purchase_cost_changes (purchase_id, changed_at);

ALTER TABLE public.purchase_cost_changes ENABLE ROW LEVEL SECURITY;

-- Solo lectura para quien ve la orden (RLS de purchases: empresa y sede) y puede ver costos.
-- Las filas las escribe únicamente el disparador.
DROP POLICY IF EXISTS purchase_cost_changes_select ON public.purchase_cost_changes;
CREATE POLICY purchase_cost_changes_select ON public.purchase_cost_changes
    FOR SELECT TO authenticated
    USING (
        company_id = public.get_auth_company_id()
        AND public.has_permission('cost.read')
        AND EXISTS (SELECT 1 FROM public.purchases p WHERE p.id = purchase_cost_changes.purchase_id)
    );

REVOKE INSERT, UPDATE, DELETE ON public.purchase_cost_changes FROM authenticated, anon;
GRANT SELECT ON public.purchase_cost_changes TO authenticated;

-- Costo de referencia al crear la línea (también al reinsertarla cuando se edita el borrador).
CREATE OR REPLACE FUNCTION public.fn_purchase_item_reference_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.reference_unit_cost IS NULL THEN
        SELECT pr.cost_price INTO NEW.reference_unit_cost
        FROM public.products pr
        WHERE pr.id = NEW.product_id;
    END IF;
    RETURN NEW;
END;
$$;

-- Registra la diferencia contra el último costo conocido de ese producto en la orden:
-- el último cambio registrado o, si no hay, el costo de referencia del producto.
CREATE OR REPLACE FUNCTION public.fn_purchase_item_log_cost_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_last_cost NUMERIC(18,2);
    v_source    VARCHAR(20) := 'ORDER_EDIT';
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.unit_cost IS NOT DISTINCT FROM OLD.unit_cost THEN
        RETURN NEW;
    END IF;

    SELECT c.new_unit_cost INTO v_last_cost
    FROM public.purchase_cost_changes c
    WHERE c.purchase_id = NEW.purchase_id AND c.product_id = NEW.product_id
    ORDER BY c.changed_at DESC, c.id DESC
    LIMIT 1;

    IF v_last_cost IS NULL THEN
        IF TG_OP = 'UPDATE' THEN
            v_last_cost := OLD.unit_cost;
        ELSE
            v_last_cost := NEW.reference_unit_cost;
            v_source := 'PRODUCT_COST';
        END IF;
    END IF;

    -- Producto sin costo previo (nuevo): no hay un cambio que documentar.
    IF v_last_cost IS NULL OR (v_source = 'PRODUCT_COST' AND v_last_cost = 0) THEN
        RETURN NEW;
    END IF;

    IF ROUND(NEW.unit_cost, 2) <> ROUND(v_last_cost, 2) THEN
        INSERT INTO public.purchase_cost_changes (
            company_id, purchase_id, product_id, previous_unit_cost, new_unit_cost, source
        ) VALUES (
            NEW.company_id, NEW.purchase_id, NEW.product_id, v_last_cost, NEW.unit_cost, v_source
        );
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_purchase_item_reference_cost() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_purchase_item_log_cost_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_purchase_item_reference_cost ON public.purchase_items;
CREATE TRIGGER trg_purchase_item_reference_cost
    BEFORE INSERT ON public.purchase_items
    FOR EACH ROW EXECUTE FUNCTION public.fn_purchase_item_reference_cost();

DROP TRIGGER IF EXISTS trg_purchase_item_log_cost_change ON public.purchase_items;
CREATE TRIGGER trg_purchase_item_log_cost_change
    AFTER INSERT OR UPDATE OF unit_cost ON public.purchase_items
    FOR EACH ROW EXECUTE FUNCTION public.fn_purchase_item_log_cost_change();
