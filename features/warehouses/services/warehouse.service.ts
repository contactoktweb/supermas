import {
  warehouseFormSchema,
  stockAdjustmentSchema,
  createTransferSchema,
  WarehouseFormData,
  StockAdjustmentFormData,
  CreateTransferFormData,
} from '../schemas/warehouse.schema'
import { warehouseRepository } from '../repositories/warehouse.repository'
import { supabaseClient } from '@/lib/supabase/client'
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
    if (!userRole) return true
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
    user: { id: string; name: string; companyId?: string }
  ): Promise<LocationWithMetrics> {
    // Validación estricta con Zod
    const validated = warehouseFormSchema.parse(rawInput)
    const normalizedCode = validated.code.toUpperCase().trim()

    // Validar código duplicado
    const existing = await warehouseRepository.findByCode(normalizedCode)
    if (existing) {
      throw new Error(`El código "${normalizedCode}" ya está en uso por la bodega "${existing.name}".`)
    }

    const created = await warehouseRepository.create(
      {
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
      },
      user.companyId
    )

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

    return deactivated
  }

  async activateWarehouse(
    id: string,
    user: { id: string; name: string }
  ): Promise<LocationWithMetrics> {
    const activated = await warehouseRepository.activate(id)

    return activated
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

    const isRealUuid = (str: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)

    if (!isRealUuid(validated.locationId) || !isRealUuid(validated.productId)) {
      throw new Error('Identificadores de bodega o producto inválidos.')
    }

    const { data: currentLevel } = await supabaseClient
      .from('stock_levels')
      .select('*')
      .eq('location_id', validated.locationId)
      .eq('product_id', validated.productId)
      .maybeSingle()

    const currentQty = Number(currentLevel?.quantity || 0)
    const avgCost = Number(currentLevel?.average_cost || 0)
    const isPositive = validated.type === 'AJUSTE_POSITIVO'
    const newQty = isPositive ? currentQty + validated.quantity : currentQty - validated.quantity

    if (!isPositive && currentQty < validated.quantity) {
      throw new Error(`Stock insuficiente. El saldo actual es de ${currentQty} uds.`)
    }

    const docRef = validated.documentRef || `AJ-${Date.now().toString().slice(-6)}`
    const { data: movRow, error: movError } = await supabaseClient
      .from('inventory_movements')
      .insert({
        location_id: validated.locationId,
        product_id: validated.productId,
        movement_type: isPositive ? 'POSITIVE_ADJUSTMENT' : 'NEGATIVE_ADJUSTMENT',
        quantity_in: isPositive ? validated.quantity : 0,
        quantity_out: isPositive ? 0 : validated.quantity,
        previous_stock: currentQty,
        new_stock: newQty,
        unit_cost: avgCost,
        total_cost: validated.quantity * avgCost,
        document_type: 'ADJUSTMENT',
        document_reference: docRef,
        reason: `[${validated.reason}] ${validated.notes}`,
        user_id: isRealUuid(user.id) ? user.id : null,
      })
      .select()
      .single()

    if (movError) {
      throw new Error(`Error registrando movimiento: ${movError.message}`)
    }

    await supabaseClient
      .from('stock_levels')
      .upsert({
        location_id: validated.locationId,
        product_id: validated.productId,
        quantity: newQty,
        average_cost: avgCost,
        updated_at: new Date().toISOString(),
      })

    const loc = await warehouseRepository.findById(validated.locationId)

    const movement: WarehouseMovement = {
      id: movRow.id,
      locationId: validated.locationId,
      locationName: loc?.name || 'Bodega',
      productId: validated.productId,
      productName: 'Producto',
      sku: 'SKU',
      type: validated.type,
      documentRef: docRef,
      quantityIn: isPositive ? validated.quantity : 0,
      quantityOut: isPositive ? 0 : validated.quantity,
      previousBalance: currentQty,
      newBalance: newQty,
      unitCost: avgCost,
      totalCost: validated.quantity * avgCost,
      userId: user.id,
      userName: user.name,
      notes: validated.notes,
      createdAt: new Date().toISOString(),
    }

    const updatedItem: WarehouseInventoryItem = {
      id: currentLevel?.id || `stk-${Date.now()}`,
      locationId: validated.locationId,
      productId: validated.productId,
      productName: 'Producto',
      sku: 'SKU',
      barcode: '',
      category: 'General',
      brand: 'Genérico',
      unit: 'UND',
      currentStock: newQty,
      minStock: 5,
      maxStock: 100,
      averageCost: avgCost,
      totalValueAtCost: newQty * avgCost,
      normalSalePrice: 0,
      status: newQty === 0 ? 'OUT_OF_STOCK' : 'NORMAL',
      lastMovementAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

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

    const totalUnits = validated.items.reduce((sum, item) => sum + item.units, 0)

    const transfer: WarehouseTransfer = {
      id: `tr-${Date.now()}`,
      code: `TR-000${Math.floor(100 + Math.random() * 900)}`,
      originLocationId: originLoc.id,
      originLocationName: originLoc.name,
      destinationLocationId: destLoc.id,
      destinationLocationName: destLoc.name,
      status: 'PENDIENTE',
      itemsCount: validated.items.length,
      totalUnits,
      totalValueAtCost: 0,
      items: validated.items.map((i) => ({
        productId: i.productId,
        productName: 'Producto',
        sku: 'SKU',
        units: i.units,
        unitCost: 0,
      })),
      requestedBy: user.name,
      notes: validated.notes || 'Transferencia logística interna solicitada.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const created = await warehouseRepository.createTransfer(transfer)

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
      assignedAt: new Date().toISOString(),
      lastAccessAt: 'Nunca',
      status: 'ACTIVE',
    }

    const created = await warehouseRepository.assignUser(assignment)

    return created
  }

  async unassignUser(
    locationId: string,
    userId: string,
    currentUser: { id: string; name: string }
  ): Promise<void> {
    const loc = await warehouseRepository.findById(locationId)
    await warehouseRepository.unassignUser(userId, locationId)


  }

  async getAuditLogs(locationId: string): Promise<WarehouseAuditLog[]> {
    return warehouseRepository.getAuditLogsByLocationId(locationId)
  }

  async getWarehouseOverviewAnalytics(locationId: string): Promise<{
    topSelling: { name: string; sku: string; sales: string; units: number }[]
    categoriesDistribution: { name: string; pct: string; value: string }[]
    weeklyData: { day: string; sales: number; profit: number; ops: number }[]
  }> {
    return warehouseRepository.getWarehouseOverviewAnalytics(locationId)
  }
}

export const warehouseService = new WarehouseService()
