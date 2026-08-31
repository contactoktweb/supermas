import {
  InventoryMovement,
  KardexFilterParams,
  GlobalKardexStats,
  KardexPaginationResult,
  ProductKardexSummary,
  UserPermissionContext,
} from '../types'
import { kardexRepository } from '../repositories/kardex.repository'
import {
  kardexFilterSchema,
  createReversionMovementSchema,
  CreateReversionMovementInput,
} from '../schemas/kardex.schema'

export class KardexService {
  /**
   * Valida si el usuario tiene un permiso específico.
   */
  hasPermission(
    userContext?: UserPermissionContext,
    requiredPermission: string = 'kardex.read'
  ): boolean {
    if (!userContext) return true // Superadmin default
    if (userContext.userRole === 'ADMIN') return true
    return userContext.permissions.includes(requiredPermission)
  }

  /**
   * Sanitiza y oculta costos financieros de los movimientos para usuarios sin permiso cost.read.
   */
  sanitizeMovementForUser(
    movement: InventoryMovement,
    canReadCost: boolean
  ): InventoryMovement {
    if (canReadCost) return movement

    return {
      ...movement,
      unitCost: 0,
      averageCostAfter: 0,
      totalValue: 0,
    }
  }

  /**
   * Lista movimientos de Kardex con filtros, ordenamiento, paginación y seguridad RBAC.
   */
  async listMovements(
    rawFilters: KardexFilterParams = {},
    userContext?: UserPermissionContext
  ): Promise<KardexPaginationResult> {
    const validatedFilters = kardexFilterSchema.parse(rawFilters)

    // Si el usuario está restringido a una sola sede física, forzar el filtro
    let locationId = validatedFilters.locationId
    if (
      userContext &&
      userContext.userRole !== 'ADMIN' &&
      userContext.assignedLocationId
    ) {
      locationId = userContext.assignedLocationId
    }

    const canReadCost = this.hasPermission(userContext, 'cost.read')

    const result = await kardexRepository.findMany({
      ...validatedFilters,
      locationId,
    })

    const sanitizedItems = result.items.map((m) =>
      this.sanitizeMovementForUser(m, canReadCost)
    )

    return {
      ...result,
      items: sanitizedItems,
      isCostRedacted: !canReadCost,
    }
  }

  /**
   * Obtiene un movimiento específico para el drawer de detalle.
   */
  async getMovementById(
    id: string,
    userContext?: UserPermissionContext
  ): Promise<InventoryMovement | null> {
    const movement = await kardexRepository.findById(id)
    if (!movement) return null

    const canReadCost = this.hasPermission(userContext, 'cost.read')
    return this.sanitizeMovementForUser(movement, canReadCost)
  }

  /**
   * Resumen de stock y Kardex de un producto específico.
   */
  async getProductKardexSummary(
    productId: string
  ): Promise<ProductKardexSummary | null> {
    return kardexRepository.findProductKardexSummary(productId)
  }

  /**
   * Obtiene estadísticas globales de movimientos con control de acceso financiero.
   */
  async getGlobalStats(
    filters?: KardexFilterParams,
    userContext?: UserPermissionContext
  ): Promise<GlobalKardexStats> {
    const canReadCost = this.hasPermission(userContext, 'cost.read')
    const stats = await kardexRepository.getGlobalStats(filters)

    if (!canReadCost) {
      return {
        ...stats,
        totalValueInAtCost: 0,
        totalValueOutAtCost: 0,
        isCostRedacted: true,
      }
    }

    return stats
  }

  /**
   * Crea una reversión de movimiento respetando la inmutabilidad histórica.
   */
  async createReversion(
    input: CreateReversionMovementInput,
    userContext?: UserPermissionContext
  ): Promise<InventoryMovement> {
    const validated = createReversionMovementSchema.parse(input)
    const userName = userContext?.userId ? `Usuario (${userContext.userRole})` : 'Administrador del Sistema'
    const userRole = userContext?.userRole || 'ADMIN'

    return kardexRepository.createReversion(
      validated.originalMovementId,
      validated.reason,
      userName,
      userRole
    )
  }

  /**
   * Agrupa movimientos por fecha para la vista interactiva de Línea de Tiempo.
   */
  groupMovementsByDate(
    movements: InventoryMovement[]
  ): { dateLabel: string; items: InventoryMovement[] }[] {
    const groups: Record<string, InventoryMovement[]> = {}

    const todayStr = new Date().toISOString().slice(0, 10)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().slice(0, 10)

    movements.forEach((m) => {
      const datePart = m.createdAt.slice(0, 10)
      let label = datePart

      if (datePart === todayStr) {
        label = 'Hoy'
      } else if (datePart === yesterdayStr) {
        label = 'Ayer'
      } else {
        const d = new Date(m.createdAt)
        label = d.toLocaleDateString('es-CO', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      }

      if (!groups[label]) {
        groups[label] = []
      }
      groups[label].push(m)
    })

    return Object.entries(groups).map(([dateLabel, items]) => ({
      dateLabel,
      items,
    }))
  }

  /**
   * Exporta movimientos a formato CSV delimitado por comas respetando la privacidad RBAC.
   */
  exportToCsv(movements: InventoryMovement[], isCostRedacted: boolean): string {
    const headers = [
      'ID Movimiento',
      'Fecha y Hora',
      'Producto',
      'SKU',
      'Bodega',
      'Tipo de Movimiento',
      'Documento Origen',
      'Entrada',
      'Salida',
      'Saldo Anterior',
      'Saldo Resultante',
      'Costo Unitario',
      'Costo Promedio',
      'Valor Total',
      'Responsable',
      'Notas',
    ]

    const rows = movements.map((m) => [
      `"${m.movementNumber}"`,
      `"${m.createdAt}"`,
      `"${m.productName.replace(/"/g, '""')}"`,
      `"${m.sku}"`,
      `"${m.locationName.replace(/"/g, '""')}"`,
      `"${m.type}"`,
      `"${m.sourceDocumentNumber}"`,
      m.quantityIn,
      m.quantityOut,
      m.previousStock,
      m.resultingStock,
      isCostRedacted ? '"••••••••"' : m.unitCost,
      isCostRedacted ? '"••••••••"' : m.averageCostAfter,
      isCostRedacted ? '"••••••••"' : m.totalValue,
      `"${m.userName.replace(/"/g, '""')}"`,
      `"${(m.notes || '').replace(/"/g, '""')}"`,
    ])

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  }
}

export const kardexService = new KardexService()
