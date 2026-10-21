-- ==============================================================================
-- MIGRACIÓN 067: CONTROL DE ACCESO EN LAS RPC CONTABLES HEREDADAS DE 048
-- SUPER MÁS ERP/POS
-- ==============================================================================
--
-- Problema que resuelve:
--   fn_reverse_accounting_entry, fn_cause_payment_accounting y fn_cause_receipt_accounting (048)
--   son SECURITY DEFINER sin control de acceso ni search_path:
--   - la reversión acepta p_company_id del cliente: cualquier usuario autenticado podía reversar
--     asientos de otra empresa (064 solo les quitó anon);
--   - pago y recaudo no validan empresa ni estado, no son idempotentes (cada llamada crea otro
--     asiento) y asientan en '2205', '1110' y '1305' fijos, sin importar la cuenta que movió el dinero.
--
-- Qué hace (mismo patrón que ventas en 059 y compras en 064: interna + envoltorio guardado):
--   1. fn_reverse_accounting_entry_internal: copia de 048 con empresa obligatoria, fecha de
--      Bogotá, vencimiento de las líneas y sin reversar una reversión. Solo service_role.
--      fn_reverse_accounting_entry (misma firma que usa la app): la empresa es la del usuario,
--      exige accounting.post o admin, asiento propio y POSTED, motivo y periodo abierto.
--   2. fn_cause_payment_accounting_internal / fn_cause_receipt_accounting_internal: solo pagos PAID
--      y recaudos no anulados, idempotentes (índices parciales), débito/crédito a la subcuenta PUC
--      real de la cuenta bancaria o caja (bank_accounts.accounting_account_id, como ventas en 059) y
--      contrapartida SUPPLIERS_PAYABLE / CUSTOMER_CREDIT de accounting_default_accounts.
--      Envoltorios con empresa del usuario y permiso admin, accounting.post o treasury.create.
--
-- Requiere 064 (tipos de comprobante, SUPPLIERS_PAYABLE). No borra datos. Se puede re-ejecutar.
-- ==============================================================================

BEGIN;

-- Si una tabla está bloqueada por otra sesión, se falla rápido en vez de esperar (y bloquear a otros).
SET LOCAL lock_timeout = '5s';

