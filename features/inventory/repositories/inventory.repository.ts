import {
  InventoryStockLevel,
  ConsolidatedProductStock,
  InventoryFilterParams,
  InventoryKPIs,
  StockAdjustmentInput,
  ThresholdUpdateInput,
  StockHealthStatus,
  LocationStockBreakdown,
} from '../types'
import { INVENTORY_STOCK_LEVELS_MOCK } from '../mocks/inventory.mock'

export class InventoryRepository {
  private stockLevels: InventoryStockLevel[]

  constructor() {
    this.stockLevels = JSON.parse(JSON.stringify(INVENTORY_STOCK_LEVELS_MOCK))
  }

  /**
   * Determine stock health dynamically based on current, min, and critical stock
   */
  public calculateStockHealth(
    current: number,
    min: number,
    critical: number
  ): StockHealthStatus {
    if (current <= 0) return 'OUT_OF_STOCK'
    if (current <= critical) return 'CRITICAL'
    if (current <= min) return 'LOW_STOCK'
    return 'AVAILABLE'
  }

  /**
   * Get filtered stock levels (By Location view)
   */
  public async getStockLevelsByLocation(
    params: InventoryFilterParams
  ): Promise<{ data: InventoryStockLevel[]; total: number }> {
    let list = [...this.stockLevels]

    // 1. Text Search (Name, SKU, Barcode)
    if (params.query && params.query.trim() !== '') {
      const q = params.query.toLowerCase().trim()
      list = list.filter(
        (item) =>
          item.productName.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          (item.barcode && item.barcode.toLowerCase().includes(q))
      )
    }

    // 2. Location filter
    if (params.locationId && params.locationId !== 'ALL') {
      list = list.filter((item) => item.locationId === params.locationId)
    }

    // 3. Category filter
    if (params.category && params.category !== 'ALL') {
      list = list.filter((item) => item.category === params.category)
    }

    // 4. Brand filter
    if (params.brand && params.brand !== 'ALL') {
      list = list.filter((item) => item.brand === params.brand)
    }

    // 5. Stock Health / Tab filter
    const activeTab = params.tab && params.tab !== 'ALL' ? params.tab : params.stockHealth
    if (activeTab && activeTab !== 'ALL') {
      list = list.filter((item) => item.stockHealth === activeTab)
    }

    // 6. Has Stock presence
    if (params.hasStock === 'WITH_STOCK') {
      list = list.filter((item) => item.currentStock > 0)
    } else if (params.hasStock === 'ZERO_STOCK') {
      list = list.filter((item) => item.currentStock === 0)
    }

    // 7. Sorting
    const sortField = params.sortField || 'productName'
    const sortDir = params.sortDirection === 'desc' ? -1 : 1

    list.sort((a, b) => {
      let valA: any = a[sortField as keyof InventoryStockLevel] ?? ''
      let valB: any = b[sortField as keyof InventoryStockLevel] ?? ''

      if (typeof valA === 'string') {
        return valA.localeCompare(valB) * sortDir
      }
      return (valA - valB) * sortDir
    })

    const total = list.length
    const page = params.page || 1
    const pageSize = params.pageSize || 10
    const start = (page - 1) * pageSize
    const paginated = list.slice(start, start + pageSize)

    return { data: paginated, total }
  }

