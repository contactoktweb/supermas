import { db, supabaseMock } from '@/lib/supabase'
import {
  Remission,
  RemissionFilters,
  RemissionStats,
  DispatchRemissionPayload,
  DeliverRemissionPayload,
  RemissionItem,
} from '../types'

export class RemissionRepository {
  /**
   * Obtiene lista de remisiones con filtros dinámicos y paginación
   */
  async findAll(filters: RemissionFilters = {}): Promise<{
    data: Remission[]
    total: number
    page: number
    pageSize: number
  }> {
    const { data: rawRemissions } = await supabaseMock.from('remissions').select()
    const all = (rawRemissions as unknown as Array<any>) || []

    const q = filters.query ? filters.query.toLowerCase().trim() : ''

    const filtered = all.filter((rem) => {
      // 1. Text Search
      if (q) {
        const matchNum = (rem.remissionNumber || '').toLowerCase().includes(q)
        const matchCust = (rem.customerName || '').toLowerCase().includes(q)
        const matchDoc = (rem.customerDoc || '').toLowerCase().includes(q)
        const matchSale = (rem.saleNumber || '').toLowerCase().includes(q)
        const matchDriver = (rem.driverName || '').toLowerCase().includes(q)
        const matchCarrier = (rem.carrierName || '').toLowerCase().includes(q)
        const matchPlate = (rem.vehiclePlate || '').toLowerCase().includes(q)
        if (
          !matchNum &&
          !matchCust &&
          !matchDoc &&
          !matchSale &&
          !matchDriver &&
          !matchCarrier &&
          !matchPlate
        ) {
          return false
        }
      }

      // 2. Tab Filter
      if (filters.tab && filters.tab !== 'Todas') {
        if (filters.tab === 'Borrador' && rem.status !== 'DRAFT') return false
        if (filters.tab === 'Creadas' && rem.status !== 'CREATED') return false
        if (filters.tab === 'En tránsito' && rem.status !== 'DISPATCHED') return false
        if (filters.tab === 'Entregadas' && rem.status !== 'DELIVERED') return false
        if (filters.tab === 'Anuladas' && rem.status !== 'CANCELLED') return false
      }

      // 3. Status Filter
      if (filters.status && filters.status !== 'ALL') {
        if (rem.status !== filters.status) return false
      }

      // 4. Warehouse / Location Filter
      if (filters.locationId && filters.locationId !== 'ALL') {
        if (rem.locationId !== filters.locationId) return false
      }

      // 5. Customer Filter
      if (filters.customerId && filters.customerId !== 'ALL') {
        if (rem.customerId !== filters.customerId) return false
      }

      // 6. Date Range Filter
      if (filters.dateFrom) {
        const fromIso = new Date(filters.dateFrom).toISOString().slice(0, 10)
        const remDate = new Date(rem.date).toISOString().slice(0, 10)
        if (remDate < fromIso) return false
      }
      if (filters.dateTo) {
        const toIso = new Date(filters.dateTo).toISOString().slice(0, 10)
        const remDate = new Date(rem.date).toISOString().slice(0, 10)
        if (remDate > toIso) return false
      }

      return true
    })

    // Sorting
    filtered.sort((a, b) => {
      const dir = filters.sortDirection === 'asc' ? 1 : -1
      if (filters.sortBy === 'remissionNumber') {
        return (a.remissionNumber || '').localeCompare(b.remissionNumber || '') * dir
      }
      if (filters.sortBy === 'customerName') {
        return (a.customerName || '').localeCompare(b.customerName || '') * dir
      }
      if (filters.sortBy === 'status') {
        return (a.status || '').localeCompare(b.status || '') * dir
      }
      return (new Date(b.date).getTime() - new Date(a.date).getTime()) * dir
    })

    const total = filtered.length
    const page = filters.page && filters.page > 0 ? filters.page : 1
    const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 10
    const start = (page - 1) * pageSize
    const paginated = filtered.slice(start, start + pageSize)

    return {
      data: paginated.map((r) => this.mapToDomain(r)),
      total,
      page,
      pageSize,
    }
  }