-- ------------------------------------------------------------------------------
-- 1. REVERSIÓN CONTABLE
-- ------------------------------------------------------------------------------
-- Interna: la empresa es obligatoria y el asiento debe ser suyo. Sin control de acceso (lo hace
-- el envoltorio). Cuerpo de 048 con cambios mínimos marcados.
CREATE OR REPLACE FUNCTION public.fn_reverse_accounting_entry_internal(
    p_entry_id UUID,
    p_reason TEXT,
    p_company_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_user_id UUID;
    v_user_name VARCHAR(150);
    v_orig RECORD;
    v_reversal_id UUID;
    v_reversal_number VARCHAR(50);
    v_line RECORD;
    v_total_amount NUMERIC(15,2) := 0.00;
    v_reversal_date DATE := (NOW() AT TIME ZONE 'America/Bogota')::DATE;  -- 048 usaba CURRENT_DATE (UTC)
BEGIN
    IF p_company_id IS NULL THEN
        RAISE EXCEPTION 'La reversión requiere la empresa del asiento.' USING ERRCODE = '22023';
    END IF;

    v_user_id := auth.uid();
    SELECT COALESCE(full_name, email, 'Sistema') INTO v_user_name
    FROM public.users WHERE id = v_user_id;
    IF v_user_name IS NULL THEN v_user_name := 'Sistema ERP'; END IF;

    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RAISE EXCEPTION 'Debe proporcionar una justificación obligatoria para la reversión contable.'
            USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_orig
    FROM public.accounting_entries
    WHERE id = p_entry_id AND company_id = p_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Comprobante contable no encontrado o no pertenece a la empresa.' USING ERRCODE = 'P0002';
    END IF;

    IF v_orig.status <> 'POSTED' THEN
        RAISE EXCEPTION 'Solo es posible anular/revertir comprobantes en estado POSTED (Estado actual: %).', v_orig.status
            USING ERRCODE = '22023';
    END IF;

    -- Una reversión no se reversa: se corrige con un asiento nuevo (evita cadenas de anulaciones).
    IF v_orig.document_type = 'REVERSAL' THEN
        RAISE EXCEPTION 'El comprobante % es una reversión y no se puede reversar; registre un asiento nuevo.',
            v_orig.entry_number USING ERRCODE = '22023';
    END IF;

    v_reversal_number := public.fn_next_accounting_consecutive(v_orig.company_id, 'REVERSAL');
    v_reversal_id := gen_random_uuid();

    -- Crear comprobante de reversión en DRAFT
    INSERT INTO public.accounting_entries (
        id, company_id, location_id, entry_number, date, concept,
        document_type, document_reference, voucher_type_code, status, created_by_user_id, created_at, updated_at
    ) VALUES (
        v_reversal_id, v_orig.company_id, v_orig.location_id, v_reversal_number, v_reversal_date,
        'Reversión de ' || v_orig.entry_number || ': ' || p_reason,
        'REVERSAL', v_orig.entry_number, 'RV', 'DRAFT', v_user_id, NOW(), NOW()
    );

    -- Invertir líneas: Débito pasa a Crédito, Crédito pasa a Débito
    FOR v_line IN
        SELECT * FROM public.accounting_entry_lines
        WHERE entry_id = p_entry_id
    LOOP
        INSERT INTO public.accounting_entry_lines (
            id, entry_id, account_id, third_party_doc, third_party_name, cost_center_id,
            description, debit_amount, credit_amount, due_date, created_at
        ) VALUES (
            gen_random_uuid(), v_reversal_id, v_line.account_id, v_line.third_party_doc, v_line.third_party_name,
            v_line.cost_center_id,
            'Reversión ' || v_orig.entry_number || ': ' || COALESCE(v_line.description, ''),
            v_line.credit_amount, -- Se invierte
            v_line.debit_amount,  -- Se invierte
            v_line.due_date,
            NOW()
        );
        v_total_amount := v_total_amount + v_line.debit_amount;
    END LOOP;

    -- Publicar comprobante de reversión
    UPDATE public.accounting_entries
    SET status = 'POSTED', posted_at = NOW(), updated_at = NOW()
    WHERE id = v_reversal_id;

    -- Marcar comprobante original como REVERSED
    UPDATE public.accounting_entries
    SET status = 'REVERSED', updated_at = NOW()
    WHERE id = p_entry_id;

    INSERT INTO public.audit_logs (
        company_id, user_id, user_name, action, module, entity_name, entity_id, location_id, new_value, created_at
    ) VALUES (
        v_orig.company_id, v_user_id, v_user_name, 'ACCOUNTING_ENTRY_REVERSED', 'ACCOUNTING', 'accounting_entries',
        p_entry_id, v_orig.location_id,
        jsonb_build_object(
            'original_entry_id', p_entry_id,
            'original_entry_number', v_orig.entry_number,
            'reversal_entry_id', v_reversal_id,
            'reversal_entry_number', v_reversal_number,
            'total_amount', v_total_amount,
            'reason', p_reason
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'original_entry_id', p_entry_id,
        'original_entry_number', v_orig.entry_number,
        'reversal_entry_id', v_reversal_id,
        'reversal_entry_number', v_reversal_number
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_reverse_accounting_entry_internal(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_reverse_accounting_entry_internal(UUID, TEXT, UUID) TO service_role;

-- Envoltorio público. Misma firma que 048 (la app llama con p_entry_id y p_reason; los scripts del
-- servidor pasan además p_company_id). Para un usuario autenticado la empresa SIEMPRE es la suya:
-- p_company_id solo se admite si coincide con ella.
CREATE OR REPLACE FUNCTION public.fn_reverse_accounting_entry(
    p_entry_id UUID,
    p_reason TEXT,
    p_company_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_company UUID;
    v_entry RECORD;
    v_period_code VARCHAR(7) := TO_CHAR((NOW() AT TIME ZONE 'America/Bogota')::DATE, 'YYYY-MM');
BEGIN
    IF p_reason IS NULL OR LENGTH(BTRIM(p_reason)) < 5 THEN
        RAISE EXCEPTION 'El motivo de la reversión es obligatorio (mínimo 5 caracteres).' USING ERRCODE = '22023';
    END IF;

    IF auth.uid() IS NOT NULL THEN
        v_company := public.get_auth_company_id();
        IF v_company IS NULL THEN
            RAISE EXCEPTION 'Acceso denegado: el usuario no tiene empresa asignada.' USING ERRCODE = '42501';
        END IF;
        IF p_company_id IS NOT NULL AND p_company_id IS DISTINCT FROM v_company THEN
            RAISE EXCEPTION 'Acceso denegado: no puede reversar comprobantes de otra empresa.' USING ERRCODE = '42501';
        END IF;
        IF NOT (public.is_admin() OR public.has_permission('accounting.post')) THEN
            RAISE EXCEPTION 'Acceso denegado: requiere el permiso accounting.post.' USING ERRCODE = '42501';
        END IF;
    ELSIF public.fn_is_trusted_server_context() THEN
        v_company := COALESCE(p_company_id, (SELECT company_id FROM public.accounting_entries WHERE id = p_entry_id));
    ELSE
        RAISE EXCEPTION 'Acceso denegado.' USING ERRCODE = '28000';
    END IF;

    -- Mismo mensaje si no existe o es de otra empresa: no se revela la existencia de asientos ajenos.
    SELECT company_id, status, entry_number INTO v_entry
    FROM public.accounting_entries WHERE id = p_entry_id;
    IF NOT FOUND OR v_entry.company_id IS DISTINCT FROM v_company THEN
        RAISE EXCEPTION 'Comprobante contable no encontrado o no pertenece a la empresa.' USING ERRCODE = 'P0002';
    END IF;
    IF v_entry.status <> 'POSTED' THEN
        RAISE EXCEPTION 'Solo se reversan comprobantes contabilizados (POSTED). % está en %.', v_entry.entry_number, v_entry.status
            USING ERRCODE = '22023';
    END IF;

    -- La reversión se fecha hoy (Bogotá): ese periodo debe estar abierto. El del original lo valida
    -- trg_check_entry_period_open (012) al marcarlo REVERSED.
    IF EXISTS (
        SELECT 1 FROM public.accounting_periods
        WHERE company_id = v_company AND period_code = v_period_code AND status = 'CLOSED'
    ) THEN
        RAISE EXCEPTION 'El periodo contable % está CERRADO: no se puede registrar la reversión.', v_period_code
            USING ERRCODE = '22023';
    END IF;

    RETURN public.fn_reverse_accounting_entry_internal(p_entry_id, BTRIM(p_reason), v_company);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_reverse_accounting_entry(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_reverse_accounting_entry(UUID, TEXT, UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. IDEMPOTENCIA DE PAGOS Y RECAUDOS (un asiento contabilizado por documento)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.accounting_entries
    WHERE document_type = 'SUPPLIER_PAYMENT' AND status = 'POSTED'
    GROUP BY company_id, document_reference HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'Hay pagos con más de un asiento contabilizado (datos anteriores). No se creó uq_accounting_entries_one_posted_supplier_payment.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_accounting_entries_one_posted_supplier_payment
      ON public.accounting_entries (company_id, document_reference)
      WHERE document_type = 'SUPPLIER_PAYMENT' AND status = 'POSTED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.accounting_entries
    WHERE document_type = 'CUSTOMER_PAYMENT' AND status = 'POSTED'
    GROUP BY company_id, document_reference HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'Hay recaudos con más de un asiento contabilizado (datos anteriores). No se creó uq_accounting_entries_one_posted_customer_payment.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_accounting_entries_one_posted_customer_payment
      ON public.accounting_entries (company_id, document_reference)
      WHERE document_type = 'CUSTOMER_PAYMENT' AND status = 'POSTED';
  END IF;
END $$;

-- Subcuenta PUC de una cuenta bancaria/caja de la empresa (la asigna fn_set_bank_account_ledger, 059).
CREATE OR REPLACE FUNCTION public.fn_bank_account_ledger_account(p_company_id UUID, p_bank_account_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_bank RECORD;
BEGIN
  SELECT ba.bank_name, ba.account_number, ba.accounting_account_id, a.is_active AS account_active
  INTO v_bank
  FROM public.bank_accounts ba
  LEFT JOIN public.accounting_accounts a ON a.id = ba.accounting_account_id
  WHERE ba.id = p_bank_account_id AND ba.company_id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La cuenta bancaria del documento no existe en la empresa.' USING ERRCODE = 'P0002';
  END IF;
  IF v_bank.accounting_account_id IS NULL OR v_bank.account_active IS NOT TRUE THEN
    RAISE EXCEPTION 'La cuenta % *% no tiene subcuenta PUC activa asignada (Tesorería > cuentas bancarias).',
      v_bank.bank_name, RIGHT(COALESCE(v_bank.account_number, ''), 4) USING ERRCODE = 'P0002';
  END IF;
  RETURN v_bank.accounting_account_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_bank_account_ledger_account(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_bank_account_ledger_account(UUID, UUID) TO service_role;

-- ------------------------------------------------------------------------------
-- 3. CAUSACIÓN DE PAGOS A PROVEEDORES (comprobante CE)
-- ------------------------------------------------------------------------------
-- Dr proveedores (SUPPLIERS_PAYABLE) / Cr subcuenta PUC de la cuenta bancaria o caja que pagó.
CREATE OR REPLACE FUNCTION public.fn_cause_payment_accounting_internal(p_payment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_pay RECORD;
  v_supp RECORD;
  v_existing RECORD;
  v_lines JSONB := '[]'::JSONB;
  v_res JSONB;
BEGIN
  SELECT * INTO v_pay FROM public.treasury_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pago de tesorería % no encontrado para causación.', p_payment_id USING ERRCODE = 'P0002';
  END IF;

  -- Idempotencia: un solo asiento contabilizado por pago.
  SELECT id, entry_number INTO v_existing
  FROM public.accounting_entries
  WHERE company_id = v_pay.company_id AND document_type = 'SUPPLIER_PAYMENT'
    AND document_reference = v_pay.payment_number AND status = 'POSTED'
  LIMIT 1;
  IF FOUND THEN
    IF v_pay.accounting_entry_id IS DISTINCT FROM v_existing.id THEN
      UPDATE public.treasury_payments SET accounting_entry_id = v_existing.id WHERE id = p_payment_id;
    END IF;
    RETURN jsonb_build_object('success', true, 'already_caused', true,
      'entry_id', v_existing.id, 'entry_number', v_existing.entry_number);
  END IF;

  IF UPPER(COALESCE(v_pay.status, '')) <> 'PAID' THEN
    RAISE EXCEPTION 'El pago % está en estado %: solo se causan pagos ejecutados (PAID).',
      v_pay.payment_number, v_pay.status USING ERRCODE = '22023';
  END IF;
  IF v_pay.supplier_id IS NULL THEN
    RAISE EXCEPTION 'El pago % no tiene proveedor: no se puede causar contra proveedores.', v_pay.payment_number
      USING ERRCODE = '22023';
  END IF;

  SELECT tax_id, name INTO v_supp
  FROM public.suppliers WHERE id = v_pay.supplier_id AND company_id = v_pay.company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El proveedor del pago % no existe en la empresa.', v_pay.payment_number USING ERRCODE = 'P0002';
  END IF;

  v_lines := v_lines || jsonb_build_object(
    'account_id', public.fn_get_default_account(v_pay.company_id, 'SUPPLIERS_PAYABLE'),
    'debit_amount', v_pay.amount, 'credit_amount', 0,
    'third_party_doc', v_supp.tax_id, 'third_party_name', v_supp.name,
    'description', 'Abono a proveedor ' || v_supp.name || ' pago ' || v_pay.payment_number);

  v_lines := v_lines || jsonb_build_object(
    'account_id', public.fn_bank_account_ledger_account(v_pay.company_id, v_pay.bank_account_id),
    'debit_amount', 0, 'credit_amount', v_pay.amount,
    'third_party_doc', v_supp.tax_id, 'third_party_name', v_supp.name,
    'description', 'Egreso pago ' || v_pay.payment_number || ' Ref: ' || COALESCE(v_pay.reference_number, '—'));

  v_res := public.fn_create_accounting_entry(
    p_date := v_pay.payment_date,
    p_concept := 'Pago a proveedor ' || v_supp.name || ' (Ref: ' || COALESCE(v_pay.reference_number, v_pay.payment_number) || ')',
    p_document_type := 'SUPPLIER_PAYMENT',
    p_document_reference := v_pay.payment_number,
    p_lines := v_lines,
    p_location_id := v_pay.location_id,
    p_auto_post := true,
    p_company_id := v_pay.company_id
  );

  UPDATE public.treasury_payments
  SET accounting_entry_id = (v_res->>'entry_id')::UUID
  WHERE id = p_payment_id;

  RETURN v_res || jsonb_build_object('already_caused', false);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_cause_payment_accounting_internal(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_cause_payment_accounting_internal(UUID) TO service_role;

-- Permiso: admin, accounting.post (contabilidad) o treasury.create (quien ejecuta pagos y recaudos,
-- igual que las políticas de tesorería de 019/023). La causación es determinista: no elige cuentas.
CREATE OR REPLACE FUNCTION public.fn_cause_payment_accounting(p_payment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_company UUID;
BEGIN
  SELECT company_id INTO v_company FROM public.treasury_payments WHERE id = p_payment_id;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Pago % no encontrado.', p_payment_id USING ERRCODE = 'P0002';
  END IF;
  IF auth.uid() IS NOT NULL THEN
    IF public.get_auth_company_id() IS DISTINCT FROM v_company THEN
      RAISE EXCEPTION 'Acceso denegado: el pago no pertenece a su empresa.' USING ERRCODE = '42501';
    END IF;
    IF NOT (public.is_admin() OR public.has_permission('accounting.post') OR public.has_permission('treasury.create')) THEN
      RAISE EXCEPTION 'Acceso denegado: requiere accounting.post o treasury.create.' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT public.fn_is_trusted_server_context() THEN
    RAISE EXCEPTION 'Acceso denegado.' USING ERRCODE = '28000';
  END IF;
  RETURN public.fn_cause_payment_accounting_internal(p_payment_id);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_cause_payment_accounting(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_cause_payment_accounting(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. CAUSACIÓN DE RECAUDOS DE CLIENTES (comprobante RC si entra a caja, CI si entra a banco)
-- ------------------------------------------------------------------------------
-- Dr subcuenta PUC de la cuenta bancaria o caja que recibió / Cr cartera (CUSTOMER_CREDIT).
CREATE OR REPLACE FUNCTION public.fn_cause_receipt_accounting_internal(p_receipt_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rec RECORD;
  v_cust_doc VARCHAR(50);
  v_cust_name VARCHAR(200);
  v_existing RECORD;
  v_lines JSONB := '[]'::JSONB;
  v_res JSONB;
BEGIN
  SELECT * INTO v_rec FROM public.treasury_receipts WHERE id = p_receipt_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recaudo de tesorería % no encontrado para causación.', p_receipt_id USING ERRCODE = 'P0002';
  END IF;

  -- Idempotencia: un solo asiento contabilizado por recaudo.
  SELECT id, entry_number INTO v_existing
  FROM public.accounting_entries
  WHERE company_id = v_rec.company_id AND document_type = 'CUSTOMER_PAYMENT'
    AND document_reference = v_rec.receipt_number AND status = 'POSTED'
  LIMIT 1;
  IF FOUND THEN
    IF v_rec.accounting_entry_id IS DISTINCT FROM v_existing.id THEN
      UPDATE public.treasury_receipts SET accounting_entry_id = v_existing.id WHERE id = p_receipt_id;
    END IF;
    RETURN jsonb_build_object('success', true, 'already_caused', true,
      'entry_id', v_existing.id, 'entry_number', v_existing.entry_number);
  END IF;

  IF UPPER(COALESCE(v_rec.status, '')) IN ('CANCELLED', 'CANCELADO', 'ANULADO') THEN
    RAISE EXCEPTION 'El recaudo % está anulado y no se causa.', v_rec.receipt_number USING ERRCODE = '22023';
  END IF;

  SELECT document_number, COALESCE(company_name, TRIM(CONCAT(first_name, ' ', last_name)))
  INTO v_cust_doc, v_cust_name
  FROM public.customers WHERE id = v_rec.customer_id AND company_id = v_rec.company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El cliente del recaudo % no existe en la empresa.', v_rec.receipt_number USING ERRCODE = 'P0002';
  END IF;

  v_lines := v_lines || jsonb_build_object(
    'account_id', public.fn_bank_account_ledger_account(v_rec.company_id, v_rec.bank_account_id),
    'debit_amount', v_rec.amount, 'credit_amount', 0,
    'third_party_doc', v_cust_doc, 'third_party_name', v_cust_name,
    'description', 'Ingreso recaudo ' || v_rec.receipt_number || ' Ref: ' || COALESCE(v_rec.reference_number, '—'));

  v_lines := v_lines || jsonb_build_object(
    'account_id', public.fn_get_default_account(v_rec.company_id, 'CUSTOMER_CREDIT'),
    'debit_amount', 0, 'credit_amount', v_rec.amount,
    'third_party_doc', v_cust_doc, 'third_party_name', v_cust_name,
    'description', 'Abono a cartera de ' || COALESCE(v_cust_name, 'cliente') || ' recibo ' || v_rec.receipt_number);

  v_res := public.fn_create_accounting_entry(
    p_date := v_rec.receipt_date,
    p_concept := 'Recaudo de cartera ' || COALESCE(v_cust_name, 'Cliente') || ' (Ref: ' || COALESCE(v_rec.reference_number, v_rec.receipt_number) || ')',
    p_document_type := 'CUSTOMER_PAYMENT',
    p_document_reference := v_rec.receipt_number,
    p_lines := v_lines,
    p_location_id := v_rec.location_id,
    p_auto_post := true,
    p_company_id := v_rec.company_id
  );

  UPDATE public.treasury_receipts
  SET accounting_entry_id = (v_res->>'entry_id')::UUID
  WHERE id = p_receipt_id;

  RETURN v_res || jsonb_build_object('already_caused', false);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_cause_receipt_accounting_internal(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_cause_receipt_accounting_internal(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_cause_receipt_accounting(p_receipt_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_company UUID;
BEGIN
  SELECT company_id INTO v_company FROM public.treasury_receipts WHERE id = p_receipt_id;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Recaudo % no encontrado.', p_receipt_id USING ERRCODE = 'P0002';
  END IF;
  IF auth.uid() IS NOT NULL THEN
    IF public.get_auth_company_id() IS DISTINCT FROM v_company THEN
      RAISE EXCEPTION 'Acceso denegado: el recaudo no pertenece a su empresa.' USING ERRCODE = '42501';
    END IF;
    IF NOT (public.is_admin() OR public.has_permission('accounting.post') OR public.has_permission('treasury.create')) THEN
      RAISE EXCEPTION 'Acceso denegado: requiere accounting.post o treasury.create.' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT public.fn_is_trusted_server_context() THEN
    RAISE EXCEPTION 'Acceso denegado.' USING ERRCODE = '28000';
  END IF;
  RETURN public.fn_cause_receipt_accounting_internal(p_receipt_id);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_cause_receipt_accounting(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_cause_receipt_accounting(UUID) TO authenticated, service_role;

COMMIT;
