import { db, supabaseMock } from '@/lib/supabase'
import {
  Sale,
  SaleDetail,
  SaleFilterParams,
  SaleStats,
  SaleDocumentType,
} from '../types'

export class SalesRepository {
  /**
   * Obtiene la lista de ventas filtrada, ordenada y paginada
   */
  async findFiltered(filters: SaleFilterParams = {}): Promise<{
    items: Sale[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }> {
    const { data: rawSales } = await supabaseMock.from('sales').select()
    let list = (rawSales as unknown as Sale[]) || []

    // 1. Filtrado por texto (Búsqueda global)
    if (filters.query?.trim()) {
      const q = filters.query.toLowerCase().trim()
      list = list.filter((s) => {
        return (
          s.saleNumber.toLowerCase().includes(q) ||
          s.customerName.toLowerCase().includes(q) ||
          s.customerDoc.toLowerCase().includes(q) ||
          s.sellerName.toLowerCase().includes(q) ||
          s.locationName.toLowerCase().includes(q) ||
          (s.invoiceNumber && s.invoiceNumber.toLowerCase().includes(q)) ||
          (s.remissionNumber && s.remissionNumber.toLowerCase().includes(q))
        )
      })
    }

    // 2. Filtrado por cliente
    if (filters.customerId && filters.customerId !== 'ALL') {
      list = list.filter((s) => s.customerId === filters.customerId)
    }

    // 3. Filtrado por bodega / punto de venta
    if (filters.locationId && filters.locationId !== 'ALL') {
      list = list.filter((s) => s.locationId === filters.locationId)
    }

    // 4. Filtrado por vendedor
    if (filters.sellerName && filters.sellerName !== 'ALL') {
      list = list.filter(
        (s) => s.sellerName.toLowerCase() === filters.sellerName!.toLowerCase()
      )
    }

    // 5. Filtrado por estado de la venta
    if (filters.status && filters.status !== 'ALL') {
      list = list.filter((s) => s.status === filters.status)
    }

    // 6. Filtrado por método de pago
    if (filters.paymentMethod && filters.paymentMethod !== 'ALL') {
      list = list.filter((s) => s.paymentMethod === filters.paymentMethod)
    }

    // 7. Filtrado por tipo de documento generado
    if (filters.documentType && filters.documentType !== 'ALL') {
      list = list.filter((s) => s.documentType === filters.documentType)
    }

    // 8. Filtrado por rango de fecha
    if (filters.startDate) {
      const startMs = new Date(filters.startDate).getTime()
      list = list.filter((s) => new Date(s.date).getTime() >= startMs)
    }
    if (filters.endDate) {
      const endMs = new Date(filters.endDate).getTime() + 86400000 // Fin de día
      list = list.filter((s) => new Date(s.date).getTime() <= endMs)
    }

    const total = list.length

    // 9. Ordenamiento
    const sortBy = filters.sortBy || 'date'
    const sortDir = filters.sortDirection || 'desc'
    list.sort((a, b) => {
      let valA: any = a[sortBy]
      let valB: any = b[sortBy]

      if (sortBy === 'date') {
        valA = new Date(a.date).getTime()
        valB = new Date(b.date).getTime()
      } else if (typeof valA === 'string') {
        valA = valA.toLowerCase()
        valB = valB.toLowerCase()
      }

      if (valA < valB) return sortDir === 'asc' ? -1 : 1
      if (valA > valB) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    // 10. Paginación
    const page = Math.max(1, filters.page || 1)
    const pageSize = Math.max(1, filters.pageSize || 10)
    const totalPages = Math.ceil(total / pageSize) || 1
    const startIndex = (page - 1) * pageSize
    const paginated = list.slice(startIndex, startIndex + pageSize)

    return {
      items: paginated,
      total,
      page,
      pageSize,
      totalPages,
    }
  }

  /**
   * Obtiene todas las ventas
   */
  async findAll(): Promise<Sale[]> {
    const { data } = await supabaseMock.from('sales').select()
    return (data as unknown as Sale[]) || []
  }

  /**
   * Busca venta por ID
   */
  async findById(id: string): Promise<Sale | null> {
    const sales = await this.findAll()
    return sales.find((s) => s.id === id) || null
  }

  /**
   * Obtiene el detalle completo relacional de la venta
   */
  async getDetail(id: string): Promise<SaleDetail | null> {
    const sale = await this.findById(id)
    if (!sale) return null

    // 1. Información del cliente
    const { data: rawCustomers } = await supabaseMock.from('customers').select()
    const customers = (rawCustomers as unknown as Array<{
      id: string
      displayName: string
      documentNumber: string
      documentType: string
      phone: string
      email: string
      address: string
      city: string
      creditLimit: number
      currentBalance: number
    }>) || []
    const customer = customers.find((c) => c.id === sale.customerId)

    // 2. Factura relacionada
    const { data: rawInvoices } = await supabaseMock.from('invoices').select()
    const invoices = (rawInvoices as unknown as Array<{
      id: string
      invoiceNumber: string
      date: string
      dianStatus: string
      dianCufe?: string
      total: number
      status: string
      saleId?: string
    }>) || []
    const invoice = invoices.find(
      (inv) => inv.id === sale.invoiceId || inv.saleId === sale.id
    )

    // 3. Remisión relacionada
    const { data: rawRemissions } = await supabaseMock.from('remissions').select()
    const remissions = (rawRemissions as unknown as Array<{
      id: string
      remissionNumber: string
      date: string
      status: string
      driverName?: string
      deliveredBy?: string
      invoiceId?: string
    }>) || []
    const remission = remissions.find(
      (rem) => rem.id === sale.remissionId || (invoice && rem.invoiceId === invoice.id)
    )

    // 4. Movimientos de inventario generados
    const { data: rawMovements } = await supabaseMock.from('inventory_movements').select()
    const movements = (rawMovements as unknown as Array<{
      id: string
      movementNumber: string
      type: string
      productId: string
      productName: string
      sku: string
      quantityOut: number
      quantityIn: number
      createdAt: string
      sourceDocumentId?: string
      sourceDocumentNumber?: string
      notes?: string
    }>) || []
    const saleMovements = movements.filter(
      (m) =>
        m.sourceDocumentId === sale.id ||
        m.sourceDocumentNumber === sale.saleNumber ||
        m.notes?.includes(sale.saleNumber)
    )

    // 5. Auditoría de la venta
    const { data: rawAudit } = await supabaseMock.from('audit_logs').select()
    const allAudit = (rawAudit as unknown as Array<{
      id: string
      timestamp: string
      user: string
      action: string
      details?: string
      entityId?: string
      oldValues?: Record<string, unknown>
      newValues?: Record<string, unknown>
    }>) || []
    const saleAudit = allAudit
      .filter(
        (a) =>
          a.entityId === sale.id ||
          (a.details && (a.details.includes(sale.saleNumber) || a.details.includes(sale.id)))
      )
      .map((a) => ({
        id: a.id,
        timestamp: a.timestamp,
        user: a.user,
        action: a.action,
        details: a.details || '',
        oldValues: a.oldValues,
        newValues: a.newValues,
      }))

    return {
      ...sale,
      customer,
      invoice: invoice
        ? {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            date: invoice.date,
            dianStatus: invoice.dianStatus,
            dianCufe: invoice.dianCufe,
            total: invoice.total,
            status: invoice.status,
          }
        : undefined,
      remission: remission
        ? {
            id: remission.id,
            remissionNumber: remission.remissionNumber,
            date: remission.date,
            status: remission.status,
            driverName: remission.driverName,
            deliveredBy: remission.deliveredBy,
          }
        : undefined,
      inventoryMovements: saleMovements,
      auditLogs: saleAudit,
    }
  }

  /**
   * Crea una nueva venta en la base de datos
   */
  async create(sale: Sale): Promise<Sale> {
    const sales = (db.sales as unknown) as Sale[]
    sales.unshift(sale)
    return sale
  }

  /**
   * Actualiza una venta existente
   */
  async update(id: string, partial: Partial<Sale>): Promise<Sale | null> {
    const sales = (db.sales as unknown) as Sale[]
    const index = sales.findIndex((s) => s.id === id)
    if (index === -1) return null

    sales[index] = {
      ...sales[index],
      ...partial,
      updatedAt: new Date().toISOString(),
    }
    return sales[index]
  }

  /**
   * Registra los movimientos de salida de inventario (SALE_OUT) para Kardex
   */
  async createInventoryMovements(
    sale: Sale,
    user: { userId: string; userName: string }
  ): Promise<void> {
    const movements = (db.inventoryMovements as unknown) as Array<Record<string, unknown>>
    const stockLevels = (db.stockLevels as unknown) as Array<{
      productId: string
      locationId: string
      quantity: number
      availableUnits: number
    }>

    for (const item of sale.items) {
      const movementId = `mov-sale-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
      const movNumber = `MOV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`

      // Buscar stock previo
      const stockEntry = stockLevels.find(
        (s) => s.productId === item.productId && s.locationId === sale.locationId
      )
      const previousStock = stockEntry ? stockEntry.availableUnits : 100
      const resultingStock = Math.max(0, previousStock - item.quantity)

      // Actualizar stock level agregado
      if (stockEntry) {
        stockEntry.quantity = Math.max(0, stockEntry.quantity - item.quantity)
        stockEntry.availableUnits = resultingStock
      }

      // Insertar movimiento histórico en Kardex
      movements.unshift({
        id: movementId,
        movementNumber: movNumber,
        createdAt: new Date().toISOString(),
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        barcode: item.barcode,
        locationId: sale.locationId,
        locationName: sale.locationName,
        type: 'VENTA',
        quantityIn: 0,
        quantityOut: item.quantity,
        quantityDelta: -item.quantity,
        previousStock,
        resultingStock,
        unitCost: item.unitCost,
        totalValue: item.total,
        sourceDocumentType: 'SALE',
        sourceDocumentId: sale.id,
        sourceDocumentNumber: sale.saleNumber,
        userId: user.userId,
        userName: user.userName,
        notes: `Salida por venta comercial ${sale.saleNumber} - Cliente: ${sale.customerName}`,
      })
    }
  }

  /**
   * Reversión de inventario por anulación de venta (SALE_RETURN / RETURN_IN)
   */
  async reverseInventoryMovements(
    sale: Sale,
    reason: string,
    user: { userId: string; userName: string }
  ): Promise<void> {
    const movements = (db.inventoryMovements as unknown) as Array<Record<string, unknown>>
    const stockLevels = (db.stockLevels as unknown) as Array<{
      productId: string
      locationId: string
      quantity: number
      availableUnits: number
    }>

    for (const item of sale.items) {
      const movementId = `mov-ret-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
      const movNumber = `MOV-REV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`

      const stockEntry = stockLevels.find(
        (s) => s.productId === item.productId && s.locationId === sale.locationId
      )
      const previousStock = stockEntry ? stockEntry.availableUnits : 50
      const resultingStock = previousStock + item.quantity

      if (stockEntry) {
        stockEntry.quantity += item.quantity
        stockEntry.availableUnits = resultingStock
      }

      movements.unshift({
        id: movementId,
        movementNumber: movNumber,
        createdAt: new Date().toISOString(),
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        barcode: item.barcode,
        locationId: sale.locationId,
        locationName: sale.locationName,
        type: 'DEVOLUCION_VENTA',
        quantityIn: item.quantity,
        quantityOut: 0,
        quantityDelta: item.quantity,
        previousStock,
        resultingStock,
        unitCost: item.unitCost,
        totalValue: item.total,
        sourceDocumentType: 'SALE_RETURN',
        sourceDocumentId: sale.id,
        sourceDocumentNumber: sale.saleNumber,
        userId: user.userId,
        userName: user.userName,
        notes: `Reversión por anulación de venta ${sale.saleNumber}. Motivo: ${reason}`,
      })
    }
  }

  /**
   * Genera factura POS / Electrónica asociada a la venta
   */
  async generateInvoice(
    sale: Sale,
    type: 'FACTURA_ELECTRONICA' | 'FACTURA_POS',
    user: { userId: string; userName: string }
  ): Promise<{ invoiceId: string; invoiceNumber: string }> {
    const invoices = (db.invoices as unknown) as Array<Record<string, unknown>>
    const invoiceId = `inv-${Date.now().toString().slice(-6)}`
    const prefix = type === 'FACTURA_ELECTRONICA' ? 'FE' : 'POS'
    const invoiceNumber = `${prefix}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`

    invoices.unshift({
      id: invoiceId,
      invoiceNumber,
      customerId: sale.customerId,
      customerName: sale.customerName,
      customerDoc: sale.customerDoc,
      locationId: sale.locationId,
      locationName: sale.locationName,
      date: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      subtotal: sale.subtotal,
      taxTotal: sale.taxTotal,
      total: sale.totalAmount,
      pendingBalance: sale.paymentMethod === 'CREDITO' ? sale.totalAmount : 0,
      status: sale.paymentMethod === 'CREDITO' ? 'PAYMENT_PENDING' : 'PAID',
      paymentMethod: sale.paymentMethod,
      dianStatus: type === 'FACTURA_ELECTRONICA' ? 'VALIDADA_DIAN' : 'PENDIENTE',
      dianCufe:
        type === 'FACTURA_ELECTRONICA'
          ? Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
          : undefined,
      itemsCount: sale.itemsCount,
      saleId: sale.id,
    })

    await this.update(sale.id, {
      invoiceId,
      invoiceNumber,
      documentType: type,
      status: 'INVOICED',
    })

    return { invoiceId, invoiceNumber }
  }

  /**
   * Genera guía de remisión asociada a la venta
   */
  async generateRemission(
    sale: Sale,
    details: { deliveredBy?: string; driverName?: string; receivedBy?: string; notes?: string },
    user: { userId: string; userName: string }
  ): Promise<{ remissionId: string; remissionNumber: string }> {
    const remissions = (db.remissions as unknown) as Array<Record<string, unknown>>
    const remissionId = `rem-${Date.now().toString().slice(-6)}`
    const remissionNumber = `REM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`

    remissions.unshift({
      id: remissionId,
      remissionNumber,
      customerId: sale.customerId,
      customerName: sale.customerName,
      locationId: sale.locationId,
      locationName: sale.locationName,
      date: new Date().toISOString(),
      status: 'DELIVERED',
      itemsCount: sale.itemsCount,
      totalUnits: sale.totalUnits,
      invoiceId: sale.invoiceId,
      deliveredBy: details.deliveredBy || 'Despacho Propio Super Más',
      driverName: details.driverName || 'Conductor Asignado',
      receivedBy: details.receivedBy || `${sale.customerName} (Recibido Conforme)`,
      notes: details.notes || `Remisión generada por venta ${sale.saleNumber}`,
    })

    await this.update(sale.id, {
      remissionId,
      remissionNumber,
      documentType: sale.documentType === 'FACTURA_ELECTRONICA' ? 'FACTURA_ELECTRONICA' : 'REMISION',
    })

    return { remissionId, remissionNumber }
  }

  /**
   * Registra auditoría en audit_logs.json
   */
  async logAudit(entry: {
    user: string
    action: string
    details: string
    entityId: string
    oldValues?: Record<string, unknown>
    newValues?: Record<string, unknown>
  }): Promise<void> {
    const auditLogs = (db.auditLogs as unknown) as Array<{
      id: string
      timestamp: string
      user: string
      action: string
      details: string
      entityId?: string
      oldValues?: Record<string, unknown>
      newValues?: Record<string, unknown>
    }>
    auditLogs.unshift({
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      user: entry.user,
      action: entry.action,
      details: entry.details,
      entityId: entry.entityId,
      oldValues: entry.oldValues,
      newValues: entry.newValues,
    })
  }

  /**
   * Calcula estadísticas clave del módulo Ventas
   */
  async getStats(): Promise<SaleStats> {
    const sales = await this.findAll()

    const nonCancelledSales = sales.filter((s) => s.status !== 'CANCELLED')

    const periodTotalSales = nonCancelledSales.reduce(
      (sum, s) => sum + (s.totalAmount || 0),
      0
    )
    const periodSalesCount = nonCancelledSales.length
    const averageTicket =
      periodSalesCount > 0 ? Math.round(periodTotalSales / periodSalesCount) : 0

    const totalUnitsSold = nonCancelledSales.reduce(
      (sum, s) => sum + (s.totalUnits || 0),
      0
    )

    const uniqueCustomers = new Set(nonCancelledSales.map((s) => s.customerId))
    const uniqueCustomersServed = uniqueCustomers.size

    const pendingToInvoiceCount = sales.filter(
      (s) => (s.status === 'PENDING' || s.status === 'CONFIRMED') && !s.invoiceId
    ).length

    const cancelledSalesCount = sales.filter((s) => s.status === 'CANCELLED').length

    return {
      periodTotalSales,
      periodSalesCount,
      averageTicket,
      totalUnitsSold,
      uniqueCustomersServed,
      pendingToInvoiceCount,
      cancelledSalesCount,
    }
  }
}

export const salesRepository = new SalesRepository()
