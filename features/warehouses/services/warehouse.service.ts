import {
  warehouseFormSchema,
  stockAdjustmentSchema,
  createTransferSchema,
  WarehouseFormData,
  StockAdjustmentFormData,
  CreateTransferFormData,
} from '../schemas/warehouse.schema'
import { warehouseRepository } from '../repositories/warehouse.repository'
import {
  LocationWithMetrics,
  WarehouseFilters,
  GlobalWarehousesStats,
  WarehouseInventoryItem,
  WarehouseMovement,
  WarehouseSaleRecord,
  WarehousePurchaseRecord,
  CustomerLocationRelation,
  SupplierLocationRelation,
  WarehouseTransfer,
  WarehouseUserAssignment,
  WarehouseDeactivationCheck,
  WarehouseAuditLog,
} from '../types'

export class WarehouseService {
  private hasCostPermission(userRole?: string): boolean {
    if (!userRole) return true // default admin view in current ERP prototype
    return ['SUPERADMIN', 'STORE_ADMIN'].includes(userRole)
  }

  async listWarehouses(
    filters?: WarehouseFilters,
    userRole?: string
  ): Promise<{ data: LocationWithMetrics[]; total: number }> {
    const result = await warehouseRepository.findAll(filters)
    const canSeeCost = this.hasCostPermission(userRole)

    const sanitized = result.data.map((loc) => {
      if (!canSeeCost) {
        return {
          ...loc,
          inventoryValueAtCost: 0,
          estimatedProfit: 0,
          profitMarginPercent: 0,
        }
      }
      return loc
    })

    return { data: sanitized, total: result.total }
  }

  async getGlobalStats(userRole?: string): Promise<GlobalWarehousesStats> {
    const { data: allLocations } = await warehouseRepository.findAll({ pageSize: 1000 })
    const canSeeCost = this.hasCostPermission(userRole)

    const activeLocs = allLocations.filter((l) => l.status === 'ACTIVE')
    const inactiveLocs = allLocations.filter((l) => l.status === 'INACTIVE')

    const totalInventoryValueAtCost = canSeeCost
      ? activeLocs.reduce((sum, l) => sum + l.inventoryValueAtCost, 0)
      : 0

    const totalTodaySales = activeLocs.reduce((sum, l) => sum + l.todaySalesAmount, 0)
    const totalLowStockProducts = activeLocs.reduce((sum, l) => sum + l.lowStockProductsCount, 0)
    const totalPendingTransfers = activeLocs.reduce((sum, l) => sum + l.pendingTransfersCount, 0)
    const totalActiveAlerts = activeLocs.reduce((sum, l) => sum + l.activeAlertsCount, 0)

    return {
      totalWarehouses: allLocations.length,
      activeWarehouses: activeLocs.length,
      inactiveWarehouses: inactiveLocs.length,
      totalInventoryValueAtCost,
      totalTodaySales,
      totalLowStockProducts,
      totalPendingTransfers,
      totalActiveAlerts,
    }
  }

  async getWarehouse(id: string, userRole?: string): Promise<LocationWithMetrics | null> {
    const location = await warehouseRepository.findById(id)
    if (!location) return null

    const canSeeCost = this.hasCostPermission(userRole)
    if (!canSeeCost) {
      return {
        ...location,
        inventoryValueAtCost: 0,
        estimatedProfit: 0,
        profitMarginPercent: 0,
      }
    }

    return location
  }

