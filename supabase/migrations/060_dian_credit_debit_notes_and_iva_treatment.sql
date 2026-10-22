-- ==============================================================================
-- MIGRACIÓN 060: NOTAS CRÉDITO / DÉBITO ELECTRÓNICAS (CUDE) Y TRATAMIENTO DE IVA
-- SUPER MÁS ERP/POS — Facturación Electrónica (Software Propio) — HABILITACIÓN
-- ==============================================================================
--
-- Qué hace (sin borrar datos, sin tocar usuarios ni roles):
-- 1. products.iva_treatment: GRAVADO / EXENTO (Art. 477 E.T.) / EXCLUIDO (Art. 424 E.T.).
--    Antes el ERP solo tenía is_tax_exempt (sí/no) y no distinguía exento de excluido,
--    que en el XML DIAN se reportan distinto. Los productos al 0 % quedan SIN clasificar
--    (NULL) hasta que alguien los clasifique: no se inventa el dato.
-- 2. sale_items.iva_treatment: copia del tratamiento al momento de la venta (trigger).
-- 3. electronic_document_lines: líneas propias de cada nota crédito / débito.
-- 4. dian_note_sequences: consecutivo de notas por empresa, ambiente y tipo
--    (habilitación: NCT / NDT; las notas no requieren resolución de numeración).
-- 5. fn_create_electronic_invoice_from_sale(): no numera facturas con productos al 0 % sin clasificar.
-- 6. fn_create_electronic_note(): crea la nota con consecutivo atómico, valida contra la
--    factura original (aceptada por la DIAN, cantidades y valores no superan lo facturado),
--    y la contabiliza en la misma transacción.
-- 7. Cuentas por propósito nuevas: SALES_RETURNS (4175) y FINANCIAL_INCOME (421005), y la siembra
--    para empresas nuevas (fn_seed_default_accounts_for_company, versión única).
-- El consecutivo contable (fn_next_accounting_consecutive, con NCR/NDB) vive solo en 059.
--
-- Requiere: 001–059 aplicadas. Se puede re-ejecutar.
-- ==============================================================================

BEGIN;

-- Si una tabla está bloqueada por otra sesión, se falla rápido en vez de esperar (y bloquear a otros).
SET LOCAL lock_timeout = '5s';

-- ------------------------------------------------------------------------------
-- 1. TRATAMIENTO DE IVA POR PRODUCTO
-- ------------------------------------------------------------------------------
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS iva_treatment VARCHAR(10);
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS chk_products_iva_treatment;
ALTER TABLE public.products ADD CONSTRAINT chk_products_iva_treatment
  CHECK (iva_treatment IS NULL OR iva_treatment IN ('GRAVADO', 'EXENTO', 'EXCLUIDO'));

COMMENT ON COLUMN public.products.iva_treatment IS
  'GRAVADO (tarifa > 0), EXENTO (Art. 477 E.T., tarifa 0 con derecho a reportar base) o EXCLUIDO (Art. 424 E.T., no causa IVA). NULL = producto al 0 % sin clasificar: no se puede facturar electrónicamente hasta clasificarlo.';

-- Solo se completa lo que es seguro: productos con tarifa > 0 y no marcados exentos son gravados.
UPDATE public.products
SET iva_treatment = 'GRAVADO'
WHERE iva_treatment IS NULL AND COALESCE(is_tax_exempt, false) = false AND COALESCE(tax_rate_percent, 0) > 0;

-- ------------------------------------------------------------------------------
-- 2. COPIA EN LA LÍNEA DE VENTA
-- ------------------------------------------------------------------------------
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS iva_treatment VARCHAR(10);
ALTER TABLE public.sale_items DROP CONSTRAINT IF EXISTS chk_sale_items_iva_treatment;
ALTER TABLE public.sale_items ADD CONSTRAINT chk_sale_items_iva_treatment
  CHECK (iva_treatment IS NULL OR iva_treatment IN ('GRAVADO', 'EXENTO', 'EXCLUIDO'));

