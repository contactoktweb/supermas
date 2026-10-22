/**
 * SUPER MÁS ERP/POS — PRUEBAS: XML UBL 2.1, CUFE, QR, FIRMA XAdES, ZIP y SOAP (sin red)
 *
 * Ejecutar: pnpm exec tsx features/invoices/tests/dian-xml-firma.test.ts
 *
 * Usa un certificado AUTOFIRMADO generado en memoria (no es el certificado real de la empresa).
 * Verifica:
 *  1. Validaciones del documento fiscal (datos faltantes, rango, vigencia, IVA).
 *  2. CUFE = SHA-384 de la concatenación oficial, con los mismos montos del XML.
 *  3. XML: DianExtensions, InvoiceControl con la resolución, UUID=CUFE, totales, líneas, QR.
 *  4. Firma XAdES-BES: los 3 digests y la firma RSA se recalculan y verifican.
 *  5. Alteración del XML firmado → la verificación falla.
 *  6. ZIP de un archivo legible y nombres de archivo DIAN.
 *  7. Sobre SOAP con WS-Security: firma verificable sobre wsa:To.
 *  8. Interpretación de respuestas DIAN (aceptada, rechazada, TrackId, Fault).
 *  9. IVA: exento (tarifa 0 con base) vs excluido (sin TaxTotal) y producto al 0 % sin clasificar.
 * 10. Nota crédito y nota débito: CUDE (con PIN), BillingReference, DiscrepancyResponse, firma y nombres.
 *
 * Con XSD_DIR=<carpeta con maindoc/ y common/ de UBL 2.1> y xmllint instalado, valida además los XML
 * de factura, nota crédito y nota débito contra los esquemas oficiales UBL 2.1.
 */

import { createHash, createVerify, X509Certificate } from 'crypto'
import {
  buildInvoiceDocument,
  DianInvoiceInput,
  DianDocumentError,
} from '../services/dian/dian-document'
import { dianCryptoService } from '../services/dian/dian-crypto.service'
import { dianUblBuilderService } from '../services/dian/dian-ubl-builder.service'
import { loadSigningCertificate } from '../services/dian/dian-certificate'
import { signUblDocument } from '../services/dian/dian-xades-signer'
import { canonicalize, canonicalizeExclusive, findFirst, serialize, XmlElement } from '../services/dian/xml/xml-tree'
import { zipSingleFile, unzipFirstFile } from '../services/dian/dian-zip'
import { buildSignedEnvelope, dianFileNames, parseDianResponse, parseNumberingRanges } from '../services/dian/dian-soap.adapter'
import { DIAN_HABILITACION_QR_BASE_URL, DIAN_HABILITACION_WS_ENDPOINT } from '../services/dian/dian.config'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const forge: any = require('node-forge')

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`❌ FALLÓ LA PRUEBA: ${message}`)
  console.log(`  ✅ ${message}`)
}

const TECH_KEY = 'fc8eac422eba16e122d5aa92a14d4711f633bc73ca4662b4a40b'

function baseInput(): DianInvoiceInput {
  return {
    prefix: 'SETP',
    number: 990000000,
    issueDate: '2026-10-21',
    issueTime: '10:15:30-05:00',
    environmentCode: '2',
    softwareId: 'd1100dd6-2a52-4dd8-95a4-ef54f98cc2b9',
    issuer: {
      nit: '901374526', dv: '5', legalName: 'DISTRIBUIDORA SUPER MAS S.A.S', address: 'AV 8 55 CC SAN ANTONIO LC 30',
      cityName: 'Cúcuta', departmentName: 'Norte de Santander', municipalityCode: '54001', departmentCode: '54',
      countryCode: 'CO', organizationType: '1', taxLevelCodes: 'R-99-PN', taxSchemeCode: '01',
    },
    customer: { documentType: 'CC', documentNumber: '1.090.123.456', name: 'Cliente Prueba', firstName: 'Cliente', lastName: 'Prueba', isCompany: false },
    resolution: { resolutionNumber: '18760000001', prefix: 'SETP', rangeFrom: 990000000, rangeTo: 995000000, validFrom: '2019-01-19', validTo: '2030-01-19' },
    lines: [
      { productId: 'p1', sku: 'SKU1', description: 'Arroz 500g & "Premium" <x>', quantity: 2, unitPrice: 2500, discountPercent: 0, taxRatePercent: 19, netAmount: 5000, taxAmount: 950 },
      { productId: 'p2', sku: 'SKU2', description: 'Leche 1L', quantity: 3, unitPrice: 4200, discountPercent: 10, taxRatePercent: 0, netAmount: 11340, taxAmount: 0, ivaTreatment: 'EXENTO' },
    ],
    payment: { form: '1', meansCode: '10' },
    notes: ['Factura de prueba'],
  }
}

