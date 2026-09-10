import { posRepository, POSRepository } from '../repositories/pos.repository'
import { posSalePayloadSchema } from '../schemas/pos.schema'
import {
  POSProduct,
  POSCustomer,
  POSCartItem,
  POSSalePayload,
  POSTicketReceipt,
  POSDailySaleSummary,
  POSUserContext,
} from '../types'
import { db } from '@/lib/supabase'

const DEFAULT_POS_USER: POSUserContext = {
  userId: 'usr-cajero-01',
  userName: 'Cajero Principal',
  userRole: 'Cajero Operativo',
  locationId: 'loc-001',
  locationName: 'Bodega Principal (CEDI)',
  cashRegisterNumber: 'CAJA-01',
  permissions: ['pos.access', 'pos.create_sale', 'pos.discount', 'pos.view_history'],
}

export class POSService {
  constructor(private repo: POSRepository = posRepository) {}

  /**
   * Helper para verificar permisos RBAC del POS
   */
  private checkPermission(context: POSUserContext, permission: string): void {
    if (!context.permissions.includes(permission) && !context.permissions.includes('*')) {
      throw new Error(
        `Acceso denegado: El cajero "${context.userName}" no cuenta con el permiso requerido [${permission}].`
      )
    }
  }

  /**
   * Obtiene productos seguros para el catálogo POS
   */
  async getProducts(
    locationId: string,
    query?: string,
    category?: string,
    user: POSUserContext = DEFAULT_POS_USER
  ): Promise<POSProduct[]> {
    this.checkPermission(user, 'pos.access')
    return this.repo.getProductsForLocation(locationId, query, category)
  }

  /**
   * Búsqueda rápida por código de barras o SKU
   */
  async scanBarcode(
    code: string,
    locationId: string,
    user: POSUserContext = DEFAULT_POS_USER
  ): Promise<POSProduct | null> {
    this.checkPermission(user, 'pos.access')
    return this.repo.findByBarcodeOrSku(code, locationId)
  }

  /**
   * Búsqueda rápida de clientes
   */
  async searchCustomers(
    query?: string,
    user: POSUserContext = DEFAULT_POS_USER
  ): Promise<POSCustomer[]> {
    this.checkPermission(user, 'pos.access')
    return this.repo.searchCustomers(query)
  }

  /**
   * Obtiene el cliente genérico institucional "Consumidor Final"
   */
  async getGenericCustomer(): Promise<POSCustomer> {
    return this.repo.getGenericCustomer()
  }

  /**
   * Resuelve el precio unitario según la lista del cliente (Normal / Mayorista / VIP)
   */
  resolveUnitPrice(product: POSProduct, customer: POSCustomer, quantity: number = 1): number {
    if (customer.priceList === 'WHOLESALE' && product.wholesalePrice) {
      return product.wholesalePrice
    }
    if (customer.priceList === 'VIP') {
      if (product.distributorPrice) return product.distributorPrice
      if (product.wholesalePrice) return product.wholesalePrice
    }
    return product.normalPrice || 0
  }

  /**
   * Valida disponibilidad de stock antes de agregar al carrito o procesar cobro
   */
  validateStockAvailability(
    product: POSProduct,
    requestedQuantity: number
  ): { allowed: boolean; availableStock: number; message?: string } {
    if (requestedQuantity <= 0) {
      return { allowed: false, availableStock: product.availableStock, message: 'Cantidad inválida.' }
    }
    if (product.availableStock < requestedQuantity) {
      return {
        allowed: false,
        availableStock: product.availableStock,
        message: 'Existencia insuficiente.',
      }
    }
    return { allowed: true, availableStock: product.availableStock }
  }

  /**
   * Calcula el cambio / vuelto y valida si el monto recibido es suficiente
   */
  calculateChange(
    totalAmount: number,
    amountPaid: number
  ): { isValid: boolean; change: number; difference: number } {
    const change = Math.max(0, amountPaid - totalAmount)
    const difference = Math.max(0, totalAmount - amountPaid)
    return {
      isValid: amountPaid >= totalAmount,
      change,
      difference,
    }
  }

