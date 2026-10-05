/**
 * SUPER MÁS ERP/POS — Contrato del Validador Fiscal DIAN
 *
 * Valida previamente integridad fiscal, reglas tributarias, resolución y adquirente
 * antes de iniciar la generación del documento UBL 2.1 y la firma digital.
 */

import {
  FiscalPartyIdentification,
  FiscalDocumentLine,
  FiscalTotals,
  DianResolutionRecord,
} from '../../types/dian.types'

export interface FiscalValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface IFiscalValidator {
  /**
   * Valida los datos fiscales del emisor y adquiriente según catálogo DIAN
   */
  validateParties(
    issuer: FiscalPartyIdentification,
    customer: FiscalPartyIdentification
  ): FiscalValidationResult

  /**
   * Valida vigencia, rango y suficiencia de la resolución de numeración autorizada
   */
  validateResolution(
    resolution: DianResolutionRecord,
    consecutiveNumber: number
  ): FiscalValidationResult

  /**
   * Valida coherencia matemática entre líneas, bases gravables, tributos y totales a pagar
   */
  validateTotals(
    lines: FiscalDocumentLine[],
    totals: FiscalTotals
  ): FiscalValidationResult

  /**
   * Ejecuta la validación fiscal integral de un documento previo a la emisión
   */
  validateDocumentPreFlight(params: {
    issuer: FiscalPartyIdentification
    customer: FiscalPartyIdentification
    resolution: DianResolutionRecord
    consecutiveNumber: number
    lines: FiscalDocumentLine[]
    totals: FiscalTotals
  }): FiscalValidationResult
}
