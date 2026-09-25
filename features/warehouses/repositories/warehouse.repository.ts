import {
  LocationWithMetrics,
  WarehouseFilters,
  WarehouseInventoryItem,
  WarehouseMovement,
  WarehouseSaleRecord,
  WarehousePurchaseRecord,
  CustomerLocationRelation,
  SupplierLocationRelation,
  WarehouseTransfer,
  WarehouseUserAssignment,
  WarehouseAuditLog,
} from '../types'
import { supabaseClient, supabaseMock } from '@/lib/supabase'

class WarehouseRepository {
  private locations: LocationWithMetrics[] = []
  private inventory: WarehouseInventoryItem[] = []
  private movements: WarehouseMovement[] = []
  private sales: WarehouseSaleRecord[] = []
  private purchases: WarehousePurchaseRecord[] = []
  private customers: CustomerLocationRelation[] = []
  private suppliers: SupplierLocationRelation[] = []
  private transfers: WarehouseTransfer[] = []
  private users: WarehouseUserAssignment[] = []
  private auditLogs: WarehouseAuditLog[] = []

  async findAll(filters?: WarehouseFilters): Promise<{ data: LocationWithMetrics[]; total: number }> {
    let result = [...this.locations]

    if (filters?.query) {
      const q = filters.query.toLowerCase().trim()
      result = result.filter(
        (loc) =>
          loc.name.toLowerCase().includes(q) ||
          loc.code.toLowerCase().includes(q) ||
          loc.address.toLowerCase().includes(q) ||
          loc.city.toLowerCase().includes(q) ||
          loc.managerName?.toLowerCase().includes(q)
      )
    }

    if (filters?.type && filters.type !== 'ALL') {
      result = result.filter((loc) => loc.type === filters.type)
    }

    if (filters?.status && filters.status !== 'ALL') {
      result = result.filter((loc) => loc.status === filters.status)
    }

    if (filters?.inventoryHealth && filters.inventoryHealth !== 'ALL') {
      if (filters.inventoryHealth === 'LOW_STOCK') {
        result = result.filter((loc) => loc.lowStockProductsCount > 0)
      } else if (filters.inventoryHealth === 'OUT_OF_STOCK') {
        result = result.filter((loc) => loc.outOfStockProductsCount > 0)
      } else if (filters.inventoryHealth === 'CRITICAL') {
        result = result.filter(
          (loc) => loc.lowStockProductsCount > 20 || loc.outOfStockProductsCount > 5
        )
      } else if (filters.inventoryHealth === 'NORMAL') {
        result = result.filter(
          (loc) => loc.lowStockProductsCount === 0 && loc.outOfStockProductsCount === 0
        )
      }
    }

    if (filters?.sortBy) {
      switch (filters.sortBy) {
        case 'NAME_ASC':
          result.sort((a, b) => a.name.localeCompare(b.name))
          break
        case 'NAME_DESC':
          result.sort((a, b) => b.name.localeCompare(a.name))
          break
        case 'INVENTORY_DESC':
          result.sort((a, b) => b.inventoryValueAtCost - a.inventoryValueAtCost)
          break
        case 'INVENTORY_ASC':
          result.sort((a, b) => a.inventoryValueAtCost - b.inventoryValueAtCost)
          break
        case 'SALES_DESC':
          result.sort((a, b) => b.todaySalesAmount - a.todaySalesAmount)
          break
        case 'ALERTS_DESC':
          result.sort((a, b) => b.activeAlertsCount - a.activeAlertsCount)
          break
      }
    }

    const total = result.length
    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 10
    const start = (page - 1) * pageSize
    const paginated = result.slice(start, start + pageSize)

    return { data: paginated, total }
  }

  async findById(id: string): Promise<LocationWithMetrics | null> {
    const loc = this.locations.find((l) => l.id === id)
    return loc ? { ...loc } : null
  }

  async findByCode(code: string): Promise<LocationWithMetrics | null> {
    const loc = this.locations.find((l) => l.code.toUpperCase() === code.toUpperCase().trim())
    return loc ? { ...loc } : null
  }

  async create(location: LocationWithMetrics): Promise<LocationWithMetrics> {
    if (location.settings.isEcommerceProcessingSource) {
      // Ensure only 1 warehouse is ecommerce source
      this.locations.forEach((loc) => {
        loc.settings.isEcommerceProcessingSource = false
      })
    }
    this.locations.unshift(location)
    return { ...location }
  }

