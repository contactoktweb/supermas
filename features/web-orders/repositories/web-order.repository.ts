/**
 * SUPER MÁS ERP/POS - Repositorio de Pedidos Web
 *
 * Conecta con la capa de datos de Supabase (db.ts) accediendo a las tablas
 * simuladas web_orders, customers, products, stock_levels, locations, sales e invoices.
 */

import { db } from '@/lib/supabase/db'
import {
  WebOrder,
  WebOrderFilters,
  WebOrderPaginatedResult,
  WebOrderStats,
  InventoryCheckResult,
  StockAvailabilityLevel,
} from '../types'

class WebOrderRepository {
  private getStore(): WebOrder[] {
    return (db.webOrders as unknown as WebOrder[]) || []
  }

  /**
   * Obtiene la lista de pedidos web aplicando filtros, búsqueda, ordenamiento y paginación.
   */
  async findAll(filters: WebOrderFilters = {}): Promise<WebOrderPaginatedResult> {
    const list = this.getStore()
    let filtered = [...list]

    // 1. Filtro de búsqueda general (Search query)
    if (filters.search && filters.search.trim() !== '') {
      const q = filters.search.toLowerCase().trim()
      filtered = filtered.filter((ord) => {
        return (
          ord.orderNumber.toLowerCase().includes(q) ||
          ord.customerName.toLowerCase().includes(q) ||
          (ord.customerDoc && ord.customerDoc.toLowerCase().includes(q)) ||
          ord.customerEmail.toLowerCase().includes(q) ||
          ord.customerPhone.toLowerCase().includes(q) ||
          (ord.trackingNumber && ord.trackingNumber.toLowerCase().includes(q)) ||
          (ord.invoiceNumber && ord.invoiceNumber.toLowerCase().includes(q)) ||
          (ord.saleNumber && ord.saleNumber.toLowerCase().includes(q))
        )
      })
    }

    // 2. Filtro específico por número de pedido
    if (filters.orderNumber && filters.orderNumber.trim() !== '') {
      const num = filters.orderNumber.toLowerCase().trim()
      filtered = filtered.filter((ord) => ord.orderNumber.toLowerCase().includes(num))
    }

    // 3. Filtro por cliente
    if (filters.customer && filters.customer.trim() !== '') {
      const cust = filters.customer.toLowerCase().trim()
      filtered = filtered.filter(
        (ord) =>
          ord.customerName.toLowerCase().includes(cust) ||
          (ord.customerDoc && ord.customerDoc.toLowerCase().includes(cust))
      )
    }

    // 4. Filtro por estado
    if (filters.status && filters.status !== 'ALL') {
      filtered = filtered.filter((ord) => ord.status === filters.status)
    }

    // 5. Filtro por canal web
    if (filters.channel && filters.channel !== 'ALL') {
      filtered = filtered.filter((ord) => ord.channel === filters.channel)
    }

    // 6. Filtro por método de pago
    if (filters.paymentMethod && filters.paymentMethod !== 'ALL') {
      const pm = filters.paymentMethod.toLowerCase()
      filtered = filtered.filter((ord) => ord.paymentMethod.toLowerCase().includes(pm))
    }

    // 7. Filtro por bodega de salida asignada
    if (filters.locationId && filters.locationId !== 'ALL') {
      filtered = filtered.filter((ord) => ord.assignedLocationId === filters.locationId)
    }

    // 8. Filtro por facturación
    if (filters.invoiceStatus && filters.invoiceStatus !== 'ALL') {
      if (filters.invoiceStatus === 'INVOICED') {
        filtered = filtered.filter((ord) => !!ord.invoiceId)
      } else if (filters.invoiceStatus === 'PENDING') {
        filtered = filtered.filter((ord) => !ord.invoiceId && ord.status !== 'CANCELLED')
      }
    }

    // 9. Filtro por rango de fechas
    if (filters.dateFrom) {
      const fromTime = new Date(filters.dateFrom).getTime()
      filtered = filtered.filter((ord) => new Date(ord.createdAt).getTime() >= fromTime)
    }
    if (filters.dateTo) {
      const toTime = new Date(filters.dateTo).getTime() + 86400000 // Fin del día
      filtered = filtered.filter((ord) => new Date(ord.createdAt).getTime() <= toTime)
    }

    // 10. Ordenamiento
    const sortBy = filters.sortBy || 'date'
    const sortOrder = filters.sortOrder || 'desc'
    filtered.sort((a, b) => {
      let comparison = 0
      if (sortBy === 'date') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      } else if (sortBy === 'total') {
        comparison = a.totalAmount - b.totalAmount
      } else if (sortBy === 'orderNumber') {
        comparison = a.orderNumber.localeCompare(b.orderNumber)
      } else if (sortBy === 'status') {
        comparison = a.status.localeCompare(b.status)
      }
      return sortOrder === 'desc' ? -comparison : comparison
    })

