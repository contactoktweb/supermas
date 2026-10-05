/**
 * SUPER MÁS ERP/POS — Contrato del Servicio Criptográfico y Firma Digital DIAN
 *
 * Implementa los algoritmos SHA-384 oficiales (CUFE, CUDE, SoftwareSecurityCode, QR)
 * y la firma digital XAdES-BES conforme al Anexo Técnico 1.9 de la DIAN.
 */

import {
  CufeCalculationInput,
  CudeCalculationInput,
  SoftwareSecurityCodeInput,
} from '../../types/dian.types'

export interface SignXmlOptions {
  certificatePemOrP12: Buffer | string
  certificatePassword: string // Suministrado exclusivamente en runtime desde Secret Manager / .env
  policyId?: string // '1.3.6.1.4.1.25848.1.1'
}

export interface ICryptoSigner {
  /**
   * Calcula el CUFE oficial mediante SHA-384 sobre los 14 campos reglamentarios
   * Retorna cadena en minúsculas de 96 caracteres hexadecimales.
   */
  calculateCUFE(input: CufeCalculationInput): string

  /**
   * Calcula el CUDE oficial mediante SHA-384 para Notas Crédito y Débito
   * Retorna cadena en minúsculas de 96 caracteres hexadecimales.
   */
  calculateCUDE(input: CudeCalculationInput): string

  /**
   * Calcula el SoftwareSecurityCode mediante SHA-384: hash(SoftwareId + Pin + NumFac)
   */
  calculateSoftwareSecurityCode(input: SoftwareSecurityCodeInput): string

  /**
   * Genera el enlace y string del código QR reglamentario DIAN
   */
  generateQRCodeData(params: {
    documentNumber: string
    issueDate: string
    issueTime: string
    issuerNit: string
    customerDoc: string
    baseAmount: number
    taxAmount: number
    totalAmount: number
    cufeOrCude: string
    environmentUrl: string
  }): string

  /**
   * Aplica la firma digital XAdES-BES enveloped sobre el XML UBL 2.1
   */
  signXml(xmlUnsigned: string, options: SignXmlOptions): Promise<string>
}
