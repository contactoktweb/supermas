import {
  InventoryFilterParams,
  InventoryStockLevel,
  ConsolidatedProductStock,
  InventoryKPIs,
  StockAdjustmentInput,
  QuickTransferInput,
  PhysicalCountSession,
  PhysicalCountItem,
  UserPermissionContext,
} from '../types'
import { inventoryRepository } from '../repositories/inventory.repository'
import { kardexRepository } from '@/features/kardex/repositories/kardex.repository'
import { supabaseClient } from '@/lib/supabase/client'

export class InventoryService {
  /**
   * Get active locations from PostgreSQL for select dropdowns
   */
  public async getActiveLocations(): Promise<Array<{ id: string; code: string; name: string }>> {
    const { data, error } = await supabaseClient
      .from('locations')
      .select('id, code, name')
      .eq('status', 'ACTIVE')
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching active locations:', error)
      return []
    }
    return data || []
  }
  /**
   * Check if user has cost reading permission (cost.read)
   */
  public hasCostReadPermission(userCtx?: UserPermissionContext): boolean {
    if (!userCtx) return true // Default admin fallback
    if (userCtx.userRole === 'ADMIN' || userCtx.userRole === 'AUDITOR') return true
    return userCtx.permissions.includes('cost.read')
  }

  /**
   * Get KPIs with cost redaction if user lacks permission
   */
  public async getKPIs(userCtx?: UserPermissionContext): Promise<InventoryKPIs> {
    const kpis = await inventoryRepository.getKPIs()
    const canSeeCost = this.hasCostReadPermission(userCtx)

    return {
      ...kpis,
      totalValueAtCost: canSeeCost ? kpis.totalValueAtCost : 0,
      isCostRedacted: !canSeeCost,
    }
  }

  /**
   * Get stock levels by location with RBAC cost protection
   */
  public async getStockLevelsByLocation(
    params: InventoryFilterParams,
    userCtx?: UserPermissionContext
  ): Promise<{ data: InventoryStockLevel[]; total: number }> {
    const result = await inventoryRepository.getStockLevelsByLocation(params)
    const canSeeCost = this.hasCostReadPermission(userCtx)

    if (!canSeeCost) {
      result.data = result.data.map((item) => ({
        ...item,
        averageCost: 0,
        totalValueAtCost: 0,
      }))
    }

    return result
  }

  /**
   * Get consolidated stock per product with RBAC cost protection
   */
  public async getConsolidatedStock(
    params: InventoryFilterParams,
    userCtx?: UserPermissionContext
  ): Promise<{ data: ConsolidatedProductStock[]; total: number }> {
    const result = await inventoryRepository.getConsolidatedStock(params)
    const canSeeCost = this.hasCostReadPermission(userCtx)

    if (!canSeeCost) {
      result.data = result.data.map((prod) => ({
        ...prod,
        averageCost: 0,
        totalValueAtCost: 0,
        locationBreakdown: prod.locationBreakdown.map((loc) => ({
          ...loc,
          averageCost: 0,
          valueAtCost: 0,
        })),
      }))
    }

    return result
  }

  /**
   * Adjust inventory: mutates stock level via process_inventory_movement trigger by inserting an immutable movement
   */
  public async adjustStock(
    input: StockAdjustmentInput,
    userCtx?: UserPermissionContext
  ): Promise<{
    previousStock: number
    resultingStock: number
    movementId: string
    movementDoc: string
  }> {
    const { previousStock, resultingStock, movementId, movementDoc } =
      await inventoryRepository.adjustStock({
        ...input,
        responsibleUserId: input.responsibleUserId || userCtx?.userId,
        responsibleUserName: input.responsibleUserName || 'Administrador',
      })

    return {
      previousStock,
      resultingStock,
      movementId,
      movementDoc,
    }
  }

  /**
   * Start a Physical Count Session for a location
   */
  public async startPhysicalCountSession(
    locationId: string,
    locationName: string
  ): Promise<PhysicalCountSession> {
    const { data } = await inventoryRepository.getStockLevelsByLocation({
      locationId,
      pageSize: 100,
    })

    const items: PhysicalCountItem[] = data.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      category: item.category,
      unitOfMeasure: item.unitOfMeasure,
      systemStock: item.currentStock,
      physicalStock: item.currentStock, // Initialized to system stock
      difference: 0,
      differenceValue: 0,
    }))

    return {
      id: `cnt-${Date.now()}`,
      sessionNumber: `CNT-${Math.floor(1000 + Math.random() * 9000)}`,
      locationId,
      locationName,
      createdAt: new Date().toISOString(),
      status: 'IN_PROGRESS',
      items,
    }
  }

  /**
   * Apply discrepancies found during physical count session
   */
  public async applyPhysicalCountAdjustments(
    session: PhysicalCountSession,
    userCtx?: UserPermissionContext
  ): Promise<{ appliedCount: number }> {
    let appliedCount = 0

    for (const item of session.items) {
      if (item.difference !== 0) {
        const type = item.difference > 0 ? 'IN' : 'OUT'
        const quantity = Math.abs(item.difference)
        const reason = `Conteo físico ${session.sessionNumber} (Diferencia: ${item.difference > 0 ? '+' : ''}${item.difference} uds)`

        await this.adjustStock(
          {
            locationId: session.locationId,
            productId: item.productId,
            type,
            quantity,
            reason,
            notes: session.notes,
            responsibleUserId: userCtx?.userId,
            responsibleUserName: 'Supervisor de Inventario',
          },
          userCtx
        )
        appliedCount++
      }
    }

    return { appliedCount }
  }

  /**
   * Currency formatter (Colombian Pesos COP)
   */
  public formatCOP(amount: number, compact: boolean = false): string {
    if (isNaN(amount) || amount === null || amount === undefined) {
      return '$0'
    }

    if (compact) {
      if (Math.abs(amount) >= 1_000_000_000) {
        return `$${(amount / 1_000_000_000).toFixed(2).replace(/\.00$/, '')}B`
      }
      if (Math.abs(amount) >= 1_000_000) {
        return `$${(amount / 1_000_000).toFixed(2).replace(/\.00$/, '')}M`
      }
      if (Math.abs(amount) >= 1_000) {
        return `$${(amount / 1_000).toFixed(1).replace(/\.0$/, '')}k`
      }
    }

    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  /**
   * Export inventory data to CSV
   */
  public generateCSV(
    data: ConsolidatedProductStock[] | InventoryStockLevel[],
    viewMode: 'CONSOLIDATED' | 'BY_LOCATION',
    canSeeCost: boolean
  ): string {
    if (viewMode === 'CONSOLIDATED') {
      const headers = [
        'Producto',
        'SKU',
        'Código de barras',
        'Categoría',
        'Marca',
        'Unidad',
        'Stock Total',
        'Estado General',
        ...(canSeeCost ? ['Costo Promedio (COP)', 'Valor Total a Costo (COP)'] : []),
        'Último Movimiento',
      ]

      const rows = (data as ConsolidatedProductStock[]).map((p) => [
        `"${p.productName.replace(/"/g, '""')}"`,
        `"${p.sku}"`,
        `"${p.barcode || ''}"`,
        `"${p.category}"`,
        `"${p.brand}"`,
        `"${p.unitOfMeasure}"`,
        p.totalStock,
        p.overallHealth,
        ...(canSeeCost ? [p.averageCost, p.totalValueAtCost] : []),
        `"${p.lastMovementAt ? new Date(p.lastMovementAt).toLocaleDateString('es-CO') : ''}"`,
      ])

      return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    } else {
      const headers = [
        'Producto',
        'SKU',
        'Código de barras',
        'Categoría',
        'Bodega',
        'Código Bodega',
        'Stock Actual',
        'Stock Mínimo',
        'Stock Crítico',
        'Estado',
        ...(canSeeCost ? ['Costo Promedio (COP)', 'Valor a Costo (COP)'] : []),
        'Último Movimiento',
      ]

      const rows = (data as InventoryStockLevel[]).map((i) => [
        `"${i.productName.replace(/"/g, '""')}"`,
        `"${i.sku}"`,
        `"${i.barcode || ''}"`,
        `"${i.category}"`,
        `"${i.locationName}"`,
        `"${i.locationCode}"`,
        i.currentStock,
        i.minStock,
        i.criticalStock,
        i.stockHealth,
        ...(canSeeCost ? [i.averageCost, i.totalValueAtCost] : []),
        `"${i.lastMovementAt ? new Date(i.lastMovementAt).toLocaleDateString('es-CO') : ''}"`,
      ])

      return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    }
  }
}

export const inventoryService = new InventoryService()
