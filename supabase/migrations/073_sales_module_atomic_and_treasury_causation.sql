-- ==============================================================================
-- MIGRACIÓN 073: VENTA ATÓMICA DEL MÓDULO VENTAS Y CAUSACIÓN AUTOMÁTICA DE TESORERÍA
-- SUPER MÁS ERP/POS
-- ==============================================================================
--
-- Problema que resuelve:
--   1. El módulo Ventas (no POS) grababa la venta desde el navegador en pasos separados (venta,
--      líneas, saldo del cliente, kardex, tesorería, pagos y asiento), con totales, IVA y costo
--      calculados por el cliente, número de venta con Math.random y errores silenciados. El
--      efectivo de un pago mixto no entraba a ninguna caja y el de contado iba a "la primera
--      sesión de caja abierta" de la empresa, fuera de quien fuera.
--   2. Tesorería ejecutaba pagos a proveedores y recaudos de clientes sin causar su asiento real:
--      fn_cause_payment_accounting / fn_cause_receipt_accounting (067) existían pero nadie las
--      llamaba (la pantalla creaba un asiento MANUAL con cuentas fijas 220505/111005/130505).
--      Además fn_execute_treasury_payment y fn_register_treasury_receipt (047) no validaban permisos.
--
-- Qué hace:
--   1. fn_create_sale_with_payments(): venta del módulo Ventas en UNA transacción. El servidor:
--      - toma empresa y vendedor del usuario autenticado; exige sales.create y acceso a la sede;
--      - genera el número (fn_next_sale_number, VTA-AAAA-000001) y es idempotente por
--        sales.idempotency_key (059);
--      - calcula precio (products.public_sale_price, el precio vigente que mantienen la aprobación de
--        precios 057/069 y el POS), descuento (0 % a 50 %, mismo tope del POS), IVA (exento/excluido
--        por iva_treatment 060 o is_tax_exempt) y costo (costo promedio de stock_levels de la sede);
--      - valida y bloquea el stock agregando las cantidades por producto; registra kardex SALE_OUT;
--      - registra los pagos con fn_register_sale_payments_internal (059): transferencias y tarjetas
--        solo a cuentas no CAJA_EFECTIVO con subcuenta PUC; suben el saldo de la cuenta y dejan su
--        movimiento bancario (CREDIT, igual que los recaudos de 047);
--      - el efectivo entra a la sesión de caja ABIERTA DEL USUARIO en esa sede (si no tiene: error);
--      - el crédito va a la cartera del cliente respetando su cupo (credit_limit) y plazo (credit_days);
--      - causa el asiento en la misma transacción (fn_cause_sale_accounting_internal, 059/062).
--      La venta del módulo Ventas no queda ligada a una sesión de caja (sales.cash_session_id NULL):
--      su comprobante es FV (064) y el resumen de la sesión cuenta su efectivo por cash_movements.
--   2. fn_execute_treasury_payment (047) redefinida: permiso treasury.create (o admin), fecha de
--      Bogotá y causación del comprobante CE en la misma transacción.
--   3. fn_register_treasury_receipt (047) redefinida: permiso treasury.create (o admin), clave de
--      idempotencia opcional (treasury_receipts.idempotency_key) y causación del comprobante RC (caja)
--      o CI (banco) en la misma transacción.
--
-- No borra datos ni modifica asientos existentes. Se puede re-ejecutar.
-- ==============================================================================

BEGIN;

-- Si una tabla está bloqueada por otra sesión, se falla rápido en vez de esperar (y bloquear a otros).
SET LOCAL lock_timeout = '5s';

