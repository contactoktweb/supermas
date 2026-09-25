import {
  Transfer,
  TransferFilterParams,
  GlobalTransferStats,
  TransferPaginationResult,
  TransferCreateInput,
  TransferDispatchInput,
  TransferReceiveInput,
  TransferRejectInput,
  UserPermissionContext,
  TransferFlowEdge,
  TransferLocationOption,
  ProductAvailabilityForTransfer,
} from '../types'
import {
  transferCreateSchema,
  transferDispatchSchema,
  transferReceiveSchema,
  transferRejectSchema,
  transferFilterSchema,
} from '../schemas/transfer.schema'
import { transferRepository } from '../repositories/transfer.repository'
import { warehouseRepository } from '@/features/warehouses/repositories/warehouse.repository'
import { inventoryRepository } from '@/features/inventory/repositories/inventory.repository'

export class TransferService {
  private hasPermission(
    userContext?: UserPermissionContext,
    requiredPermission?: string
  ): boolean {
    if (!userContext) return true
    if (userContext.userRole === 'ADMIN') return true
    if (!requiredPermission) return true
    return userContext.permissions.includes(requiredPermission)
  }

  private sanitizeTransferForUser(transfer: Transfer, canReadCost: boolean): Transfer {
    if (canReadCost) return transfer

    return {
      ...transfer,
      totalValueAtCost: 0,
      items: transfer.items.map((item) => ({
        ...item,
        unitCost: 0,
        totalCost: 0,
      })),
    }
  }

  async listTransfers(
    rawFilters: TransferFilterParams = {},
    userContext?: UserPermissionContext
  ): Promise<TransferPaginationResult> {
    const validatedFilters = transferFilterSchema.parse(rawFilters)

    // Si el usuario no es admin y está restringido a una sede, forzar su filtro
    let activeLocationId = validatedFilters.activeLocationId
    if (userContext && userContext.userRole !== 'ADMIN' && userContext.assignedLocationId) {
      activeLocationId = userContext.assignedLocationId
    }

    const canReadCost = this.hasPermission(userContext, 'cost.read')

    const result = await transferRepository.findMany({
      ...validatedFilters,
      activeLocationId,
    })

    const sanitizedItems = result.items.map((t) =>
      this.sanitizeTransferForUser(t, canReadCost)
    )

    return {
      ...result,
      items: sanitizedItems,
      isCostRedacted: !canReadCost,
    }
  }

  async getTransferById(
    id: string,
    userContext?: UserPermissionContext
  ): Promise<Transfer | null> {
    const transfer = await transferRepository.findById(id)
    if (!transfer) return null

    const canReadCost = this.hasPermission(userContext, 'cost.read')
    return this.sanitizeTransferForUser(transfer, canReadCost)
  }

  async getGlobalStats(
    filters?: TransferFilterParams,
    userContext?: UserPermissionContext
  ): Promise<GlobalTransferStats> {
    const stats = await transferRepository.getGlobalStats(filters)
    const canReadCost = this.hasPermission(userContext, 'cost.read')

    return {
      ...stats,
      isCostRedacted: !canReadCost,
    }
  }

  async getTransferLocations(
    userContext?: UserPermissionContext
  ): Promise<TransferLocationOption[]> {
    const { data } = await warehouseRepository.findAll()
    return data
      .filter((l) => l.status === 'ACTIVE')
      .map((l) => ({
        id: l.id,
        code: l.code,
        name: l.name,
        city: l.city || 'Medellín',
        department: l.department || 'Antioquia',
        type: l.type,
        typeLabel:
          l.type === 'DISTRIBUTION_CENTER'
            ? 'Centro de Distribución'
            : l.type === 'STORE_POINT'
            ? 'Punto de Venta'
            : 'Bodega Principal',
        status: l.status,
        description: l.description,
      }))
  }

  async getAvailableProductsForTransfer(
    originLocationId: string,
    destinationLocationId?: string
  ): Promise<ProductAvailabilityForTransfer[]> {
    const { data: stockLevels } = await inventoryRepository.getStockLevelsByLocation({
      locationId: originLocationId,
    })
    return stockLevels.map((s) => ({
      productId: s.productId,
      productName: s.productName,
      sku: s.sku,
      barcode: s.barcode,
      category: s.category,
      unitOfMeasure: s.unitOfMeasure,
      imageUrl: undefined,
      status: 'ACTIVE',
      minStock: s.minStock,
      stockInOrigin: s.currentStock,
      stockInDestination: 0,
      stocksByLocation: { [originLocationId]: s.currentStock },
      unitCost: s.averageCost || 0,
    }))
  }

