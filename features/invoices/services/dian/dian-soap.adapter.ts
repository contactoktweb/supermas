/**
 * SUPER MÁS ERP/POS — Adaptador SOAP 1.2 del WebService DIAN (WcfDianCustomerServices.svc)
 *
 * Operaciones: SendTestSetAsync (set de pruebas de habilitación), SendBillSync, GetStatusZip, GetStatus,
 * GetNumberingRange (rangos de numeración autorizados y su clave técnica).
 * Seguridad: WS-Security con BinarySecurityToken X.509, Timestamp y firma RSA-SHA256
 * sobre wsa:To (C14N exclusiva), como exige la DIAN.
 *
 * Este módulo NO decide estados fiscales: devuelve la respuesta cruda interpretada
 * para que el orquestador la persista.
 */

import { createHash, createSign, randomUUID } from 'crypto'
import { canonicalizeExclusive, el, findFirst, linkParents, serialize, XmlElement } from './xml/xml-tree'
import { DianSigningCertificate } from './dian-certificate'
import { unzipFirstFile } from './dian-zip'

const NS = {
  soap: 'http://www.w3.org/2003/05/soap-envelope',
  wcf: 'http://wcf.dian.colombia',
  wsa: 'http://www.w3.org/2005/08/addressing',
  wsse: 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd',
  wsu: 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd',
  ds: 'http://www.w3.org/2000/09/xmldsig#',
  exc: 'http://www.w3.org/2001/10/xml-exc-c14n#',
}
const X509V3 = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3'
const BASE64 = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary'

export type DianSoapOperation = 'SendTestSetAsync' | 'SendBillSync' | 'SendBillAsync' | 'GetStatusZip' | 'GetStatus' | 'GetNumberingRange'

export interface DianSoapResult {
  operation: DianSoapOperation
  httpStatus: number
  /** true si la DIAN validó el documento (IsValid=true) */
  isValid: boolean | null
  statusCode: string | null
  statusDescription: string | null
  statusMessage: string | null
  errorMessages: string[]
  /** TrackId / ZipKey (envíos asíncronos) */
  zipKey: string | null
  /** CUFE devuelto por la DIAN */
  xmlDocumentKey: string | null
  /** ApplicationResponse (XML) devuelto por la DIAN, si lo hay */
  applicationResponseXml: string | null
  /** Respuesta SOAP completa (para auditoría) */
  rawResponse: string
  /** Fallo SOAP (Fault) o de autenticación */
  fault: string | null
}

export class DianCommunicationError extends Error {
  constructor(message: string, public readonly retryable = true) {
    super(message)
    this.name = 'DianCommunicationError'
  }
}

// ------------------------------------------------------------------------------
// Construcción del sobre SOAP firmado
// ------------------------------------------------------------------------------

const isoUtc = (d: Date) => d.toISOString()

export function buildSignedEnvelope(
  operation: DianSoapOperation,
  bodyParams: Array<[string, string]>,
  endpoint: string,
  cert: DianSigningCertificate,
  now = new Date()
): string {
  const uid = randomUUID().replace(/-/g, '').toUpperCase()
  const toId = `id-${uid}`
  const action = `http://wcf.dian.colombia/IWcfDianCustomerServices/${operation}`

  const to = el('wsa:To', { 'xmlns:wsu': NS.wsu, 'wsu:Id': toId }, endpoint)
  const signedInfo = el('ds:SignedInfo', null,
    el('ds:CanonicalizationMethod', { Algorithm: NS.exc },
      el('InclusiveNamespaces', { xmlns: NS.exc, PrefixList: 'wsa soap wcf' })
    ),
    el('ds:SignatureMethod', { Algorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256' }),
    el('ds:Reference', { URI: `#${toId}` },
      el('ds:Transforms', null,
        el('ds:Transform', { Algorithm: NS.exc },
          el('InclusiveNamespaces', { xmlns: NS.exc, PrefixList: 'soap wcf' })
        )
      ),
      el('ds:DigestMethod', { Algorithm: 'http://www.w3.org/2001/04/xmlenc#sha256' }),
      el('ds:DigestValue', null)
    )
  )
  const signatureValue = el('ds:SignatureValue', null)

  const envelope = el('soap:Envelope', { 'xmlns:soap': NS.soap, 'xmlns:wcf': NS.wcf },
    el('soap:Header', { 'xmlns:wsa': NS.wsa },
      el('wsse:Security', { 'xmlns:wsse': NS.wsse, 'xmlns:wsu': NS.wsu },
        el('wsu:Timestamp', { 'wsu:Id': `TS-${uid}` },
          el('wsu:Created', null, isoUtc(now)),
          el('wsu:Expires', null, isoUtc(new Date(now.getTime() + 60000)))
        ),
        el('wsse:BinarySecurityToken', { EncodingType: BASE64, ValueType: X509V3, 'wsu:Id': `X509-${uid}` }, cert.certificateBase64),
        el('ds:Signature', { Id: `SIG-${uid}`, 'xmlns:ds': NS.ds },
          signedInfo,
          signatureValue,
          el('ds:KeyInfo', { Id: `KI-${uid}` },
            el('wsse:SecurityTokenReference', { 'wsu:Id': `STR-${uid}` },
              el('wsse:Reference', { URI: `#X509-${uid}`, ValueType: X509V3 })
            )
          )
        )
      ),
      el('wsa:Action', null, action),
      to
    ),
    el('soap:Body', null,
      el(`wcf:${operation}`, null, ...bodyParams.map(([k, v]) => el(`wcf:${k}`, null, v)))
    )
  )
  linkParents(envelope)

  const digest = createHash('sha256').update(canonicalizeExclusive(to, ['soap', 'wcf']), 'utf8').digest('base64')
  const dv = findFirst(signedInfo, (e) => e.name === 'ds:DigestValue')!
  dv.children = [{ kind: 'text', value: digest }]

  const signer = createSign('RSA-SHA256')
  signer.update(canonicalizeExclusive(signedInfo, ['wsa', 'soap', 'wcf']), 'utf8')
  signatureValue.children = [{ kind: 'text', value: signer.sign(cert.privateKey, 'base64') }]

  return serialize(envelope)
}

// ------------------------------------------------------------------------------
// Lectura de la respuesta (sin parser XML: extracción por etiquetas conocidas)
// ------------------------------------------------------------------------------

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&amp;/g, '&')
}

