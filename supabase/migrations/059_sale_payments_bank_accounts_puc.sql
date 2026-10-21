-- ==============================================================================
-- MIGRACIÓN 059: PAGOS DE VENTA POR CUENTA BANCARIA EXACTA → PUC
-- SUPER MÁS ERP/POS
-- ==============================================================================
--
-- Problema que resuelve:
--   La causación de ventas (048) enviaba todo pago bancario a '1110' genérico, sin saber
--   cuál de las cuentas corrientes o de ahorro recibió el dinero, y nadie la invocaba.
--
-- Qué hace:
--   1. Estructura PUC estándar de cuentas de ahorro (1120 / 112005) si no existe, bajo el mismo
--      padre que tenga '1110'. No crea subcuentas auxiliares bancarias.
--   2. accounting_default_accounts: cuentas contables por propósito (caja, cartera, ingreso,
--      IVA, costo, inventario) configurables por empresa, con validación del grupo PUC por propósito.
--      Nada de códigos PUC en el código. (La función que siembra empresas nuevas vive en 060.)
--   3. sale_payments: cada pago de una venta con su medio y su cuenta bancaria destino.
--      Pago mixto = varias líneas. Inmutable.
--   4. fn_set_bank_account_ledger(): asigna a cada cuenta bancaria su subcuenta PUC auxiliar,
--      validando corriente→1110, ahorros→1120, caja→1105 y que no se repita entre cuentas activas.
--   5. Consecutivo contable sin carreras y cierre de fn_create_accounting_entry al navegador
--      (los asientos manuales entran por fn_create_manual_accounting_entry con accounting.post).
--   6. fn_cause_sale_accounting(): reescrita. Débito a la cuenta exacta de cada pago,
--      idempotente (no duplica asientos), cuadra siempre con descuentos, con control de acceso.
--   7. fn_execute_pos_sale_with_payments(): venta POS + pagos + asiento en UNA transacción,
--      con número de venta generado por el servidor y clave de idempotencia (sales.idempotency_key).
--   8. fn_register_sale_payments(): lo mismo para ventas creadas desde el módulo Ventas.
--
-- No modifica fn_execute_pos_sale (035) ni borra datos. Se puede re-ejecutar.
-- ==============================================================================

BEGIN;

-- Si una tabla está bloqueada por otra sesión, se falla rápido en vez de esperar (y bloquear a otros).
SET LOCAL lock_timeout = '5s';

-- ------------------------------------------------------------------------------
-- 1. PUC ESTÁNDAR: CUENTAS DE AHORRO (Decreto 2650/1993)
-- ------------------------------------------------------------------------------
-- '1120' cuelga del mismo padre que '1110' (si '1110' no tiene padre, queda sin padre).
INSERT INTO public.accounting_accounts (code, name, account_class, level, parent_id, nature, requires_third_party, is_active)
SELECT '1120', 'Cuentas de Ahorro', 1, 3, (SELECT parent_id FROM public.accounting_accounts WHERE code = '1110'), 'DEBIT', false, true
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.accounting_accounts (code, name, account_class, level, parent_id, nature, requires_third_party, is_active)
SELECT '112005', 'Bancos (Cuentas de Ahorro)', 1, 4, (SELECT id FROM public.accounting_accounts WHERE code = '1120'), 'DEBIT', false, true
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. CUENTAS CONTABLES POR PROPÓSITO (configurables por empresa)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_default_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  purpose VARCHAR(40) NOT NULL,
  accounting_account_id UUID NOT NULL REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT,
  updated_by_user_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_accounting_default_accounts UNIQUE (company_id, purpose),
  CONSTRAINT chk_accounting_default_accounts_purpose CHECK (purpose IN (
    'CASH',             -- Efectivo recibido en caja (1105xx)
    'CUSTOMER_CREDIT',  -- Ventas a crédito / cartera (1305xx)
    'SALES_INCOME',     -- Ingreso por ventas (4135xx)
    'VAT_GENERATED',    -- IVA generado (2408xx)
    'COST_OF_SALES',    -- Costo de ventas (6135xx)
    'INVENTORY'         -- Mercancías (1435xx)
  ))
);

ALTER TABLE public.accounting_default_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant select accounting_default_accounts" ON public.accounting_default_accounts;
CREATE POLICY "Tenant select accounting_default_accounts" ON public.accounting_default_accounts
  FOR SELECT TO authenticated
  USING (company_id = get_auth_company_id());

DROP POLICY IF EXISTS "Tenant manage accounting_default_accounts" ON public.accounting_default_accounts;
CREATE POLICY "Tenant manage accounting_default_accounts" ON public.accounting_default_accounts
  FOR ALL TO authenticated
  USING (company_id = get_auth_company_id() AND (is_admin() OR has_permission('accounting.post')))
  WITH CHECK (company_id = get_auth_company_id() AND (is_admin() OR has_permission('accounting.post')));

-- Cada propósito solo admite cuentas de su grupo PUC (funciona con códigos con punto: '110505.01').
-- Incluye los propósitos de notas crédito/débito que agrega la migración 060, para que re-ejecutar
-- esta migración no deje una versión que los rechace.
CREATE OR REPLACE FUNCTION public.fn_validate_default_account_purpose()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_acc RECORD;
  v_prefix VARCHAR(4);
BEGIN
  v_prefix := CASE NEW.purpose
    WHEN 'CASH' THEN '1105'
    WHEN 'CUSTOMER_CREDIT' THEN '1305'
    WHEN 'SALES_INCOME' THEN '41'
    WHEN 'VAT_GENERATED' THEN '2408'
    WHEN 'COST_OF_SALES' THEN '61'
    WHEN 'INVENTORY' THEN '14'
    WHEN 'SALES_RETURNS' THEN '4175'
    WHEN 'FINANCIAL_INCOME' THEN '42'
    ELSE NULL END;
  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'Propósito contable sin regla de validación: %.', NEW.purpose USING ERRCODE = '22023';
  END IF;

  SELECT code, name, is_active INTO v_acc FROM public.accounting_accounts WHERE id = NEW.accounting_account_id;
  IF NOT FOUND OR v_acc.is_active = false THEN
    RAISE EXCEPTION 'La cuenta contable para "%" no existe o está inactiva.', NEW.purpose USING ERRCODE = '23503';
  END IF;

  -- El ingreso por ventas (41) no puede ser la cuenta de devoluciones (4175), que es de naturaleza débito.
  IF v_acc.code NOT LIKE v_prefix || '%' OR (NEW.purpose = 'SALES_INCOME' AND v_acc.code LIKE '4175%') THEN
    RAISE EXCEPTION 'La cuenta % % no corresponde al propósito "%" (se espera una cuenta del grupo %).',
      v_acc.code, v_acc.name, NEW.purpose, v_prefix USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_default_account_purpose ON public.accounting_default_accounts;
