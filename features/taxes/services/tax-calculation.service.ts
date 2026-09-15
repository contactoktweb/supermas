/**
 * SUPER MÁS ERP/POS - Servicio Centralizado de Cálculo Tributario
 *
 * Estrategia única de cálculo y redondeo según lineamientos DIAN Colombia
 * utilizada de manera consistente en POS, Ventas, Compras, Facturación y Contabilidad.
 */

import {
  TaxConfig,
  TaxCalculationLineInput,
  TaxCalculationLineResult,
  TaxDocumentCalculationResult,
  TaxBreakdownItem,
} from '../types'

export class TaxCalculationService {
  /**
   * Redondeo financiero oficial para pesos colombianos (COP).
   * DIAN exige redondeo aritmético al peso entero más cercano (half-up).
   */
  roundMoney(value: number): number {
    if (isNaN(value)) return 0
    return Math.round(value)
  }

  /**
   * Redondeo de tasas o porcentajes (hasta 2 decimales).
   */
  roundRate(value: number): number {
    if (isNaN(value)) return 0
    return Math.round(value * 100) / 100
  }

  /**
   * Determina si una configuración tributaria está vigente en una fecha específica (formato YYYY-MM-DD o ISO).
   */
  isConfigValidOnDate(config: TaxConfig, dateStr?: string): boolean {
    if (config.status !== 'ACTIVE') return false

    const targetDate = dateStr ? new Date(dateStr) : new Date()
    const validFromDate = new Date(config.validFrom)

    if (targetDate < validFromDate) {
      return false
    }

    if (config.validUntil) {
      const validUntilDate = new Date(config.validUntil)
      // Ajustar fin del día para validUntil
      validUntilDate.setHours(23, 59, 59, 999)
      if (targetDate > validUntilDate) {
        return false
      }
    }

    return true
  }

  /**
   * Calcula el impuesto y totales de una sola línea o ítem de documento.
   * La base gravable se calcula restando cualquier descuento comercial antes de aplicar la tarifa.
   */
  calculateLineTax(
    input: TaxCalculationLineInput,
    taxConfig?: TaxConfig | null
  ): TaxCalculationLineResult {
    const qty = Math.max(0, input.quantity || 0)
    const unitPrice = Math.max(0, input.unitPrice || 0)
    const grossAmount = this.roundMoney(qty * unitPrice)

    // Cálculo de descuento
    let discountAmount = 0
    if (input.discountAmount !== undefined && input.discountAmount > 0) {
      discountAmount = this.roundMoney(Math.min(grossAmount, input.discountAmount))
    } else if (input.discountPercent !== undefined && input.discountPercent > 0) {
      const pct = Math.min(100, Math.max(0, input.discountPercent))
      discountAmount = this.roundMoney(grossAmount * (pct / 100))
    }

    const discountPercent =
      grossAmount > 0 ? this.roundRate((discountAmount / grossAmount) * 100) : 0

    // Base gravable
    const baseAmount = Math.max(0, grossAmount - discountAmount)

    // Tarifa aplicable
    const ratePercent =
      input.customRatePercent !== undefined
        ? this.roundRate(input.customRatePercent)
        : taxConfig
        ? taxConfig.ratePercent
        : 0

    // Valor del impuesto
    const taxAmount =
      ratePercent > 0 ? this.roundMoney(baseAmount * (ratePercent / 100)) : 0

    const totalAmount = baseAmount + taxAmount

    return {
      productId: input.productId,
      productName: input.productName,
      quantity: qty,
      unitPrice,
      grossAmount,
      discountPercent,
      discountAmount,
      baseAmount,
      ratePercent,
      taxAmount,
      totalAmount,
      taxCode: taxConfig?.code || (ratePercent === 19 ? 'IVA_19' : ratePercent === 5 ? 'IVA_5' : 'EXENTO'),
      taxType: taxConfig?.type || (ratePercent > 0 ? 'IVA' : 'EXCLUIDO'),
    }
  }

  /**
   * Calcula el documento completo a partir de múltiples líneas y genera el desglose tributario agrupado.
   */
  calculateDocumentTaxes(
    items: Array<TaxCalculationLineInput & { taxConfig?: TaxConfig | null }>
  ): TaxDocumentCalculationResult {
    const calculatedLines: TaxCalculationLineResult[] = []
    const breakdownMap = new Map<string, TaxBreakdownItem>()

    let grossTotal = 0
    let discountTotal = 0
    let baseTotal = 0
    let taxTotal = 0

    for (const item of items) {
      const lineResult = this.calculateLineTax(item, item.taxConfig)
      calculatedLines.push(lineResult)

      grossTotal += lineResult.grossAmount
      discountTotal += lineResult.discountAmount
      baseTotal += lineResult.baseAmount
      taxTotal += lineResult.taxAmount

      // Agrupación para desglose fiscal (DIAN)
      const groupKey = `${lineResult.taxCode}-${lineResult.ratePercent}`
      const existing = breakdownMap.get(groupKey)

      if (existing) {
        existing.base += lineResult.baseAmount
        existing.taxAmount += lineResult.taxAmount
      } else {
        breakdownMap.set(groupKey, {
          taxConfigId: item.taxConfig?.id || item.taxConfigId || `tax-${lineResult.ratePercent}`,
          taxCode: lineResult.taxCode,
          taxName: item.taxConfig?.name || `${lineResult.taxCode} (${lineResult.ratePercent}%)`,
          ratePercent: lineResult.ratePercent,
          base: lineResult.baseAmount,
          taxAmount: lineResult.taxAmount,
        })
      }
    }

    return {
      lines: calculatedLines,
      grossTotal: this.roundMoney(grossTotal),
      discountTotal: this.roundMoney(discountTotal),
      baseTotal: this.roundMoney(baseTotal),
      taxTotal: this.roundMoney(taxTotal),
      grandTotal: this.roundMoney(baseTotal + taxTotal),
      taxBreakdown: Array.from(breakdownMap.values()),
    }
  }

  /**
   * Formateador monetario oficial COP para Colombia.
   */
  formatCOP(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  /**
   * Formateador de tarifa porcentual.
   */
  formatTaxRate(rate: number): string {
    return `${this.roundRate(rate)}%`
  }
}

export const taxCalculationService = new TaxCalculationService()