-- ------------------------------------------------------------------------------
-- 1. VENTA DEL MÓDULO VENTAS: RESUMEN DEVUELTO AL CLIENTE (interno)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sale_with_payments_summary(p_sale_id UUID, p_replay BOOLEAN)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT jsonb_build_object(
    'success', true,
    'idempotent_replay', p_replay,
    'sale_id', s.id,
    'sale_number', s.sale_number,
    'payment_method', s.payment_method::TEXT,
    'payment_status', s.payment_status,
    'due_date', s.due_date,
    'subtotal', s.subtotal_amount,
    'discount_total', s.discount_amount,
    'tax_total', s.tax_amount,
    'total_amount', s.total_amount,
    'total_cost', s.total_cost_amount,
    'payments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'method', sp.payment_method::TEXT,
               'amount', sp.amount,
               'bank_account_id', sp.bank_account_id) ORDER BY sp.created_at, sp.id)
      FROM public.sale_payments sp WHERE sp.sale_id = s.id), '[]'::JSONB),
    'accounting_entry_id', e.id,
    'accounting_entry_number', e.entry_number,
    'voucher_type_code', e.voucher_type_code)
  FROM public.sales s
  LEFT JOIN LATERAL (
    SELECT ae.id, ae.entry_number, ae.voucher_type_code
    FROM public.accounting_entries ae
    WHERE ae.company_id = s.company_id AND ae.document_type = 'SALE'
      AND ae.document_reference = s.sale_number AND ae.status = 'POSTED'
    LIMIT 1
  ) e ON true
  WHERE s.id = p_sale_id;
$$;

