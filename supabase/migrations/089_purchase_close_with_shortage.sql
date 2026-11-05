-- ==============================================================================
-- 089 · Cerrar una orden de compra con faltante
-- ==============================================================================
-- Cuando el proveedor no envía todo lo pedido y no lo va a enviar, la orden quedaba
-- "recibida parcialmente" para siempre y la cuenta por pagar seguía por el valor pedido.
-- fn_close_purchase_with_shortage deja la orden en lo que realmente llegó:
--   * baja la cantidad de cada línea a la recibida (las líneas sin recibir se quitan),
--   * recalcula subtotal, descuento, IVA y total con las mismas reglas de fn_create_purchase_order,
--   * pasa la orden a RECIBIDA y guarda el motivo y el detalle de lo pedido originalmente,
--   * causa la compra en contabilidad por el valor recibido (si aún no estaba causada).
-- Los guardas de compras solo permiten ese ajuste con la bandera local app.purchase_shortage_close,
-- que únicamente fija esta función (transacción local).
-- Re-ejecutable.
-- ==============================================================================

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS shortage_closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shortage_closed_by_user_id UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS shortage_reason TEXT,
  ADD COLUMN IF NOT EXISTS shortage_detail JSONB;

COMMENT ON COLUMN public.purchases.shortage_detail IS
  'Cierre con faltante: líneas con cantidad pedida, recibida y faltante, y los montos originales de la orden.';

CREATE OR REPLACE FUNCTION public.fn_guard_purchase_items()
RETURNS TRIGGER AS $$
DECLARE
    v_parent_status VARCHAR;
BEGIN
    IF current_setting('app.is_test_cleanup', true) = 'true' THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;

    -- Cierre con faltante (fn_close_purchase_with_shortage): la cantidad pedida baja a la recibida
    -- y se quitan las líneas que no llegaron. Nada más se puede cambiar por esta vía.
    IF current_setting('app.purchase_shortage_close', true) = 'true' THEN
        IF TG_OP = 'DELETE' THEN
            IF COALESCE(OLD.received_quantity, 0) <> 0 THEN
                RAISE EXCEPTION 'Cierre con faltante: solo se quitan líneas sin unidades recibidas.' USING ERRCODE = '23514';
            END IF;
            RETURN OLD;
        ELSIF TG_OP = 'UPDATE' THEN
            IF OLD.product_id IS DISTINCT FROM NEW.product_id
               OR OLD.unit_cost IS DISTINCT FROM NEW.unit_cost
               OR OLD.discount_percent IS DISTINCT FROM NEW.discount_percent
               OR OLD.tax_rate_percent IS DISTINCT FROM NEW.tax_rate_percent
               OR NEW.quantity IS DISTINCT FROM OLD.received_quantity THEN
                RAISE EXCEPTION 'Cierre con faltante: solo se ajusta la cantidad a lo recibido.' USING ERRCODE = '23514';
            END IF;
            RETURN NEW;
        END IF;
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
           OR (
             -- Cierre con faltante: los montos bajan a lo recibido al pasar de parcial a recibida.
             NOT (current_setting('app.purchase_shortage_close', true) = 'true'
                  AND v_old_st IN ('PARTIALLY_RECEIVED', 'RECIBIDA_PARCIALMENTE')
                  AND v_new_st IN ('RECEIVED', 'RECIBIDA'))
             AND (OLD.subtotal_amount <> NEW.subtotal_amount 
                  OR OLD.tax_amount <> NEW.tax_amount 
                  OR OLD.total_amount <> NEW.total_amount)
           ) THEN
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