function tagValue(xml: string, local: string): string | null {
  const re = new RegExp(`<(?:[A-Za-z0-9_]+:)?${local}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[A-Za-z0-9_]+:)?${local}>`)
  const m = xml.match(re)
  if (m) return decodeEntities(m[1].trim())
  const selfClosing = new RegExp(`<(?:[A-Za-z0-9_]+:)?${local}(?:\\s[^>]*)?/>`)
  return selfClosing.test(xml) ? '' : null
}

function allTagValues(xml: string, local: string): string[] {
  const re = new RegExp(`<(?:[A-Za-z0-9_]+:)?${local}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[A-Za-z0-9_]+:)?${local}>`, 'g')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) out.push(decodeEntities(m[1].trim()))
  return out
}

export function parseDianResponse(operation: DianSoapOperation, httpStatus: number, raw: string): DianSoapResult {
  const fault = /<(?:[A-Za-z0-9_]+:)?Fault[\s>]/.test(raw)
    ? tagValue(raw, 'Text') || tagValue(raw, 'faultstring') || 'SOAP Fault sin descripción'
    : null

  const isValidRaw = tagValue(raw, 'IsValid')
  const errorBlock = tagValue(raw, 'ErrorMessage') || ''
  const errorMessages = errorBlock ? allTagValues(errorBlock, 'string').filter(Boolean) : []

  let applicationResponseXml: string | null = null
  const xmlBase64 = tagValue(raw, 'XmlBase64Bytes')
  if (xmlBase64) {
    try {
      applicationResponseXml = Buffer.from(xmlBase64, 'base64').toString('utf8')
    } catch {
      applicationResponseXml = null
    }
  }

  // GetStatusZip devuelve un ZIP en Base64 con la respuesta del set de pruebas
  if (operation === 'GetStatusZip') {
    const zipB64 = tagValue(raw, 'GetStatusZipResult')
    if (zipB64 && /^[A-Za-z0-9+/=\s]+$/.test(zipB64)) {
      const file = unzipFirstFile(Buffer.from(zipB64, 'base64'))
      if (file) {
        const inner = file.content.toString('utf8')
        return { ...parseDianResponse('GetStatus', httpStatus, inner), operation, rawResponse: raw }
      }
    }
  }

  return {
    operation,
    httpStatus,
    isValid: isValidRaw === null ? null : isValidRaw.toLowerCase() === 'true',
    statusCode: tagValue(raw, 'StatusCode'),
    statusDescription: tagValue(raw, 'StatusDescription'),
    statusMessage: tagValue(raw, 'StatusMessage'),
    errorMessages,
    zipKey: tagValue(raw, 'ZipKey'),
    xmlDocumentKey: tagValue(raw, 'XmlDocumentKey'),
    applicationResponseXml,
    rawResponse: raw,
    fault,
  }
}

/** Rango de numeración tal como lo devuelve GetNumberingRange */
export interface DianNumberingRange {
  resolutionNumber: string | null
  resolutionDate: string | null
  prefix: string | null
  fromNumber: string | null
  toNumber: string | null
  validDateFrom: string | null
  validDateTo: string | null
  technicalKey: string | null
}

