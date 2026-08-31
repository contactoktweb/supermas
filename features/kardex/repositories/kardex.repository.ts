import {
  InventoryMovement,
  KardexFilterParams,
  GlobalKardexStats,
  KardexPaginationResult,
  ProductKardexSummary,
} from '../types'
import { INVENTORY_MOVEMENTS_MOCK } from '../mocks/kardex.mock'

export class KardexRepository {
  private movements: InventoryMovement[] = [...INVENTORY_MOVEMENTS_MOCK]

  /**
   * Consulta paginada y filtrada de movimientos de inventario (Kardex).
   */
  async findMany(filters: KardexFilterParams): Promise<KardexPaginationResult> {
    let filtered = [...this.movements]

    // 1. Filtro por texto general (Producto, SKU, Código, Documento, Usuario)
    if (filters.query && filters.query.trim() !== '') {
      const q = filters.query.toLowerCase().trim()
      filtered = filtered.filter(
        (m) =>
          m.productName.toLowerCase().includes(q) ||
          m.sku.toLowerCase().includes(q) ||
          (m.barcode && m.barcode.includes(q)) ||
          m.sourceDocumentNumber.toLowerCase().includes(q) ||
          m.userName.toLowerCase().includes(q) ||
          m.locationName.toLowerCase().includes(q) ||
          m.locationCode.toLowerCase().includes(q) ||
          (m.notes && m.notes.toLowerCase().includes(q))
      )
    }

    // 2. Filtro estricto por Producto
    if (filters.productId && filters.productId.trim() !== '' && filters.productId !== 'ALL') {
      filtered = filtered.filter((m) => m.productId === filters.productId)
    }

    // 3. Filtro por SKU
    if (filters.sku && filters.sku.trim() !== '') {
      filtered = filtered.filter((m) => m.sku.toLowerCase() === filters.sku!.toLowerCase().trim())
    }

    // 4. Filtro por Bodega / Ubicación
    if (filters.locationId && filters.locationId !== 'ALL') {
      filtered = filtered.filter((m) => m.locationId === filters.locationId)
    }

    // 5. Filtro por Tipo de Movimiento
    if (filters.movementType && filters.movementType !== 'ALL') {
      filtered = filtered.filter((m) => m.type === filters.movementType)
    }

    // 6. Filtro por Usuario
    if (filters.userId && filters.userId !== 'ALL') {
      filtered = filtered.filter((m) => m.userId === filters.userId || m.userName === filters.userId)
    }

    // 7. Filtro por Documento Específico
    if (filters.documentQuery && filters.documentQuery.trim() !== '') {
      const docQ = filters.documentQuery.toLowerCase().trim()
      filtered = filtered.filter((m) =>
        m.sourceDocumentNumber.toLowerCase().includes(docQ)
      )
    }

    // 8. Filtro por Rango de Fechas
    if (filters.startDate) {
      const start = new Date(filters.startDate).getTime()
      filtered = filtered.filter((m) => new Date(m.createdAt).getTime() >= start)
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate)
      end.setHours(23, 59, 59, 999)
      filtered = filtered.filter((m) => new Date(m.createdAt).getTime() <= end.getTime())
    }

    // 9. Ordenamiento
    const sortField = filters.sortField || 'createdAt'
    const sortDir = filters.sortDirection || 'desc'
    const mult = sortDir === 'asc' ? 1 : -1

