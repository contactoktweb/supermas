-- =============================================================================
-- 091 — Venta a crédito en el POS
-- =============================================================================
-- Hasta ahora el POS rechazaba el medio CREDIT ("use el módulo Ventas"). Se habilita con las mismas
-- reglas del módulo Ventas (073/079):
--   - el crédito no se combina con otros medios;
--   - cliente identificado (no consumidor final), activo y con cupo aprobado (credit_limit > 0);
--   - el total calculado por el servidor no puede superar el cupo disponible (cliente bloqueado
--     FOR UPDATE para evitar carreras);
--   - la venta queda PENDIENTE, payment_terms CREDITO y vencimiento hoy + credit_days (30 si no tiene).
-- Lo demás ya lo resuelven las rutinas comunes: sale_payments CREDIT, saldo del cliente
-- (fn_apply_sale_payment_effects_internal) y asiento contra la cuenta CUSTOMER_CREDIT (13 05).
-- Las ventas de contado no cambian.
-- =============================================================================

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
  v_is_credit BOOLEAN;   -- 091
  v_cust RECORD;         -- 091
  v_total NUMERIC(15,2); -- 091
  c_default_credit_days CONSTANT INT := 30;
  c_final_consumer_doc CONSTANT TEXT := '222222222222';
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

  -- 091: venta a crédito en el POS. El crédito va solo (no se combina con otros medios) y exige un
  -- cliente identificado con cupo aprobado; el cupo lo asigna quien administra clientes.
  v_is_credit := EXISTS (SELECT 1 FROM jsonb_array_elements(v_payments) e WHERE e->>'method' = 'CREDIT');
  IF v_is_credit THEN
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_payments) e WHERE e->>'method' <> 'CREDIT') THEN
      RAISE EXCEPTION 'Una venta a crédito no se combina con otros medios de pago.' USING ERRCODE = '22023';
    END IF;
    IF p_customer_id IS NULL THEN
      RAISE EXCEPTION 'Seleccione el cliente: la venta a crédito no se puede hacer a consumidor final.' USING ERRCODE = '23502';
    END IF;
    SELECT id, company_id, is_active, document_number, credit_limit, current_balance, credit_days,
           COALESCE(NULLIF(COALESCE(company_name, TRIM(CONCAT(first_name, ' ', last_name))), ''), 'Cliente') AS display_name
    INTO v_cust FROM public.customers WHERE id = p_customer_id FOR UPDATE;
    IF NOT FOUND OR v_cust.company_id IS DISTINCT FROM p_company_id THEN
      RAISE EXCEPTION 'El cliente no existe o no pertenece a su empresa.' USING ERRCODE = '42501';
    END IF;
    IF v_cust.document_number = c_final_consumer_doc THEN
      RAISE EXCEPTION 'La venta a crédito no se puede hacer a consumidor final. Seleccione el cliente.' USING ERRCODE = '22023';
    END IF;
    IF v_cust.is_active IS NOT TRUE THEN
      RAISE EXCEPTION 'El cliente "%" está inactivo y no puede comprar a crédito.', v_cust.display_name USING ERRCODE = '55001';
    END IF;
    IF COALESCE(v_cust.credit_limit, 0) <= 0 THEN
      RAISE EXCEPTION 'El cliente "%" no tiene cupo de crédito aprobado.', v_cust.display_name USING ERRCODE = '22023';
    END IF;
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

  -- 091: la venta a crédito queda pendiente de pago, con vencimiento según el plazo del cliente.
  -- El cupo se valida con el total que calculó el servidor; si se excede, se revierte toda la venta.
  IF v_is_credit THEN
    SELECT total_amount INTO v_total FROM public.sales WHERE id = v_sale_id;
    IF COALESCE(v_cust.current_balance, 0) + v_total > v_cust.credit_limit THEN
      RAISE EXCEPTION 'La venta (%) supera el cupo de crédito de "%": cupo %, saldo actual %, disponible %.',
        v_total, v_cust.display_name, v_cust.credit_limit, COALESCE(v_cust.current_balance, 0),
        GREATEST(v_cust.credit_limit - COALESCE(v_cust.current_balance, 0), 0) USING ERRCODE = '22023';
    END IF;
    UPDATE public.sales
    SET paid_amount = 0,
        payment_status = 'PENDING',
        payment_terms = 'CREDITO',
        due_date = (NOW() AT TIME ZONE 'America/Bogota')::DATE
                   + CASE WHEN COALESCE(v_cust.credit_days, 0) > 0 THEN v_cust.credit_days ELSE c_default_credit_days END
    WHERE id = v_sale_id;
  END IF;

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