  async createWarehouse(
    rawInput: WarehouseFormData,
    user: { id: string; name: string }
  ): Promise<LocationWithMetrics> {
    // Server-side Zod validation
    const validated = warehouseFormSchema.parse(rawInput)
    const normalizedCode = validated.code.toUpperCase().trim()

    // Check duplicate code
    const existing = await warehouseRepository.findByCode(normalizedCode)
    if (existing) {
      throw new Error(`El código "${normalizedCode}" ya está en uso por la bodega "${existing.name}".`)
    }

    const newLocation: LocationWithMetrics = {
      id: `loc-${Date.now()}`,
      code: normalizedCode,
      name: validated.name.trim(),
      type: validated.type,
      status: validated.status,
      address: validated.address.trim(),
      city: validated.city.trim(),
      department: validated.department?.trim() || 'Antioquia',
      phone: validated.phone?.trim() || '',
      email: validated.email?.trim() || '',
      managerName: validated.managerName?.trim() || '',
      managerEmail: validated.managerEmail?.trim() || '',
      managerPhone: validated.managerPhone?.trim() || '',
      description: validated.description?.trim() || '',
      settings: validated.settings,
      inventoryValueAtCost: 0,
      productsCount: 0,
      availableUnits: 0,
      todaySalesAmount: 0,
      monthSalesAmount: 0,
      monthPurchasesAmount: 0,
      estimatedProfit: 0,
      profitMarginPercent: 0,
      lowStockProductsCount: 0,
      outOfStockProductsCount: 0,
      pendingTransfersCount: 0,
      activeAlertsCount: 0,
      assignedUsersCount: 1,
      openCashRegistersCount: 0,
      lastActivityAt: 'Recién creada',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const created = await warehouseRepository.create(newLocation)

    await warehouseRepository.addAuditLog({
      id: `aud-${Date.now()}`,
      action: 'LOCATION_CREATED',
      locationId: created.id,
      locationName: created.name,
      userId: user.id,
      userName: user.name,
      timestamp: 'Justo ahora',
      changes: {
        details: `Bodega creada con código ${created.code} y tipo ${created.type}`,
        newValue: created,
      },
    })

    return created
  }

  async updateWarehouse(
    id: string,
    rawInput: WarehouseFormData,
    user: { id: string; name: string }
  ): Promise<LocationWithMetrics> {
    const validated = warehouseFormSchema.parse(rawInput)
    const normalizedCode = validated.code.toUpperCase().trim()

    const existing = await warehouseRepository.findByCode(normalizedCode)
    if (existing && existing.id !== id) {
      throw new Error(`El código "${normalizedCode}" ya está en uso por la bodega "${existing.name}".`)
    }

    const prevLocation = await warehouseRepository.findById(id)
    if (!prevLocation) {
      throw new Error('Ubicación no encontrada')
    }

    const updated = await warehouseRepository.update(id, {
      code: normalizedCode,
      name: validated.name.trim(),
      type: validated.type,
      status: validated.status,
      address: validated.address.trim(),
      city: validated.city.trim(),
      department: validated.department?.trim() || prevLocation.department,
      phone: validated.phone?.trim() || '',
      email: validated.email?.trim() || '',
      managerName: validated.managerName?.trim() || '',
      managerEmail: validated.managerEmail?.trim() || '',
      managerPhone: validated.managerPhone?.trim() || '',
      description: validated.description?.trim() || '',
      settings: validated.settings,
    })

    await warehouseRepository.addAuditLog({
      id: `aud-${Date.now()}`,
      action: 'LOCATION_UPDATED',
      locationId: updated.id,
      locationName: updated.name,
      userId: user.id,
      userName: user.name,
      timestamp: 'Justo ahora',
      changes: {
        details: 'Configuración general de bodega actualizada',
        previousValue: prevLocation,
        newValue: updated,
      },
    })

    return updated
  }

  async validateDeactivation(id: string): Promise<WarehouseDeactivationCheck> {
    const location = await warehouseRepository.findById(id)
    if (!location) {
      throw new Error('Ubicación no encontrada')
    }

    const transfers = await warehouseRepository.findTransfersByLocationId(id, 'ALL')
    const pendingTransfers = transfers.filter(
      (t) => t.status === 'PENDIENTE' || t.status === 'EN_TRANSITO'
    )

    const blockingReasons: string[] = []

    if (pendingTransfers.length > 0) {
      blockingReasons.push(
        `Tiene ${pendingTransfers.length} transferencia(s) en curso o pendientes de recepción.`
      )
    }

    if (location.openCashRegistersCount > 0) {
      blockingReasons.push(
        `Tiene ${location.openCashRegistersCount} caja(s) registradora(s) abierta(s) en este momento.`
      )
    }

    if (location.settings.isEcommerceProcessingSource) {
      blockingReasons.push(
        'Es la bodega principal configurada para despacho ecommerce. Asigna otra bodega antes de desactivar.'
      )
    }

    return {
      canDeactivate: blockingReasons.length === 0,
      pendingTransfersCount: pendingTransfers.length,
      openCashRegistersCount: location.openCashRegistersCount,
      activeOrdersCount: 0,
      blockingReasons,
    }
  }

  async deactivateWarehouse(
    id: string,
    user: { id: string; name: string }
  ): Promise<LocationWithMetrics> {
    const check = await this.validateDeactivation(id)
    if (!check.canDeactivate) {
      throw new Error(
        `No se puede desactivar la bodega:\n${check.blockingReasons.join('\n')}`
      )
    }

    const deactivated = await warehouseRepository.deactivate(id)

    await warehouseRepository.addAuditLog({
      id: `aud-${Date.now()}`,
      action: 'LOCATION_DEACTIVATED',
      locationId: deactivated.id,
      locationName: deactivated.name,
      userId: user.id,
      userName: user.name,
      timestamp: 'Justo ahora',
      changes: {
        details: 'Bodega desactivada de forma segura. El inventario histórico se preserva intacto.',
      },
    })

    return deactivated
  }

  async getWarehouseInventory(
    locationId: string,
    filters?: { query?: string; status?: string; category?: string },
    userRole?: string
  ): Promise<WarehouseInventoryItem[]> {
    const items = await warehouseRepository.findInventoryByLocationId(locationId, filters)
    const canSeeCost = this.hasCostPermission(userRole)

    if (!canSeeCost) {
      return items.map((i) => ({
        ...i,
        averageCost: 0,
        totalValueAtCost: 0,
      }))
    }

    return items
  }

  async adjustStock(
    rawInput: StockAdjustmentFormData,
    user: { id: string; name: string }
  ): Promise<{ movement: WarehouseMovement; updatedItem: WarehouseInventoryItem }> {
    const validated = stockAdjustmentSchema.parse(rawInput)

    const inventory = await warehouseRepository.findInventoryByLocationId(validated.locationId)
    const currentItem = inventory.find((i) => i.productId === validated.productId)

    if (!currentItem) {
      throw new Error('El producto no existe en el inventario de esta bodega.')
    }

    const delta = validated.type === 'AJUSTE_POSITIVO' ? validated.quantity : -validated.quantity
    const newStock = currentItem.currentStock + delta

    if (newStock < 0) {
      throw new Error(
        `No puedes realizar un ajuste negativo de ${validated.quantity} unidades. El saldo actual es de solo ${currentItem.currentStock} unidades.`
      )
    }

    const location = await warehouseRepository.findById(validated.locationId)
    const locationName = location ? location.name : 'Bodega'

    const movement: WarehouseMovement = {
      id: `mov-${Date.now()}`,
      locationId: validated.locationId,
      locationName,
      productId: validated.productId,
      productName: currentItem.productName,
      sku: currentItem.sku,
      type: validated.type,
      documentRef: validated.documentRef || `AJ-${Math.floor(10000 + Math.random() * 90000)}`,
      quantityIn: validated.type === 'AJUSTE_POSITIVO' ? validated.quantity : 0,
      quantityOut: validated.type === 'AJUSTE_NEGATIVO' ? validated.quantity : 0,
      previousBalance: currentItem.currentStock,
      newBalance: newStock,
      unitCost: currentItem.averageCost,
      totalCost: validated.quantity * currentItem.averageCost,
      userId: user.id,
      userName: user.name,
      notes: `[Motivo: ${validated.reason}] ${validated.notes}`,
      createdAt: 'Hoy, ' + new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    }

    await warehouseRepository.addMovement(movement)
    const updatedItem = await warehouseRepository.updateInventoryStock(
      validated.locationId,
      validated.productId,
      delta
    )

    await warehouseRepository.addAuditLog({
      id: `aud-${Date.now()}`,
      action: 'STOCK_ADJUSTED',
      locationId: validated.locationId,
      locationName,
      userId: user.id,
      userName: user.name,
      timestamp: 'Justo ahora',
      changes: {
        field: 'stock',
        previousValue: `${currentItem.currentStock} uds`,
        newValue: `${newStock} uds`,
        details: `Ajuste (${validated.type}) por ${validated.quantity} uds. Doc: ${movement.documentRef}`,
      },
    })

    return { movement, updatedItem }
  }

  async createTransfer(
    rawInput: CreateTransferFormData,
    user: { id: string; name: string }
  ): Promise<WarehouseTransfer> {
    const validated = createTransferSchema.parse(rawInput)

    const originLoc = await warehouseRepository.findById(validated.originLocationId)
    const destLoc = await warehouseRepository.findById(validated.destinationLocationId)

    if (!originLoc || !destLoc) {
      throw new Error('Bodega de origen o destino no válida.')
    }

    const originInventory = await warehouseRepository.findInventoryByLocationId(validated.originLocationId)
    const transferItems = validated.items.map((item) => {
      const p = originInventory.find((inv) => inv.productId === item.productId)
      if (!p) {
        throw new Error(`Producto ${item.productId} no encontrado en bodega de origen.`)
      }
      if (p.currentStock < item.units) {
        throw new Error(
          `Stock insuficiente en origen para "${p.productName}". Disponibles: ${p.currentStock}, Solicitadas: ${item.units}`
        )
      }
      return {
        productId: p.productId,
        productName: p.productName,
        sku: p.sku,
        units: item.units,
        unitCost: p.averageCost,
      }
    })

    const totalUnits = transferItems.reduce((sum, item) => sum + item.units, 0)
    const totalValue = transferItems.reduce((sum, item) => sum + item.units * item.unitCost, 0)

    const transfer: WarehouseTransfer = {
      id: `tr-${Date.now()}`,
      code: `TR-000${Math.floor(100 + Math.random() * 900)}`,
      originLocationId: originLoc.id,
      originLocationName: originLoc.name,
      destinationLocationId: destLoc.id,
      destinationLocationName: destLoc.name,
      status: 'PENDIENTE',
      itemsCount: transferItems.length,
      totalUnits,
      totalValueAtCost: totalValue,
      items: transferItems,
      requestedBy: user.name,
      notes: validated.notes || 'Transferencia logística interna solicitada.',
      createdAt: 'Hoy, ' + new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      updatedAt: 'Hoy, ' + new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    }

    const created = await warehouseRepository.createTransfer(transfer)

    await warehouseRepository.addAuditLog({
      id: `aud-${Date.now()}`,
      action: 'TRANSFER_CREATED',
      locationId: originLoc.id,
      locationName: originLoc.name,
      userId: user.id,
      userName: user.name,
      timestamp: 'Justo ahora',
      changes: {
        details: `Transferencia ${created.code} creada hacia ${destLoc.name} (${totalUnits} unidades)`,
      },
    })

    return created
  }

  async getWarehouseMovements(
    locationId: string,
    filters?: { productId?: string; type?: string; query?: string }
  ): Promise<WarehouseMovement[]> {
    return warehouseRepository.findMovementsByLocationId(locationId, filters)
  }

  async getWarehouseSales(
    locationId: string,
    period?: string,
    userRole?: string
  ): Promise<WarehouseSaleRecord[]> {
    const sales = await warehouseRepository.findSalesByLocationId(locationId, period)
    const canSeeCost = this.hasCostPermission(userRole)

    if (!canSeeCost) {
      return sales.map((s) => ({
        ...s,
        costAmount: 0,
        profitAmount: 0,
      }))
    }

    return sales
  }

  async getWarehousePurchases(
    locationId: string,
    period?: string
  ): Promise<WarehousePurchaseRecord[]> {
    return warehouseRepository.findPurchasesByLocationId(locationId, period)
  }

  async getWarehouseCustomers(locationId: string): Promise<CustomerLocationRelation[]> {
    return warehouseRepository.findCustomersByLocationId(locationId)
  }

  async getWarehouseSuppliers(locationId: string): Promise<SupplierLocationRelation[]> {
    return warehouseRepository.findSuppliersByLocationId(locationId)
  }

  async getWarehouseTransfers(
    locationId: string,
    direction: 'ALL' | 'IN' | 'OUT' = 'ALL'
  ): Promise<WarehouseTransfer[]> {
    return warehouseRepository.findTransfersByLocationId(locationId, direction)
  }

  async getWarehouseUsers(locationId: string): Promise<WarehouseUserAssignment[]> {
    return warehouseRepository.findUsersByLocationId(locationId)
  }

  async assignUser(
    locationId: string,
    userId: string,
    userName: string,
    userEmail: string,
    role: WarehouseUserAssignment['userRole'],
    currentUser: { id: string; name: string }
  ): Promise<WarehouseUserAssignment> {
    const loc = await warehouseRepository.findById(locationId)
    if (!loc) throw new Error('Ubicación no encontrada')

    const assignment: WarehouseUserAssignment = {
      id: `ua-${Date.now()}`,
      userId,
      userName,
      userEmail,
      userRole: role,
      locationId,
      locationName: loc.name,
      isPrimaryLocation: true,
      assignedAt: 'Hoy',
      lastAccessAt: 'Nunca',
      status: 'ACTIVE',
    }

    const created = await warehouseRepository.assignUser(assignment)

    await warehouseRepository.addAuditLog({
      id: `aud-${Date.now()}`,
      action: 'USER_ASSIGNED',
      locationId,
      locationName: loc.name,
      userId: currentUser.id,
      userName: currentUser.name,
      timestamp: 'Justo ahora',
      changes: {
        details: `Usuario ${userName} asignado como ${role}`,
      },
    })

    return created
  }

  async unassignUser(
    locationId: string,
    userId: string,
    currentUser: { id: string; name: string }
  ): Promise<void> {
    const loc = await warehouseRepository.findById(locationId)
    await warehouseRepository.unassignUser(userId, locationId)

    if (loc) {
      await warehouseRepository.addAuditLog({
        id: `aud-${Date.now()}`,
        action: 'USER_UNASSIGNED',
        locationId,
        locationName: loc.name,
        userId: currentUser.id,
        userName: currentUser.name,
        timestamp: 'Justo ahora',
        changes: {
          details: `Usuario ${userId} desvinculado de la bodega`,
        },
      })
    }
  }

  async getAuditLogs(locationId: string): Promise<WarehouseAuditLog[]> {
    return warehouseRepository.getAuditLogsByLocationId(locationId)
  }
}

export const warehouseService = new WarehouseService()
