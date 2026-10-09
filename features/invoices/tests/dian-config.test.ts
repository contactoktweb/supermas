/**
 * SUPER MÁS ERP/POS — SUITE DE PRUEBAS AUTOMATIZADAS
 * FASE 2: CONFIGURACIÓN DIAN + VARIABLES DE ENTORNO + BLOQUEO DE PRODUCCIÓN
 *
 * Cobertura de pruebas:
 * 1. Configuración completa y válida para HABILITACIÓN.
 * 2. Detección y reporte de configuración incompleta.
 * 3. Validación de ambiente inválido.
 * 4. Validación de ausencia de Software ID.
 * 5. Validación de ausencia de PIN de software.
 * 6. Validación de ausencia de TestSetId.
 * 7. Tratamiento de certificado pendiente (advertencia segura sin secretos).
 * 8. BLOQUEO ESTRICTO de producción (intento de activar PRODUCCION genera error de seguridad).
 * 9. Blindaje de secretos (los valores de PIN, contraseña y certificado NUNCA se exponen en resúmenes ni diagnósticos).
 */

import {
  loadDianConfig,
  validateDianConfiguration,
  getDianSafeSummary,
  maskIdentifier,
  DIAN_HABILITACION_WS_ENDPOINT,
} from '../services/dian/dian.config'

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ FALLÓ LA PRUEBA: ${message}`)
  }
  console.log(`  ✅ ${message}`)
}

export async function runDianConfigTestSuite() {
  console.log('================================================================================')
  console.log('🧾 SUITE DE PRUEBAS: CONFIGURACIÓN DIAN Y SEGURIDAD DE VARIABLES (FASE 2)')
  console.log('================================================================================\n')

  let passedTests = 0

  // ---------------------------------------------------------------------------
  // TEST 1: Configuración completa y válida para HABILITACIÓN
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: Configuración completa y válida en Habilitación ---')
  const completeEnv = {
    DIAN_ENVIRONMENT: 'HABILITACION',
    DIAN_NIT: '901458789',
    DIAN_DV: '2',
    DIAN_COMPANY_NAME: 'DISTRIBUIDORA SUPER MAS S.A.S.',
    DIAN_SOFTWARE_ID: 'd748f93a-8b9a-4c91-a1b2-998877665544',
    DIAN_SOFTWARE_PIN: '99887',
    DIAN_TEST_SET_ID: 'set-test-supermas-123',
    DIAN_SOFTWARE_URL: 'https://erp.supermas.com.co',
    DIAN_RECEPTION_URL: 'https://erp.supermas.com.co/api/dian/reception',
    DIAN_TEST_PREFIX: 'SETP',
    DIAN_TEST_RANGE_FROM: '990000000',
    DIAN_TEST_RANGE_TO: '995000000',
    DIAN_TEST_TECHNICAL_KEY: 'fc8eac422eba16e122d5aa92a14d4711f633bc73ca4662b4a40b',
    DIAN_CERTIFICATE_BASE64: 'MIIEvgIBAzCCBHMGC...TEST_BASE64_CERT...',
    DIAN_CERTIFICATE_PASSWORD: 'CertPassword123!',
  }

  const validConfig = loadDianConfig(completeEnv)
  assert(validConfig.environment === 'HABILITACION', 'El ambiente se fijó correctamente en HABILITACION.')
  assert(validConfig.isProductionBlocked === true, 'Bandera isProductionBlocked está activa en true.')
  assert(validConfig.issuer.nit === '901458789', 'El NIT del emisor coincide con el valor esperado.')
  assert(validConfig.endpoints.wsUrl === DIAN_HABILITACION_WS_ENDPOINT, 'El endpoint apunta al WebService oficial de habilitación.')

  const validReport = validateDianConfiguration(validConfig)
  assert(validReport.isValid === true, 'El validador aprueba la configuración completa sin errores.')
  assert(validReport.errors.length === 0, 'No existen errores en configuración completa.')
  passedTests++

  // ---------------------------------------------------------------------------
  // TEST 2: Configuración incompleta (ausencia de campos requeridos)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 2: Detección de configuración incompleta ---')
  const emptyEnv = {
    DIAN_ENVIRONMENT: 'HABILITACION',
    DIAN_NIT: '901458789',
    DIAN_DV: '2',
    DIAN_SOFTWARE_ID: '',
    DIAN_SOFTWARE_PIN: '',
    DIAN_TEST_SET_ID: '',
  }

  const incompleteConfig = loadDianConfig(emptyEnv)
  const incompleteReport = validateDianConfiguration(incompleteConfig)
  assert(incompleteReport.isValid === false, 'El validador detecta correctamente que la configuración está incompleta.')
  assert(incompleteReport.errors.length >= 3, 'Se registraron los errores de Software ID, PIN y TestSetId faltantes.')
  passedTests++

  // ---------------------------------------------------------------------------
  // TEST 3: Ambiente inválido
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 3: Validación contra ambiente inválido ---')
  let caughtInvalidEnv = false
  try {
    loadDianConfig({
      DIAN_ENVIRONMENT: 'PRUEBAS_INVALIDAS' as any,
      DIAN_NIT: '901458789',
      DIAN_DV: '2',
    })
  } catch (err: any) {
    caughtInvalidEnv = true
  }
  assert(caughtInvalidEnv, 'Rechaza correctamente cualquier valor de ambiente no reconocido.')
  passedTests++

  // ---------------------------------------------------------------------------
  // TEST 4: Ausencia de Software ID
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 4: Validación de ausencia de Software ID ---')
  const noSoftwareIdEnv = {
    ...completeEnv,
    DIAN_SOFTWARE_ID: '',
  }
  const noSoftReport = validateDianConfiguration(loadDianConfig(noSoftwareIdEnv))
  assert(noSoftReport.checks.softwareIdConfigured === false, 'Detecta que Software ID no está configurado.')
  assert(noSoftReport.errors.some(e => e.includes('DIAN_SOFTWARE_ID')), 'Reporta error específico para DIAN_SOFTWARE_ID.')
  passedTests++

  // ---------------------------------------------------------------------------
  // TEST 5: Ausencia de PIN de software
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 5: Validación de ausencia de PIN ---')
  const noPinEnv = {
    ...completeEnv,
    DIAN_SOFTWARE_PIN: '',
  }
  const noPinReport = validateDianConfiguration(loadDianConfig(noPinEnv))
  assert(noPinReport.checks.pinConfigured === false, 'Detecta que PIN no está configurado.')
  assert(noPinReport.errors.some(e => e.includes('DIAN_SOFTWARE_PIN')), 'Reporta error específico para DIAN_SOFTWARE_PIN.')
  passedTests++

  // ---------------------------------------------------------------------------
  // TEST 6: Ausencia de TestSetId
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 6: Validación de ausencia de TestSetId ---')
  const noTestSetEnv = {
    ...completeEnv,
    DIAN_TEST_SET_ID: '',
  }
  const noTestSetReport = validateDianConfiguration(loadDianConfig(noTestSetEnv))
  assert(noTestSetReport.checks.testSetIdConfigured === false, 'Detecta que TestSetId no está configurado.')
  assert(noTestSetReport.errors.some(e => e.includes('DIAN_TEST_SET_ID')), 'Reporta error específico para DIAN_TEST_SET_ID.')
  passedTests++

  // ---------------------------------------------------------------------------
  // TEST 7: Ausencia de Certificado Digital (Pendiente para Fase 3)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 7: Tratamiento de certificado digital pendiente ---')
  const noCertEnv = {
    ...completeEnv,
    DIAN_CERTIFICATE_BASE64: '',
    DIAN_CERTIFICATE_PASSWORD: '',
  }
  const noCertConfig = loadDianConfig(noCertEnv)
  const noCertReport = validateDianConfiguration(noCertConfig)
  assert(noCertReport.checks.certificateConfigured === false, 'Identifica que el certificado está pendiente.')
  assert(noCertReport.warnings.some(w => w.includes('DIAN_CERTIFICATE_BASE64')), 'Emite advertencia sin arrojar error crítico en Fase 2.')
  passedTests++

  // ---------------------------------------------------------------------------
  // TEST 8: BLOQUEO ESTRICTO DE PRODUCCIÓN
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 8: Bloqueo de seguridad estricto contra Producción ---')
  let caughtProductionBlock = false
  let productionErrorMessage = ''
  try {
    loadDianConfig({
      ...completeEnv,
      DIAN_ENVIRONMENT: 'PRODUCCION',
    })
  } catch (err: any) {
    caughtProductionBlock = true
    productionErrorMessage = err.message
  }
  assert(caughtProductionBlock, 'Se bloquea terminantemente el intento de activar PRODUCCION.')
  assert(
    productionErrorMessage.includes('BLOQUEO FISCAL DE SEGURIDAD'),
    'El mensaje de error comunica formalmente el bloqueo de Producción durante Habilitación.'
  )
  passedTests++

  // ---------------------------------------------------------------------------
  // TEST 9: Blindaje de secretos (NUNCA exponer en resúmenes ni logs)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 9: Verificación de blindaje de secretos ---')
  const rawPinSecret = '99887'
  const rawCertPass = 'CertPassword123!'
  const rawCertBase64 = 'MIIEvgIBAzCCBHMGC...TEST_BASE64_CERT...'

  const safeSummary = getDianSafeSummary(validConfig)
  const summaryJson = JSON.stringify(safeSummary)

  assert(!summaryJson.includes(rawPinSecret), 'El PIN en texto plano NO aparece en el resumen seguro.')
  assert(!summaryJson.includes(rawCertPass), 'La contraseña del certificado NO aparece en el resumen seguro.')
  assert(!summaryJson.includes(rawCertBase64), 'El contenido del certificado NO aparece en el resumen seguro.')
  assert(safeSummary.software.isPinConfigured === true, 'El estado del PIN se reporta únicamente como booleano (configurado/no configurado).')
  assert(safeSummary.certificate.isPasswordConfigured === true, 'El estado de la contraseña se reporta únicamente como booleano.')

  // Verificar que maskIdentifier enmascare de forma segura
  const maskedSoftId = maskIdentifier('d748f93a-8b9a-4c91-a1b2-998877665544')
  assert(maskedSoftId.endsWith('5544'), 'El enmascaramiento conserva únicamente los últimos 4 dígitos.')
  assert(maskedSoftId.startsWith('••••••••'), 'El enmascaramiento oculta los primeros dígitos con viñetas.')
  assert(!maskedSoftId.includes('d748f93a'), 'La parte inicial del Software ID no es visible.')
  passedTests++

  // ---------------------------------------------------------------------------
  // RESUMEN FINAL
  // ---------------------------------------------------------------------------
  console.log('\n================================================================================')
  console.log(`🎉 TODAS LAS PRUEBAS DE LA FASE 2 APROBADAS EXITOSAMENTE (${passedTests}/9)`)
  console.log('================================================================================\n')
}

// Ejecución si se llama directamente
if (require.main === module) {
  runDianConfigTestSuite().catch(err => {
    console.error('❌ Error ejecutando suite de configuración DIAN:', err)
    process.exit(1)
  })
}
