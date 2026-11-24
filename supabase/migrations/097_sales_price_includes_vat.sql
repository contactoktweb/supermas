-- ==============================================================================
-- MIGRACIÓN 097: VENTAS, CONVERSIONES Y PEDIDOS WEB CON PRECIO IVA INCLUIDO
-- SUPER MÁS ERP/POS
-- ==============================================================================
--
-- Igual que el POS (096): el precio de venta del producto se digita con el IVA incluido y es lo
-- que paga el cliente. Las funciones de abajo le sumaban el IVA encima (un producto de $20.000 se
-- facturaba $23.800). Ahora la base y el IVA se desglosan del total de la línea:
--   base = total / (1 + tarifa) redondeada a centavos; IVA = total - base.
--
-- 1. fn_create_sale_with_payments_internal (copia de 095 salvo lo marcado con "097"). La usan el
--    módulo Ventas, la conversión de cotizaciones (el precio acordado también se toma con IVA
--    incluido) y la conversión de pedidos web. sales.subtotal_amount y discount_amount quedan
--    antes de IVA (subtotal - descuento + IVA = total); sale_items.unit_price y subtotal antes de
--    IVA, sale_items.total con IVA. La base de retenciones sigue siendo total - IVA.
-- 2. fn_create_public_web_order (copia de 086 salvo lo marcado con "097"): web_orders.subtotal y
--    web_order_items.unit_price / subtotal antes de IVA, web_orders.total = precio x cantidad.
--
-- No cambia firmas ni permisos (CREATE OR REPLACE conserva los GRANT/REVOKE) ni documentos ya
-- creados. Se puede re-ejecutar.
-- ==============================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.fn_create_sale_with_payments_internal(p_location_id uuid, p_customer_id uuid, p_idempotency_key uuid, p_items jsonb, p_payments jsonb, p_notes text, p_allow_agreed_price boolean, p_origin jsonb, p_withholding_concept_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  c_max_discount CONSTANT NUMERIC := 50;        -- mismo tope que la venta POS (035)
  c_max_lines CONSTANT INT := 300;
  c_default_credit_days CONSTANT INT := 30;     -- plazo cuando el cliente no tiene credit_days
  v_caller UUID := auth.uid();
  v_company UUID;
  v_user RECORD;
  v_existing RECORD;
  v_loc RECORD;
  v_cust RECORD;
  v_cust_name VARCHAR(200);
  v_payments JSONB;
  v_methods TEXT[];
  v_method VARCHAR(30);
  v_has_cash BOOLEAN;
  v_is_credit BOOLEAN;
  v_cs RECORD;
  v_cash_session_id UUID;
  v_lines JSONB := '[]'::JSONB;
  v_line JSONB;
  v_ord BIGINT;
  v_pid UUID;
  v_qty NUMERIC;
  v_disc NUMERIC;
  v_agreed NUMERIC;              -- 079
  v_agg RECORD;
  v_prod RECORD;
  v_stock RECORD;
  v_info JSONB := '{}'::JSONB;
  v_pinfo JSONB;
  v_tax_rate NUMERIC(5,2);
  v_price NUMERIC(15,2);
  v_cost NUMERIC(15,2);
  v_gross NUMERIC(15,2);
  v_gross_base NUMERIC(15,2);  -- 097
  v_line_total NUMERIC(15,2);  -- 097
  v_line_disc NUMERIC(15,2);
  v_taxable NUMERIC(15,2);
  v_line_tax NUMERIC(15,2);
  v_calc JSONB := '[]'::JSONB;
  v_subtotal NUMERIC(15,2) := 0;
  v_discount_total NUMERIC(15,2) := 0;
  v_tax_total NUMERIC(15,2) := 0;
  v_total NUMERIC(15,2) := 0;
  v_total_cost NUMERIC(15,2) := 0;
  v_today DATE := (NOW() AT TIME ZONE 'America/Bogota')::DATE;
  v_due_date DATE;
  v_sale_id UUID := gen_random_uuid();
  v_sale_number VARCHAR(50);
  v_effects JSONB;               -- 079
  v_entry JSONB;
  v_withholdings JSONB := '[]'::JSONB;   -- 095
  v_withholding NUMERIC(15,2) := 0;
  v_net NUMERIC(15,2);
BEGIN
  -- 1. Autenticación, empresa y permiso
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado: usuario no autenticado.' USING ERRCODE = '28000';
  END IF;
  v_company := public.get_auth_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado: el usuario no tiene empresa asignada.' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.is_admin() OR public.has_permission('sales.create')) THEN
    RAISE EXCEPTION 'Acceso denegado: registrar ventas requiere el permiso sales.create.' USING ERRCODE = '42501';
  END IF;
  SELECT full_name, is_active, assigned_cash_register_id INTO v_user FROM public.users WHERE id = v_caller;
  IF NOT FOUND OR v_user.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Acceso denegado: el usuario está inactivo.' USING ERRCODE = '42501';
  END IF;

  -- 2. Idempotencia: los reintentos con la misma clave devuelven la venta ya creada
  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Se requiere la clave de idempotencia de la venta.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('sale-idem:' || v_company::TEXT || ':' || p_idempotency_key::TEXT));
  SELECT id, sale_number, seller_user_id INTO v_existing
  FROM public.sales WHERE company_id = v_company AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.seller_user_id IS DISTINCT FROM v_caller THEN
      RAISE EXCEPTION 'La clave de idempotencia ya se usó en otra venta (%). Inicie una venta nueva.', v_existing.sale_number
        USING ERRCODE = '23505';
    END IF;
    RETURN public.fn_sale_with_payments_summary(v_existing.id, true);
  END IF;

  -- 3. Sede: de la empresa, activa y con acceso del usuario
  SELECT id, name, status, company_id INTO v_loc FROM public.locations WHERE id = p_location_id;
  IF NOT FOUND OR v_loc.company_id IS DISTINCT FROM v_company THEN
    RAISE EXCEPTION 'La sede de la venta no existe o no pertenece a su empresa.' USING ERRCODE = '42501';
  END IF;
  IF v_loc.status::TEXT <> 'ACTIVE' THEN
    RAISE EXCEPTION 'La sede "%" está inactiva.', v_loc.name USING ERRCODE = '55001';
  END IF;
  IF NOT public.has_location_access(p_location_id) THEN
    RAISE EXCEPTION 'Acceso denegado: no tiene acceso a la sede "%".', v_loc.name USING ERRCODE = '42501';
  END IF;

  -- 4. Medios de pago (normalizados una vez). El crédito no se combina con otros medios.
  IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) = 0 THEN
    RAISE EXCEPTION 'Debe indicar al menos un medio de pago.' USING ERRCODE = '23502';
  END IF;
  SELECT jsonb_agg(e || jsonb_build_object('method', UPPER(BTRIM(COALESCE(e->>'method', '')))))
  INTO v_payments FROM jsonb_array_elements(p_payments) e;
  SELECT ARRAY(SELECT DISTINCT e->>'method' FROM jsonb_array_elements(v_payments) e ORDER BY 1) INTO v_methods;
  IF EXISTS (SELECT 1 FROM unnest(v_methods) m
             WHERE m NOT IN ('CASH', 'BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'CREDIT')) THEN
    RAISE EXCEPTION 'Medio de pago no válido (%). Use efectivo, transferencia, tarjeta o crédito.',
      array_to_string(v_methods, ', ') USING ERRCODE = '22023';
  END IF;
  v_is_credit := 'CREDIT' = ANY(v_methods);
  IF v_is_credit AND array_length(v_methods, 1) > 1 THEN
    RAISE EXCEPTION 'Una venta a crédito no se combina con otros medios de pago.' USING ERRCODE = '22023';
  END IF;
  v_method := CASE WHEN array_length(v_methods, 1) = 1 THEN v_methods[1] ELSE 'MIXED' END;
  v_has_cash := 'CASH' = ANY(v_methods);

  -- 5. Efectivo: a la sesión de caja abierta del propio usuario en esta sede
  IF v_has_cash THEN
    IF NOT (public.is_admin() OR public.has_permission('pos.cash_register')) THEN
      RAISE EXCEPTION 'Acceso denegado: recibir efectivo requiere el permiso pos.cash_register.' USING ERRCODE = '42501';
    END IF;
    SELECT cs.id, cr.name AS register_name INTO v_cs
    FROM public.cash_sessions cs
    LEFT JOIN public.cash_registers cr ON cr.id = cs.cash_register_id
    WHERE cs.company_id = v_company
      AND cs.user_id = v_caller
      AND cs.status = 'OPEN'
      AND COALESCE(cs.location_id, cr.location_id) = p_location_id
      AND (v_user.assigned_cash_register_id IS NULL OR cs.cash_register_id = v_user.assigned_cash_register_id)
    ORDER BY cs.opening_time DESC
    LIMIT 1
    FOR SHARE OF cs;  -- impide que la sesión se cierre mientras entra este efectivo
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Para recibir efectivo debe tener su caja abierta en la sede "%". Abra su sesión de caja o use otro medio de pago.',
        v_loc.name USING ERRCODE = '55001';
    END IF;
    v_cash_session_id := v_cs.id;
  END IF;

  -- 6. Cliente de la empresa y activo (bloqueado si la venta es a crédito: cupo sin carreras)
  IF p_customer_id IS NULL THEN
    RAISE EXCEPTION 'Debe seleccionar el cliente de la venta.' USING ERRCODE = '23502';
  END IF;
  IF v_is_credit THEN
    SELECT id, company_id, is_active, document_number, credit_limit, current_balance, credit_days,
           COALESCE(company_name, TRIM(CONCAT(first_name, ' ', last_name))) AS display_name
    INTO v_cust FROM public.customers WHERE id = p_customer_id FOR UPDATE;
  ELSE
    SELECT id, company_id, is_active, document_number, credit_limit, current_balance, credit_days,
           COALESCE(company_name, TRIM(CONCAT(first_name, ' ', last_name))) AS display_name
    INTO v_cust FROM public.customers WHERE id = p_customer_id;
  END IF;
  IF NOT FOUND OR v_cust.company_id IS DISTINCT FROM v_company THEN
    RAISE EXCEPTION 'El cliente no existe o no pertenece a su empresa.' USING ERRCODE = '42501';
  END IF;
  IF v_cust.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'El cliente "%" está inactivo y no puede comprar.', v_cust.display_name USING ERRCODE = '55001';
  END IF;
  v_cust_name := COALESCE(NULLIF(v_cust.display_name, ''), 'Cliente');

  -- 7. Líneas: solo producto, cantidad y descuento (079: y precio acordado si se permite)
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La venta debe contener al menos un producto.' USING ERRCODE = '23502';
  END IF;
  IF jsonb_array_length(p_items) > c_max_lines THEN
    RAISE EXCEPTION 'La venta supera el máximo de % líneas.', c_max_lines USING ERRCODE = '22023';
  END IF;

  FOR v_line, v_ord IN SELECT e, o FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(e, o)
  LOOP
    BEGIN
      v_pid := (v_line->>'product_id')::UUID;
      v_qty := (v_line->>'quantity')::NUMERIC;
      v_disc := COALESCE((v_line->>'discount_percent')::NUMERIC, 0);
      -- 079: el precio acordado solo lo envían las conversiones de cotización autorizadas
      v_agreed := CASE WHEN p_allow_agreed_price IS TRUE THEN (v_line->>'agreed_unit_price')::NUMERIC END;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'La línea % de la venta tiene datos no válidos.', v_ord USING ERRCODE = '22023';
    END;
    IF v_pid IS NULL THEN
      RAISE EXCEPTION 'La línea % no indica el producto.', v_ord USING ERRCODE = '23502';
    END IF;
    IF v_qty IS NULL OR v_qty <= 0 OR v_qty > 100000 OR v_qty <> ROUND(v_qty, 2) THEN
      RAISE EXCEPTION 'Cantidad no válida en la línea % (mayor a 0, hasta 100.000 y con máximo 2 decimales).', v_ord
        USING ERRCODE = '22003';
    END IF;
    IF v_disc < 0 OR v_disc > c_max_discount OR v_disc <> ROUND(v_disc, 2) THEN
      RAISE EXCEPTION 'Descuento no permitido en la línea % (de 0 %% a % %%).', v_ord, c_max_discount USING ERRCODE = '22003';
    END IF;
    -- 079
    IF v_agreed IS NOT NULL AND (v_agreed <= 0 OR v_agreed <> ROUND(v_agreed, 2)) THEN
      RAISE EXCEPTION 'Precio acordado no válido en la línea %.', v_ord USING ERRCODE = '22003';
    END IF;
    v_lines := v_lines || jsonb_build_object('product_id', v_pid, 'quantity', v_qty, 'discount_percent', v_disc,
                                             'agreed_unit_price', v_agreed);  -- 079
  END LOOP;

  -- 8. Por producto (cantidades agregadas, en orden fijo para evitar bloqueos cruzados):
  --    catálogo, precio, IVA, costo promedio y stock bloqueado
  FOR v_agg IN
    SELECT (l->>'product_id')::UUID AS product_id, SUM((l->>'quantity')::NUMERIC) AS quantity
    FROM jsonb_array_elements(v_lines) l
    GROUP BY 1 ORDER BY 1
  LOOP
    SELECT id, company_id, name, is_active, public_sale_price, tax_rate_percent, is_tax_exempt, iva_treatment
    INTO v_prod FROM public.products WHERE id = v_agg.product_id;
    IF NOT FOUND OR v_prod.company_id IS DISTINCT FROM v_company THEN
      RAISE EXCEPTION 'Un producto de la venta no existe o no pertenece a su empresa.' USING ERRCODE = '23503';
    END IF;
    IF v_prod.is_active IS NOT TRUE THEN
      RAISE EXCEPTION 'El producto "%" está inactivo y no puede venderse.', v_prod.name USING ERRCODE = '55001';
    END IF;
    IF COALESCE(v_prod.public_sale_price, 0) <= 0 THEN
      RAISE EXCEPTION 'El producto "%" no tiene precio de venta configurado.', v_prod.name USING ERRCODE = '22023';
    END IF;

    SELECT quantity, COALESCE(reserved_quantity, 0) AS reserved, COALESCE(average_cost, 0) AS average_cost
    INTO v_stock
    FROM public.stock_levels
    WHERE product_id = v_agg.product_id AND location_id = p_location_id
    FOR UPDATE;
    IF NOT FOUND OR v_stock.quantity - v_stock.reserved < v_agg.quantity THEN
      RAISE EXCEPTION 'Stock insuficiente de "%" en "%". Disponible: %, solicitado: %.',
        v_prod.name, v_loc.name,
        CASE WHEN FOUND THEN GREATEST(v_stock.quantity - v_stock.reserved, 0) ELSE 0 END, v_agg.quantity
        USING ERRCODE = '55000';
    END IF;

    v_tax_rate := CASE
      WHEN v_prod.is_tax_exempt IS TRUE OR v_prod.iva_treatment IN ('EXENTO', 'EXCLUIDO') THEN 0
      ELSE COALESCE(v_prod.tax_rate_percent, 0) END;

    v_info := v_info || jsonb_build_object(v_agg.product_id::TEXT, jsonb_build_object(
      'name', v_prod.name,
      'price', v_prod.public_sale_price,
      'tax_rate', v_tax_rate,
      'cost', v_stock.average_cost,
      'stock', v_stock.quantity,
      'quantity', v_agg.quantity));
  END LOOP;

  -- 9. Cálculo de cada línea (mismas fórmulas que el POS, 035)
  FOR v_line IN SELECT e FROM jsonb_array_elements(v_lines) e
  LOOP
    v_pinfo := v_info->(v_line->>'product_id');
    v_qty := (v_line->>'quantity')::NUMERIC;
    v_disc := (v_line->>'discount_percent')::NUMERIC;
    -- 079: precio acordado de la cotización (si se permitió) o precio vigente del catálogo
    v_price := COALESCE((v_line->>'agreed_unit_price')::NUMERIC, (v_pinfo->>'price')::NUMERIC);
    v_tax_rate := (v_pinfo->>'tax_rate')::NUMERIC;
    v_cost := (v_pinfo->>'cost')::NUMERIC;

    -- 097: el precio (catálogo o acordado) YA INCLUYE el IVA. El total de la línea es lo que paga el
    -- cliente; la base y el IVA se desglosan de ese total (misma fórmula que fn_execute_pos_sale 096).
    v_gross := ROUND(v_qty * v_price, 2);
    v_line_total := v_gross - ROUND(v_gross * v_disc / 100.0, 2);
    v_taxable := ROUND(v_line_total * 100.0 / (100.0 + v_tax_rate), 2);
    v_line_tax := v_line_total - v_taxable;
    v_gross_base := ROUND(v_gross * 100.0 / (100.0 + v_tax_rate), 2);
    v_line_disc := v_gross_base - v_taxable;

    v_subtotal := v_subtotal + v_gross_base;
    v_discount_total := v_discount_total + v_line_disc;
    v_tax_total := v_tax_total + v_line_tax;
    v_total := v_total + v_line_total;
    v_total_cost := v_total_cost + ROUND(v_qty * v_cost, 2);

    v_calc := v_calc || jsonb_build_object(
      'product_id', v_line->>'product_id', 'quantity', v_qty,
      'unit_price', ROUND(v_price * 100.0 / (100.0 + v_tax_rate), 2),  -- 097: antes de IVA, como en la factura
      'unit_cost', v_cost, 'discount_percent', v_disc, 'tax_rate', v_tax_rate,
      'tax_amount', v_line_tax, 'subtotal', v_taxable, 'total', v_taxable + v_line_tax);
  END LOOP;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'El total de la venta debe ser mayor a cero.' USING ERRCODE = '22003';
  END IF;

  -- 095: retenciones que el cliente (agente retenedor) le practica a la empresa
  IF COALESCE(cardinality(p_withholding_concept_ids), 0) > 0 THEN
    v_withholdings := public.fn_compute_withholdings_internal(
      v_company, 'SALES', p_customer_id, v_total - v_tax_total, v_tax_total, p_withholding_concept_ids, v_today, false);
    SELECT COALESCE(SUM((w->>'amount')::NUMERIC), 0) INTO v_withholding
    FROM jsonb_array_elements(v_withholdings) w WHERE (w->>'applied')::BOOLEAN;
    IF v_withholding >= v_total THEN
      RAISE EXCEPTION 'Las retenciones (%) igualan o superan el total de la venta (%).', v_withholding, v_total
        USING ERRCODE = '22023';
    END IF;
  END IF;
  v_net := v_total - v_withholding;

  -- 10. Crédito: cupo aprobado y plazo del cliente
  IF v_is_credit THEN
    IF v_cust.document_number = '222222222222' THEN
      RAISE EXCEPTION 'No se vende a crédito a Consumidor Final. Seleccione el cliente.' USING ERRCODE = '22023';
    END IF;
    IF COALESCE(v_cust.credit_limit, 0) <= 0 THEN
      RAISE EXCEPTION 'El cliente "%" no tiene cupo de crédito aprobado. Configure el cupo en la ficha del cliente.', v_cust_name
        USING ERRCODE = '22023';
    END IF;
    IF COALESCE(v_cust.current_balance, 0) + v_net > v_cust.credit_limit THEN
      RAISE EXCEPTION 'La venta (%) excede el cupo de crédito de "%": cupo %, saldo actual %, disponible %.',
        v_net, v_cust_name, v_cust.credit_limit, COALESCE(v_cust.current_balance, 0),
        GREATEST(v_cust.credit_limit - COALESCE(v_cust.current_balance, 0), 0) USING ERRCODE = '22023';
    END IF;
    v_due_date := v_today + CASE WHEN COALESCE(v_cust.credit_days, 0) > 0 THEN v_cust.credit_days ELSE c_default_credit_days END;
  ELSE
    v_due_date := v_today;
  END IF;

  -- 11. Venta, líneas y kardex
  v_sale_number := public.fn_next_sale_number(v_company);

  INSERT INTO public.sales (
    id, company_id, location_id, customer_id, seller_user_id, cash_session_id, sale_number,
    subtotal_amount, discount_amount, tax_amount, total_amount, total_cost_amount, withholding_amount,
    paid_amount, payment_status, payment_terms, due_date, payment_method, status,
    idempotency_key, notes, created_at, updated_at
  ) VALUES (
    v_sale_id, v_company, p_location_id, p_customer_id, v_caller, NULL, v_sale_number,
    v_subtotal, v_discount_total, v_tax_total, v_total, v_total_cost, v_withholding,
    CASE WHEN v_is_credit THEN 0 ELSE v_net END,
    CASE WHEN v_is_credit THEN 'PENDING' ELSE 'PAID' END,
    CASE WHEN v_is_credit THEN 'CREDITO' ELSE 'CONTADO' END,
    v_due_date, v_method::payment_method_type, 'ISSUED'::sale_status,
    p_idempotency_key,
    COALESCE(NULLIF(BTRIM(LEFT(p_notes, 1000)), ''), 'Venta comercial ' || v_sale_number),
    NOW(), NOW()
  );

  -- iva_treatment de la línea lo asigna trg_sale_item_set_iva_treatment (060)
  INSERT INTO public.sale_items (
    company_id, sale_id, product_id, quantity, unit_cost, unit_price, discount_percent,
    tax_rate_percent, tax_amount, subtotal, total
  )
  SELECT v_company, v_sale_id, (c->>'product_id')::UUID, (c->>'quantity')::NUMERIC, (c->>'unit_cost')::NUMERIC,
         (c->>'unit_price')::NUMERIC, (c->>'discount_percent')::NUMERIC, (c->>'tax_rate')::NUMERIC,
         (c->>'tax_amount')::NUMERIC, (c->>'subtotal')::NUMERIC, (c->>'total')::NUMERIC
  FROM jsonb_array_elements(v_calc) c;

  -- Un movimiento por producto con la cantidad total (process_inventory_movement actualiza stock_levels)
  INSERT INTO public.inventory_movements (
    company_id, product_id, location_id, movement_type, quantity_in, quantity_out,
    previous_stock, new_stock, unit_cost, total_cost, document_type, document_reference,
    reason, user_id, created_at
  )
  SELECT v_company, k::UUID, p_location_id, 'SALE_OUT'::inventory_movement_type, 0, (v->>'quantity')::NUMERIC,
         (v->>'stock')::NUMERIC, (v->>'stock')::NUMERIC - (v->>'quantity')::NUMERIC,
         (v->>'cost')::NUMERIC, ROUND((v->>'quantity')::NUMERIC * (v->>'cost')::NUMERIC, 2),
         'SALE', v_sale_number, 'Venta ' || v_sale_number || ' - ' || v_cust_name, v_caller, NOW()
  FROM jsonb_each(v_info) AS t(k, v)
  ORDER BY k;

  -- 095: detalle de retenciones de la venta
  PERFORM public.fn_store_document_withholdings_internal(v_company, 'SALE', v_sale_id, v_withholdings);

  -- 12. Pagos con su cuenta destino (valida medios, cuentas bancarias y que la suma iguale el total)
  PERFORM public.fn_register_sale_payments_internal(v_sale_id, v_payments, v_caller);

  -- 13-15. (079) Efectivo a la caja del usuario, bancos y cartera: rutina común
  v_effects := public.fn_apply_sale_payment_effects_internal(v_sale_id, v_cash_session_id, v_caller, true);

  -- 16. Asiento contable en la misma transacción (FV): si falla, no queda la venta
  v_entry := public.fn_cause_sale_accounting_internal(v_sale_id);

  -- 17. Auditoría (079: con el origen de la venta)
  INSERT INTO public.audit_logs (company_id, user_id, user_name, action, module, entity_name, entity_id,
                                 location_id, new_value, created_at)
  VALUES (v_company, v_caller, COALESCE(v_user.full_name, 'Vendedor'), 'SALE_CREATED', 'SALES', 'sales',
          v_sale_id::TEXT, p_location_id,
          jsonb_build_object('sale_number', v_sale_number, 'total_amount', v_total, 'withholding_amount', v_withholding,
                             'payment_method', v_method,
                             'customer_id', p_customer_id, 'cash_session_id', v_cash_session_id,
                             'accounting_entry_number', v_entry->>'entry_number')
            || COALESCE(p_origin, '{}'::JSONB),
          NOW());

  RETURN public.fn_sale_with_payments_summary(v_sale_id, false);
END;
$function$;

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
    v_line_base NUMERIC(15,2); -- 097
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

        -- IVA con la misma regla y redondeo que fn_create_sale_with_payments_internal (097):
        -- el precio YA INCLUYE el IVA; la base y el IVA se desglosan del total de la línea.
        v_tax_rate := CASE
            WHEN v_product.is_tax_exempt IS TRUE OR v_product.iva_treatment IN ('EXENTO', 'EXCLUIDO') THEN 0
            ELSE COALESCE(v_product.tax_rate_percent, 0) END;
        v_gross := ROUND(v_qty * v_product.public_sale_price, 2);
        v_line_base := ROUND(v_gross * 100.0 / (100.0 + v_tax_rate), 2);
        v_line_tax := v_gross - v_line_base;

        v_lines := v_lines || jsonb_build_array(jsonb_build_object(
            'product_id', v_product_id, 'quantity', v_qty,
            'unit_price', ROUND(v_product.public_sale_price * 100.0 / (100.0 + v_tax_rate), 2),
            'subtotal', v_line_base));
        v_subtotal := v_subtotal + v_line_base;
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

COMMIT;