    const total = filtered.length
    const page = filters.page || 1
    const pageSize = filters.pageSize || 10
    const start = (page - 1) * pageSize
    const paginated = filtered.slice(start, start + pageSize)

    return {
      orders: JSON.parse(JSON.stringify(paginated)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    }
  }

  /**
   * Obtiene un pedido web por su identificador único.
   */
  async findById(id: string): Promise<WebOrder | null> {
    const list = this.getStore()
    const found = list.find((ord) => ord.id === id)
    return found ? JSON.parse(JSON.stringify(found)) : null
  }

  /**
   * Obtiene un pedido web por su número de orden oficial.
   */
  async findByOrderNumber(orderNumber: string): Promise<WebOrder | null> {
    const list = this.getStore()
    const found = list.find((ord) => ord.orderNumber.toUpperCase() === orderNumber.toUpperCase())
    return found ? JSON.parse(JSON.stringify(found)) : null
  }

  /**
   * Actualiza el estado o propiedades de un pedido web en el almacén central.
   */
  async update(id: string, partial: Partial<WebOrder>): Promise<WebOrder> {
    const list = this.getStore()
    const index = list.findIndex((ord) => ord.id === id)
    if (index === -1) {
      throw new Error(`El pedido web con ID ${id} no fue encontrado.`)
    }

    const updated = {
      ...list[index],
      ...partial,
      items: partial.items ? partial.items : list[index].items,
      timeline: partial.timeline ? partial.timeline : list[index].timeline,
    }

    list[index] = updated
    return JSON.parse(JSON.stringify(updated))
  }

  /**
   * Calcula los indicadores globales de pedidos web para el dashboard.
   */
  async getStats(): Promise<WebOrderStats> {
    const list = this.getStore()

    let pendingCount = 0
    let confirmedCount = 0
    let preparingCount = 0
    let readyToDispatchCount = 0
    let shippedCount = 0
    let deliveredCount = 0
    let cancelledCount = 0
    let totalWebSalesAmount = 0
    let deliveredOrdersWithSales = 0

    list.forEach((ord) => {
      switch (ord.status) {
        case 'PENDING':
          pendingCount++
          break
        case 'CONFIRMED':
          confirmedCount++
          break
        case 'PREPARING':
          preparingCount++
          break
        case 'READY_TO_DISPATCH':
          readyToDispatchCount++
          break
        case 'SHIPPED':
          shippedCount++
          break
        case 'DELIVERED':
          deliveredCount++
          totalWebSalesAmount += ord.totalAmount
          deliveredOrdersWithSales++
          break
        case 'CANCELLED':
          cancelledCount++
          break
      }
    })

    const totalOrdersCount = list.length
    const averageTicket =
      deliveredOrdersWithSales > 0 ? Math.round(totalWebSalesAmount / deliveredOrdersWithSales) : 0

    return {
      pendingCount,
      confirmedCount,
      preparingCount,
      readyToDispatchCount,
      shippedCount,
      deliveredCount,
      cancelledCount,
      totalOrdersCount,
      totalWebSalesAmount,
      averageTicket,
    }
  }

