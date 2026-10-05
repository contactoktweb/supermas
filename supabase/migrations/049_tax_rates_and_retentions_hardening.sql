-- ==============================================================================
-- 049_TAX_RATES_AND_RETENTIONS_HARDENING.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- Enriquecimiento y persistencia fiduciaria de configuraciones tributarias y retenciones
-- ==============================================================================

ALTER TABLE public.tax_rates
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS valid_from DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS valid_until DATE,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS generated_tax_account_id VARCHAR(60),
  ADD COLUMN IF NOT EXISTS deductible_tax_account_id VARCHAR(60),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Ajustar unicidad: el código es único por empresa (o único entre plantillas globales si company_id es NULL)
ALTER TABLE public.tax_rates DROP CONSTRAINT IF EXISTS tax_rates_code_key;
DROP INDEX IF EXISTS uq_tax_rates_company_code;
CREATE UNIQUE INDEX IF NOT EXISTS uq_tax_rates_company_code 
  ON public.tax_rates (COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::UUID), code);

-- Sembrar retenciones colombianas estándar fiduciarias si no existen a nivel global
INSERT INTO public.tax_rates (code, name, percentage, type, is_active, description, is_default)
VALUES 
  ('RETEFUENTE_2_5', 'Retención en la Fuente 2.5% (Compras Generales)', 2.50, 'RETEFUENTE', true, 'Retención general en compras a declarantes de renta', false),
  ('RETEFUENTE_3_5', 'Retención en la Fuente 3.5% (Compras No Declarantes)', 3.50, 'RETEFUENTE', true, 'Retención general en compras a personas no declarantes', false),
  ('RETEICA_0_966', 'ReteICA 9.66 por mil (Comercio Tarifa General)', 0.97, 'RETEICA', true, 'Retención de Industria y Comercio actividad comercial municipal', false),
  ('RETEIVA_15', 'ReteIVA 15% (Sobre el valor del IVA)', 15.00, 'RETEIVA', true, 'Retención en la fuente a título de IVA para agentes de retención', false)
ON CONFLICT (COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::UUID), code) DO NOTHING;

-- Asegurar que el IVA 19% general tenga is_default = true si no hay default configurado
UPDATE public.tax_rates 
SET is_default = true 
WHERE code = 'IVA_19' AND company_id IS NULL AND NOT EXISTS (
  SELECT 1 FROM public.tax_rates WHERE is_default = true AND company_id IS NULL
);

-- Políticas RLS actualizadas con soporte multi-tenant estricto
DROP POLICY IF EXISTS "Authenticated users can read tax_rates" ON public.tax_rates;
CREATE POLICY "Authenticated users can read tax_rates" ON public.tax_rates
  FOR SELECT
  TO authenticated
  USING (
    (company_id IS NULL OR company_id = get_auth_company_id())
    AND (is_active = true OR is_admin() OR has_permission('taxes.read'::VARCHAR))
  );

DROP POLICY IF EXISTS "Admin write tax_rates" ON public.tax_rates;
CREATE POLICY "Admin write tax_rates" ON public.tax_rates
  FOR ALL
  TO authenticated
  USING (
    (is_admin() OR has_permission('taxes.write'::VARCHAR))
    AND (company_id = get_auth_company_id() OR (company_id IS NULL AND is_admin()))
  )
  WITH CHECK (
    (is_admin() OR has_permission('taxes.write'::VARCHAR))
    AND (company_id = get_auth_company_id() OR (company_id IS NULL AND is_admin()))
  );
