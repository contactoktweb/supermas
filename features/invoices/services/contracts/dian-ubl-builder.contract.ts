/**
 * SUPER MÁS ERP/POS — Contrato del Constructor de Documentos UBL 2.1 DIAN
 *
 * Genera el XML conforme a las especificaciones OASIS UBL 2.1 y DIAN Anexo Técnico 1.9:
 * - Invoice (01)
 * - CreditNote (91)
 * - DebitNote (92)
 * - AttachedDocument (Contenedor electrónico con ApplicationResponse)
 */

import {
  FiscalPartyIdentification,
  FiscalDocumentLine,
  FiscalTotals,
  FiscalPaymentDetails,
  DianResolutionRecord,
  DianSoftwareConfiguration,
  DianCreditNoteReasonCode,
  DianDebitNoteReasonCode,
} from '../../types/dian.types'

export interface BuildInvoiceXmlInput {
  invoiceNumber: string
  issueDate: string // YYYY-MM-DD
  issueTime: string // HH:mm:ss-05:00
  cufe: string
  softwareSecurityCode: string
  qrCodeUrl: string
  issuer: FiscalPartyIdentification
  customer: FiscalPartyIdentification
  resolution: DianResolutionRecord
  softwareConfig: DianSoftwareConfiguration
  lines: FiscalDocumentLine[]
  totals: FiscalTotals
  paymentDetails: FiscalPaymentDetails
  notes?: string
}

export interface BuildCreditNoteXmlInput {
  creditNoteNumber: string
  issueDate: string
  issueTime: string
  cude: string
  softwareSecurityCode: string
  qrCodeUrl: string
  discrepancyReasonCode: DianCreditNoteReasonCode
  discrepancyDescription: string
  originalInvoice: {
    invoiceNumber: string
    cufe: string
    issueDate: string
  }
  issuer: FiscalPartyIdentification
  customer: FiscalPartyIdentification
  softwareConfig: DianSoftwareConfiguration
  lines: FiscalDocumentLine[]
  totals: FiscalTotals
  paymentDetails: FiscalPaymentDetails
  notes?: string
}

export interface BuildDebitNoteXmlInput {
  debitNoteNumber: string
  issueDate: string
  issueTime: string
  cude: string
  softwareSecurityCode: string
  qrCodeUrl: string
  discrepancyReasonCode: DianDebitNoteReasonCode
  discrepancyDescription: string
  originalInvoice: {
    invoiceNumber: string
    cufe: string
    issueDate: string
  }
  issuer: FiscalPartyIdentification
  customer: FiscalPartyIdentification
  softwareConfig: DianSoftwareConfiguration
  lines: FiscalDocumentLine[]
  totals: FiscalTotals
  paymentDetails: FiscalPaymentDetails
  notes?: string
}

export interface BuildAttachedDocumentInput {
  documentNumber: string
  issueDate: string
  issueTime: string
  senderNit: string
  receiverNit: string
  signedXml: string
  applicationResponseXml: string
}

export interface IUblBuilder {
  /**
   * Construye el XML UBL 2.1 para Factura Electrónica de Venta (Tipo 01)
   */
  buildInvoiceXml(input: BuildInvoiceXmlInput): string

  /**
   * Construye el XML UBL 2.1 para Nota Crédito Electrónica (Tipo 91)
   */
  buildCreditNoteXml(input: BuildCreditNoteXmlInput): string

  /**
   * Construye el XML UBL 2.1 para Nota Débito Electrónica (Tipo 92)
   */
  buildDebitNoteXml(input: BuildDebitNoteXmlInput): string

  /**
   * Construye el contenedor AttachedDocument XML con el XML firmado y el ApplicationResponse
   */
  buildAttachedDocumentXml(input: BuildAttachedDocumentInput): string
}