REVOKE ALL ON FUNCTION public.fn_sale_with_payments_summary(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. VENTA DEL MÓDULO VENTAS + PAGOS + CAJA/BANCO/CARTERA + ASIENTO EN UNA TRANSACCIÓN
-- ------------------------------------------------------------------------------
-- p_items:    [{ "product_id": uuid, "quantity": n, "discount_percent": n }]  (cualquier precio, IVA,
--             costo o total que envíe el navegador se ignora)
-- p_payments: [{ "method": "CASH"|"BANK_TRANSFER"|"CREDIT_CARD"|"DEBIT_CARD"|"CREDIT",
--                "amount": n | null (un solo pago puede tomar el saldo), "bank_account_id": uuid,
--                "reference": texto }]
CREATE OR REPLACE FUNCTION public.fn_create_sale_with_payments(
  p_location_id UUID,
  p_customer_id UUID,
  p_idempotency_key UUID,
  p_items JSONB,
  p_payments JSONB,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
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
  v_agg RECORD;
  v_prod RECORD;
  v_stock RECORD;
  v_info JSONB := '{}'::JSONB;
  v_pinfo JSONB;
  v_tax_rate NUMERIC(5,2);
  v_price NUMERIC(15,2);
  v_cost NUMERIC(15,2);
  v_gross NUMERIC(15,2);
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
  v_cash NUMERIC(15,2);
  v_bank RECORD;
  v_bank_balance NUMERIC(15,2);
  v_entry JSONB;
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

  -- 7. Líneas: solo producto, cantidad y descuento
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
    v_lines := v_lines || jsonb_build_object('product_id', v_pid, 'quantity', v_qty, 'discount_percent', v_disc);
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
    v_price := (v_pinfo->>'price')::NUMERIC;
    v_tax_rate := (v_pinfo->>'tax_rate')::NUMERIC;
    v_cost := (v_pinfo->>'cost')::NUMERIC;

    v_gross := ROUND(v_qty * v_price, 2);
    v_line_disc := ROUND(v_gross * v_disc / 100.0, 2);
    v_taxable := v_gross - v_line_disc;
    v_line_tax := ROUND(v_taxable * v_tax_rate / 100.0, 2);

    v_subtotal := v_subtotal + v_gross;
    v_discount_total := v_discount_total + v_line_disc;
    v_tax_total := v_tax_total + v_line_tax;
    v_total := v_total + v_taxable + v_line_tax;
    v_total_cost := v_total_cost + ROUND(v_qty * v_cost, 2);

    v_calc := v_calc || jsonb_build_object(
      'product_id', v_line->>'product_id', 'quantity', v_qty, 'unit_price', v_price,
      'unit_cost', v_cost, 'discount_percent', v_disc, 'tax_rate', v_tax_rate,
      'tax_amount', v_line_tax, 'subtotal', v_taxable, 'total', v_taxable + v_line_tax);
  END LOOP;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'El total de la venta debe ser mayor a cero.' USING ERRCODE = '22003';
  END IF;

  -- 10. Crédito: cupo aprobado y plazo del cliente
  IF v_is_credit THEN
    IF v_cust.document_number = '222222222222' THEN
      RAISE EXCEPTION 'No se vende a crédito a Consumidor Final. Seleccione el cliente.' USING ERRCODE = '22023';
    END IF;
    IF COALESCE(v_cust.credit_limit, 0) <= 0 THEN
      RAISE EXCEPTION 'El cliente "%" no tiene cupo de crédito aprobado. Configure el cupo en la ficha del cliente.', v_cust_name
        USING ERRCODE = '22023';
    END IF;
    IF COALESCE(v_cust.current_balance, 0) + v_total > v_cust.credit_limit THEN
      RAISE EXCEPTION 'La venta (%) excede el cupo de crédito de "%": cupo %, saldo actual %, disponible %.',
        v_total, v_cust_name, v_cust.credit_limit, COALESCE(v_cust.current_balance, 0),
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
    subtotal_amount, discount_amount, tax_amount, total_amount, total_cost_amount,
    paid_amount, payment_status, payment_terms, due_date, payment_method, status,
    idempotency_key, notes, created_at, updated_at
  ) VALUES (
    v_sale_id, v_company, p_location_id, p_customer_id, v_caller, NULL, v_sale_number,
    v_subtotal, v_discount_total, v_tax_total, v_total, v_total_cost,
    CASE WHEN v_is_credit THEN 0 ELSE v_total END,
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

  -- 12. Pagos con su cuenta destino (valida medios, cuentas bancarias y que la suma iguale el total)
  PERFORM public.fn_register_sale_payments_internal(v_sale_id, v_payments, v_caller);

  -- 13. Efectivo a la caja del usuario
  IF v_has_cash THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_cash
    FROM public.sale_payments WHERE sale_id = v_sale_id AND payment_method = 'CASH';
    INSERT INTO public.cash_movements (company_id, session_id, type, amount, reason, authorized_by_user_id, created_at)
    VALUES (v_company, v_cash_session_id, 'SALE_CASH', v_cash, 'Ingreso efectivo venta ' || v_sale_number, v_caller, NOW());
  END IF;

  -- 14. Transferencias y tarjetas: saldo y movimiento de cada cuenta bancaria
  FOR v_bank IN
    SELECT sp.bank_account_id, SUM(sp.amount) AS amount,
           STRING_AGG(DISTINCT NULLIF(sp.reference, ''), ', ') AS reference
    FROM public.sale_payments sp
    WHERE sp.sale_id = v_sale_id AND sp.bank_account_id IS NOT NULL
    GROUP BY sp.bank_account_id
    ORDER BY sp.bank_account_id
  LOOP
    PERFORM pg_advisory_xact_lock(hashtext('bank_account_' || v_bank.bank_account_id::TEXT));
    UPDATE public.bank_accounts
    SET current_balance = current_balance + v_bank.amount, updated_at = NOW()
    WHERE id = v_bank.bank_account_id
    RETURNING current_balance INTO v_bank_balance;

    INSERT INTO public.bank_movements (
      company_id, location_id, bank_account_id, movement_number, movement_date, movement_type,
      amount, balance_after, concept, reference, is_reconciled, created_by_user_id, created_at, updated_at
    ) VALUES (
      v_company, p_location_id, v_bank.bank_account_id,
      public.fn_next_treasury_consecutive(v_company, 'BANK_MOV'), v_today, 'CREDIT',
      v_bank.amount, v_bank_balance, 'Ingreso venta ' || v_sale_number || ' - ' || v_cust_name,
      LEFT(COALESCE(v_bank.reference, v_sale_number), 80), false, v_caller, NOW(), NOW()
    );
  END LOOP;

  -- 15. Crédito: cartera del cliente
  IF v_is_credit THEN
    UPDATE public.customers
    SET current_balance = COALESCE(current_balance, 0) + v_total, updated_at = NOW()
    WHERE id = p_customer_id;
  END IF;

  -- 16. Asiento contable en la misma transacción (FV): si falla, no queda la venta
  v_entry := public.fn_cause_sale_accounting_internal(v_sale_id);

  -- 17. Auditoría
  INSERT INTO public.audit_logs (company_id, user_id, user_name, action, module, entity_name, entity_id,
                                 location_id, new_value, created_at)
  VALUES (v_company, v_caller, COALESCE(v_user.full_name, 'Vendedor'), 'SALE_CREATED', 'SALES', 'sales',
          v_sale_id::TEXT, p_location_id,
          jsonb_build_object('sale_number', v_sale_number, 'total_amount', v_total, 'payment_method', v_method,
                             'customer_id', p_customer_id, 'cash_session_id', v_cash_session_id,
                             'accounting_entry_number', v_entry->>'entry_number'),
          NOW());

  RETURN public.fn_sale_with_payments_summary(v_sale_id, false);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_create_sale_with_payments(UUID, UUID, UUID, JSONB, JSONB, TEXT) FROM PUBLIC, anon;
-- Solo usuarios autenticados: empresa, vendedor y caja salen del usuario (service_role no tiene usuario).
GRANT EXECUTE ON FUNCTION public.fn_create_sale_with_payments(UUID, UUID, UUID, JSONB, JSONB, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. TESORERÍA: EJECUCIÓN DE PAGO A PROVEEDOR + COMPROBANTE CE (redefine 047)
-- ------------------------------------------------------------------------------
-- Misma firma y comportamiento de 047, más: permiso, fecha de Bogotá por defecto y causación atómica.
CREATE OR REPLACE FUNCTION public.fn_execute_treasury_payment(
    p_payment_id UUID,
    p_bank_account_id UUID DEFAULT NULL,
    p_reference_number TEXT DEFAULT NULL,
    p_support_document_url TEXT DEFAULT NULL,
    p_payment_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_company_id UUID;
    v_user_name VARCHAR(150);
    v_payment RECORD;
    v_bank_id UUID;
    v_bank RECORD;
    v_new_balance NUMERIC(15,2);
    v_mov_number VARCHAR(50);
    v_mov_id UUID;
    v_date DATE := COALESCE(p_payment_date, (NOW() AT TIME ZONE 'America/Bogota')::DATE);
    v_entry JSONB;
    v_voucher VARCHAR(5);
BEGIN
    IF v_user_id IS NOT NULL THEN
        v_company_id := public.get_auth_company_id();
        IF v_company_id IS NULL THEN
            RAISE EXCEPTION 'Acceso denegado: el usuario no tiene empresa asignada.' USING ERRCODE = '42501';
        END IF;
        IF NOT (public.is_admin() OR public.has_permission('treasury.create')) THEN
            RAISE EXCEPTION 'Acceso denegado: ejecutar pagos requiere el permiso treasury.create.' USING ERRCODE = '42501';
        END IF;
    ELSIF NOT public.fn_is_trusted_server_context() THEN
        RAISE EXCEPTION 'Acceso denegado: usuario no autenticado.' USING ERRCODE = '28000';
    END IF;

    -- Bloqueo pesimista del pago
    PERFORM pg_advisory_xact_lock(hashtext('treasury_payment_' || p_payment_id::text));

    SELECT * INTO v_payment FROM public.treasury_payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El pago programado especificado no existe.' USING ERRCODE = '23503';
    END IF;
    v_company_id := COALESCE(v_company_id, v_payment.company_id);
    IF v_payment.company_id <> v_company_id THEN
        RAISE EXCEPTION 'El pago programado pertenece a otra empresa.' USING ERRCODE = '42501';
    END IF;
    IF v_payment.status <> 'SCHEDULED' THEN
        RAISE EXCEPTION 'El pago % ya fue procesado o se encuentra en estado %.', v_payment.payment_number, v_payment.status
            USING ERRCODE = '42200';
    END IF;

    v_bank_id := COALESCE(p_bank_account_id, v_payment.bank_account_id);

    -- Bloqueo pesimista de la cuenta bancaria
    PERFORM pg_advisory_xact_lock(hashtext('bank_account_' || v_bank_id::text));
    SELECT * INTO v_bank FROM public.bank_accounts WHERE id = v_bank_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La cuenta bancaria seleccionada no existe.' USING ERRCODE = '23503';
    END IF;
    IF v_bank.company_id <> v_company_id THEN
        RAISE EXCEPTION 'La cuenta bancaria pertenece a otra empresa.' USING ERRCODE = '42501';
    END IF;
    IF v_bank.is_active <> true THEN
        RAISE EXCEPTION 'La cuenta bancaria "%" está inactiva.', v_bank.bank_name USING ERRCODE = '42200';
    END IF;
    IF v_bank.current_balance < v_payment.amount THEN
        RAISE EXCEPTION 'Fondos insuficientes en la cuenta bancaria "% (%)". Saldo disponible: %, Monto requerido: %.',
            v_bank.bank_name, v_bank.account_number, v_bank.current_balance, v_payment.amount
            USING ERRCODE = '42200';
    END IF;

    v_new_balance := v_bank.current_balance - v_payment.amount;

    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Usuario Sistema';
    END IF;

    -- 1. Saldo bancario
    UPDATE public.bank_accounts SET current_balance = v_new_balance, updated_at = NOW() WHERE id = v_bank_id;

    -- 2. Movimiento bancario (DEBIT = salida, convención de 047)
    v_mov_number := public.fn_next_treasury_consecutive(v_company_id, 'BANK_MOV');
    v_mov_id := gen_random_uuid();
    INSERT INTO public.bank_movements (
        id, company_id, location_id, bank_account_id, movement_number, movement_date, movement_type,
        amount, balance_after, concept, reference, treasury_payment_id, is_reconciled,
        created_by_user_id, created_at, updated_at
    ) VALUES (
        v_mov_id, v_company_id, v_bank.location_id, v_bank_id, v_mov_number, v_date, 'DEBIT',
        v_payment.amount, v_new_balance, 'Desembolso pago ' || v_payment.payment_number,
        COALESCE(p_reference_number, v_payment.reference_number), p_payment_id, false,
        v_user_id, NOW(), NOW()
    );

    -- 3. Pago a PAID
    UPDATE public.treasury_payments
    SET status = 'PAID',
        bank_account_id = v_bank_id,
        reference_number = COALESCE(p_reference_number, reference_number),
        support_document_url = COALESCE(p_support_document_url, support_document_url),
        payment_date = v_date,
        paid_at = NOW(),
        updated_by_user_id = COALESCE(v_user_id, updated_by_user_id),
        updated_at = NOW()
    WHERE id = p_payment_id;

    -- 4. Cuenta por pagar de la compra, si aplica
    IF v_payment.purchase_id IS NOT NULL THEN
        UPDATE public.purchases
        SET paid_amount = paid_amount + v_payment.amount,
            payment_status = CASE WHEN (paid_amount + v_payment.amount) >= total_amount THEN 'PAID' ELSE 'PARTIAL' END,
            updated_at = NOW()
        WHERE id = v_payment.purchase_id;
    END IF;

    -- 5. Comprobante de egreso (CE) en la misma transacción: Dr proveedores / Cr subcuenta del banco
    v_entry := public.fn_cause_payment_accounting_internal(p_payment_id);
    SELECT voucher_type_code INTO v_voucher FROM public.accounting_entries WHERE id = (v_entry->>'entry_id')::UUID;

    -- 6. Auditoría
    INSERT INTO public.audit_logs (
        company_id, user_id, user_name, action, module, entity_name, entity_id, location_id, new_value, created_at
    ) VALUES (
        v_company_id, v_user_id, v_user_name, 'TREASURY_PAYMENT_EXECUTED', 'TREASURY', 'treasury_payments',
        p_payment_id, v_bank.location_id,
        jsonb_build_object(
            'payment_id', p_payment_id,
            'payment_number', v_payment.payment_number,
            'amount', v_payment.amount,
            'bank_account_id', v_bank_id,
            'bank_movement_id', v_mov_id,
            'previous_bank_balance', v_bank.current_balance,
            'new_bank_balance', v_new_balance,
            'purchase_id', v_payment.purchase_id,
            'accounting_entry_number', v_entry->>'entry_number'
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', p_payment_id,
        'payment_number', v_payment.payment_number,
        'amount', v_payment.amount,
        'bank_movement_id', v_mov_id,
        'bank_movement_number', v_mov_number,
        'new_bank_balance', v_new_balance,
        'status', 'PAID',
        'accounting_entry_id', v_entry->>'entry_id',
        'accounting_entry_number', v_entry->>'entry_number',
        'voucher_type_code', v_voucher
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_execute_treasury_payment(UUID, UUID, TEXT, TEXT, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_execute_treasury_payment(UUID, UUID, TEXT, TEXT, DATE) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. TESORERÍA: RECAUDO DE CLIENTE + COMPROBANTE RC/CI (redefine 047)
-- ------------------------------------------------------------------------------
-- Clave de idempotencia opcional: el mismo intento (doble clic, reintento) no crea dos recaudos.
ALTER TABLE public.treasury_receipts ADD COLUMN IF NOT EXISTS idempotency_key UUID;
CREATE UNIQUE INDEX IF NOT EXISTS uq_treasury_receipts_company_idempotency_key
  ON public.treasury_receipts (company_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- La firma cambia (p_idempotency_key al final): se elimina la de 047 para no dejar dos versiones.
DROP FUNCTION IF EXISTS public.fn_register_treasury_receipt(UUID, UUID, NUMERIC, DATE, VARCHAR, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.fn_register_treasury_receipt(
    p_customer_id UUID,
    p_bank_account_id UUID,
    p_amount NUMERIC(15,2),
    p_receipt_date DATE DEFAULT NULL,
    p_payment_method VARCHAR DEFAULT 'TRANSFERENCIA',
    p_reference_number TEXT DEFAULT NULL,
    p_invoice_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_idempotency_key UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_company_id UUID;
    v_user_name VARCHAR(150);
    v_customer RECORD;
    v_bank RECORD;
    v_existing RECORD;
    v_receipt_id UUID;
    v_receipt_number VARCHAR(50);
    v_mov_id UUID;
    v_mov_number VARCHAR(50);
    v_new_balance NUMERIC(15,2);
    v_amount NUMERIC(15,2) := ROUND(p_amount, 2);
    v_date DATE := COALESCE(p_receipt_date, (NOW() AT TIME ZONE 'America/Bogota')::DATE);
    v_method VARCHAR(30) := UPPER(BTRIM(COALESCE(NULLIF(p_payment_method, ''), 'TRANSFERENCIA')));
    v_entry JSONB;
    v_voucher VARCHAR(5);
BEGIN
    IF v_user_id IS NOT NULL THEN
        v_company_id := public.get_auth_company_id();
        IF v_company_id IS NULL THEN
            RAISE EXCEPTION 'Acceso denegado: el usuario no tiene empresa asignada.' USING ERRCODE = '42501';
        END IF;
        IF NOT (public.is_admin() OR public.has_permission('treasury.create')) THEN
            RAISE EXCEPTION 'Acceso denegado: registrar recaudos requiere el permiso treasury.create.' USING ERRCODE = '42501';
        END IF;
    ELSIF public.fn_is_trusted_server_context() THEN
        SELECT company_id INTO v_company_id FROM public.customers WHERE id = p_customer_id;
    ELSE
        RAISE EXCEPTION 'Acceso denegado: usuario no autenticado.' USING ERRCODE = '28000';
    END IF;
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo determinar la empresa del recaudo.' USING ERRCODE = '42501';
    END IF;

    -- Idempotencia: el reintento devuelve el recaudo ya registrado
    IF p_idempotency_key IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtext('treasury-receipt-idem:' || v_company_id::TEXT || ':' || p_idempotency_key::TEXT));
        SELECT r.id, r.receipt_number, r.amount, r.status, e.id AS entry_id, e.entry_number, e.voucher_type_code
        INTO v_existing
        FROM public.treasury_receipts r
        LEFT JOIN public.accounting_entries e ON e.id = r.accounting_entry_id
        WHERE r.company_id = v_company_id AND r.idempotency_key = p_idempotency_key;
        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'idempotent_replay', true,
                'receipt_id', v_existing.id,
                'receipt_number', v_existing.receipt_number,
                'amount', v_existing.amount,
                'status', v_existing.status,
                'accounting_entry_id', v_existing.entry_id,
                'accounting_entry_number', v_existing.entry_number,
                'voucher_type_code', v_existing.voucher_type_code
            );
        END IF;
    END IF;

    IF v_amount IS NULL OR v_amount <= 0 THEN
        RAISE EXCEPTION 'El monto del recaudo debe ser estrictamente mayor a 0.' USING ERRCODE = '42200';
    END IF;

    -- Cliente
    SELECT id, company_id, current_balance, credit_limit INTO v_customer
    FROM public.customers WHERE id = p_customer_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El cliente especificado no existe.' USING ERRCODE = '23503';
    END IF;
    IF v_customer.company_id <> v_company_id THEN
        RAISE EXCEPTION 'El cliente pertenece a otra empresa.' USING ERRCODE = '42501';
    END IF;

    -- Cuenta bancaria o caja que recibe
    PERFORM pg_advisory_xact_lock(hashtext('bank_account_' || p_bank_account_id::text));
    SELECT * INTO v_bank FROM public.bank_accounts WHERE id = p_bank_account_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La cuenta bancaria especificada no existe.' USING ERRCODE = '23503';
    END IF;
    IF v_bank.company_id <> v_company_id THEN
        RAISE EXCEPTION 'La cuenta bancaria pertenece a otra empresa.' USING ERRCODE = '42501';
    END IF;
    IF v_bank.is_active <> true THEN
        RAISE EXCEPTION 'La cuenta bancaria "%" está inactiva.', v_bank.bank_name USING ERRCODE = '42200';
    END IF;

    v_new_balance := v_bank.current_balance + v_amount;

    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_user_name FROM public.users WHERE id = v_user_id;
    END IF;
    IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
        v_user_name := 'Usuario Sistema';
    END IF;

    v_receipt_id := gen_random_uuid();
    v_receipt_number := public.fn_next_treasury_consecutive(v_company_id, 'RECEIPT');
    v_mov_id := gen_random_uuid();
    v_mov_number := public.fn_next_treasury_consecutive(v_company_id, 'BANK_MOV');

    -- 1. Saldo bancario
    UPDATE public.bank_accounts SET current_balance = v_new_balance, updated_at = NOW() WHERE id = p_bank_account_id;

    -- 2. Recibo
    INSERT INTO public.treasury_receipts (
        id, company_id, location_id, receipt_number, customer_id, invoice_id, bank_account_id, amount,
        receipt_date, payment_method, reference_number, status, notes, idempotency_key,
        created_by_user_id, created_at, updated_at
    ) VALUES (
        v_receipt_id, v_company_id, v_bank.location_id, v_receipt_number, p_customer_id, p_invoice_id,
        p_bank_account_id, v_amount, v_date, v_method, p_reference_number, 'COLLECTED', p_notes, p_idempotency_key,
        v_user_id, NOW(), NOW()
    );

    -- 3. Movimiento bancario (CREDIT = entrada, convención de 047)
    INSERT INTO public.bank_movements (
        id, company_id, location_id, bank_account_id, movement_number, movement_date, movement_type,
        amount, balance_after, concept, reference, treasury_receipt_id, is_reconciled,
        created_by_user_id, created_at, updated_at
    ) VALUES (
        v_mov_id, v_company_id, v_bank.location_id, p_bank_account_id, v_mov_number, v_date, 'CREDIT',
        v_amount, v_new_balance, 'Recaudo cliente ' || v_receipt_number, p_reference_number, v_receipt_id, false,
        v_user_id, NOW(), NOW()
    );

    -- 4. Cartera del cliente
    UPDATE public.customers
    SET current_balance = GREATEST(0.00, current_balance - v_amount), updated_at = NOW()
    WHERE id = p_customer_id;

    -- 5. Comprobante RC (caja) o CI (banco) en la misma transacción: Dr subcuenta / Cr cartera
    v_entry := public.fn_cause_receipt_accounting_internal(v_receipt_id);
    SELECT voucher_type_code INTO v_voucher FROM public.accounting_entries WHERE id = (v_entry->>'entry_id')::UUID;

    -- 6. Auditoría
    INSERT INTO public.audit_logs (
        company_id, user_id, user_name, action, module, entity_name, entity_id, location_id, new_value, created_at
    ) VALUES (
        v_company_id, v_user_id, v_user_name, 'TREASURY_RECEIPT_REGISTERED', 'TREASURY', 'treasury_receipts',
        v_receipt_id, v_bank.location_id,
        jsonb_build_object(
            'receipt_id', v_receipt_id,
            'receipt_number', v_receipt_number,
            'customer_id', p_customer_id,
            'amount', v_amount,
            'bank_account_id', p_bank_account_id,
            'bank_movement_id', v_mov_id,
            'previous_bank_balance', v_bank.current_balance,
            'new_bank_balance', v_new_balance,
            'accounting_entry_number', v_entry->>'entry_number'
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'idempotent_replay', false,
        'receipt_id', v_receipt_id,
        'receipt_number', v_receipt_number,
        'amount', v_amount,
        'bank_movement_id', v_mov_id,
        'bank_movement_number', v_mov_number,
        'new_bank_balance', v_new_balance,
        'status', 'COLLECTED',
        'accounting_entry_id', v_entry->>'entry_id',
        'accounting_entry_number', v_entry->>'entry_number',
        'voucher_type_code', v_voucher
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_register_treasury_receipt(UUID, UUID, NUMERIC, DATE, VARCHAR, TEXT, UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_register_treasury_receipt(UUID, UUID, NUMERIC, DATE, VARCHAR, TEXT, UUID, TEXT, UUID) TO authenticated, service_role;

COMMIT;