  /**
   * Busca remisión por ID o número
   */
  /**
   * Obtiene los ítems normalizados relacionales de la remisión desde remission_items
   */
  async getItems(remissionId: string): Promise<RemissionItem[]> {
    const { data: rawItems } = await supabaseMock.from('remission_items').select()
    const allItems = (rawItems as unknown as Array<RemissionItem & { remissionId?: string }>) || []
    return allItems.filter((i) => i.remissionId === remissionId)
  }

  async findById(id: string): Promise<Remission | null> {
    const remissions = (db.remissions as unknown) as Array<Record<string, unknown>>
    const found = remissions.find((r) => r.id === id || r.remissionNumber === id)
    if (!found) return null
    const domain = this.mapToDomain(found)
    const items = await this.getItems(domain.id)
    if (items.length > 0) {
      domain.items = items
    }
    return domain
  }

  /**
   * Busca remisión por ID de venta relacionada
   */
  async findBySaleId(saleId: string): Promise<Remission | null> {
    const remissions = (db.remissions as unknown) as Array<Record<string, unknown>>
    const found = remissions.find((r) => r.saleId === saleId)
    return found ? this.mapToDomain(found) : null
  }

  /**
   * Calcula estadísticas consolidadas del módulo de Remisiones
   */
  async getStats(): Promise<RemissionStats> {
    const remissions = (db.remissions as unknown) as Array<Record<string, unknown>>

    let pendingDispatch = 0
    let inTransit = 0
    let delivered = 0
    let cancelled = 0
    let deliveredUnits = 0
    const customerIds = new Set<string>()

    for (const r of remissions) {
      if (r.customerId) {
        customerIds.add(String(r.customerId))
      }

      if (r.status === 'CREATED' || r.status === 'DRAFT') {
        pendingDispatch++
      } else if (r.status === 'DISPATCHED') {
        inTransit++
      } else if (r.status === 'DELIVERED') {
        delivered++
        const items = (r.items as RemissionItem[]) || []
        for (const it of items) {
          deliveredUnits += Number(it.quantityDelivered || it.quantityRequested || 0)
        }
      } else if (r.status === 'CANCELLED') {
        cancelled++
      }
    }

    return {
      totalRemissions: remissions.length,
      pendingDispatch,
      inTransit,
      delivered,
      cancelled,
      deliveredUnits,
      uniqueCustomers: customerIds.size,
    }
  }

