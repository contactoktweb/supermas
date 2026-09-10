import { db } from '@/lib/supabase'
import { SaleItem, CreateSaleItemDTO } from '../types'

export interface ProductSource {
  id: string
  name: string
  sku: string
  barcode?: string
  unitOfMeasure?: string
  imageUrl?: string
  normalPrice: number
  wholesalePrice?: number
  distributorPrice?: number
  averageCost?: number
  taxProfile?: string
  vatRatePercent?: number
  isExempt?: boolean
  prices?: Array<{
    code: string
    price: number
    name: string
    minQuantity?: number
  }>
}

export class SalesCalculationService {
  /**
   * Resuelve la tarifa de impuesto aplicable según tax_configs.json y el perfil del producto
   */
  resolveTaxRate(product: ProductSource, customTaxRate?: number): number {
    if (customTaxRate !== undefined) {
      return customTaxRate
    }

    if (product.isExempt || product.taxProfile === 'EXENTO' || product.taxProfile === 'EXCLUIDO') {
      return 0
    }

    if (product.vatRatePercent !== undefined) {
      return product.vatRatePercent
    }

    // Buscar en configuración de impuestos activa
    const defaultTax = db.taxConfigs?.find((t) => t.isDefault)
    return defaultTax ? defaultTax.ratePercent : 19
  }

  /**
   * Resuelve el precio unitario base según la lista de precios asignada al cliente
   */
  resolveUnitPrice(
    product: ProductSource,
    priceList: 'DEFAULT' | 'WHOLESALE' | 'VIP' = 'DEFAULT',
    quantity: number = 1
  ): number {
    if (priceList === 'WHOLESALE' && product.wholesalePrice) {
      return product.wholesalePrice
    }

    if (priceList === 'VIP') {
      if (product.distributorPrice) return product.distributorPrice
      if (product.wholesalePrice) return product.wholesalePrice
    }

    // Si tiene lista de precios por volumen interna
    if (product.prices && product.prices.length > 0) {
      const matchingVolume = product.prices
        .filter((p) => (p.minQuantity || 1) <= quantity)
        .sort((a, b) => (b.minQuantity || 1) - (a.minQuantity || 1))[0]

      if (matchingVolume && priceList !== 'DEFAULT') {
        return matchingVolume.price
      }
    }

    return product.normalPrice || 0
  }

  /**
   * Calcula con precisión una línea de venta
   */
  calculateLineItem(
    product: ProductSource,
    dto: CreateSaleItemDTO,
    priceList: 'DEFAULT' | 'WHOLESALE' | 'VIP' = 'DEFAULT'
  ): SaleItem {
    const quantity = Math.max(1, dto.quantity)
    const unitPrice = dto.unitPrice !== undefined && dto.unitPrice > 0
      ? dto.unitPrice
      : this.resolveUnitPrice(product, priceList, quantity)

    const discountPercent = Math.min(100, Math.max(0, dto.discountPercent || 0))
    const grossSubtotal = quantity * unitPrice
    const discountAmount = Math.round(grossSubtotal * (discountPercent / 100))
    const netSubtotal = grossSubtotal - discountAmount

    const taxRatePercent = this.resolveTaxRate(product, dto.taxRatePercent)
    const taxAmount = Math.round(netSubtotal * (taxRatePercent / 100))
    const total = netSubtotal + taxAmount

    const unitCost = product.averageCost || Math.round(unitPrice * 0.7)

    return {
      id: `sitem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      barcode: product.barcode || '',
      unitOfMeasure: product.unitOfMeasure || 'UND',
      imageUrl: product.imageUrl || '',
      quantity,
      unitPrice,
      unitCost,
      discountPercent,
      discountAmount,
      taxRatePercent,
      taxAmount,
      subtotal: netSubtotal,
      total,
      notes: dto.notes,
    }
  }

  /**
   * Calcula los totales consolidados de la venta
   */
  calculateSaleTotals(items: SaleItem[]): {
    itemsCount: number
    totalUnits: number
    subtotal: number
    discountTotal: number
    taxTotal: number
    totalAmount: number
    totalCost: number
    totalProfit: number
    profitMarginPercent: number
  } {
    let subtotal = 0
    let discountTotal = 0
    let taxTotal = 0
    let totalAmount = 0
    let totalCost = 0
    let totalUnits = 0

    for (const item of items) {
      subtotal += item.subtotal
      discountTotal += item.discountAmount
      taxTotal += item.taxAmount
      totalAmount += item.total
      totalCost += item.unitCost * item.quantity
      totalUnits += item.quantity
    }

    const totalProfit = totalAmount - totalCost
    const profitMarginPercent = totalAmount > 0
      ? Number(((totalProfit / totalAmount) * 100).toFixed(1))
      : 0

    return {
      itemsCount: items.length,
      totalUnits,
      subtotal,
      discountTotal,
      taxTotal,
      totalAmount,
      totalCost,
      totalProfit,
      profitMarginPercent,
    }
  }
}

export const salesCalculationService = new SalesCalculationService()
