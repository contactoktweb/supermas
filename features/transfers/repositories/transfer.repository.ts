import {
  Transfer,
  TransferFilterParams,
  GlobalTransferStats,
  TransferPaginationResult,
  TransferCreateInput,
  TransferDispatchInput,
  TransferReceiveInput,
  TransferRejectInput,
} from '../types'
import { TRANSFERS_MOCK, AVAILABLE_PRODUCTS_FOR_TRANSFER } from '../mocks/transfers.mock'

export class TransferRepository {
  private transfers: Transfer[] = [...TRANSFERS_MOCK]

  async findMany(filters: TransferFilterParams): Promise<TransferPaginationResult> {
    let filtered = [...this.transfers]

    // 1. Search Query (Code, Product, Origin, Destination, User, Notes)
    if (filters.query && filters.query.trim() !== '') {
      const q = filters.query.toLowerCase().trim()
      filtered = filtered.filter(
        (t) =>
          t.code.toLowerCase().includes(q) ||
          t.originLocationName.toLowerCase().includes(q) ||
          t.destinationLocationName.toLowerCase().includes(q) ||
          t.createdByUserName.toLowerCase().includes(q) ||
          (t.dispatchedByUserName && t.dispatchedByUserName.toLowerCase().includes(q)) ||
          (t.receivedByUserName && t.receivedByUserName.toLowerCase().includes(q)) ||
          (t.notes && t.notes.toLowerCase().includes(q)) ||
          t.items.some((i) => i.productName.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q))
      )
    }

    // 2. Specific Code filter
    if (filters.code && filters.code.trim() !== '') {
      const c = filters.code.toLowerCase().trim()
      filtered = filtered.filter((t) => t.code.toLowerCase().includes(c))
    }

    // 3. Origin Location filter
    if (filters.originLocationId && filters.originLocationId !== 'ALL') {
      filtered = filtered.filter((t) => t.originLocationId === filters.originLocationId)
    }

    // 4. Destination Location filter
    if (filters.destinationLocationId && filters.destinationLocationId !== 'ALL') {
      filtered = filtered.filter((t) => t.destinationLocationId === filters.destinationLocationId)
    }

    // 5. Direction filter (ALL | INBOUND | OUTBOUND) relative to activeLocationId
    if (filters.direction && filters.direction !== 'ALL' && filters.activeLocationId && filters.activeLocationId !== 'ALL') {
      if (filters.direction === 'INBOUND') {
        filtered = filtered.filter((t) => t.destinationLocationId === filters.activeLocationId)
      } else if (filters.direction === 'OUTBOUND') {
        filtered = filtered.filter((t) => t.originLocationId === filters.activeLocationId)
      }
    }

    // 6. Status filter
    if (filters.status && filters.status !== 'ALL') {
      filtered = filtered.filter((t) => t.status === filters.status)
    }

    // 7. User responsible filter
    if (filters.userId && filters.userId !== 'ALL') {
      filtered = filtered.filter(
        (t) =>
          t.createdByUserId === filters.userId ||
          t.dispatchedByUserId === filters.userId ||
          t.receivedByUserId === filters.userId
      )
    }

    // 8. Product filter
    if (filters.productId && filters.productId !== 'ALL') {
      filtered = filtered.filter((t) => t.items.some((i) => i.productId === filters.productId))
    }

