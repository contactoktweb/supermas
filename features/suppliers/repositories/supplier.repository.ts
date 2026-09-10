import { db } from '@/lib/supabase'
import {
  Supplier,
  SupplierFilterParams,
  SupplierStats,
  SupplierProductSummary,
  SupplierInvoiceSummary,
  SupplierPaymentSummary,
  SupplierWarehouseRelation,
  SupplierDocumentItem,
} from '../types'

export class SupplierRepository {
  private get suppliers(): Supplier[] {
    return db.suppliers as unknown as Supplier[]
  }

  /**
   * Consulta proveedores con filtros dinámicos, ordenamiento y paginación.
   */
  async findAll(params: SupplierFilterParams): Promise<{
    items: Supplier[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }> {
    let result = [...this.suppliers]

    // 1. Búsqueda por texto (nombre, documento, contacto, email, ciudad)
    if (params.query && params.query.trim()) {
      const q = params.query.trim().toLowerCase()
      result = result.filter((s) => {
        const name = (s.businessName || s.supplierName || '').toLowerCase()
        const commercial = (s.commercialName || '').toLowerCase()
        const doc = (s.documentNumber || s.nit || '').toLowerCase()
        const contact = (s.contactName || '').toLowerCase()
        const email = (s.email || '').toLowerCase()
        const city = (s.city || '').toLowerCase()

        return (
          name.includes(q) ||
          commercial.includes(q) ||
          doc.includes(q) ||
          contact.includes(q) ||
          email.includes(q) ||
          city.includes(q)
        )
      })
    }

    // 2. Filtro por Documento / NIT específico
    if (params.documentNumber && params.documentNumber.trim()) {
      const docQ = params.documentNumber.trim().toLowerCase()
      result = result.filter((s) =>
        (s.documentNumber || s.nit || '').toLowerCase().includes(docQ)
      )
    }

    // 3. Filtro por Estado
    if (params.status && params.status !== 'ALL') {
      result = result.filter((s) => s.status === params.status)
    }

    // 4. Filtro por Bodega relacionada
    if (params.locationId && params.locationId !== 'ALL') {
      const purchases = db.purchases as unknown as { supplierId: string; destinationLocationId?: string; locationId?: string }[]
      const supplierIdsInLocation = new Set(
        purchases
          .filter((p) => p.destinationLocationId === params.locationId || p.locationId === params.locationId)
          .map((p) => p.supplierId)
      )
      result = result.filter((s) => s.locationId === params.locationId || supplierIdsInLocation.has(s.id) || supplierIdsInLocation.has(s.supplierId || ''))
    }

    // 5. Filtro por Saldo Pendiente
    if (params.hasPendingBalance !== undefined) {
      if (params.hasPendingBalance) {
        result = result.filter((s) => (s.currentBalance || 0) > 0)
      } else {
        result = result.filter((s) => (s.currentBalance || 0) <= 0)
      }
    }

    // 6. Filtro por rango de fecha de compra
    if (params.startDate) {
      result = result.filter((s) => {
        const date = s.lastPurchaseDate || s.createdAt
        return date >= params.startDate!
      })
    }
    if (params.endDate) {
      result = result.filter((s) => {
        const date = s.lastPurchaseDate || s.createdAt
        return date <= params.endDate!
      })
    }

    // 7. Ordenamiento
    const sortField = params.sortField || 'businessName'
    const sortDirection = params.sortDirection || 'asc'
    const multiplier = sortDirection === 'asc' ? 1 : -1

    result.sort((a, b) => {
      let valA: any = a[sortField as keyof Supplier] || ''
      let valB: any = b[sortField as keyof Supplier] || ''

      if (sortField === 'businessName') {
        valA = (a.businessName || a.supplierName || '').toLowerCase()
        valB = (b.businessName || b.supplierName || '').toLowerCase()
      } else if (sortField === 'currentBalance' || sortField === 'totalPurchased') {
        valA = Number(valA) || 0
        valB = Number(valB) || 0
      }

      if (valA < valB) return -1 * multiplier
      if (valA > valB) return 1 * multiplier
      return 0
    })

    // 8. Paginación
    const total = result.length
    const page = Math.max(1, params.page || 1)
    const pageSize = Math.max(1, params.pageSize || 10)
    const totalPages = Math.ceil(total / pageSize) || 1
    const startIndex = (page - 1) * pageSize
    const paginatedItems = result.slice(startIndex, startIndex + pageSize)

    return {
      items: paginatedItems,
      total,
      page,
      pageSize,
      totalPages,
    }
  }

  /**
   * Obtiene un proveedor por ID.
   */
  async findById(id: string): Promise<Supplier | null> {
    const supplier = this.suppliers.find(
      (s) => s.id === id || s.supplierId === id
    )
    return supplier || null
  }

  /**
   * Busca si un número de documento/NIT ya existe en el sistema.
   */
  async findByDocument(documentNumber: string, excludeId?: string): Promise<Supplier | null> {
    const cleanDoc = documentNumber.replace(/[.\-\s]/g, '').toLowerCase()
    const found = this.suppliers.find((s) => {
      if (excludeId && (s.id === excludeId || s.supplierId === excludeId)) return false
      const sDoc = (s.documentNumber || s.nit || '').replace(/[.\-\s]/g, '').toLowerCase()
      return sDoc === cleanDoc
    })
    return found || null
  }

  /**
   * Registra un nuevo proveedor en la capa de datos de Supabase.
   */
  async create(supplier: Supplier, user: { id: string; name: string }): Promise<Supplier> {
    ;(db.suppliers as unknown as Supplier[]).unshift(supplier)

    // Auditoría
    const auditEntry = {
      id: `aud-${Date.now()}`,
      action: 'SUPPLIER_CREATED',
      entity: 'SUPPLIER',
      entityId: supplier.id,
      userId: user.id,
      userName: user.name,
      timestamp: new Date().toISOString(),
      changes: {
        field: 'supplier',
        newValue: `${supplier.businessName} (NIT: ${supplier.documentNumber})`,
        details: `Proveedor creado con cupo de crédito $${supplier.creditLimit.toLocaleString('es-CO')} y ${supplier.creditDays} días de plazo.`,
      },
    }
    ;(db.auditLogs as unknown as any[]).unshift(auditEntry)

    return supplier
  }

  /**
   * Actualiza los datos de un proveedor existente.
   */
  async update(
    id: string,
    data: Partial<Supplier>,
    user: { id: string; name: string }
  ): Promise<Supplier> {
    const index = this.suppliers.findIndex(
      (s) => s.id === id || s.supplierId === id
    )
    if (index === -1) {
      throw new Error(`Proveedor no encontrado (ID: ${id})`)
    }

    const previous = this.suppliers[index]
    const updated: Supplier = {
      ...previous,
      ...data,
      supplierName: data.businessName || previous.businessName || previous.supplierName,
      nit: data.documentNumber || previous.documentNumber || previous.nit,
      updatedAt: new Date().toISOString(),
    }

    this.suppliers[index] = updated

    // Auditoría de campos importantes
    const auditEntry = {
      id: `aud-${Date.now()}`,
      action: 'SUPPLIER_UPDATED',
      entity: 'SUPPLIER',
      entityId: id,
      userId: user.id,
      userName: user.name,
      timestamp: new Date().toISOString(),
      changes: {
        field: 'supplier_data',
        previousValue: `${previous.businessName} (Estado: ${previous.status})`,
        newValue: `${updated.businessName} (Estado: ${updated.status})`,
        details: `Actualización de ficha de proveedor. Días crédito: ${updated.creditDays}, Cupo: $${updated.creditLimit.toLocaleString('es-CO')}.`,
      },
    }
    ;(db.auditLogs as unknown as any[]).unshift(auditEntry)

    return updated
  }

  /**
   * Desactiva un proveedor validando que no tenga obligaciones pendientes ni compras abiertas.
   */
  async deactivate(id: string, user: { id: string; name: string }): Promise<Supplier> {
    const supplier = await this.findById(id)
    if (!supplier) throw new Error(`Proveedor no encontrado (ID: ${id})`)

    // Regla de negocio: Comprobar saldo pendiente
    if ((supplier.currentBalance || 0) > 0) {
      throw new Error(
        `No es posible desactivar al proveedor "${supplier.businessName}" porque posee un saldo pendiente de $${supplier.currentBalance.toLocaleString('es-CO')}. Debe liquidar las cuentas por pagar primero.`
      )
    }

    // Regla de negocio: Comprobar compras pendientes de recepción
    const purchases = db.purchases as unknown as { supplierId: string; status: string; purchaseNumber: string }[]
    const openPurchase = purchases.find(
      (p) =>
        (p.supplierId === id || p.supplierId === supplier.supplierId) &&
        (p.status === 'PENDING_RECEPTION' || p.status === 'DRAFT')
    )
    if (openPurchase) {
      throw new Error(
        `No es posible desactivar al proveedor porque tiene la orden de compra ${openPurchase.purchaseNumber} en proceso (Estado: ${openPurchase.status}).`
      )
    }

    return this.update(id, { status: 'INACTIVE' }, user)
  }

  /**
   * Reactiva un proveedor inactivo.
   */
  async activate(id: string, user: { id: string; name: string }): Promise<Supplier> {
    return this.update(id, { status: 'ACTIVE' }, user)
  }

  /**
   * Obtiene la relación de productos suministrados por el proveedor:
   * Supplier -> PurchaseLine -> Product
   */
  async getSupplierProducts(supplierId: string): Promise<SupplierProductSummary[]> {
    const purchases = db.purchases as unknown as {
      supplierId: string
      purchaseNumber: string
      date: string
      items: {
        productId: string
        productName: string
        sku: string
        unitOfMeasure: string
        imageUrl?: string
        unitCost: number
        quantity: number
        total: number
      }[]
    }[]

    const supplierPurchases = purchases.filter(
      (p) => p.supplierId === supplierId
    )

    // Agrupar productos únicos y calcular métricas acumuladas
    const productMap = new Map<string, SupplierProductSummary>()

    for (const purchase of supplierPurchases) {
      if (!purchase.items) continue
      for (const item of purchase.items) {
        const existing = productMap.get(item.productId)
        if (!existing) {
          productMap.set(item.productId, {
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            category: 'Abarrotes y Despensa',
            unitOfMeasure: item.unitOfMeasure,
            imageUrl: item.imageUrl,
            lastUnitCost: item.unitCost,
            lastPurchaseDoc: purchase.purchaseNumber,
            lastPurchaseDate: purchase.date,
            totalUnitsSupplied: item.quantity,
            totalValueSupplied: item.total,
          })
        } else {
          existing.totalUnitsSupplied += item.quantity
          existing.totalValueSupplied += item.total
          // Si esta compra es más reciente, actualizar último costo y fecha
          if (purchase.date > existing.lastPurchaseDate) {
            existing.lastUnitCost = item.unitCost
            existing.lastPurchaseDoc = purchase.purchaseNumber
            existing.lastPurchaseDate = purchase.date
          }
        }
      }
    }

    return Array.from(productMap.values())
  }

  /**
   * Obtiene las facturas y obligaciones asociadas al proveedor.
   */
  async getSupplierInvoices(supplierId: string): Promise<SupplierInvoiceSummary[]> {
    const purchases = db.purchases as unknown as any[]
    const supplierPurchases = purchases.filter(
      (p) => p.supplierId === supplierId
    )

    const now = new Date().toISOString().split('T')[0]

    return supplierPurchases.map((p) => {
      let status: 'PENDIENTE' | 'PAGADA' | 'VENCIDA' = 'PENDIENTE'
      if (p.pendingBalance <= 0 || p.status === 'PAID') {
        status = 'PAGADA'
      } else if (p.dueDate && p.dueDate < now) {
        status = 'VENCIDA'
      }

      const hasAtt = Boolean(p.attachments && p.attachments.length > 0)
      const firstAtt = hasAtt ? p.attachments[0] : undefined

      return {
        purchaseId: p.id,
        purchaseNumber: p.purchaseNumber,
        invoiceNumber: p.supplierInvoiceNumber || p.purchaseNumber,
        date: p.date,
        dueDate: p.dueDate,
        total: p.total,
        paidAmount: p.paidAmount || 0,
        pendingBalance: p.pendingBalance || 0,
        status,
        hasAttachment: hasAtt,
        attachmentUrl: firstAtt?.url,
        attachmentName: firstAtt?.fileName,
      }
    })
  }

  /**
   * Obtiene los pagos realizados al proveedor.
   */
  async getSupplierPayments(supplierId: string): Promise<SupplierPaymentSummary[]> {
    const purchases = db.purchases as unknown as any[]
    const supplierPurchases = purchases.filter(
      (p) => p.supplierId === supplierId
    )

    const payments: SupplierPaymentSummary[] = []

    for (const pur of supplierPurchases) {
      if (!pur.payments) continue
      for (const pay of pur.payments) {
        payments.push({
          paymentId: pay.id,
          purchaseId: pur.id,
          purchaseNumber: pur.purchaseNumber,
          invoiceNumber: pur.supplierInvoiceNumber || pur.purchaseNumber,
          date: pay.date,
          amount: pay.amount,
          paymentMethod: pay.paymentMethod,
          reference: pay.reference,
          registeredByUserName: pay.registeredByUserName,
          notes: pay.notes,
        })
      }
    }

    // Ordenar del más reciente al más antiguo
    payments.sort((a, b) => (b.date > a.date ? 1 : -1))
    return payments
  }

  /**
   * Obtiene la relación de bodegas que han recibido compras de este proveedor:
   * Supplier <-> Location
   */
  async getSupplierWarehouses(supplierId: string): Promise<SupplierWarehouseRelation[]> {
    const purchases = db.purchases as unknown as any[]
    const supplierPurchases = purchases.filter(
      (p) => p.supplierId === supplierId
    )

    const map = new Map<string, SupplierWarehouseRelation>()

    for (const pur of supplierPurchases) {
      const locId = pur.destinationLocationId || pur.locationId || 'loc-001'
      const locName = pur.destinationLocationName || 'Bodega Principal'
      const locCode = pur.destinationLocationCode || 'BOD-001'

      const existing = map.get(locId)
      if (!existing) {
        map.set(locId, {
          locationId: locId,
          locationName: locName,
          locationCode: locCode,
          purchasesCount: 1,
          totalAmount: pur.total || 0,
          lastOperationDate: pur.date,
        })
      } else {
        existing.purchasesCount += 1
        existing.totalAmount += pur.total || 0
        if (pur.date > (existing.lastOperationDate || '')) {
          existing.lastOperationDate = pur.date
        }
      }
    }

    return Array.from(map.values())
  }

  /**
   * Obtiene los documentos y soportes digitales asociados.
   */
  async getSupplierDocuments(supplierId: string): Promise<SupplierDocumentItem[]> {
    const purchases = db.purchases as unknown as any[]
    const supplierPurchases = purchases.filter(
      (p) => p.supplierId === supplierId
    )

    const docs: SupplierDocumentItem[] = []

    for (const pur of supplierPurchases) {
      if (!pur.attachments) continue
      for (const att of pur.attachments) {
        docs.push({
          id: att.id,
          fileName: att.fileName,
          fileType: att.fileType,
          fileSize: att.fileSize,
          url: att.url,
          uploadedAt: att.uploadedAt,
          uploadedBy: att.uploadedBy,
          purchaseNumber: pur.purchaseNumber,
          invoiceNumber: pur.supplierInvoiceNumber,
        })
      }
    }

    return docs
  }

  /**
   * Obtiene los registros de auditoría específicos del proveedor.
   */
  async getSupplierAuditLogs(supplierId: string) {
    const logs = db.auditLogs as unknown as any[]
    return logs.filter(
      (l) =>
        l.entityId === supplierId ||
        (l.changes && l.changes.details && l.changes.details.includes(supplierId))
    )
  }

  /**
   * Calcula las métricas globales y estadísticas del módulo Proveedores.
   */
  async getSupplierStats(): Promise<SupplierStats> {
    const suppliers = this.suppliers
    const totalSuppliers = suppliers.length
    const activeSuppliers = suppliers.filter((s) => s.status === 'ACTIVE').length

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const suppliersWithRecentPurchases = suppliers.filter((s) => {
      const last = s.lastPurchaseDate || s.createdAt
      return last >= thirtyDaysAgo
    }).length

    const totalPendingBalance = suppliers.reduce(
      (acc, s) => acc + (s.currentBalance || 0),
      0
    )

    const purchases = db.purchases as unknown as any[]
    const now = new Date().toISOString().split('T')[0]

    let pendingInvoicesCount = 0
    let overdueInvoicesCount = 0
    let totalPurchasedPeriod = 0

    for (const pur of purchases) {
      if (pur.status !== 'CANCELLED' && (pur.pendingBalance || 0) > 0) {
        pendingInvoicesCount += 1
        if (pur.dueDate && pur.dueDate < now) {
          overdueInvoicesCount += 1
        }
      }
      if (pur.status !== 'CANCELLED') {
        totalPurchasedPeriod += pur.total || 0
      }
    }

    // Catálogo de productos únicos suministrados
    const productIds = new Set<string>()
    for (const pur of purchases) {
      if (pur.items) {
        for (const it of pur.items) {
          productIds.add(it.productId)
        }
      }
    }

    return {
      totalSuppliers,
      activeSuppliers,
      suppliersWithRecentPurchases,
      totalPendingBalance,
      pendingInvoicesCount,
      overdueInvoicesCount,
      totalPurchasedPeriod,
      suppliedProductsCount: productIds.size,
      isCostRedacted: false,
    }
  }

  /**
   * Exporta proveedores en formato CSV estructurado.
   */
  exportToCsv(suppliers: Supplier[], isCostRedacted: boolean = false): string {
    const headers = [
      'Documento_NIT',
      'Razon_Social',
      'Nombre_Comercial',
      'Contacto',
      'Telefono',
      'Email',
      'Ciudad',
      'Estado',
      'Dias_Credito',
      'Cupo_Credito',
      'Total_Comprado',
      'Saldo_Pendiente',
    ]

    const rows = suppliers.map((s) => [
      `"${s.documentNumber || s.nit || ''}"`,
      `"${(s.businessName || s.supplierName || '').replace(/"/g, '""')}"`,
      `"${(s.commercialName || '').replace(/"/g, '""')}"`,
      `"${s.contactName || ''}"`,
      `"${s.phone || ''}"`,
      `"${s.email || ''}"`,
      `"${s.city || ''}"`,
      s.status,
      s.creditDays,
      isCostRedacted ? 'OCULTO' : s.creditLimit,
      isCostRedacted ? 'OCULTO' : s.totalPurchased,
      isCostRedacted ? 'OCULTO' : s.currentBalance,
    ])

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  }

  async resetMocks(): Promise<void> {
    // Para restauración en tests si se requiere
  }
}

export const supplierRepository = new SupplierRepository()
