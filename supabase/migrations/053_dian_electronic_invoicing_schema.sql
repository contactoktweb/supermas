-- ==============================================================================
-- MIGRACIÓN 053: MODELO DE DATOS Y ENDURECIMIENTO FACTURACIÓN ELECTRÓNICA DIAN
-- SUPER MÁS ERP/POS — ANEXO TÉCNICO 1.9 / RESOLUCIÓN 000165 DE 2023
-- ==============================================================================
--
-- Objetivos:
-- 1. Extender public.electronic_invoices con soporte para Notas Crédito/Débito,
--    idempotencia multiempresa, ambiente (HABILITACION/PRODUCCION), XMLs firmados
--    y trazabilidad oficial de respuestas DIAN.
-- 2. Garantizar la regla relacional estricta:
--    - Facturas (INVOICE): sale_id es OBLIGATORIO.
--    - Notas Crédito/Débito: original_invoice_id es OBLIGATORIO, return_id opcional.
-- 3. Crear tabla public.dian_software_config para metadata del software propio
--    sin almacenar secretos en texto plano (referencias a vault/env).
-- 4. Extender public.dian_resolutions con soporte de ambiente fiscal y endurecer RLS.
-- 5. Extender public.dian_events con multi-tenancy e inmutabilidad estricta (append-only).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIÓN DE public.electronic_invoices
-- ------------------------------------------------------------------------------

-- 1.1 Permitir que sale_id sea nulo únicamente para notas crédito/débito
ALTER TABLE public.electronic_invoices ALTER COLUMN sale_id DROP NOT NULL;

-- 1.2 Agregar columnas de relación y trazabilidad fiscal
ALTER TABLE public.electronic_invoices
  ADD COLUMN IF NOT EXISTS original_invoice_id UUID REFERENCES public.electronic_invoices(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS return_id UUID REFERENCES public.returns(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(120),
  ADD COLUMN IF NOT EXISTS environment VARCHAR(20) NOT NULL DEFAULT 'HABILITACION',
  ADD COLUMN IF NOT EXISTS software_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS xml_unsigned TEXT,
  ADD COLUMN IF NOT EXISTS xml_signed TEXT,
  ADD COLUMN IF NOT EXISTS application_response_xml TEXT,
  ADD COLUMN IF NOT EXISTS dian_status_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS dian_validation_errors JSONB,
  ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;

-- 1.3 Restricción de integridad relacional según tipo de documento
ALTER TABLE public.electronic_invoices
  DROP CONSTRAINT IF EXISTS chk_electronic_invoices_doc_relationships;

ALTER TABLE public.electronic_invoices
  ADD CONSTRAINT chk_electronic_invoices_doc_relationships CHECK (
    (document_type = 'INVOICE' AND sale_id IS NOT NULL) OR
    (document_type IN ('CREDIT_NOTE', 'DEBIT_NOTE') AND original_invoice_id IS NOT NULL)
  );

-- 1.4 Restricción de ambiente fiscal controlado
ALTER TABLE public.electronic_invoices
  DROP CONSTRAINT IF EXISTS chk_electronic_invoices_env;

ALTER TABLE public.electronic_invoices
  ADD CONSTRAINT chk_electronic_invoices_env CHECK (
    environment IN ('HABILITACION', 'PRODUCCION')
  );

-- 1.5 Restricción de idempotencia única por empresa (aislamiento multi-tenant)
ALTER TABLE public.electronic_invoices
  DROP CONSTRAINT IF EXISTS uq_electronic_invoices_company_idempotency;

ALTER TABLE public.electronic_invoices
  ADD CONSTRAINT uq_electronic_invoices_company_idempotency UNIQUE (company_id, idempotency_key);

-- 1.6 Índices para optimización de consultas operativas y multi-tenant
CREATE INDEX IF NOT EXISTS idx_electronic_invoices_company_env
  ON public.electronic_invoices (company_id, environment);

CREATE INDEX IF NOT EXISTS idx_electronic_invoices_original
  ON public.electronic_invoices (original_invoice_id);

CREATE INDEX IF NOT EXISTS idx_electronic_invoices_return
  ON public.electronic_invoices (return_id);

CREATE INDEX IF NOT EXISTS idx_electronic_invoices_dian_status
  ON public.electronic_invoices (company_id, dian_status);

-- ------------------------------------------------------------------------------
-- 2. TABLA DE CONFIGURACIÓN DEL SOFTWARE DIAN (public.dian_software_config)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.dian_software_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  software_id VARCHAR(100) NOT NULL,
  software_name VARCHAR(150) NOT NULL DEFAULT 'Super Mas ERP',
  pin_secret_ref VARCHAR(100) NOT NULL DEFAULT 'DIAN_SOFTWARE_PIN',
  environment VARCHAR(20) NOT NULL DEFAULT 'HABILITACION',
  operation_mode VARCHAR(50) NOT NULL DEFAULT 'SOFTWARE_PROPIO',
  certificate_alias VARCHAR(150),
  certificate_secret_ref VARCHAR(100) DEFAULT 'DIAN_CERTIFICATE_SECRET',
  certificate_issuer VARCHAR(150),
  certificate_valid_from DATE,
  certificate_expiration DATE,
  test_set_id VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID REFERENCES public.users(id),
  updated_by_user_id UUID REFERENCES public.users(id),
  CONSTRAINT uq_dian_software_config_company_env UNIQUE (company_id, environment),
  CONSTRAINT chk_dian_software_env CHECK (environment IN ('HABILITACION', 'PRODUCCION')),
  CONSTRAINT chk_dian_software_mode CHECK (operation_mode IN ('SOFTWARE_PROPIO'))
);

CREATE INDEX IF NOT EXISTS idx_dian_software_config_company
  ON public.dian_software_config (company_id);

-- RLS en public.dian_software_config
ALTER TABLE public.dian_software_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation select dian_software_config" ON public.dian_software_config;
CREATE POLICY "Tenant isolation select dian_software_config"
  ON public.dian_software_config
  FOR SELECT
  TO authenticated
  USING (
    company_id = get_auth_company_id() AND
    (is_admin() OR has_permission('dian.manage') OR has_permission('settings.read') OR has_permission('invoices.read'))
  );

DROP POLICY IF EXISTS "Tenant isolation insert dian_software_config" ON public.dian_software_config;
CREATE POLICY "Tenant isolation insert dian_software_config"
  ON public.dian_software_config
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = get_auth_company_id() AND
    (is_admin() OR has_permission('dian.manage'))
  );

