/**
 * SUPER MÁS ERP/POS — CUFE, CUDE, SoftwareSecurityCode y QR (Anexo Técnico 1.9)
 *
 * - CUFE = SHA-384(NumFac + FecFac + HorFac + ValFac + CodImp1 + ValImp1 + CodImp2 + ValImp2
 *                  + CodImp3 + ValImp3 + ValTot + NitOFE + NumAdq + ClTec + TipoAmb)
 * - CUDE = igual, reemplazando la clave técnica por el PIN del software (notas crédito/débito).
 * - SoftwareSecurityCode = SHA-384(SoftwareID + PIN + NumFac)
 *
 * Todo se calcula desde el DianInvoiceDocument (los mismos valores que van en el XML).
 * Estrictamente servidor: usa node:crypto y secretos.
 */

import { createHash } from 'crypto'
import {
  CufeCalculationInput,
  CudeCalculationInput,
  SoftwareSecurityCodeInput,
} from '../../types/dian.types'
import { DianInvoiceDocument, formatCents, DIAN_FINAL_CONSUMER_DOC } from './dian-document'

const sha384 = (s: string) => createHash('sha384').update(s, 'utf8').digest('hex').toLowerCase()
const amount = (v: number) => Number(v || 0).toFixed(2)

export class DianCryptoService {
  /** Cadena de entrada del CUFE (expuesta para pruebas y trazabilidad; no contiene secretos si clTec se enmascara). */
  buildCufeInputString(input: CufeCalculationInput): string {
    return [
      input.numFac.trim(),
      input.fecFac.trim(),
      input.horFac.trim(),
      amount(input.valFac),
      input.codImp1.trim(),
      amount(input.valImp1),
      input.codImp2.trim(),
      amount(input.valImp2),
      input.codImp3.trim(),
      amount(input.valImp3),
      amount(input.valTot),
      input.nitOfe.trim(),
      input.numAdq.trim(),
      input.clTec.trim(),
      input.tipoAmbiente.trim(),
    ].join('')
  }

  calculateCUFE(input: CufeCalculationInput): string {
    return sha384(this.buildCufeInputString(input))
  }

  calculateCUDE(input: CudeCalculationInput): string {
    return sha384(
      [
        input.numDoc.trim(),
        input.fecDoc.trim(),
        input.horDoc.trim(),
        amount(input.valDoc),
        input.codImp1.trim(),
        amount(input.valImp1),
        input.codImp2.trim(),
        amount(input.valImp2),
        input.codImp3.trim(),
        amount(input.valImp3),
        amount(input.valTot),
        input.nitOfe.trim(),
        input.numAdq.trim(),
        input.pin.trim(),
        input.tipoAmbiente.trim(),
      ].join('')
    )
  }

  calculateSoftwareSecurityCode(input: SoftwareSecurityCodeInput): string {
    return sha384(`${input.softwareId.trim()}${input.pin.trim()}${input.documentNumber.trim()}`)
  }

  /** Parámetros del CUFE derivados del documento fiscal (misma fuente que el XML). */
  cufeInputFromDocument(doc: DianInvoiceDocument, technicalKey: string): CufeCalculationInput {
    const t = doc.totals
    return {
      numFac: doc.documentId,
      fecFac: doc.input.issueDate,
      horFac: doc.input.issueTime,
      valFac: Number(formatCents(t.lineExtensionCents)),
      codImp1: '01',
      valImp1: Number(formatCents(t.ivaCents)),
      codImp2: '04',
      valImp2: Number(formatCents(t.incCents)),
      codImp3: '03',
      valImp3: Number(formatCents(t.icaCents)),
      valTot: Number(formatCents(t.payableCents)),
      nitOfe: doc.input.issuer.nit,
      numAdq: customerIdForFiscal(doc),
      clTec: technicalKey,
      tipoAmbiente: doc.input.environmentCode,
    }
  }

