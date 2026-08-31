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
} from '../types'
import {
  transferCreateSchema,
  transferDispatchSchema,
  transferReceiveSchema,
  transferRejectSchema,
  transferFilterSchema,
} from '../schemas/transfer.schema'
import { transferRepository } from '../repositories/transfer.repository'
import { AVAILABLE_PRODUCTS_FOR_TRANSFER } from '../mocks/transfers.mock'

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

  async getAvailableProductsForTransfer(originLocationId: string) {
    return AVAILABLE_PRODUCTS_FOR_TRANSFER.map((p) => ({
      productId: p.productId,
      productName: p.productName,
      sku: p.sku,
      barcode: p.barcode,
      category: p.category,
      unitOfMeasure: p.unitOfMeasure,
      imageUrl: p.imageUrl,
      availableStock: p.stocksByLocation[originLocationId] || 0,
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

    // Validar disponibilidad de stock en el origen para cada producto
    for (const item of validated.items) {
      const prod = AVAILABLE_PRODUCTS_FOR_TRANSFER.find((p) => p.productId === item.productId)
      const stockInOrigin = prod?.stocksByLocation[validated.originLocationId] ?? 0
      if (item.units > stockInOrigin) {
        throw new Error(
          `Stock insuficiente para ${prod?.productName || item.productId}: solicita ${item.units} uds pero solo hay ${stockInOrigin} uds disponibles en la bodega de origen`
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
    for (const item of existing.items) {
      const prod = AVAILABLE_PRODUCTS_FOR_TRANSFER.find((p) => p.productId === item.productId)
      const currentStock = prod?.stocksByLocation[existing.originLocationId] ?? 0
      if (item.requestedUnits > currentStock) {
        throw new Error(
          `Conflicto de concurrencia: el stock actual en origen para ${item.productName} (${currentStock}) es inferior a las unidades solicitadas (${item.requestedUnits})`
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
      t.hasIncident ? '"SI"' : '"NO"',
      `"${(t.incidentNotes || '').replace(/"/g, '""')}"`,
      `"${(t.notes || '').replace(/"/g, '""')}"`,
    ])

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  }
}

export const transferService = new TransferService()