CREATE TRIGGER trg_validate_default_account_purpose
  BEFORE INSERT OR UPDATE ON public.accounting_default_accounts
  FOR EACH ROW EXECUTE FUNCTION public.fn_validate_default_account_purpose();

-- Valores iniciales: exactamente las cuentas que la causación usaba hasta hoy (048),
-- para no cambiar el comportamiento. El contador puede cambiarlas a auxiliares.
INSERT INTO public.accounting_default_accounts (company_id, purpose, accounting_account_id)
SELECT c.id, x.purpose, a.id
FROM public.companies c
CROSS JOIN (VALUES
  ('CASH', '110505'),
  ('CUSTOMER_CREDIT', '130505'),
  ('SALES_INCOME', '4135'),
  ('VAT_GENERATED', '2408'),
  ('COST_OF_SALES', '6135'),
  ('INVENTORY', '1435')
) AS x(purpose, code)
JOIN public.accounting_accounts a ON a.code = x.code AND a.is_active = true
ON CONFLICT (company_id, purpose) DO NOTHING;

-- Las empresas creadas después reciben sus cuentas por defecto mediante
-- fn_seed_default_accounts_for_company(), definida (versión final) en la migración 060.

-- ------------------------------------------------------------------------------
-- 3. PAGOS DE VENTA (una línea por medio de pago y cuenta destino)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
  payment_method payment_method_type NOT NULL,
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE RESTRICT,
  reference VARCHAR(100),
  created_by_user_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_sale_payments_bank_required CHECK (
    (payment_method IN ('BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD') AND bank_account_id IS NOT NULL)
    OR (payment_method IN ('CASH', 'CREDIT') AND bank_account_id IS NULL)
  ),
  CONSTRAINT chk_sale_payments_not_mixed CHECK (payment_method <> 'MIXED')
);

CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON public.sale_payments (sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_bank ON public.sale_payments (bank_account_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_company ON public.sale_payments (company_id);

ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant select sale_payments" ON public.sale_payments;
CREATE POLICY "Tenant select sale_payments" ON public.sale_payments
  FOR SELECT TO authenticated
  USING (company_id = get_auth_company_id() AND (is_admin() OR has_permission('sales.read') OR has_permission('accounting.read')));
-- Sin políticas de INSERT/UPDATE/DELETE: solo se escriben mediante las funciones de esta migración.

CREATE OR REPLACE FUNCTION public.fn_prevent_sale_payment_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'Los pagos de una venta son inmutables. Use una devolución o nota crédito.' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_sale_payment_mutation ON public.sale_payments;
CREATE TRIGGER trg_prevent_sale_payment_mutation
  BEFORE UPDATE OR DELETE ON public.sale_payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_sale_payment_mutation();

-- ------------------------------------------------------------------------------
-- 4. ASIGNAR SUBCUENTA PUC A UNA CUENTA BANCARIA
-- ------------------------------------------------------------------------------
-- Regla única (la usan la función de asignación y el trigger): la cuenta contable debe ser
-- auxiliar (sin subcuentas), activa, de activo (clase 1) y naturaleza débito, y del grupo que
-- corresponde al tipo: CORRIENTE → 1110, AHORROS → 1120, CAJA_EFECTIVO → 1105.
-- Funciona con códigos con punto ('111005.01'). Devuelve el código de la cuenta.
CREATE OR REPLACE FUNCTION public.fn_assert_bank_ledger_account(
  p_account_type VARCHAR,
  p_accounting_account_id UUID
)
RETURNS VARCHAR
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_acc RECORD;
  v_expected_prefix VARCHAR(4);
BEGIN
  v_expected_prefix := CASE UPPER(p_account_type)
    WHEN 'CORRIENTE' THEN '1110'
    WHEN 'AHORROS' THEN '1120'
    WHEN 'AHORRO' THEN '1120'
    WHEN 'CAJA_EFECTIVO' THEN '1105'
    ELSE NULL END;
  IF v_expected_prefix IS NULL THEN
    RAISE EXCEPTION 'Tipo de cuenta bancaria no reconocido: %.', p_account_type USING ERRCODE = '22023';
  END IF;

  SELECT id, code, name, account_class, nature, is_active INTO v_acc
  FROM public.accounting_accounts WHERE id = p_accounting_account_id;
  IF NOT FOUND OR v_acc.is_active = false THEN
    RAISE EXCEPTION 'La cuenta contable no existe o está inactiva.' USING ERRCODE = 'P0002';
  END IF;

  IF v_acc.account_class <> 1 OR v_acc.nature <> 'DEBIT' THEN
    RAISE EXCEPTION 'La cuenta % % no es una cuenta de activo de naturaleza débito.', v_acc.code, v_acc.name
      USING ERRCODE = '22023';
  END IF;

  IF LEFT(v_acc.code, 4) <> v_expected_prefix OR LENGTH(v_acc.code) <= 4 THEN
    RAISE EXCEPTION 'Una cuenta % debe ir a una subcuenta auxiliar del grupo %. Cuenta elegida: % %.',
      p_account_type, v_expected_prefix, v_acc.code, v_acc.name USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.accounting_accounts c WHERE c.parent_id = v_acc.id) THEN
    RAISE EXCEPTION 'La cuenta % % tiene subcuentas: seleccione la auxiliar (último nivel) de esa cuenta bancaria.',
      v_acc.code, v_acc.name USING ERRCODE = '22023';
  END IF;

  RETURN v_acc.code;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_assert_bank_ledger_account(VARCHAR, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_assert_bank_ledger_account(VARCHAR, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_set_bank_account_ledger(
  p_bank_account_id UUID,
  p_accounting_account_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_bank RECORD;
  v_acc RECORD;
  v_conflict VARCHAR(200);
BEGIN
  SELECT * INTO v_bank FROM public.bank_accounts WHERE id = p_bank_account_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuenta bancaria no encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF v_caller IS NOT NULL THEN
    IF public.get_auth_company_id() IS DISTINCT FROM v_bank.company_id THEN
      RAISE EXCEPTION 'Acceso denegado: la cuenta bancaria no pertenece a su empresa.' USING ERRCODE = '42501';
    END IF;
    IF NOT (public.is_admin() OR public.has_permission('treasury.manage')) THEN
      RAISE EXCEPTION 'Acceso denegado: requiere ADMIN o treasury.manage.' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT public.fn_is_trusted_server_context() THEN
    RAISE EXCEPTION 'Acceso denegado.' USING ERRCODE = '28000';
  END IF;

  PERFORM public.fn_assert_bank_ledger_account(v_bank.account_type, p_accounting_account_id);
  SELECT code, name INTO v_acc FROM public.accounting_accounts WHERE id = p_accounting_account_id;

  SELECT bank_name || ' ' || RIGHT(account_number, 4) INTO v_conflict
  FROM public.bank_accounts
  WHERE company_id = v_bank.company_id AND is_active = true
    AND accounting_account_id = p_accounting_account_id AND id <> p_bank_account_id
  LIMIT 1;
  IF v_conflict IS NOT NULL THEN
    RAISE EXCEPTION 'La subcuenta % ya está asignada a la cuenta bancaria %. Cada cuenta bancaria necesita su propia subcuenta.',
      v_acc.code, v_conflict USING ERRCODE = '23505';
  END IF;

  UPDATE public.bank_accounts
  SET accounting_account_id = p_accounting_account_id,
      updated_by_user_id = COALESCE(v_caller, updated_by_user_id),
      updated_at = NOW()
  WHERE id = p_bank_account_id;

  INSERT INTO public.audit_logs (company_id, user_id, user_name, action, module, entity_name, entity_id, previous_value, new_value, created_at)
  VALUES (v_bank.company_id, v_caller, COALESCE((SELECT full_name FROM public.users WHERE id = v_caller), 'Sistema'),
    'BANK_ACCOUNT_LEDGER_SET', 'TREASURY', 'bank_accounts', p_bank_account_id::TEXT,
    jsonb_build_object('accounting_account_id', v_bank.accounting_account_id),
    jsonb_build_object('accounting_account_id', p_accounting_account_id, 'code', v_acc.code), NOW());

  RETURN jsonb_build_object('success', true, 'bank_account_id', p_bank_account_id,
    'accounting_account_id', p_accounting_account_id, 'code', v_acc.code, 'name', v_acc.name);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_set_bank_account_ledger(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_set_bank_account_ledger(UUID, UUID) TO authenticated, service_role;

-- La misma regla se aplica aunque la cuenta contable se cambie por otra vía (UPDATE directo).
CREATE OR REPLACE FUNCTION public.fn_validate_bank_account_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_code VARCHAR(30);
BEGIN
  IF NEW.accounting_account_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.accounting_account_id IS NOT DISTINCT FROM OLD.accounting_account_id
     AND NEW.account_type IS NOT DISTINCT FROM OLD.account_type
     AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active THEN
    RETURN NEW;
  END IF;

  v_code := public.fn_assert_bank_ledger_account(NEW.account_type, NEW.accounting_account_id);

  IF NEW.is_active AND EXISTS (
    SELECT 1 FROM public.bank_accounts b
    WHERE b.company_id = NEW.company_id AND b.is_active = true
      AND b.accounting_account_id = NEW.accounting_account_id AND b.id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'La subcuenta % ya está asignada a otra cuenta bancaria activa.', v_code USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_bank_account_ledger ON public.bank_accounts;
CREATE TRIGGER trg_validate_bank_account_ledger
  BEFORE INSERT OR UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.fn_validate_bank_account_ledger();

-- Respaldo del trigger ante escrituras concurrentes: una subcuenta por cuenta bancaria activa.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.bank_accounts
    WHERE is_active = true AND accounting_account_id IS NOT NULL
    GROUP BY company_id, accounting_account_id HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'Hay cuentas bancarias activas que comparten subcuenta PUC. No se creó uq_bank_accounts_active_ledger; corríjalas en Tesorería.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_accounts_active_ledger
      ON public.bank_accounts (company_id, accounting_account_id)
      WHERE is_active = true AND accounting_account_id IS NOT NULL;
  END IF;
END $$;

-- Lista de cuentas destino para el cajero/vendedor: solo banco, tipo y últimos 4 dígitos (sin saldos).
-- Las cuentas tipo CAJA_EFECTIVO no reciben transferencias ni tarjetas: no se listan.
CREATE OR REPLACE FUNCTION public.fn_list_payment_bank_accounts()
RETURNS TABLE (id UUID, bank_name VARCHAR, account_type VARCHAR, last4 TEXT, has_ledger BOOLEAN, ledger_code VARCHAR)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT b.id, b.bank_name, b.account_type, RIGHT(b.account_number, 4), b.accounting_account_id IS NOT NULL, a.code
  FROM public.bank_accounts b
  LEFT JOIN public.accounting_accounts a ON a.id = b.accounting_account_id
  WHERE b.company_id = public.get_auth_company_id()
    AND b.is_active = true
    AND UPPER(b.account_type) <> 'CAJA_EFECTIVO'
    AND (public.is_admin() OR public.has_permission('pos.access') OR public.has_permission('sales.create') OR public.has_permission('treasury.read'))
  ORDER BY b.account_type, b.bank_name, RIGHT(b.account_number, 4);
$$;

REVOKE ALL ON FUNCTION public.fn_list_payment_bank_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_list_payment_bank_accounts() TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4b. CONSECUTIVO CONTABLE SIN CARRERAS (reemplaza la versión de 048, mismo formato)
-- ------------------------------------------------------------------------------
-- La versión anterior calculaba MAX+1 sin bloqueo: dos ventas simultáneas chocaban y una se perdía.
-- Versión final (incluye NCR/NDB de las notas crédito/débito de 060): la migración 060 no la redefine.
CREATE OR REPLACE FUNCTION public.fn_next_accounting_consecutive(
    p_company_id UUID,
    p_doc_type VARCHAR DEFAULT 'AST'
)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_year VARCHAR(4);
    v_prefix VARCHAR(60);
    v_next_val BIGINT;
    v_clean_type VARCHAR(10);
BEGIN
    v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
    v_clean_type := CASE
        WHEN UPPER(p_doc_type) = 'SUPPLIER_PAYMENT' THEN 'PAG'
        WHEN UPPER(p_doc_type) = 'CUSTOMER_PAYMENT' THEN 'REC'
        WHEN UPPER(p_doc_type) = 'SALE' THEN 'VTA'
        WHEN UPPER(p_doc_type) = 'PURCHASE' THEN 'COM'
        WHEN UPPER(p_doc_type) = 'REVERSAL' THEN 'REV'
        WHEN UPPER(p_doc_type) = 'CREDIT_NOTE' THEN 'NCR'
        WHEN UPPER(p_doc_type) = 'DEBIT_NOTE' THEN 'NDB'
        WHEN LENGTH(p_doc_type) > 6 THEN SUBSTRING(UPPER(p_doc_type) FROM 1 FOR 6)
        ELSE UPPER(p_doc_type)
    END;
    v_prefix := v_clean_type || '-' || v_year || '-';

    -- Serializa la asignación por empresa + prefijo hasta el fin de la transacción.
    PERFORM pg_advisory_xact_lock(hashtext('acc-consecutive:' || p_company_id::TEXT || ':' || v_prefix));

    SELECT COALESCE(MAX(
        CASE
            WHEN entry_number ~ ('^' || v_prefix || '[0-9]+$')
            THEN SUBSTRING(entry_number FROM LENGTH(v_prefix) + 1)::BIGINT
            ELSE 0
        END
    ), 0) + 1
    INTO v_next_val
    FROM public.accounting_entries
    WHERE company_id = p_company_id AND entry_number LIKE (v_prefix || '%');

    RETURN v_prefix || LPAD(v_next_val::TEXT, 6, '0');
END;
$$;

-- Un solo asiento contabilizado por venta (si los datos existentes lo permiten).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.accounting_entries
    WHERE document_type = 'SALE' AND status = 'POSTED'
    GROUP BY company_id, document_reference HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'Hay ventas con más de un asiento contabilizado (datos anteriores). No se creó uq_accounting_entries_one_posted_sale.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_accounting_entries_one_posted_sale
      ON public.accounting_entries (company_id, document_reference)
      WHERE document_type = 'SALE' AND status = 'POSTED';
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4c. ASIENTOS: EL NAVEGADOR YA NO LLAMA fn_create_accounting_entry DIRECTAMENTE
-- ------------------------------------------------------------------------------
-- fn_create_accounting_entry (todas sus sobrecargas, 048 y la de fecha de vencimiento) y el consecutivo
-- contable eran ejecutables por anon/authenticated: cualquiera podía crear asientos POSTED de cualquier
-- tipo (incluso p_company_id ajeno). Quedan solo para el servidor y las funciones SECURITY DEFINER
-- (causación de ventas, compras, pagos, notas). Los asientos manuales entran por el envoltorio de abajo.
--
-- Además, la base tenía DOS sobrecargas: la de 048 (8 parámetros) y una de 9 con p_due_date creada fuera
-- de las migraciones (más laxa: si no hallaba empresa tomaba la primera). Toda llamada sin p_due_date
-- era ambigua ("is not unique") y fallaba. Queda una sola versión: la de 048 + p_due_date, sin el
-- respaldo que asentaba en una cuenta "parecida" cuando el código PUC no existía.
DROP FUNCTION IF EXISTS public.fn_create_accounting_entry(DATE, TEXT, VARCHAR, VARCHAR, JSONB, UUID, BOOLEAN, UUID, DATE);
DROP FUNCTION IF EXISTS public.fn_create_accounting_entry(DATE, TEXT, VARCHAR, VARCHAR, JSONB, UUID, BOOLEAN, UUID);

CREATE FUNCTION public.fn_create_accounting_entry(
    p_date DATE,
    p_concept TEXT,
    p_document_type VARCHAR,
    p_document_reference VARCHAR,
    p_lines JSONB,
    p_location_id UUID DEFAULT NULL,
    p_auto_post BOOLEAN DEFAULT TRUE,
    p_company_id UUID DEFAULT NULL,
    p_due_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_company_id UUID;
    v_user_id UUID;
    v_user_name VARCHAR(150);
    v_entry_id UUID;
    v_entry_number VARCHAR(50);
    v_line RECORD;
    v_account_id UUID;
    v_debit_sum NUMERIC(15,2) := 0.00;
    v_credit_sum NUMERIC(15,2) := 0.00;
    v_line_debit NUMERIC(15,2);
    v_line_credit NUMERIC(15,2);
    v_period_code VARCHAR(7);
    v_period_status VARCHAR(20);
BEGIN
    v_company_id := COALESCE(p_company_id, public.get_auth_company_id());
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Contexto multiempresa no detectado para registrar el asiento contable.';
    END IF;

    v_user_id := auth.uid();
    SELECT COALESCE(full_name, email, 'Sistema') INTO v_user_name
    FROM public.users WHERE id = v_user_id;
    IF v_user_name IS NULL THEN v_user_name := 'Sistema ERP'; END IF;

    v_period_code := TO_CHAR(p_date, 'YYYY-MM');
    SELECT status INTO v_period_status
    FROM public.accounting_periods
    WHERE company_id = v_company_id AND period_code = v_period_code;

    IF v_period_status = 'CLOSED' THEN
        RAISE EXCEPTION 'El periodo contable % se encuentra CERRADO. No es posible asentar comprobantes en meses clausurados.', v_period_code;
    END IF;

    IF p_lines IS NULL OR jsonb_array_length(p_lines) < 2 THEN
        RAISE EXCEPTION 'Un asiento contable requiere al menos 2 líneas para cumplir el principio de partida doble.';
    END IF;

    FOR v_line IN SELECT * FROM jsonb_to_recordset(p_lines) AS x(
        debit_amount NUMERIC,
        credit_amount NUMERIC
    ) LOOP
        v_line_debit := COALESCE(v_line.debit_amount, 0.00);
        v_line_credit := COALESCE(v_line.credit_amount, 0.00);

        IF v_line_debit < 0 OR v_line_credit < 0 THEN
            RAISE EXCEPTION 'Los valores de débito y crédito deben ser positivos o cero.';
        END IF;
        IF v_line_debit = 0 AND v_line_credit = 0 THEN
            RAISE EXCEPTION 'Cada línea contable debe tener un valor mayor a cero en Débito o Crédito.';
        END IF;

        v_debit_sum := v_debit_sum + v_line_debit;
        v_credit_sum := v_credit_sum + v_line_credit;
    END LOOP;

    IF ROUND(ABS(v_debit_sum - v_credit_sum), 2) > 0.01 THEN
        RAISE EXCEPTION 'Partida doble descuadrada: Total Débitos ($%) no es igual a Total Créditos ($%).',
            v_debit_sum, v_credit_sum;
    END IF;

    v_entry_number := public.fn_next_accounting_consecutive(v_company_id, COALESCE(p_document_type, 'AST'));
    v_entry_id := gen_random_uuid();

    INSERT INTO public.accounting_entries (
        id, company_id, location_id, entry_number, date, due_date, concept,
        document_type, document_reference, status, created_by_user_id, created_at, updated_at
    ) VALUES (
        v_entry_id, v_company_id, p_location_id, v_entry_number, p_date, p_due_date, p_concept,
        p_document_type, p_document_reference, 'DRAFT', v_user_id, NOW(), NOW()
    );

    FOR v_line IN SELECT * FROM jsonb_to_recordset(p_lines) AS x(
        account_id UUID,
        account_code VARCHAR,
        debit_amount NUMERIC,
        credit_amount NUMERIC,
        third_party_doc VARCHAR,
        third_party_name VARCHAR,
        cost_center_id UUID,
        description TEXT
    ) LOOP
        -- La cuenta debe existir tal cual en el PUC: nunca se asienta en una cuenta "parecida".
        v_account_id := v_line.account_id;
        IF v_account_id IS NULL AND v_line.account_code IS NOT NULL THEN
            SELECT id INTO v_account_id
            FROM public.accounting_accounts
            WHERE code = v_line.account_code AND is_active = true
            LIMIT 1;
        END IF;

        IF v_account_id IS NULL THEN
            RAISE EXCEPTION 'Cuenta contable con código "%" o ID no encontrada (o inactiva) en el catálogo PUC.',
                COALESCE(v_line.account_code, v_line.account_id::TEXT);
        END IF;

        INSERT INTO public.accounting_entry_lines (
            id, entry_id, account_id, third_party_doc, third_party_name,
            cost_center_id, description, debit_amount, credit_amount, due_date, created_at
        ) VALUES (
            gen_random_uuid(), v_entry_id, v_account_id, v_line.third_party_doc, v_line.third_party_name,
            v_line.cost_center_id, COALESCE(v_line.description, p_concept),
            COALESCE(v_line.debit_amount, 0.00), COALESCE(v_line.credit_amount, 0.00), p_due_date, NOW()
        );
    END LOOP;

    IF p_auto_post THEN
        UPDATE public.accounting_entries
        SET status = 'POSTED', posted_at = NOW(), updated_at = NOW()
        WHERE id = v_entry_id;
    END IF;

    INSERT INTO public.audit_logs (
        company_id, user_id, user_name, action, module, entity_name, entity_id, location_id, new_value, created_at
    ) VALUES (
        v_company_id, v_user_id, v_user_name, 'ACCOUNTING_ENTRY_CREATED', 'ACCOUNTING', 'accounting_entries',
        v_entry_id, p_location_id,
        jsonb_build_object(
            'entry_id', v_entry_id,
            'entry_number', v_entry_number,
            'date', p_date,
            'due_date', p_due_date,
            'concept', p_concept,
            'document_type', p_document_type,
            'total_debit', v_debit_sum,
            'total_credit', v_credit_sum,
            'status', CASE WHEN p_auto_post THEN 'POSTED' ELSE 'DRAFT' END
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'entry_id', v_entry_id,
        'entry_number', v_entry_number,
        'status', CASE WHEN p_auto_post THEN 'POSTED' ELSE 'DRAFT' END,
        'total_debit', v_debit_sum,
        'total_credit', v_credit_sum,
        'date', p_date,
        'due_date', p_due_date
    );
END;
$$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('fn_create_accounting_entry', 'fn_next_accounting_consecutive')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, public', r.sig);
  END LOOP;
END $$;

-- Asiento manual desde Contabilidad: exige accounting.post, la empresa sale del usuario autenticado
-- (no del cliente) y solo crea comprobantes de tipo MANUAL. Mismos parámetros que usaba el navegador
-- con fn_create_accounting_entry (sin p_company_id).
CREATE OR REPLACE FUNCTION public.fn_create_manual_accounting_entry(
  p_date DATE,
  p_concept TEXT,
  p_document_type VARCHAR,
  p_document_reference VARCHAR,
  p_lines JSONB,
  p_location_id UUID DEFAULT NULL,
  p_auto_post BOOLEAN DEFAULT TRUE,
  p_due_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_company UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado: usuario no autenticado.' USING ERRCODE = '28000';
  END IF;
  v_company := public.get_auth_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado: el usuario no tiene empresa asignada.' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.is_admin() OR public.has_permission('accounting.post')) THEN
    RAISE EXCEPTION 'Acceso denegado: requiere el permiso accounting.post.' USING ERRCODE = '42501';
  END IF;
  IF UPPER(COALESCE(p_document_type, '')) <> 'MANUAL' THEN
    RAISE EXCEPTION 'Desde Contabilidad solo se registran comprobantes manuales (MANUAL). Recibido: %.', p_document_type
      USING ERRCODE = '22023';
  END IF;
  IF p_location_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.locations WHERE id = p_location_id AND company_id = v_company
  ) THEN
    RAISE EXCEPTION 'La sede indicada no pertenece a su empresa.' USING ERRCODE = '42501';
  END IF;

  -- La sobrecarga con fecha de vencimiento toma la empresa de get_auth_company_id() (mismo JWT).
  RETURN public.fn_create_accounting_entry(
    p_date := p_date,
    p_concept := p_concept,
    p_document_type := 'MANUAL',
    p_document_reference := p_document_reference,
    p_lines := p_lines,
    p_location_id := p_location_id,
    p_auto_post := p_auto_post,
    p_due_date := p_due_date
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_create_manual_accounting_entry(DATE, TEXT, VARCHAR, VARCHAR, JSONB, UUID, BOOLEAN, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_create_manual_accounting_entry(DATE, TEXT, VARCHAR, VARCHAR, JSONB, UUID, BOOLEAN, DATE) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. REGISTRO DE PAGOS (interno, sin control de acceso: lo hacen los envoltorios)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_register_sale_payments_internal(
  p_sale_id UUID,
  p_payments JSONB,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_sale RECORD;
  v_pay JSONB;
  v_method VARCHAR(30);
  v_methods TEXT[];
  v_sale_method TEXT;
  v_amount NUMERIC(15,2);
  v_bank_id UUID;
  v_bank RECORD;
  v_specified NUMERIC(15,2) := 0;
  v_open_count INT := 0;
  v_sum NUMERIC(15,2) := 0;
  v_count INT := 0;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta % no encontrada.', p_sale_id USING ERRCODE = 'P0002';
  END IF;

  IF v_sale.status::TEXT IN ('CANCELLED', 'RETURNED') THEN
    RAISE EXCEPTION 'La venta % está % y no admite registro de pagos.', v_sale.sale_number, v_sale.status
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (SELECT 1 FROM public.sale_payments WHERE sale_id = p_sale_id) THEN
    RAISE EXCEPTION 'Los pagos de la venta % ya fueron registrados.', v_sale.sale_number USING ERRCODE = '23505';
  END IF;

  IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) = 0 THEN
    RAISE EXCEPTION 'Debe indicar al menos un medio de pago.' USING ERRCODE = '23502';
  END IF;

  -- Los medios deben coincidir con el medio de la venta: CREDIT solo en ventas a crédito, un medio
  -- único igual al de la venta, y MIXED con al menos dos medios distintos.
  SELECT ARRAY(SELECT DISTINCT UPPER(TRIM(e->>'method')) FROM jsonb_array_elements(p_payments) e ORDER BY 1)
  INTO v_methods;
  v_sale_method := v_sale.payment_method::TEXT;
  IF 'CREDIT' = ANY(v_methods) AND v_sale_method <> 'CREDIT' THEN
    RAISE EXCEPTION 'La venta % no es a crédito (%): no puede registrar pagos CREDIT.', v_sale.sale_number, v_sale_method
      USING ERRCODE = '22023';
  END IF;
  IF v_sale_method = 'MIXED' THEN
    IF COALESCE(array_length(v_methods, 1), 0) < 2 THEN
      RAISE EXCEPTION 'La venta % es de pago mixto: registre al menos dos medios de pago distintos.', v_sale.sale_number
        USING ERRCODE = '22023';
    END IF;
  ELSIF v_methods IS DISTINCT FROM ARRAY[v_sale_method] THEN
    RAISE EXCEPTION 'Los medios de pago (%) no coinciden con el medio de la venta % (%).',
      array_to_string(v_methods, ', '), v_sale.sale_number, v_sale_method USING ERRCODE = '22023';
  END IF;

  -- Un (solo) pago puede venir sin valor: toma el saldo que falta para el total calculado por el servidor.
  FOR v_pay IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    IF v_pay->'amount' IS NULL OR jsonb_typeof(v_pay->'amount') = 'null' THEN
      v_open_count := v_open_count + 1;
    ELSE
      v_specified := v_specified + ROUND((v_pay->>'amount')::NUMERIC, 2);
    END IF;
  END LOOP;
  IF v_open_count > 1 THEN
    RAISE EXCEPTION 'Solo un medio de pago puede tomar el saldo restante.' USING ERRCODE = '22023';
  END IF;

  FOR v_pay IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_method := UPPER(TRIM(v_pay->>'method'));
    IF v_pay->'amount' IS NULL OR jsonb_typeof(v_pay->'amount') = 'null' THEN
      v_amount := v_sale.total_amount - v_specified;
    ELSE
      v_amount := ROUND((v_pay->>'amount')::NUMERIC, 2);
    END IF;
    v_bank_id := NULLIF(v_pay->>'bank_account_id', '')::UUID;

    IF v_method NOT IN ('CASH', 'BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'CREDIT') THEN
      RAISE EXCEPTION 'Medio de pago no válido: %.', v_method USING ERRCODE = '22023';
    END IF;
    IF v_amount IS NULL OR v_amount <= 0 THEN
      RAISE EXCEPTION 'Cada pago debe tener un valor mayor a cero (revise el valor en efectivo del pago mixto).' USING ERRCODE = '22003';
    END IF;

    IF v_method IN ('BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD') THEN
      IF v_bank_id IS NULL THEN
        RAISE EXCEPTION 'El pago por % requiere seleccionar la cuenta bancaria que recibe el dinero.', v_method USING ERRCODE = '23502';
      END IF;
      SELECT * INTO v_bank FROM public.bank_accounts WHERE id = v_bank_id;
      IF NOT FOUND OR v_bank.company_id <> v_sale.company_id OR v_bank.is_active = false THEN
        RAISE EXCEPTION 'La cuenta bancaria seleccionada no existe, está inactiva o no es de la empresa.' USING ERRCODE = '23503';
      END IF;
      IF UPPER(v_bank.account_type) = 'CAJA_EFECTIVO' THEN
        RAISE EXCEPTION 'Una transferencia o tarjeta no puede ir a una cuenta de caja en efectivo (%).', v_bank.bank_name
          USING ERRCODE = '22023';
      END IF;
      IF v_bank.accounting_account_id IS NULL THEN
        RAISE EXCEPTION 'La cuenta bancaria % *% no tiene subcuenta PUC asignada. Configúrela en Tesorería.',
          v_bank.bank_name, RIGHT(v_bank.account_number, 4) USING ERRCODE = '23502';
      END IF;
    ELSE
      v_bank_id := NULL;
    END IF;

    INSERT INTO public.sale_payments (company_id, sale_id, payment_method, amount, bank_account_id, reference, created_by_user_id)
    VALUES (v_sale.company_id, p_sale_id, v_method::payment_method_type, v_amount, v_bank_id,
            NULLIF(TRIM(v_pay->>'reference'), ''), p_user_id);

    v_sum := v_sum + v_amount;
    v_count := v_count + 1;
  END LOOP;

  IF v_sum <> v_sale.total_amount THEN
    RAISE EXCEPTION 'La suma de los pagos (%) no coincide con el total de la venta (%).', v_sum, v_sale.total_amount
      USING ERRCODE = '22000';
  END IF;

  RETURN jsonb_build_object('success', true, 'payments', v_count, 'total', v_sum);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_register_sale_payments_internal(UUID, JSONB, UUID) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 6. CAUSACIÓN CONTABLE DE LA VENTA (interna + envoltorio con control de acceso)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_get_default_account(p_company_id UUID, p_purpose VARCHAR)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT d.accounting_account_id INTO v_id
  FROM public.accounting_default_accounts d
  JOIN public.accounting_accounts a ON a.id = d.accounting_account_id AND a.is_active = true
  WHERE d.company_id = p_company_id AND d.purpose = p_purpose;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Falta configurar la cuenta contable para "%" (tabla accounting_default_accounts).', p_purpose
      USING ERRCODE = 'P0002';
  END IF;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_get_default_account(UUID, VARCHAR) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_cause_sale_accounting_internal(p_sale_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_sale RECORD;
  v_existing RECORD;
  v_lines JSONB := '[]'::JSONB;
  v_customer_doc VARCHAR(50);
  v_customer_name VARCHAR(200);
  v_pay RECORD;
  v_has_payments BOOLEAN;
  v_income NUMERIC(15,2);
  v_cost_total NUMERIC(15,2);
  v_debit_account UUID;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta % no encontrada para causación contable.', p_sale_id USING ERRCODE = 'P0002';
  END IF;

  -- Idempotencia: un solo asiento contabilizado por venta.
  SELECT id, entry_number INTO v_existing
  FROM public.accounting_entries
  WHERE company_id = v_sale.company_id AND document_type = 'SALE'
    AND document_reference = v_sale.sale_number AND status = 'POSTED'
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'already_caused', true,
      'entry_id', v_existing.id, 'entry_number', v_existing.entry_number);
  END IF;

  SELECT document_number, COALESCE(company_name, TRIM(CONCAT(first_name, ' ', last_name)))
  INTO v_customer_doc, v_customer_name
  FROM public.customers WHERE id = v_sale.customer_id;

  -- DÉBITOS: una línea por cuenta destino real (caja, cada cuenta bancaria, cartera).
  SELECT EXISTS (SELECT 1 FROM public.sale_payments WHERE sale_id = p_sale_id) INTO v_has_payments;

  IF v_has_payments THEN
    FOR v_pay IN
      SELECT
        CASE
          WHEN sp.payment_method = 'CASH' THEN public.fn_get_default_account(v_sale.company_id, 'CASH')
          WHEN sp.payment_method = 'CREDIT' THEN public.fn_get_default_account(v_sale.company_id, 'CUSTOMER_CREDIT')
          ELSE ba.accounting_account_id
        END AS account_id,
        STRING_AGG(DISTINCT CASE WHEN ba.id IS NOT NULL THEN ba.bank_name || ' *' || RIGHT(ba.account_number, 4)
                                 WHEN sp.payment_method = 'CASH' THEN 'Efectivo' ELSE 'Crédito' END, ', ') AS label,
        SUM(sp.amount) AS amount
      FROM public.sale_payments sp
      LEFT JOIN public.bank_accounts ba ON ba.id = sp.bank_account_id
      WHERE sp.sale_id = p_sale_id
      GROUP BY 1
    LOOP
      IF v_pay.account_id IS NULL THEN
        RAISE EXCEPTION 'Un pago de la venta % llegó a una cuenta bancaria sin subcuenta PUC.', v_sale.sale_number
          USING ERRCODE = 'P0002';
      END IF;
      v_lines := v_lines || jsonb_build_object(
        'account_id', v_pay.account_id,
        'debit_amount', v_pay.amount,
        'credit_amount', 0,
        'third_party_doc', v_customer_doc,
        'third_party_name', v_customer_name,
        'description', 'Cobro venta ' || v_sale.sale_number || ' - ' || v_pay.label);
    END LOOP;
  ELSE
    -- Ventas antiguas sin detalle de pagos: solo se pueden causar si fueron efectivo o crédito.
    IF v_sale.payment_method::TEXT = 'CASH' THEN
      v_debit_account := public.fn_get_default_account(v_sale.company_id, 'CASH');
    ELSIF v_sale.payment_method::TEXT = 'CREDIT' THEN
      v_debit_account := public.fn_get_default_account(v_sale.company_id, 'CUSTOMER_CREDIT');
    ELSE
      RAISE EXCEPTION 'La venta % (%) no tiene registrada la cuenta bancaria que recibió el pago. Registre los pagos antes de causarla.',
        v_sale.sale_number, v_sale.payment_method USING ERRCODE = 'P0002';
    END IF;
    v_lines := v_lines || jsonb_build_object(
      'account_id', v_debit_account, 'debit_amount', v_sale.total_amount, 'credit_amount', 0,
      'third_party_doc', v_customer_doc, 'third_party_name', v_customer_name,
      'description', 'Cobro venta ' || v_sale.sale_number);
  END IF;

  -- CRÉDITOS: ingreso neto de descuentos (total - IVA) e IVA generado. Así siempre cuadra.
  v_income := v_sale.total_amount - COALESCE(v_sale.tax_amount, 0);
  v_lines := v_lines || jsonb_build_object(
    'account_id', public.fn_get_default_account(v_sale.company_id, 'SALES_INCOME'),
    'debit_amount', 0, 'credit_amount', v_income,
    'third_party_doc', v_customer_doc, 'third_party_name', v_customer_name,
    'description', 'Ingreso venta ' || v_sale.sale_number);

  IF COALESCE(v_sale.tax_amount, 0) > 0 THEN
    v_lines := v_lines || jsonb_build_object(
      'account_id', public.fn_get_default_account(v_sale.company_id, 'VAT_GENERATED'),
      'debit_amount', 0, 'credit_amount', v_sale.tax_amount,
      'third_party_doc', v_customer_doc, 'third_party_name', v_customer_name,
      'description', 'IVA generado venta ' || v_sale.sale_number);
  END IF;

  -- COSTO DE VENTAS / INVENTARIO
  SELECT COALESCE(ROUND(SUM(quantity * unit_cost), 2), 0) INTO v_cost_total
  FROM public.sale_items WHERE sale_id = p_sale_id;

  IF v_cost_total > 0 THEN
    v_lines := v_lines || jsonb_build_object(
      'account_id', public.fn_get_default_account(v_sale.company_id, 'COST_OF_SALES'),
      'debit_amount', v_cost_total, 'credit_amount', 0,
      'description', 'Costo de ventas ' || v_sale.sale_number);
    v_lines := v_lines || jsonb_build_object(
      'account_id', public.fn_get_default_account(v_sale.company_id, 'INVENTORY'),
      'debit_amount', 0, 'credit_amount', v_cost_total,
      'description', 'Salida de inventario venta ' || v_sale.sale_number);
  END IF;

  RETURN public.fn_create_accounting_entry(
    p_date := (v_sale.created_at AT TIME ZONE 'America/Bogota')::DATE,
    p_concept := 'Causación automática venta ' || v_sale.sale_number || ' - ' || COALESCE(v_customer_name, 'Consumidor Final'),
    p_document_type := 'SALE',
    p_document_reference := v_sale.sale_number,
    p_lines := v_lines,
    p_location_id := v_sale.location_id,
    p_auto_post := true,
    p_company_id := v_sale.company_id
  ) || jsonb_build_object('already_caused', false);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_cause_sale_accounting_internal(UUID) FROM PUBLIC, anon, authenticated;

-- Envoltorio público (re-causación manual desde Contabilidad): con control de acceso.
CREATE OR REPLACE FUNCTION public.fn_cause_sale_accounting(p_sale_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_company UUID;
BEGIN
  SELECT company_id INTO v_company FROM public.sales WHERE id = p_sale_id;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Venta % no encontrada.', p_sale_id USING ERRCODE = 'P0002';
  END IF;
  IF auth.uid() IS NOT NULL THEN
    IF public.get_auth_company_id() IS DISTINCT FROM v_company THEN
      RAISE EXCEPTION 'Acceso denegado: la venta no pertenece a su empresa.' USING ERRCODE = '42501';
    END IF;
    IF NOT (public.is_admin() OR public.has_permission('accounting.post')) THEN
      RAISE EXCEPTION 'Acceso denegado: requiere accounting.post.' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT public.fn_is_trusted_server_context() THEN
    RAISE EXCEPTION 'Acceso denegado.' USING ERRCODE = '28000';
  END IF;
  RETURN public.fn_cause_sale_accounting_internal(p_sale_id);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_cause_sale_accounting(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_cause_sale_accounting(UUID) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 7. VENTA POS + PAGOS + ASIENTO EN UNA SOLA TRANSACCIÓN
-- ------------------------------------------------------------------------------
-- Idempotencia de la venta POS: el navegador genera una clave (UUID) por intento de cobro y la
-- repite en los reintentos (doble clic, timeout). La misma clave nunca crea una segunda venta.
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS idempotency_key UUID;
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_company_idempotency_key
  ON public.sales (company_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Número de venta generado por el servidor: VTA-AAAA-000001 por empresa y año (hora Bogotá).
-- Serializado con bloqueo transaccional; los números antiguos (VTA-AAAA-1234, 4 dígitos al azar)
-- no chocan porque estos siempre llevan 6 dígitos. sales.sale_number es único global: si otra
-- empresa ya tiene el número, se salta al siguiente.
CREATE OR REPLACE FUNCTION public.fn_next_sale_number(p_company_id UUID)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_prefix VARCHAR(20);
  v_next BIGINT;
  v_number VARCHAR(50);
BEGIN
  v_prefix := 'VTA-' || TO_CHAR(NOW() AT TIME ZONE 'America/Bogota', 'YYYY') || '-';

  PERFORM pg_advisory_xact_lock(hashtext('sale-number:' || p_company_id::TEXT || ':' || v_prefix));

  SELECT COALESCE(MAX(SUBSTRING(sale_number FROM LENGTH(v_prefix) + 1)::BIGINT), 0) + 1
  INTO v_next
  FROM public.sales
  WHERE company_id = p_company_id AND sale_number ~ ('^' || v_prefix || '[0-9]{6,}$');

  LOOP
    v_number := v_prefix || LPAD(v_next::TEXT, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.sales WHERE sale_number = v_number);
    v_next := v_next + 1;
  END LOOP;

  RETURN v_number;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_next_sale_number(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_next_sale_number(UUID) TO service_role;

-- Firma anterior (recibía p_sale_number del navegador): se reemplaza por la que recibe la clave de idempotencia.
DROP FUNCTION IF EXISTS public.fn_execute_pos_sale_with_payments(UUID, UUID, UUID, UUID, UUID, VARCHAR, TEXT, JSONB, JSONB);

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
  v_cash NUMERIC(15,2);
  v_has_cash BOOLEAN;
  v_pay_result JSONB;
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

  -- 3. Pago mixto: el efectivo entra a la caja abierta (en pago único efectivo ya lo hizo fn_execute_pos_sale)
  IF v_method = 'MIXED' THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_cash FROM public.sale_payments
    WHERE sale_id = v_sale_id AND payment_method = 'CASH';
    IF v_cash > 0 THEN
      INSERT INTO public.cash_movements (session_id, type, amount, reason, authorized_by_user_id, created_at)
      VALUES (p_cash_session_id, 'SALE_CASH', v_cash, 'Ingreso efectivo (pago mixto) venta POS ' || v_sale_number,
              COALESCE(v_caller, p_seller_user_id), NOW());
    END IF;
  END IF;

  -- 4. Asiento contable en la misma transacción: si falla, no queda venta sin contabilidad.
  v_entry := public.fn_cause_sale_accounting_internal(v_sale_id);

  RETURN v_sale || jsonb_build_object(
    'idempotent_replay', false,
    'payment_method', v_method,
    'payments', v_pay_result,
    'accounting_entry_id', v_entry->>'entry_id',
    'accounting_entry_number', v_entry->>'entry_number');
END;
$$;

-- La venta POS solo entra por fn_execute_pos_sale_with_payments (pagos, cuenta bancaria, asiento y
-- restricción de tarjeta). La función anterior queda solo para uso interno (la llama este wrapper).
REVOKE EXECUTE ON FUNCTION public.fn_execute_pos_sale(UUID, UUID, UUID, UUID, UUID, VARCHAR, VARCHAR, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_execute_pos_sale_with_payments(UUID, UUID, UUID, UUID, UUID, UUID, TEXT, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_execute_pos_sale_with_payments(UUID, UUID, UUID, UUID, UUID, UUID, TEXT, JSONB, JSONB) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 8. PAGOS + ASIENTO PARA VENTAS DEL MÓDULO VENTAS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_register_sale_payments(p_sale_id UUID, p_payments JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_company UUID;
  v_seller UUID;
  v_pay JSONB;
  v_entry JSONB;
BEGIN
  SELECT company_id, seller_user_id INTO v_company, v_seller FROM public.sales WHERE id = p_sale_id;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Venta % no encontrada.', p_sale_id USING ERRCODE = 'P0002';
  END IF;
  IF auth.uid() IS NOT NULL THEN
    IF public.get_auth_company_id() IS DISTINCT FROM v_company THEN
      RAISE EXCEPTION 'Acceso denegado: la venta no pertenece a su empresa.' USING ERRCODE = '42501';
    END IF;
    IF NOT (public.is_admin() OR public.has_permission('sales.create')) THEN
      RAISE EXCEPTION 'Acceso denegado: requiere sales.create.' USING ERRCODE = '42501';
    END IF;
    -- Solo el vendedor de la venta (o un administrador) registra sus pagos.
    IF NOT public.is_admin() AND v_seller IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Acceso denegado: solo el vendedor de la venta o un administrador puede registrar sus pagos.'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NOT public.fn_is_trusted_server_context() THEN
    RAISE EXCEPTION 'Acceso denegado.' USING ERRCODE = '28000';
  END IF;

  -- Estado de la venta, pagos previos y coherencia con el medio de la venta: los valida la función interna.
  v_pay := public.fn_register_sale_payments_internal(p_sale_id, p_payments, auth.uid());
  v_entry := public.fn_cause_sale_accounting_internal(p_sale_id);

  RETURN jsonb_build_object('success', true, 'payments', v_pay,
    'accounting_entry_id', v_entry->>'entry_id', 'accounting_entry_number', v_entry->>'entry_number');
END;
$$;

REVOKE ALL ON FUNCTION public.fn_register_sale_payments(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_register_sale_payments(UUID, JSONB) TO authenticated, service_role;

COMMIT;
