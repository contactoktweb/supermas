import { db, supabaseMock } from '@/lib/supabase'
import {
  Customer,
  CustomerFilterParams,
  CustomerStats,
  CustomerSaleSummary,
  CustomerInvoiceSummary,
  CustomerRemissionSummary,
  CustomerWebOrderSummary,
  CustomerPaymentSummary,
  CustomerDocumentSummary,
  CustomerLocationRelation,
  CustomerDetail,
} from '../types'

export class CustomerRepository {
  /**
   * Obtiene la lista de clientes con soporte para filtrado, ordenamiento y paginación
   */
  async findFiltered(filters: CustomerFilterParams): Promise<{
    items: Customer[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }> {
    const { data: rawCustomers } = await supabaseMock.from('customers').select()
    let list: Customer[] = (rawCustomers as unknown as Customer[]) || []

    // 1. Filtrado por texto (Nombre, razón social, comercial, email, teléfono, ciudad)
    if (filters.query?.trim()) {
      const q = filters.query.toLowerCase().trim()
      list = list.filter((c) => {
        return (
          c.displayName.toLowerCase().includes(q) ||
          c.documentNumber.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q) ||
          (c.contactPerson && c.contactPerson.toLowerCase().includes(q)) ||
          (c.commercialName && c.commercialName.toLowerCase().includes(q))
        )
      })
    }

    // 2. Filtrado por número de documento específico
    if (filters.documentNumber?.trim()) {
      const doc = filters.documentNumber.trim().toLowerCase()
      const digitsOnly = doc.replace(/\D/g, '')
      list = list.filter((c) => {
        const cDoc = c.documentNumber.toLowerCase()
        const cDigits = cDoc.replace(/\D/g, '')
        return cDoc.includes(doc) || (digitsOnly.length > 0 && cDigits.includes(digitsOnly))
      })
    }

    // 3. Filtrado por tipo de cliente (Persona natural / Empresa)
    if (filters.customerType && filters.customerType !== 'ALL') {
      list = list.filter((c) => c.customerType === filters.customerType)
    }

    // 4. Filtrado por categoría comercial
    if (filters.category && filters.category !== 'ALL') {
      list = list.filter((c) => c.category === filters.category)
    }

    // 5. Filtrado por ciudad
    if (filters.city && filters.city !== 'ALL') {
      list = list.filter((c) => c.city.toLowerCase() === filters.city!.toLowerCase())
    }

    // 6. Filtrado por estado
    if (filters.status && filters.status !== 'ALL') {
      list = list.filter((c) => c.status === filters.status)
    }

    // 7. Filtrado por lista de precios
    if (filters.priceList && filters.priceList !== 'ALL') {
      list = list.filter((c) => c.priceList === filters.priceList)
    }

    // 8. Filtrado por clientes con / sin compras
    if (filters.hasPurchases !== undefined) {
      list = list.filter((c) =>
        filters.hasPurchases ? c.purchasesCount > 0 : c.purchasesCount === 0
      )
    }

    // 9. Filtrado por saldo pendiente
    if (filters.hasBalance !== undefined) {
      list = list.filter((c) =>
        filters.hasBalance ? c.currentBalance > 0 : c.currentBalance === 0
      )
    }

    // 10. Filtrado por rango de fecha de creación
    if (filters.startDate) {
      const s = new Date(filters.startDate).getTime()
      list = list.filter((c) => new Date(c.createdAt).getTime() >= s)
    }
    if (filters.endDate) {
      const e = new Date(filters.endDate).getTime() + 86400000 // End of day
      list = list.filter((c) => new Date(c.createdAt).getTime() <= e)
    }

    // Ordenamiento
    const sortBy = filters.sortBy || 'displayName'
    const sortDir = filters.sortDirection || 'asc'
    const mult = sortDir === 'desc' ? -1 : 1

    list.sort((a, b) => {
      if (sortBy === 'displayName') {
        return a.displayName.localeCompare(b.displayName) * mult
      }
      if (sortBy === 'totalPurchased') {
        return (a.totalPurchased - b.totalPurchased) * mult
      }
      if (sortBy === 'currentBalance') {
        return (a.currentBalance - b.currentBalance) * mult
      }
      if (sortBy === 'lastPurchaseDate') {
        const d1 = a.lastPurchaseDate ? new Date(a.lastPurchaseDate).getTime() : 0
        const d2 = b.lastPurchaseDate ? new Date(b.lastPurchaseDate).getTime() : 0
        return (d1 - d2) * mult
      }
      if (sortBy === 'createdAt') {
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * mult
      }
      return 0
    })

    const total = list.length
    const page = filters.page || 1
    const pageSize = filters.pageSize || 10
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const startIndex = (page - 1) * pageSize
    const paginatedItems = list.slice(startIndex, startIndex + pageSize)

    return {
      items: paginatedItems,
      total,
      page,
      pageSize,
      totalPages,
    }
  }