  /**
   * Inserta una nueva remisión
   */
  async create(remission: Remission, user: string = 'Administrador'): Promise<Remission> {
    const remissions = (db.remissions as unknown) as Array<Record<string, unknown>>
    const auditLogs = (db.auditLogs as unknown) as Array<Record<string, unknown>>
    const sales = (db.sales as unknown) as Array<Record<string, unknown>>

    // 1. Insert Remission
    remissions.unshift(remission as unknown as Record<string, unknown>)

    // 2. Link with Sale if originating from a sale
    if (remission.saleId) {
      const sale = sales.find((s) => s.id === remission.saleId)
      if (sale) {
        sale.remissionNumber = remission.remissionNumber
        sale.hasRemission = true
      }
    }

    // 3. Register Audit Log
    auditLogs.unshift({
      id: `aud-rem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      user,
      action: 'REMISION_CREADA',
      details: `Remisión ${remission.remissionNumber} creada para ${remission.customerName} (${remission.locationName}) con ${remission.itemsCount} productos (${remission.totalUnits} unidades). Estado: ${remission.status}.`,
      entityId: remission.id,
      entityType: 'REMISSION',
    })

    return remission
  }

  /**
   * Despacha una remisión: cambia estado a DISPATCHED y descuenta inventario (Kardex REMISSION_OUT)
   */
  async dispatch(
    remissionId: string,
    dispatchData: DispatchRemissionPayload,
    user: string = 'Administrador'
  ): Promise<Remission> {
    const remissions = (db.remissions as unknown) as Array<Record<string, unknown>>
    const movements = (db.inventoryMovements as unknown) as Array<Record<string, unknown>>
    const stockLevels = (db.stockLevels as unknown) as Array<any>
    const auditLogs = (db.auditLogs as unknown) as Array<Record<string, unknown>>

    const remission = remissions.find((r) => r.id === remissionId)
    if (!remission) {
      throw new Error(`La remisión con ID "${remissionId}" no existe.`)
    }

    if (remission.status === 'DISPATCHED' || remission.status === 'DELIVERED') {
      throw new Error(`La remisión ya fue despachada previamente (Estado: ${remission.status}).`)
    }

    if (remission.status === 'CANCELLED') {
      throw new Error('No se puede despachar una remisión anulada.')
    }

    const nowIso = new Date().toISOString()
    remission.status = 'DISPATCHED'
    remission.carrierName = dispatchData.carrierName
    remission.vehiclePlate = dispatchData.vehiclePlate || 'N/A'
    remission.driverName = dispatchData.driverName
    remission.driverDoc = dispatchData.driverDoc || 'N/A'
    remission.dispatchedAt = nowIso
    remission.dispatchedBy = user
    remission.updatedAt = nowIso

    if (dispatchData.notes) {
      remission.notes = `${remission.notes || ''} [Despacho: ${dispatchData.notes}]`.trim()
    }

    // Generar movimientos Kardex REMISSION_OUT
    const items = (remission.items as RemissionItem[]) || []
    for (const item of items) {
      const stockEntry = stockLevels.find(
        (s) => s.productId === item.productId && s.locationId === remission.locationId
      )
      const previousStock = stockEntry ? stockEntry.availableUnits : 50
      const qtyOut = Number(item.quantityRequested) || 0
      const resultingStock = Math.max(0, previousStock - qtyOut)

      if (stockEntry) {
        stockEntry.quantity = Math.max(0, (stockEntry.quantity || 0) - qtyOut)
        stockEntry.availableUnits = resultingStock
      }

      movements.unshift({
        id: `mov-rem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        movementNumber: `MOV-REM-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
        createdAt: nowIso,
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        barcode: item.barcode || '',
        locationId: remission.locationId,
        locationName: remission.locationName,
        type: 'REMISSION_OUT',
        quantityIn: 0,
        quantityOut: qtyOut,
        quantityDelta: -qtyOut,
        previousStock,
        resultingStock,
        unitCost: item.unitCost || 0,
        totalValue: (item.unitPrice || 0) * qtyOut,
        sourceDocumentType: 'REMISSION',
        sourceDocumentId: remission.id,
        sourceDocumentNumber: remission.remissionNumber,
        userName: user,
        notes: `Salida por Despacho de Remisión ${remission.remissionNumber} a ${remission.customerName}. Conductor: ${dispatchData.driverName} (${dispatchData.vehiclePlate || ''})`,
      })
    }

    // Auditoría
    auditLogs.unshift({
      id: `aud-disp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: nowIso,
      user,
      action: 'REMISION_DESPACHADA',
      details: `Remisión ${remission.remissionNumber} despachada por ${user}. Transportador: ${dispatchData.carrierName}, Conductor: ${dispatchData.driverName} (Placa: ${dispatchData.vehiclePlate || 'N/A'}).`,
      entityId: String(remission.id),
      entityType: 'REMISSION',
    })

    return this.mapToDomain(remission)
  }

