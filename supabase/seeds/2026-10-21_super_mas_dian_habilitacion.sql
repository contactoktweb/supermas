-- ==============================================================================
-- DATOS REALES SUPER MÁS — HABILITACIÓN DIAN (ejecutar DESPUÉS de las migraciones 058 y 059)
-- Fuente: RUT de la empresa y portal DIAN de habilitación (entregados por el usuario el 2026-10-21).
-- ==============================================================================
-- Qué hace:
--   1. Completa los datos fiscales del emisor en public.companies.
--   2. Registra el software propio (Software ID y TestSetId) en dian_software_config.
--   3. Registra la resolución de PRUEBAS SETP 990000000–995000000 en dian_resolutions.
--   4. Crea la subcuenta auxiliar PUC de la cuenta de ahorros Bancolombia terminada en 2416.
--
-- Qué NO hace:
--   - No guarda PIN, clave técnica, certificado ni contraseñas (van en .env.local del servidor).
--   - No crea la cuenta bancaria (requiere el número completo: se registra en Tesorería
--     y allí se le asigna la subcuenta 11200501).
--   - No toca usuarios, roles ni datos históricos.
--
-- Seguridad: falla si hay más de una empresa (para no actualizar la equivocada).
-- ==============================================================================

BEGIN;

DO $$
DECLARE
  v_company UUID;
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.companies;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Se esperaba exactamente 1 empresa y hay %. Ajuste el WHERE manualmente.', v_count;
  END IF;
  SELECT id INTO v_company FROM public.companies LIMIT 1;

  -- 1. Emisor (RUT)
  UPDATE public.companies SET
    business_name           = 'DISTRIBUIDORA SUPER MAS S.A.S',
    tax_id                  = '901374526',
    verification_digit      = '5',
    address                 = 'AV 8 55 CC SAN ANTONIO LC 30',
    city                    = 'Cúcuta',
    department              = 'Norte de Santander',
    country                 = 'Colombia',
    country_code            = 'CO',
    dian_department_code    = '54',
    dian_municipality_code  = '54001',
    dian_organization_type  = '1',                          -- Persona jurídica (S.A.S.)
    rut_responsibilities    = '05;07;10;14;42;48;52;55',    -- Casilla 53 del RUT
    -- Ninguna de las responsabilidades del RUT corresponde a O-13 (gran contribuyente),
    -- O-15 (autorretenedor), O-23 (agente de retención IVA) ni O-47 (régimen simple):
    -- por eso se usa R-99-PN. PENDIENTE confirmación del contador.
    dian_tax_level_codes    = 'R-99-PN',
    dian_tax_scheme_code    = '01',                         -- Responsable de IVA (resp. 48)
    updated_at              = NOW()
  WHERE id = v_company;

  -- 2. Software propio (habilitación). El PIN NO se guarda aquí.
  INSERT INTO public.dian_software_config (
    company_id, software_id, software_name, environment, operation_mode, test_set_id, is_active
  ) VALUES (
    v_company, 'd1100dd6-2a52-4dd8-95a4-ef54f98cc2b9', 'Super Mas ERP', 'HABILITACION', 'SOFTWARE_PROPIO',
    '03b49fa0-4ea8-48a2-abd5-86ae18fcd9ec', true
  )
  ON CONFLICT (company_id, environment) DO UPDATE SET
    software_id = EXCLUDED.software_id,
    test_set_id = EXCLUDED.test_set_id,
    is_active   = true,
    updated_at  = NOW();

  -- 3. Resolución del set de pruebas (portal DIAN, rango de numeración de prueba)
  INSERT INTO public.dian_resolutions (
    company_id, location_id, dian_prefix, resolution_number, resolution_date,
    valid_from, valid_to, initial_range, final_range, current_number,
    document_type, technical_key, environment, is_active
  ) VALUES (
    v_company, NULL, 'SETP', '18760000001', DATE '2019-01-19',
    DATE '2019-01-19', DATE '2030-01-19', 990000000, 995000000, 990000000,
    'ELECTRONICA', NULL, 'HABILITACION', true
  )
  ON CONFLICT (company_id, environment, dian_prefix, resolution_number) DO NOTHING;
END $$;

-- 4. Subcuenta auxiliar PUC para Bancolombia Ahorros *2416 (estructura 1120 / 112005 la crea la migración 059)
INSERT INTO public.accounting_accounts (code, name, account_class, level, parent_id, nature, requires_third_party, is_active)
SELECT '11200501', 'Bancolombia Cuenta de Ahorros *2416', 1, 5, a.id, 'DEBIT', false, true
FROM public.accounting_accounts a
WHERE a.code = '112005'
ON CONFLICT (code) DO NOTHING;

COMMIT;

-- Verificación rápida (solo lectura)
SELECT business_name, tax_id, verification_digit, city, dian_municipality_code, dian_tax_level_codes FROM public.companies;
SELECT dian_prefix, resolution_number, valid_from, valid_to, initial_range, final_range, environment FROM public.dian_resolutions WHERE environment = 'HABILITACION';
SELECT code, name FROM public.accounting_accounts WHERE code LIKE '1120%' ORDER BY code;
