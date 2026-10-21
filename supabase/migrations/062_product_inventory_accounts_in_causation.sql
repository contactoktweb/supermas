-- ==============================================================================
-- MIGRACIÓN 062: LA CUENTA PUC DEL PRODUCTO TIENE EFECTO CONTABLE
-- SUPER MÁS ERP/POS
-- ==============================================================================
--
-- Problema que resuelve:
--   El producto guarda su cuenta de inventario (products.accounting_account_id, 056), pero la
--   causación de ventas (059) y el reingreso por notas crédito con devolución (060) asentaban
--   siempre en las cuentas por defecto (1435 / 6135 / 4135). La cuenta del producto no movía nada.
--
-- Qué hace:
--   1. accounting_inventory_account_map: por empresa, cada cuenta AUXILIAR de inventario (14) con su
--      cuenta de costo de ventas (61; 71/72/73 solo para inventarios de producción 1405/1410/1430)
--      y su cuenta de ingreso (41, nunca 4175). Validada por trigger. Sin fila → cuentas por defecto.
--      Carga inicial sin inventar cuentas: cada auxiliar 1435xx(.yy) existente se empareja con
--      6135xx(.yy) y 4135xx(.yy) SOLO si existen, están activas y son auxiliares. Solo se empareja
--      el grupo 1435 porque es el único en que el sufijo coincide en el PUC (1435 ↔ 6135 ↔ 4135,
--      "comercio al por mayor y al por menor"); 1405/1410/1430 se configuran a mano.
--   2. products.accounting_account_id: si viene, debe ser una auxiliar (sin subcuentas) activa de
--      clase 1 del grupo 14. No se exige en filas existentes (puede quedar nula: usa el defecto).
--   3. fn_product_inventory_account / fn_inventory_line_account: resuelven la cuenta de inventario
--      de un producto y su costo/ingreso mapeado (con respaldo en accounting_default_accounts).
--   4. fn_cause_sale_accounting_internal (059) redefinida: agrupa las líneas por cuenta de
--      inventario del producto. Cr inventario / Dr costo por grupo; ingreso repartido por la base
--      gravable de cada grupo (centavos de redondeo a la línea de ingreso mayor). Pagos e IVA, igual.
--   5. fn_create_electronic_note (060) redefinida: copia exacta salvo el reingreso de la devolución,
--      que ahora va a la cuenta de inventario de cada producto devuelto y reversa su costo mapeado.
--
-- No toca la causación de compras (048): asienta por código fijo y sin control de acceso; se
-- revisará en otra fase. No borra datos. Se puede re-ejecutar.
-- ==============================================================================

BEGIN;

-- Si una tabla está bloqueada por otra sesión, se falla rápido en vez de esperar (y bloquear a otros).
SET LOCAL lock_timeout = '5s';

-- ------------------------------------------------------------------------------
-- 1. CUENTAS POR LÍNEA DE INVENTARIO (inventario → costo de ventas → ingreso)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_inventory_account_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  inventory_account_id UUID NOT NULL REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT,
  cost_account_id UUID NOT NULL REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT,
  income_account_id UUID NOT NULL REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_accounting_inventory_account_map UNIQUE (company_id, inventory_account_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_account_map_company ON public.accounting_inventory_account_map (company_id);

ALTER TABLE public.accounting_inventory_account_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant select accounting_inventory_account_map" ON public.accounting_inventory_account_map;
CREATE POLICY "Tenant select accounting_inventory_account_map" ON public.accounting_inventory_account_map
  FOR SELECT TO authenticated
  USING (company_id = get_auth_company_id()
         AND (is_admin() OR has_permission('accounting.read') OR has_permission('accounting.post')));

DROP POLICY IF EXISTS "Tenant insert accounting_inventory_account_map" ON public.accounting_inventory_account_map;
CREATE POLICY "Tenant insert accounting_inventory_account_map" ON public.accounting_inventory_account_map
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_auth_company_id() AND (is_admin() OR has_permission('accounting.post')));

DROP POLICY IF EXISTS "Tenant update accounting_inventory_account_map" ON public.accounting_inventory_account_map;
CREATE POLICY "Tenant update accounting_inventory_account_map" ON public.accounting_inventory_account_map
  FOR UPDATE TO authenticated
  USING (company_id = get_auth_company_id() AND (is_admin() OR has_permission('accounting.post')))
  WITH CHECK (company_id = get_auth_company_id() AND (is_admin() OR has_permission('accounting.post')));
-- Sin política de DELETE: una línea se retira con is_active = false (vuelve a las cuentas por defecto).

REVOKE ALL ON TABLE public.accounting_inventory_account_map FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.accounting_inventory_account_map TO authenticated;
GRANT ALL ON TABLE public.accounting_inventory_account_map TO service_role;