  /**
   * Get consolidated stock per product across all locations
   */
  public async getConsolidatedStock(
    params: InventoryFilterParams
  ): Promise<{ data: ConsolidatedProductStock[]; total: number }> {
    // Group all stockLevels by productId
    const grouped = new Map<string, InventoryStockLevel[]>()
    for (const item of this.stockLevels) {
      const existing = grouped.get(item.productId) || []
      existing.push(item)
      grouped.set(item.productId, existing)
    }

    let consolidatedList: ConsolidatedProductStock[] = []

    for (const [prodId, items] of grouped.entries()) {
      const first = items[0]
      const totalStock = items.reduce((sum, i) => sum + i.currentStock, 0)
      const totalValueAtCost = items.reduce((sum, i) => sum + i.totalValueAtCost, 0)
      const minStockConsolidated = items.reduce((sum, i) => sum + i.minStock, 0)
      const criticalStockConsolidated = items.reduce((sum, i) => sum + i.criticalStock, 0)
      const averageCost = first.averageCost

      const overallHealth = this.calculateStockHealth(
        totalStock,
        minStockConsolidated,
        criticalStockConsolidated
      )

      const locationBreakdown: LocationStockBreakdown[] = items.map((i) => ({
        locationId: i.locationId,
        locationName: i.locationName,
        locationCode: i.locationCode,
        stock: i.currentStock,
        minStock: i.minStock,
        criticalStock: i.criticalStock,
        health: i.stockHealth,
        averageCost: i.averageCost,
        valueAtCost: i.totalValueAtCost,
        lastMovementAt: i.lastMovementAt,
        lastMovementDoc: i.lastMovementDoc,
      }))

      // Find latest movement
      const sortedByMovement = [...items].sort((a, b) => {
        const dateA = a.lastMovementAt ? new Date(a.lastMovementAt).getTime() : 0
        const dateB = b.lastMovementAt ? new Date(b.lastMovementAt).getTime() : 0
        return dateB - dateA
      })

      consolidatedList.push({
        productId: prodId,
        productName: first.productName,
        sku: first.sku,
        barcode: first.barcode,
        category: first.category,
        brand: first.brand,
        unitOfMeasure: first.unitOfMeasure,
        imageUrl: first.imageUrl,
        totalStock,
        totalValueAtCost,
        averageCost,
        overallHealth,
        minStockConsolidated,
        criticalStockConsolidated,
        locationsCount: items.length,
        locationBreakdown,
        lastMovementAt: sortedByMovement[0]?.lastMovementAt,
        lastMovementType: sortedByMovement[0]?.lastMovementType,
        lastMovementDoc: sortedByMovement[0]?.lastMovementDoc,
      })
    }

    // Apply filters on consolidated list
    if (params.query && params.query.trim() !== '') {
      const q = params.query.toLowerCase().trim()
      consolidatedList = consolidatedList.filter(
        (c) =>
          c.productName.toLowerCase().includes(q) ||
          c.sku.toLowerCase().includes(q) ||
          (c.barcode && c.barcode.toLowerCase().includes(q))
      )
    }

    if (params.locationId && params.locationId !== 'ALL') {
      consolidatedList = consolidatedList.filter((c) =>
        c.locationBreakdown.some((l) => l.locationId === params.locationId)
      )
    }

    if (params.category && params.category !== 'ALL') {
      consolidatedList = consolidatedList.filter((c) => c.category === params.category)
    }

    if (params.brand && params.brand !== 'ALL') {
      consolidatedList = consolidatedList.filter((c) => c.brand === params.brand)
    }

    const activeTab = params.tab && params.tab !== 'ALL' ? params.tab : params.stockHealth
    if (activeTab && activeTab !== 'ALL') {
      consolidatedList = consolidatedList.filter((c) => c.overallHealth === activeTab)
    }

    if (params.hasStock === 'WITH_STOCK') {
      consolidatedList = consolidatedList.filter((c) => c.totalStock > 0)
    } else if (params.hasStock === 'ZERO_STOCK') {
      consolidatedList = consolidatedList.filter((c) => c.totalStock === 0)
    }

    // Sorting
    const sortField = params.sortField || 'productName'
    const sortDir = params.sortDirection === 'desc' ? -1 : 1

    consolidatedList.sort((a, b) => {
      let valA: any = a[sortField as keyof ConsolidatedProductStock] ?? ''
      let valB: any = b[sortField as keyof ConsolidatedProductStock] ?? ''

      if (typeof valA === 'string') {
        return valA.localeCompare(valB) * sortDir
      }
      return (valA - valB) * sortDir
    })

    const total = consolidatedList.length
    const page = params.page || 1
    const pageSize = params.pageSize || 10
    const start = (page - 1) * pageSize
    const paginated = consolidatedList.slice(start, start + pageSize)

    return { data: paginated, total }
  }