  /**
   * Confirma la entrega física al cliente
   */
  async deliver(
    remissionId: string,
    deliverData: DeliverRemissionPayload,
    user: string = 'Administrador'
  ): Promise<Remission> {
    const remissions = (db.remissions as unknown) as Array<Record<string, unknown>>
    const auditLogs = (db.auditLogs as unknown) as Array<Record<string, unknown>>

    const remission = remissions.find((r) => r.id === remissionId)
    if (!remission) {
      throw new Error(`La remisión con ID "${remissionId}" no existe.`)
    }

    if (remission.status === 'DELIVERED') {
      throw new Error('La remisión ya fue marcada como entregada.')
    }

    if (remission.status === 'CANCELLED') {
      throw new Error('No se puede confirmar entrega de una remisión anulada.')
    }

    const nowIso = new Date().toISOString()
    remission.status = 'DELIVERED'
    remission.deliveredAt = deliverData.deliveredAt || nowIso
    remission.deliveredBy = deliverData.deliveredBy || remission.carrierName || user
    remission.receivedBy = deliverData.receivedBy
    remission.receivedDoc = deliverData.receivedDoc || 'N/A'
    remission.deliveryEvidenceNotes = deliverData.deliveryEvidenceNotes || null
    remission.updatedAt = nowIso

    // Actualizar quantityDelivered = quantityRequested en items
    const items = (remission.items as RemissionItem[]) || []
    for (const it of items) {
      it.quantityDelivered = it.quantityRequested
    }
    remission.items = items

    // Auditoría
    auditLogs.unshift({
      id: `aud-deliv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: nowIso,
      user,
      action: 'REMISION_ENTREGADA',
      details: `Remisión ${remission.remissionNumber} entregada y recibida por ${deliverData.receivedBy} (${deliverData.receivedDoc || 'Sin doc'}).`,
      entityId: String(remission.id),
      entityType: 'REMISSION',
    })

    return this.mapToDomain(remission)
  }

  /**
   * Anula una remisión y reversa inventario si ya estaba despachada
   */
  async cancel(remissionId: string, reason: string, user: string = 'Administrador'): Promise<Remission> {
    const remissions = (db.remissions as unknown) as Array<Record<string, unknown>>
    const movements = (db.inventoryMovements as unknown) as Array<Record<string, unknown>>
    const stockLevels = (db.stockLevels as unknown) as Array<any>
    const auditLogs = (db.auditLogs as unknown) as Array<Record<string, unknown>>

    const remission = remissions.find((r) => r.id === remissionId)
    if (!remission) {
      throw new Error(`La remisión con ID "${remissionId}" no existe.`)
    }

    if (remission.status === 'CANCELLED') {
      throw new Error('La remisión ya se encuentra anulada.')
    }

    const wasDispatched = remission.status === 'DISPATCHED' || remission.status === 'DELIVERED'
    const nowIso = new Date().toISOString()

    // Si ya había generado salida física, reingresar mercancía a bodega
    if (wasDispatched) {
      const items = (remission.items as RemissionItem[]) || []
      for (const item of items) {
        const stockEntry = stockLevels.find(
          (s) => s.productId === item.productId && s.locationId === remission.locationId
        )
        const previousStock = stockEntry ? stockEntry.availableUnits : 50
        const qtyIn = Number(item.quantityRequested) || 0
        const resultingStock = previousStock + qtyIn

        if (stockEntry) {
          stockEntry.quantity = (stockEntry.quantity || 0) + qtyIn
          stockEntry.availableUnits = resultingStock
        }

        movements.unshift({
          id: `mov-rev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          movementNumber: `MOV-REV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
          createdAt: nowIso,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          barcode: item.barcode || '',
          locationId: remission.locationId,
          locationName: remission.locationName,
          type: 'REMISSION_RETURN',
          quantityIn: qtyIn,
          quantityOut: 0,
          quantityDelta: qtyIn,
          previousStock,
          resultingStock,
          unitCost: item.unitCost || 0,
          totalValue: (item.unitPrice || 0) * qtyIn,
          sourceDocumentType: 'REMISSION',
          sourceDocumentId: remission.id,
          sourceDocumentNumber: remission.remissionNumber,
          userName: user,
          notes: `Reversión de inventario por Anulación de Remisión ${remission.remissionNumber}. Motivo: ${reason}`,
        })
      }
    }

    remission.status = 'CANCELLED'
    remission.cancelReason = reason
    remission.cancelledAt = nowIso
    remission.cancelledBy = user
    remission.updatedAt = nowIso

    // Auditoría
    auditLogs.unshift({
      id: `aud-can-rem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: nowIso,
      user,
      action: 'REMISION_ANULADA',
      details: `Remisión ${remission.remissionNumber} anulada por ${user}. Motivo: ${reason}. Reversión de stock: ${wasDispatched ? 'SÍ' : 'NO'}.`,
      entityId: String(remission.id),
      entityType: 'REMISSION',
    })

    return this.mapToDomain(remission)
  }