  /**
   * Calcula los totales del carrito en tiempo real
   */
  calculateTotals(items: POSCartItem[]): {
    subtotal: number
    discountTotal: number
    taxTotal: number
    totalAmount: number
    totalUnits: number
  } {
    let subtotal = 0
    let discountTotal = 0
    let taxTotal = 0
    let totalAmount = 0
    let totalUnits = 0

    for (const item of items) {
      subtotal += item.subtotal
      discountTotal += item.discountAmount
      taxTotal += item.taxAmount
      totalAmount += item.total
      totalUnits += item.quantity
    }

    return {
      subtotal,
      discountTotal,
      taxTotal,
      totalAmount,
      totalUnits,
    }
  }

  /**
   * Procesa la venta POS, genera factura fiscal, ticket y descuenta inventario en Kardex
   */
  async processSale(
    payload: POSSalePayload,
    user: POSUserContext = DEFAULT_POS_USER
  ): Promise<POSTicketReceipt> {
    this.checkPermission(user, 'pos.create_sale')

    // 1. Validar esquema con Zod
    const validated = posSalePayloadSchema.parse(payload)

    // 2. Obtener cliente
    const customers = await this.repo.searchCustomers()
    let customer = customers.find((c) => c.id === validated.customerId)
    if (!customer) {
      customer = await this.repo.getGenericCustomer()
    }

    // 3. Obtener catálogo y existencias en la bodega
    const productsInLocation = await this.repo.getProductsForLocation(validated.locationId)

    const processedLines: Array<{
      productId: string
      productName: string
      sku: string
      barcode: string
      unitOfMeasure: string
      imageUrl: string
      quantity: number
      unitPrice: number
      unitCost: number
      discountPercent: number
      discountAmount: number
      taxRatePercent: number
      taxAmount: number
      subtotal: number
      total: number
      notes?: string
    }> = []

    for (const rawItem of validated.items) {
      const product = productsInLocation.find((p) => p.id === rawItem.productId)
      if (!product) {
        throw new Error(`El producto con ID "${rawItem.productId}" no está disponible en esta bodega.`)
      }

      // Validar stock disponible
      if (product.availableStock < rawItem.quantity) {
        throw new Error(
          `Existencia insuficiente para "${product.name}". Disponibles: ${product.availableStock} unidades, Solicitadas: ${rawItem.quantity} unidades.`
        )
      }

      // Validar descuento
      const discountPercent = Math.min(100, Math.max(0, rawItem.discountPercent || 0))
      if (discountPercent > 0) {
        if (!user.permissions.includes('pos.discount') && !user.permissions.includes('*')) {
          throw new Error(
            `El cajero "${user.userName}" no tiene autorización para otorgar descuentos en POS.`
          )
        }
      }

      // Precios e Impuestos
      const unitPrice = this.resolveUnitPrice(product, customer, rawItem.quantity)
      const grossSubtotal = rawItem.quantity * unitPrice
      const discountAmount = Math.round(grossSubtotal * (discountPercent / 100))
      const netSubtotal = grossSubtotal - discountAmount

      const taxRatePercent = product.isExempt ? 0 : product.vatRatePercent
      const taxAmount = Math.round(netSubtotal * (taxRatePercent / 100))
      const total = netSubtotal + taxAmount

      processedLines.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        barcode: product.barcode,
        unitOfMeasure: product.unitOfMeasure,
        imageUrl: product.imageUrl,
        quantity: rawItem.quantity,
        unitPrice,
        unitCost: Math.round(unitPrice * 0.7),
        discountPercent,
        discountAmount,
        taxRatePercent,
        taxAmount,
        subtotal: netSubtotal,
        total,
        notes: rawItem.discountReason,
      })
    }

    // 4. Totales generales
    let subtotal = 0
    let discountTotal = 0
    let taxTotal = 0
    let totalAmount = 0
    let totalUnits = 0

    for (const line of processedLines) {
      subtotal += line.subtotal
      discountTotal += line.discountAmount
      taxTotal += line.taxAmount
      totalAmount += line.total
      totalUnits += line.quantity
    }

    // 5. Validar monto entregado y calcular cambio
    let amountPaid = validated.amountPaid
    if (validated.paymentMethod === 'EFECTIVO' && amountPaid < totalAmount) {
      throw new Error(
        `El valor recibido ($${amountPaid.toLocaleString('es-CO')}) no cubre el total de la venta ($${totalAmount.toLocaleString('es-CO')}).`
      )
    }
    if (validated.paymentMethod !== 'EFECTIVO') {
      amountPaid = totalAmount // Tarjeta/Transferencia se cobra exacto
    }
    const changeAmount = Math.max(0, amountPaid - totalAmount)

    // 6. Generar números de comprobante
    const saleRandom = Math.floor(1000 + Math.random() * 9000)
    const saleNumber = `VTA-${new Date().getFullYear()}-${saleRandom}`
    const invoiceNumber = `POS-${new Date().getFullYear()}-${saleRandom}`
    const saleId = `sale-pos-${Date.now().toString().slice(-6)}`
    const now = new Date()

    // 7. Estructura de comprobante térmico / ticket
    const ticketReceipt: POSTicketReceipt = {
      saleId,
      saleNumber,
      invoiceNumber,
      date: now.toISOString(),
      time: now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      locationId: validated.locationId,
      locationName: user.locationName,
      cashierName: user.userName,
      customerName: customer.displayName,
      customerDoc: `${customer.documentType} ${customer.documentNumber}`,
      items: processedLines.map((l) => ({
        name: l.productName,
        sku: l.sku,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountAmount: l.discountAmount,
        total: l.total,
        taxRatePercent: l.taxRatePercent,
      })),
      itemsCount: processedLines.length,
      totalUnits,
      subtotal,
      discountTotal,
      taxTotal,
      totalAmount,
      paymentMethod: validated.paymentMethod,
      amountPaid,
      changeAmount,
      dianCufe: Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
    }

    // 8. Objeto Venta para la tabla general
    const saleRecord = {
      id: saleId,
      saleNumber,
      customerId: customer.id,
      customerName: customer.displayName,
      customerDoc: `${customer.documentType} ${customer.documentNumber}`,
      customerType: 'NATURAL',
      customerCategory: 'FINAL_CONSUMER',
      priceList: customer.priceList,
      locationId: validated.locationId,
      locationName: user.locationName,
      sellerId: user.userId,
      sellerName: user.userName,
      date: now.toISOString(),
      items: processedLines,
      itemsCount: processedLines.length,
      totalUnits,
      subtotal,
      discountTotal,
      taxTotal,
      totalAmount,
      totalCost: Math.round(totalAmount * 0.7),
      totalProfit: Math.round(totalAmount * 0.3),
      profitMarginPercent: 30,
      paymentMethod: validated.paymentMethod,
      paymentStatus: 'PAID',
      status: 'INVOICED',
      documentType: 'FACTURA_POS',
      invoiceNumber,
      notes: validated.notes || 'Venta directa en mostrador POS',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }

    // 9. Ejecutar transacción atómica en mock-db
    await this.repo.executePOSSale(ticketReceipt, saleRecord)

    return ticketReceipt
  }

  /**
   * Obtiene el listado de ventas del día del cajero
   */
  async getDailySales(
    cashierName: string,
    locationId: string,
    user: POSUserContext = DEFAULT_POS_USER
  ): Promise<POSDailySaleSummary[]> {
    this.checkPermission(user, 'pos.view_history')
    return this.repo.getDailySalesForUser(cashierName, locationId)
  }
}

export const posService = new POSService()