  async createTransfer(
    input: TransferCreateInput,
    userContext?: UserPermissionContext
  ): Promise<Transfer> {
    if (userContext && !this.hasPermission(userContext, 'inventory.transfer')) {
      throw new Error('No tiene permiso para crear transferencias de inventario')
    }

    const validated = transferCreateSchema.parse(input)

    // Validar existencia y estado de las bodegas
    const originLoc = await warehouseRepository.findById(validated.originLocationId)
    const destLoc = await warehouseRepository.findById(validated.destinationLocationId)

    if (!originLoc || originLoc.status !== 'ACTIVE') {
      throw new Error('La bodega de origen seleccionada no está activa o no existe')
    }
    if (!destLoc || destLoc.status !== 'ACTIVE') {
      throw new Error('La bodega de destino seleccionada no está activa o no existe')
    }

    if (validated.originLocationId === validated.destinationLocationId) {
      throw new Error('La bodega de origen y destino no pueden ser la misma ubicación')
    }

    // Validar disponibilidad de stock en tiempo real en servidor (anti-concurrencia)
    const { data: originStocks } = await inventoryRepository.getStockLevelsByLocation({
      locationId: validated.originLocationId,
    })
    for (const item of validated.items) {
      const stockItem = originStocks.find((s) => s.productId === item.productId)
      const stockInOrigin = stockItem?.currentStock ?? 0
      if (item.units > stockInOrigin) {
        throw new Error(
          `El stock disponible cambió. Actualmente hay ${stockInOrigin} unidades disponibles para "${stockItem?.productName || item.productId}", pero intentas transferir ${item.units}.`
        )
      }
    }

    const creator = {
      userId: userContext?.userId || 'user-admin',
      userName:
        userContext?.userRole === 'SELLER'
          ? 'Carlos Mario Ruiz'
          : userContext?.userRole === 'WAREHOUSE_MANAGER'
          ? 'Mauricio Arango'
          : 'Mauricio Arango',
      userRole: userContext?.userRole || 'Coordinador de Logística',
    }

    return transferRepository.create(validated, creator)
  }

  async dispatchTransfer(
    input: TransferDispatchInput,
    userContext?: UserPermissionContext
  ): Promise<Transfer> {
    if (userContext && !this.hasPermission(userContext, 'inventory.transfer.dispatch')) {
      throw new Error('No tiene permiso para despachar transferencias')
    }

    const validated = transferDispatchSchema.parse(input)
    const existing = await transferRepository.findById(validated.transferId)
    if (!existing) {
      throw new Error(`Transferencia ${validated.transferId} no encontrada`)
    }

    // Validar bodega autorizada si el usuario no es admin
    if (
      userContext &&
      userContext.userRole !== 'ADMIN' &&
      userContext.assignedLocationId &&
      userContext.assignedLocationId !== existing.originLocationId
    ) {
      throw new Error('Solo el personal de la bodega de origen puede despachar esta transferencia')
    }

    // Re-verificar concurrencia de stock en origen
    const { data: originStockLevels } = await inventoryRepository.getStockLevelsByLocation({
      locationId: existing.originLocationId,
    })
    for (const item of existing.items) {
      const stock = originStockLevels.find((s) => s.productId === item.productId)?.currentStock ?? 0
      if (item.requestedUnits > stock) {
        throw new Error(
          `Conflicto de concurrencia: el stock actual en origen para ${item.productName} (${stock}) es inferior a las unidades solicitadas (${item.requestedUnits})`
        )
      }
    }

    const dispatcher = {
      userId: userContext?.userId || 'user-dispatch',
      userName: userContext?.userId === 'user-01' ? 'Laura Gómez' : 'Mauricio Arango',
    }

    return transferRepository.dispatch(validated, dispatcher)
  }

