-- ==============================================================================
-- MIGRACIÓN 079: GUARDAS DE ESCRITURA EN VENTAS Y FLUJOS ATÓMICOS DE CONVERSIÓN Y ANULACIÓN
-- SUPER MÁS ERP/POS
-- ==============================================================================
--
-- Problema que resuelve (auditoría A4 / M6):
--   1. Convertir una cotización o un pedido web en venta se hacía desde el navegador, insertando en
--      sales/sale_items con totales, IVA y costo del cliente (pedido web: costo = subtotal * 0.7 e
--      IVA 0 fijos), stock editado directo, sin pagos, sin caja/banco/cartera y sin asiento.
--   2. La anulación de ventas no era atómica (cambiaba el estado aunque fallara el kardex), no
--      revertía pagos, caja, banco ni asiento, comparaba 'CREDITO' cuando el medio guardado es
--      'CREDIT' y anulaba ventas con factura electrónica aceptada (eso exige nota crédito).
--   3. Las políticas RLS de sales/sale_items (014) permiten INSERT/UPDATE desde authenticated sin
--      guarda de campos: cualquier vendedor podía cambiar totales, cliente, medio o estado.
--   4. M6: el POS (059) no movía bank_accounts.current_balance ni creaba bank_movements en
--      transferencias, y el efectivo (único o mixto) entraba a cash_movements sin company_id.
--
-- Qué hace:
--   1. fn_apply_sale_payment_effects_internal(): ÚNICA rutina interna que lleva los pagos ya
--      registrados de una venta (sale_payments) a caja (cash_movements con company_id), bancos
--      (saldo + bank_movements CREDIT) y cartera (customers.current_balance). La usan la venta del
--      módulo Ventas, las conversiones y el POS.
--   2. fn_create_sale_with_payments_internal(): el cuerpo de fn_create_sale_with_payments (073)
--      copiado sin cambios salvo lo marcado con "079": precio acordado opcional (solo cotizaciones
--      autorizadas), efectos de pago por la rutina común y origen en la auditoría.
--      fn_create_sale_with_payments (misma firma y permisos) queda como envoltorio.
--   3. fn_convert_quote_to_sale() y fn_convert_web_order_to_sale(): conversión atómica e idempotente
--      (por clave y por documento) que reutiliza la venta interna y marca el documento convertido.
--   4. fn_cancel_sale(): anulación atómica con permiso sales.cancel, motivo obligatorio y reversa de
--      stock (kardex), caja, banco, cartera y asiento (fn_reverse_accounting_entry_internal, 067).
--   5. fn_execute_pos_sale_with_payments (059) redefinida (copia exacta) para usar la rutina común.
--   6. Escritura directa cerrada: sin INSERT para anon/authenticated en sales y sale_items, sin
--      políticas INSERT y triggers que impiden a anon/authenticated cambiar los campos de dinero,
--      cliente, medio, estado, empresa, sede, vendedor o caja (solo funciones del servidor).
--
-- Decisiones (detalle en cada sección):
--   - Precio de cotización: se respeta el precio acordado solo si la cotización está vigente
--     (SENT/ACCEPTED y valid_until >= hoy en Bogotá) y quien la convierte es administrador o tiene
--     prices.approve. quotes no guarda su autor y su RLS (052) deja escribir seller_user_id y
--     precios a cualquier usuario de la empresa, así que la única aprobación verificable es la de
--     quien convierte. En otro caso se usa el precio vigente. IVA y costo nunca vienen del documento.
--   - Pedido web: siempre precio vigente del ERP (el pedido nace en la web pública, no es confiable).
--     El valor del envío no se incluye en la venta (no hay regla contable aprobada para ese ingreso).
--   - Anulación con efectivo: sale de la sesión de caja ABIERTA (la original si sigue abierta y es
--     del usuario o el usuario es administrador; si no, la caja abierta del propio usuario en la sede)
--     como CASH_OUT, con saldo suficiente. Si no hay caja abierta: error claro. No se registra contra
--     una sesión cerrada (alteraría un arqueo ya conciliado) ni solo con asiento (el efectivo físico
--     quedaría sin control en ningún arqueo).
--   - fn_register_sale_payments (059) NO se redefine: toda venta que llega sin pagos registrados la
--     creó el flujo anterior del navegador, que ya movió caja, banco y cartera (ver commit cdf862d^);
--     aplicar la rutina común allí duplicaría el dinero.
--
-- No borra datos ni modifica asientos existentes. Se puede re-ejecutar.
-- Requiere 059, 062, 067, 068 y 073.
-- ==============================================================================

BEGIN;

-- Si una tabla está bloqueada por otra sesión, se falla rápido en vez de esperar (y bloquear a otros).
SET LOCAL lock_timeout = '5s';

