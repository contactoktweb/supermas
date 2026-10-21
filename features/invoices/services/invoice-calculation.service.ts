import { InvoiceItem, InvoiceTaxSummary } from '../types'

export class InvoiceCalculationService {
  /**
   * Obtiene la tabla de configuración de impuestos de la DIAN
   */
  getTaxConfigs() {
    return [
      { id: 'tax-19', name: 'IVA General 19%', code: 'IVA_19', ratePercent: 19, isDefault: true },
      { id: 'tax-5', name: 'IVA Reducido 5%', code: 'IVA_5', ratePercent: 5 },
      { id: 'tax-0', name: 'IVA 0% (Tarifa Cero)', code: 'IVA_0', ratePercent: 0 },
      { id: 'tax-exento', name: 'Exento de IVA', code: 'EXENTO', ratePercent: 0 },
      { id: 'tax-excluido', name: 'Excluido de IVA', code: 'EXCLUIDO', ratePercent: 0 },
    ]
  }

  /**
   * Resuelve el porcentaje de IVA según el código o producto
   */
  resolveTaxRate(taxCodeOrPercent: string | number, isExempt: boolean = false): { code: string; ratePercent: number; name: string } {
    if (isExempt) {
      return { code: 'EXENTO', ratePercent: 0, name: 'Exento de IVA' }
    }

    const configs = this.getTaxConfigs()
    if (typeof taxCodeOrPercent === 'number') {
      const match = configs.find((t) => t.ratePercent === taxCodeOrPercent)
      if (match) {
        return { code: match.code, ratePercent: match.ratePercent, name: match.name }
      }
      return { code: `IVA_${taxCodeOrPercent}`, ratePercent: taxCodeOrPercent, name: `IVA ${taxCodeOrPercent}%` }
    }

    const matchCode = configs.find((t) => t.code.toUpperCase() === String(taxCodeOrPercent).toUpperCase())
    if (matchCode) {
      return { code: matchCode.code, ratePercent: matchCode.ratePercent, name: matchCode.name }
    }

    return { code: 'IVA_19', ratePercent: 19, name: 'IVA General 19%' }
  }

  /**
   * Calcula la liquidación completa de ítems, descuentos e impuestos discriminados
   */
  calculateInvoiceTotals(items: Array<{
    unitPrice: number
    quantity: number
    discountPercent?: number
    discountAmount?: number
    taxRatePercent?: number
    taxCode?: string
    isExempt?: boolean
  }>): {
    subtotal: number
    discountTotal: number
    taxTotal: number
    total: number
    totalUnits: number
    itemsCount: number
    taxesBreakdown: InvoiceTaxSummary[]
  } {
    let subtotal = 0
    let discountTotal = 0
    let taxTotal = 0
    let totalUnits = 0

    const taxBasesMap: Record<string, { name: string; ratePercent: number; base: number; taxAmount: number }> = {}

    for (const item of items) {
      const qty = Number(item.quantity) || 0
      const price = Number(item.unitPrice) || 0
      const gross = qty * price

      const discPercent = Math.min(100, Math.max(0, item.discountPercent || 0))
      const calculatedDisc = item.discountAmount !== undefined ? item.discountAmount : Math.round(gross * (discPercent / 100))
      const netBase = Math.max(0, gross - calculatedDisc)

      const taxInfo = this.resolveTaxRate(item.taxCode || item.taxRatePercent || 19, item.isExempt)
      const taxAmount = Math.round(netBase * (taxInfo.ratePercent / 100))

      subtotal += netBase
      discountTotal += calculatedDisc
      taxTotal += taxAmount
      totalUnits += qty

      if (!taxBasesMap[taxInfo.code]) {
        taxBasesMap[taxInfo.code] = {
          name: taxInfo.name,
          ratePercent: taxInfo.ratePercent,
          base: 0,
          taxAmount: 0,
        }
      }
      taxBasesMap[taxInfo.code].base += netBase
      taxBasesMap[taxInfo.code].taxAmount += taxAmount
    }

    const taxesBreakdown: InvoiceTaxSummary[] = Object.entries(taxBasesMap).map(([code, data]) => ({
      taxCode: code,
      taxName: data.name,
      ratePercent: data.ratePercent,
      taxableBase: data.base,
      taxAmount: data.taxAmount,
    }))

    const total = subtotal + taxTotal

    return {
      subtotal,
      discountTotal,
      taxTotal,
      total,
      totalUnits,
      itemsCount: items.length,
      taxesBreakdown,
    }
  }

  // CUFE y XML: se calculan SOLO en el servidor desde el documento fiscal real
  // (features/invoices/services/dian/dian-crypto.service.ts y dian-ubl-builder.service.ts).

}

export const invoiceCalculationService = new InvoiceCalculationService()
