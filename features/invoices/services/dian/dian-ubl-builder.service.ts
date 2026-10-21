/**
 * SUPER MÁS ERP/POS — Constructor XML UBL 2.1 de Factura, Nota Crédito y Nota Débito (DIAN, Anexo 1.9)
 *
 * Produce el árbol XML de <Invoice>, <CreditNote> o <DebitNote> con:
 *  - UBLExtensions[0]: sts:DianExtensions (InvoiceControl, InvoiceSource, SoftwareProvider,
 *    SoftwareSecurityCode, AuthorizationProvider, QRCode)
 *  - UBLExtensions[1]: ExtensionContent vacío donde se inserta la firma XAdES (ds:Signature)
 *  - Encabezado, emisor, adquiriente, medios de pago, impuestos, totales y líneas.
 *
 * Todos los valores provienen del DianInvoiceDocument: el CUFE se calcula sobre los mismos montos.
 */

import { el, linkParents, serialize, XmlElement } from './xml/xml-tree'
import {
  DianDocumentKind,
  DianInvoiceDocument,
  formatCents,
  formatQuantity,
  formatPercent,
  dianIdTypeCode,
  DIAN_FINAL_CONSUMER_DOC,
} from './dian-document'
import { customerIdForFiscal } from './dian-crypto.service'
import { DIAN_AUTHORIZATION_PROVIDER_DV, DIAN_AUTHORIZATION_PROVIDER_NIT } from './dian.config'

const COMMON_NAMESPACES: Record<string, string> = {
  'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
  'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
  'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
  'xmlns:sts': 'dian:gov:co:facturaelectronica:Structures-2-1',
  'xmlns:xades': 'http://uri.etsi.org/01903/v1.3.2#',
  'xmlns:xades141': 'http://uri.etsi.org/01903/v1.4.1#',
  'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
}