-- Reglas (funcionan con códigos con punto: '143501.01'):
--   inventario: auxiliar (sin subcuentas), activa, clase 1, grupo 14.
--   costo: auxiliar activa del grupo 61; 71/72/73 solo si el inventario es de producción
--          (1405 materias primas, 1410 productos en proceso, 1430 productos terminados).
--   ingreso: auxiliar activa del grupo 41 que no sea 4175 (devoluciones, naturaleza débito).
-- Una fila inactiva no se valida: así se puede retirar aunque una de sus cuentas ya no sea válida.
CREATE OR REPLACE FUNCTION public.fn_validate_inventory_account_map()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_inv RECORD;
  v_cost RECORD;
  v_income RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    NEW.created_at := NOW();
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := NOW();

  IF NEW.is_active = false THEN
    RETURN NEW;
  END IF;

  SELECT id, code, name, account_class, is_active INTO v_inv
  FROM public.accounting_accounts WHERE id = NEW.inventory_account_id;
  IF NOT FOUND OR v_inv.is_active = false THEN
    RAISE EXCEPTION 'La cuenta de inventario no existe o está inactiva.' USING ERRCODE = '23503';
  END IF;
  IF v_inv.account_class <> 1 OR v_inv.code NOT LIKE '14%' THEN
    RAISE EXCEPTION 'La cuenta % % no es una cuenta de inventarios (grupo 14).', v_inv.code, v_inv.name USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.accounting_accounts c WHERE c.parent_id = v_inv.id) THEN
    RAISE EXCEPTION 'La cuenta % % tiene subcuentas: seleccione la auxiliar (último nivel).', v_inv.code, v_inv.name
      USING ERRCODE = '22023';
  END IF;

  SELECT id, code, name, is_active INTO v_cost
  FROM public.accounting_accounts WHERE id = NEW.cost_account_id;
  IF NOT FOUND OR v_cost.is_active = false THEN
    RAISE EXCEPTION 'La cuenta de costo de ventas no existe o está inactiva.' USING ERRCODE = '23503';
  END IF;
  IF NOT (v_cost.code LIKE '61%'
          OR (LEFT(v_cost.code, 2) IN ('71', '72', '73') AND LEFT(v_inv.code, 4) IN ('1405', '1410', '1430'))) THEN
    RAISE EXCEPTION 'La cuenta % % no es de costo de ventas para el inventario % (se espera el grupo 61; 71/72/73 solo para inventarios de producción).',
      v_cost.code, v_cost.name, v_inv.code USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.accounting_accounts c WHERE c.parent_id = v_cost.id) THEN
    RAISE EXCEPTION 'La cuenta % % tiene subcuentas: seleccione la auxiliar (último nivel).', v_cost.code, v_cost.name
      USING ERRCODE = '22023';
  END IF;

  SELECT id, code, name, is_active INTO v_income
  FROM public.accounting_accounts WHERE id = NEW.income_account_id;
  IF NOT FOUND OR v_income.is_active = false THEN
    RAISE EXCEPTION 'La cuenta de ingreso no existe o está inactiva.' USING ERRCODE = '23503';
  END IF;
  IF v_income.code NOT LIKE '41%' OR v_income.code LIKE '4175%' THEN
    RAISE EXCEPTION 'La cuenta % % no es de ingresos operacionales por ventas (grupo 41, distinta de 4175).',
      v_income.code, v_income.name USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.accounting_accounts c WHERE c.parent_id = v_income.id) THEN
    RAISE EXCEPTION 'La cuenta % % tiene subcuentas: seleccione la auxiliar (último nivel).', v_income.code, v_income.name
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_inventory_account_map ON public.accounting_inventory_account_map;
CREATE TRIGGER trg_validate_inventory_account_map
  BEFORE INSERT OR UPDATE ON public.accounting_inventory_account_map
  FOR EACH ROW EXECUTE FUNCTION public.fn_validate_inventory_account_map();

-- Carga inicial: 1435xx(.yy) ↔ 6135xx(.yy) ↔ 4135xx(.yy), solo cuentas existentes, activas y auxiliares.
-- Lo que no tenga pareja no se crea: esa línea usa las cuentas por defecto.
INSERT INTO public.accounting_inventory_account_map (company_id, inventory_account_id, cost_account_id, income_account_id)
SELECT c.id, inv.id, cost.id, inc.id
FROM public.companies c
CROSS JOIN public.accounting_accounts inv
JOIN public.accounting_accounts cost
  ON cost.code = '61' || SUBSTRING(inv.code FROM 3) AND cost.is_active = true
JOIN public.accounting_accounts inc
  ON inc.code = '41' || SUBSTRING(inv.code FROM 3) AND inc.is_active = true
WHERE inv.code LIKE '1435%' AND LENGTH(inv.code) > 4
  AND inv.is_active = true AND inv.account_class = 1
  AND NOT EXISTS (SELECT 1 FROM public.accounting_accounts h WHERE h.parent_id = inv.id)
  AND NOT EXISTS (SELECT 1 FROM public.accounting_accounts h WHERE h.parent_id = cost.id)
  AND NOT EXISTS (SELECT 1 FROM public.accounting_accounts h WHERE h.parent_id = inc.id)
ON CONFLICT (company_id, inventory_account_id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. CUENTA DE INVENTARIO DEL PRODUCTO: SOLO AUXILIARES DEL GRUPO 14
-- ------------------------------------------------------------------------------
-- Solo se valida cuando la cuenta cambia: los productos antiguos (sin cuenta o con una cuenta de
-- grupo como '1435') se pueden seguir editando sin tocarla.
CREATE OR REPLACE FUNCTION public.fn_validate_product_inventory_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_acc RECORD;
BEGIN
  IF NEW.accounting_account_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.accounting_account_id IS NOT DISTINCT FROM OLD.accounting_account_id THEN
    RETURN NEW;
  END IF;

  SELECT id, code, name, account_class, is_active INTO v_acc
  FROM public.accounting_accounts WHERE id = NEW.accounting_account_id;
  IF NOT FOUND OR v_acc.is_active = false THEN
    RAISE EXCEPTION 'La cuenta contable del producto no existe o está inactiva.' USING ERRCODE = '23503';
  END IF;
  IF v_acc.account_class <> 1 OR v_acc.code NOT LIKE '14%' THEN
    RAISE EXCEPTION 'La cuenta % % no es una cuenta de inventarios (grupo 14).', v_acc.code, v_acc.name USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.accounting_accounts c WHERE c.parent_id = v_acc.id) THEN
    RAISE EXCEPTION 'La cuenta % % tiene subcuentas: el producto debe ir a una cuenta auxiliar (último nivel).',
      v_acc.code, v_acc.name USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_product_inventory_account ON public.products;
CREATE TRIGGER trg_validate_product_inventory_account
  BEFORE INSERT OR UPDATE OF accounting_account_id ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.fn_validate_product_inventory_account();