  /**
   * Busca clientes existentes en la base de datos de clientes para evitar duplicaciones.
   */
  async findCustomer(query: { doc?: string; email?: string; phone?: string }): Promise<any | null> {
    const customers = (db.customers as any[]) || []
    return (
      customers.find((c) => {
        if (query.doc && c.documentNumber && c.documentNumber === query.doc) return true
        if (query.email && c.email && c.email.toLowerCase() === query.email.toLowerCase()) return true
        if (query.phone && c.phone && c.phone.replace(/\D/g, '') === query.phone.replace(/\D/g, ''))
          return true
        return false
      }) || null
    )
  }

  /**
   * Valida disponibilidad de inventario consultando stock_levels en todas las bodegas.
   * Regla de negocio estricta:
   * - Solo expone: AVAILABLE, LOW_STOCK, OUT_OF_STOCK
   * - Nunca expone cantidades exactas ni costos
   * - Verifica si la bodega procesadora de ecommerce (loc-001) tiene stock para despachar
   */
  async checkStockAvailability(
    items: { productId: string; quantity: number }[]
  ): Promise<InventoryCheckResult[]> {
    const stockLevels = (db.stockLevels as any[]) || []
    const locations = (db.locations as any[]) || []

    // Obtener ID de la bodega configurada para procesar ecommerce
    const ecommerceLocation =
      locations.find((l) => l.settings?.isEcommerceProcessingSource === true) || locations[0]
    const ecommerceLocId = ecommerceLocation?.id || 'loc-001'

    return items.map((item) => {
      // Stock en todas las bodegas para salud global
      const allLevels = stockLevels.filter((s) => s.productId === item.productId)
      const globalStock = allLevels.reduce((acc, curr) => acc + (curr.currentStock || 0), 0)

      // Stock específico en bodega ecommerce
      const ecommerceLevel = allLevels.find((s) => s.locationId === ecommerceLocId)
      const ecommerceStock = ecommerceLevel ? ecommerceLevel.currentStock || 0 : 0

      let availability: StockAvailabilityLevel = 'AVAILABLE'
      if (globalStock <= 0) {
        availability = 'OUT_OF_STOCK'
      } else if (globalStock < 50 || globalStock < item.quantity) {
        availability = 'LOW_STOCK'
      }

      const canFulfill = ecommerceStock >= item.quantity
      const isEcommerceWarehouseAvailable = ecommerceStock > 0

      const prodName = allLevels[0]?.productName || 'Producto'
      const prodSku = allLevels[0]?.sku || 'SKU'

      return {
        productId: item.productId,
        sku: prodSku,
        productName: prodName,
        requestedQuantity: item.quantity,
        availability,
        canFulfill,
        isEcommerceWarehouseAvailable,
        notes: canFulfill
          ? 'Stock suficiente en Bodega Ecommerce para despacho.'
          : isEcommerceWarehouseAvailable
          ? 'Stock parcial en Bodega Ecommerce. Requiere traslado o ajuste.'
          : 'Sin stock en Bodega Ecommerce asignada.',
      }
    })
  }

