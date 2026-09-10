import { db, supabaseMock } from '@/lib/supabase'
import {
  Invoice,
  InvoiceItem,
  InvoiceFilters,
  InvoiceStats,
  DIANTransmissionLog,
  DIANStatus,
} from '../types'

export class InvoiceRepository {
  /**
   * Obtiene lista de facturas con filtros dinámicos y paginación
   */
  async findAll(filters: InvoiceFilters = {}): Promise<{
    data: Invoice[]
    total: number
    page: number
    pageSize: number
  }> {
    const { data: rawInvoices } = await supabaseMock.from('invoices').select()
    const all = (rawInvoices as unknown as Array<any>) || []

    const q = filters.query ? filters.query.toLowerCase().trim() : ''

    const filtered = all.filter((inv) => {
      // 1. Tab / Type filter
      if (filters.tab) {
        if (filters.tab === 'Electrónicas' && inv.type !== 'ELECTRONICA') return false
        if (filters.tab === 'POS' && inv.type !== 'POS') return false
        if (filters.tab === 'Pendientes DIAN' && inv.dianStatus !== 'PENDIENTE') return false
        if (filters.tab === 'Aceptadas DIAN' && inv.dianStatus !== 'ACEPTADA' && inv.dianStatus !== 'VALIDADA_DIAN') return false
        if (filters.tab === 'Notas Crédito' && inv.type !== 'NOTA_CREDITO') return false
        if (filters.tab === 'Anuladas' && inv.status !== 'CANCELLED') return false
      }

      if (filters.type && filters.type !== 'ALL' && inv.type !== filters.type) {
        return false
      }

      // 2. Status filters
      if (filters.status && filters.status !== 'ALL' && inv.status !== filters.status) {
        return false
      }

      if (filters.dianStatus && filters.dianStatus !== 'ALL') {
        if (filters.dianStatus === 'ACEPTADA') {
          if (inv.dianStatus !== 'ACEPTADA' && inv.dianStatus !== 'VALIDADA_DIAN') return false
        } else if (inv.dianStatus !== filters.dianStatus) {
          return false
        }
      }

      // 3. Location filter
      if (filters.locationId && filters.locationId !== 'ALL' && inv.locationId !== filters.locationId) {
        return false
      }

      // 4. Date range filter
      if (filters.dateFrom) {
        const invDate = inv.date?.slice(0, 10)
        if (invDate && invDate < filters.dateFrom) return false
      }
      if (filters.dateTo) {
        const invDate = inv.date?.slice(0, 10)
        if (invDate && invDate > filters.dateTo) return false
      }

      // 5. Customer filter
      if (filters.customerId && inv.customerId !== filters.customerId) {
        return false
      }

      // 6. Text Query (Search by number, customer, doc, CUFE, saleNumber)
      if (q) {
        const matchNum = inv.invoiceNumber?.toLowerCase().includes(q)
        const matchCust = inv.customerName?.toLowerCase().includes(q)
        const matchDoc = inv.customerDoc?.toLowerCase().includes(q)
        const matchCufe = inv.dianCufe?.toLowerCase().includes(q)
        const matchSale = inv.saleNumber?.toLowerCase().includes(q) || inv.saleId?.toLowerCase().includes(q)
        if (!matchNum && !matchCust && !matchDoc && !matchCufe && !matchSale) return false
      }

      return true
    })

    // Sort newest first
    filtered.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime())

    const page = filters.page || 1
    const pageSize = filters.pageSize || 10
    const start = (page - 1) * pageSize
    const paginated = filtered.slice(start, start + pageSize)

    // Normalize invoice models
    const data: Invoice[] = paginated.map((inv) => this.mapToDomain(inv))