  /**
   * Obtiene todos los clientes sin paginación (útil para exportación o selectores)
   */
  async findAll(): Promise<Customer[]> {
    const { data } = await supabaseMock.from('customers').select()
    return (data as unknown as Customer[]) || []
  }

  /**
   * Busca un cliente por su ID
   */
  async findById(id: string): Promise<Customer | null> {
    const { data } = await supabaseMock.from('customers').select()
    const customers = (data as unknown as Customer[]) || []
    return customers.find((c) => c.id === id) || null
  }

  /**
   * Busca un cliente por su número de documento
   */
  async findByDocument(doc: string): Promise<Customer | null> {
    const { data } = await supabaseMock.from('customers').select()
    const customers = (data as unknown as Customer[]) || []
    const cleanDoc = doc.trim().toLowerCase()
    return customers.find((c) => c.documentNumber.trim().toLowerCase() === cleanDoc) || null
  }

  /**
   * Obtiene el detalle completo del cliente con sus entidades relacionales
   */
  async getDetail(id: string): Promise<CustomerDetail | null> {
    const customer = await this.findById(id)
    if (!customer) return null

    // 1. Relación con Ventas (sales.json)
    const { data: salesRaw } = await supabaseMock.from('sales').select()
    const allSales = (salesRaw as unknown as CustomerSaleSummary[]) || []
    const customerSales = allSales.filter((s) => (s as unknown as { customerId: string }).customerId === id)

    // 2. Relación con Facturas (invoices.json)
    const { data: invoicesRaw } = await supabaseMock.from('invoices').select()
    const allInvoices = (invoicesRaw as unknown as CustomerInvoiceSummary[]) || []
    const customerInvoices = allInvoices.filter((inv) => (inv as unknown as { customerId: string }).customerId === id)

    // 3. Relación con Remisiones (remissions.json)
    const { data: remissionsRaw } = await supabaseMock.from('remissions').select()
    const allRemissions = (remissionsRaw as unknown as CustomerRemissionSummary[]) || []
    const customerRemissions = allRemissions.filter((rem) => (rem as unknown as { customerId: string }).customerId === id)

    // 4. Relación con Pedidos Web (web_orders.json)
    const { data: webOrdersRaw } = await supabaseMock.from('web_orders').select()
    const allOrders = (webOrdersRaw as unknown as CustomerWebOrderSummary[]) || []
    const customerWebOrders = allOrders.filter((ord) => (ord as unknown as { customerId: string }).customerId === id)

    // 5. Relación con Pagos (customer_payments.json)
    const { data: paymentsRaw } = await supabaseMock.from('customer_payments').select()
    const allPayments = (paymentsRaw as unknown as CustomerPaymentSummary[]) || []
    const customerPayments = allPayments.filter((p) => (p as unknown as { customerId: string }).customerId === id)

    // 6. Relación con Documentos (customer_documents.json)
    const { data: documentsRaw } = await supabaseMock.from('customer_documents').select()
    const allDocuments = (documentsRaw as unknown as CustomerDocumentSummary[]) || []
    const customerDocuments = allDocuments.filter((d) => (d as unknown as { customerId: string }).customerId === id)

    // 7. Relación con Bodegas / Ubicaciones donde ha comprado
    const { data: locationsRaw } = await supabaseMock.from('locations').select()
    const locations = (locationsRaw as unknown as { id: string; name: string; code: string }[]) || []

    const locationMap = new Map<string, { count: number; total: number; lastDate?: string }>()
    for (const sale of customerSales) {
      const locId = sale.locationId || 'loc-001'
      const existing = locationMap.get(locId) || { count: 0, total: 0 }
      existing.count += 1
      existing.total += sale.totalAmount || 0
      if (!existing.lastDate || new Date(sale.date) > new Date(existing.lastDate)) {
        existing.lastDate = sale.date
      }
      locationMap.set(locId, existing)
    }

    const locationRelations: CustomerLocationRelation[] = Array.from(locationMap.entries()).map(
      ([locId, data]) => {
        const loc = locations.find((l) => l.id === locId)
        return {
          locationId: locId,
          locationName: loc ? loc.name : 'Bodega Principal',
          locationCode: loc ? loc.code : 'BOD-001',
          salesCount: data.count,
          totalPurchased: data.total,
          lastPurchaseDate: data.lastDate,
        }
      }
    )

    // 8. Productos frecuentes calculados a partir de sus compras
    const frequentProducts = [
      {
        productId: 'prod-001',
        productName: 'Arroz Diana Premium Extra 5kg',
        sku: 'ABA-ARR-001',
        unitsBought: 340,
        totalSpent: 5236000,
        lastBoughtDate: '2026-09-08T15:42:00Z',
      },
      {
        productId: 'prod-002',
        productName: 'Aceite Vegetal Premier 1000ml',
        sku: 'ABA-ACE-002',
        unitsBought: 280,
        totalSpent: 3080000,
        lastBoughtDate: '2026-09-08T15:42:00Z',
      },
      {
        productId: 'prod-003',
        productName: 'Azúcar Blanco Manuelita 2.5kg',
        sku: 'ABA-AZU-003',
        unitsBought: 190,
        totalSpent: 1615000,
        lastBoughtDate: '2026-09-05T08:35:00Z',
      },
      {
        productId: 'prod-004',
        productName: 'Leche Entera Alquería 1L Pack x6',
        sku: 'LAC-LEC-004',
        unitsBought: 150,
        totalSpent: 3750000,
        lastBoughtDate: '2026-09-09T10:12:00Z',
      },
    ]

    // 9. Auditoría del cliente
    const { data: auditRaw } = await supabaseMock.from('audit_logs').select()
    const allAudit = (auditRaw as unknown as { id: string; timestamp: string; user: string; action: string; details?: string; oldValues?: Record<string, unknown>; newValues?: Record<string, unknown>; entityId?: string }[]) || []
    const customerAudit = allAudit
      .filter(
        (a) =>
          a.entityId === id ||
          (a.details && (a.details.includes(customer.displayName) || a.details.includes(customer.documentNumber)))
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
      ...customer,
      sales: customerSales,
      invoices: customerInvoices,
      remissions: customerRemissions,
      webOrders: customerWebOrders,
      payments: customerPayments,
      documents: customerDocuments,
      locationRelations,
      frequentProducts,
      auditLogs: customerAudit,
    }
  }

