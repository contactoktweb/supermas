import { posRepository, POSRepository } from '../repositories/pos.repository'
import { posSalePayloadSchema, POS_CARD_PAYMENTS_ENABLED } from '../schemas/pos.schema'
import {
  POSProduct,
  POSCustomer,
  POSCartItem,
  POSSalePayload,
  POSTicketReceipt,
  POSDailySaleSummary,
  POSUserContext,
  POSPaymentMethod,
  POSPaymentLine,
  POSBankAccountOption,
  POSOpenCashSession,
} from '../types'

const DEFAULT_POS_USER: POSUserContext = {
  userId: '',
  userName: 'Cajero Principal',
  userRole: 'Cajero Operativo',
  locationId: '',
  locationName: 'Punto de Venta',
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
  /** Caja abierta del cajero en la sede (la misma que usará el servidor al cobrar en efectivo). */
  async getOpenCashSession(locationId: string, userId: string): Promise<POSOpenCashSession | null> {
    if (!locationId || !userId) return null
    const session = await this.repo.getActiveSession(undefined, locationId, userId)
    if (!session) return null
    return {
      id: session.id,
      registerCode: session.cash_registers?.code ?? '',
      registerName: session.cash_registers?.name ?? '',
      openedAt: session.opening_time,
    }
  }

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
   * Arma los pagos que se registran con la venta. El valor del medio no efectivo va en null:
   * el servidor le asigna el saldo exacto del total que él mismo calcula (evita diferencias de centavos).
   */
  private buildPayments(validated: { paymentMethod: POSPaymentMethod; bankAccountId?: string; mixedCashAmount?: number; mixedRestMethod?: 'TARJETA' | 'TRANSFERENCIA' }, totalAmount: number): POSPaymentLine[] {
    const bankMethod = (m: 'TARJETA' | 'TRANSFERENCIA'): POSPaymentLine['method'] => (m === 'TARJETA' ? 'CREDIT_CARD' : 'BANK_TRANSFER')
    const usesCard = validated.paymentMethod === 'TARJETA' || (validated.paymentMethod === 'MIXTO' && validated.mixedRestMethod === 'TARJETA')
    if (usesCard && !POS_CARD_PAYMENTS_ENABLED) {
      throw new Error('El POS no recibe pagos con tarjeta por ahora. Use efectivo o transferencia.')
    }
    switch (validated.paymentMethod) {
      case 'EFECTIVO':
        return [{ method: 'CASH', amount: null }]
      case 'TARJETA':
      case 'TRANSFERENCIA':
        if (!validated.bankAccountId) {
          throw new Error('Seleccione la cuenta bancaria que recibe el pago (necesaria para la contabilidad).')
        }
        return [{ method: bankMethod(validated.paymentMethod), amount: null, bank_account_id: validated.bankAccountId }]
      case 'MIXTO': {
        const cash = Math.round(Number(validated.mixedCashAmount || 0))
        if (cash <= 0 || cash >= totalAmount) {
          throw new Error('En pago mixto, el efectivo debe ser mayor a cero y menor que el total.')
        }
        if (!validated.bankAccountId) {
          throw new Error('Seleccione la cuenta bancaria que recibe la parte no pagada en efectivo.')
        }
        return [
          { method: 'CASH', amount: cash },
          { method: bankMethod(validated.mixedRestMethod || 'TRANSFERENCIA'), amount: null, bank_account_id: validated.bankAccountId },
        ]
      }
      default:
        throw new Error('Medio de pago no soportado en POS.')
    }
  }

  /** Cuentas bancarias destino disponibles para el cajero (sin datos sensibles). */
  async listPaymentBankAccounts(): Promise<POSBankAccountOption[]> {
    return this.repo.listPaymentBankAccounts()
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

    // 5. Validar monto entregado, calcular cambio y armar los pagos con su cuenta destino
    let amountPaid = validated.amountPaid
    if (validated.paymentMethod === 'EFECTIVO' && amountPaid < totalAmount) {
      throw new Error(
        `El valor recibido ($${amountPaid.toLocaleString('es-CO')}) no cubre el total de la venta ($${totalAmount.toLocaleString('es-CO')}).`
      )
    }
    if (validated.paymentMethod !== 'EFECTIVO') {
      amountPaid = totalAmount // Tarjeta/Transferencia/Mixto se cobra exacto
    }
    const changeAmount = Math.max(0, amountPaid - totalAmount)
    const payments = this.buildPayments(validated, totalAmount)

    // 6. Venta + pagos + asiento en una transacción. El número de venta lo asigna el servidor; la clave
    //    de idempotencia (una por intento de cobro) evita duplicar la venta en reintentos o doble clic.
    const idempotencyKey = validated.idempotencyKey ?? crypto.randomUUID()
    const { saleId, saleNumber } = await this.repo.executePOSSale({
      locationId: validated.locationId,
      customerId: customer.id,
      sellerId: user.userId,
      notes: validated.notes,
      idempotencyKey,
      items: processedLines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountPercent: l.discountPercent,
        taxRatePercent: l.taxRatePercent,
      })),
      payments,
    })
    const invoiceNumber = `POS-${saleNumber.slice(-4)}`
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
    }

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