    filtered.sort((a, b) => {
      switch (sortField) {
        case 'createdAt':
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * mult
        case 'productName':
          return a.productName.localeCompare(b.productName) * mult
        case 'sku':
          return a.sku.localeCompare(b.sku) * mult
        case 'locationName':
          return a.locationName.localeCompare(b.locationName) * mult
        case 'type':
          return a.type.localeCompare(b.type) * mult
        case 'quantityIn':
          return (a.quantityIn - b.quantityIn) * mult
        case 'quantityOut':
          return (a.quantityOut - b.quantityOut) * mult
        case 'resultingStock':
          return (a.resultingStock - b.resultingStock) * mult
        case 'totalValue':
          return (a.totalValue - b.totalValue) * mult
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

  /**
   * Obtiene un movimiento por su ID único.
   */
  async findById(id: string): Promise<InventoryMovement | null> {
    const found = this.movements.find((m) => m.id === id)
    return found ? { ...found } : null
  }

  /**
   * Resumen de Kardex para un producto específico (para vista /kardex?productId=...).
   */
  async findProductKardexSummary(productId: string): Promise<ProductKardexSummary | null> {
    const productMovements = this.movements.filter((m) => m.productId === productId)
    if (productMovements.length === 0) return null

    const latest = productMovements.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0]

    // Agrupar existencias por bodega
    const distributionMap: Record<string, { name: string; code: string; stock: number }> = {}

    // Tomar el movimiento más reciente de cada bodega para obtener el resultingStock
    productMovements.forEach((m) => {
      if (!distributionMap[m.locationId]) {
        distributionMap[m.locationId] = {
          name: m.locationName,
          code: m.locationCode,
          stock: m.resultingStock,
        }
      }
    })

    const warehousesDistribution = Object.entries(distributionMap).map(
      ([locId, data]) => ({
        locationId: locId,
        locationName: data.name,
        locationCode: data.code,
        stock: data.stock,
      })
    )

    const totalStock = warehousesDistribution.reduce((acc, w) => acc + w.stock, 0)

    return {
      productId: latest.productId,
      productName: latest.productName,
      sku: latest.sku,
      category: latest.category,
      imageUrl: latest.imageUrl,
      totalStockAllWarehouses: totalStock,
      unitOfMeasure: latest.unitOfMeasure,
      warehousesDistribution,
      lastMovementAt: latest.createdAt,
      lastMovementType: latest.type,
    }
  }

  /**
   * Estadísticas globales de movimientos del periodo.
   */
  async getGlobalStats(filters?: KardexFilterParams): Promise<GlobalKardexStats> {
    let items = [...this.movements]

    if (filters?.locationId && filters.locationId !== 'ALL') {
      items = items.filter((m) => m.locationId === filters.locationId)
    }
    if (filters?.productId && filters.productId !== 'ALL') {
      items = items.filter((m) => m.productId === filters.productId)
    }

    const totalMovements = items.length
    const entries = items.filter((m) => m.quantityIn > 0)
    const exits = items.filter((m) => m.quantityOut > 0)

    const totalEntriesCount = entries.length
    const totalExitsCount = exits.length
    const totalUnitsIn = entries.reduce((acc, m) => acc + m.quantityIn, 0)
    const totalUnitsOut = exits.reduce((acc, m) => acc + m.quantityOut, 0)
    const totalValueInAtCost = entries.reduce((acc, m) => acc + m.totalValue, 0)
    const totalValueOutAtCost = exits.reduce((acc, m) => acc + m.totalValue, 0)

    return {
      totalMovements,
      totalEntriesCount,
      totalExitsCount,
      totalUnitsIn,
      totalUnitsOut,
      totalValueInAtCost,
      totalValueOutAtCost,
      isCostRedacted: false,
    }
  }

  /**
   * Registra una reversión compensatoria inmutable vinculada al movimiento original.
   */
  async createReversion(
    originalMovementId: string,
    reason: string,
    userName: string,
    userRole: string
  ): Promise<InventoryMovement> {
    const original = await this.findById(originalMovementId)
    if (!original) {
      throw new Error(`El movimiento ${originalMovementId} no existe en el Kardex`)
    }

    const isOriginalEntry = original.quantityIn > 0
    const qty = isOriginalEntry ? original.quantityIn : original.quantityOut

    const previousStock = original.resultingStock
    const resultingStock = isOriginalEntry
      ? previousStock - qty
      : previousStock + qty

    const now = new Date().toISOString()
    const revNumber = `REV-${Date.now().toString().slice(-4)}`

    const newMovement: InventoryMovement = {
      id: `mov-rev-${Date.now()}`,
      movementNumber: `MOV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
      createdAt: now,
      productId: original.productId,
      productName: original.productName,
      sku: original.sku,
      barcode: original.barcode,
      category: original.category,
      unitOfMeasure: original.unitOfMeasure,
      imageUrl: original.imageUrl,
      locationId: original.locationId,
      locationName: original.locationName,
      locationCode: original.locationCode,
      type: 'REVERSION',
      quantityIn: isOriginalEntry ? 0 : qty,
      quantityOut: isOriginalEntry ? qty : 0,
      quantityDelta: isOriginalEntry ? -qty : qty,
      previousStock,
      resultingStock,
      unitCost: original.unitCost,
      averageCostAfter: original.averageCostAfter,
      totalValue: original.unitCost * qty,
      sourceDocumentType: 'REVERSION_ENTRY',
      sourceDocumentId: `rev-doc-${Date.now()}`,
      sourceDocumentNumber: revNumber,
      userId: `user-rev-${Date.now().toString().slice(-3)}`,
      userName,
      userRole,
      notes: `Reversión de ${original.sourceDocumentNumber}. Motivo: ${reason}`,
      isReversion: true,
      originalMovementId: original.id,
    }

    this.movements.unshift(newMovement)
    return newMovement
  }
}

export const kardexRepository = new KardexRepository()