CREATE OR REPLACE FUNCTION public.fn_close_purchase_with_shortage(p_purchase_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_company_id UUID;
  v_pur RECORD;
  v_line RECORD;
  v_detail JSONB := '[]'::JSONB;
  v_sub NUMERIC(15,2);
  v_disc NUMERIC(15,2);
  v_tax NUMERIC(15,2);
  v_total_sub NUMERIC(15,2) := 0;
  v_total_disc NUMERIC(15,2) := 0;
  v_total_tax NUMERIC(15,2) := 0;
  v_total NUMERIC(15,2) := 0;
  v_received_lines INT := 0;
  v_accounting JSONB;
  v_accounting_error TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No se detectó un usuario autenticado.' USING ERRCODE = '42501';
  END IF;
  v_company_id := public.get_auth_company_id();
  IF NOT (public.has_permission('purchases.create') OR public.is_admin()) THEN
    RAISE EXCEPTION 'No tiene permiso para cerrar órdenes de compra (purchases.create).' USING ERRCODE = '42501';
  END IF;
  IF LENGTH(BTRIM(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'Escriba el motivo del faltante (mínimo 5 caracteres).' USING ERRCODE = '22023';
  END IF;

  -- Mismo candado que la recepción: no se cierra mientras se recibe.
  PERFORM pg_advisory_xact_lock(hashtext('purchase_order_reception_' || p_purchase_id::text));

  SELECT * INTO v_pur FROM public.purchases WHERE id = p_purchase_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La orden de compra no existe.' USING ERRCODE = 'P0002';
  END IF;
  IF v_pur.company_id IS DISTINCT FROM v_company_id THEN
    RAISE EXCEPTION 'La orden de compra pertenece a otra empresa.' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.has_location_access(v_pur.location_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'No tiene acceso a la bodega de la orden.' USING ERRCODE = '42501';
  END IF;
  IF UPPER(COALESCE(v_pur.inventory_status, '')) NOT IN ('RECIBIDA_PARCIALMENTE', 'PARTIALLY_RECEIVED') THEN
    RAISE EXCEPTION 'Solo se cierra con faltante una orden recibida parcialmente (la % está %).',
      v_pur.purchase_number, v_pur.inventory_status USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.accounting_entries
    WHERE company_id = v_pur.company_id AND document_type = 'PURCHASE'
      AND document_reference = v_pur.purchase_number AND status = 'POSTED'
  ) THEN
    RAISE EXCEPTION 'La compra % ya está causada en contabilidad por el valor pedido. Reverse ese asiento antes de cerrarla con faltante.',
      v_pur.purchase_number USING ERRCODE = '22023';
  END IF;

  FOR v_line IN
    SELECT pi.*, p.sku, p.name AS product_name
    FROM public.purchase_items pi
    JOIN public.products p ON p.id = pi.product_id
    WHERE pi.purchase_id = p_purchase_id
    ORDER BY pi.created_at, pi.id
  LOOP
    v_detail := v_detail || jsonb_build_object(
      'purchase_item_id', v_line.id, 'product_id', v_line.product_id, 'sku', v_line.sku, 'product_name', v_line.product_name,
      'ordered_quantity', v_line.quantity, 'received_quantity', COALESCE(v_line.received_quantity, 0),
      'missing_quantity', v_line.quantity - COALESCE(v_line.received_quantity, 0),
      'unit_cost', v_line.unit_cost, 'original_total', v_line.total);
    IF COALESCE(v_line.received_quantity, 0) > 0 THEN
      v_received_lines := v_received_lines + 1;
      v_sub := ROUND(v_line.received_quantity * v_line.unit_cost);
      v_disc := ROUND(v_sub * (COALESCE(v_line.discount_percent, 0) / 100));
      v_tax := ROUND((v_sub - v_disc) * (COALESCE(v_line.tax_rate_percent, 0) / 100));
      v_total_sub := v_total_sub + v_sub;
      v_total_disc := v_total_disc + v_disc;
      v_total_tax := v_total_tax + v_tax;
      v_total := v_total + (v_sub - v_disc) + v_tax;
    END IF;
  END LOOP;

  IF v_received_lines = 0 THEN
    RAISE EXCEPTION 'La orden % no tiene mercancía recibida: anúlela en lugar de cerrarla con faltante.', v_pur.purchase_number
      USING ERRCODE = '22023';
  END IF;
  IF COALESCE(v_pur.paid_amount, 0) > v_total THEN
    RAISE EXCEPTION 'Ya se le pagó al proveedor % y lo recibido vale %. Registre primero la devolución del dinero o la nota crédito del proveedor.',
      v_pur.paid_amount, v_total USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.purchase_shortage_close', 'true', true);

  DELETE FROM public.purchase_items WHERE purchase_id = p_purchase_id AND COALESCE(received_quantity, 0) = 0;

  UPDATE public.purchase_items pi
  SET quantity = pi.received_quantity,
      subtotal = s.sub,
      discount_amount = s.disc,
      tax_amount = s.tax,
      total = (s.sub - s.disc) + s.tax
  FROM (
    SELECT id,
           ROUND(received_quantity * unit_cost) AS sub,
           ROUND(ROUND(received_quantity * unit_cost) * (COALESCE(discount_percent, 0) / 100)) AS disc,
           ROUND((ROUND(received_quantity * unit_cost) - ROUND(ROUND(received_quantity * unit_cost) * (COALESCE(discount_percent, 0) / 100)))
                 * (COALESCE(tax_rate_percent, 0) / 100)) AS tax
    FROM public.purchase_items WHERE purchase_id = p_purchase_id
  ) s
  WHERE pi.id = s.id AND pi.quantity <> pi.received_quantity;

  UPDATE public.purchases
  SET inventory_status = 'RECIBIDA',
      subtotal_amount = v_total_sub,
      discount_amount = v_total_disc,
      tax_amount = v_total_tax,
      total_amount = v_total,
      payment_status = CASE
        WHEN COALESCE(paid_amount, 0) >= v_total THEN 'PAID'
        WHEN COALESCE(paid_amount, 0) > 0 THEN 'PARTIAL'
        ELSE payment_status END,
      shortage_closed_at = NOW(),
      shortage_closed_by_user_id = v_user_id,
      shortage_reason = BTRIM(p_reason),
      shortage_detail = jsonb_build_object(
        'lines', v_detail,
        'original_subtotal', v_pur.subtotal_amount, 'original_discount', v_pur.discount_amount,
        'original_tax', v_pur.tax_amount, 'original_total', v_pur.total_amount)
  WHERE id = p_purchase_id;

  PERFORM set_config('app.purchase_shortage_close', 'false', true);

  -- La causación contable no debe impedir el cierre: si falla (por ejemplo, falta una cuenta),
  -- la orden queda cerrada y la compra se causa después desde Contabilidad.
  BEGIN
    v_accounting := public.fn_cause_purchase_accounting_internal(p_purchase_id);
  EXCEPTION WHEN OTHERS THEN
    v_accounting_error := SQLERRM;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'purchase_number', v_pur.purchase_number,
    'original_total', v_pur.total_amount,
    'new_total', v_total,
    'lines', v_detail,
    'accounting_entry_number', v_accounting->>'entry_number',
    'accounting_error', v_accounting_error);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_close_purchase_with_shortage(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_close_purchase_with_shortage(UUID, TEXT) TO authenticated, service_role;