    return {
      data,
      total: filtered.length,
      page,
      pageSize,
    }
  }

  /**
   * Obtiene factura por ID
   */
  async findById(id: string): Promise<Invoice | null> {
    const { data: rawInvoices } = await supabaseMock.from('invoices').select()
    const all = (rawInvoices as unknown as Array<any>) || []
    const match = all.find((i) => i.id === id || i.invoiceNumber === id)
    return match ? this.mapToDomain(match) : null
  }

  /**
   * Obtiene factura por ID de Venta relacionada
   */
  async findBySaleId(saleId: string): Promise<Invoice | null> {
    const { data: rawInvoices } = await supabaseMock.from('invoices').select()
    const all = (rawInvoices as unknown as Array<any>) || []
    const match = all.find((i) => i.saleId === saleId)
    return match ? this.mapToDomain(match) : null
  }

  /**
   * Calcula estadísticas clave del módulo de facturación
   */
  async getStats(): Promise<InvoiceStats> {
    const { data: rawInvoices } = await supabaseMock.from('invoices').select()
    const all = (rawInvoices as unknown as Array<any>) || []

    let totalGenerated = 0
    let electronicSent = 0
    let pendingDIAN = 0
    let rejectedDIAN = 0
    let cancelledCount = 0
    let totalAmountBilled = 0
    let creditNotesCount = 0
    let creditNotesTotal = 0

    for (const inv of all) {
      if (inv.type === 'NOTA_CREDITO') {
        creditNotesCount++
        creditNotesTotal += inv.total || 0
        continue
      }

      totalGenerated++
      if (inv.status === 'CANCELLED') {
        cancelledCount++
        continue
      }

      totalAmountBilled += inv.total || 0

      if (inv.type === 'ELECTRONICA') {
        if (inv.dianStatus === 'ACEPTADA' || inv.dianStatus === 'VALIDADA_DIAN') {
          electronicSent++
        } else if (inv.dianStatus === 'PENDIENTE') {
          pendingDIAN++
        } else if (inv.dianStatus === 'RECHAZADA') {
          rejectedDIAN++
        }
      }
    }

    return {
      totalGenerated,
      electronicSent,
      pendingDIAN,
      rejectedDIAN,
      cancelledCount,
      totalAmountBilled,
      creditNotesCount,
      creditNotesTotal,
      currency: 'COP',
    }
  }

  /**
   * Inserta una nueva factura de forma transaccional y actualiza la venta origen
   */
  async create(invoice: Invoice, user: string = 'Administrador'): Promise<Invoice> {
    const invoices = (db.invoices as unknown) as Array<Record<string, unknown>>
    const sales = (db.sales as unknown) as Array<Record<string, unknown>>
    const auditLogs = (db.auditLogs as unknown) as Array<Record<string, unknown>>

    // 1. Insert in invoices
    invoices.unshift(invoice as unknown as Record<string, unknown>)

    // 2. Link in related sale if present
    if (invoice.saleId) {
      const sale = sales.find((s) => s.id === invoice.saleId)
      if (sale) {
        sale.invoiceId = invoice.id
        sale.invoiceNumber = invoice.invoiceNumber
        sale.status = 'COMPLETED'
      }
    }

    // 3. Register Audit Log
    auditLogs.unshift({
      id: `aud-inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      user,
      action: 'FACTURA_GENERADA',
      details: `Factura ${invoice.invoiceNumber} (${invoice.type}) generada para ${invoice.customerName} por valor de $${invoice.total.toLocaleString('es-CO')}. Estado DIAN: ${invoice.dianStatus}.`,
      entityId: invoice.id,
      entityType: 'INVOICE',
    })

    return invoice
  }

  /**
   * Crea una Nota Crédito afectando factura e inventario si aplica
   */
  async createCreditNote(
    creditNote: Invoice,
    originalInvoiceId: string,
    adjustInventory: boolean = true,
    user: string = 'Administrador'
  ): Promise<Invoice> {
    const invoices = (db.invoices as unknown) as Array<Record<string, unknown>>
    const movements = (db.inventoryMovements as unknown) as Array<Record<string, unknown>>
    const stockLevels = (db.stockLevels as unknown) as Array<any>
    const auditLogs = (db.auditLogs as unknown) as Array<Record<string, unknown>>

    // 1. Insert Credit Note
    invoices.unshift(creditNote as unknown as Record<string, unknown>)

    // 2. Update Original Invoice status if full credit note
    const original = invoices.find((i) => i.id === originalInvoiceId)
    if (original) {
      original.hasCreditNote = true
      original.creditNoteNumber = creditNote.invoiceNumber
    }

    // 3. Kardex Movement if adjusting inventory
    if (adjustInventory && creditNote.items.length > 0) {
      for (const item of creditNote.items) {
        const stockEntry = stockLevels.find(
          (s) => s.productId === item.productId && s.locationId === creditNote.locationId
        )
        const previousStock = stockEntry ? stockEntry.availableUnits : 50
        const resultingStock = previousStock + item.quantity

        if (stockEntry) {
          stockEntry.quantity = (stockEntry.quantity || 0) + item.quantity
          stockEntry.availableUnits = resultingStock
        }

        movements.unshift({
          id: `mov-nc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          movementNumber: `MOV-NC-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
          createdAt: creditNote.date,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          barcode: item.barcode || '',
          locationId: creditNote.locationId,
          locationName: creditNote.locationName,
          type: 'RETURN_IN',
          quantityIn: item.quantity,
          quantityOut: 0,
          quantityDelta: item.quantity,
          previousStock,
          resultingStock,
          unitCost: item.unitCost || Math.round(item.unitPrice * 0.7),
          totalValue: item.total,
          sourceDocumentType: 'CREDIT_NOTE',
          sourceDocumentId: creditNote.id,
          sourceDocumentNumber: creditNote.invoiceNumber,
          userName: user,
          notes: `Reingreso por Nota Crédito ${creditNote.invoiceNumber} a Factura ${original?.invoiceNumber || originalInvoiceId}`,
        })
      }
    }

    // 4. Audit Log
    auditLogs.unshift({
      id: `aud-nc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      user,
      action: 'NOTA_CREDITO_GENERADA',
      details: `Nota Crédito ${creditNote.invoiceNumber} aplicada a Factura ${original?.invoiceNumber || originalInvoiceId} por valor de $${creditNote.total.toLocaleString('es-CO')}. Ajuste inventario: ${adjustInventory ? 'SÍ' : 'NO'}.`,
      entityId: creditNote.id,
      entityType: 'CREDIT_NOTE',
    })

    return creditNote
  }

  /**
   * Anula una factura con registro de auditoría
   */
  async cancelInvoice(invoiceId: string, reason: string, user: string = 'Administrador'): Promise<Invoice> {
    const invoices = (db.invoices as unknown) as Array<Record<string, unknown>>
    const auditLogs = (db.auditLogs as unknown) as Array<Record<string, unknown>>

    const invoice = invoices.find((i) => i.id === invoiceId)
    if (!invoice) {
      throw new Error(`La factura con ID "${invoiceId}" no existe.`)
    }

    const prevStatus = invoice.status
    invoice.status = 'CANCELLED'
    invoice.cancelReason = reason
    invoice.cancelledAt = new Date().toISOString()
    invoice.cancelledBy = user
    if (invoice.dianStatus === 'PENDIENTE') {
      invoice.dianStatus = 'NO_APLICA'
    }

    auditLogs.unshift({
      id: `aud-can-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      user,
      action: 'FACTURA_ANULADA',
      details: `Factura ${invoice.invoiceNumber} anulada por ${user}. Motivo: ${reason}. Estado anterior: ${prevStatus}.`,
      entityId: invoice.id,
      entityType: 'INVOICE',
    })

    return this.mapToDomain(invoice)
  }

  /**
   * Registra intento o respuesta de transmisión ante la DIAN
   */
  async recordDIANAttempt(
    invoiceId: string,
    log: DIANTransmissionLog,
    newDianStatus: DIANStatus,
    cufe?: string
  ): Promise<Invoice> {
    const invoices = (db.invoices as unknown) as Array<Record<string, unknown>>
    const invoice = invoices.find((i) => i.id === invoiceId)
    if (!invoice) {
      throw new Error(`La factura con ID "${invoiceId}" no fue encontrada.`)
    }

    invoice.dianStatus = newDianStatus
    if (cufe) {
      invoice.dianCufe = cufe
    }
    const history = (invoice.transmissionHistory as DIANTransmissionLog[]) || []
    history.unshift(log)
    invoice.transmissionHistory = history
    invoice.updatedAt = new Date().toISOString()

    return this.mapToDomain(invoice)
  }

  /**
   * Obtiene ventas pendientes de facturar para el modal "Facturar Venta"
   */
  async getSalesPendingInvoicing(): Promise<any[]> {
    const { data: rawSales } = await supabaseMock.from('sales').select()
    const allSales = (rawSales as unknown as Array<any>) || []
    const { data: rawInvoices } = await supabaseMock.from('invoices').select()
    const allInvoices = (rawInvoices as unknown as Array<any>) || []

    const invoicedSaleIds = new Set(
      allInvoices.map((i) => i.saleId).filter(Boolean)
    )

    return allSales
      .filter((s) => s.status !== 'CANCELLED' && !invoicedSaleIds.has(s.id))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  /**
   * Mapea un registro raw al modelo de dominio Invoice
   */
  private mapToDomain(raw: any): Invoice {
    const subtotal = raw.subtotal || 0
    const taxTotal = raw.taxTotal || 0
    const total = raw.total || subtotal + taxTotal
    const items = (raw.items as InvoiceItem[]) || []

    let dianStatus: DIANStatus = raw.dianStatus || 'PENDIENTE'
    if (raw.dianStatus === 'VALIDADA_DIAN' || raw.dianStatus === 'ACEPTADA') {
      dianStatus = 'ACEPTADA'
    }

    return {
      id: raw.id,
      invoiceNumber: raw.invoiceNumber || `FAC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      prefix: raw.prefix || (raw.invoiceNumber?.startsWith('POS') ? 'POS' : raw.invoiceNumber?.startsWith('NC') ? 'NC' : 'FAC'),
      resolutionNumber: raw.resolutionNumber || '18764000001',
      resolutionDate: raw.resolutionDate || '2026-01-01',
      type: raw.type || (raw.invoiceNumber?.startsWith('POS') ? 'POS' : raw.invoiceNumber?.startsWith('NC') ? 'NOTA_CREDITO' : 'ELECTRONICA'),
      status: raw.status || 'PAID',
      dianStatus,
      dianCufe: raw.dianCufe,
      dianQrCode: raw.dianQrCode || `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${raw.dianCufe || ''}`,
      dianXmlUrl: raw.dianXmlUrl,
      dianPdfUrl: raw.dianPdfUrl,
      
      saleId: raw.saleId,
      saleNumber: raw.saleNumber,
      originalInvoiceId: raw.originalInvoiceId,
      originalInvoiceNumber: raw.originalInvoiceNumber,
      
      customerId: raw.customerId || 'cust-006',
      customerName: raw.customerName || 'Consumidor Final',
      customerDoc: raw.customerDoc || '222222222222',
      customerDocType: raw.customerDocType || (raw.customerDoc?.includes('NIT') ? 'NIT' : 'CC'),
      customerEmail: raw.customerEmail || 'facturacion@supermas.com.co',
      customerPhone: raw.customerPhone || '+57 300 000 0000',
      customerAddress: raw.customerAddress || 'Cra 15 # 45-20',
      customerCity: raw.customerCity || 'Bogotá, D.C.',
      
      locationId: raw.locationId || 'loc-001',
      locationName: raw.locationName || 'Bodega Principal (CEDI)',
      
      sellerId: raw.sellerId || 'usr-01',
      sellerName: raw.sellerName || 'Vendedor Principal',
      
      date: raw.date || new Date().toISOString(),
      dueDate: raw.dueDate || raw.date || new Date().toISOString(),
      issuedAtBogota: raw.issuedAtBogota || new Date(raw.date || Date.now()).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      
      items,
      itemsCount: items.length || raw.itemsCount || 1,
      totalUnits: raw.totalUnits || items.reduce((acc, i) => acc + (i.quantity || 1), 0) || 1,
      
      subtotal,
      discountTotal: raw.discountTotal || 0,
      taxTotal,
      taxesBreakdown: raw.taxesBreakdown || [
        {
          taxCode: 'IVA_19',
          taxName: 'IVA General 19%',
          ratePercent: 19,
          taxableBase: subtotal,
          taxAmount: taxTotal,
        },
      ],
      total,
      pendingBalance: raw.pendingBalance || 0,
      
      paymentMethod: raw.paymentMethod || 'EFECTIVO',
      paymentTerms: raw.paymentTerms || (raw.paymentMethod === 'CREDITO' ? 'Crédito 30 días' : 'Contado'),
      notes: raw.notes,
      cancelReason: raw.cancelReason,
      cancelledAt: raw.cancelledAt,
      cancelledBy: raw.cancelledBy,
      
      transmissionHistory: raw.transmissionHistory || [
        {
          id: `log-001`,
          timestamp: raw.date || new Date().toISOString(),
          user: 'Sistema Automático DIAN',
          action: 'ENVIO_INICIAL',
          status: 'EXITOSO',
          dianStatus,
          message: 'Documento recibido y validado por la DIAN con éxito.',
          cufe: raw.dianCufe,
        },
      ],
      createdAt: raw.createdAt || raw.date || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString(),
    }
  }
}

export const invoiceRepository = new InvoiceRepository()