  /**
   * Vincula factura emitida a la remisión
   */
  async linkInvoice(remissionId: string, invoiceId: string, invoiceNumber: string): Promise<Remission> {
    const remissions = (db.remissions as unknown) as Array<Record<string, unknown>>
    const remission = remissions.find((r) => r.id === remissionId)
    if (!remission) {
      throw new Error(`La remisión con ID "${remissionId}" no existe.`)
    }
    remission.invoiceId = invoiceId
    remission.invoiceNumber = invoiceNumber
    remission.updatedAt = new Date().toISOString()
    return this.mapToDomain(remission)
  }

  /**
   * Obtiene ventas disponibles para generar remisión
   */
  async getSalesPendingRemission() {
    const sales = (db.sales as unknown as Array<any>) || []
    return sales.filter((s) => s.status !== 'CANCELLED' && !s.remissionNumber && !s.hasRemission)
  }

  private mapToDomain(raw: Record<string, any>): Remission {
    return {
      id: String(raw.id || ''),
      remissionNumber: String(raw.remissionNumber || ''),
      prefix: String(raw.prefix || 'REM'),
      saleId: raw.saleId ? String(raw.saleId) : null,
      saleNumber: raw.saleNumber ? String(raw.saleNumber) : null,
      invoiceId: raw.invoiceId ? String(raw.invoiceId) : null,
      invoiceNumber: raw.invoiceNumber ? String(raw.invoiceNumber) : null,
      customerId: String(raw.customerId || ''),
      customerName: String(raw.customerName || 'Cliente Genérico'),
      customerDoc: String(raw.customerDoc || '222222222222'),
      customerPhone: raw.customerPhone || undefined,
      customerAddress: raw.customerAddress || undefined,
      customerCity: raw.customerCity || undefined,
      locationId: String(raw.locationId || 'loc-001'),
      locationName: String(raw.locationName || 'Bodega Principal'),
      date: String(raw.date || new Date().toISOString()),
      createdAt: String(raw.createdAt || raw.date || new Date().toISOString()),
      updatedAt: String(raw.updatedAt || raw.date || new Date().toISOString()),
      status: (raw.status as any) || 'CREATED',
      items: Array.isArray(raw.items) ? raw.items : [],
      itemsCount: Number(raw.itemsCount || (Array.isArray(raw.items) ? raw.items.length : 0)),
      totalUnits: Number(raw.totalUnits || 0),
      deliveryAddress: raw.deliveryAddress || undefined,
      deliveryCity: raw.deliveryCity || undefined,
      contactPerson: raw.contactPerson || undefined,
      contactPhone: raw.contactPhone || undefined,
      carrierName: raw.carrierName || null,
      vehiclePlate: raw.vehiclePlate || null,
      driverName: raw.driverName || null,
      driverDoc: raw.driverDoc || null,
      dispatchedAt: raw.dispatchedAt || null,
      dispatchedBy: raw.dispatchedBy || null,
      deliveredAt: raw.deliveredAt || null,
      deliveredBy: raw.deliveredBy || null,
      receivedBy: raw.receivedBy || null,
      receivedDoc: raw.receivedDoc || null,
      deliveryEvidenceNotes: raw.deliveryEvidenceNotes || null,
      evidenceImageUrl: raw.evidenceImageUrl || null,
      signatureImageUrl: raw.signatureImageUrl || null,
      cancelReason: raw.cancelReason || null,
      cancelledAt: raw.cancelledAt || null,
      cancelledBy: raw.cancelledBy || null,
      notes: raw.notes || undefined,
      createdBy: String(raw.createdBy || 'Sistema'),
    }
  }
}

export const remissionRepository = new RemissionRepository()