-- ------------------------------------------------------------------------------
-- 0. TRAZABILIDAD DE LA ANULACIÓN
-- ------------------------------------------------------------------------------
-- El usuario que anula queda en audit_logs. No se agrega una segunda FK sales -> users: la app
-- embebe "users (...)" en las consultas de ventas y una segunda relación la volvería ambigua.
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- ------------------------------------------------------------------------------
-- 1. EFECTOS DE LOS PAGOS DE UNA VENTA: CAJA, BANCOS Y CARTERA (interna)
-- ------------------------------------------------------------------------------
-- Lee sale_payments (ya validados por fn_register_sale_payments_internal) y:
--   - efectivo: un SALE_CASH con company_id en p_cash_session_id (si p_register_cash);
--   - transferencias/tarjetas: suben el saldo de cada cuenta y dejan su movimiento CREDIT (igual
--     que 073, sección 14);
--   - crédito: suma a la cartera del cliente.
-- Sin control de acceso: lo hacen los envoltorios, que ya validaron la sesión de caja.
CREATE OR REPLACE FUNCTION public.fn_apply_sale_payment_effects_internal(
  p_sale_id UUID,
  p_cash_session_id UUID,
  p_user_id UUID,
  p_register_cash BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_sale RECORD;
  v_cust_name VARCHAR(200);
  v_today DATE := (NOW() AT TIME ZONE 'America/Bogota')::DATE;
  v_cash NUMERIC(15,2);
  v_credit NUMERIC(15,2);
  v_bank_total NUMERIC(15,2) := 0;
  v_cs RECORD;
  v_cash_movement_id UUID;
  v_bank RECORD;
  v_bank_balance NUMERIC(15,2);
BEGIN
  SELECT id, company_id, location_id, customer_id, sale_number INTO v_sale
  FROM public.sales WHERE id = p_sale_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta % no encontrada.', p_sale_id USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(NULLIF(COALESCE(company_name, TRIM(CONCAT(first_name, ' ', last_name))), ''), 'Cliente')
  INTO v_cust_name FROM public.customers WHERE id = v_sale.customer_id;
  v_cust_name := COALESCE(v_cust_name, 'Cliente');

  SELECT COALESCE(SUM(amount) FILTER (WHERE payment_method = 'CASH'), 0),
         COALESCE(SUM(amount) FILTER (WHERE payment_method = 'CREDIT'), 0)
  INTO v_cash, v_credit
  FROM public.sale_payments WHERE sale_id = p_sale_id;

  -- 1. Efectivo a la sesión de caja indicada (abierta y de la empresa de la venta)
  IF v_cash > 0 AND p_register_cash THEN
    IF p_cash_session_id IS NULL THEN
      RAISE EXCEPTION 'Se requiere una sesión de caja abierta para recibir efectivo.' USING ERRCODE = '55001';
    END IF;
    SELECT company_id, status INTO v_cs FROM public.cash_sessions WHERE id = p_cash_session_id;
    IF NOT FOUND OR v_cs.company_id IS DISTINCT FROM v_sale.company_id THEN
      RAISE EXCEPTION 'La sesión de caja no existe o no pertenece a la empresa de la venta.' USING ERRCODE = '42501';
    END IF;
    IF v_cs.status <> 'OPEN' THEN
      RAISE EXCEPTION 'La sesión de caja no está abierta (estado: %).', v_cs.status USING ERRCODE = '55001';
    END IF;
    INSERT INTO public.cash_movements (company_id, session_id, type, amount, reason, authorized_by_user_id, created_at)
    VALUES (v_sale.company_id, p_cash_session_id, 'SALE_CASH', v_cash, 'Ingreso efectivo venta ' || v_sale.sale_number,
            p_user_id, NOW())
    RETURNING id INTO v_cash_movement_id;
  END IF;

  -- 2. Transferencias y tarjetas: saldo y movimiento de cada cuenta bancaria
  FOR v_bank IN
    SELECT sp.bank_account_id, SUM(sp.amount) AS amount,
           STRING_AGG(DISTINCT NULLIF(sp.reference, ''), ', ') AS reference
    FROM public.sale_payments sp
    WHERE sp.sale_id = p_sale_id AND sp.bank_account_id IS NOT NULL
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
      v_sale.company_id, v_sale.location_id, v_bank.bank_account_id,
      public.fn_next_treasury_consecutive(v_sale.company_id, 'BANK_MOV'), v_today, 'CREDIT',
      v_bank.amount, v_bank_balance, 'Ingreso venta ' || v_sale.sale_number || ' - ' || v_cust_name,
      LEFT(COALESCE(v_bank.reference, v_sale.sale_number), 80), false, p_user_id, NOW(), NOW()
    );
    v_bank_total := v_bank_total + v_bank.amount;
  END LOOP;

  -- 3. Crédito: cartera del cliente (el cupo ya lo validó quien creó la venta)
  IF v_credit > 0 THEN
    UPDATE public.customers
    SET current_balance = COALESCE(current_balance, 0) + v_credit, updated_at = NOW()
    WHERE id = v_sale.customer_id;
  END IF;

  RETURN jsonb_build_object(
    'cash_amount', CASE WHEN p_register_cash THEN v_cash ELSE 0 END,
    'cash_session_id', CASE WHEN v_cash_movement_id IS NOT NULL THEN p_cash_session_id END,
    'cash_movement_id', v_cash_movement_id,
    'bank_amount', v_bank_total,
    'credit_amount', v_credit);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_apply_sale_payment_effects_internal(UUID, UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. VENTA DEL MÓDULO VENTAS (interna, común a Ventas y a las conversiones)
-- ------------------------------------------------------------------------------
-- Cuerpo de fn_create_sale_with_payments (073) sin cambios salvo lo marcado con "079".
-- p_items:    [{ "product_id": uuid, "quantity": n, "discount_percent": n,
--                "agreed_unit_price": n (079: solo se lee si p_allow_agreed_price) }]
-- p_payments: igual que 073.
CREATE OR REPLACE FUNCTION public.fn_create_sale_with_payments_internal(
  p_location_id UUID,
  p_customer_id UUID,
  p_idempotency_key UUID,
  p_items JSONB,
  p_payments JSONB,
  p_notes TEXT,
  p_allow_agreed_price BOOLEAN,  -- 079
  p_origin JSONB                 -- 079
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

  -- 13-15. (079) Efectivo a la caja del usuario, bancos y cartera: rutina común
  v_effects := public.fn_apply_sale_payment_effects_internal(v_sale_id, v_cash_session_id, v_caller, true);

  -- 16. Asiento contable en la misma transacción (FV): si falla, no queda la venta
  v_entry := public.fn_cause_sale_accounting_internal(v_sale_id);

  -- 17. Auditoría (079: con el origen de la venta)
  INSERT INTO public.audit_logs (company_id, user_id, user_name, action, module, entity_name, entity_id,
                                 location_id, new_value, created_at)
  VALUES (v_company, v_caller, COALESCE(v_user.full_name, 'Vendedor'), 'SALE_CREATED', 'SALES', 'sales',
          v_sale_id::TEXT, p_location_id,
          jsonb_build_object('sale_number', v_sale_number, 'total_amount', v_total, 'payment_method', v_method,
                             'customer_id', p_customer_id, 'cash_session_id', v_cash_session_id,
                             'accounting_entry_number', v_entry->>'entry_number')
            || COALESCE(p_origin, '{}'::JSONB),
          NOW());

  RETURN public.fn_sale_with_payments_summary(v_sale_id, false);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_create_sale_with_payments_internal(UUID, UUID, UUID, JSONB, JSONB, TEXT, BOOLEAN, JSONB) FROM PUBLIC, anon, authenticated;

-- Envoltorio público (misma firma y permisos de 073). El navegador nunca envía precios: el precio
-- acordado está desactivado y cualquier otro campo de la línea se ignora.
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
BEGIN
  RETURN public.fn_create_sale_with_payments_internal(
    p_location_id, p_customer_id, p_idempotency_key, p_items, p_payments, p_notes,
    false, jsonb_build_object('origin', 'SALES'));
END;
$$;

REVOKE ALL ON FUNCTION public.fn_create_sale_with_payments(UUID, UUID, UUID, JSONB, JSONB, TEXT) FROM PUBLIC, anon;
-- Solo usuarios autenticados: empresa, vendedor y caja salen del usuario (service_role no tiene usuario).
GRANT EXECUTE ON FUNCTION public.fn_create_sale_with_payments(UUID, UUID, UUID, JSONB, JSONB, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. CLIENTE DE UN DOCUMENTO A CONVERTIR (interna)
-- ------------------------------------------------------------------------------
-- Orden: cliente vinculado (de la empresa) → cliente activo con ese documento o correo (uno solo) →
-- Consumidor Final (solo si no es crédito y el documento no identifica a un cliente concreto).
-- Nunca crea clientes: no se inventan documentos de identidad.
CREATE OR REPLACE FUNCTION public.fn_resolve_conversion_customer_internal(
  p_company_id UUID,
  p_customer_id UUID,
  p_document TEXT,
  p_email TEXT,
  p_is_credit BOOLEAN,
  p_document_label TEXT
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id UUID;
  v_count INT;
  v_document TEXT := NULLIF(BTRIM(p_document), '');
  v_email TEXT := NULLIF(LOWER(BTRIM(p_email)), '');
BEGIN
  IF p_customer_id IS NOT NULL THEN
    SELECT id INTO v_id FROM public.customers WHERE id = p_customer_id AND company_id = p_company_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'El cliente de % no pertenece a su empresa.', p_document_label USING ERRCODE = '42501';
    END IF;
    RETURN v_id;
  END IF;

  IF v_document IS NOT NULL THEN
    SELECT COUNT(*), MIN(id::TEXT)::UUID INTO v_count, v_id
    FROM public.customers
    WHERE company_id = p_company_id AND document_number = v_document AND is_active = true;
    IF v_count = 1 THEN
      RETURN v_id;
    END IF;
    RAISE EXCEPTION '% no tiene un cliente registrado con el documento %. Registre o vincule el cliente antes de convertirla en venta.',
      p_document_label, v_document USING ERRCODE = '23503';
  END IF;

  IF v_email IS NOT NULL THEN
    SELECT COUNT(*), MIN(id::TEXT)::UUID INTO v_count, v_id
    FROM public.customers
    WHERE company_id = p_company_id AND LOWER(email) = v_email AND is_active = true;
    IF v_count = 1 THEN
      RETURN v_id;
    END IF;
  END IF;

  IF p_is_credit THEN
    RAISE EXCEPTION 'Una venta a crédito requiere un cliente registrado: vincule el cliente a %.', p_document_label
      USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_id FROM public.customers
  WHERE company_id = p_company_id AND document_number = '222222222222' AND is_active = true
  ORDER BY created_at LIMIT 1;
  IF v_id IS NULL THEN
    RAISE EXCEPTION '% no tiene cliente y la empresa no tiene el cliente Consumidor Final. Vincule un cliente.',
      p_document_label USING ERRCODE = '23503';
  END IF;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_resolve_conversion_customer_internal(UUID, UUID, TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 4. CONVERSIÓN DE COTIZACIÓN EN VENTA (atómica e idempotente)
-- ------------------------------------------------------------------------------
-- Idempotencia doble: (a) por documento: si la cotización ya tiene una venta no anulada, se
-- devuelve esa venta; (b) por clave: la venta interna no crea dos ventas con la misma clave.
-- Precio: ver encabezado (vigente + prices.approve de quien convierte → precio acordado).
CREATE OR REPLACE FUNCTION public.fn_convert_quote_to_sale(
  p_quote_id UUID,
  p_payments JSONB,
  p_idempotency_key UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_company UUID;
  v_today DATE := (NOW() AT TIME ZONE 'America/Bogota')::DATE;
  v_quote RECORD;
  v_existing RECORD;
  v_status TEXT;
  v_is_vigente BOOLEAN;
  v_use_agreed BOOLEAN;
  v_price_source TEXT;
  v_is_credit BOOLEAN;
  v_customer_id UUID;
  v_items JSONB;
  v_result JSONB;
  v_sale_id UUID;
  v_user_name VARCHAR(150);
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado: usuario no autenticado.' USING ERRCODE = '28000';
  END IF;
  v_company := public.get_auth_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado: el usuario no tiene empresa asignada.' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.is_admin() OR public.has_permission('sales.create')) THEN
    RAISE EXCEPTION 'Acceso denegado: convertir cotizaciones en venta requiere el permiso sales.create.' USING ERRCODE = '42501';
  END IF;
  IF p_quote_id IS NULL THEN
    RAISE EXCEPTION 'Indique la cotización a convertir.' USING ERRCODE = '23502';
  END IF;
  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Se requiere la clave de idempotencia de la conversión.' USING ERRCODE = '22023';
  END IF;

  -- Serializa conversiones simultáneas de la misma cotización
  PERFORM pg_advisory_xact_lock(hashtext('quote-convert:' || p_quote_id::TEXT));
  SELECT * INTO v_quote FROM public.quotes WHERE id = p_quote_id FOR UPDATE;
  IF NOT FOUND OR v_quote.company_id IS DISTINCT FROM v_company THEN
    RAISE EXCEPTION 'La cotización no existe o no pertenece a su empresa.' USING ERRCODE = '42501';
  END IF;

  -- (a) Idempotencia por documento
  IF v_quote.sale_id IS NOT NULL THEN
    SELECT id, status INTO v_existing FROM public.sales WHERE id = v_quote.sale_id;
    IF FOUND AND v_existing.status::TEXT <> 'CANCELLED' THEN
      RETURN public.fn_sale_with_payments_summary(v_existing.id, true)
        || jsonb_build_object('quote_id', v_quote.id, 'quote_number', v_quote.quote_number);
    END IF;
  END IF;

  v_status := UPPER(COALESCE(v_quote.status, ''));
  IF v_status = 'REJECTED' THEN
    RAISE EXCEPTION 'La cotización % fue rechazada y no se puede convertir en venta.', v_quote.quote_number USING ERRCODE = '55000';
  END IF;
  -- CONVERTED solo llega aquí si su venta fue anulada: se permite una nueva conversión.
  IF v_status NOT IN ('DRAFT', 'SENT', 'ACCEPTED', 'EXPIRED', 'CONVERTED') THEN
    RAISE EXCEPTION 'La cotización % está en estado % y no se puede convertir.', v_quote.quote_number, v_quote.status
      USING ERRCODE = '55000';
  END IF;

  -- Precio acordado: cotización vigente y aprobación verificable de quien convierte
  v_is_vigente := v_status IN ('SENT', 'ACCEPTED') AND v_quote.valid_until >= v_today;
  v_use_agreed := v_is_vigente AND (public.is_admin() OR public.has_permission('prices.approve'));
  v_price_source := CASE
    WHEN v_use_agreed THEN 'QUOTE_AGREED_PRICE'
    WHEN NOT v_is_vigente THEN 'CURRENT_PRICE_QUOTE_NOT_VALID'
    ELSE 'CURRENT_PRICE_NO_PRICE_APPROVAL' END;

  v_is_credit := EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(p_payments, '[]'::JSONB)) e
                         WHERE UPPER(BTRIM(COALESCE(e->>'method', ''))) = 'CREDIT');
  v_customer_id := public.fn_resolve_conversion_customer_internal(
    v_company, v_quote.customer_id, v_quote.customer_document, v_quote.customer_email, v_is_credit,
    'La cotización ' || v_quote.quote_number);

  SELECT jsonb_agg(jsonb_build_object(
           'product_id', qi.product_id,
           'quantity', qi.quantity,
           'discount_percent', qi.discount_percent,
           'agreed_unit_price', CASE WHEN v_use_agreed THEN qi.unit_price END)
         ORDER BY qi.created_at, qi.id)
  INTO v_items
  FROM public.quote_items qi
  WHERE qi.quote_id = v_quote.id AND qi.company_id = v_company;
  IF v_items IS NULL THEN
    RAISE EXCEPTION 'La cotización % no tiene productos.', v_quote.quote_number USING ERRCODE = '23502';
  END IF;

  v_result := public.fn_create_sale_with_payments_internal(
    v_quote.location_id, v_customer_id, p_idempotency_key, v_items, p_payments,
    'Venta por conversión de la cotización ' || v_quote.quote_number,
    v_use_agreed,
    jsonb_build_object('origin', 'QUOTE', 'quote_id', v_quote.id, 'quote_number', v_quote.quote_number,
                       'price_source', v_price_source));

  -- (b) Una clave ya usada pertenece a otra venta: el documento ya se habría devuelto en (a)
  IF (v_result->>'idempotent_replay')::BOOLEAN THEN
    RAISE EXCEPTION 'La clave de idempotencia ya se usó en otra venta (%). Inicie una conversión nueva.', v_result->>'sale_number'
      USING ERRCODE = '23505';
  END IF;
  v_sale_id := (v_result->>'sale_id')::UUID;

  UPDATE public.quotes
  SET status = 'CONVERTED', sale_id = v_sale_id, updated_at = NOW()
  WHERE id = v_quote.id;

  SELECT full_name INTO v_user_name FROM public.users WHERE id = v_caller;
  INSERT INTO public.audit_logs (company_id, user_id, user_name, action, module, entity_name, entity_id,
                                 location_id, previous_value, new_value, created_at)
  VALUES (v_company, v_caller, COALESCE(v_user_name, 'Vendedor'), 'QUOTE_CONVERTED', 'SALES', 'quotes',
          v_quote.id::TEXT, v_quote.location_id,
          jsonb_build_object('status', v_quote.status, 'sale_id', v_quote.sale_id),
          jsonb_build_object('status', 'CONVERTED', 'sale_id', v_sale_id, 'sale_number', v_result->>'sale_number',
                             'price_source', v_price_source, 'total_amount', v_result->'total_amount'),
          NOW());

  RETURN v_result || jsonb_build_object('quote_id', v_quote.id, 'quote_number', v_quote.quote_number,
                                        'price_source', v_price_source);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_convert_quote_to_sale(UUID, JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_convert_quote_to_sale(UUID, JSONB, UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. CONVERSIÓN DE PEDIDO WEB EN VENTA (atómica e idempotente)
-- ------------------------------------------------------------------------------
-- Precio vigente del ERP siempre (el pedido nace en la web pública), sin descuentos; IVA y costo
-- del servidor. El envío (shipping_fee) no entra a la venta: se devuelve para informarlo.
CREATE OR REPLACE FUNCTION public.fn_convert_web_order_to_sale(
  p_web_order_id UUID,
  p_payments JSONB,
  p_idempotency_key UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_company UUID;
  v_order RECORD;
  v_order_company UUID;
  v_existing RECORD;
  v_is_credit BOOLEAN;
  v_customer_id UUID;
  v_items JSONB;
  v_result JSONB;
  v_sale_id UUID;
  v_user_name VARCHAR(150);
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado: usuario no autenticado.' USING ERRCODE = '28000';
  END IF;
  v_company := public.get_auth_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado: el usuario no tiene empresa asignada.' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.is_admin() OR public.has_permission('sales.create')) THEN
    RAISE EXCEPTION 'Acceso denegado: convertir pedidos web en venta requiere el permiso sales.create.' USING ERRCODE = '42501';
  END IF;
  IF p_web_order_id IS NULL THEN
    RAISE EXCEPTION 'Indique el pedido web a convertir.' USING ERRCODE = '23502';
  END IF;
  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Se requiere la clave de idempotencia de la conversión.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('web-order-convert:' || p_web_order_id::TEXT));
  SELECT * INTO v_order FROM public.web_orders WHERE id = p_web_order_id FOR UPDATE;
  IF FOUND THEN
    SELECT company_id INTO v_order_company FROM public.locations WHERE id = v_order.dispatch_location_id;
  END IF;
  -- v_order_company queda NULL si el pedido o su sede no existen
  IF v_order_company IS NULL OR v_order_company IS DISTINCT FROM v_company
     OR (v_order.company_id IS NOT NULL AND v_order.company_id IS DISTINCT FROM v_company) THEN
    RAISE EXCEPTION 'El pedido web no existe o no pertenece a su empresa.' USING ERRCODE = '42501';
  END IF;

  -- Idempotencia por documento
  IF v_order.sale_id IS NOT NULL THEN
    SELECT id, status INTO v_existing FROM public.sales WHERE id = v_order.sale_id;
    IF FOUND AND v_existing.status::TEXT <> 'CANCELLED' THEN
      RETURN public.fn_sale_with_payments_summary(v_existing.id, true)
        || jsonb_build_object('web_order_id', v_order.id, 'order_number', v_order.order_number,
                              'shipping_fee', COALESCE(v_order.shipping_fee, 0));
    END IF;
  END IF;

  IF v_order.fulfillment_status::TEXT = 'CANCELLED' THEN
    RAISE EXCEPTION 'El pedido web % está cancelado y no se puede convertir en venta.', v_order.order_number
      USING ERRCODE = '55000';
  END IF;

  v_is_credit := EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(p_payments, '[]'::JSONB)) e
                         WHERE UPPER(BTRIM(COALESCE(e->>'method', ''))) = 'CREDIT');
  v_customer_id := public.fn_resolve_conversion_customer_internal(
    v_company, v_order.customer_id, NULL, v_order.customer_email, v_is_credit,
    'El pedido web ' || v_order.order_number);

  SELECT jsonb_agg(jsonb_build_object('product_id', woi.product_id, 'quantity', woi.quantity, 'discount_percent', 0)
                   ORDER BY woi.created_at, woi.id)
  INTO v_items
  FROM public.web_order_items woi
  WHERE woi.order_id = v_order.id;
  IF v_items IS NULL THEN
    RAISE EXCEPTION 'El pedido web % no tiene productos.', v_order.order_number USING ERRCODE = '23502';
  END IF;

  v_result := public.fn_create_sale_with_payments_internal(
    v_order.dispatch_location_id, v_customer_id, p_idempotency_key, v_items, p_payments,
    'Venta por pedido web ' || v_order.order_number || ' (' || COALESCE(v_order.channel, 'WEB') || ')',
    false,
    jsonb_build_object('origin', 'WEB_ORDER', 'web_order_id', v_order.id, 'order_number', v_order.order_number,
                       'price_source', 'CURRENT_PRICE'));

  IF (v_result->>'idempotent_replay')::BOOLEAN THEN
    RAISE EXCEPTION 'La clave de idempotencia ya se usó en otra venta (%). Inicie una conversión nueva.', v_result->>'sale_number'
      USING ERRCODE = '23505';
  END IF;
  v_sale_id := (v_result->>'sale_id')::UUID;

  UPDATE public.web_orders SET sale_id = v_sale_id, updated_at = NOW() WHERE id = v_order.id;

  SELECT full_name INTO v_user_name FROM public.users WHERE id = v_caller;
  INSERT INTO public.audit_logs (company_id, user_id, user_name, action, module, entity_name, entity_id,
                                 location_id, previous_value, new_value, created_at)
  VALUES (v_company, v_caller, COALESCE(v_user_name, 'Usuario'), 'WEB_ORDER_CONVERTED', 'WEB_ORDERS', 'web_orders',
          v_order.id::TEXT, v_order.dispatch_location_id,
          jsonb_build_object('sale_id', v_order.sale_id),
          jsonb_build_object('sale_id', v_sale_id, 'sale_number', v_result->>'sale_number',
                             'total_amount', v_result->'total_amount', 'web_order_total', v_order.total,
                             'shipping_fee_not_included', COALESCE(v_order.shipping_fee, 0)),
          NOW());

  RETURN v_result || jsonb_build_object('web_order_id', v_order.id, 'order_number', v_order.order_number,
                                        'shipping_fee', COALESCE(v_order.shipping_fee, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.fn_convert_web_order_to_sale(UUID, JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_convert_web_order_to_sale(UUID, JSONB, UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. VENTA POS: EFECTOS DE PAGO POR LA RUTINA COMÚN (redefine 059)
-- ------------------------------------------------------------------------------
-- Copia exacta de 059 salvo la sección 3 (marcada 079) y el campo payment_effects del resultado.
CREATE OR REPLACE FUNCTION public.fn_execute_pos_sale_with_payments(
  p_company_id UUID,
  p_location_id UUID,
  p_customer_id UUID,
  p_seller_user_id UUID,
  p_cash_session_id UUID,
  p_idempotency_key UUID,
  p_notes TEXT,
  p_items JSONB,
  p_payments JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_method VARCHAR(30);
  v_sale JSONB;
  v_sale_id UUID;
  v_sale_number VARCHAR(50);
  v_existing RECORD;
  v_has_cash BOOLEAN;
  v_pay_result JSONB;
  v_effects JSONB;  -- 079
  v_entry JSONB;
  v_payments JSONB;
  v_cs RECORD;
  v_assigned_register UUID;
BEGIN
  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Se requiere la clave de idempotencia del cobro.' USING ERRCODE = '22023';
  END IF;

  -- Autorización: usuario de la empresa con acceso al POS.
  IF v_caller IS NOT NULL THEN
    IF public.get_auth_company_id() IS DISTINCT FROM p_company_id THEN
      RAISE EXCEPTION 'Acceso denegado: la empresa de la venta no es la suya.' USING ERRCODE = '42501';
    END IF;
    IF NOT (public.is_admin() OR public.has_permission('pos.access')) THEN
      RAISE EXCEPTION 'Acceso denegado: requiere el permiso pos.access.' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT public.fn_is_trusted_server_context() THEN
    RAISE EXCEPTION 'Acceso denegado: usuario no autenticado.' USING ERRCODE = '28000';
  END IF;

  -- Idempotencia: serializa los reintentos con la misma clave y devuelve la venta ya creada.
  PERFORM pg_advisory_xact_lock(hashtext('pos-sale-idem:' || p_company_id::TEXT || ':' || p_idempotency_key::TEXT));

  SELECT id, sale_number, seller_user_id, payment_method, total_amount, subtotal_amount, tax_amount, discount_amount
  INTO v_existing
  FROM public.sales
  WHERE company_id = p_company_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.seller_user_id IS DISTINCT FROM COALESCE(p_seller_user_id, v_caller) THEN
      RAISE EXCEPTION 'La clave de idempotencia ya se usó en otra venta (%). Genere un nuevo cobro.', v_existing.sale_number
        USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object(
      'success', true,
      'idempotent_replay', true,
      'sale_id', v_existing.id,
      'sale_number', v_existing.sale_number,
      'payment_method', v_existing.payment_method::TEXT,
      'total_amount', v_existing.total_amount,
      'subtotal', v_existing.subtotal_amount,
      'tax_total', v_existing.tax_amount,
      'discount_total', v_existing.discount_amount,
      'accounting_entry_number', (SELECT entry_number FROM public.accounting_entries
                                  WHERE company_id = p_company_id AND document_type = 'SALE'
                                    AND document_reference = v_existing.sale_number AND status = 'POSTED'
                                  LIMIT 1));
  END IF;

  IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) = 0 THEN
    RAISE EXCEPTION 'Debe indicar al menos un medio de pago.' USING ERRCODE = '23502';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La venta debe contener al menos un producto.' USING ERRCODE = '23502';
  END IF;

  -- Un producto por línea: con líneas repetidas el stock se validaría por línea y no por el total vendido.
  IF (SELECT COUNT(*) FROM jsonb_array_elements(p_items) e)
     <> (SELECT COUNT(DISTINCT e->>'product_id') FROM jsonb_array_elements(p_items) e) THEN
    RAISE EXCEPTION 'Un mismo producto aparece en varias líneas de la venta. Agrúpelo en una sola línea.' USING ERRCODE = '22023';
  END IF;

  -- Normalizar medios de pago una sola vez (mayúsculas, sin espacios)
  SELECT jsonb_agg(e || jsonb_build_object('method', UPPER(TRIM(e->>'method'))))
  INTO v_payments
  FROM jsonb_array_elements(p_payments) e;

  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_payments) e WHERE e->>'method' = 'CREDIT') THEN
    RAISE EXCEPTION 'El POS no registra ventas a crédito. Use el módulo Ventas.' USING ERRCODE = '22023';
  END IF;

  -- Decisión de la empresa (21/10/2026): por ahora el POS NO recibe pagos con tarjeta.
  -- Para habilitarlos en el futuro se crea una migración que retire esta validación.
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_payments) e WHERE e->>'method' IN ('CREDIT_CARD', 'DEBIT_CARD')) THEN
    RAISE EXCEPTION 'El POS no recibe pagos con tarjeta por ahora. Use efectivo o transferencia.' USING ERRCODE = '22023';
  END IF;

  -- Un solo medio (aunque venga en varias líneas) es ese medio; dos medios distintos es MIXED.
  IF (SELECT COUNT(DISTINCT e->>'method') FROM jsonb_array_elements(v_payments) e) = 1 THEN
    v_method := v_payments->0->>'method';
  ELSE
    v_method := 'MIXED';
  END IF;

  v_has_cash := EXISTS (SELECT 1 FROM jsonb_array_elements(v_payments) e WHERE e->>'method' = 'CASH');

  -- Recibir efectivo exige el permiso de caja y una sesión de caja abierta.
  IF v_has_cash THEN
    IF v_caller IS NOT NULL AND NOT (public.is_admin() OR public.has_permission('pos.cash_register')) THEN
      RAISE EXCEPTION 'Acceso denegado: recibir efectivo requiere el permiso pos.cash_register.' USING ERRCODE = '42501';
    END IF;
    IF p_cash_session_id IS NULL THEN
      RAISE EXCEPTION 'Se requiere una sesión de caja abierta para recibir efectivo.' USING ERRCODE = '55001';
    END IF;
  END IF;

  -- Toda sesión de caja que llegue se valida (aunque la venta no sea en efectivo): de la empresa,
  -- de la sede, ABIERTA, del cajero y, si el usuario tiene caja asignada, de esa caja.
  IF p_cash_session_id IS NOT NULL THEN
    SELECT company_id, location_id, user_id, status, cash_register_id INTO v_cs
    FROM public.cash_sessions WHERE id = p_cash_session_id;
    IF NOT FOUND OR v_cs.company_id IS DISTINCT FROM p_company_id THEN
      RAISE EXCEPTION 'La sesión de caja no existe o no pertenece a la empresa.' USING ERRCODE = '42501';
    END IF;
    IF v_cs.location_id IS NOT NULL AND v_cs.location_id <> p_location_id THEN
      RAISE EXCEPTION 'La sesión de caja pertenece a otra sede.' USING ERRCODE = '42501';
    END IF;
    IF v_cs.status <> 'OPEN' THEN
      RAISE EXCEPTION 'La sesión de caja no está abierta (estado: %).', v_cs.status USING ERRCODE = '55001';
    END IF;
    IF v_caller IS NOT NULL AND v_cs.user_id <> v_caller AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'La sesión de caja pertenece a otro cajero.' USING ERRCODE = '42501';
    END IF;
    SELECT assigned_cash_register_id INTO v_assigned_register
    FROM public.users WHERE id = COALESCE(v_caller, p_seller_user_id);
    IF v_assigned_register IS NOT NULL AND v_cs.cash_register_id <> v_assigned_register THEN
      RAISE EXCEPTION 'La sesión de caja no es de la caja asignada al usuario.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 1. Número de venta del servidor + venta atómica existente (permisos, precios, impuestos, stock,
  --    kardex, caja si es efectivo)
  v_sale_number := public.fn_next_sale_number(p_company_id);
  v_sale := public.fn_execute_pos_sale(
    p_company_id, p_location_id, p_customer_id, p_seller_user_id, p_cash_session_id,
    v_sale_number, v_method, p_notes, p_items);
  v_sale_id := (v_sale->>'sale_id')::UUID;

  UPDATE public.sales SET idempotency_key = p_idempotency_key WHERE id = v_sale_id;

  -- 2. Pagos con cuenta destino exacta (la suma debe igualar el total calculado por el servidor)
  v_pay_result := public.fn_register_sale_payments_internal(v_sale_id, v_payments, COALESCE(v_caller, p_seller_user_id));

  -- 3. (079) Efectivo, bancos y cartera con la rutina común. En pago único en efectivo la caja ya la
  --    movió fn_execute_pos_sale (035) sin company_id: se completa aquí y la rutina no la repite.
  --    Las transferencias ahora suben el saldo de la cuenta y dejan su movimiento bancario.
  IF v_method = 'CASH' AND p_cash_session_id IS NOT NULL THEN
    UPDATE public.cash_movements
    SET company_id = p_company_id
    WHERE session_id = p_cash_session_id AND company_id IS NULL AND type = 'SALE_CASH'
      AND reason = 'Ingreso venta mostrador POS ' || v_sale_number;
  END IF;
  v_effects := public.fn_apply_sale_payment_effects_internal(
    v_sale_id, p_cash_session_id, COALESCE(v_caller, p_seller_user_id), v_method <> 'CASH');

  -- 4. Asiento contable en la misma transacción: si falla, no queda venta sin contabilidad.
  v_entry := public.fn_cause_sale_accounting_internal(v_sale_id);

  RETURN v_sale || jsonb_build_object(
    'idempotent_replay', false,
    'payment_method', v_method,
    'payments', v_pay_result,
    'payment_effects', v_effects,  -- 079
    'accounting_entry_id', v_entry->>'entry_id',
    'accounting_entry_number', v_entry->>'entry_number');
END;
$$;

REVOKE ALL ON FUNCTION public.fn_execute_pos_sale_with_payments(UUID, UUID, UUID, UUID, UUID, UUID, TEXT, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_execute_pos_sale_with_payments(UUID, UUID, UUID, UUID, UUID, UUID, TEXT, JSONB, JSONB) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. ANULACIÓN ATÓMICA DE VENTA
-- ------------------------------------------------------------------------------
-- Bloquea (debe usarse otro documento): factura electrónica de la venta en cualquier estado salvo
-- REJECTED (PENDING/SENT = en proceso; ACCEPTED* = emitida: nota crédito), devoluciones activas,
-- remisiones no anuladas y ventas a crédito con abonos (anule primero los abonos en Cartera).
-- Revierte en una transacción: stock (kardex POSITIVE_ADJUSTMENT / REVERSION al costo de la venta),
-- efectivo (CASH_OUT en una caja abierta), bancos (saldo + movimiento DEBIT), cartera y asiento.
-- Reintentar sobre una venta ya anulada devuelve already_cancelled sin repetir nada.
CREATE OR REPLACE FUNCTION public.fn_cancel_sale(
  p_sale_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_company UUID;
  v_user RECORD;
  v_reason TEXT := BTRIM(COALESCE(p_reason, ''));
  v_today DATE := (NOW() AT TIME ZONE 'America/Bogota')::DATE;
  v_sale RECORD;
  v_loc_name VARCHAR(200);
  v_inv RECORD;
  v_has_payments BOOLEAN;
  v_cash NUMERIC(15,2) := 0;
  v_credit NUMERIC(15,2) := 0;
  v_bank_total NUMERIC(15,2) := 0;
  v_orig_session UUID;
  v_cs RECORD;
  v_session_cash NUMERIC(15,2);
  v_cash_session_id UUID;
  v_bank RECORD;
  v_bank_acc RECORD;
  v_bank_balance NUMERIC(15,2);
  v_prev_balance NUMERIC(15,2);
  v_item RECORD;
  v_prev_stock NUMERIC(12,2);
  v_units NUMERIC(14,2) := 0;
  v_entry RECORD;
  v_rev JSONB;
  v_reversals JSONB := '[]'::JSONB;
BEGIN
  -- 1. Autenticación, empresa, permiso y motivo
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado: usuario no autenticado.' USING ERRCODE = '28000';
  END IF;
  v_company := public.get_auth_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado: el usuario no tiene empresa asignada.' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.is_admin() OR public.has_permission('sales.cancel')) THEN
    RAISE EXCEPTION 'Acceso denegado: anular ventas requiere el permiso sales.cancel.' USING ERRCODE = '42501';
  END IF;
  SELECT full_name, is_active, assigned_cash_register_id INTO v_user FROM public.users WHERE id = v_caller;
  IF NOT FOUND OR v_user.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Acceso denegado: el usuario está inactivo.' USING ERRCODE = '42501';
  END IF;
  IF LENGTH(v_reason) < 5 OR LENGTH(v_reason) > 500 THEN
    RAISE EXCEPTION 'El motivo de la anulación es obligatorio (entre 5 y 500 caracteres).' USING ERRCODE = '22023';
  END IF;

  -- 2. Venta bloqueada (misma llave que las devoluciones, 068)
  PERFORM pg_advisory_xact_lock(hashtext('sale_operation_' || p_sale_id::TEXT));
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND OR v_sale.company_id IS DISTINCT FROM v_company THEN
    RAISE EXCEPTION 'La venta no existe o no pertenece a su empresa.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_location_access(v_sale.location_id) THEN
    RAISE EXCEPTION 'Acceso denegado: no tiene acceso a la sede de la venta.' USING ERRCODE = '42501';
  END IF;
  IF v_sale.status::TEXT = 'CANCELLED' THEN
    RETURN jsonb_build_object('success', true, 'already_cancelled', true,
                              'sale_id', v_sale.id, 'sale_number', v_sale.sale_number);
  END IF;
  SELECT name INTO v_loc_name FROM public.locations WHERE id = v_sale.location_id;

  -- 3. Documentos que impiden la anulación
  SELECT COALESCE(full_number, prefix || '-' || number::TEXT) AS doc, dian_status::TEXT AS dian_status INTO v_inv
  FROM public.electronic_invoices
  WHERE sale_id = v_sale.id AND document_type = 'INVOICE' AND dian_status::TEXT <> 'REJECTED'
  ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'La venta % tiene la factura electrónica % (estado DIAN: %). No se anula: registre una nota crédito sobre la factura.',
      v_sale.sale_number, v_inv.doc, v_inv.dian_status USING ERRCODE = '55000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.returns
             WHERE source_document_type = 'SALE' AND source_document_id = v_sale.id AND status <> 'CANCELLED') THEN
    RAISE EXCEPTION 'La venta % tiene devoluciones registradas: no se puede anular.', v_sale.sale_number USING ERRCODE = '55000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.remissions WHERE sale_id = v_sale.id AND status::TEXT <> 'CANCELLED') THEN
    RAISE EXCEPTION 'La venta % tiene remisiones activas: anúlelas antes de anular la venta.', v_sale.sale_number USING ERRCODE = '55000';
  END IF;

  -- 4. Pagos a revertir (ventas antiguas sin detalle de pagos: solo efectivo o crédito)
  SELECT EXISTS (SELECT 1 FROM public.sale_payments WHERE sale_id = v_sale.id) INTO v_has_payments;
  IF v_has_payments THEN
    SELECT COALESCE(SUM(amount) FILTER (WHERE payment_method = 'CASH'), 0),
           COALESCE(SUM(amount) FILTER (WHERE payment_method = 'CREDIT'), 0),
           COALESCE(SUM(amount) FILTER (WHERE bank_account_id IS NOT NULL), 0)
    INTO v_cash, v_credit, v_bank_total
    FROM public.sale_payments WHERE sale_id = v_sale.id;
  ELSIF v_sale.payment_method::TEXT = 'CASH' THEN
    v_cash := v_sale.total_amount;
  ELSIF v_sale.payment_method::TEXT = 'CREDIT' THEN
    v_credit := v_sale.total_amount;
  ELSE
    RAISE EXCEPTION 'La venta % (%) no tiene el detalle de sus pagos bancarios: no se puede reversar automáticamente.',
      v_sale.sale_number, v_sale.payment_method USING ERRCODE = '55000';
  END IF;

  IF v_credit > 0 AND COALESCE(v_sale.paid_amount, 0) > 0 THEN
    RAISE EXCEPTION 'La venta a crédito % ya tiene abonos por %. Anule primero los abonos en Cartera.',
      v_sale.sale_number, v_sale.paid_amount USING ERRCODE = '55000';
  END IF;

  -- 5. Efectivo: sale de una caja abierta (ver encabezado)
  IF v_cash > 0 THEN
    IF NOT (public.is_admin() OR public.has_permission('pos.cash_register')) THEN
      RAISE EXCEPTION 'Acceso denegado: devolver efectivo requiere el permiso pos.cash_register.' USING ERRCODE = '42501';
    END IF;

    -- Sesión donde entró el efectivo (los textos de ingreso terminan en " <número de venta>")
    SELECT cm.session_id INTO v_orig_session
    FROM public.cash_movements cm
    WHERE cm.type = 'SALE_CASH'
      AND RIGHT(cm.reason, LENGTH(v_sale.sale_number) + 1) = ' ' || v_sale.sale_number
      AND (cm.company_id = v_company OR cm.company_id IS NULL)
    ORDER BY cm.created_at DESC
    LIMIT 1;
    v_orig_session := COALESCE(v_orig_session, v_sale.cash_session_id);

    IF v_orig_session IS NOT NULL THEN
      SELECT cs.id INTO v_cash_session_id
      FROM public.cash_sessions cs
      WHERE cs.id = v_orig_session AND cs.company_id = v_company AND cs.status = 'OPEN'
        AND (cs.user_id = v_caller OR public.is_admin());
    END IF;
    IF v_cash_session_id IS NULL THEN
      SELECT cs.id INTO v_cash_session_id
      FROM public.cash_sessions cs
      LEFT JOIN public.cash_registers cr ON cr.id = cs.cash_register_id
      WHERE cs.company_id = v_company
        AND cs.user_id = v_caller
        AND cs.status = 'OPEN'
        AND COALESCE(cs.location_id, cr.location_id) = v_sale.location_id
        AND (v_user.assigned_cash_register_id IS NULL OR cs.cash_register_id = v_user.assigned_cash_register_id)
      ORDER BY cs.opening_time DESC
      LIMIT 1;
    END IF;
    IF v_cash_session_id IS NULL THEN
      RAISE EXCEPTION 'La venta % recibió % en efectivo y la caja donde entró ya no está abierta. Para devolver el efectivo abra su caja en la sede "%" y repita la anulación.',
        v_sale.sale_number, v_cash, COALESCE(v_loc_name, 'de la venta') USING ERRCODE = '55001';
    END IF;

    -- Misma llave y bloqueo que los movimientos manuales de caja (046)
    PERFORM pg_advisory_xact_lock(hashtext('cash_session_' || v_cash_session_id::TEXT));
    SELECT id, opening_float, status INTO v_cs FROM public.cash_sessions WHERE id = v_cash_session_id FOR UPDATE;
    IF v_cs.status <> 'OPEN' THEN
      RAISE EXCEPTION 'La sesión de caja se cerró durante la anulación. Intente de nuevo.' USING ERRCODE = '55001';
    END IF;
    SELECT COALESCE(v_cs.opening_float, 0)
           + COALESCE(SUM(amount) FILTER (WHERE type IN ('CASH_IN', 'SALE_CASH')), 0)
           - COALESCE(SUM(amount) FILTER (WHERE type = 'CASH_OUT'), 0)
    INTO v_session_cash
    FROM public.cash_movements WHERE session_id = v_cash_session_id;
    IF v_session_cash < v_cash THEN
      RAISE EXCEPTION 'La caja no tiene efectivo suficiente para devolver % (disponible: %).', v_cash, v_session_cash
        USING ERRCODE = '55000';
    END IF;

    INSERT INTO public.cash_movements (company_id, session_id, type, amount, reason, authorized_by_user_id, created_at)
    VALUES (v_company, v_cash_session_id, 'CASH_OUT', v_cash,
            'Devolución efectivo por anulación venta ' || v_sale.sale_number || ': ' || LEFT(v_reason, 300),
            v_caller, NOW());
  END IF;

  -- 6. Bancos: movimiento inverso (DEBIT) por cuenta
  FOR v_bank IN
    SELECT sp.bank_account_id, SUM(sp.amount) AS amount
    FROM public.sale_payments sp
    WHERE sp.sale_id = v_sale.id AND sp.bank_account_id IS NOT NULL
    GROUP BY sp.bank_account_id
    ORDER BY sp.bank_account_id
  LOOP
    PERFORM pg_advisory_xact_lock(hashtext('bank_account_' || v_bank.bank_account_id::TEXT));
    SELECT id, bank_name, account_number, current_balance INTO v_bank_acc
    FROM public.bank_accounts WHERE id = v_bank.bank_account_id FOR UPDATE;
    IF v_bank_acc.current_balance < v_bank.amount THEN
      RAISE EXCEPTION 'La cuenta % *% no tiene saldo suficiente para reversar % (saldo: %).',
        v_bank_acc.bank_name, RIGHT(v_bank_acc.account_number, 4), v_bank.amount, v_bank_acc.current_balance
        USING ERRCODE = '55000';
    END IF;
    UPDATE public.bank_accounts
    SET current_balance = current_balance - v_bank.amount, updated_at = NOW()
    WHERE id = v_bank.bank_account_id
    RETURNING current_balance INTO v_bank_balance;

    INSERT INTO public.bank_movements (
      company_id, location_id, bank_account_id, movement_number, movement_date, movement_type,
      amount, balance_after, concept, reference, is_reconciled, created_by_user_id, created_at, updated_at
    ) VALUES (
      v_company, v_sale.location_id, v_bank.bank_account_id,
      public.fn_next_treasury_consecutive(v_company, 'BANK_MOV'), v_today, 'DEBIT',
      v_bank.amount, v_bank_balance,
      'Reverso por anulación venta ' || v_sale.sale_number || ': ' || LEFT(v_reason, 300),
      LEFT(v_sale.sale_number, 80), false, v_caller, NOW(), NOW()
    );
  END LOOP;

  -- 7. Cartera del cliente
  IF v_credit > 0 THEN
    SELECT current_balance INTO v_prev_balance FROM public.customers WHERE id = v_sale.customer_id FOR UPDATE;
    UPDATE public.customers
    SET current_balance = GREATEST(COALESCE(current_balance, 0) - v_credit, 0), updated_at = NOW()
    WHERE id = v_sale.customer_id;
  END IF;

  -- 8. Stock: reingreso por producto al costo con que salió (process_inventory_movement actualiza stock_levels)
  FOR v_item IN
    SELECT si.product_id, SUM(si.quantity) AS quantity, ROUND(SUM(si.quantity * si.unit_cost), 2) AS total_cost
    FROM public.sale_items si
    WHERE si.sale_id = v_sale.id
    GROUP BY si.product_id
    ORDER BY si.product_id
  LOOP
    SELECT quantity INTO v_prev_stock
    FROM public.stock_levels
    WHERE product_id = v_item.product_id AND location_id = v_sale.location_id
    FOR UPDATE;
    v_prev_stock := COALESCE(v_prev_stock, 0);

    INSERT INTO public.inventory_movements (
      company_id, product_id, location_id, movement_type, quantity_in, quantity_out,
      previous_stock, new_stock, unit_cost, total_cost, document_type, document_reference,
      reason, user_id, created_at
    ) VALUES (
      v_company, v_item.product_id, v_sale.location_id, 'POSITIVE_ADJUSTMENT', v_item.quantity, 0,
      v_prev_stock, v_prev_stock + v_item.quantity,
      CASE WHEN v_item.quantity > 0 THEN ROUND(v_item.total_cost / v_item.quantity, 2) ELSE 0 END,
      v_item.total_cost, 'REVERSION', v_sale.sale_number,
      'Anulación venta ' || v_sale.sale_number || ': ' || LEFT(v_reason, 300), v_caller, NOW()
    );
    v_units := v_units + v_item.quantity;
  END LOOP;

  -- 9. Asiento: reversión de cada comprobante contabilizado de la venta (periodo de hoy abierto)
  IF EXISTS (SELECT 1 FROM public.accounting_entries
             WHERE company_id = v_company AND document_type = 'SALE'
               AND document_reference = v_sale.sale_number AND status = 'POSTED') THEN
    IF EXISTS (SELECT 1 FROM public.accounting_periods
               WHERE company_id = v_company AND period_code = TO_CHAR(v_today, 'YYYY-MM') AND status = 'CLOSED') THEN
      RAISE EXCEPTION 'El periodo contable % está CERRADO: no se puede registrar la reversión de la venta.',
        TO_CHAR(v_today, 'YYYY-MM') USING ERRCODE = '22023';
    END IF;
    FOR v_entry IN
      SELECT id FROM public.accounting_entries
      WHERE company_id = v_company AND document_type = 'SALE'
        AND document_reference = v_sale.sale_number AND status = 'POSTED'
      ORDER BY created_at
    LOOP
      v_rev := public.fn_reverse_accounting_entry_internal(
        v_entry.id, 'Anulación venta ' || v_sale.sale_number || ': ' || v_reason, v_company);
      v_reversals := v_reversals || jsonb_build_object(
        'original_entry_number', v_rev->>'original_entry_number',
        'reversal_entry_number', v_rev->>'reversal_entry_number');
    END LOOP;
  END IF;

  -- 10. Estado de la venta
  UPDATE public.sales
  SET status = 'CANCELLED'::sale_status, cancelled_at = NOW(), cancellation_reason = v_reason, updated_at = NOW()
  WHERE id = v_sale.id;

  -- 11. Auditoría
  INSERT INTO public.audit_logs (company_id, user_id, user_name, action, module, entity_name, entity_id,
                                 location_id, previous_value, new_value, created_at)
  VALUES (v_company, v_caller, COALESCE(v_user.full_name, 'Usuario'), 'SALE_CANCELLED', 'SALES', 'sales',
          v_sale.id::TEXT, v_sale.location_id,
          jsonb_build_object('status', v_sale.status::TEXT, 'total_amount', v_sale.total_amount,
                             'payment_method', v_sale.payment_method::TEXT,
                             'customer_balance', v_prev_balance),
          jsonb_build_object('status', 'CANCELLED', 'reason', v_reason, 'sale_number', v_sale.sale_number,
                             'reversed_units', v_units, 'cash_refunded', v_cash, 'cash_session_id', v_cash_session_id,
                             'bank_reversed', v_bank_total, 'credit_reversed', v_credit,
                             'accounting_reversals', v_reversals),
          NOW());

  RETURN jsonb_build_object(
    'success', true,
    'already_cancelled', false,
    'sale_id', v_sale.id,
    'sale_number', v_sale.sale_number,
    'reversed_units', v_units,
    'cash_refunded', v_cash,
    'cash_session_id', v_cash_session_id,
    'bank_reversed', v_bank_total,
    'credit_reversed', v_credit,
    'accounting_reversals', v_reversals);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_cancel_sale(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_cancel_sale(UUID, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 8. ESCRITURA DIRECTA CERRADA EN sales Y sale_items
-- ------------------------------------------------------------------------------
-- Las ventas y sus líneas solo las crean las funciones del servidor (SECURITY DEFINER, cuyo
-- current_user es el dueño de la función). Se retiran las políticas INSERT de 014 y el privilegio
-- INSERT; además un trigger lo impide aunque una política o un GRANT se vuelvan a crear.
DROP POLICY IF EXISTS "Tenant isolation insert sales" ON public.sales;
DROP POLICY IF EXISTS "Tenant isolation insert sale_items" ON public.sale_items;
REVOKE INSERT ON public.sales FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.sale_items FROM anon, authenticated;

-- Campos que solo cambia el servidor. authenticated conserva UPDATE (política de 014 con
-- sales.cancel) solo para campos descriptivos como notes.
CREATE OR REPLACE FUNCTION public.fn_guard_sales_server_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Dentro de una función SECURITY DEFINER current_user es su dueño; la API llega como anon/authenticated.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Las ventas solo se registran desde el servidor (Ventas, POS o conversión de documentos).'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.total_amount IS DISTINCT FROM OLD.total_amount
     OR NEW.subtotal_amount IS DISTINCT FROM OLD.subtotal_amount
     OR NEW.tax_amount IS DISTINCT FROM OLD.tax_amount
     OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
     OR NEW.total_cost_amount IS DISTINCT FROM OLD.total_cost_amount
     OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
     OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
     OR NEW.paid_amount IS DISTINCT FROM OLD.paid_amount
     OR NEW.payment_terms IS DISTINCT FROM OLD.payment_terms
     OR NEW.due_date IS DISTINCT FROM OLD.due_date
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.location_id IS DISTINCT FROM OLD.location_id
     OR NEW.seller_user_id IS DISTINCT FROM OLD.seller_user_id
     OR NEW.cash_session_id IS DISTINCT FROM OLD.cash_session_id
     OR NEW.sale_number IS DISTINCT FROM OLD.sale_number
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
     OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason THEN
    RAISE EXCEPTION 'Los importes, el cliente, los pagos y el estado de la venta % solo los cambia el servidor (cobro, devolución o anulación).',
      OLD.sale_number USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_guard_sales_server_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_sales_server_fields ON public.sales;
CREATE TRIGGER trg_guard_sales_server_fields
  BEFORE INSERT OR UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_sales_server_fields();

CREATE OR REPLACE FUNCTION public.fn_guard_sale_items_server_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Las líneas de una venta solo las registra el servidor.' USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_guard_sale_items_server_only() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_sale_items_server_only ON public.sale_items;
CREATE TRIGGER trg_guard_sale_items_server_only
  BEFORE INSERT OR UPDATE OR DELETE ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_sale_items_server_only();

COMMIT;
