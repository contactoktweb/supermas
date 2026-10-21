-- ==============================================================================
-- MIGRACIÓN 058: NUMERACIÓN DIAN ATÓMICA, SNAPSHOT DE RESOLUCIÓN Y BLINDAJE FISCAL
-- SUPER MÁS ERP/POS — Facturación Electrónica (Software Propio) — HABILITACIÓN
-- ==============================================================================
--
-- Qué hace (sin borrar datos, sin modificar usuarios ni roles):
-- 1. Campos fiscales DIAN del emisor (companies) y del adquiriente (customers).
-- 2. dian_resolutions: puntero de último consecutivo asignado (last_assigned_number)
--    y prohibición de guardar la clave técnica en base de datos (va en secretos del servidor).
-- 3. electronic_invoices: snapshot de la resolución usada, fecha/hora de emisión,
--    SoftwareSecurityCode, TrackId, nombres de archivo y estado de transmisión detallado.
-- 4. fn_create_electronic_invoice_from_sale(): crea la factura y asigna el consecutivo
--    DIAN de forma atómica (bloqueo de fila sobre la resolución), idempotente.
-- 5. Trigger de blindaje: desde el navegador (rol authenticated) nadie puede marcar
--    una factura como ACEPTADA, ni escribir CUFE, XML, respuesta DIAN o alterar
--    numeración y totales. Solo el servidor (service_role) o funciones SECURITY DEFINER.
--
-- Requiere: migraciones 001–057 aplicadas.
-- Reversible: solo agrega columnas, funciones, constraint NOT VALID y trigger.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. DATOS FISCALES DIAN DEL EMISOR Y ADQUIRIENTE
-- ------------------------------------------------------------------------------
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(2) DEFAULT 'CO',
  ADD COLUMN IF NOT EXISTS dian_department_code VARCHAR(2),      -- DANE departamento (ej. 54)
  ADD COLUMN IF NOT EXISTS dian_municipality_code VARCHAR(5),    -- DANE municipio (ej. 54001)
  ADD COLUMN IF NOT EXISTS postal_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS dian_organization_type VARCHAR(1),    -- 1 = Persona jurídica, 2 = Persona natural
  ADD COLUMN IF NOT EXISTS rut_responsibilities VARCHAR(100),    -- Casilla 53 del RUT, separada por ';'
  ADD COLUMN IF NOT EXISTS dian_tax_level_codes VARCHAR(100),    -- Tabla 13.2.6.1 Anexo (O-13, O-15, O-23, O-47, R-99-PN)
  ADD COLUMN IF NOT EXISTS dian_tax_scheme_code VARCHAR(5);      -- 01 = IVA, ZZ = No aplica

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS dian_municipality_code VARCHAR(5),
  ADD COLUMN IF NOT EXISTS dian_tax_level_codes VARCHAR(100),
  ADD COLUMN IF NOT EXISTS dian_tax_scheme_code VARCHAR(5);

-- ------------------------------------------------------------------------------
-- 2. RESOLUCIONES: PUNTERO DE CONSECUTIVO Y CLAVE TÉCNICA FUERA DE LA BD
-- ------------------------------------------------------------------------------
ALTER TABLE public.dian_resolutions
  ADD COLUMN IF NOT EXISTS last_assigned_number BIGINT;

-- La clave técnica es secreta: vive en variables del servidor (DIAN_TEST_TECHNICAL_KEY /
-- DIAN_PRODUCTION_TECHNICAL_KEY). NOT VALID: no falla con filas antiguas, aplica a nuevas/actualizadas.
ALTER TABLE public.dian_resolutions DROP CONSTRAINT IF EXISTS chk_dian_resolutions_no_technical_key;
ALTER TABLE public.dian_resolutions
  ADD CONSTRAINT chk_dian_resolutions_no_technical_key CHECK (technical_key IS NULL) NOT VALID;

