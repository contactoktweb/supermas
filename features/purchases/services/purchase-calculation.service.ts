import { CreatePurchaseItemInput, PurchaseItem } from '../types'

export interface TaxBreakdownItem {
  code: string
  name: string
  ratePercent: number
  baseAmount: number
  taxAmount: number
}

export interface PurchaseCalculatedTotals {
  subtotal: number
  discountTotal: number
  taxTotal: number
  total: number
  taxBreakdown: Record<string, TaxBreakdownItem>
}

export class PurchaseCalculationService {
  /**
   * Calcula los valores de una sola línea de compra.
   */
  calculateLineItem(input: CreatePurchaseItemInput, id?: string): PurchaseItem {
    const qty = Math.max(0, input.quantity)
    const unitCost = Math.max(0, input.unitCost)
    const discountPercent = Math.min(100, Math.max(0, input.discountPercent || 0))
    const taxRatePercent = Math.min(100, Math.max(0, input.taxRatePercent ?? 19))
    const taxCode = input.taxCode || 'IVA_19'

    // Subtotal bruto
    const subtotal = Math.round(qty * unitCost)

    // Descuento
    const discountAmount = Math.round(subtotal * (discountPercent / 100))

    // Base gravable después de descuento
    const taxableBase = subtotal - discountAmount

    // Impuesto liquidado
    const taxAmount = Math.round(taxableBase * (taxRatePercent / 100))

    // Total de la línea
    const total = taxableBase + taxAmount

    return {
      id: id || `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      productId: input.productId,
      productName: input.productName,
      sku: input.sku,
      barcode: input.barcode,
      unitOfMeasure: input.unitOfMeasure || 'UND',
      imageUrl: input.imageUrl,
      quantity: qty,
      receivedQuantity: 0,
      unitCost,
      discountPercent,
      discountAmount,
      taxRatePercent,
      taxCode,
      taxAmount,
      subtotal,
      total,
    }
  }

  /**
   * Calcula los totales consolidados de la compra a partir de sus líneas.
   */
  calculateTotals(items: PurchaseItem[]): PurchaseCalculatedTotals {
    let subtotal = 0
    let discountTotal = 0
    let taxTotal = 0
    let total = 0
    const taxBreakdown: Record<string, TaxBreakdownItem> = {}

    for (const item of items) {
      subtotal += item.subtotal
      discountTotal += item.discountAmount
      taxTotal += item.taxAmount
      total += item.total

      const code = item.taxCode || 'IVA_19'
      const base = item.subtotal - item.discountAmount
      if (!taxBreakdown[code]) {
        taxBreakdown[code] = {
          code,
          name: code === 'IVA_19' ? 'IVA 19%' : code === 'IVA_5' ? 'IVA 5%' : code,
          ratePercent: item.taxRatePercent,
          baseAmount: 0,
          taxAmount: 0,
        }
      }
      taxBreakdown[code].baseAmount += base
      taxBreakdown[code].taxAmount += item.taxAmount
    }

    return {
      subtotal,
      discountTotal,
      taxTotal,
      total,
      taxBreakdown,
    }
  }

  /**
   * Obtiene las configuraciones tributarias vigentes (Colombia)
   */
  getTaxConfigs() {
    return [
      { id: 'tax-19', name: 'IVA 19%', code: 'IVA_19', ratePercent: 19, description: 'Tarifa general de IVA', isDefault: true },
      { id: 'tax-5', name: 'IVA 5%', code: 'IVA_5', ratePercent: 5, description: 'Tarifa reducida bienes gravados', isDefault: false },
      { id: 'tax-0', name: 'Exento 0%', code: 'IVA_0', ratePercent: 0, description: 'Bienes exentos de IVA', isDefault: false },
    ]
  }
}

export const purchaseCalculationService = new PurchaseCalculationService()
