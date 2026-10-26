/**
 * AttachedDocument (Anexo Técnico, "Documentos adjuntos"): contenedor que se entrega al adquiriente con el
 * documento firmado (factura o nota) y la ApplicationResponse con la que la DIAN lo validó.
 * El árbol resultante se firma con el mismo certificado del emisor.
 */
import { el, XmlElement } from '../dian/xml/xml-tree'
import { DianInvoiceDocument, dianIdTypeCode } from '../dian/dian-document'

const ATTACHED_NAMESPACES: Record<string, string> = {
  xmlns: 'urn:oasis:names:specification:ubl:schema:xsd:AttachedDocument-2',
  'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
  'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  'xmlns:ccts': 'urn:un:unece:uncefact:data:specification:CoreComponentTypeSchemaModule:2',
  'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
  'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
  'xmlns:xades': 'http://uri.etsi.org/01903/v1.3.2#',
  'xmlns:xades141': 'http://uri.etsi.org/01903/v1.4.1#',
}

const DIAN_AGENCY = { schemeAgencyID: '195', schemeAgencyName: 'CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)' }

const PROFILE_BY_KIND = {
  INVOICE: { profile: 'Factura Electrónica de Venta', container: 'Contenedor de Factura Electrónica', key: 'CUFE-SHA384' },
  CREDIT_NOTE: { profile: 'Nota Crédito Electrónica', container: 'Contenedor de Nota Crédito Electrónica', key: 'CUDE-SHA384' },
  DEBIT_NOTE: { profile: 'Nota Débito Electrónica', container: 'Contenedor de Nota Débito Electrónica', key: 'CUDE-SHA384' },
} as const

export interface DianValidationStamp {
  date: string // YYYY-MM-DD
  time: string // HH:MM:SS-05:00
}

/** Fecha y hora de validación tomadas de la ApplicationResponse (o de la fecha de respuesta registrada). */
export function validationStampFrom(applicationResponseXml: string | null, responseDateIso: string | null): DianValidationStamp {
  const date = applicationResponseXml?.match(/<cbc:IssueDate>([^<]+)<\/cbc:IssueDate>/)?.[1]
  const time = applicationResponseXml?.match(/<cbc:IssueTime>([^<]+)<\/cbc:IssueTime>/)?.[1]
  if (date && time) return { date, time }
  const fallback = new Date(new Date(responseDateIso || Date.now()).getTime() - 5 * 3600 * 1000).toISOString()
  return { date: fallback.slice(0, 10), time: `${fallback.slice(11, 19)}-05:00` }
}

function partyTaxScheme(p: { name: string; id: string; idType: string; dv?: string | null; taxLevelCodes: string; taxSchemeCode: string }): XmlElement {
  const isVat = p.taxSchemeCode === '01'
  return el('cac:PartyTaxScheme', null,
    el('cbc:RegistrationName', null, p.name),
    el('cbc:CompanyID', { ...DIAN_AGENCY, schemeID: p.idType === '31' ? p.dv || undefined : undefined, schemeName: p.idType }, p.id),
    el('cbc:TaxLevelCode', { listName: '48' }, p.taxLevelCodes),
    el('cac:TaxScheme', null, el('cbc:ID', null, isVat ? '01' : 'ZZ'), el('cbc:Name', null, isVat ? 'IVA' : 'No aplica'))
  )
}

export function buildAttachedDocumentTree(params: {
  document: DianInvoiceDocument
  cufe: string
  signedXml: string
  applicationResponseXml: string
  validation: DianValidationStamp
  issueDate: string
  issueTime: string
}): XmlElement {
  const { document: doc } = params
  const profile = PROFILE_BY_KIND[doc.kind]
  const issuer = doc.input.issuer
  const customer = doc.input.customer
  const customerIdType = dianIdTypeCode(customer.documentType)

  const attachment = (xml: string) =>
    el('cac:Attachment', null,
      el('cac:ExternalReference', null,
        el('cbc:MimeCode', null, 'text/xml'),
        el('cbc:EncodingCode', null, 'UTF-8'),
        el('cbc:Description', null, xml)
      )
    )

  return el('AttachedDocument', ATTACHED_NAMESPACES,
    el('ext:UBLExtensions', null, el('ext:UBLExtension', null, el('ext:ExtensionContent'))),
    el('cbc:UBLVersionID', null, 'UBL 2.1'),
    el('cbc:CustomizationID', null, 'Documentos adjuntos'),
    el('cbc:ProfileID', null, profile.profile),
    el('cbc:ProfileExecutionID', null, doc.input.environmentCode),
    el('cbc:ID', null, doc.documentId),
    el('cbc:IssueDate', null, params.issueDate),
    el('cbc:IssueTime', null, params.issueTime),
    el('cbc:DocumentType', null, profile.container),
    el('cbc:ParentDocumentID', null, doc.documentId),
    el('cac:SenderParty', null,
      partyTaxScheme({ name: issuer.legalName, id: issuer.nit, idType: '31', dv: issuer.dv, taxLevelCodes: issuer.taxLevelCodes, taxSchemeCode: issuer.taxSchemeCode })
    ),
    el('cac:ReceiverParty', null,
      partyTaxScheme({
        name: customer.name,
        id: customer.documentNumber,
        idType: customerIdType,
        dv: customer.dv,
        taxLevelCodes: customer.taxLevelCodes || 'R-99-PN',
        taxSchemeCode: customer.taxSchemeCode === '01' ? '01' : 'ZZ',
      })
    ),
    attachment(params.signedXml),
    el('cac:ParentDocumentLineReference', null,
      el('cbc:LineID', null, '1'),
      el('cac:DocumentReference', null,
        el('cbc:ID', null, doc.documentId),
        el('cbc:UUID', { schemeName: profile.key }, params.cufe),
        el('cbc:IssueDate', null, doc.input.issueDate),
        el('cbc:DocumentType', null, 'ApplicationResponse'),
        attachment(params.applicationResponseXml),
        el('cac:ResultOfVerification', null,
          el('cbc:ValidatorID', null, 'Unidad Especial Dirección de Impuestos y Aduanas Nacionales'),
          el('cbc:ValidationResultCode', null, '02'),
          el('cbc:ValidationDate', null, params.validation.date),
          el('cbc:ValidationTime', null, params.validation.time)
        )
      )
    )
  )
}