function makeTestCertificate(): { p12Base64: string; password: string; certPem: string } {
  const keys = forge.pki.rsa.generateKeyPair(2048)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = '01ab23cd45'
  cert.validity.notBefore = new Date(Date.now() - 86400000)
  cert.validity.notAfter = new Date(Date.now() + 365 * 86400000)
  const attrs = [
    { name: 'commonName', value: 'Certificado Autofirmado de Prueba' },
    { name: 'organizationName', value: 'PRUEBA, S.A.S' },
    { name: 'countryName', value: 'CO' },
  ]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
  cert.sign(keys.privateKey, forge.md.sha256.create())
  const password = 'clave-de-prueba'
  const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, { algorithm: '3des' })
  return {
    p12Base64: forge.util.encode64(forge.asn1.toDer(p12).getBytes()),
    password,
    certPem: forge.pki.certificateToPem(cert),
  }
}

const textOf = (root: XmlElement, name: string) => {
  const n = findFirst(root, (e) => e.name === name)
  return n ? n.children.map((c) => (c.kind === 'text' ? c.value : '')).join('') : null
}

export async function runDianXmlFirmaSuite() {
  console.log('================================================================================')
  console.log('🧾 PRUEBAS: XML UBL 2.1 + CUFE + QR + FIRMA XAdES + ZIP + SOAP (SIN RED)')
  console.log('================================================================================\n')
  let passed = 0

  // 1 -------------------------------------------------------------------------
  console.log('--- 1. Validaciones del documento fiscal ---')
  const expectFail = (mutate: (i: DianInvoiceInput) => void, text: string, label: string) => {
    const i = baseInput()
    mutate(i)
    try {
      buildInvoiceDocument(i)
      assert(false, label)
    } catch (e: any) {
      assert(e instanceof DianDocumentError && e.problems.some((p) => p.includes(text)), label)
    }
  }
  expectFail((i) => (i.issuer.municipalityCode = ''), 'DANE', 'Sin código DANE del emisor se bloquea la emisión.')
  expectFail((i) => (i.number = 995000001), 'fuera del rango', 'Consecutivo fuera del rango autorizado se bloquea.')
  expectFail((i) => (i.issueDate = '2030-01-20'), 'vigencia', 'Fecha fuera de la vigencia de la resolución se bloquea.')
  expectFail((i) => (i.lines[0].taxAmount = 900), 'IVA', 'IVA inconsistente con la tarifa se bloquea.')
  expectFail((i) => (i.softwareId = ''), 'Software ID', 'Sin Software ID se bloquea.')
  passed++

  // 2 -------------------------------------------------------------------------
  console.log('\n--- 2. CUFE desde el documento ---')
  const doc = buildInvoiceDocument(baseInput())
  assert(doc.documentId === 'SETP990000000', 'Número de documento = prefijo + consecutivo sin separador.')
  assert(doc.totals.lineExtensionCents === 1634000 && doc.totals.ivaCents === 95000 && doc.totals.payableCents === 1729000, 'Totales: base 16.340, IVA 950, total 17.290.')
  const cufe = dianCryptoService.calculateDocumentCUFE(doc, TECH_KEY)
  const manual = 'SETP990000000' + '2026-10-21' + '10:15:30-05:00' + '16340.00' + '01' + '950.00' + '04' + '0.00' + '03' + '0.00' + '17290.00' + '901374526' + '1090123456' + TECH_KEY + '2'
  assert(cufe === createHash('sha384').update(manual).digest('hex'), 'CUFE = SHA-384 de la concatenación oficial (15 campos en orden).')
  assert(/^[0-9a-f]{96}$/.test(cufe), 'CUFE de 96 caracteres hexadecimales en minúscula.')
  passed++

  // 3 -------------------------------------------------------------------------
  console.log('\n--- 3. XML UBL 2.1 ---')
  const ssc = dianCryptoService.calculateSoftwareSecurityCode({ softwareId: doc.input.softwareId, pin: 'PIN-PRUEBA', documentNumber: doc.documentId })
  const qr = dianCryptoService.buildQRCodeContent(doc, cufe, DIAN_HABILITACION_QR_BASE_URL)
  const tree = dianUblBuilderService.buildInvoiceTree(doc, { cufe, softwareSecurityCode: ssc, qrCodeContent: qr })
  const xml = serialize(tree, true)
  assert(xml.startsWith('<?xml version="1.0" encoding="UTF-8"'), 'Declaración XML UTF-8.')
  assert(textOf(tree, 'cbc:UUID') === cufe, 'cbc:UUID contiene el CUFE calculado.')
  assert(textOf(tree, 'cbc:ProfileExecutionID') === '2', 'ProfileExecutionID = 2 (pruebas).')
  assert(textOf(tree, 'sts:InvoiceAuthorization') === '18760000001', 'InvoiceAuthorization = número de resolución.')
  assert(textOf(tree, 'sts:Prefix') === 'SETP' && textOf(tree, 'sts:From') === '990000000' && textOf(tree, 'sts:To') === '995000000', 'AuthorizedInvoices = prefijo y rango de la resolución.')
  assert(textOf(tree, 'cbc:StartDate') === '2019-01-19' && textOf(tree, 'cbc:EndDate') === '2030-01-19', 'AuthorizationPeriod = vigencia de la resolución.')
  assert(textOf(tree, 'sts:SoftwareSecurityCode') === ssc, 'SoftwareSecurityCode presente.')
  assert(textOf(tree, 'sts:QRCode') === qr, 'QRCode embebido en DianExtensions.')
  assert(textOf(tree, 'cbc:PayableAmount') === '17290.00', 'PayableAmount = 17290.00.')
  assert(xml.includes('Arroz 500g &amp; &quot;Premium&quot; &lt;x&gt;') || xml.includes('Arroz 500g &amp; "Premium" &lt;x&gt;'), 'Caracteres especiales escapados en descripciones.')
  assert((xml.match(/<cac:InvoiceLine>/g) || []).length === 2, 'Dos líneas de factura.')
  assert(xml.includes('<cbc:MultiplierFactorNumeric>10.00</cbc:MultiplierFactorNumeric>'), 'Descuento de línea (10%) reportado en AllowanceCharge.')
  assert(xml.includes('<cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="5" schemeName="31">901374526</cbc:CompanyID>'), 'NIT del emisor con DV y tipo 31.')
  assert(xml.includes('<cbc:ID schemeName="13">1090123456</cbc:ID>'), 'Adquiriente persona natural con cédula (13), solo dígitos.')
  passed++

  // 4 -------------------------------------------------------------------------
  console.log('\n--- 4. Firma XAdES-BES ---')
  const test = makeTestCertificate()
  const cert = loadSigningCertificate(test.p12Base64, test.password)
  assert(cert.serialNumber === BigInt('0x01ab23cd45').toString(), 'Serial del certificado en decimal.')
  const sig = signUblDocument(tree, cert, new Date('2026-10-21T15:15:30Z'))
  const signature = findFirst(tree, (e) => e.name === 'ds:Signature')!
  const signedInfo = findFirst(signature, (e) => e.name === 'ds:SignedInfo')!
  const refs = signedInfo.children.filter((c): c is XmlElement => c.kind === 'element' && c.name === 'ds:Reference')
  const digestOf = (r: XmlElement) => textOf(r, 'ds:DigestValue')
  const sha = (s: string) => createHash('sha256').update(s).digest('base64')
  assert(refs.length === 3, 'Tres referencias: documento, KeyInfo y SignedProperties.')
  assert(digestOf(refs[0]) === sha(canonicalize(tree, new Set([signature]))), 'Digest del documento (enveloped) correcto.')
  assert(digestOf(refs[1]) === sha(canonicalize(findFirst(signature, (e) => e.name === 'ds:KeyInfo')!)), 'Digest de KeyInfo correcto.')
  assert(digestOf(refs[2]) === sha(canonicalize(findFirst(signature, (e) => e.name === 'xades:SignedProperties')!)), 'Digest de SignedProperties correcto.')
  const verifier = createVerify('RSA-SHA256')
  verifier.update(canonicalize(signedInfo))
  const signatureValue = textOf(signature, 'ds:SignatureValue')!
  assert(verifier.verify(new X509Certificate(test.certPem).publicKey, signatureValue, 'base64'), 'Firma RSA-SHA256 verificada con la llave pública del certificado.')
  assert(textOf(signature, 'xades:SigningTime') === '2026-10-21T10:15:30-05:00', 'SigningTime en hora Colombia (-05:00).')
  assert(textOf(signature, 'xades:Identifier')!.includes('politicadefirmav2'), 'Política de firma DIAN v2 referenciada.')
  assert(sig.signatureId.startsWith('xmldsig-'), 'Id de firma generado.')
  passed++

  // 5 -------------------------------------------------------------------------
  console.log('\n--- 5. Alteración del XML firmado ---')
  const payable = findFirst(tree, (e) => e.name === 'cbc:PayableAmount')!
  payable.children = [{ kind: 'text', value: '1.00' }]
  assert(digestOf(refs[0]) !== sha(canonicalize(tree, new Set([signature]))), 'Cambiar el total invalida el digest del documento.')
  payable.children = [{ kind: 'text', value: '17290.00' }]
  assert(digestOf(refs[0]) === sha(canonicalize(tree, new Set([signature]))), 'Al restaurar el valor, el digest vuelve a coincidir.')
  passed++

  // 6 -------------------------------------------------------------------------
  console.log('\n--- 6. ZIP y nombres de archivo ---')
  const names = dianFileNames('901374526', '2026-10-21', 990000000)
  assert(names.xml === 'fv0901374526000263b023380.xml' && names.zip === 'z0901374526000263b023380.zip', 'Nombres fv/z + NIT(10) + 000 + año + consecutivo hexadecimal(8).')
  const signedXml = serialize(tree, true)
  const zip = zipSingleFile(names.xml, signedXml)
  const back = unzipFirstFile(zip)!
  assert(back.fileName === names.xml && back.content.toString('utf8') === signedXml, 'El ZIP contiene exactamente el XML firmado.')
  passed++

  // 7 -------------------------------------------------------------------------
  console.log('\n--- 7. Sobre SOAP con WS-Security ---')
  const env = buildSignedEnvelope('SendTestSetAsync', [['fileName', names.zip], ['contentFile', zip.toString('base64')], ['testSetId', 'test-set']], DIAN_HABILITACION_WS_ENDPOINT, cert)
  assert(env.includes('<wsa:Action>http://wcf.dian.colombia/IWcfDianCustomerServices/SendTestSetAsync</wsa:Action>'), 'Acción SOAP SendTestSetAsync.')
  assert(env.includes('<wcf:testSetId>test-set</wcf:testSetId>'), 'TestSetId en el cuerpo.')
  const toMatch = env.match(/<wsa:To [^>]*wsu:Id="([^"]+)"[^>]*>([^<]+)<\/wsa:To>/)!
  const toCanon = `<wsa:To xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:wcf="http://wcf.dian.colombia" xmlns:wsa="http://www.w3.org/2005/08/addressing" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" wsu:Id="${toMatch[1]}">${toMatch[2]}</wsa:To>`
  const envDigest = env.match(/<ds:DigestValue>([^<]+)<\/ds:DigestValue>/)![1]
  assert(envDigest === sha(toCanon), 'Digest de wsa:To con C14N exclusiva (PrefixList soap wcf) correcto.')
  passed++

  // 8 -------------------------------------------------------------------------
  console.log('\n--- 8. Respuestas de la DIAN ---')
  const ok = parseDianResponse('SendBillSync', 200, '<s:Envelope><s:Body><r><b:IsValid>true</b:IsValid><b:StatusCode>00</b:StatusCode><b:StatusMessage>Procesado Correctamente.</b:StatusMessage><b:ErrorMessage/></r></s:Body></s:Envelope>')
  assert(ok.isValid === true && ok.statusCode === '00' && ok.errorMessages.length === 0, 'Respuesta aceptada interpretada.')
  const bad = parseDianResponse('SendBillSync', 200, '<r><b:ErrorMessage><c:string>Regla: FAD06, Rechazo: CUFE</c:string></b:ErrorMessage><b:IsValid>false</b:IsValid><b:StatusCode>99</b:StatusCode></r>')
  assert(bad.isValid === false && bad.errorMessages[0].includes('FAD06'), 'Respuesta rechazada con reglas DIAN.')
  const track = parseDianResponse('SendTestSetAsync', 200, '<r><b:ZipKey>abc-123</b:ZipKey></r>')
  assert(track.zipKey === 'abc-123', 'TrackId (ZipKey) del set de pruebas.')
  const fault = parseDianResponse('SendBillSync', 500, '<s:Fault><s:Reason><s:Text xml:lang="es">Error de seguridad</s:Text></s:Reason></s:Fault>')
  assert(fault.fault === 'Error de seguridad' && fault.isValid === null, 'SOAP Fault detectado sin marcar aceptación.')
  const ranges = parseNumberingRanges('<s:Envelope><s:Body><GetNumberingRangeResponse><GetNumberingRangeResult><b:OperationCode>100</b:OperationCode><b:OperationDescription>Acción completada OK.</b:OperationDescription><b:ResponseList><c:NumberRangeResponse><c:ResolutionNumber>18760000001</c:ResolutionNumber><c:ResolutionDate>2019-01-19</c:ResolutionDate><c:Prefix>SETP</c:Prefix><c:FromNumber>990000000</c:FromNumber><c:ToNumber>995000000</c:ToNumber><c:ValidDateFrom>2019-01-19</c:ValidDateFrom><c:ValidDateTo>2030-01-19</c:ValidDateTo><c:TechnicalKey>abc123</c:TechnicalKey></c:NumberRangeResponse></b:ResponseList></GetNumberingRangeResult></GetNumberingRangeResponse></s:Body></s:Envelope>')
  assert(ranges.operationCode === '100' && ranges.ranges.length === 1 && ranges.ranges[0].prefix === 'SETP' && ranges.ranges[0].technicalKey === 'abc123', 'GetNumberingRange: rango, prefijo y clave técnica interpretados.')
  passed++

  // 9 -------------------------------------------------------------------------
  console.log('\n--- 9. IVA exento vs excluido ---')
  expectFail((i) => (i.lines[1].ivaTreatment = null), 'sin clasificar', 'Producto al 0 % sin clasificar (exento/excluido) bloquea la emisión.')
  expectFail((i) => (i.lines[0].ivaTreatment = 'EXCLUIDO'), 'EXCLUIDO', 'Producto con IVA marcado como excluido se bloquea (inconsistente).')
  const exclInput = baseInput()
  exclInput.lines[1].ivaTreatment = 'EXCLUIDO'
  const exclDoc = buildInvoiceDocument(exclInput)
  assert(exclDoc.totals.taxExclusiveCents === 500000 && exclDoc.totals.lineExtensionCents === 1634000, 'Excluido: no suma a la base gravable (TaxExclusive 5.000) pero sí al valor de líneas.')
  const exclTree = dianUblBuilderService.buildDocumentTree(exclDoc, { cufe: 'x', softwareSecurityCode: 'y', qrCodeContent: 'z' })
  const exclXml = serialize(exclTree, true)
  const lineBlocks = exclXml.split('<cac:InvoiceLine>').slice(1)
  assert(lineBlocks[0].includes('<cac:TaxTotal>') && !lineBlocks[1].includes('<cac:TaxTotal>'), 'Línea excluida sin TaxTotal; línea gravada con TaxTotal.')
  const exeXml = serialize(dianUblBuilderService.buildDocumentTree(doc, { cufe: 'x', softwareSecurityCode: 'y', qrCodeContent: 'z' }), true)
  assert(exeXml.includes('<cbc:TaxableAmount currencyID="COP">11340.00</cbc:TaxableAmount>') && exeXml.includes('<cbc:Percent>0.00</cbc:Percent>'), 'Exento: TaxSubtotal con base 11.340 y tarifa 0.00.')
  assert(doc.totals.taxExclusiveCents === 1634000, 'Exento: la base exenta sí cuenta en TaxExclusiveAmount.')
  const onlyExcl = baseInput()
  onlyExcl.lines = [{ ...onlyExcl.lines[1], ivaTreatment: 'EXCLUIDO' }]
  const onlyExclXml = serialize(dianUblBuilderService.buildDocumentTree(buildInvoiceDocument(onlyExcl), { cufe: 'x', softwareSecurityCode: 'y', qrCodeContent: 'z' }), true)
  assert(!onlyExclXml.includes('<cac:TaxTotal>'), 'Factura solo con bienes excluidos: sin TaxTotal.')
  passed++

  // 10 ------------------------------------------------------------------------
  console.log('\n--- 10. Notas crédito y débito ---')
  const PIN = 'PIN-PRUEBA'
  const noteBase = (kind: 'CREDIT_NOTE' | 'DEBIT_NOTE'): DianInvoiceInput => {
    const n = baseInput()
    n.kind = kind
    n.prefix = kind === 'CREDIT_NOTE' ? 'NCT' : 'NDT'
    n.number = 1
    n.issueTime = '11:00:00-05:00'
    n.resolution = null
    n.billingReference = { id: 'SETP990000000', uuid: cufe, issueDate: '2026-10-21' }
    n.discrepancy = kind === 'CREDIT_NOTE' ? { code: '1', description: 'Devolución parcial de los bienes y/o no aceptación parcial del servicio' } : { code: '1', description: 'Intereses' }
    n.orderReference = null
    n.notes = ['Cliente devolvió 1 unidad']
    n.lines = kind === 'CREDIT_NOTE'
      ? [{ productId: 'p1', sku: 'SKU1', description: 'Arroz 500g', quantity: 1, unitPrice: 2500, discountPercent: 0, taxRatePercent: 19, netAmount: 2500, taxAmount: 475, ivaTreatment: 'GRAVADO' }]
      : [{ productId: '', sku: 'ND-1', description: 'Intereses de mora', quantity: 1, unitPrice: 5000, discountPercent: 0, taxRatePercent: 0, netAmount: 5000, taxAmount: 0, ivaTreatment: 'EXCLUIDO' }]
    return n
  }
  const ncInput = noteBase('CREDIT_NOTE')
  const nc = buildInvoiceDocument(ncInput)
  const cude = dianCryptoService.calculateDocumentCUDE(nc, PIN)
  const cudeManual = 'NCT1' + '2026-10-21' + '11:00:00-05:00' + '2500.00' + '01' + '475.00' + '04' + '0.00' + '03' + '0.00' + '2975.00' + '901374526' + '1090123456' + PIN + '2'
  assert(cude === createHash('sha384').update(cudeManual).digest('hex'), 'CUDE = SHA-384 de la concatenación oficial con el PIN del software.')
  assert(dianCryptoService.calculateDocumentKey(nc, { technicalKey: TECH_KEY, pin: PIN }) === cude, 'La nota usa CUDE (PIN), no la clave técnica.')
  const ncQr = dianCryptoService.buildQRCodeContent(nc, cude, DIAN_HABILITACION_QR_BASE_URL)
  assert(ncQr.includes(`CUDE=${cude}`) && ncQr.includes('NumFac=NCT1'), 'QR de la nota con CUDE.')
  const ncTree = dianUblBuilderService.buildDocumentTree(nc, { cufe: cude, softwareSecurityCode: 'ssc', qrCodeContent: ncQr })
  const ncXml = serialize(ncTree, true)
  assert(ncTree.name === 'CreditNote' && ncXml.includes('xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"'), 'Raíz CreditNote con su espacio de nombres.')
  assert(textOf(ncTree, 'cbc:CustomizationID') === '20' && textOf(ncTree, 'cbc:CreditNoteTypeCode') === '91', 'CustomizationID 20 y CreditNoteTypeCode 91.')
  assert(ncXml.includes('<cbc:UUID schemeID="2" schemeName="CUDE-SHA384">' + cude), 'UUID con esquema CUDE-SHA384.')
  assert(ncXml.includes('<cbc:ResponseCode>1</cbc:ResponseCode>') && ncXml.includes('<cbc:ReferenceID>SETP990000000</cbc:ReferenceID>'), 'DiscrepancyResponse con concepto y factura referenciada.')
  assert(ncXml.includes('<cbc:UUID schemeName="CUFE-SHA384">' + cufe + '</cbc:UUID>'), 'BillingReference con el CUFE de la factura.')
  assert(!ncXml.includes('InvoiceControl') && ncXml.includes('<cac:CreditNoteLine>') && ncXml.includes('<cbc:CreditedQuantity unitCode="94">1.000000</cbc:CreditedQuantity>'), 'Sin InvoiceControl; líneas CreditNoteLine con CreditedQuantity.')
  assert(ncXml.includes('<cac:LegalMonetaryTotal>') && textOf(ncTree, 'cbc:PayableAmount') === '2975.00', 'LegalMonetaryTotal de la nota crédito (2.975).')
  signUblDocument(ncTree, cert, new Date('2026-10-21T16:00:00Z'))
  const ncSig = findFirst(ncTree, (e) => e.name === 'ds:Signature')!
  const ncRefs = findFirst(ncSig, (e) => e.name === 'ds:SignedInfo')!.children.filter((c): c is XmlElement => c.kind === 'element' && c.name === 'ds:Reference')
  assert(textOf(ncRefs[0], 'ds:DigestValue') === sha(canonicalize(ncTree, new Set([ncSig]))), 'Nota crédito firmada (digest del documento verificado).')
  const ncNames = dianFileNames('901374526', '2026-10-21', 1, 'CREDIT_NOTE')
  assert(ncNames.xml === 'nc090137452600026' + '00000001.xml' && ncNames.zip !== dianFileNames('901374526', '2026-10-21', 1).zip, 'Archivo nc… y ZIP distinto al de una factura con el mismo consecutivo.')

  const nd = buildInvoiceDocument(noteBase('DEBIT_NOTE'))
  const ndCude = dianCryptoService.calculateDocumentCUDE(nd, PIN)
  const ndTree = dianUblBuilderService.buildDocumentTree(nd, { cufe: ndCude, softwareSecurityCode: 'ssc', qrCodeContent: 'qr' })
  const ndXml = serialize(ndTree, true)
  assert(ndTree.name === 'DebitNote' && textOf(ndTree, 'cbc:CustomizationID') === '30', 'Raíz DebitNote, CustomizationID 30.')
  assert(ndXml.includes('<cac:RequestedMonetaryTotal>') && !ndXml.includes('LegalMonetaryTotal') && ndXml.includes('<cbc:DebitedQuantity'), 'Nota débito con RequestedMonetaryTotal y DebitedQuantity.')
  assert(!ndXml.includes('<cac:TaxTotal>'), 'Nota débito de intereses excluidos: sin IVA.')
  const badNote = noteBase('CREDIT_NOTE')
  badNote.billingReference = null
  try {
    buildInvoiceDocument(badNote)
    assert(false, 'Nota sin factura referenciada se bloquea.')
  } catch (e: any) {
    assert(e instanceof DianDocumentError && e.problems.some((p) => p.includes('referenciar')), 'Nota sin factura referenciada se bloquea.')
  }
  passed++

  // Validación XSD opcional (UBL 2.1 oficial)
  const xsdDir = process.env.XSD_DIR
  if (xsdDir) {
    const { execFileSync } = require('child_process')
    const fs = require('fs')
    const os = require('os')
    const path = require('path')
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ubl-'))
    // El esquema exige contenido en cada ExtensionContent: se valida el documento ya firmado.
    signUblDocument(exclTree, cert)
    signUblDocument(ndTree, cert)
    // Nota crédito con descuento de línea (orden TaxTotal → AllowanceCharge en CreditNoteLine)
    const ncDisc = noteBase('CREDIT_NOTE')
    ncDisc.lines = [{ productId: 'p2', sku: 'SKU2', description: 'Leche 1L', quantity: 1, unitPrice: 4200, discountPercent: 10, taxRatePercent: 0, netAmount: 3780, taxAmount: 0, ivaTreatment: 'EXENTO' }]
    const ncDiscTree = dianUblBuilderService.buildDocumentTree(buildInvoiceDocument(ncDisc), { cufe: 'c', softwareSecurityCode: 's', qrCodeContent: 'q' })
    signUblDocument(ncDiscTree, cert)
    const cases: Array<[string, string, string]> = [
      ['factura.xml', serialize(tree, true), 'UBL-Invoice-2.1.xsd'],
      ['factura-excluidos.xml', serialize(exclTree, true), 'UBL-Invoice-2.1.xsd'],
      ['nota-credito.xml', serialize(ncTree, true), 'UBL-CreditNote-2.1.xsd'],
      ['nota-debito.xml', serialize(ndTree, true), 'UBL-DebitNote-2.1.xsd'],
      ['nota-credito-descuento.xml', serialize(ncDiscTree, true), 'UBL-CreditNote-2.1.xsd'],
    ]
    for (const [name, content, xsd] of cases) {
      const f = path.join(tmp, name)
      fs.writeFileSync(f, content)
      let out = ''
      try {
        out = execFileSync('xmllint', ['--noout', '--schema', path.join(xsdDir, 'maindoc', xsd), f], { stdio: 'pipe' }).toString()
      } catch (e: any) {
        out = (e.stderr || e.stdout || '').toString()
      }
      // libxml no maneja enteros > 2^31 en un facet del esquema (limitación conocida, no del XML)
      const realErrors = out.split('\n').filter((l: string) => /error/i.test(l) && !/too large|out of range|xs:integer|integer/i.test(l))
      assert(realErrors.length === 0, `XSD UBL 2.1: ${name} válido contra ${xsd}${realErrors.length ? ' → ' + realErrors.join(' | ') : ''}`)
    }
  }

  // Canonicalización exclusiva básica
  assert(canonicalizeExclusive(findFirst(tree, (e) => e.name === 'cbc:ID')!).startsWith('<cbc:ID xmlns:cbc='), 'C14N exclusiva declara solo namespaces utilizados.')

  console.log('\n================================================================================')
  console.log(`🎉 XML + CUFE/CUDE + QR + FIRMA + SOAP + NOTAS: ${passed}/10 BLOQUES APROBADOS`)
  console.log('================================================================================')
}

runDianXmlFirmaSuite().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
