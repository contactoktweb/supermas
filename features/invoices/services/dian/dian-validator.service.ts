/**
 * SUPER MÁS ERP/POS — VALIDADOR FISCAL DIAN (ANEXO TÉCNICO 1.9)
 *
 * Valida previamente la integridad de los datos, reglas de negocio tributarias,
 * vigencia de resoluciones y coherencia matemática antes de la emisión de comprobantes.
 */

import {
  IFiscalValidator,
  FiscalValidationResult,
} from '../contracts/dian-validator.contract'
import {
  FiscalPartyIdentification,
  FiscalDocumentLine,
  FiscalTotals,
  DianResolutionRecord,
} from '../../types/dian.types'

export class DianValidatorService implements IFiscalValidator {
  /**
   * Valida los datos fiscales del emisor y adquiriente según catálogo DIAN
   */
  validateParties(
    issuer: FiscalPartyIdentification,
    customer: FiscalPartyIdentification
  ): FiscalValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Validación de Emisor
    if (!issuer.documentNumber || issuer.documentNumber.trim().length < 6) {
      errors.push('El NIT del emisor es inválido o tiene menos de 6 dígitos.')
    }
    if (!issuer.legalName || issuer.legalName.trim().length === 0) {
      errors.push('La razón social del emisor es obligatoria.')
    }
    if (!issuer.cityCode || issuer.cityCode.trim().length !== 5) {
      warnings.push('El código DANE de ciudad del emisor debe tener 5 dígitos.')
    }

    // Validación de Adquiriente
    if (!customer.documentNumber || customer.documentNumber.trim().length === 0) {
      errors.push('El documento de identificación del cliente / adquiriente es obligatorio.')
    }
    if (!customer.legalName || customer.legalName.trim().length === 0) {
      errors.push('El nombre o razón social del cliente es obligatorio.')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Valida vigencia, rango y suficiencia de la resolución de numeración autorizada
   * Cumple con las 9 reglas de validación exigidas por la DIAN
   */
  validateResolution(
    resolution: DianResolutionRecord,
    consecutiveNumber: number
  ): FiscalValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // 1. Que exista una resolución activa
    if (!resolution.isActive) {
      errors.push(`La resolución DIAN número ${resolution.resolutionNumber} se encuentra inactiva.`)
    }

    // 2. Que esté vigente por fechas
    const today = new Date().toISOString().slice(0, 10)
    if (resolution.validFrom && today < resolution.validFrom) {
      errors.push(
        `La resolución DIAN ${resolution.resolutionNumber} aún no está vigente. Inicia el ${resolution.validFrom}.`
      )
    }
    if (resolution.validTo && today > resolution.validTo) {
      errors.push(
        `La resolución DIAN ${resolution.resolutionNumber} está vencida desde el ${resolution.validTo}.`
      )
    }

    // 3. Que el prefijo corresponda
    if (!resolution.dianPrefix || resolution.dianPrefix.trim().length === 0) {
      errors.push('La resolución no tiene un prefijo DIAN autorizado configurado.')
    }

    // 4. Que el número esté dentro del rango autorizado
    if (consecutiveNumber < resolution.initialRange) {
      errors.push(
        `El consecutivo ${consecutiveNumber} es inferior al rango inicial autorizado (${resolution.initialRange}).`
      )
    }

    // 5. Que no se haya agotado el rango
    if (consecutiveNumber > resolution.finalRange) {
      errors.push(
        `El rango de facturación autorizado (${resolution.initialRange} - ${resolution.finalRange}) se ha agotado. Consecutivo intentado: ${consecutiveNumber}.`
      )
    }

    // 6. Alerta de proximidad al límite del rango (advertencia)
    const remaining = resolution.finalRange - consecutiveNumber
    if (remaining >= 0 && remaining <= 50) {
      warnings.push(
        `Atención: Quedan únicamente ${remaining} consecutivos disponibles en la resolución ${resolution.resolutionNumber}.`
      )
    }

    // 7. Clave técnica obligatoria para facturación en ambiente de habilitación / producción
    if (!resolution.technicalKey || resolution.technicalKey.trim().length === 0) {
      warnings.push(
        'La clave técnica DIAN no está configurada en la resolución de facturación.'
      )
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Valida coherencia matemática entre líneas, bases gravables, tributos y totales a pagar
   */
  validateTotals(
    lines: FiscalDocumentLine[],
    totals: FiscalTotals
  ): FiscalValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!lines || lines.length === 0) {
      errors.push('El documento fiscal debe contener al menos un ítem o línea de detalle.')
      return { isValid: false, errors, warnings }
    }

    let calculatedLineExtension = 0
    let calculatedTaxTotal = 0

    for (const line of lines) {
      if (line.quantity <= 0) {
        errors.push(`La cantidad de la línea ${line.lineNumber} (${line.description}) debe ser mayor a 0.`)
      }
      if (line.unitPrice < 0) {
        errors.push(`El precio unitario de la línea ${line.lineNumber} no puede ser negativo.`)
      }
      calculatedLineExtension += line.taxableBase
      calculatedTaxTotal += line.totalTaxAmount
    }

    // Validar concordancia de totales (tolerancia de 1 peso por redondeos)
    const tolerance = 1.0
    if (Math.abs(calculatedLineExtension - totals.taxExclusiveAmount) > tolerance) {
      errors.push(
        `Incoherencia matemática en base imponible: Suma de líneas ($${calculatedLineExtension.toFixed(2)}) difiere del total reportado ($${totals.taxExclusiveAmount.toFixed(2)}).`
      )
    }

    const calculatedPayable = calculatedLineExtension + calculatedTaxTotal - totals.allowanceTotalAmount + totals.chargeTotalAmount
    if (Math.abs(calculatedPayable - totals.payableAmount) > tolerance) {
      errors.push(
        `Incoherencia matemática en total a pagar: Cálculo ($${calculatedPayable.toFixed(2)}) difiere del total reportado ($${totals.payableAmount.toFixed(2)}).`
      )
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

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
  }): FiscalValidationResult {
    const partiesResult = this.validateParties(params.issuer, params.customer)
    const resolutionResult = this.validateResolution(params.resolution, params.consecutiveNumber)
    const totalsResult = this.validateTotals(params.lines, params.totals)

    const errors = [
      ...partiesResult.errors,
      ...resolutionResult.errors,
      ...totalsResult.errors,
    ]

    const warnings = [
      ...partiesResult.warnings,
      ...resolutionResult.warnings,
      ...totalsResult.warnings,
    ]

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }
}

export const dianValidatorService = new DianValidatorService()