const ROOT_BY_KIND: Record<DianDocumentKind, { root: string; ns: string; xsd: string }> = {
  INVOICE: { root: 'Invoice', ns: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2', xsd: 'UBL-Invoice-2.1.xsd' },
  CREDIT_NOTE: { root: 'CreditNote', ns: 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2', xsd: 'UBL-CreditNote-2.1.xsd' },
  DEBIT_NOTE: { root: 'DebitNote', ns: 'urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2', xsd: 'UBL-DebitNote-2.1.xsd' },
}

export function ublNamespaces(kind: DianDocumentKind): Record<string, string> {
  const r = ROOT_BY_KIND[kind]
  return {
    xmlns: r.ns,
    ...COMMON_NAMESPACES,
    'xsi:schemaLocation': `${r.ns}     http://docs.oasis-open.org/ubl/os-UBL-2.1/xsd/maindoc/${r.xsd}`,
  }
}

/** Compatibilidad: espacios de nombres de la factura */
export const UBL_NAMESPACES: Record<string, string> = ublNamespaces('INVOICE')

const DIAN_AGENCY = { schemeAgencyID: '195', schemeAgencyName: 'CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)' }
const COP = { currencyID: 'COP' }

export interface UblBuildOptions {
  /** CUFE (factura) o CUDE (nota) */
  cufe: string
  softwareSecurityCode: string
  qrCodeContent: string
}

export class DianUblBuilderService {
  /**
   * Árbol XML del documento según su tipo:
   *  - Factura (Invoice): CustomizationID 10, InvoiceTypeCode 01, InvoiceControl con la resolución.
   *  - Nota crédito (CreditNote): CustomizationID 20 (referencia a factura), CreditNoteTypeCode 91,
   *    DiscrepancyResponse (concepto), BillingReference (factura y su CUFE), LegalMonetaryTotal.
   *  - Nota débito (DebitNote): CustomizationID 30, DiscrepancyResponse, BillingReference,
   *    RequestedMonetaryTotal, líneas con DebitedQuantity.
   */
  buildDocumentTree(doc: DianInvoiceDocument, opts: UblBuildOptions): XmlElement {
    const i = doc.input
    const t = doc.totals
    const kind = doc.kind
    const isInvoice = kind === 'INVOICE'
    const isCredit = kind === 'CREDIT_NOTE'
    const isDebit = kind === 'DEBIT_NOTE'

    const customization = isInvoice ? '10' : isCredit ? '20' : '30'
    const profile = isInvoice
      ? 'DIAN 2.1: Factura Electrónica de Venta'
      : isCredit
      ? 'DIAN 2.1: Nota Crédito de Factura Electrónica de Venta'
      : 'DIAN 2.1: Nota Débito de Factura Electrónica de Venta'
    const keyName = isInvoice ? 'CUFE-SHA384' : 'CUDE-SHA384'
    const payment = i.payment || null

    const monetary = el(isDebit ? 'cac:RequestedMonetaryTotal' : 'cac:LegalMonetaryTotal', null,
      el('cbc:LineExtensionAmount', COP, formatCents(t.lineExtensionCents)),
      el('cbc:TaxExclusiveAmount', COP, formatCents(t.taxExclusiveCents)),
      el('cbc:TaxInclusiveAmount', COP, formatCents(t.taxInclusiveCents)),
      el('cbc:AllowanceTotalAmount', COP, formatCents(t.allowanceCents)),
      el('cbc:ChargeTotalAmount', COP, formatCents(t.chargeCents)),
      el('cbc:PayableAmount', COP, formatCents(t.payableCents))
    )

    const lineName = isInvoice ? 'cac:InvoiceLine' : isCredit ? 'cac:CreditNoteLine' : 'cac:DebitNoteLine'
    const qtyName = isInvoice ? 'cbc:InvoicedQuantity' : isCredit ? 'cbc:CreditedQuantity' : 'cbc:DebitedQuantity'

    const root = el(
      ROOT_BY_KIND[kind].root,
      ublNamespaces(kind),
      el('ext:UBLExtensions', null,
        el('ext:UBLExtension', null, el('ext:ExtensionContent', null, this.dianExtensions(doc, opts))),
        // Contenedor de la firma digital XAdES-BES (se llena al firmar)
        el('ext:UBLExtension', null, el('ext:ExtensionContent', null))
      ),
      el('cbc:UBLVersionID', null, 'UBL 2.1'),
      el('cbc:CustomizationID', null, customization),
      el('cbc:ProfileID', null, profile),
      el('cbc:ProfileExecutionID', null, i.environmentCode),
      el('cbc:ID', null, doc.documentId),
      el('cbc:UUID', { schemeID: i.environmentCode, schemeName: keyName }, opts.cufe),
      el('cbc:IssueDate', null, i.issueDate),
      el('cbc:IssueTime', null, i.issueTime),
      isInvoice && payment?.form === '2' && payment.dueDate ? el('cbc:DueDate', null, payment.dueDate) : null,
      isInvoice ? el('cbc:InvoiceTypeCode', null, '01') : null,
      isCredit ? el('cbc:CreditNoteTypeCode', null, '91') : null,
      ...(i.notes || []).filter(Boolean).map((n) => el('cbc:Note', null, n)),
      el('cbc:DocumentCurrencyCode', { listAgencyID: '6', listAgencyName: 'United Nations Economic Commission for Europe', listID: 'ISO 4217 Alpha' }, 'COP'),
      el('cbc:LineCountNumeric', null, String(doc.lines.length)),
      !isInvoice && i.discrepancy
        ? el('cac:DiscrepancyResponse', null,
            i.billingReference ? el('cbc:ReferenceID', null, i.billingReference.id) : null,
            el('cbc:ResponseCode', null, i.discrepancy.code),
            el('cbc:Description', null, i.discrepancy.description)
          )
        : null,
      i.orderReference ? el('cac:OrderReference', null, el('cbc:ID', null, i.orderReference)) : null,
      !isInvoice && i.billingReference
        ? el('cac:BillingReference', null,
            el('cac:InvoiceDocumentReference', null,
              el('cbc:ID', null, i.billingReference.id),
              el('cbc:UUID', { schemeName: 'CUFE-SHA384' }, i.billingReference.uuid),
              el('cbc:IssueDate', null, i.billingReference.issueDate)
            )
          )
        : null,
      this.supplierParty(doc),
      this.customerParty(doc),
      payment
        ? el('cac:PaymentMeans', null,
            el('cbc:ID', null, payment.form),
            el('cbc:PaymentMeansCode', null, payment.meansCode),
            payment.form === '2' && payment.dueDate ? el('cbc:PaymentDueDate', null, payment.dueDate) : null
          )
        : null,
      // Si todo el documento es de bienes excluidos no hay IVA que reportar.
      t.taxSubtotals.length ? this.taxTotal(t.ivaCents, t.taxSubtotals) : null,
      monetary,
      ...doc.lines.map((l) =>
        el(lineName, null,
          el('cbc:ID', null, String(l.lineNumber)),
          el(qtyName, { unitCode: '94' }, formatQuantity(l.quantity)),
          el('cbc:LineExtensionAmount', COP, formatCents(l.netCents)),
          // UBL 2.1: en InvoiceLine va AllowanceCharge antes de TaxTotal; en CreditNoteLine/DebitNoteLine, al revés.
          // EXENTO: IVA a tarifa 0 con su base. EXCLUIDO: sin TaxTotal (no causa IVA).
          ...(isInvoice ? [this.lineDiscount(l), l.tax ? this.taxTotal(l.tax.taxCents, [l.tax]) : null]
                        : [l.tax ? this.taxTotal(l.tax.taxCents, [l.tax]) : null, this.lineDiscount(l)]),
          el('cac:Item', null,
            el('cbc:Description', null, l.input.description),
            el('cac:StandardItemIdentification', null,
              el('cbc:ID', { schemeID: '999', schemeName: 'Estándar de adopción del contribuyente' }, l.input.sku)
            )
          ),
          el('cac:Price', null,
            el('cbc:PriceAmount', COP, formatCents(l.unitPriceCents)),
            el('cbc:BaseQuantity', { unitCode: '94' }, formatQuantity(1))
          )
        )
      )
    )
    return linkParents(root)
  }

  private lineDiscount(l: DianInvoiceDocument['lines'][number]): XmlElement | null {
    return l.discountCents > 0
      ? el('cac:AllowanceCharge', null,
          el('cbc:ID', null, '1'),
          el('cbc:ChargeIndicator', null, 'false'),
          el('cbc:AllowanceChargeReason', null, 'Descuento'),
          el('cbc:MultiplierFactorNumeric', null, formatPercent(l.input.discountPercent)),
          el('cbc:Amount', COP, formatCents(l.discountCents)),
          el('cbc:BaseAmount', COP, formatCents(l.grossCents))
        )
      : null
  }

  /** Compatibilidad: árbol de la factura */
  buildInvoiceTree(doc: DianInvoiceDocument, opts: UblBuildOptions): XmlElement {
    return this.buildDocumentTree(doc, opts)
  }

  buildInvoiceXml(doc: DianInvoiceDocument, opts: UblBuildOptions): string {
    return serialize(this.buildDocumentTree(doc, opts), true)
  }

  // ----------------------------------------------------------------------------

  private dianExtensions(doc: DianInvoiceDocument, opts: UblBuildOptions): XmlElement {
    const i = doc.input
    const res = i.resolution
    return el('sts:DianExtensions', null,
      doc.kind === 'INVOICE' && res
        ? el('sts:InvoiceControl', null,
            el('sts:InvoiceAuthorization', null, res.resolutionNumber),
            el('sts:AuthorizationPeriod', null,
              el('cbc:StartDate', null, res.validFrom),
              el('cbc:EndDate', null, res.validTo)
            ),
            el('sts:AuthorizedInvoices', null,
              el('sts:Prefix', null, res.prefix),
              el('sts:From', null, String(res.rangeFrom)),
              el('sts:To', null, String(res.rangeTo))
            )
          )
        : null,
      el('sts:InvoiceSource', null,
        el('cbc:IdentificationCode', {
          listAgencyID: '6',
          listAgencyName: 'United Nations Economic Commission for Europe',
          listSchemeURI: 'urn:oasis:names:specification:ubl:codelist:gc:CountryIdentificationCode-2.1',
        }, 'CO')
      ),
      el('sts:SoftwareProvider', null,
        el('sts:ProviderID', { ...DIAN_AGENCY, schemeID: i.issuer.dv, schemeName: '31' }, i.issuer.nit),
        el('sts:SoftwareID', DIAN_AGENCY, i.softwareId)
      ),
      el('sts:SoftwareSecurityCode', DIAN_AGENCY, opts.softwareSecurityCode),
      el('sts:AuthorizationProvider', null,
        el('sts:AuthorizationProviderID', { ...DIAN_AGENCY, schemeID: DIAN_AUTHORIZATION_PROVIDER_DV, schemeName: '31' }, DIAN_AUTHORIZATION_PROVIDER_NIT)
      ),
      el('sts:QRCode', null, opts.qrCodeContent)
    )
  }

  private address(code: string, city: string, deptName: string, deptCode: string, line: string, postal?: string | null): XmlElement {
    return el('cac:Address', null,
      el('cbc:ID', null, code),
      el('cbc:CityName', null, city),
      postal ? el('cbc:PostalZone', null, postal) : null,
      el('cbc:CountrySubentity', null, deptName),
      el('cbc:CountrySubentityCode', null, deptCode),
      el('cac:AddressLine', null, el('cbc:Line', null, line)),
      el('cac:Country', null,
        el('cbc:IdentificationCode', null, 'CO'),
        el('cbc:Name', { languageID: 'es' }, 'Colombia')
      )
    )
  }

  private supplierParty(doc: DianInvoiceDocument): XmlElement {
    const s = doc.input.issuer
    const regimen = s.taxSchemeCode === '01' ? '48' : '49'
    const addr = () => this.address(s.municipalityCode, s.cityName, s.departmentName, s.departmentCode, s.address, s.postalCode)
    const nitAttrs = { ...DIAN_AGENCY, schemeID: s.dv, schemeName: '31' }
    return el('cac:AccountingSupplierParty', null,
      el('cbc:AdditionalAccountID', null, s.organizationType),
      el('cac:Party', null,
        el('cac:PartyName', null, el('cbc:Name', null, s.tradeName || s.legalName)),
        el('cac:PhysicalLocation', null, addr()),
        el('cac:PartyTaxScheme', null,
          el('cbc:RegistrationName', null, s.legalName),
          el('cbc:CompanyID', nitAttrs, s.nit),
          el('cbc:TaxLevelCode', { listName: regimen }, s.taxLevelCodes),
          el('cac:RegistrationAddress', null, ...addr().children),
          el('cac:TaxScheme', null,
            el('cbc:ID', null, s.taxSchemeCode),
            el('cbc:Name', null, s.taxSchemeCode === '01' ? 'IVA' : 'No aplica')
          )
        ),
        el('cac:PartyLegalEntity', null,
          el('cbc:RegistrationName', null, s.legalName),
          el('cbc:CompanyID', nitAttrs, s.nit),
          el('cac:CorporateRegistrationScheme', null, el('cbc:ID', null, doc.input.prefix))
        ),
        s.email || s.phone
          ? el('cac:Contact', null,
              s.phone ? el('cbc:Telephone', null, s.phone) : null,
              s.email ? el('cbc:ElectronicMail', null, s.email) : null
            )
          : null
      )
    )
  }

  private customerParty(doc: DianInvoiceDocument): XmlElement {
    const c = doc.input.customer
    const idCode = dianIdTypeCode(c.documentType)
    const idNumber = customerIdForFiscal(doc)
    const isFinalConsumer = idNumber === DIAN_FINAL_CONSUMER_DOC
    const isNit = idCode === '31'
    const taxScheme = (c.taxSchemeCode || (isNit ? '01' : 'ZZ')) as string
    const companyIdAttrs: Record<string, string> = { ...DIAN_AGENCY, schemeName: idCode }
    if (isNit && c.dv) companyIdAttrs.schemeID = c.dv
    const name = isFinalConsumer ? 'Consumidor final' : c.name

    const hasAddress = Boolean(c.municipalityCode && /^[0-9]{5}$/.test(c.municipalityCode) && c.address)
    const addr = () =>
      this.address(
        c.municipalityCode!,
        c.cityName || '',
        c.departmentName || '',
        c.municipalityCode!.slice(0, 2),
        c.address!,
        null
      )

    return el('cac:AccountingCustomerParty', null,
      el('cbc:AdditionalAccountID', null, c.isCompany ? '1' : '2'),
      el('cac:Party', null,
        !isNit ? el('cac:PartyIdentification', null, el('cbc:ID', { schemeName: idCode }, idNumber)) : null,
        el('cac:PartyName', null, el('cbc:Name', null, name)),
        hasAddress ? el('cac:PhysicalLocation', null, addr()) : null,
        el('cac:PartyTaxScheme', null,
          el('cbc:RegistrationName', null, name),
          el('cbc:CompanyID', companyIdAttrs, idNumber),
          el('cbc:TaxLevelCode', { listName: taxScheme === '01' ? '48' : '49' }, c.taxLevelCodes || 'R-99-PN'),
          hasAddress ? el('cac:RegistrationAddress', null, ...addr().children) : null,
          el('cac:TaxScheme', null,
            el('cbc:ID', null, taxScheme),
            el('cbc:Name', null, taxScheme === '01' ? 'IVA' : 'No aplica')
          )
        ),
        el('cac:PartyLegalEntity', null,
          el('cbc:RegistrationName', null, name),
          el('cbc:CompanyID', companyIdAttrs, idNumber)
        ),
        c.email ? el('cac:Contact', null, c.phone ? el('cbc:Telephone', null, c.phone) : null, el('cbc:ElectronicMail', null, c.email)) : null,
        !c.isCompany && !isFinalConsumer && (c.firstName || c.lastName)
          ? el('cac:Person', null,
              c.firstName ? el('cbc:FirstName', null, c.firstName) : null,
              c.lastName ? el('cbc:FamilyName', null, c.lastName) : null
            )
          : null
      )
    )
  }

  private taxTotal(taxCents: number, subtotals: Array<{ ratePercent: number; taxableCents: number; taxCents: number }>): XmlElement {
    return el('cac:TaxTotal', null,
      el('cbc:TaxAmount', COP, formatCents(taxCents)),
      el('cbc:RoundingAmount', COP, '0.00'),
      ...subtotals.map((s) =>
        el('cac:TaxSubtotal', null,
          el('cbc:TaxableAmount', COP, formatCents(s.taxableCents)),
          el('cbc:TaxAmount', COP, formatCents(s.taxCents)),
          el('cac:TaxCategory', null,
            el('cbc:Percent', null, formatPercent(s.ratePercent)),
            el('cac:TaxScheme', null, el('cbc:ID', null, '01'), el('cbc:Name', null, 'IVA'))
          )
        )
      )
    )
  }
}

export const dianUblBuilderService = new DianUblBuilderService()