export function parseNumberingRanges(raw: string): { ranges: DianNumberingRange[]; operationCode: string | null; operationDescription: string | null } {
  const blocks = raw.match(/<(?:[A-Za-z0-9_]+:)?NumberRangeResponse(?:\s[^>]*)?>[\s\S]*?<\/(?:[A-Za-z0-9_]+:)?NumberRangeResponse>/g) || []
  const ranges = blocks.map((b) => ({
    resolutionNumber: tagValue(b, 'ResolutionNumber'),
    resolutionDate: tagValue(b, 'ResolutionDate'),
    prefix: tagValue(b, 'Prefix'),
    fromNumber: tagValue(b, 'FromNumber'),
    toNumber: tagValue(b, 'ToNumber'),
    validDateFrom: tagValue(b, 'ValidDateFrom'),
    validDateTo: tagValue(b, 'ValidDateTo'),
    technicalKey: tagValue(b, 'TechnicalKey'),
  }))
  return { ranges, operationCode: tagValue(raw, 'OperationCode'), operationDescription: tagValue(raw, 'OperationDescription') }
}

// ------------------------------------------------------------------------------
// Cliente HTTP
// ------------------------------------------------------------------------------

export class DianSoapAdapter {
  readonly adapterName = 'DIAN_SOAP_SOFTWARE_PROPIO'

  constructor(
    private readonly endpoint: string,
    private readonly cert: DianSigningCertificate,
    private readonly timeoutMs = 60000
  ) {}

  async call(operation: DianSoapOperation, params: Array<[string, string]>): Promise<DianSoapResult> {
    const envelope = buildSignedEnvelope(operation, params, this.endpoint, this.cert)
    const action = `http://wcf.dian.colombia/IWcfDianCustomerServices/${operation}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    let res: Response
    try {
      res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': `application/soap+xml;charset=UTF-8;action="${action}"`, Accept: 'application/soap+xml' },
        body: envelope,
        signal: controller.signal,
      })
    } catch (e: any) {
      const msg = e?.name === 'AbortError' ? `Tiempo de espera agotado (${this.timeoutMs} ms) con la DIAN.` : `No se pudo conectar con la DIAN: ${e?.message || e}`
      throw new DianCommunicationError(msg, true)
    } finally {
      clearTimeout(timer)
    }
    const text = await res.text()
    if (!/<(?:[A-Za-z0-9_]+:)?Envelope[\s>]/.test(text)) {
      // Página HTML de un proxy/firewall, 403, 502, etc.: no es una respuesta de la DIAN.
      throw new DianCommunicationError(`Respuesta inesperada (HTTP ${res.status}) que no proviene del servicio SOAP de la DIAN.`, true)
    }
    return parseDianResponse(operation, res.status, text)
  }

  sendTestSetAsync(zipFileName: string, zipBase64: string, testSetId: string) {
    return this.call('SendTestSetAsync', [['fileName', zipFileName], ['contentFile', zipBase64], ['testSetId', testSetId]])
  }

  sendBillSync(zipFileName: string, zipBase64: string) {
    return this.call('SendBillSync', [['fileName', zipFileName], ['contentFile', zipBase64]])
  }

  getStatusZip(trackId: string) {
    return this.call('GetStatusZip', [['trackId', trackId]])
  }

  getStatus(trackId: string) {
    return this.call('GetStatus', [['trackId', trackId]])
  }

  /**
   * Rangos de numeración asociados al software (incluye la clave técnica).
   * Software propio: el NIT del facturador es también el del proveedor tecnológico.
   */
  async getNumberingRange(nit: string, softwareId: string) {
    const res = await this.call('GetNumberingRange', [['accountCode', nit], ['accountCodeT', nit], ['softwareCode', softwareId]])
    return { ...res, ...parseNumberingRanges(res.rawResponse) }
  }
}

/**
 * Nombres de archivo según el Anexo: fv/z + NIT (10 dígitos) + código proveedor ('000' software propio)
 * + año (2 dígitos) + consecutivo hexadecimal (8 dígitos).
 */
export function dianFileNames(
  nit: string,
  issueDate: string,
  consecutive: number,
  kind: 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE' = 'INVOICE'
): { xml: string; zip: string } {
  const nit10 = nit.replace(/[^0-9]/g, '').padStart(10, '0').slice(-10)
  const yy = issueDate.slice(2, 4)
  const hexOf = (n: number) => (n % 0x100000000).toString(16).padStart(8, '0')
  const xmlPrefix = kind === 'INVOICE' ? 'fv' : kind === 'CREDIT_NOTE' ? 'nc' : 'nd'
  // Los ZIP comparten prefijo "z": a las notas se les suma un desplazamiento para que su nombre
  // de paquete nunca coincida con el de una factura del mismo año.
  const zipOffset = kind === 'INVOICE' ? 0 : kind === 'CREDIT_NOTE' ? 0xc0000000 : 0xd0000000
  return {
    xml: `${xmlPrefix}${nit10}000${yy}${hexOf(consecutive)}.xml`,
    zip: `z${nit10}000${yy}${hexOf(kind === 'INVOICE' ? consecutive : zipOffset + (consecutive % 0x10000000))}.zip`,
  }
}