  calculateDocumentCUFE(doc: DianInvoiceDocument, technicalKey: string): string {
    if (!technicalKey) throw new Error('No se puede calcular el CUFE: falta la clave técnica (DIAN_TEST_TECHNICAL_KEY).')
    return this.calculateCUFE(this.cufeInputFromDocument(doc, technicalKey))
  }

  /**
   * CUDE de nota crédito / débito: mismos campos y orden del CUFE (ValFac, impuestos y total de la nota),
   * pero en lugar de la clave técnica va el PIN del software.
   */
  calculateDocumentCUDE(doc: DianInvoiceDocument, softwarePin: string): string {
    if (doc.kind === 'INVOICE') throw new Error('El CUDE es para notas crédito/débito; la factura usa CUFE.')
    if (!softwarePin) throw new Error('No se puede calcular el CUDE: falta el PIN del software (DIAN_SOFTWARE_PIN).')
    const c = this.cufeInputFromDocument(doc, softwarePin)
    return this.calculateCUDE({
      numDoc: c.numFac,
      fecDoc: c.fecFac,
      horDoc: c.horFac,
      valDoc: c.valFac,
      codImp1: c.codImp1,
      valImp1: c.valImp1,
      codImp2: c.codImp2,
      valImp2: c.valImp2,
      codImp3: c.codImp3,
      valImp3: c.valImp3,
      valTot: c.valTot,
      nitOfe: c.nitOfe,
      numAdq: c.numAdq,
      pin: softwarePin,
      tipoAmbiente: c.tipoAmbiente,
    })
  }

  /** CUFE (factura) o CUDE (nota) según el tipo de documento. */
  calculateDocumentKey(doc: DianInvoiceDocument, secrets: { technicalKey?: string | null; pin?: string | null }): string {
    return doc.kind === 'INVOICE'
      ? this.calculateDocumentCUFE(doc, secrets.technicalKey || '')
      : this.calculateDocumentCUDE(doc, secrets.pin || '')
  }

  /** URL pública de consulta del documento en el catálogo DIAN del ambiente. */
  buildConsultUrl(qrBaseUrl: string, cufe: string): string {
    return `${qrBaseUrl}${cufe}`
  }

  /**
   * Contenido del código QR (sts:QRCode y representación gráfica), Anexo 1.9:
   * NumFac, FecFac, HorFac, NitFac, DocAdq, ValFac, ValIva, ValOtroIm, ValTolFac, CUFE y la URL de consulta.
   */
  buildQRCodeContent(doc: DianInvoiceDocument, cufe: string, qrBaseUrl: string): string {
    const t = doc.totals
    return [
      `NumFac=${doc.documentId}`,
      `FecFac=${doc.input.issueDate}`,
      `HorFac=${doc.input.issueTime}`,
      `NitFac=${doc.input.issuer.nit}`,
      `DocAdq=${customerIdForFiscal(doc)}`,
      `ValFac=${formatCents(t.lineExtensionCents)}`,
      `ValIva=${formatCents(t.ivaCents)}`,
      `ValOtroIm=${formatCents(t.incCents + t.icaCents)}`,
      `ValTolFac=${formatCents(t.payableCents)}`,
      `${doc.kind === 'INVOICE' ? 'CUFE' : 'CUDE'}=${cufe}`,
      `QRCode=${this.buildConsultUrl(qrBaseUrl, cufe)}`,
    ].join('\n')
  }
}

/** Número de identificación del adquiriente tal como va en el CUFE y el XML (solo dígitos salvo pasaporte). */
export function customerIdForFiscal(doc: DianInvoiceDocument): string {
  const c = doc.input.customer
  const raw = (c.documentNumber || '').trim()
  const isPassportLike = /PASAPORTE|^PA$|^PP$|DIE|EXTRANJERO/i.test(c.documentType || '')
  const cleaned = isPassportLike ? raw.replace(/[^0-9A-Za-z]/g, '') : raw.replace(/[^0-9]/g, '')
  return cleaned || DIAN_FINAL_CONSUMER_DOC
}

export const dianCryptoService = new DianCryptoService()
