/**
 * SUPER MÁS ERP/POS — SUITE DE PRUEBAS UNITARIAS: CUFE, CUDE, QR Y VALIDACIÓN DE RANGOS DIAN
 * Especificación: Anexo Técnico 1.9 / Resolución 000165 de 2023
 */

import { createHash } from 'crypto'
import { buildInvoiceDocument } from '../services/dian/dian-document'
import { dianCryptoService } from '../services/dian/dian-crypto.service'
import { dianValidatorService } from '../services/dian/dian-validator.service'
import {
  CufeCalculationInput,
  CudeCalculationInput,
  DianResolutionRecord,
} from '../types/dian.types'

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ FALLÓ: ${message}`)
  }
  console.log(`  ✅ ${message}`)
}

export async function runDianCryptoAndValidationTests() {
  console.log('================================================================================')
  console.log('🧾 SUITE DE PRUEBAS: CUFE SHA-384, CUDE, QR Y VALIDACIÓN DE RANGOS DIAN')
  console.log('================================================================================\n')

  let passed = 0

  // ---------------------------------------------------------------------------
  // 1. CÁLCULO DE CUFE (ANEXO TÉCNICO 1.9)
  // ---------------------------------------------------------------------------
  console.log('--- 1. CÁLCULO FORMAL DE CUFE (SHA-384) ---')
  const sampleCufeInput: CufeCalculationInput = {
    numFac: 'SETP990000001',
    fecFac: '2026-10-20',
    horFac: '10:30:00-05:00',
    valFac: 100000,
    codImp1: '01',
    valImp1: 19000,
    codImp2: '04',
    valImp2: 0,
    codImp3: '03',
    valImp3: 0,
    valTot: 119000,
    nitOfe: '900842109',
    numAdq: '900123456',
    clTec: 'fc8eac422eba16e122d5aa92a14d4711f633bc73ca4662b4a40b',
    tipoAmbiente: '2', // Habilitación
  }

  // Concatenación esperada según Anexo Técnico 1.9
  const expectedRaw = 'SETP9900000012026-10-2010:30:00-05:00100000.000119000.00040.00030.00119000.00900842109900123456fc8eac422eba16e122d5aa92a14d4711f633bc73ca4662b4a40b2'
  const expectedHash = createHash('sha384').update(expectedRaw).digest('hex').toLowerCase()

  const calculatedCufe = dianCryptoService.calculateCUFE(sampleCufeInput)

  assert(calculatedCufe.length === 96, 'CUFE tiene exactamente 96 caracteres hexadecimales (SHA-384).')
  assert(calculatedCufe === calculatedCufe.toLowerCase(), 'CUFE está formateado estrictamente en minúsculas.')
  assert(calculatedCufe === expectedHash, 'CUFE coincide exactamente con el vector criptográfico SHA-384 de referencia.')
  assert(/^[0-9a-f]{96}$/.test(calculatedCufe), 'CUFE contiene únicamente caracteres hexadecimales válidos (0-9, a-f).')
  passed++

  // ---------------------------------------------------------------------------
  // 2. CÁLCULO DE CUDE PARA NOTA CRÉDITO (ANEXO TÉCNICO 1.9)
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. CÁLCULO FORMAL DE CUDE (SHA-384 CON PIN DE SOFTWARE) ---')
  const sampleCudeInput: CudeCalculationInput = {
    numDoc: 'NC990000001',
    fecDoc: '2026-10-20',
    horDoc: '11:00:00-05:00',
    valDoc: 50000,
    codImp1: '01',
    valImp1: 9500,
    codImp2: '04',
    valImp2: 0,
    codImp3: '03',
    valImp3: 0,
    valTot: 59500,
    nitOfe: '900842109',
    numAdq: '900123456',
    pin: '75319', // PIN del software en lugar de clave técnica
    tipoAmbiente: '2',
  }

  const expectedCudeRaw = 'NC9900000012026-10-2011:00:00-05:0050000.00019500.00040.00030.0059500.00900842109900123456753192'
  const expectedCudeHash = createHash('sha384').update(expectedCudeRaw).digest('hex').toLowerCase()

  const calculatedCude = dianCryptoService.calculateCUDE(sampleCudeInput)
  assert(calculatedCude.length === 96, 'CUDE tiene exactamente 96 caracteres hexadecimales.')
  assert(calculatedCude === expectedCudeHash, 'CUDE coincide exactamente con el hash SHA-384 de referencia.')
  passed++

  // ---------------------------------------------------------------------------
  // 3. SOFTWARE SECURITY CODE
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. CÁLCULO DE SOFTWARE SECURITY CODE ---')
  const secInput = {
    softwareId: 'd748f93a-8b9a-4c91-a1b2-998877665544',
    pin: '75319',
    documentNumber: 'SETP990000001',
  }
  const expectedSecRaw = `${secInput.softwareId}${secInput.pin}${secInput.documentNumber}`
  const expectedSecHash = createHash('sha384').update(expectedSecRaw).digest('hex').toLowerCase()
  const secCode = dianCryptoService.calculateSoftwareSecurityCode(secInput)
  assert(secCode.length === 96, 'SoftwareSecurityCode tiene 96 caracteres.')
  assert(secCode === expectedSecHash, 'SoftwareSecurityCode coincide con hash SHA-384 oficial.')
  passed++

  // ---------------------------------------------------------------------------
  // 4. GENERACIÓN DE URL / PAYLOAD DE CÓDIGO QR
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. GENERACIÓN DE CÓDIGO QR REGLAMENTARIO ---')
  const qrDoc = buildInvoiceDocument({
    prefix: 'SETP', number: 990000001, issueDate: '2026-10-20', issueTime: '10:30:00-05:00', environmentCode: '2',
    softwareId: 'software-prueba',
    issuer: { nit: '901374526', dv: '5', legalName: 'EMISOR PRUEBA', address: 'Calle 1', cityName: 'Cúcuta', departmentName: 'Norte de Santander', municipalityCode: '54001', departmentCode: '54', countryCode: 'CO', organizationType: '1', taxLevelCodes: 'R-99-PN', taxSchemeCode: '01' },
    customer: { documentType: 'NIT', documentNumber: '900123456', dv: '1', name: 'CLIENTE PRUEBA', isCompany: true },
    resolution: { resolutionNumber: '18760000001', prefix: 'SETP', rangeFrom: 990000000, rangeTo: 995000000, validFrom: '2019-01-19', validTo: '2030-01-19' },
    lines: [{ productId: 'p1', sku: 'SKU1', description: 'Producto', quantity: 1, unitPrice: 100000, discountPercent: 0, taxRatePercent: 19, netAmount: 100000, taxAmount: 19000 }],
    payment: { form: '1', meansCode: '10' },
  })
  const qrData = dianCryptoService.buildQRCodeContent(qrDoc, calculatedCufe, 'https://catalogo-vpfe-hab.dian.gov.co/document/searchqr?documentkey=')
  const qrLines = qrData.split('\n')

  assert(qrLines[0] === 'NumFac=SETP990000001', 'El QR inicia con el número de factura (prefijo + consecutivo).')
  assert(qrLines.includes('ValFac=100000.00') && qrLines.includes('ValIva=19000.00') && qrLines.includes('ValTolFac=119000.00'), 'El QR trae base, IVA y total con 2 decimales.')
  assert(qrLines.includes(`CUFE=${calculatedCufe}`), 'El QR incluye el CUFE íntegro de 96 caracteres.')
  assert(
    qrLines[qrLines.length - 1] === `QRCode=https://catalogo-vpfe-hab.dian.gov.co/document/searchqr?documentkey=${calculatedCufe}`,
    'El QR termina con la URL de consulta del catálogo de Habilitación.'
  )
  passed++

  // ---------------------------------------------------------------------------
  // 5. VALIDACIÓN DE RANGO Y RESOLUCIÓN DIAN
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. VALIDACIONES DE RESOLUCIÓN Y RANGOS FISCALES ---')
  const validResolution: DianResolutionRecord = {
    id: 'res-test-001',
    companyId: 'comp-001',
    dianPrefix: 'SETP',
    resolutionNumber: '18760000001',
    resolutionDate: '2026-01-01',
    validFrom: '2026-01-01',
    validTo: '2027-01-01',
    initialRange: 990000000,
    finalRange: 995000000,
    currentNumber: 990000010,
    documentType: 'INVOICE',
    technicalKey: 'fc8eac422eba16e122d5aa92a14d4711f633bc73ca4662b4a40b',
    environment: 'HABILITACION',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }

  // 5.1 Número válido dentro de rango
  const resValid = dianValidatorService.validateResolution(validResolution, 990000015)
  assert(resValid.isValid === true, 'Acepta consecutivo dentro del rango autorizado.')
  assert(resValid.errors.length === 0, 'Cero errores para resolución válida.')

  // 5.2 Resolución inactiva
  const resInactive = dianValidatorService.validateResolution(
    { ...validResolution, isActive: false },
    990000015
  )
  assert(resInactive.isValid === false, 'Rechaza resolución inactiva.')
  assert(resInactive.errors.some(e => e.includes('inactiva')), 'Mensaje de error claro para resolución inactiva.')

  // 5.3 Resolución vencida
  const resExpired = dianValidatorService.validateResolution(
    { ...validResolution, validTo: '2025-12-31' },
    990000015
  )
  assert(resExpired.isValid === false, 'Rechaza resolución vencida.')
  assert(resExpired.errors.some(e => e.includes('vencida')), 'Mensaje de error claro para resolución vencida.')

  // 5.4 Consecutivo inferior al rango inicial
  const resBelow = dianValidatorService.validateResolution(validResolution, 989999999)
  assert(resBelow.isValid === false, 'Rechaza consecutivo inferior al rango inicial.')
  assert(resBelow.errors.some(e => e.includes('inferior al rango inicial')), 'Error para consecutivo inferior.')

  // 5.5 Rango agotado
  const resExhausted = dianValidatorService.validateResolution(validResolution, 995000001)
  assert(resExhausted.isValid === false, 'Rechaza emisión si el rango se ha agotado.')
  assert(resExhausted.errors.some(e => e.includes('se ha agotado')), 'Error reporta que el rango se ha agotado.')

  // 5.6 Advertencia de proximidad al agotamiento
  const resWarning = dianValidatorService.validateResolution(validResolution, 994999980)
  assert(resWarning.isValid === true, 'Permite emisión si aún no ha superado el límite.')
  assert(resWarning.warnings.some(w => w.includes('disponibles')), 'Emite advertencia preventiva de rango próximo a agotarse.')
  passed++

  // ---------------------------------------------------------------------------
  // 6. VALIDACIÓN MATEMÁTICA DE TOTALES
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. VALIDACIÓN DE INTEGRIDAD MATEMÁTICA DE LÍNEAS Y TOTALES ---')
  const lines = [
    {
      lineNumber: 1,
      productId: 'p1',
      sku: 'SKU1',
      description: 'Producto A',
      unitOfMeasure: 'EA',
      quantity: 2,
      unitPrice: 50000,
      grossAmount: 100000,
      discountPercent: 0,
      discountAmount: 0,
      taxableBase: 100000,
      taxes: [
        {
          taxCode: '01' as const,
          taxName: 'IVA',
          ratePercent: 19,
          taxableBase: 100000,
          taxAmount: 19000,
        },
      ],
      totalTaxAmount: 19000,
      netAmount: 119000,
    },
  ]

  const totalsValid = {
    lineExtensionAmount: 100000,
    taxExclusiveAmount: 100000,
    taxInclusiveAmount: 119000,
    allowanceTotalAmount: 0,
    chargeTotalAmount: 0,
    payableAmount: 119000,
    currency: 'COP' as const,
  }

  const totalsCheck = dianValidatorService.validateTotals(lines, totalsValid)
  assert(totalsCheck.isValid === true, 'Acepta liquidación matemáticamente balanceada.')

  const totalsCorrupt = {
    ...totalsValid,
    payableAmount: 150000, // Descuadre de $31.000 COP
  }
  const totalsCheckCorrupt = dianValidatorService.validateTotals(lines, totalsCorrupt)
  assert(totalsCheckCorrupt.isValid === false, 'Detecta y bloquea descuadre en total a pagar.')
  assert(totalsCheckCorrupt.errors.some(e => e.includes('Incoherencia matemática')), 'Reporta incoherencia matemática explícitamente.')
  passed++

  console.log('\n================================================================================')
  console.log(`🎉 SUITE CRIPTOGRÁFICA Y DE VALIDACIÓN DIAN: ${passed}/6 BLOQUES APROBADOS (100% PASS)`)
  console.log('================================================================================\n')
}

// Ejecución
if (require.main === module) {
  runDianCryptoAndValidationTests().catch(err => {
    console.error('❌ Error en suite DIAN Crypto & Validation:', err)
    process.exit(1)
  })
}