DROP POLICY IF EXISTS "Tenant isolation update dian_software_config" ON public.dian_software_config;
CREATE POLICY "Tenant isolation update dian_software_config"
  ON public.dian_software_config
  FOR UPDATE
  TO authenticated
  USING (
    company_id = get_auth_company_id() AND
    (is_admin() OR has_permission('dian.manage'))
  )
  WITH CHECK (
    company_id = get_auth_company_id() AND
    (is_admin() OR has_permission('dian.manage'))
  );

-- Prohibición de eliminación física de la configuración fiscal
DROP POLICY IF EXISTS "Prevent delete dian_software_config" ON public.dian_software_config;
CREATE POLICY "Prevent delete dian_software_config"
  ON public.dian_software_config
  FOR DELETE
  TO authenticated
  USING (false);

-- ------------------------------------------------------------------------------
-- 3. EXTENSIÓN Y ENDURECIMIENTO DE public.dian_resolutions
-- ------------------------------------------------------------------------------

ALTER TABLE public.dian_resolutions
  ADD COLUMN IF NOT EXISTS environment VARCHAR(20) NOT NULL DEFAULT 'HABILITACION';

ALTER TABLE public.dian_resolutions
  DROP CONSTRAINT IF EXISTS chk_dian_resolutions_env;

ALTER TABLE public.dian_resolutions
  ADD CONSTRAINT chk_dian_resolutions_env CHECK (
    environment IN ('HABILITACION', 'PRODUCCION')
  );

CREATE INDEX IF NOT EXISTS idx_dian_resolutions_company_env
  ON public.dian_resolutions (company_id, environment);

-- Endurecimiento estricto de RLS con aislamiento multi-tenant
DROP POLICY IF EXISTS "dian_resolutions_policy" ON public.dian_resolutions;
DROP POLICY IF EXISTS "Tenant isolation select dian_resolutions" ON public.dian_resolutions;
CREATE POLICY "Tenant isolation select dian_resolutions"
  ON public.dian_resolutions
  FOR SELECT
  TO authenticated
  USING (
    company_id = get_auth_company_id() AND
    (is_admin() OR (location_id IS NULL) OR has_location_access(location_id))
  );

DROP POLICY IF EXISTS "Tenant isolation manage dian_resolutions" ON public.dian_resolutions;
CREATE POLICY "Tenant isolation manage dian_resolutions"
  ON public.dian_resolutions
  FOR ALL
  TO authenticated
  USING (
    company_id = get_auth_company_id() AND
    (is_admin() OR has_permission('dian.manage'))
  )
  WITH CHECK (
    company_id = get_auth_company_id() AND
    (is_admin() OR has_permission('dian.manage'))
  );

-- ------------------------------------------------------------------------------
-- 4. EXTENSIÓN E INMUTABILIDAD DE public.dian_events
-- ------------------------------------------------------------------------------

ALTER TABLE public.dian_events
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS environment VARCHAR(20) NOT NULL DEFAULT 'HABILITACION';

CREATE INDEX IF NOT EXISTS idx_dian_events_invoice_id
  ON public.dian_events (invoice_id);

CREATE INDEX IF NOT EXISTS idx_dian_events_company_id
  ON public.dian_events (company_id);

-- Función e inmutabilidad de eventos DIAN (Append-Only)
CREATE OR REPLACE FUNCTION public.fn_prevent_dian_event_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'INMUTABILIDAD FISCAL: Los registros de eventos DIAN (dian_events) son estrictamente append-only. Prohibido UPDATE o DELETE.'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_dian_event_modification ON public.dian_events;
CREATE TRIGGER trg_prevent_dian_event_modification
  BEFORE UPDATE OR DELETE ON public.dian_events
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_prevent_dian_event_modification();

-- Actualización de políticas RLS en public.dian_events
DROP POLICY IF EXISTS "Tenant isolation select dian_events" ON public.dian_events;
CREATE POLICY "Tenant isolation select dian_events"
  ON public.dian_events
  FOR SELECT
  TO authenticated
  USING (
    (company_id = get_auth_company_id() OR (company_id IS NULL AND EXISTS (
      SELECT 1 FROM public.electronic_invoices ei
      WHERE ei.id = dian_events.invoice_id AND ei.company_id = get_auth_company_id()
    ))) AND
    (is_admin() OR has_permission('invoices.read') OR has_permission('dian.manage'))
  );

DROP POLICY IF EXISTS "Tenant isolation insert dian_events" ON public.dian_events;
CREATE POLICY "Tenant isolation insert dian_events"
  ON public.dian_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (company_id = get_auth_company_id() OR (company_id IS NULL AND EXISTS (
      SELECT 1 FROM public.electronic_invoices ei
      WHERE ei.id = dian_events.invoice_id AND ei.company_id = get_auth_company_id()
    ))) AND
    (is_admin() OR has_permission('invoices.create') OR has_permission('dian.manage'))
  );