    // 9. Dates filter
    if (filters.startDate) {
      const start = new Date(filters.startDate).getTime()
      filtered = filtered.filter((t) => new Date(t.createdAt).getTime() >= start)
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate)
      end.setHours(23, 59, 59, 999)
      filtered = filtered.filter((t) => new Date(t.createdAt).getTime() <= end.getTime())
    }

    // 10. Sorting
    const sortField = filters.sortField || 'createdAt'
    const sortDir = filters.sortDirection || 'desc'
    const mult = sortDir === 'asc' ? 1 : -1

    filtered.sort((a, b) => {
      switch (sortField) {
        case 'createdAt':
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * mult
        case 'updatedAt':
          return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * mult
        case 'code':
          return a.code.localeCompare(b.code) * mult
        case 'origin':
          return a.originLocationName.localeCompare(b.originLocationName) * mult
        case 'destination':
          return a.destinationLocationName.localeCompare(b.destinationLocationName) * mult
        case 'units':
          return (a.totalUnitsRequested - b.totalUnitsRequested) * mult
        case 'status':
          return a.status.localeCompare(b.status) * mult
        default:
          return 0
      }
    })

    const total = filtered.length
    const page = Math.max(1, filters.page || 1)
    const pageSize = Math.max(1, filters.pageSize || 10)
    const totalPages = Math.ceil(total / pageSize) || 1
    const startIndex = (page - 1) * pageSize
    const paginatedItems = filtered.slice(startIndex, startIndex + pageSize)

    return {
      items: paginatedItems,
      total,
      page,
      pageSize,
      totalPages,
      isCostRedacted: false,
    }
  }

  async findById(id: string): Promise<Transfer | null> {
    const found = this.transfers.find((t) => t.id === id || t.code === id)
    return found ? { ...found } : null
  }

  async getGlobalStats(filters?: TransferFilterParams): Promise<GlobalTransferStats> {
    let items = [...this.transfers]

    if (filters?.originLocationId && filters.originLocationId !== 'ALL') {
      items = items.filter((t) => t.originLocationId === filters.originLocationId)
    }
    if (filters?.destinationLocationId && filters.destinationLocationId !== 'ALL') {
      items = items.filter((t) => t.destinationLocationId === filters.destinationLocationId)
    }

    const pendingCount = items.filter((t) => t.status === 'PENDING').length
    const inTransitCount = items.filter((t) => t.status === 'IN_TRANSIT').length
    const receivedCount = items.filter((t) => t.status === 'RECEIVED').length
    const rejectedCount = items.filter((t) => t.status === 'REJECTED').length
    const incidentCount = items.filter((t) => t.hasIncident).length
    const totalUnitsTransferred = items.reduce(
      (acc, t) => acc + (t.status === 'RECEIVED' ? t.totalUnitsReceived : t.totalUnitsDispatched || t.totalUnitsRequested),
      0
    )

    return {
      pendingCount,
      inTransitCount,
      receivedCount,
      rejectedCount,
      totalUnitsTransferred,
      incidentCount,
      isCostRedacted: false,
    }
  }

  async create(
    input: TransferCreateInput,
    userContext: { userId: string; userName: string; userRole: string }
  ): Promise<Transfer> {
    const locationsMap: Record<string, { name: string; code: string }> = {
      'loc-01': { name: 'Bodega Principal Cali', code: 'BOD-PRI-01' },
      'loc-02': { name: 'Punto Centro - Carrera 5', code: 'POS-CEN-01' },
      'loc-03': { name: 'Bodega Norte - Yumbo', code: 'BOD-NOR-01' },
      'loc-04': { name: 'Punto Sur - Ciudad Jardín', code: 'POS-SUR-01' },
    }

    const origin = locationsMap[input.originLocationId] || {
      name: 'Bodega Origen',
      code: 'BOD-ORIG',
    }
    const destination = locationsMap[input.destinationLocationId] || {
      name: 'Bodega Destino',
      code: 'BOD-DEST',
    }

    const newCodeNumber = this.transfers.length + 156
    const code = `TR-000${newCodeNumber}`
    const id = `trans-${newCodeNumber}`
    const now = new Date().toISOString()

    const items = input.items.map((item, index) => {
      const prodMeta = AVAILABLE_PRODUCTS_FOR_TRANSFER.find((p) => p.productId === item.productId)
      const unitCost = prodMeta ? prodMeta.unitCost : 5000
      const totalCost = unitCost * item.units
      const availableStock = prodMeta?.stocksByLocation[input.originLocationId] ?? 100

      return {
        id: `item-${newCodeNumber}-${index + 1}`,
        productId: item.productId,
        productName: prodMeta ? prodMeta.productName : 'Producto Transferido',
        sku: prodMeta ? prodMeta.sku : `SKU-${item.productId}`,
        barcode: prodMeta?.barcode,
        category: prodMeta ? prodMeta.category : 'General',
        unitOfMeasure: prodMeta ? prodMeta.unitOfMeasure : 'UND',
        imageUrl: prodMeta?.imageUrl,
        availableStockAtOrigin: availableStock,
        requestedUnits: item.units,
        dispatchedUnits: 0,
        receivedUnits: 0,
        unitCost,
        totalCost,
      }
    })

    const totalUnitsRequested = items.reduce((acc, i) => acc + i.requestedUnits, 0)
    const totalValueAtCost = items.reduce((acc, i) => acc + i.totalCost, 0)

    const newTransfer: Transfer = {
      id,
      code,
      originLocationId: input.originLocationId,
      originLocationName: origin.name,
      originLocationCode: origin.code,
      destinationLocationId: input.destinationLocationId,
      destinationLocationName: destination.name,
      destinationLocationCode: destination.code,
      status: 'PENDING',
      items,
      totalItemsCount: items.length,
      totalUnitsRequested,
      totalUnitsDispatched: 0,
      totalUnitsReceived: 0,
      totalValueAtCost,
      createdByUserId: userContext.userId,
      createdByUserName: userContext.userName,
      createdByUserRole: userContext.userRole,
      reason: input.reason,
      internalReference: input.internalReference,
      hasIncident: false,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    }

    this.transfers.unshift(newTransfer)
    return { ...newTransfer }
  }

  async dispatch(
    input: TransferDispatchInput,
    userContext: { userId: string; userName: string }
  ): Promise<Transfer> {
    const transfer = this.transfers.find((t) => t.id === input.transferId)
    if (!transfer) {
      throw new Error(`La transferencia ${input.transferId} no fue encontrada`)
    }
    if (transfer.status !== 'PENDING') {
      throw new Error(`No se puede despachar una transferencia en estado ${transfer.status}`)
    }

    const now = new Date().toISOString()
    transfer.status = 'IN_TRANSIT'
    transfer.dispatchedByUserId = userContext.userId
    transfer.dispatchedByUserName = userContext.userName
    transfer.dispatchedAt = now
    transfer.updatedAt = now
    transfer.totalUnitsDispatched = transfer.totalUnitsRequested
    transfer.items = transfer.items.map((i) => ({
      ...i,
      dispatchedUnits: i.requestedUnits,
    }))

    if (input.notes) {
      transfer.notes = transfer.notes ? `${transfer.notes}\n[Despacho]: ${input.notes}` : input.notes
    }

    return { ...transfer }
  }

  async receive(
    input: TransferReceiveInput,
    userContext: { userId: string; userName: string }
  ): Promise<Transfer> {
    const transfer = this.transfers.find((t) => t.id === input.transferId)
    if (!transfer) {
      throw new Error(`La transferencia ${input.transferId} no fue encontrada`)
    }
    if (transfer.status !== 'IN_TRANSIT') {
      throw new Error(`No se puede recibir una transferencia en estado ${transfer.status}`)
    }

    const now = new Date().toISOString()
    let hasIncident = false
    let incidentSummary = ''

    // Actualizar unidades recibidas
    if (input.receivedItems && input.receivedItems.length > 0) {
      transfer.items = transfer.items.map((item) => {
        const receivedItemData = input.receivedItems?.find((ri) => ri.productId === item.productId)
        const receivedUnits = receivedItemData !== undefined ? receivedItemData.receivedUnits : item.dispatchedUnits
        const diff = receivedUnits - item.dispatchedUnits
        const hasDiscrepancy = diff !== 0

        if (hasDiscrepancy) {
          hasIncident = true
          incidentSummary += `\n- ${item.productName}: Enviadas ${item.dispatchedUnits}, Recibidas ${receivedUnits} (Diferencia: ${diff > 0 ? `+${diff}` : diff})`
        }

        return {
          ...item,
          receivedUnits,
          hasDiscrepancy,
          discrepancyNote: receivedItemData?.notes || (hasDiscrepancy ? `Diferencia de ${diff} unidades` : undefined),
        }
      })
    } else {
      transfer.items = transfer.items.map((i) => ({
        ...i,
        receivedUnits: i.dispatchedUnits,
      }))
    }

    transfer.totalUnitsReceived = transfer.items.reduce((acc, i) => acc + i.receivedUnits, 0)
    transfer.status = 'RECEIVED'
    transfer.receivedByUserId = userContext.userId
    transfer.receivedByUserName = userContext.userName
    transfer.receivedAt = now
    transfer.updatedAt = now

    if (hasIncident) {
      transfer.hasIncident = true
      transfer.incidentNotes = `Novedades reportadas en recepción:${incidentSummary}${input.notes ? `\nObservación: ${input.notes}` : ''}`
    }

    if (input.notes) {
      transfer.notes = transfer.notes ? `${transfer.notes}\n[Recepción]: ${input.notes}` : input.notes
    }

    return { ...transfer }
  }

  async reject(
    input: TransferRejectInput,
    userContext: { userId: string; userName: string }
  ): Promise<Transfer> {
    const transfer = this.transfers.find((t) => t.id === input.transferId)
    if (!transfer) {
      throw new Error(`La transferencia ${input.transferId} no fue encontrada`)
    }
    if (transfer.status !== 'PENDING') {
      throw new Error(`Solo se pueden rechazar o cancelar transferencias pendientes antes del despacho`)
    }

    const now = new Date().toISOString()
    transfer.status = 'REJECTED'
    transfer.rejectedByUserId = userContext.userId
    transfer.rejectedByUserName = userContext.userName
    transfer.rejectedAt = now
    transfer.rejectionReason = input.reason
    transfer.updatedAt = now

    return { ...transfer }
  }
}

export const transferRepository = new TransferRepository()