  /**
   * Get operational KPIs
   */
  public async getKPIs(): Promise<InventoryKPIs> {
    const totalValueAtCost = this.stockLevels.reduce(
      (sum, item) => sum + item.totalValueAtCost,
      0
    )
    const totalUnitsAvailable = this.stockLevels.reduce(
      (sum, item) => sum + item.currentStock,
      0
    )

    // Consolidated unique products count
    const uniqueProducts = new Set(this.stockLevels.map((i) => i.productId))
    let productsWithStockCount = 0

    for (const prodId of uniqueProducts) {
      const totalStock = this.stockLevels
        .filter((i) => i.productId === prodId)
        .reduce((sum, i) => sum + i.currentStock, 0)
      if (totalStock > 0) {
        productsWithStockCount++
      }
    }

    // Count stock health breakdown
    const lowStockCount = this.stockLevels.filter(
      (i) => i.stockHealth === 'LOW_STOCK'
    ).length
    const criticalStockCount = this.stockLevels.filter(
      (i) => i.stockHealth === 'CRITICAL'
    ).length
    const outOfStockCount = this.stockLevels.filter(
      (i) => i.stockHealth === 'OUT_OF_STOCK'
    ).length

    return {
      totalValueAtCost,
      totalUnitsAvailable,
      productsWithStock: productsWithStockCount,
      lowStockCount,
      criticalStockCount,
      outOfStockCount,
      isCostRedacted: false,
    }
  }

  /**
   * Adjust stock for a product in a location
   */
  public async adjustStock(
    input: StockAdjustmentInput
  ): Promise<{ previousStock: number; resultingStock: number; updatedItem: InventoryStockLevel }> {
    const itemIndex = this.stockLevels.findIndex(
      (i) => i.productId === input.productId && i.locationId === input.locationId
    )

    if (itemIndex === -1) {
      throw new Error('No se encontró el registro de stock para el producto en la bodega indicada')
    }

    const current = this.stockLevels[itemIndex]
    const previousStock = current.currentStock
    let resultingStock = previousStock

    if (input.type === 'IN') {
      resultingStock = previousStock + input.quantity
    } else {
      if (input.quantity > previousStock) {
        throw new Error(
          `No se puede realizar un ajuste de salida de ${input.quantity} unidades porque el saldo actual es de ${previousStock} unidades.`
        )
      }
      resultingStock = previousStock - input.quantity
    }

    const health = this.calculateStockHealth(
      resultingStock,
      current.minStock,
      current.criticalStock
    )

    const updatedItem: InventoryStockLevel = {
      ...current,
      currentStock: resultingStock,
      totalValueAtCost: resultingStock * current.averageCost,
      stockHealth: health,
      lastMovementAt: new Date().toISOString(),
      lastMovementType: input.type === 'IN' ? 'AJUSTE_ENTRADA' : 'AJUSTE_SALIDA',
      lastMovementDoc: `AJ-${Math.floor(10000 + Math.random() * 90000)}`,
    }

    this.stockLevels[itemIndex] = updatedItem

    return { previousStock, resultingStock, updatedItem }
  }

  /**
   * Update thresholds (min / critical / reorder)
   */
  public async updateThresholds(
    input: ThresholdUpdateInput
  ): Promise<InventoryStockLevel> {
    const itemIndex = this.stockLevels.findIndex(
      (i) => i.productId === input.productId && i.locationId === input.locationId
    )

    if (itemIndex === -1) {
      throw new Error('Producto no encontrado en la bodega seleccionada')
    }

    const current = this.stockLevels[itemIndex]
    const health = this.calculateStockHealth(
      current.currentStock,
      input.minStock,
      input.criticalStock
    )

    const updated: InventoryStockLevel = {
      ...current,
      minStock: input.minStock,
      criticalStock: input.criticalStock,
      reorderPoint: input.reorderPoint ?? current.reorderPoint,
      stockHealth: health,
    }

    this.stockLevels[itemIndex] = updated
    return updated
  }
}

export const inventoryRepository = new InventoryRepository()