  async receiveTransfer(
    input: TransferReceiveInput,
    userContext?: UserPermissionContext
  ): Promise<Transfer> {
    if (userContext && !this.hasPermission(userContext, 'inventory.transfer.receive')) {
      throw new Error('No tiene permiso para recibir transferencias')
    }

    const validated = transferReceiveSchema.parse(input)
    const existing = await transferRepository.findById(validated.transferId)
    if (!existing) {
      throw new Error(`Transferencia ${validated.transferId} no encontrada`)
    }

    // Validar bodega autorizada para recibir
    if (
      userContext &&
      userContext.userRole !== 'ADMIN' &&
      userContext.assignedLocationId &&
      userContext.assignedLocationId !== existing.destinationLocationId
    ) {
      throw new Error('Solo el personal de la bodega de destino puede confirmar la recepción')
    }

    const receiver = {
      userId: userContext?.userId || 'user-receive',
      userName:
        userContext?.userRole === 'SELLER'
          ? 'Carlos Mario Ruiz'
          : userContext?.userRole === 'WAREHOUSE_MANAGER'
          ? 'Daniel Restrepo'
          : 'Ana María Orozco',
    }

    return transferRepository.receive(validated, receiver)
  }

  async rejectTransfer(
    input: TransferRejectInput,
    userContext?: UserPermissionContext
  ): Promise<Transfer> {
    if (userContext && !this.hasPermission(userContext, 'inventory.transfer.reject')) {
      throw new Error('No tiene permiso para rechazar o cancelar transferencias')
    }

    const validated = transferRejectSchema.parse(input)
    const rejector = {
      userId: userContext?.userId || 'user-reject',
      userName: 'Mauricio Arango',
    }

    return transferRepository.reject(validated, rejector)
  }

  getFlowEdges(transfers: Transfer[]): TransferFlowEdge[] {
    return transfers.map((t) => ({
      id: `edge-${t.id}`,
      originLocationName: t.originLocationName,
      originLocationCode: t.originLocationCode,
      destinationLocationName: t.destinationLocationName,
      destinationLocationCode: t.destinationLocationCode,
      units: t.status === 'RECEIVED' ? t.totalUnitsReceived : t.totalUnitsDispatched || t.totalUnitsRequested,
      itemsCount: t.totalItemsCount,
      status: t.status,
      transferCode: t.code,
      transferId: t.id,
      updatedAt: t.updatedAt,
    }))
  }

  exportToCsv(transfers: Transfer[], isCostRedacted: boolean): string {
    const headers = [
      'Código',
      'Estado',
      'Fecha Creación',
      'Bodega Origen',
      'Código Origen',
      'Bodega Destino',
      'Código Destino',
      'Total Items',
      'Unidades Solicitadas',
      'Unidades Despachadas',
      'Unidades Recibidas',
      'Valor Total a Costo',
      'Creado Por',
      'Despachado Por',
      'Recibido Por',
      'Motivo',
      'Referencia Interna',
      'Tiene Novedad',
      'Notas Novedad',
      'Observaciones',
    ]

    const rows = transfers.map((t) => [
      `"${t.code}"`,
      `"${t.status}"`,
      `"${t.createdAt}"`,
      `"${t.originLocationName.replace(/"/g, '""')}"`,
      `"${t.originLocationCode}"`,
      `"${t.destinationLocationName.replace(/"/g, '""')}"`,
      `"${t.destinationLocationCode}"`,
      t.totalItemsCount,
      t.totalUnitsRequested,
      t.totalUnitsDispatched,
      t.totalUnitsReceived,
      isCostRedacted ? '"••••••••"' : t.totalValueAtCost,
      `"${t.createdByUserName.replace(/"/g, '""')}"`,
      `"${(t.dispatchedByUserName || '').replace(/"/g, '""')}"`,
      `"${(t.receivedByUserName || '').replace(/"/g, '""')}"`,
      `"${(t.reason || '').replace(/"/g, '""')}"`,
      `"${(t.internalReference || '').replace(/"/g, '""')}"`,
      t.hasIncident ? '"SI"' : '"NO"',
      `"${(t.incidentNotes || '').replace(/"/g, '""')}"`,
      `"${(t.notes || '').replace(/"/g, '""')}"`,
    ])

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  }
}

export const transferService = new TransferService()