  /**
   * Genera el registro de Venta oficial para el pedido web en sales.json.
   * Crea el vínculo web_order_id <-> sale_id sin duplicar información.
   */
  async createSaleFromWebOrder(
    order: WebOrder,
    user: { id: string; name: string }
  ): Promise<{ saleId: string; saleNumber: string }> {
    const sales = (db.sales as any[]) || []

    // Si ya tiene una venta asociada, retornarla
    if (order.saleId) {
      const existing = sales.find((s) => s.id === order.saleId)
      if (existing) {
        return { saleId: existing.id, saleNumber: existing.saleNumber }
      }
    }

    const saleIndex = sales.length + 1
    const nextSeq = String(840 + saleIndex).padStart(6, '0')
    const saleNumber = `VTA-2026-${nextSeq}`
    const saleId = `sale-web-${order.id}`

    const newSale = {
      id: saleId,
      saleNumber,
      webOrderId: order.id,
      customerId: order.customerId,
      customerName: order.customerName,
      customerDoc: order.customerDoc || 'CONSUMIDOR FINAL',
      customerType: 'RETAIL',
      customerCategory: 'WEB_CUSTOMER',
      priceList: 'DEFAULT',
      locationId: order.assignedLocationId,
      locationName: order.assignedLocationName,
      sellerId: user.id,
      sellerName: user.name,
      date: new Date().toISOString(),
      items: order.items.map((it, idx) => ({
        id: `sitem-${order.id}-${idx + 1}`,
        productId: it.productId,
        productName: it.productName,
        sku: it.sku,
        barcode: it.barcode,
        unitOfMeasure: it.unitOfMeasure,
        imageUrl: it.imageUrl,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        unitCost: Math.round(it.unitPrice * 0.7), // Estimación estándar de costo
        discountPercent: it.discountPercent,
        discountAmount: it.discountAmount,
        taxRatePercent: it.taxRatePercent,
        taxAmount: it.taxAmount,
        subtotal: it.subtotal,
        total: it.total,
      })),
      itemsCount: order.itemsCount,
      totalUnits: order.totalUnits,
      subtotal: order.subtotal,
      discountTotal: order.discountTotal,
      taxTotal: order.taxTotal,
      shippingCost: order.shippingCost,
      totalAmount: order.totalAmount,
      totalCost: Math.round(order.subtotal * 0.7),
      totalProfit: Math.round(order.subtotal * 0.3),
      profitMarginPercent: 30.0,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus === 'PAID' ? 'PAID' : 'PENDING',
      status: 'COMPLETED',
      documentType: 'ORDEN_VENTA_WEB',
      notes: `Venta originada desde Pedido Web ${order.orderNumber} (${order.channel}).`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    sales.push(newSale)
    return { saleId, saleNumber }
  }

  /**
   * Genera la Factura Electrónica en invoices.json para el pedido y venta web.
   * Evita duplicados verificando si ya existe factura emitida.
   */
  async createInvoiceFromWebOrder(
    order: WebOrder,
    saleId: string,
    user: { id: string; name: string }
  ): Promise<{ invoiceId: string; invoiceNumber: string }> {
    const invoices = (db.invoices as any[]) || []

    // Si ya existe factura, retornarla
    if (order.invoiceId) {
      const existing = invoices.find((inv) => inv.id === order.invoiceId)
      if (existing) {
        return { invoiceId: existing.id, invoiceNumber: existing.invoiceNumber }
      }
    }

    const nextNumber = 480 + invoices.length + 1
    const invoiceNumber = `FAC-2026-${String(nextNumber).padStart(5, '0')}`
    const invoiceId = `inv-web-${order.id}`

    const newInvoice = {
      id: invoiceId,
      invoiceNumber,
      webOrderId: order.id,
      saleId,
      customerId: order.customerId,
      customerName: order.customerName,
      customerDoc: order.customerDoc || 'CONSUMIDOR FINAL',
      locationId: order.assignedLocationId,
      locationName: order.assignedLocationName,
      date: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      subtotal: order.subtotal,
      taxTotal: order.taxTotal,
      shippingCost: order.shippingCost,
      total: order.totalAmount,
      pendingBalance: order.paymentStatus === 'PAID' ? 0 : order.totalAmount,
      status: order.paymentStatus === 'PAID' ? 'PAID' : 'PAYMENT_PENDING',
      paymentMethod: order.paymentMethod,
      dianStatus: 'VALIDADA_DIAN',
      dianCufe: `cufe-${order.id}-${Date.now().toString(16)}`,
      itemsCount: order.itemsCount,
      createdBy: user.name,
      createdAt: new Date().toISOString(),
    }

    invoices.push(newInvoice)
    return { invoiceId, invoiceNumber }
  }
}

export const webOrderRepository = new WebOrderRepository()
