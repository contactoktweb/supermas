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
import { supabaseClient } from '@/lib/supabase/client'

export class InventoryRepository {
  /**
   * Determina la salud del stock dinámicamente con base en saldo actual, mínimo y crítico
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
   * Resuelve el company_id del usuario autenticado actual bajo RLS
   */
  private async resolveCompanyId(): Promise<string> {
    const { data: authUser } = await supabaseClient.auth.getUser()
    if (authUser.user) {
      const { data: userRow } = await supabaseClient
        .from('users')
        .select('company_id')
        .eq('id', authUser.user.id)
        .maybeSingle()
      if (userRow?.company_id) return userRow.company_id
    }
    const { data: comp } = await supabaseClient
      .from('companies')
      .select('id')
      .limit(1)
      .single()
    if (comp?.id) return comp.id
    throw new Error('No se pudo resolver la empresa asociada para operaciones de inventario.')
  }

  /**
   * Obtiene las existencias de inventario por bodega directamente desde Supabase/PostgreSQL.
   * Regla Fase 4: Todo producto activo de la empresa aparece en cada bodega autorizada;
   * si no existe fila en stock_levels, se visualiza con cantidad 0 sin registros artificiales.
   */
  public async getStockLevelsByLocation(
    params: InventoryFilterParams
  ): Promise<{ data: InventoryStockLevel[]; total: number }> {
    // 1. Obtener productos activos
    const { data: productsData, error: prodErr } = await supabaseClient
      .from('products')
      .select(`
        id,
        sku,
        barcode,
        name,
        unit_of_measure,
        cost_price,
        primary_image_url,
        categories ( name ),
        brands ( name )
      `)
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (prodErr || !productsData) {
      console.error('Error al consultar productos en inventario:', prodErr)
      return { data: [], total: 0 }
    }

    // 2. Obtener bodegas activas
    let locQuery = supabaseClient
      .from('locations')
      .select('id, code, name')
      .eq('status', 'ACTIVE')

    if (params.locationId && params.locationId !== 'ALL') {
      locQuery = locQuery.eq('id', params.locationId)
    }

    const { data: locationsData, error: locErr } = await locQuery
    if (locErr || !locationsData) {
      console.error('Error al consultar bodegas en inventario:', locErr)
      return { data: [], total: 0 }
    }

    // 3. Obtener niveles de stock reales desde public.stock_levels
    let stockQuery = supabaseClient
      .from('stock_levels')
      .select('id, product_id, location_id, quantity, min_stock, max_stock, average_cost, health_status, last_movement_at')

    if (params.locationId && params.locationId !== 'ALL') {
      stockQuery = stockQuery.eq('location_id', params.locationId)
    }

    const { data: stockLevelsData, error: stockErr } = await stockQuery
    if (stockErr) {
      console.error('Error al consultar stock_levels:', stockErr)
    }

    const stockMap = new Map<string, any>()
    if (stockLevelsData) {
      for (const sl of stockLevelsData) {
        stockMap.set(`${sl.product_id}_${sl.location_id}`, sl)
      }
    }

    // 4. Cruzar productos con bodegas (LEFT JOIN virtual)
    let list: InventoryStockLevel[] = []

    for (const loc of locationsData) {
      for (const prod of productsData) {
        const p = prod as any
        const key = `${p.id}_${loc.id}`
        const sl = stockMap.get(key)

        const qty = sl ? Number(sl.quantity || 0) : 0
        const minStock = sl ? Number(sl.min_stock || 10) : 10
        const criticalStock = Math.max(1, Math.round(minStock * 0.3))
        const averageCost = sl ? Number(sl.average_cost || 0) : Number(p.cost_price || 0)
        const health = this.calculateStockHealth(qty, minStock, criticalStock)

        list.push({
          id: sl?.id || `stock-virtual-${p.id}-${loc.id}`,
          productId: p.id,
          productName: p.name || 'Producto',
          sku: p.sku || 'SKU',
          barcode: p.barcode || '',
          category: p.categories?.name || 'General',
          brand: p.brands?.name || 'Genérico',
          unitOfMeasure: p.unit_of_measure || 'UND',
          imageUrl: p.primary_image_url || undefined,
          locationId: loc.id,
          locationName: loc.name,
          locationCode: loc.code,
          currentStock: qty,
          minStock,
          criticalStock,
          reorderPoint: minStock,
          averageCost,
          totalValueAtCost: qty * averageCost,
          stockHealth: health,
          lastMovementAt: sl?.last_movement_at,
        })
      }
    }

    // 5. Filtros en memoria
    if (params.query && params.query.trim() !== '') {
      const q = params.query.toLowerCase().trim()
      list = list.filter(
        (item) =>
          item.productName.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          (item.barcode && item.barcode.toLowerCase().includes(q))
      )
    }

    if (params.category && params.category !== 'ALL') {
      list = list.filter((item) => item.category === params.category)
    }

    if (params.brand && params.brand !== 'ALL') {
      list = list.filter((item) => item.brand === params.brand)
    }

    const activeTab = params.tab && params.tab !== 'ALL' ? params.tab : params.stockHealth
    if (activeTab && activeTab !== 'ALL') {
      list = list.filter((item) => item.stockHealth === activeTab)
    }

    if (params.hasStock === 'WITH_STOCK') {
      list = list.filter((item) => item.currentStock > 0)
    } else if (params.hasStock === 'ZERO_STOCK') {
      list = list.filter((item) => item.currentStock === 0)
    }

    // 6. Ordenamiento
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
   * Obtiene inventario consolidado por producto a través de todas las bodegas desde PostgreSQL
   */
  public async getConsolidatedStock(
    params: InventoryFilterParams
  ): Promise<{ data: ConsolidatedProductStock[]; total: number }> {
    // 1. Obtener productos activos
    const { data: productsData } = await supabaseClient
      .from('products')
      .select(`
        id,
        sku,
        barcode,
        name,
        unit_of_measure,
        cost_price,
        primary_image_url,
        categories ( name ),
        brands ( name )
      `)
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (!productsData || productsData.length === 0) {
      return { data: [], total: 0 }
    }

    // 2. Obtener bodegas activas
    const { data: locationsData } = await supabaseClient
      .from('locations')
      .select('id, code, name')
      .eq('status', 'ACTIVE')

    const activeLocations = locationsData || []

    // 3. Obtener niveles de stock reales
    const { data: stockLevelsData } = await supabaseClient
      .from('stock_levels')
      .select('*')

    const stockMap = new Map<string, any>()
    if (stockLevelsData) {
      for (const sl of stockLevelsData) {
        stockMap.set(`${sl.product_id}_${sl.location_id}`, sl)
      }
    }

    let consolidatedList: ConsolidatedProductStock[] = []

    for (const prod of productsData) {
      const p = prod as any
      let totalStock = 0
      let totalValueAtCost = 0
      let minStockConsolidated = 0
      let criticalStockConsolidated = 0
      let lastMovementAt: string | undefined = undefined

      const locationBreakdown: LocationStockBreakdown[] = activeLocations.map((loc) => {
        const sl = stockMap.get(`${p.id}_${loc.id}`)
        const stock = sl ? Number(sl.quantity || 0) : 0
        const minStock = sl ? Number(sl.min_stock || 10) : 10
        const criticalStock = Math.max(1, Math.round(minStock * 0.3))
        const averageCost = sl ? Number(sl.average_cost || 0) : Number(p.cost_price || 0)
        const health = this.calculateStockHealth(stock, minStock, criticalStock)
        const valueAtCost = stock * averageCost

        totalStock += stock
        totalValueAtCost += valueAtCost
        minStockConsolidated += minStock
        criticalStockConsolidated += criticalStock

        if (sl?.last_movement_at && (!lastMovementAt || new Date(sl.last_movement_at) > new Date(lastMovementAt))) {
          lastMovementAt = sl.last_movement_at
        }

        return {
          locationId: loc.id,
          locationName: loc.name,
          locationCode: loc.code,
          stock,
          minStock,
          criticalStock,
          health,
          averageCost,
          valueAtCost,
          lastMovementAt: sl?.last_movement_at,
        }
      })

      const averageCost = totalStock > 0 ? totalValueAtCost / totalStock : Number(p.cost_price || 0)
      const overallHealth = this.calculateStockHealth(
        totalStock,
        minStockConsolidated,
        criticalStockConsolidated
      )

      consolidatedList.push({
        productId: p.id,
        productName: p.name || 'Producto',
        sku: p.sku || 'SKU',
        barcode: p.barcode || '',
        category: p.categories?.name || 'General',
        brand: p.brands?.name || 'Genérico',
        unitOfMeasure: p.unit_of_measure || 'UND',
        imageUrl: p.primary_image_url || undefined,
        totalStock,
        totalValueAtCost,
        averageCost,
        overallHealth,
        minStockConsolidated,
        criticalStockConsolidated,
        locationsCount: activeLocations.length,
        locationBreakdown,
        lastMovementAt,
      })
    }

    // 4. Filtros
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
        c.locationBreakdown.some((l) => l.locationId === params.locationId && l.stock > 0)
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

    // 5. Ordenamiento
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
   * Obtiene los KPIs operacionales reales desde PostgreSQL
   */
  public async getKPIs(): Promise<InventoryKPIs> {
    const { data: stockData } = await supabaseClient
      .from('stock_levels')
      .select('product_id, quantity, average_cost, min_stock')

    const { count: totalProductsCount } = await supabaseClient
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)

    let totalValueAtCost = 0
    let totalUnitsAvailable = 0
    let lowStockCount = 0
    let criticalStockCount = 0
    let outOfStockCount = 0
    const productsWithStockSet = new Set<string>()

    if (stockData) {
      for (const row of stockData) {
        const q = Number(row.quantity || 0)
        const c = Number(row.average_cost || 0)
        const min = Number(row.min_stock || 10)
        const crit = Math.max(1, Math.round(min * 0.3))

        totalValueAtCost += q * c
        totalUnitsAvailable += q
        if (q > 0) {
          productsWithStockSet.add(row.product_id)
        }
        if (q === 0) outOfStockCount++
        else if (q <= crit) criticalStockCount++
        else if (q <= min) lowStockCount++
      }
    }

    const totalProducts = totalProductsCount || 0
    const productsWithStock = productsWithStockSet.size
    const productsWithNoStockAtAll = Math.max(0, totalProducts - productsWithStock)
    const effectiveOutOfStock = outOfStockCount + productsWithNoStockAtAll

    return {
      totalValueAtCost,
      totalUnitsAvailable,
      productsWithStock,
      lowStockCount,
      criticalStockCount,
      outOfStockCount: effectiveOutOfStock,
      isCostRedacted: false,
    }
  }

  /**
   * Realiza un ajuste de stock insertando un movimiento real en public.inventory_movements.
   * REGLA FASE 4: No modifica stock_levels directamente; el trigger process_inventory_movement()
   * actualiza stock_levels de forma transaccional e inmutable.
   */
  public async adjustStock(
    input: StockAdjustmentInput
  ): Promise<{
    previousStock: number
    resultingStock: number
    movementId: string
    movementDoc: string
    updatedItem: InventoryStockLevel
  }> {
    // 1. Obtener saldo previo y costo del producto
    const { data: existingSL } = await supabaseClient
      .from('stock_levels')
      .select('*')
      .eq('product_id', input.productId)
      .eq('location_id', input.locationId)
      .maybeSingle()

    const { data: prodData } = await supabaseClient
      .from('products')
      .select('id, name, sku, barcode, cost_price, unit_of_measure, categories(name), brands(name)')
      .eq('id', input.productId)
      .single()

    if (!prodData) {
      throw new Error(`El producto con ID ${input.productId} no existe en la base de datos.`)
    }

    const previousStock = existingSL ? Number(existingSL.quantity || 0) : 0
    const unitCost = existingSL ? Number(existingSL.average_cost || 0) : Number(prodData.cost_price || 0)

    if (input.type === 'OUT' && input.quantity > previousStock) {
      throw new Error(
        `No se puede realizar un ajuste de salida de ${input.quantity} unidades porque el saldo actual en esta bodega es de ${previousStock} unidades.`
      )
    }

    const resultingStock = input.type === 'IN' ? previousStock + input.quantity : previousStock - input.quantity
    const companyId = await this.resolveCompanyId()

    const { data: authUser } = await supabaseClient.auth.getUser()
    const userId = input.responsibleUserId || authUser.user?.id || null

    const docRef = `AJ-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`

    // 2. Insertar movimiento inmutable en Kardex (inventory_movements)
    const { data: movRow, error: movError } = await supabaseClient
      .from('inventory_movements')
      .insert({
        company_id: companyId,
        product_id: input.productId,
        location_id: input.locationId,
        movement_type: input.type === 'IN' ? 'POSITIVE_ADJUSTMENT' : 'NEGATIVE_ADJUSTMENT',
        quantity_in: input.type === 'IN' ? input.quantity : 0,
        quantity_out: input.type === 'OUT' ? input.quantity : 0,
        previous_stock: previousStock,
        new_stock: resultingStock,
        unit_cost: unitCost,
        total_cost: input.quantity * unitCost,
        document_type: 'ADJUSTMENT',
        document_reference: docRef,
        reason: `${input.reason}${input.notes ? ` — ${input.notes}` : ''}`,
        user_id: userId,
      })
      .select()
      .single()

    if (movError) {
      console.error('Error insertando movimiento de inventario:', movError)
      throw new Error(`Error al registrar ajuste de inventario: ${movError.message}`)
    }

    // 3. El trigger process_inventory_movement() ya actualizó public.stock_levels.
    // Consultamos la fila resultante actualizada de la base de datos
    const { data: updatedSL } = await supabaseClient
      .from('stock_levels')
      .select('*')
      .eq('product_id', input.productId)
      .eq('location_id', input.locationId)
      .maybeSingle()

    const finalStock = updatedSL ? Number(updatedSL.quantity || 0) : resultingStock
    const finalCost = updatedSL ? Number(updatedSL.average_cost || 0) : unitCost
    const minStock = updatedSL ? Number(updatedSL.min_stock || 10) : 10
    const critStock = Math.max(1, Math.round(minStock * 0.3))
    const health = this.calculateStockHealth(finalStock, minStock, critStock)

    const updatedItem: InventoryStockLevel = {
      id: updatedSL?.id || `stock-virtual-${input.productId}-${input.locationId}`,
      productId: input.productId,
      productName: prodData.name || 'Producto',
      sku: prodData.sku || 'SKU',
      barcode: prodData.barcode || '',
      category: (prodData.categories as any)?.name || 'General',
      brand: (prodData.brands as any)?.name || 'Genérico',
      unitOfMeasure: prodData.unit_of_measure || 'UND',
      locationId: input.locationId,
      locationName: 'Bodega',
      locationCode: 'BOD',
      currentStock: finalStock,
      minStock,
      criticalStock: critStock,
      averageCost: finalCost,
      totalValueAtCost: finalStock * finalCost,
      stockHealth: health,
      lastMovementAt: new Date().toISOString(),
      lastMovementType: input.type === 'IN' ? 'POSITIVE_ADJUSTMENT' : 'NEGATIVE_ADJUSTMENT',
      lastMovementDoc: docRef,
    }

    return {
      previousStock,
      resultingStock: finalStock,
      movementId: movRow.id,
      movementDoc: docRef,
      updatedItem,
    }
  }

  /**
   * Actualiza los umbrales de stock en public.stock_levels
   */
  public async updateThresholds(
    input: ThresholdUpdateInput
  ): Promise<InventoryStockLevel> {
    const { data, error } = await supabaseClient
      .from('stock_levels')
      .update({
        min_stock: input.minStock,
        updated_at: new Date().toISOString(),
      })
      .eq('product_id', input.productId)
      .eq('location_id', input.locationId)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error al actualizar umbrales de stock:', error)
      throw new Error(`Error al actualizar umbrales: ${error.message}`)
    }

    const { data: prodData } = await supabaseClient
      .from('products')
      .select('name, sku, barcode, cost_price, unit_of_measure, categories(name), brands(name)')
      .eq('id', input.productId)
      .single()

    const currentStock = data ? Number(data.quantity || 0) : 0
    const critStock = Math.max(1, Math.round(input.minStock * 0.3))
    const health = this.calculateStockHealth(currentStock, input.minStock, critStock)
    const cost = data ? Number(data.average_cost || 0) : Number(prodData?.cost_price || 0)

    return {
      id: data?.id || `sl-${input.productId}-${input.locationId}`,
      productId: input.productId,
      productName: prodData?.name || 'Producto',
      sku: prodData?.sku || 'SKU',
      barcode: prodData?.barcode || '',
      category: (prodData?.categories as any)?.name || 'General',
      brand: (prodData?.brands as any)?.name || 'Genérico',
      unitOfMeasure: prodData?.unit_of_measure || 'UND',
      locationId: input.locationId,
      locationName: 'Bodega',
      locationCode: 'BOD',
      currentStock,
      minStock: input.minStock,
      criticalStock: critStock,
      averageCost: cost,
      totalValueAtCost: currentStock * cost,
      stockHealth: health,
    }
  }
}

export const inventoryRepository = new InventoryRepository()