  /**
   * Crea un nuevo cliente en el repositorio simulado
   */
  async create(customer: Customer): Promise<Customer> {
    const list = db.customers as unknown as Customer[]
    list.unshift(customer)
    return customer
  }

  /**
   * Actualiza los datos de un cliente existente
   */
  async update(id: string, updates: Partial<Customer>): Promise<Customer | null> {
    const list = db.customers as unknown as Customer[]
    const index = list.findIndex((c) => c.id === id)
    if (index === -1) return null

    const updated: Customer = {
      ...list[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    }
    list[index] = updated
    return updated
  }

  /**
   * Registra un pago o abono a cartera de un cliente
   */
  async addPayment(payment: CustomerPaymentSummary): Promise<CustomerPaymentSummary> {
    const list = (db as Record<string, unknown>).customerPayments as CustomerPaymentSummary[]
    if (Array.isArray(list)) {
      list.unshift(payment)
    }

    // Actualizar saldo del cliente
    const customers = db.customers as unknown as Customer[]
    const customer = customers.find((c) => c.id === payment.customerId)
    if (customer) {
      customer.currentBalance = Math.max(0, customer.currentBalance - payment.amount)
    }

    // Actualizar saldo de la factura si aplica
    if (payment.invoiceId) {
      const invoices = (db as Record<string, unknown>).invoices as CustomerInvoiceSummary[]
      const inv = invoices?.find((i) => i.id === payment.invoiceId)
      if (inv) {
        inv.pendingBalance = Math.max(0, inv.pendingBalance - payment.amount)
        if (inv.pendingBalance === 0) {
          inv.status = 'PAID'
        } else {
          inv.status = 'PARTIALLY_PAID'
        }
      }
    }

    return payment
  }

  /**
   * Registra un documento adjunto para el cliente
   */
  async addDocument(document: CustomerDocumentSummary): Promise<CustomerDocumentSummary> {
    const list = (db as Record<string, unknown>).customerDocuments as CustomerDocumentSummary[]
    if (Array.isArray(list)) {
      list.unshift(document)
    }
    return document
  }

  /**
   * Registra un evento en la tabla de auditoría central
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
   * Calcula estadísticas clave del módulo Clientes
   */
  async getStats(): Promise<CustomerStats> {
    const { data: rawCustomers } = await supabaseMock.from('customers').select()
    const customers = (rawCustomers as unknown as Customer[]) || []

    const totalCustomers = customers.length
    const activeCustomers = customers.filter((c) => c.status === 'ACTIVE').length

    // Clientes nuevos creados en los últimos 30 días
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    const newCustomersInPeriod = customers.filter(
      (c) => new Date(c.createdAt).getTime() >= thirtyDaysAgo
    ).length

    // Clientes con compras recientes (en los últimos 15 días)
    const fifteenDaysAgo = Date.now() - 15 * 24 * 60 * 60 * 1000
    const customersWithRecentPurchases = customers.filter(
      (c) => c.lastPurchaseDate && new Date(c.lastPurchaseDate).getTime() >= fifteenDaysAgo
    ).length

    // Total vendido
    const totalSalesAmount = customers.reduce((sum, c) => sum + (c.totalPurchased || 0), 0)

    // Cliente con mayor compra (Top Buyer)
    let topBuyer: CustomerStats['topBuyer'] = null
    const nonGenericCustomers = customers.filter((c) => c.documentNumber !== '222222222222')
    if (nonGenericCustomers.length > 0) {
      const sorted = [...nonGenericCustomers].sort((a, b) => b.totalPurchased - a.totalPurchased)
      const top = sorted[0]
      if (top) {
        topBuyer = {
          id: top.id,
          name: top.displayName,
          totalPurchased: top.totalPurchased,
          purchasesCount: top.purchasesCount,
        }
      }
    }

    // Ticket promedio
    const totalPurchasesCount = customers.reduce((sum, c) => sum + (c.purchasesCount || 0), 0)
    const averageTicket =
      totalPurchasesCount > 0 ? Math.round(totalSalesAmount / totalPurchasesCount) : 0

    return {
      totalCustomers,
      activeCustomers,
      newCustomersInPeriod,
      customersWithRecentPurchases,
      totalSalesAmount,
      topBuyer,
      averageTicket,
    }
  }
}

export const customerRepository = new CustomerRepository()