ALTER TABLE public.dian_resolutions DROP CONSTRAINT IF EXISTS chk_dian_resolutions_last_assigned;
ALTER TABLE public.dian_resolutions
  ADD CONSTRAINT chk_dian_resolutions_last_assigned CHECK (
    last_assigned_number IS NULL OR (last_assigned_number >= initial_range AND last_assigned_number <= final_range)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_dian_resolutions_company_env_prefix_number
  ON public.dian_resolutions (company_id, environment, dian_prefix, resolution_number);

-- ------------------------------------------------------------------------------
-- 3. FACTURAS: SNAPSHOT DE RESOLUCIÓN Y TRAZABILIDAD DE TRANSMISIÓN
-- ------------------------------------------------------------------------------
ALTER TABLE public.electronic_invoices
  ADD COLUMN IF NOT EXISTS dian_resolution_id UUID REFERENCES public.dian_resolutions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS resolution_date DATE,
  ADD COLUMN IF NOT EXISTS resolution_valid_from DATE,
  ADD COLUMN IF NOT EXISTS resolution_valid_to DATE,
  ADD COLUMN IF NOT EXISTS resolution_range_from BIGINT,
  ADD COLUMN IF NOT EXISTS resolution_range_to BIGINT,
  ADD COLUMN IF NOT EXISTS issue_date DATE,
  ADD COLUMN IF NOT EXISTS issue_time VARCHAR(14),               -- HH:MM:SS-05:00
  ADD COLUMN IF NOT EXISTS software_security_code VARCHAR(96),
  ADD COLUMN IF NOT EXISTS dian_track_id VARCHAR(120),
  ADD COLUMN IF NOT EXISTS xml_file_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS zip_file_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS transmission_state VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES public.users(id);

ALTER TABLE public.electronic_invoices DROP CONSTRAINT IF EXISTS chk_electronic_invoices_transmission_state;
ALTER TABLE public.electronic_invoices
  ADD CONSTRAINT chk_electronic_invoices_transmission_state CHECK (
    transmission_state IN (
      'PENDING',              -- Creada, aún sin XML
      'NUMBERED',             -- Consecutivo DIAN asignado
      'XML_BUILT',            -- XML UBL 2.1 + CUFE + QR generados (sin firma)
      'SIGNED',               -- Firmado XAdES-BES
      'SENDING',              -- Reservada por el servidor mientras transmite (evita envíos simultáneos)
      'SENT',                 -- Enviado; esperando validación (TrackId)
      'ACCEPTED',             -- DIAN respondió aceptado
      'REJECTED',             -- DIAN respondió rechazado
      'COMMUNICATION_ERROR',  -- Falla de red/timeout: reintentable sin consumir nuevo consecutivo
      'BLOCKED_CONFIG'        -- Falta configuración (certificado, PIN, clave técnica)
    )
  );

CREATE INDEX IF NOT EXISTS idx_electronic_invoices_resolution ON public.electronic_invoices (dian_resolution_id);

-- Una venta = una sola factura electrónica de venta. Si hay datos antiguos duplicados (flujos simulados),
-- no se crea el índice y se avisa: la función de numeración igual lo impide con bloqueo de fila.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.electronic_invoices WHERE document_type = 'INVOICE' AND sale_id IS NOT NULL
    GROUP BY sale_id HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'Hay ventas con más de una factura (datos anteriores). No se creó uq_electronic_invoices_one_per_sale; revise con la auditoría.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_electronic_invoices_one_per_sale
      ON public.electronic_invoices (sale_id) WHERE document_type = 'INVOICE';
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_electronic_invoices_track ON public.electronic_invoices (dian_track_id);

-- ------------------------------------------------------------------------------
-- 3b. CONTEXTO DE SERVIDOR CONFIABLE
-- ------------------------------------------------------------------------------
-- Dentro de una función SECURITY DEFINER, CURRENT_USER es siempre el dueño (postgres),
-- así que no sirve para saber quién llama. Se confía solo en: JWT de service_role
-- (servidor del ERP) o una sesión directa de administración de base de datos.
CREATE OR REPLACE FUNCTION public.fn_is_trusted_server_context()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT auth.uid() IS NULL
     AND (COALESCE(auth.role(), '') = 'service_role' OR session_user IN ('postgres', 'supabase_admin'));
$$;

-- ------------------------------------------------------------------------------
-- 4. CREACIÓN ATÓMICA DE FACTURA ELECTRÓNICA + CONSECUTIVO DIAN
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
SET search_path = public, pg_catalog
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
  ELSIF NOT public.fn_is_trusted_server_context() THEN
    RAISE EXCEPTION 'Acceso denegado: usuario no autenticado.' USING ERRCODE = '28000';
  END IF;

  -- El Software ID se toma de la configuración de la empresa, no del parámetro.
  SELECT software_id INTO p_software_id
  FROM public.dian_software_config
  WHERE company_id = v_company AND environment = p_environment AND is_active = true
  LIMIT 1;

  -- Idempotencia: misma clave → misma factura (doble clic, reintento, timeout).
  SELECT id, prefix, number INTO v_existing
  FROM public.electronic_invoices
  WHERE company_id = v_company AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
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

  -- Resolución vigente (bloqueo de fila: serializa la asignación de consecutivos).
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
-- 5. BLINDAJE: EL NAVEGADOR NO PUEDE FALSIFICAR ESTADOS NI DATOS FISCALES
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_guard_electronic_invoice_fiscal_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Servidor (service_role) y funciones SECURITY DEFINER (dueño postgres) pasan.
  IF CURRENT_USER NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  -- Desde el navegador no se crean documentos fiscales: los numera y genera el servidor.
  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'BLINDAJE FISCAL: los documentos electrónicos (facturas y notas) solo los crea el servidor de facturación.'
      USING ERRCODE = '42501';
  END IF;

  -- En UPDATE solo se permite cambiar campos no fiscales (lista permitida).
  IF (to_jsonb(NEW) - ARRAY['updated_at', 'pdf_url']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['updated_at', 'pdf_url']) THEN
    RAISE EXCEPTION 'BLINDAJE FISCAL: los datos fiscales y el estado DIAN solo los modifica el servidor de facturación.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_electronic_invoice_fiscal_fields ON public.electronic_invoices;
CREATE TRIGGER trg_guard_electronic_invoice_fiscal_fields
  BEFORE INSERT OR UPDATE ON public.electronic_invoices
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_electronic_invoice_fiscal_fields();

-- ------------------------------------------------------------------------------
-- 6. EVENTOS DIAN: SOLO EL SERVIDOR LOS ESCRIBE (evita historial "aceptado" falso desde el navegador)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Tenant isolation insert dian_events" ON public.dian_events;

COMMIT;
