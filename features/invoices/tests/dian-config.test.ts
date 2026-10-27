/**
 * SUPER MÁS ERP/POS — PRUEBAS: CONFIGURACIÓN DIAN DEL SERVIDOR
 *
 * Ejecutar: pnpm exec tsx features/invoices/tests/dian-config.test.ts
 *
 * Cobertura:
 * 1. Configuración completa en HABILITACIÓN.
 * 2. Sin valores fiscales por defecto (NIT, resolución, rango ya no viven en el código).
 * 3. Falta PIN → no se puede construir el XML.
 * 4. Falta clave técnica → no se puede calcular el CUFE.
 * 5. Certificado pendiente → advertencia, sin firma.
 * 6. Certificado sin contraseña → error.
 * 7. PRODUCCIÓN: endpoints oficiales fijos y clave técnica de producción (no la de pruebas).
 * 8. BLOQUEO de endpoint distinto a vpfe-hab.
 * 9. Los secretos nunca aparecen en el resumen seguro.
 */

import {
  loadDianConfig,
  validateDianConfiguration,
  getDianSafeSummary,
  maskIdentifier,
  DIAN_HABILITACION_WS_ENDPOINT,
  DIAN_HABILITACION_QR_BASE_URL,
  DIAN_PRODUCCION_WS_ENDPOINT,
  DIAN_PRODUCCION_QR_BASE_URL,
} from '../services/dian/dian.config'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`❌ FALLÓ LA PRUEBA: ${message}`)
  console.log(`  ✅ ${message}`)
}

const SECRETS = {
  DIAN_ENVIRONMENT: 'HABILITACION',
  DIAN_SOFTWARE_PIN: 'PIN-DE-PRUEBA-NO-REAL',
  DIAN_TEST_TECHNICAL_KEY: 'fc8eac422eba16e122d5aa92a14d4711f633bc73ca4662b4a40b',
  DIAN_CERTIFICATE_BASE64: 'MIIEvgIBAzCCBHMG-CERTIFICADO-FICTICIO',
  DIAN_CERTIFICATE_PASSWORD: 'ClaveFicticia#2026',
}