  async update(id: string, updates: Partial<LocationWithMetrics>): Promise<LocationWithMetrics> {
    const index = this.locations.findIndex((l) => l.id === id)
    if (index === -1) {
      throw new Error(`Ubicación no encontrada: ${id}`)
    }

    if (updates.settings?.isEcommerceProcessingSource) {
      this.locations.forEach((loc) => {
        if (loc.id !== id) {
          loc.settings.isEcommerceProcessingSource = false
        }
      })
    }

    this.locations[index] = {
      ...this.locations[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    return { ...this.locations[index] }
  }

  async deactivate(id: string): Promise<LocationWithMetrics> {
    const location = await this.findById(id)
    if (!location) {
      throw new Error('Ubicación no encontrada')
    }

    return this.update(id, {
      status: 'INACTIVE',
      settings: {
        ...location.settings,
        allowInventoryOperations: false,
        allowSales: false,
        allowPurchases: false,
        allowTransfers: false,
        isEcommerceProcessingSource: false,
      },
    })
  }

  async findInventoryByLocationId(
    locationId: string,
    filters?: { query?: string; status?: string; category?: string }
  ): Promise<WarehouseInventoryItem[]> {
    let items = this.inventory.filter((inv) => inv.locationId === locationId)

    if (filters?.query) {
      const q = filters.query.toLowerCase()
      items = items.filter(
        (i) =>
          i.productName.toLowerCase().includes(q) ||
          i.sku.toLowerCase().includes(q) ||
          i.barcode.includes(q)
      )
    }

    if (filters?.status && filters.status !== 'ALL') {
      items = items.filter((i) => i.status === filters.status)
    }

    if (filters?.category && filters.category !== 'ALL') {
      items = items.filter((i) => i.category.toLowerCase() === filters.category?.toLowerCase())
    }

    return items
  }

  async findMovementsByLocationId(
    locationId: string,
    filters?: { productId?: string; type?: string; query?: string }
  ): Promise<WarehouseMovement[]> {
    let items = this.movements.filter((m) => m.locationId === locationId)

    if (items.length === 0 && this.movements.length > 0) {
      const baseMovs = this.movements.filter((m) => m.locationId === 'loc-001')
      const templateMovs = baseMovs.length > 0 ? baseMovs : this.movements
      const seeded: WarehouseMovement[] = templateMovs.map((m, idx) => ({
        ...m,
        id: `mov-${locationId}-${idx + 1}`,
        locationId,
      }))
      this.movements.push(...seeded)
      items = seeded
    }

    if (filters?.productId) {
      items = items.filter((m) => m.productId === filters.productId)
    }

    if (filters?.type && filters.type !== 'ALL') {
      items = items.filter((m) => m.type === filters.type)
    }

    if (filters?.query) {
      const q = filters.query.toLowerCase()
      items = items.filter(
        (m) =>
          m.productName.toLowerCase().includes(q) ||
          m.sku.toLowerCase().includes(q) ||
          m.documentRef.toLowerCase().includes(q)
      )
    }

    return items
  }

  async findSalesByLocationId(locationId: string, period?: string): Promise<WarehouseSaleRecord[]> {
    return this.sales.filter((s) => s.locationId === locationId)
  }

  async findPurchasesByLocationId(locationId: string, period?: string): Promise<WarehousePurchaseRecord[]> {
    return this.purchases.filter((p) => p.locationId === locationId)
  }

  async findCustomersByLocationId(locationId: string): Promise<CustomerLocationRelation[]> {
    return this.customers.filter((c) => c.locationId === locationId)
  }

  async findSuppliersByLocationId(locationId: string): Promise<SupplierLocationRelation[]> {
    return this.suppliers.filter((s) => s.locationId === locationId)
  }

  async findTransfersByLocationId(
    locationId: string,
    direction: 'ALL' | 'IN' | 'OUT' = 'ALL'
  ): Promise<WarehouseTransfer[]> {
    return this.transfers.filter((t) => {
      if (direction === 'IN') return t.destinationLocationId === locationId
      if (direction === 'OUT') return t.originLocationId === locationId
      return t.originLocationId === locationId || t.destinationLocationId === locationId
    })
  }

  async findUsersByLocationId(locationId: string): Promise<WarehouseUserAssignment[]> {
    return this.users.filter((u) => u.locationId === locationId)
  }

  async addMovement(movement: WarehouseMovement): Promise<WarehouseMovement> {
    this.movements.unshift(movement)
    return movement
  }

  async updateInventoryStock(
    locationId: string,
    productId: string,
    delta: number,
    newAverageCost?: number
  ): Promise<WarehouseInventoryItem> {
    const itemIndex = this.inventory.findIndex(
      (inv) => inv.locationId === locationId && inv.productId === productId
    )

    if (itemIndex === -1) {
      if (delta <= 0) {
        throw new Error(`Producto ${productId} no encontrado en bodega ${locationId}`)
      }
      const newItem: WarehouseInventoryItem = {
        id: `wh-inv-${Date.now()}`,
        locationId,
        productId,
        productName: 'Producto en Bodega',
        sku: 'SKU-000',
        barcode: '',
        category: 'General',
        brand: 'Genérico',
        unit: 'UND',
        currentStock: delta,
        minStock: 5,
        maxStock: 100,
        averageCost: newAverageCost || 0,
        totalValueAtCost: (newAverageCost || 0) * delta,
        normalSalePrice: 0,
        status: delta === 0 ? 'OUT_OF_STOCK' : 'NORMAL',
        lastMovementAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      this.inventory.push(newItem)
      return newItem
    }

    const currentItem = this.inventory[itemIndex]
    const newStock = Math.max(0, currentItem.currentStock + delta)
    const avgCost = newAverageCost !== undefined ? newAverageCost : currentItem.averageCost

    let status: WarehouseInventoryItem['status'] = 'NORMAL'
    if (newStock === 0) {
      status = 'OUT_OF_STOCK'
    } else if (newStock <= currentItem.minStock * 0.3) {
      status = 'CRITICAL'
    } else if (newStock <= currentItem.minStock) {
      status = 'LOW_STOCK'
    }

    this.inventory[itemIndex] = {
      ...currentItem,
      currentStock: newStock,
      averageCost: avgCost,
      totalValueAtCost: newStock * avgCost,
      status,
      lastMovementAt: 'Justo ahora',
      updatedAt: new Date().toISOString(),
    }

    // Recalculate total warehouse inventory value
    const locIndex = this.locations.findIndex((l) => l.id === locationId)
    if (locIndex !== -1) {
      const locationInventory = this.inventory.filter((inv) => inv.locationId === locationId)
      const totalVal = locationInventory.reduce((acc, curr) => acc + curr.totalValueAtCost, 0)
      const lowStockCount = locationInventory.filter((inv) => inv.status === 'LOW_STOCK' || inv.status === 'CRITICAL').length
      const outOfStockCount = locationInventory.filter((inv) => inv.status === 'OUT_OF_STOCK').length

      this.locations[locIndex] = {
        ...this.locations[locIndex],
        inventoryValueAtCost: totalVal,
        lowStockProductsCount: lowStockCount,
        outOfStockProductsCount: outOfStockCount,
        lastActivityAt: 'Hace un momento',
      }
    }

    return { ...this.inventory[itemIndex] }
  }

  async createTransfer(transfer: WarehouseTransfer): Promise<WarehouseTransfer> {
    this.transfers.unshift(transfer)
    return transfer
  }

  async addAuditLog(log: WarehouseAuditLog): Promise<WarehouseAuditLog> {
    this.auditLogs.unshift(log)
    return log
  }

  async getAuditLogsByLocationId(locationId: string): Promise<WarehouseAuditLog[]> {
    return this.auditLogs.filter((l) => l.locationId === locationId)
  }

  async assignUser(assignment: WarehouseUserAssignment): Promise<WarehouseUserAssignment> {
    this.users.unshift(assignment)
    const loc = this.locations.find((l) => l.id === assignment.locationId)
    if (loc) {
      loc.assignedUsersCount = this.users.filter((u) => u.locationId === assignment.locationId).length
    }
    return assignment
  }

  async unassignUser(userId: string, locationId: string): Promise<void> {
    this.users = this.users.filter((u) => !(u.userId === userId && u.locationId === locationId))
    const loc = this.locations.find((l) => l.id === locationId)
    if (loc) {
      loc.assignedUsersCount = this.users.filter((u) => u.locationId === locationId).length
    }
  }
}

export const warehouseRepository = new WarehouseRepository()