-- El tratamiento lo decide el servidor a partir de la tarifa de la línea y del producto: el valor que
-- envíe el navegador se ignora. Solo el servidor (service_role / sesión de administración) puede fijarlo
-- explícitamente. En UPDATE desde el navegador se conserva el valor anterior; las funciones SECURITY
-- DEFINER (p. ej. la numeración de la factura) sí pueden completarlo.
-- Sin SECURITY DEFINER a propósito: CURRENT_USER debe ser quien escribe (authenticated o el dueño de la
-- función SECURITY DEFINER que llama), no el dueño de este trigger.
CREATE OR REPLACE FUNCTION public.fn_sale_item_set_iva_treatment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.iva_treatment IS DISTINCT FROM OLD.iva_treatment AND CURRENT_USER IN ('authenticated', 'anon') THEN
      NEW.iva_treatment := OLD.iva_treatment;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.iva_treatment IS NOT NULL AND public.fn_is_trusted_server_context() THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.tax_rate_percent, 0) > 0 THEN
    NEW.iva_treatment := 'GRAVADO';
  ELSE
    SELECT CASE WHEN p.iva_treatment IN ('EXENTO', 'EXCLUIDO') THEN p.iva_treatment ELSE NULL END
    INTO NEW.iva_treatment
    FROM public.products p WHERE p.id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sale_item_set_iva_treatment ON public.sale_items;
CREATE TRIGGER trg_sale_item_set_iva_treatment
  BEFORE INSERT OR UPDATE OF iva_treatment ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_sale_item_set_iva_treatment();

-- Ventas ya registradas: las líneas con IVA quedan como gravadas; las de 0 % toman la clasificación
-- actual del producto (si aún no está clasificado, se completa al facturar).
UPDATE public.sale_items SET iva_treatment = 'GRAVADO'
WHERE iva_treatment IS NULL AND COALESCE(tax_rate_percent, 0) > 0;