export async function runDianConfigTestSuite() {
  console.log('================================================================================')
  console.log('🧾 PRUEBAS: CONFIGURACIÓN DIAN DEL SERVIDOR (SECRETOS + AMBIENTE + BLOQUEOS)')
  console.log('================================================================================\n')
  let passed = 0

  console.log('--- 1. Configuración completa en HABILITACIÓN ---')
  const cfg = loadDianConfig(SECRETS)
  assert(cfg.environment === 'HABILITACION' && cfg.environmentCode === '2', 'Ambiente HABILITACION con código 2 (ProfileExecutionID / TipoAmb).')
  assert(cfg.endpoints.wsUrl === DIAN_HABILITACION_WS_ENDPOINT, 'WebService oficial de habilitación.')
  assert(cfg.endpoints.qrBaseUrl === DIAN_HABILITACION_QR_BASE_URL, 'URL de consulta QR del catálogo de habilitación.')
  const rep = validateDianConfiguration(cfg)
  assert(rep.isValid && rep.canBuildXml && rep.canSign, 'Puede construir XML y firmar.')
  passed++

  console.log('\n--- 2. Sin datos fiscales por defecto en el código ---')
  assert(!('issuer' in cfg) && !('numbering' in cfg), 'NIT, resolución y rangos NO están en la configuración del código (viven en la BD).')
  const empty = loadDianConfig({ DIAN_ENVIRONMENT: 'HABILITACION' })
  const repEmpty = validateDianConfiguration(empty)
  assert(!repEmpty.isValid && !repEmpty.canBuildXml, 'Sin secretos, la configuración es inválida (no inventa valores).')
  passed++

  console.log('\n--- 3. Falta PIN ---')
  const noPin = validateDianConfiguration(loadDianConfig({ ...SECRETS, DIAN_SOFTWARE_PIN: '' }))
  assert(!noPin.checks.pinConfigured && !noPin.canBuildXml, 'Sin PIN no se construye el XML.')
  assert(noPin.errors.some((e) => e.includes('DIAN_SOFTWARE_PIN')), 'Error nombra la variable DIAN_SOFTWARE_PIN.')
  passed++

  console.log('\n--- 4. Falta clave técnica ---')
  const noKey = validateDianConfiguration(loadDianConfig({ ...SECRETS, DIAN_TEST_TECHNICAL_KEY: '   ' }))
  assert(!noKey.checks.technicalKeyConfigured && !noKey.canBuildXml, 'Sin clave técnica no se calcula el CUFE.')
  passed++

  console.log('\n--- 5. Certificado pendiente ---')
  const noCert = validateDianConfiguration(loadDianConfig({ ...SECRETS, DIAN_CERTIFICATE_BASE64: '', DIAN_CERTIFICATE_PASSWORD: '' }))
  assert(noCert.isValid && noCert.canBuildXml && !noCert.canSign, 'Sin certificado: XML sí, firma no.')
  assert(noCert.warnings.some((w) => w.toLowerCase().includes('certificado')), 'Advertencia explícita de certificado pendiente.')
  passed++

  console.log('\n--- 6. Certificado sin contraseña ---')
  const noPwd = validateDianConfiguration(loadDianConfig({ ...SECRETS, DIAN_CERTIFICATE_PASSWORD: '' }))
  assert(!noPwd.isValid && !noPwd.canSign, 'Certificado sin contraseña es un error.')
  passed++

  console.log('\n--- 7. PRODUCCIÓN ---')
  const prod = loadDianConfig({ ...SECRETS, DIAN_ENVIRONMENT: 'PRODUCCION', DIAN_HABILITACION_WS_URL: DIAN_HABILITACION_WS_ENDPOINT })
  assert(prod.environment === 'PRODUCCION' && prod.environmentCode === '1', 'Ambiente PRODUCCION con código 1.')
  assert(prod.endpoints.wsUrl === DIAN_PRODUCCION_WS_ENDPOINT && prod.endpoints.qrBaseUrl === DIAN_PRODUCCION_QR_BASE_URL,
    'Endpoints oficiales de producción, sin sobrescritura por variable.')
  const prodNoKey = validateDianConfiguration(prod)
  assert(!prodNoKey.canBuildXml && prodNoKey.errors.some((e) => e.includes('DIAN_PRODUCTION_TECHNICAL_KEY')),
    'Sin DIAN_PRODUCTION_TECHNICAL_KEY no emite: nunca usa la clave técnica de pruebas.')
  const prodKey = 'aa11bb22cc33dd44ee55ff66aa77bb88cc99dd00'
  const prodOk = validateDianConfiguration(loadDianConfig({ ...SECRETS, DIAN_ENVIRONMENT: 'PRODUCCION', DIAN_PRODUCTION_TECHNICAL_KEY: prodKey }))
  assert(prodOk.canSign, 'Con clave técnica de producción puede construir y firmar.')
  passed++

  console.log('\n--- 8. Bloqueo de endpoint de producción en habilitación ---')
  let blockedUrl = false
  try {
    loadDianConfig({ ...SECRETS, DIAN_HABILITACION_WS_URL: 'https://vpfe.dian.gov.co/WcfDianCustomerServices.svc' })
  } catch (e: any) {
    blockedUrl = String(e.message).includes('vpfe-hab')
  }
  assert(blockedUrl, 'No se permite apuntar el WebService de habilitación a producción.')
  passed++

  console.log('\n--- 9. Blindaje de secretos ---')
  const summaryText = JSON.stringify(getDianSafeSummary(cfg))
  for (const secret of Object.values(SECRETS).filter((v) => v !== 'HABILITACION')) {
    assert(!summaryText.includes(secret), `El resumen seguro no contiene el secreto "${secret.slice(0, 6)}…".`)
  }
  assert(maskIdentifier('d1100dd6-2a52-4dd8-95a4-ef54f98cc2b9').endsWith('c2b9') && !maskIdentifier('d1100dd6-2a52-4dd8-95a4-ef54f98cc2b9').includes('d1100dd6'), 'El Software ID se muestra enmascarado.')
  passed++

  console.log('\n================================================================================')
  console.log(`🎉 CONFIGURACIÓN DIAN: ${passed}/9 PRUEBAS APROBADAS`)
  console.log('================================================================================')
}

runDianConfigTestSuite().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