-- ------------------------------------------------------------------------------
-- 3. RESOLUCIÓN DE CUENTAS POR PRODUCTO (uso interno de las causaciones)
-- ------------------------------------------------------------------------------
-- Cuenta de inventario de un producto: la suya si está activa; si no, la de defecto (INVENTORY).
-- Puede devolver NULL si no hay ninguna: quien la usa decide si eso es un error (solo lo es con costo).
CREATE OR REPLACE FUNCTION public.fn_product_inventory_account(p_company_id UUID, p_product_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(
    (SELECT a.id
     FROM public.products p
     JOIN public.accounting_accounts a ON a.id = p.accounting_account_id AND a.is_active = true
     WHERE p.id = p_product_id),
    (SELECT d.accounting_account_id
     FROM public.accounting_default_accounts d
     JOIN public.accounting_accounts a ON a.id = d.accounting_account_id AND a.is_active = true
     WHERE d.company_id = p_company_id AND d.purpose = 'INVENTORY')
  );
$$;

REVOKE ALL ON FUNCTION public.fn_product_inventory_account(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- Cuenta de costo de ventas (p_purpose = 'COST_OF_SALES') o de ingreso ('SALES_INCOME') de una línea
-- de inventario: la mapeada si está activa; si no, la de defecto (falla si tampoco está configurada).
CREATE OR REPLACE FUNCTION public.fn_inventory_line_account(
  p_company_id UUID,
  p_inventory_account_id UUID,
  p_purpose VARCHAR
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_purpose NOT IN ('COST_OF_SALES', 'SALES_INCOME') THEN
    RAISE EXCEPTION 'Propósito no válido para una línea de inventario: %.', p_purpose USING ERRCODE = '22023';
  END IF;

  IF p_inventory_account_id IS NOT NULL THEN
    SELECT CASE WHEN p_purpose = 'COST_OF_SALES' THEN m.cost_account_id ELSE m.income_account_id END
    INTO v_id
    FROM public.accounting_inventory_account_map m
    JOIN public.accounting_accounts a
      ON a.id = CASE WHEN p_purpose = 'COST_OF_SALES' THEN m.cost_account_id ELSE m.income_account_id END
     AND a.is_active = true
    WHERE m.company_id = p_company_id AND m.inventory_account_id = p_inventory_account_id AND m.is_active = true;
  END IF;

  RETURN COALESCE(v_id, public.fn_get_default_account(p_company_id, p_purpose));
END;
$$;

REVOKE ALL ON FUNCTION public.fn_inventory_line_account(UUID, UUID, VARCHAR) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 4. CAUSACIÓN CONTABLE DE LA VENTA POR LÍNEA DE INVENTARIO
-- ------------------------------------------------------------------------------
-- Misma firma, control de acceso (lo hace el envoltorio fn_cause_sale_accounting de 059),
-- idempotencia y débitos de pago que 059. Cambian los créditos de ingreso y el par costo/inventario.
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
  v_debit_account UUID;
  v_grp RECORD;
  v_base_total NUMERIC(15,2);
  v_amount NUMERIC(15,2);
  v_allocated NUMERIC(15,2) := 0;
  v_income_accounts UUID[] := ARRAY[]::UUID[];
  v_income_amounts NUMERIC[] := ARRAY[]::NUMERIC[];
  v_inventory_account UUID;
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
  -- El ingreso se reparte entre las cuentas de ingreso de cada línea de inventario en proporción a
  -- la base gravable (neta de IVA) de sus productos; los centavos de redondeo van a la de mayor valor.
  v_income := v_sale.total_amount - COALESCE(v_sale.tax_amount, 0);
  SELECT COALESCE(SUM(GREATEST(si.total - si.tax_amount, 0)), 0) INTO v_base_total
  FROM public.sale_items si WHERE si.sale_id = p_sale_id;

  IF v_base_total > 0 AND v_income > 0 THEN
    FOR v_grp IN
      SELECT public.fn_inventory_line_account(
               v_sale.company_id,
               public.fn_product_inventory_account(v_sale.company_id, si.product_id),
               'SALES_INCOME') AS account_id,
             SUM(GREATEST(si.total - si.tax_amount, 0)) AS base_amount
      FROM public.sale_items si
      WHERE si.sale_id = p_sale_id
      GROUP BY 1
      ORDER BY 2 DESC, 1
    LOOP
      v_amount := ROUND(v_income * v_grp.base_amount / v_base_total, 2);
      v_income_accounts := v_income_accounts || v_grp.account_id;
      v_income_amounts := v_income_amounts || v_amount;
      v_allocated := v_allocated + v_amount;
    END LOOP;
    v_income_amounts[1] := v_income_amounts[1] + (v_income - v_allocated);
  ELSE
    -- Sin base por líneas (venta sin ítems o de valor cero): una sola línea a la cuenta por defecto, como en 059.
    v_income_accounts := ARRAY[public.fn_get_default_account(v_sale.company_id, 'SALES_INCOME')];
    v_income_amounts := ARRAY[v_income];
  END IF;

  FOR i IN 1 .. COALESCE(array_length(v_income_accounts, 1), 0) LOOP
    CONTINUE WHEN i > 1 AND v_income_amounts[i] = 0;
    v_lines := v_lines || jsonb_build_object(
      'account_id', v_income_accounts[i],
      'debit_amount', 0, 'credit_amount', v_income_amounts[i],
      'third_party_doc', v_customer_doc, 'third_party_name', v_customer_name,
      'description', 'Ingreso venta ' || v_sale.sale_number);
  END LOOP;

  IF COALESCE(v_sale.tax_amount, 0) > 0 THEN
    v_lines := v_lines || jsonb_build_object(
      'account_id', public.fn_get_default_account(v_sale.company_id, 'VAT_GENERATED'),
      'debit_amount', 0, 'credit_amount', v_sale.tax_amount,
      'third_party_doc', v_customer_doc, 'third_party_name', v_customer_name,
      'description', 'IVA generado venta ' || v_sale.sale_number);
  END IF;

  -- COSTO DE VENTAS / INVENTARIO: un par por cuenta de inventario de los productos vendidos.
  FOR v_grp IN
    SELECT public.fn_product_inventory_account(v_sale.company_id, si.product_id) AS inventory_account_id,
           ROUND(SUM(si.quantity * si.unit_cost), 2) AS cost_amount
    FROM public.sale_items si
    WHERE si.sale_id = p_sale_id
    GROUP BY 1
    ORDER BY 2 DESC, 1
  LOOP
    CONTINUE WHEN v_grp.cost_amount <= 0;
    v_inventory_account := COALESCE(v_grp.inventory_account_id,
                                    public.fn_get_default_account(v_sale.company_id, 'INVENTORY'));
    v_lines := v_lines || jsonb_build_object(
      'account_id', public.fn_inventory_line_account(v_sale.company_id, v_inventory_account, 'COST_OF_SALES'),
      'debit_amount', v_grp.cost_amount, 'credit_amount', 0,
      'description', 'Costo de ventas ' || v_sale.sale_number);
    v_lines := v_lines || jsonb_build_object(
      'account_id', v_inventory_account,
      'debit_amount', 0, 'credit_amount', v_grp.cost_amount,
      'description', 'Salida de inventario venta ' || v_sale.sale_number);
  END LOOP;

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

-- ------------------------------------------------------------------------------
-- 5. NOTAS CRÉDITO/DÉBITO (060): REINGRESO DE LA DEVOLUCIÓN POR CUENTA DEL PRODUCTO
-- ------------------------------------------------------------------------------
-- Copia exacta de 060 salvo el bloque "Mercancía devuelta" (marcado con 062).

CREATE OR REPLACE FUNCTION public.fn_create_electronic_note(
  p_original_invoice_id UUID,
  p_document_type VARCHAR,
  p_concept_code VARCHAR,
  p_reason TEXT,
  p_lines JSONB,
  p_return_id UUID,
  p_idempotency_key VARCHAR,
  p_environment VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_orig RECORD;
  v_existing RECORD;
  v_seq RECORD;
  v_ret RECORD;
  v_item RECORD;
  v_line JSONB;
  v_note_id UUID := gen_random_uuid();
  v_now_bogota TIMESTAMP := (NOW() AT TIME ZONE 'America/Bogota');
  v_next BIGINT;
  v_max_used BIGINT;
  v_ln INT := 0;
  v_qty NUMERIC(12,2);
  v_net NUMERIC(15,2);
  v_tax NUMERIC(15,2);
  v_rate NUMERIC(5,2);
  v_treat VARCHAR(10);
  v_desc TEXT;
  v_sku VARCHAR(80);
  v_prod UUID;
  v_by_qty BOOLEAN;
  v_prev_qty NUMERIC(12,2);
  v_prev_net NUMERIC(15,2);
  v_sub NUMERIC(15,2) := 0;
  v_taxsum NUMERIC(15,2) := 0;
  v_total NUMERIC(15,2);
  v_concept_desc TEXT;
  v_customer_doc VARCHAR(50);
  v_customer_name VARCHAR(200);
  v_acc_lines JSONB := '[]'::JSONB;
  v_entry JSONB;
  v_ret_cost NUMERIC(15,2) := 0;
  v_income_purpose VARCHAR(40);
  v_ret_grp RECORD;
  v_ret_inventory UUID;
BEGIN
  IF p_environment IS NULL OR p_environment NOT IN ('HABILITACION', 'PRODUCCION') THEN
    RAISE EXCEPTION 'Ambiente DIAN inválido: %', p_environment USING ERRCODE = '22023';
  END IF;
  IF p_document_type NOT IN ('CREDIT_NOTE', 'DEBIT_NOTE') THEN
    RAISE EXCEPTION 'Tipo de nota inválido: %', p_document_type USING ERRCODE = '22023';
  END IF;
  IF p_idempotency_key IS NULL OR LENGTH(TRIM(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'Se requiere una clave de idempotencia válida.' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Escriba el motivo de la nota (mínimo 5 caracteres).' USING ERRCODE = '22023';
  END IF;

  v_concept_desc := CASE
    WHEN p_document_type = 'CREDIT_NOTE' THEN CASE p_concept_code
      WHEN '1' THEN 'Devolución parcial de los bienes y/o no aceptación parcial del servicio'
      WHEN '2' THEN 'Anulación de factura electrónica'
      WHEN '3' THEN 'Rebaja o descuento parcial o total'
      WHEN '4' THEN 'Ajuste de precio'
      WHEN '5' THEN 'Descuento comercial por pronto pago'
      WHEN '6' THEN 'Descuento comercial por volumen de ventas'
      ELSE NULL END
    ELSE CASE p_concept_code
      WHEN '1' THEN 'Intereses'
      WHEN '2' THEN 'Gastos por cobrar'
      WHEN '3' THEN 'Cambio del valor'
      WHEN '4' THEN 'Otros'
      ELSE NULL END
  END;
  IF v_concept_desc IS NULL THEN
    RAISE EXCEPTION 'Concepto % no válido para %.', p_concept_code, p_document_type USING ERRCODE = '22023';
  END IF;

  -- Factura original bloqueada: serializa notas concurrentes sobre la misma factura.
  SELECT * INTO v_orig FROM public.electronic_invoices WHERE id = p_original_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La factura original no existe.' USING ERRCODE = 'P0002';
  END IF;

  IF v_caller IS NOT NULL THEN
    IF public.get_auth_company_id() IS DISTINCT FROM v_orig.company_id THEN
      RAISE EXCEPTION 'Acceso denegado: la factura no pertenece a su empresa.' USING ERRCODE = '42501';
    END IF;
    IF NOT (public.is_admin() OR public.has_permission('invoices.cancel')) THEN
      RAISE EXCEPTION 'Acceso denegado: requiere el permiso invoices.cancel (notas crédito/débito).' USING ERRCODE = '42501';
    END IF;
    IF NOT (public.is_admin() OR public.has_location_access(v_orig.location_id)) THEN
      RAISE EXCEPTION 'Acceso denegado: la factura es de una sede que no tiene asignada.' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT public.fn_is_trusted_server_context() THEN
    RAISE EXCEPTION 'Acceso denegado: usuario no autenticado.' USING ERRCODE = '28000';
  END IF;

  -- El ambiente lo define la configuración DIAN activa de la empresa, no quien llama.
  IF p_environment IS DISTINCT FROM public.fn_dian_active_environment(v_orig.company_id) THEN
    RAISE EXCEPTION 'El ambiente solicitado (%) no es el ambiente DIAN activo de la empresa (%).',
      p_environment, public.fn_dian_active_environment(v_orig.company_id) USING ERRCODE = '55000';
  END IF;

  -- Idempotencia: misma clave → misma nota, solo si es del mismo tipo y sobre la misma factura.
  SELECT id, prefix, number, document_type, original_invoice_id INTO v_existing
  FROM public.electronic_invoices
  WHERE company_id = v_orig.company_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.document_type IS DISTINCT FROM p_document_type
       OR v_existing.original_invoice_id IS DISTINCT FROM p_original_invoice_id THEN
      RAISE EXCEPTION 'La clave de idempotencia ya se usó para otro documento electrónico (%). Genere una nueva.',
        v_existing.prefix || v_existing.number::TEXT USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object('success', true, 'idempotent_replay', true,
      'note_id', v_existing.id, 'prefix', v_existing.prefix, 'number', v_existing.number);
  END IF;

  IF v_orig.document_type <> 'INVOICE' THEN
    RAISE EXCEPTION 'Las notas se emiten sobre una factura electrónica de venta, no sobre otra nota.' USING ERRCODE = '22023';
  END IF;
  IF v_orig.environment <> p_environment THEN
    RAISE EXCEPTION 'La factura es del ambiente % y la nota se pidió en %.', v_orig.environment, p_environment USING ERRCODE = '22023';
  END IF;
  IF v_orig.transmission_state <> 'ACCEPTED' OR v_orig.cufe IS NULL THEN
    RAISE EXCEPTION 'La factura % debe estar ACEPTADA por la DIAN antes de emitirle notas (estado actual: %).',
      v_orig.prefix || v_orig.number::TEXT, v_orig.transmission_state USING ERRCODE = '55000';
  END IF;

  -- ----------------------------------------------------------------------------
  -- Líneas
  -- ----------------------------------------------------------------------------
  CREATE TEMP TABLE IF NOT EXISTS tmp_note_lines (
    ln INT, sale_item_id UUID, product_id UUID, sku VARCHAR(80), description TEXT,
    quantity NUMERIC(12,2), unit_price NUMERIC(15,2), discount NUMERIC(5,2), net NUMERIC(15,2),
    treat VARCHAR(10), rate NUMERIC(5,2), tax NUMERIC(15,2), by_qty BOOLEAN, returned BOOLEAN
  ) ON COMMIT DROP;
  DELETE FROM tmp_note_lines;

  IF p_document_type = 'CREDIT_NOTE' THEN
    IF p_concept_code = '2' THEN
      IF EXISTS (SELECT 1 FROM public.electronic_invoices WHERE original_invoice_id = v_orig.id AND document_type = 'CREDIT_NOTE') THEN
        RAISE EXCEPTION 'La factura ya tiene notas crédito; no se puede anular completa. Emita una nota por el saldo.' USING ERRCODE = '55000';
      END IF;
      -- Las líneas de valor 0 (obsequios, precio 0) no tienen nada que acreditar: se omiten.
      p_lines := (SELECT jsonb_agg(jsonb_build_object('sale_item_id', si.id, 'quantity', si.quantity) ORDER BY si.created_at, si.id)
                  FROM public.sale_items si WHERE si.sale_id = v_orig.sale_id AND si.subtotal > 0);
      p_return_id := NULL;
    ELSIF p_concept_code = '1' AND p_return_id IS NULL THEN
      RAISE EXCEPTION 'La nota por devolución (concepto 1) requiere la devolución registrada y completada en el módulo Devoluciones.'
        USING ERRCODE = '23502';
    ELSIF p_return_id IS NOT NULL THEN
      SELECT * INTO v_ret FROM public.returns WHERE id = p_return_id FOR UPDATE;
      IF NOT FOUND OR v_ret.company_id <> v_orig.company_id OR v_ret.return_type <> 'CUSTOMER_RETURN'
         OR v_ret.source_document_type <> 'SALE' OR v_ret.source_document_id <> v_orig.sale_id THEN
        RAISE EXCEPTION 'La devolución no corresponde a la venta de esta factura.' USING ERRCODE = '22023';
      END IF;
      IF v_ret.status <> 'COMPLETED' THEN
        RAISE EXCEPTION 'La devolución % no está completada (estado %): no se puede acreditar.', v_ret.code, v_ret.status USING ERRCODE = '55000';
      END IF;
      IF EXISTS (SELECT 1 FROM public.electronic_invoices WHERE return_id = p_return_id) THEN
        RAISE EXCEPTION 'La devolución % ya tiene una nota crédito.', v_ret.code USING ERRCODE = '23505';
      END IF;
      IF p_concept_code <> '1' THEN
        RAISE EXCEPTION 'Una nota por devolución de mercancía usa el concepto 1 (devolución).' USING ERRCODE = '22023';
      END IF;
      -- Cada producto devuelto se asigna a las líneas de la venta de ese producto, en orden.
      p_lines := '[]'::JSONB;
      FOR v_item IN
        SELECT ri.product_id, SUM(ri.quantity) AS qty, SUM(ri.quantity * ri.unit_cost) AS cost
        FROM public.return_items ri WHERE ri.return_id = p_return_id GROUP BY ri.product_id
      LOOP
        v_ret_cost := v_ret_cost + COALESCE(v_item.cost, 0);
        v_qty := v_item.qty;
        FOR v_line IN
          SELECT jsonb_build_object('sale_item_id', si.id, 'avail', si.quantity - COALESCE((
                   SELECT SUM(l.quantity) FROM public.electronic_document_lines l
                   JOIN public.electronic_invoices n ON n.id = l.document_id
                   WHERE l.source_sale_item_id = si.id AND n.document_type = 'CREDIT_NOTE' AND l.quantity_returned), 0))
          FROM public.sale_items si WHERE si.sale_id = v_orig.sale_id AND si.product_id = v_item.product_id
          ORDER BY si.created_at, si.id
        LOOP
          EXIT WHEN v_qty <= 0;
          IF (v_line->>'avail')::NUMERIC > 0 THEN
            p_lines := p_lines || jsonb_build_object('sale_item_id', v_line->>'sale_item_id',
                                                     'quantity', LEAST(v_qty, (v_line->>'avail')::NUMERIC));
            v_qty := v_qty - LEAST(v_qty, (v_line->>'avail')::NUMERIC);
          END IF;
        END LOOP;
        IF v_qty > 0 THEN
          RAISE EXCEPTION 'La devolución tiene más unidades de un producto que las facturadas pendientes de acreditar.' USING ERRCODE = '22023';
        END IF;
      END LOOP;
    END IF;

    IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
      RAISE EXCEPTION 'La nota crédito debe tener al menos una línea.' USING ERRCODE = '23502';
    END IF;
    -- Una línea de la venta solo puede aparecer una vez por nota (si no, se acreditaría dos veces).
    IF (SELECT COUNT(*) FROM jsonb_array_elements(p_lines) e) <> (SELECT COUNT(DISTINCT e->>'sale_item_id') FROM jsonb_array_elements(p_lines) e) THEN
      RAISE EXCEPTION 'Una misma línea de la factura aparece repetida en la nota.' USING ERRCODE = '22023';
    END IF;

    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
      SELECT si.*, p.sku AS p_sku, p.name AS p_name, p.iva_treatment AS p_treat
      INTO v_item
      FROM public.sale_items si JOIN public.products p ON p.id = si.product_id
      WHERE si.id = NULLIF(v_line->>'sale_item_id', '')::UUID AND si.sale_id = v_orig.sale_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Una línea de la nota no pertenece a la factura original.' USING ERRCODE = '22023';
      END IF;

      v_by_qty := (v_line ? 'quantity') AND NOT (v_line ? 'net_amount');
      IF p_concept_code = '1' AND NOT v_by_qty THEN
        RAISE EXCEPTION 'La devolución (concepto 1) se acredita por cantidades, no por valor.' USING ERRCODE = '22023';
      END IF;

      -- Lo ya acreditado de esta línea en notas anteriores
      SELECT COALESCE(SUM(l.quantity) FILTER (WHERE l.quantity_returned), 0), COALESCE(SUM(l.net_amount), 0)
      INTO v_prev_qty, v_prev_net
      FROM public.electronic_document_lines l
      JOIN public.electronic_invoices n ON n.id = l.document_id
      WHERE l.source_sale_item_id = v_item.id AND n.document_type = 'CREDIT_NOTE';

      IF v_by_qty THEN
        v_qty := ROUND((v_line->>'quantity')::NUMERIC, 2);
        IF v_qty IS NULL OR v_qty <= 0 THEN
          RAISE EXCEPTION 'Cantidad inválida en la nota.' USING ERRCODE = '22003';
        END IF;
        IF v_prev_qty + v_qty > v_item.quantity THEN
          RAISE EXCEPTION 'Producto %: se acreditarían % unidades y la factura tiene % (ya acreditadas %).',
            v_item.p_sku, v_prev_qty + v_qty, v_item.quantity, v_prev_qty USING ERRCODE = '22003';
        END IF;
        -- Proporcional a la línea facturada (respeta descuentos y redondeos de la venta)
        IF v_prev_qty + v_qty = v_item.quantity THEN
          -- Última devolución de la línea: se acredita exactamente el saldo que queda (incluye rebajas previas)
          v_net := v_item.subtotal - v_prev_net;
          IF v_net <= 0 THEN
            RAISE EXCEPTION 'Producto %: la línea ya fue acreditada en su totalidad por notas anteriores.', v_item.p_sku USING ERRCODE = '22003';
          END IF;
        ELSE
          v_net := ROUND(v_item.subtotal * v_qty / v_item.quantity, 2);
        END IF;
      ELSE
        v_net := ROUND((v_line->>'net_amount')::NUMERIC, 2);
        v_qty := 1;
        IF v_net IS NULL OR v_net <= 0 THEN
          RAISE EXCEPTION 'Valor inválido en la nota.' USING ERRCODE = '22003';
        END IF;
      END IF;

      IF v_prev_net + v_net > v_item.subtotal THEN
        RAISE EXCEPTION 'Producto %: el valor acreditado (%) superaría el facturado (%).',
          v_item.p_sku, v_prev_net + v_net, v_item.subtotal USING ERRCODE = '22003';
      END IF;

      v_rate := COALESCE(v_item.tax_rate_percent, 0);
      v_treat := CASE WHEN v_rate > 0 THEN 'GRAVADO'
                      ELSE COALESCE(NULLIF(v_item.iva_treatment, 'GRAVADO'), CASE WHEN v_item.p_treat IN ('EXENTO','EXCLUIDO') THEN v_item.p_treat END) END;
      IF v_treat IS NULL THEN
        RAISE EXCEPTION 'El producto % (IVA 0 %%) no está clasificado como exento o excluido.', v_item.p_sku USING ERRCODE = '23502';
      END IF;
      IF v_by_qty AND v_prev_qty + v_qty = v_item.quantity THEN
        -- Saldo de IVA de la línea; nunca negativo (redondeos de notas anteriores por valor).
        v_tax := GREATEST(0, v_item.tax_amount - COALESCE((SELECT SUM(l.tax_amount) FROM public.electronic_document_lines l
                   JOIN public.electronic_invoices n ON n.id = l.document_id
                   WHERE l.source_sale_item_id = v_item.id AND n.document_type = 'CREDIT_NOTE'), 0));
      ELSE
        v_tax := ROUND(v_net * v_rate / 100, 2);
      END IF;

      v_ln := v_ln + 1;
      -- Por cantidad: mismo precio unitario y % de descuento de la venta (cantidad × precio − descuento = neto).
      -- Por valor: una unidad al valor acreditado.
      INSERT INTO tmp_note_lines VALUES (v_ln, v_item.id, v_item.product_id, v_item.p_sku, v_item.p_name,
        v_qty,
        CASE WHEN v_by_qty THEN v_item.unit_price ELSE v_net END,
        CASE WHEN v_by_qty THEN COALESCE(v_item.discount_percent, 0) ELSE 0 END,
        v_net, v_treat, v_rate, v_tax, v_by_qty,
        -- Solo una devolución registrada (mercancía que volvió al inventario) cuenta como cantidad devuelta.
        v_by_qty AND p_return_id IS NOT NULL);
    END LOOP;

  ELSE -- DEBIT_NOTE
    IF p_return_id IS NOT NULL THEN
      RAISE EXCEPTION 'Una nota débito no se asocia a devoluciones.' USING ERRCODE = '22023';
    END IF;
    IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
      RAISE EXCEPTION 'La nota débito debe tener al menos una línea.' USING ERRCODE = '23502';
    END IF;
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
      v_desc := NULLIF(TRIM(v_line->>'description'), '');
      v_qty := ROUND(COALESCE((v_line->>'quantity')::NUMERIC, 1), 2);
      v_net := ROUND(v_qty * ROUND((v_line->>'unit_price')::NUMERIC, 2), 2);
      v_prod := NULLIF(v_line->>'product_id', '')::UUID;
      v_sku := NULL;
      IF v_prod IS NOT NULL THEN
        SELECT sku, COALESCE(v_desc, name) INTO v_sku, v_desc FROM public.products WHERE id = v_prod AND company_id = v_orig.company_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Producto de la nota débito no encontrado.' USING ERRCODE = '22023';
        END IF;
      END IF;
      IF v_desc IS NULL THEN
        RAISE EXCEPTION 'Cada línea de la nota débito necesita una descripción.' USING ERRCODE = '23502';
      END IF;
      IF v_qty <= 0 OR v_net IS NULL OR v_net <= 0 THEN
        RAISE EXCEPTION 'Cantidad o valor inválido en la nota débito.' USING ERRCODE = '22003';
      END IF;
      CASE UPPER(COALESCE(v_line->>'iva', ''))
        WHEN 'IVA_19' THEN v_treat := 'GRAVADO'; v_rate := 19;
        WHEN 'IVA_5' THEN v_treat := 'GRAVADO'; v_rate := 5;
        WHEN 'EXENTO' THEN v_treat := 'EXENTO'; v_rate := 0;
        WHEN 'EXCLUIDO' THEN v_treat := 'EXCLUIDO'; v_rate := 0;
        ELSE RAISE EXCEPTION 'Indique el IVA de cada línea: IVA_19, IVA_5, EXENTO o EXCLUIDO.' USING ERRCODE = '22023';
      END CASE;
      v_tax := ROUND(v_net * v_rate / 100, 2);
      v_ln := v_ln + 1;
      INSERT INTO tmp_note_lines VALUES (v_ln, NULL, v_prod, COALESCE(v_sku, 'ND-' || v_ln), v_desc,
        v_qty, ROUND((v_line->>'unit_price')::NUMERIC, 2), 0, v_net, v_treat, v_rate, v_tax, false, false);
    END LOOP;
  END IF;

  SELECT COALESCE(SUM(net), 0), COALESCE(SUM(tax), 0) INTO v_sub, v_taxsum FROM tmp_note_lines;
  v_total := v_sub + v_taxsum;
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'La nota no tiene valor.' USING ERRCODE = '22003';
  END IF;

  -- ----------------------------------------------------------------------------
  -- Consecutivo de la nota
  -- ----------------------------------------------------------------------------
  -- Habilitación: prefijos de prueba NCT/NDT se crean si faltan. Producción: el prefijo lo define la
  -- empresa al pasar a producción; si no está configurado no se emite la nota (no se inventa).
  IF p_environment = 'HABILITACION' THEN
    INSERT INTO public.dian_note_sequences (company_id, environment, document_type, prefix)
    VALUES (v_orig.company_id, p_environment, p_document_type,
            CASE WHEN p_document_type = 'CREDIT_NOTE' THEN 'NCT' ELSE 'NDT' END)
    ON CONFLICT (company_id, environment, document_type) DO NOTHING;
  END IF;

  SELECT * INTO v_seq FROM public.dian_note_sequences
  WHERE company_id = v_orig.company_id AND environment = p_environment AND document_type = p_document_type
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No hay consecutivo de % configurado para el ambiente % (dian_note_sequences). Configúrelo antes de emitir notas.',
      CASE WHEN p_document_type = 'CREDIT_NOTE' THEN 'notas crédito' ELSE 'notas débito' END, p_environment
      USING ERRCODE = 'P0002';
  END IF;

  SELECT MAX(number) INTO v_max_used FROM public.electronic_invoices WHERE prefix = v_seq.prefix;
  v_next := GREATEST(v_seq.last_number + 1, COALESCE(v_max_used + 1, 1));
  UPDATE public.dian_note_sequences SET last_number = v_next, updated_at = NOW() WHERE id = v_seq.id;

  INSERT INTO public.electronic_invoices (
    id, company_id, location_id, sale_id, customer_id,
    prefix, number, dian_prefix, dian_number, internal_number,
    document_type, original_invoice_id, return_id, note_concept_code, note_reason,
    subtotal_amount, tax_amount, total_amount,
    dian_status, environment, software_id, idempotency_key,
    issue_date, issue_time, transmission_state, created_by_user_id, created_at, updated_at
  ) VALUES (
    v_note_id, v_orig.company_id, v_orig.location_id, v_orig.sale_id, v_orig.customer_id,
    v_seq.prefix, v_next, v_seq.prefix, v_next, v_orig.internal_number,
    p_document_type, v_orig.id, p_return_id, p_concept_code, TRIM(p_reason),
    v_sub, v_taxsum, v_total,
    'PENDING', p_environment, v_orig.software_id, p_idempotency_key,
    v_now_bogota::DATE, TO_CHAR(v_now_bogota, 'HH24:MI:SS') || '-05:00', 'NUMBERED', v_caller, NOW(), NOW()
  );

  INSERT INTO public.electronic_document_lines (
    document_id, company_id, line_number, source_sale_item_id, product_id, sku, description,
    quantity, unit_price, discount_percent, net_amount, iva_treatment, tax_rate_percent, tax_amount, total_amount, quantity_returned)
  SELECT v_note_id, v_orig.company_id, ln, sale_item_id, product_id, sku, description,
         quantity, unit_price, discount, net, treat, rate, tax, net + tax, returned
  FROM tmp_note_lines ORDER BY ln;

  -- ----------------------------------------------------------------------------
  -- Contabilidad (misma transacción)
  -- ----------------------------------------------------------------------------
  SELECT document_number, COALESCE(company_name, TRIM(CONCAT(first_name, ' ', last_name)))
  INTO v_customer_doc, v_customer_name
  FROM public.customers WHERE id = v_orig.customer_id;

  IF p_document_type = 'CREDIT_NOTE' THEN
    v_acc_lines := v_acc_lines || jsonb_build_object(
      'account_id', public.fn_get_default_account(v_orig.company_id, 'SALES_RETURNS'),
      'debit_amount', v_sub, 'credit_amount', 0,
      'third_party_doc', v_customer_doc, 'third_party_name', v_customer_name,
      'description', v_concept_desc || ' - factura ' || v_orig.prefix || v_orig.number::TEXT);
    IF v_taxsum > 0 THEN
      v_acc_lines := v_acc_lines || jsonb_build_object(
        'account_id', public.fn_get_default_account(v_orig.company_id, 'VAT_GENERATED'),
        'debit_amount', v_taxsum, 'credit_amount', 0,
        'third_party_doc', v_customer_doc, 'third_party_name', v_customer_name,
        'description', 'Reversión IVA generado nota ' || v_seq.prefix || v_next::TEXT);
    END IF;
    v_acc_lines := v_acc_lines || jsonb_build_object(
      'account_id', public.fn_get_default_account(v_orig.company_id, 'CUSTOMER_CREDIT'),
      'debit_amount', 0, 'credit_amount', v_total,
      'third_party_doc', v_customer_doc, 'third_party_name', v_customer_name,
      'description', 'Saldo a favor del cliente por nota ' || v_seq.prefix || v_next::TEXT);
    -- Mercancía devuelta (registrada en Devoluciones): vuelve al inventario y se reversa el costo.
    -- 062: un par por cuenta de inventario de los productos devueltos (la del producto o la de defecto)
    -- contra su costo de ventas mapeado, igual que la causación de la venta.
    IF v_ret_cost > 0 THEN
      FOR v_ret_grp IN
        SELECT public.fn_product_inventory_account(v_orig.company_id, ri.product_id) AS inventory_account_id,
               ROUND(SUM(ri.quantity * ri.unit_cost), 2) AS cost_amount
        FROM public.return_items ri
        WHERE ri.return_id = p_return_id
        GROUP BY 1
        ORDER BY 2 DESC, 1
      LOOP
        CONTINUE WHEN v_ret_grp.cost_amount <= 0;
        v_ret_inventory := COALESCE(v_ret_grp.inventory_account_id,
                                    public.fn_get_default_account(v_orig.company_id, 'INVENTORY'));
        v_acc_lines := v_acc_lines || jsonb_build_object(
          'account_id', v_ret_inventory,
          'debit_amount', v_ret_grp.cost_amount, 'credit_amount', 0,
          'description', 'Reingreso inventario devolución ' || v_ret.code);
        v_acc_lines := v_acc_lines || jsonb_build_object(
          'account_id', public.fn_inventory_line_account(v_orig.company_id, v_ret_inventory, 'COST_OF_SALES'),
          'debit_amount', 0, 'credit_amount', v_ret_grp.cost_amount,
          'description', 'Reversión costo de ventas devolución ' || v_ret.code);
      END LOOP;
    END IF;
  ELSE
    v_income_purpose := CASE WHEN p_concept_code = '1' THEN 'FINANCIAL_INCOME' ELSE 'SALES_INCOME' END;
    v_acc_lines := v_acc_lines || jsonb_build_object(
      'account_id', public.fn_get_default_account(v_orig.company_id, 'CUSTOMER_CREDIT'),
      'debit_amount', v_total, 'credit_amount', 0,
      'third_party_doc', v_customer_doc, 'third_party_name', v_customer_name,
      'description', 'Cobro adicional nota ' || v_seq.prefix || v_next::TEXT);
    v_acc_lines := v_acc_lines || jsonb_build_object(
      'account_id', public.fn_get_default_account(v_orig.company_id, v_income_purpose),
      'debit_amount', 0, 'credit_amount', v_sub,
      'third_party_doc', v_customer_doc, 'third_party_name', v_customer_name,
      'description', v_concept_desc || ' - factura ' || v_orig.prefix || v_orig.number::TEXT);
    IF v_taxsum > 0 THEN
      v_acc_lines := v_acc_lines || jsonb_build_object(
        'account_id', public.fn_get_default_account(v_orig.company_id, 'VAT_GENERATED'),
        'debit_amount', 0, 'credit_amount', v_taxsum,
        'third_party_doc', v_customer_doc, 'third_party_name', v_customer_name,
        'description', 'IVA generado nota ' || v_seq.prefix || v_next::TEXT);
    END IF;
  END IF;

  v_entry := public.fn_create_accounting_entry(
    p_date := v_now_bogota::DATE,
    p_concept := CASE WHEN p_document_type = 'CREDIT_NOTE' THEN 'Nota crédito ' ELSE 'Nota débito ' END
                 || v_seq.prefix || v_next::TEXT || ' a factura ' || v_orig.prefix || v_orig.number::TEXT || ' - ' || v_concept_desc,
    p_document_type := p_document_type,
    p_document_reference := v_seq.prefix || v_next::TEXT,
    p_lines := v_acc_lines,
    p_location_id := v_orig.location_id,
    p_auto_post := true,
    p_company_id := v_orig.company_id
  );

  INSERT INTO public.dian_events (invoice_id, company_id, created_by_user_id, environment, event_type, status, payload_sent)
  VALUES (v_note_id, v_orig.company_id, v_caller, p_environment, 'NUMBER_ASSIGNED', 'SUCCESS',
    jsonb_build_object('prefix', v_seq.prefix, 'number', v_next, 'document_type', p_document_type,
                       'original', v_orig.prefix || v_orig.number::TEXT, 'concept', p_concept_code));

  INSERT INTO public.audit_logs (company_id, user_id, user_name, action, module, entity_name, entity_id, location_id, new_value, created_at)
  VALUES (v_orig.company_id, v_caller,
    COALESCE((SELECT full_name FROM public.users WHERE id = v_caller), 'Sistema'),
    CASE WHEN p_document_type = 'CREDIT_NOTE' THEN 'CREDIT_NOTE_NUMBERED' ELSE 'DEBIT_NOTE_NUMBERED' END,
    'INVOICES', 'electronic_invoices', v_note_id::TEXT, v_orig.location_id,
    jsonb_build_object('prefix', v_seq.prefix, 'number', v_next, 'original_invoice', v_orig.prefix || v_orig.number::TEXT,
                       'concept', p_concept_code, 'reason', TRIM(p_reason), 'total', v_total,
                       'accounting_entry', v_entry->>'entry_number'),
    NOW());

  RETURN jsonb_build_object(
    'success', true,
    'idempotent_replay', false,
    'note_id', v_note_id,
    'prefix', v_seq.prefix,
    'number', v_next,
    'total', v_total,
    'accounting_entry_number', v_entry->>'entry_number'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_create_electronic_note(UUID, VARCHAR, VARCHAR, TEXT, JSONB, UUID, VARCHAR, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_create_electronic_note(UUID, VARCHAR, VARCHAR, TEXT, JSONB, UUID, VARCHAR, VARCHAR) TO authenticated, service_role;

COMMIT;