-- ------------------------------------------------------------------------------
-- 2b. FACTURA: NO SE NUMERA SI HAY PRODUCTOS AL 0 % SIN CLASIFICAR
-- (misma función de la migración 058 + validación de tratamiento de IVA)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_create_electronic_invoice_from_sale(
  p_sale_id UUID,
  p_idempotency_key VARCHAR,
  p_environment VARCHAR,
  p_software_id VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_company UUID;
  v_sale RECORD;
  v_existing RECORD;
  v_res RECORD;
  v_next BIGINT;
  v_max_used BIGINT;
  v_subtotal NUMERIC(15,2);
  v_tax NUMERIC(15,2);
  v_total NUMERIC(15,2);
  v_lines INT;
  v_missing TEXT;
  v_res_for_location INT;
  v_res_general INT;
  v_now_bogota TIMESTAMP := (NOW() AT TIME ZONE 'America/Bogota');
  v_invoice_id UUID := gen_random_uuid();
BEGIN
  IF p_environment IS NULL OR p_environment NOT IN ('HABILITACION', 'PRODUCCION') THEN
    RAISE EXCEPTION 'Ambiente DIAN inválido: %', p_environment USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NULL OR LENGTH(TRIM(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'Se requiere una clave de idempotencia válida.' USING ERRCODE = '22023';
  END IF;

  -- Bloqueo de la venta: serializa emisiones concurrentes de la misma venta (doble clic, dos pestañas, reintentos).
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La venta % no existe.', p_sale_id USING ERRCODE = 'P0002';
  END IF;
  v_company := v_sale.company_id;

  -- Autorización: usuario autenticado de la misma empresa con permiso de facturar.
  IF v_caller IS NOT NULL THEN
    IF public.get_auth_company_id() IS DISTINCT FROM v_company THEN
      RAISE EXCEPTION 'Acceso denegado: la venta no pertenece a su empresa.' USING ERRCODE = '42501';
    END IF;
    IF NOT (public.is_admin() OR public.has_permission('invoices.create')) THEN
      RAISE EXCEPTION 'Acceso denegado: requiere el permiso invoices.create.' USING ERRCODE = '42501';
    END IF;
    IF NOT (public.is_admin() OR public.has_location_access(v_sale.location_id)) THEN
      RAISE EXCEPTION 'Acceso denegado: la venta es de una sede que no tiene asignada.' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT public.fn_is_trusted_server_context() THEN
    RAISE EXCEPTION 'Acceso denegado: usuario no autenticado.' USING ERRCODE = '28000';
  END IF;

  -- El ambiente lo define la configuración activa de la empresa, no quien llama.
  IF p_environment IS DISTINCT FROM public.fn_dian_active_environment(v_company) THEN
    RAISE EXCEPTION 'El ambiente solicitado (%) no es el ambiente DIAN activo de la empresa (%).',
      p_environment, public.fn_dian_active_environment(v_company) USING ERRCODE = '55000';
  END IF;

  -- El Software ID se toma de la configuración de la empresa, no del parámetro.
  SELECT software_id INTO p_software_id
  FROM public.dian_software_config
  WHERE company_id = v_company AND environment = p_environment AND is_active = true;

  -- Idempotencia: misma clave → misma factura (doble clic, reintento, timeout).
  -- La clave usada para otra venta (o para una nota) es un error, nunca se devuelve otro documento.
  SELECT id, prefix, number, sale_id, document_type INTO v_existing
  FROM public.electronic_invoices
  WHERE company_id = v_company AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.document_type <> 'INVOICE' OR v_existing.sale_id IS DISTINCT FROM p_sale_id THEN
      RAISE EXCEPTION 'La clave de idempotencia ya se usó para otro documento electrónico (%). Genere una nueva.',
        v_existing.prefix || v_existing.number::TEXT USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object('success', true, 'idempotent_replay', true,
      'invoice_id', v_existing.id, 'prefix', v_existing.prefix, 'number', v_existing.number);
  END IF;

  -- Una venta solo puede tener una factura electrónica de venta.
  SELECT id, prefix, number INTO v_existing
  FROM public.electronic_invoices
  WHERE sale_id = p_sale_id AND document_type = 'INVOICE'
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'La venta % ya tiene la factura electrónica %.', v_sale.sale_number, v_existing.prefix || v_existing.number::TEXT
      USING ERRCODE = '23505';
  END IF;

  IF v_sale.status::TEXT = 'CANCELLED' THEN
    RAISE EXCEPTION 'No se puede facturar una venta anulada (%).', v_sale.sale_number USING ERRCODE = '55000';
  END IF;

  -- Totales desde las líneas (fuente de verdad), validados contra la cabecera.
  SELECT COALESCE(SUM(subtotal), 0), COALESCE(SUM(tax_amount), 0), COALESCE(SUM(total), 0), COUNT(*)
  INTO v_subtotal, v_tax, v_total, v_lines
  FROM public.sale_items WHERE sale_id = p_sale_id;

  IF v_lines = 0 THEN
    RAISE EXCEPTION 'La venta % no tiene líneas de producto.', v_sale.sale_number USING ERRCODE = '23502';
  END IF;
  IF ABS(v_total - v_sale.total_amount) > 0.01 THEN
    RAISE EXCEPTION 'Inconsistencia en la venta %: total de líneas % vs total de cabecera %.',
      v_sale.sale_number, v_total, v_sale.total_amount USING ERRCODE = '22000';
  END IF;

  -- IVA 0 %: cada producto debe estar clasificado como EXENTO o EXCLUIDO (se reportan distinto en el XML).
  -- Se valida ANTES de asignar el consecutivo y se fija la clasificación en la línea de la venta.
  SELECT string_agg(DISTINCT p.sku || ' ' || p.name, ', ') INTO v_missing
  FROM public.sale_items si JOIN public.products p ON p.id = si.product_id
  WHERE si.sale_id = p_sale_id AND COALESCE(si.tax_rate_percent, 0) = 0
    AND COALESCE(NULLIF(si.iva_treatment, 'GRAVADO'), CASE WHEN p.iva_treatment IN ('EXENTO', 'EXCLUIDO') THEN p.iva_treatment END) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Productos con IVA 0 %% sin clasificar como exento o excluido: %. Clasifíquelos en Productos → Tributación antes de facturar.', v_missing
      USING ERRCODE = '23502';
  END IF;
  UPDATE public.sale_items si
  SET iva_treatment = CASE WHEN COALESCE(si.tax_rate_percent, 0) > 0 THEN 'GRAVADO'
                           ELSE COALESCE(NULLIF(si.iva_treatment, 'GRAVADO'), p.iva_treatment) END
  FROM public.products p
  WHERE p.id = si.product_id AND si.sale_id = p_sale_id
    AND si.iva_treatment IS DISTINCT FROM (CASE WHEN COALESCE(si.tax_rate_percent, 0) > 0 THEN 'GRAVADO'
                                               ELSE COALESCE(NULLIF(si.iva_treatment, 'GRAVADO'), p.iva_treatment) END);

  -- Resolución vigente. Una de la sede prevalece sobre una general; si hay más de una candidata del
  -- mismo nivel no se elige en silencio (el consecutivo saldría de una resolución equivocada).
  SELECT COUNT(*) FILTER (WHERE r.location_id = v_sale.location_id),
         COUNT(*) FILTER (WHERE r.location_id IS NULL)
  INTO v_res_for_location, v_res_general
  FROM public.dian_resolutions r
  WHERE r.company_id = v_company
    AND r.environment = p_environment
    AND r.document_type = 'ELECTRONICA'
    AND r.is_active = true
    AND v_now_bogota::DATE BETWEEN r.valid_from AND r.valid_to
    AND (r.location_id IS NULL OR r.location_id = v_sale.location_id);

  IF v_res_for_location > 1 OR (v_res_for_location = 0 AND v_res_general > 1) THEN
    RAISE EXCEPTION 'Hay % resoluciones de facturación activas y vigentes para el ambiente % (%). Deje activa solo una.',
      GREATEST(v_res_for_location, v_res_general), p_environment,
      CASE WHEN v_res_for_location > 1 THEN 'de la sede de la venta' ELSE 'generales' END
      USING ERRCODE = '55000';
  END IF;

  -- Bloqueo de fila: serializa la asignación de consecutivos.
  SELECT * INTO v_res
  FROM public.dian_resolutions r
  WHERE r.company_id = v_company
    AND r.environment = p_environment
    AND r.document_type = 'ELECTRONICA'
    AND r.is_active = true
    AND v_now_bogota::DATE BETWEEN r.valid_from AND r.valid_to
    AND (r.location_id IS NULL OR r.location_id = v_sale.location_id)
  ORDER BY (r.location_id IS NULL) ASC, r.valid_to ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No hay resolución de facturación electrónica activa y vigente para el ambiente %.', p_environment
      USING ERRCODE = 'P0002';
  END IF;

  -- Siguiente consecutivo: nunca por debajo de lo ya usado con ese prefijo.
  SELECT MAX(number) INTO v_max_used
  FROM public.electronic_invoices
  WHERE prefix = v_res.dian_prefix AND number BETWEEN v_res.initial_range AND v_res.final_range;

  v_next := GREATEST(
    COALESCE(v_res.last_assigned_number + 1, v_res.initial_range),
    COALESCE(v_max_used + 1, v_res.initial_range)
  );

  IF v_next > v_res.final_range THEN
    RAISE EXCEPTION 'Rango de numeración agotado: resolución %, prefijo %, rango % - %.',
      v_res.resolution_number, v_res.dian_prefix, v_res.initial_range, v_res.final_range
      USING ERRCODE = '55000';
  END IF;

  UPDATE public.dian_resolutions
  SET last_assigned_number = v_next,
      current_number = v_next,
      updated_at = NOW(),
      updated_by_user_id = COALESCE(v_caller, updated_by_user_id)
  WHERE id = v_res.id;

  INSERT INTO public.electronic_invoices (
    id, company_id, location_id, sale_id, customer_id,
    prefix, number, dian_prefix, dian_number, internal_number, dian_resolution,
    document_type, subtotal_amount, tax_amount, total_amount,
    dian_status, environment, software_id, idempotency_key,
    dian_resolution_id, resolution_date, resolution_valid_from, resolution_valid_to,
    resolution_range_from, resolution_range_to,
    issue_date, issue_time, transmission_state, created_by_user_id,
    created_at, updated_at
  ) VALUES (
    v_invoice_id, v_company, v_sale.location_id, v_sale.id, v_sale.customer_id,
    v_res.dian_prefix, v_next, v_res.dian_prefix, v_next, v_sale.sale_number, v_res.resolution_number,
    'INVOICE', v_subtotal, v_tax, v_total,
    'PENDING', p_environment, p_software_id, p_idempotency_key,
    v_res.id, v_res.resolution_date, v_res.valid_from, v_res.valid_to,
    v_res.initial_range, v_res.final_range,
    v_now_bogota::DATE, TO_CHAR(v_now_bogota, 'HH24:MI:SS') || '-05:00', 'NUMBERED', v_caller,
    NOW(), NOW()
  );

  INSERT INTO public.dian_events (invoice_id, company_id, created_by_user_id, environment, event_type, status, payload_sent)
  VALUES (v_invoice_id, v_company, v_caller, p_environment, 'NUMBER_ASSIGNED', 'SUCCESS',
    jsonb_build_object('prefix', v_res.dian_prefix, 'number', v_next, 'resolution', v_res.resolution_number,
                       'sale_number', v_sale.sale_number));

  INSERT INTO public.audit_logs (company_id, user_id, user_name, action, module, entity_name, entity_id, location_id, new_value, created_at)
  VALUES (v_company, v_caller,
    COALESCE((SELECT full_name FROM public.users WHERE id = v_caller), 'Sistema'),
    'ELECTRONIC_INVOICE_NUMBERED', 'INVOICES', 'electronic_invoices', v_invoice_id::TEXT, v_sale.location_id,
    jsonb_build_object('prefix', v_res.dian_prefix, 'number', v_next, 'sale_id', v_sale.id,
                       'environment', p_environment, 'total', v_total),
    NOW());

  RETURN jsonb_build_object(
    'success', true,
    'idempotent_replay', false,
    'invoice_id', v_invoice_id,
    'prefix', v_res.dian_prefix,
    'number', v_next,
    'resolution_number', v_res.resolution_number,
    'remaining_numbers', v_res.final_range - v_next
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_create_electronic_invoice_from_sale(UUID, VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_create_electronic_invoice_from_sale(UUID, VARCHAR, VARCHAR, VARCHAR) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. NOTAS: COLUMNAS Y LÍNEAS
-- ------------------------------------------------------------------------------
ALTER TABLE public.electronic_invoices
  ADD COLUMN IF NOT EXISTS note_concept_code VARCHAR(2),
  ADD COLUMN IF NOT EXISTS note_reason TEXT;

ALTER TABLE public.electronic_invoices DROP CONSTRAINT IF EXISTS chk_electronic_invoices_note_concept;
ALTER TABLE public.electronic_invoices ADD CONSTRAINT chk_electronic_invoices_note_concept CHECK (
  (document_type = 'INVOICE')
  OR (document_type = 'CREDIT_NOTE' AND (note_concept_code IS NULL OR note_concept_code IN ('1','2','3','4','5','6')))
  OR (document_type = 'DEBIT_NOTE' AND (note_concept_code IS NULL OR note_concept_code IN ('1','2','3','4')))
) NOT VALID;

CREATE TABLE IF NOT EXISTS public.electronic_document_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.electronic_invoices(id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  line_number INT NOT NULL,
  source_sale_item_id UUID REFERENCES public.sale_items(id) ON DELETE RESTRICT,
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  sku VARCHAR(80),
  description TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(15,2) NOT NULL CHECK (unit_price >= 0),
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent < 100),
  net_amount NUMERIC(15,2) NOT NULL CHECK (net_amount > 0),
  iva_treatment VARCHAR(10) NOT NULL CHECK (iva_treatment IN ('GRAVADO', 'EXENTO', 'EXCLUIDO')),
  tax_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (tax_rate_percent >= 0),
  tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount NUMERIC(15,2) NOT NULL,
  quantity_returned BOOLEAN NOT NULL DEFAULT false, -- true: crédito por cantidad (devolución); false: crédito por valor
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_electronic_document_lines UNIQUE (document_id, line_number),
  CONSTRAINT chk_edl_tax_consistency CHECK (
    (iva_treatment = 'GRAVADO' AND tax_rate_percent > 0) OR (iva_treatment IN ('EXENTO', 'EXCLUIDO') AND tax_rate_percent = 0 AND tax_amount = 0)
  )
);
CREATE INDEX IF NOT EXISTS idx_edl_document ON public.electronic_document_lines (document_id);
CREATE INDEX IF NOT EXISTS idx_edl_sale_item ON public.electronic_document_lines (source_sale_item_id);

ALTER TABLE public.electronic_document_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant select electronic_document_lines" ON public.electronic_document_lines;
-- Mismo filtro que electronic_invoices (022): empresa, sede del documento y permiso de lectura.
CREATE POLICY "Tenant select electronic_document_lines" ON public.electronic_document_lines
  FOR SELECT TO authenticated
  USING (
    company_id = get_auth_company_id()
    AND (has_permission('invoices.read') OR has_permission('sales.read') OR is_admin())
    AND EXISTS (
      SELECT 1 FROM public.electronic_invoices d
      WHERE d.id = electronic_document_lines.document_id
        AND (is_admin() OR has_location_access(d.location_id))
    )
  );
-- Sin políticas de escritura: solo las crea fn_create_electronic_note (SECURITY DEFINER).

-- ------------------------------------------------------------------------------
-- 4. CONSECUTIVO DE NOTAS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dian_note_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  environment VARCHAR(20) NOT NULL CHECK (environment IN ('HABILITACION', 'PRODUCCION')),
  document_type VARCHAR(30) NOT NULL CHECK (document_type IN ('CREDIT_NOTE', 'DEBIT_NOTE')),
  prefix VARCHAR(4) NOT NULL CHECK (prefix ~ '^[A-Z0-9]{1,4}$'),
  last_number BIGINT NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_dian_note_sequences UNIQUE (company_id, environment, document_type)
);
ALTER TABLE public.dian_note_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant select dian_note_sequences" ON public.dian_note_sequences;
CREATE POLICY "Tenant select dian_note_sequences" ON public.dian_note_sequences
  FOR SELECT TO authenticated USING (company_id = get_auth_company_id());
-- Sin políticas de escritura: el consecutivo solo lo mueve fn_create_electronic_note.
DROP POLICY IF EXISTS "Admin update dian_note_sequences" ON public.dian_note_sequences;

-- Prefijos de habilitación (NCT/NDT = pruebas). Producción se configura al pasar a producción.
INSERT INTO public.dian_note_sequences (company_id, environment, document_type, prefix)
SELECT c.id, 'HABILITACION', x.dt, x.pf
FROM public.companies c
CROSS JOIN (VALUES ('CREDIT_NOTE', 'NCT'), ('DEBIT_NOTE', 'NDT')) AS x(dt, pf)
ON CONFLICT (company_id, environment, document_type) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 5. CUENTAS CONTABLES PARA NOTAS
-- ------------------------------------------------------------------------------
-- Se crean aunque falte la cuenta padre (parent_id queda vacío y el contador puede ubicarlas).
INSERT INTO public.accounting_accounts (code, name, account_class, level, parent_id, nature, requires_third_party, is_active)
SELECT '4175', 'Devoluciones, rebajas y descuentos en ventas (DB)', 4, 3, (SELECT id FROM public.accounting_accounts WHERE code = '41'), 'DEBIT', false, true
WHERE NOT EXISTS (SELECT 1 FROM public.accounting_accounts WHERE code = '4175');

INSERT INTO public.accounting_accounts (code, name, account_class, level, parent_id, nature, requires_third_party, is_active)
SELECT '42', 'No operacionales', 4, 2, (SELECT id FROM public.accounting_accounts WHERE code = '4'), 'CREDIT', false, true
WHERE NOT EXISTS (SELECT 1 FROM public.accounting_accounts WHERE code = '42');

INSERT INTO public.accounting_accounts (code, name, account_class, level, parent_id, nature, requires_third_party, is_active)
SELECT '4210', 'Financieros', 4, 3, (SELECT id FROM public.accounting_accounts WHERE code = '42'), 'CREDIT', false, true
WHERE NOT EXISTS (SELECT 1 FROM public.accounting_accounts WHERE code = '4210');

INSERT INTO public.accounting_accounts (code, name, account_class, level, parent_id, nature, requires_third_party, is_active)
SELECT '421005', 'Intereses', 4, 4, (SELECT id FROM public.accounting_accounts WHERE code = '4210'), 'CREDIT', false, true
WHERE NOT EXISTS (SELECT 1 FROM public.accounting_accounts WHERE code = '421005');

ALTER TABLE public.accounting_default_accounts DROP CONSTRAINT IF EXISTS chk_accounting_default_accounts_purpose;
ALTER TABLE public.accounting_default_accounts ADD CONSTRAINT chk_accounting_default_accounts_purpose CHECK (purpose IN (
  'CASH', 'CUSTOMER_CREDIT', 'SALES_INCOME', 'VAT_GENERATED', 'COST_OF_SALES', 'INVENTORY',
  'SALES_RETURNS',     -- Devoluciones, rebajas y descuentos en ventas (4175xx): notas crédito
  'FINANCIAL_INCOME'   -- Ingresos financieros por intereses (421005): notas débito por intereses
));

INSERT INTO public.accounting_default_accounts (company_id, purpose, accounting_account_id)
SELECT c.id, x.purpose, a.id
FROM public.companies c
CROSS JOIN (VALUES ('SALES_RETURNS', '4175'), ('FINANCIAL_INCOME', '421005')) AS x(purpose, code)
JOIN public.accounting_accounts a ON a.code = x.code AND a.is_active = true
ON CONFLICT (company_id, purpose) DO NOTHING;

-- Versión única de la siembra para empresas nuevas (la migración 059 ya no la define).
CREATE OR REPLACE FUNCTION public.fn_seed_default_accounts_for_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.accounting_default_accounts (company_id, purpose, accounting_account_id)
  SELECT NEW.id, x.purpose, a.id
  FROM (VALUES ('CASH', '110505'), ('CUSTOMER_CREDIT', '130505'), ('SALES_INCOME', '4135'),
               ('VAT_GENERATED', '2408'), ('COST_OF_SALES', '6135'), ('INVENTORY', '1435'),
               ('SALES_RETURNS', '4175'), ('FINANCIAL_INCOME', '421005')) AS x(purpose, code)
  JOIN public.accounting_accounts a ON a.code = x.code AND a.is_active = true
  ON CONFLICT (company_id, purpose) DO NOTHING;

  INSERT INTO public.dian_note_sequences (company_id, environment, document_type, prefix)
  VALUES (NEW.id, 'HABILITACION', 'CREDIT_NOTE', 'NCT'), (NEW.id, 'HABILITACION', 'DEBIT_NOTE', 'NDT')
  ON CONFLICT (company_id, environment, document_type) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Empresas creadas después reciben sus cuentas por defecto y sus consecutivos de notas.
DROP TRIGGER IF EXISTS trg_seed_default_accounts_for_company ON public.companies;
CREATE TRIGGER trg_seed_default_accounts_for_company
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.fn_seed_default_accounts_for_company();

-- Consecutivos contables de notas (NCR-2026-000001 / NDB-2026-000001): fn_next_accounting_consecutive
-- ya los genera desde la migración 059 (versión única), no se redefine aquí.

-- ------------------------------------------------------------------------------
-- 6. CREACIÓN ATÓMICA DE NOTA CRÉDITO / DÉBITO
-- ------------------------------------------------------------------------------
-- p_lines (nota crédito, conceptos 3,4,5,6):
--   [{ "sale_item_id": uuid, "quantity": n }]       → crédito por cantidad (proporcional a la línea facturada)
--   [{ "sale_item_id": uuid, "net_amount": v }]     → crédito por valor (rebaja/descuento/ajuste, antes de IVA)
-- Concepto 1 (devolución): exige p_return_id; se ignoran p_lines.
-- Concepto 2 (anulación): se ignoran p_lines; la nota acredita la factura completa (omite líneas de valor 0)
--   y no marca cantidades devueltas (no hubo devolución de mercancía).
-- p_return_id (nota crédito, concepto 1): devolución ya registrada en el módulo Devoluciones
--   (ella movió el inventario). Las cantidades salen de la devolución.
-- p_environment: debe ser el ambiente DIAN activo de la empresa (fn_dian_active_environment, 058).
-- p_lines (nota débito):
--   [{ "description": txt, "quantity": n, "unit_price": v, "iva": "IVA_19"|"IVA_5"|"EXENTO"|"EXCLUIDO", "product_id": uuid? }]
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
    IF v_ret_cost > 0 THEN
      v_acc_lines := v_acc_lines || jsonb_build_object(
        'account_id', public.fn_get_default_account(v_orig.company_id, 'INVENTORY'),
        'debit_amount', ROUND(v_ret_cost, 2), 'credit_amount', 0,
        'description', 'Reingreso inventario devolución ' || v_ret.code);
      v_acc_lines := v_acc_lines || jsonb_build_object(
        'account_id', public.fn_get_default_account(v_orig.company_id, 'COST_OF_SALES'),
        'debit_amount', 0, 'credit_amount', ROUND(v_ret_cost, 2),
        'description', 'Reversión costo de ventas devolución ' || v_ret.code);
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
