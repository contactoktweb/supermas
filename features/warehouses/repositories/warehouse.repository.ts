/**
 * SUPER MÁS ERP/POS — Repositorio de Bodegas y Sedes Físicas (WarehouseRepository)
 *
 * Conectado exclusivamente a PostgreSQL / Supabase Real (public.locations,
 * public.stock_levels, public.user_locations, public.audit_logs).
 * Respeta Row Level Security (RLS) y aislamiento multiempresa por company_id.
 */

import { supabaseClient } from '@/lib/supabase/client'
import { resolveUserCompanyId } from '@/lib/supabase/tenant'
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
  LocationType,
  LocationStatus,
} from '../types'

function mapDbLocationToDomain(row: any, metrics?: Partial<LocationWithMetrics>): LocationWithMetrics {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type as LocationType,
    status: (row.status || 'ACTIVE') as LocationStatus,
    address: row.address || '',
    city: row.city || '',
    department: row.department || 'Antioquia',
    phone: row.phone || '',
    email: row.email || '',
    managerName: row.manager_name || '',
    managerEmail: row.manager_email || '',
    managerPhone: row.manager_phone || '',
    description: row.description || '',
    settings: {
      isEcommerceProcessingSource: Boolean(row.is_ecommerce_source),
      isStorePoint: Boolean(row.is_store_point),
      allowInventoryOperations: row.allow_inventory_ops ?? true,
      allowSales: row.allow_sales ?? true,
      allowPurchases: row.allow_purchases ?? true,
      allowTransfers: row.allow_transfers ?? true,
      autoBlockOnZeroStock: row.auto_block_zero_stock ?? true,
      lowStockAlertThresholdPercent: Number(row.low_stock_threshold_percent ?? 15),
      notes: '',
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    inventoryValueAtCost: metrics?.inventoryValueAtCost ?? 0,
    productsCount: metrics?.productsCount ?? 0,
    availableUnits: metrics?.availableUnits ?? 0,
    todaySalesAmount: metrics?.todaySalesAmount ?? 0,
    monthSalesAmount: metrics?.monthSalesAmount ?? 0,
    monthPurchasesAmount: metrics?.monthPurchasesAmount ?? 0,
    estimatedProfit: metrics?.estimatedProfit ?? 0,
    profitMarginPercent: metrics?.profitMarginPercent ?? 0,
    lowStockProductsCount: metrics?.lowStockProductsCount ?? 0,
    outOfStockProductsCount: metrics?.outOfStockProductsCount ?? 0,
    pendingTransfersCount: metrics?.pendingTransfersCount ?? 0,
    activeAlertsCount: metrics?.activeAlertsCount ?? 0,
    assignedUsersCount: metrics?.assignedUsersCount ?? 0,
    openCashRegistersCount: metrics?.openCashRegistersCount ?? 0,
    lastActivityAt: metrics?.lastActivityAt ?? 'Sin actividad reciente',
  }
}

export class WarehouseRepository {
  /**
   * Consulta las bodegas desde public.locations aplicando filtros, orden y paginación bajo RLS.
   */
  async findAll(filters?: WarehouseFilters): Promise<{ data: LocationWithMetrics[]; total: number }> {
    let query = supabaseClient.from('locations').select('*', { count: 'exact' })

    if (filters?.type && filters.type !== 'ALL') {
      query = query.eq('type', filters.type)
    }

    if (filters?.status && filters.status !== 'ALL') {
      query = query.eq('status', filters.status)
    }

    if (filters?.query) {
      const q = filters.query.trim().replace(/[%_]/g, '')
      if (q) {
        query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%,address.ilike.%${q}%,city.ilike.%${q}%,manager_name.ilike.%${q}%`)
      }
    }

    // Ordenamiento
    if (filters?.sortBy === 'NAME_DESC') {
      query = query.order('name', { ascending: false })
    } else if (filters?.sortBy === 'NAME_ASC') {
      query = query.order('name', { ascending: true })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    // Paginación
    const page = Math.max(1, filters?.page || 1)
    const pageSize = Math.max(1, filters?.pageSize || 10)
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data, count, error } = await query

    if (error) {
      console.error('Error al consultar bodegas en Supabase:', error)
      throw new Error(`Error al consultar bodegas: ${error.message}`)
    }

    const rows = data || []
    const total = count ?? rows.length
    const locIds = rows.map((l: any) => l.id)

    // Agregación de métricas reales para las bodegas retornadas
    const userCountsByLoc: Record<string, number> = {}
    const stockMetricsByLoc: Record<string, { count: number; units: number; valCost: number; low: number; out: number }> = {}

    if (locIds.length > 0) {
      // 1. Usuarios asignados
      const { data: userLocs } = await supabaseClient
        .from('user_locations')
        .select('location_id')
        .in('location_id', locIds)

      if (userLocs) {
        userLocs.forEach((ul: any) => {
          userCountsByLoc[ul.location_id] = (userCountsByLoc[ul.location_id] || 0) + 1
        })
      }

      // 2. Existencias y costos reales desde public.stock_levels
      const { data: stockLevels } = await supabaseClient
        .from('stock_levels')
        .select('location_id, quantity, average_cost, min_stock')
        .in('location_id', locIds)

      if (stockLevels) {
        stockLevels.forEach((sl: any) => {
          const lid = sl.location_id
          if (!stockMetricsByLoc[lid]) {
            stockMetricsByLoc[lid] = { count: 0, units: 0, valCost: 0, low: 0, out: 0 }
          }
          const qty = Number(sl.quantity || 0)
          const cost = Number(sl.average_cost || 0)
          const minStock = Number(sl.min_stock || 0)
          stockMetricsByLoc[lid].count += 1
          stockMetricsByLoc[lid].units += qty
          stockMetricsByLoc[lid].valCost += qty * cost
          if (qty === 0) stockMetricsByLoc[lid].out += 1
          else if (qty <= minStock) stockMetricsByLoc[lid].low += 1
        })
      }
    }

    let domainList: LocationWithMetrics[] = rows.map((row: any) => {
      const m = stockMetricsByLoc[row.id]
      const uCount = userCountsByLoc[row.id] || 0
      return mapDbLocationToDomain(row, {
        productsCount: m?.count || 0,
        availableUnits: m?.units || 0,
        inventoryValueAtCost: m?.valCost || 0,
        lowStockProductsCount: m?.low || 0,
        outOfStockProductsCount: m?.out || 0,
        assignedUsersCount: uCount,
      })
    })

    // Filtros de salud de inventario en memoria si aplica
    if (filters?.inventoryHealth && filters.inventoryHealth !== 'ALL') {
      if (filters.inventoryHealth === 'LOW_STOCK') {
        domainList = domainList.filter((loc) => loc.lowStockProductsCount > 0)
      } else if (filters.inventoryHealth === 'OUT_OF_STOCK') {
        domainList = domainList.filter((loc) => loc.outOfStockProductsCount > 0)
      } else if (filters.inventoryHealth === 'CRITICAL') {
        domainList = domainList.filter(
          (loc) => loc.lowStockProductsCount > 20 || loc.outOfStockProductsCount > 5
        )
      } else if (filters.inventoryHealth === 'NORMAL') {
        domainList = domainList.filter(
          (loc) => loc.lowStockProductsCount === 0 && loc.outOfStockProductsCount === 0
        )
      }
    }

    return { data: domainList, total }
  }

  /**
   * Obtiene el detalle de una bodega por su ID
   */
  async findById(id: string): Promise<LocationWithMetrics | null> {
    const { data, error } = await supabaseClient
      .from('locations')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error(`Error buscando ubicación ${id}:`, error)
      throw new Error(`Error consultando bodega: ${error.message}`)
    }
    if (!data) return null

    // Usuarios asignados
    const { count: userCount } = await supabaseClient
      .from('user_locations')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', id)

    // Stock y valoración real
    const { data: stockLevels } = await supabaseClient
      .from('stock_levels')
      .select('quantity, average_cost, min_stock')
      .eq('location_id', id)

    let productsCount = 0
    let availableUnits = 0
    let inventoryValueAtCost = 0
    let lowStockProductsCount = 0
    let outOfStockProductsCount = 0

    if (stockLevels) {
      productsCount = stockLevels.length
      for (const sl of stockLevels) {
        const q = Number(sl.quantity || 0)
        const c = Number(sl.average_cost || 0)
        const min = Number(sl.min_stock || 0)
        availableUnits += q
        inventoryValueAtCost += q * c
        if (q === 0) outOfStockProductsCount++
        else if (q <= min) lowStockProductsCount++
      }
    }

    return mapDbLocationToDomain(data, {
      productsCount,
      availableUnits,
      inventoryValueAtCost,
      lowStockProductsCount,
      outOfStockProductsCount,
      assignedUsersCount: userCount || 0,
    })
  }

  /**
   * Busca si existe una bodega con el código especificado
   */
  async findByCode(code: string): Promise<LocationWithMetrics | null> {
    const { data, error } = await supabaseClient
      .from('locations')
      .select('*')
      .ilike('code', code.trim())
      .maybeSingle()

    if (error) {
      console.error(`Error verificando código ${code}:`, error)
      return null
    }
    if (!data) return null
    return mapDbLocationToDomain(data)
  }

  /**
   * Resuelve el company_id del usuario autenticado actual de forma estricta
   */
  private async resolveCompanyId(preferredCompanyId?: string): Promise<string> {
    return resolveUserCompanyId(supabaseClient, preferredCompanyId)
  }

  /**
   * Inserta una nueva bodega en public.locations bajo RLS
   */
  async create(
    locationData: Omit<LocationWithMetrics, 'id' | 'createdAt' | 'updatedAt' | 'inventoryValueAtCost' | 'productsCount' | 'availableUnits' | 'todaySalesAmount' | 'monthSalesAmount' | 'monthPurchasesAmount' | 'estimatedProfit' | 'profitMarginPercent' | 'lowStockProductsCount' | 'outOfStockProductsCount' | 'pendingTransfersCount' | 'activeAlertsCount' | 'assignedUsersCount' | 'openCashRegistersCount' | 'lastActivityAt'>,
    companyId?: string
  ): Promise<LocationWithMetrics> {
    const resolvedCompanyId = await this.resolveCompanyId(companyId)

    // Si se marca como sede de ecommerce, desactivar las demás de la misma empresa
    if (locationData.settings?.isEcommerceProcessingSource) {
      await supabaseClient
        .from('locations')
        .update({ is_ecommerce_source: false })
        .eq('company_id', resolvedCompanyId)
        .eq('is_ecommerce_source', true)
    }

    const insertPayload = {
      company_id: resolvedCompanyId,
      code: locationData.code.trim().toUpperCase(),
      name: locationData.name.trim(),
      type: locationData.type,
      status: locationData.status || 'ACTIVE',
      address: locationData.address.trim(),
      city: locationData.city.trim(),
      department: locationData.department?.trim() || 'Antioquia',
      phone: locationData.phone?.trim() || null,
      email: locationData.email?.trim() || null,
      manager_name: locationData.managerName?.trim() || null,
      manager_email: locationData.managerEmail?.trim() || null,
      manager_phone: locationData.managerPhone?.trim() || null,
      description: locationData.description?.trim() || null,
      is_ecommerce_source: Boolean(locationData.settings?.isEcommerceProcessingSource),
      is_store_point: Boolean(locationData.settings?.isStorePoint),
      allow_inventory_ops: locationData.settings?.allowInventoryOperations ?? true,
      allow_sales: locationData.settings?.allowSales ?? true,
      allow_purchases: locationData.settings?.allowPurchases ?? true,
      allow_transfers: locationData.settings?.allowTransfers ?? true,
      auto_block_zero_stock: locationData.settings?.autoBlockOnZeroStock ?? true,
      low_stock_threshold_percent: locationData.settings?.lowStockAlertThresholdPercent ?? 15,
    }

    const { data: createdRow, error: insertError } = await supabaseClient
      .from('locations')
      .insert(insertPayload)
      .select()
      .single()

    if (insertError) {
      console.error('Error insertando bodega en Supabase:', insertError)
      throw new Error(`Error al crear bodega: ${insertError.message}`)
    }

    return mapDbLocationToDomain(createdRow)
  }

  /**
   * Actualiza una bodega existente en public.locations
   */
  async update(id: string, updates: Partial<LocationWithMetrics>): Promise<LocationWithMetrics> {
    if (updates.settings?.isEcommerceProcessingSource) {
      await supabaseClient
        .from('locations')
        .update({ is_ecommerce_source: false })
        .neq('id', id)
        .eq('is_ecommerce_source', true)
    }

    const dbUpdates: any = {
      updated_at: new Date().toISOString(),
    }

    if (updates.code !== undefined) dbUpdates.code = updates.code.trim().toUpperCase()
    if (updates.name !== undefined) dbUpdates.name = updates.name.trim()
    if (updates.type !== undefined) dbUpdates.type = updates.type
    if (updates.status !== undefined) dbUpdates.status = updates.status
    if (updates.address !== undefined) dbUpdates.address = updates.address.trim()
    if (updates.city !== undefined) dbUpdates.city = updates.city.trim()
    if (updates.department !== undefined) dbUpdates.department = updates.department.trim()
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone.trim() || null
    if (updates.email !== undefined) dbUpdates.email = updates.email.trim() || null
    if (updates.managerName !== undefined) dbUpdates.manager_name = updates.managerName.trim() || null
    if (updates.managerEmail !== undefined) dbUpdates.manager_email = updates.managerEmail.trim() || null
    if (updates.managerPhone !== undefined) dbUpdates.manager_phone = updates.managerPhone.trim() || null
    if (updates.description !== undefined) dbUpdates.description = updates.description.trim() || null

    if (updates.settings) {
      if (updates.settings.isEcommerceProcessingSource !== undefined) {
        dbUpdates.is_ecommerce_source = updates.settings.isEcommerceProcessingSource
      }
      if (updates.settings.isStorePoint !== undefined) {
        dbUpdates.is_store_point = updates.settings.isStorePoint
      }
      if (updates.settings.allowInventoryOperations !== undefined) {
        dbUpdates.allow_inventory_ops = updates.settings.allowInventoryOperations
      }
      if (updates.settings.allowSales !== undefined) {
        dbUpdates.allow_sales = updates.settings.allowSales
      }
      if (updates.settings.allowPurchases !== undefined) {
        dbUpdates.allow_purchases = updates.settings.allowPurchases
      }
      if (updates.settings.allowTransfers !== undefined) {
        dbUpdates.allow_transfers = updates.settings.allowTransfers
      }
      if (updates.settings.autoBlockOnZeroStock !== undefined) {
        dbUpdates.auto_block_zero_stock = updates.settings.autoBlockOnZeroStock
      }
      if (updates.settings.lowStockAlertThresholdPercent !== undefined) {
        dbUpdates.low_stock_threshold_percent = updates.settings.lowStockAlertThresholdPercent
      }
    }

    const { data: updatedRow, error: updateError } = await supabaseClient
      .from('locations')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error(`Error actualizando bodega ${id}:`, updateError)
      throw new Error(`Error al actualizar bodega: ${updateError.message}`)
    }

    return mapDbLocationToDomain(updatedRow)
  }

  /**
   * Desactiva de forma segura una bodega
   */
  async deactivate(id: string): Promise<LocationWithMetrics> {
    return this.update(id, {
      status: 'INACTIVE',
      settings: {
        isEcommerceProcessingSource: false,
        isStorePoint: false,
        allowInventoryOperations: false,
        allowSales: false,
        allowPurchases: false,
        allowTransfers: false,
        autoBlockOnZeroStock: true,
        lowStockAlertThresholdPercent: 15,
      },
    })
  }

  /**
   * Reactiva una bodega para operaciones normales
   */
  async activate(id: string): Promise<LocationWithMetrics> {
    return this.update(id, {
      status: 'ACTIVE',
      settings: {
        isEcommerceProcessingSource: false,
        isStorePoint: false,
        allowInventoryOperations: true,
        allowSales: true,
        allowPurchases: true,
        allowTransfers: true,
        autoBlockOnZeroStock: true,
        lowStockAlertThresholdPercent: 15,
      },
    })
  }

  /**
   * Helper privado para calcular fechas según PeriodFilter
   */
  private getPeriodDateRange(period?: string): { startDate?: string; endDate?: string } {
    if (!period || period === 'ALL') return {}
    const now = new Date()
    const endIso = now.toISOString()

    if (period === 'TODAY') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
      return { startDate: start.toISOString(), endDate: endIso }
    }
    if (period === '7_DAYS') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return { startDate: start.toISOString(), endDate: endIso }
    }
    if (period === '30_DAYS') {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      return { startDate: start.toISOString(), endDate: endIso }
    }
    if (period === 'MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
      return { startDate: start.toISOString(), endDate: endIso }
    }
    if (period === 'YEAR') {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0)
      return { startDate: start.toISOString(), endDate: endIso }
    }
    return {}
  }

  /**
   * Consulta existencias de inventario para una bodega específica desde PostgreSQL.
   * CUMPLE FASE 4: Todo producto activo de la empresa aparece en la bodega.
   * Si no existe registro en stock_levels, se muestra con cantidad 0 sin crear registros ficticios.
   */
  async findInventoryByLocationId(
    locationId: string,
    filters?: { query?: string; status?: string; category?: string }
  ): Promise<WarehouseInventoryItem[]> {
    // 1. Obtener todos los productos activos de la empresa bajo RLS
    const { data: productsData, error: prodError } = await supabaseClient
      .from('products')
      .select(`
        id,
        sku,
        barcode,
        name,
        unit_of_measure,
        cost_price,
        public_sale_price,
        is_active,
        created_at,
        categories ( name ),
        brands ( name )
      `)
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (prodError || !productsData) {
      console.error('Error al consultar productos activos para inventario de bodega:', prodError)
      return []
    }

    // 2. Obtener los niveles de stock reales para esta bodega
    const { data: stockLevelsData, error: stockError } = await supabaseClient
      .from('stock_levels')
      .select('id, product_id, location_id, quantity, min_stock, max_stock, average_cost, updated_at')
      .eq('location_id', locationId)

    if (stockError) {
      console.error('Error al consultar stock_levels para bodega:', stockError)
    }

    const stockMap = new Map<string, any>()
    if (stockLevelsData) {
      for (const sl of stockLevelsData) {
        stockMap.set(sl.product_id, sl)
      }
    }

    // 3. Cruzar productos con stock: productos sin fila en stock_levels tienen cantidad 0
    let items: WarehouseInventoryItem[] = productsData.map((p: any) => {
      const sl = stockMap.get(p.id)
      const cat = p.categories?.name || 'General'
      const brand = p.brands?.name || 'Genérico'
      const qty = sl ? Number(sl.quantity || 0) : 0
      const cost = sl ? Number(sl.average_cost || 0) : Number(p.cost_price || 0)
      const minStock = sl ? Number(sl.min_stock || 10) : 10
      const maxStock = sl ? Number(sl.max_stock || 1000) : 1000

      let status: WarehouseInventoryItem['status'] = 'NORMAL'
      if (qty === 0) status = 'OUT_OF_STOCK'
      else if (qty <= minStock * 0.3) status = 'CRITICAL'
      else if (qty <= minStock) status = 'LOW_STOCK'

      return {
        id: sl?.id || `stock-virtual-${p.id}-${locationId}`,
        locationId,
        productId: p.id,
        productName: p.name || 'Producto',
        sku: p.sku || 'SKU',
        barcode: p.barcode || '',
        category: cat,
        brand: brand,
        unit: p.unit_of_measure || 'UND',
        currentStock: qty,
        minStock,
        maxStock,
        averageCost: cost,
        totalValueAtCost: qty * cost,
        normalSalePrice: Number(p.public_sale_price || 0),
        status,
        lastMovementAt: sl?.updated_at || 'Sin movimientos registrados',
        updatedAt: sl?.updated_at || p.created_at || new Date().toISOString(),
      }
    })

    // 4. Aplicar filtros en memoria si fueron solicitados
    if (filters?.query) {
      const q = filters.query.toLowerCase().trim()
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

  /**
   * Consulta movimientos de Kardex para una bodega específica desde PostgreSQL
   */
  async findMovementsByLocationId(
    locationId: string,
    filters?: { productId?: string; type?: string; query?: string }
  ): Promise<WarehouseMovement[]> {
    let query = supabaseClient
      .from('inventory_movements')
      .select(`
        id,
        location_id,
        product_id,
        movement_type,
        quantity_in,
        quantity_out,
        previous_stock,
        new_stock,
        unit_cost,
        total_cost,
        document_reference,
        reason,
        user_id,
        created_at,
        products ( name, sku ),
        users ( full_name )
      `)
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })

    if (filters?.productId) {
      query = query.eq('product_id', filters.productId)
    }
    if (filters?.type && filters.type !== 'ALL') {
      query = query.eq('movement_type', filters.type)
    }

    const { data, error } = await query

    if (error || !data) return []

    let items: WarehouseMovement[] = data.map((m: any) => ({
      id: m.id,
      locationId: m.location_id,
      locationName: 'Bodega',
      productId: m.product_id,
      productName: m.products?.name || 'Producto',
      sku: m.products?.sku || 'SKU',
      type: m.movement_type as any,
      documentRef: m.document_reference || '',
      quantityIn: Number(m.quantity_in || 0),
      quantityOut: Number(m.quantity_out || 0),
      previousBalance: Number(m.previous_stock || 0),
      newBalance: Number(m.new_stock || 0),
      unitCost: Number(m.unit_cost || 0),
      totalCost: Number(m.total_cost || 0),
      userId: m.user_id || '',
      userName: m.users?.full_name || 'Sistema',
      notes: m.reason || '',
      createdAt: m.created_at,
    }))

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

  /**
   * Consulta ventas registradas en esta sede desde public.sales con filtro temporal real
   */
  async findSalesByLocationId(locationId: string, period?: string): Promise<WarehouseSaleRecord[]> {
    let query = supabaseClient
      .from('sales')
      .select('*')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })

    const { startDate, endDate } = this.getPeriodDateRange(period)
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data, error } = await query

    if (error || !data) return []

    return data.map((s: any) => ({
      id: s.id,
      locationId: s.location_id,
      saleCode: s.sale_number || `V-${s.id.slice(0, 6)}`,
      date: s.created_at,
      customerName: s.customer_name || 'Cliente',
      customerDoc: s.customer_doc || '',
      sellerName: s.seller_name || 'Vendedor',
      itemsCount: Number(s.items_count || 1),
      totalAmount: Number(s.total_amount || 0),
      costAmount: Number(s.total_cost_amount || 0),
      profitAmount: Number(s.total_amount || 0) - Number(s.total_cost_amount || 0),
      paymentMethod: s.payment_method || 'CASH',
      status: s.status || 'ISSUED',
    }))
  }

  /**
   * Consulta compras recibidas en esta bodega desde public.purchases con filtro temporal real
   */
  async findPurchasesByLocationId(locationId: string, period?: string): Promise<WarehousePurchaseRecord[]> {
    let query = supabaseClient
      .from('purchases')
      .select('*')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })

    const { startDate, endDate } = this.getPeriodDateRange(period)
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data, error } = await query

    if (error || !data) return []

    return data.map((p: any) => ({
      id: p.id,
      locationId: p.location_id,
      invoiceNumber: p.invoice_number || '',
      supplierName: p.supplier_name || 'Proveedor',
      supplierNit: p.supplier_nit || '',
      date: p.created_at,
      itemsCount: Number(p.items_count || 1),
      totalCost: Number(p.total_cost || p.total_amount || 0),
      paymentTerms: (p.payment_terms === 'CREDITO' ? 'CREDITO' : 'CONTADO') as 'CONTADO' | 'CREDITO',
      status: (['PAGADA', 'PENDIENTE', 'POR_VENCER', 'VENCIDA'].includes(p.status) ? p.status : 'PENDIENTE') as 'PAGADA' | 'PENDIENTE' | 'POR_VENCER' | 'VENCIDA',
    }))
  }

  /**
   * Calcula analíticas operativas reales de la bodega desde PostgreSQL (Sin datos mock)
   */
  async getWarehouseOverviewAnalytics(locationId: string): Promise<{
    topSelling: { name: string; sku: string; sales: string; units: number }[]
    categoriesDistribution: { name: string; pct: string; value: string }[]
    weeklyData: { day: string; sales: number; profit: number; ops: number }[]
  }> {
    // 1. Distribución real por categoría a partir de stock_levels reales de la bodega
    const { data: stockRows } = await supabaseClient
      .from('stock_levels')
      .select(`
        quantity,
        average_cost,
        products (
          categories ( name )
        )
      `)
      .eq('location_id', locationId)

    const categoryTotals: Record<string, number> = {}
    let totalStockVal = 0

    if (stockRows && stockRows.length > 0) {
      for (const row of stockRows) {
        const p = row.products as any
        const catName = p?.categories?.name || 'General'
        const qty = Number(row.quantity || 0)
        const cost = Number(row.average_cost || 0)
        const itemVal = qty * cost
        categoryTotals[catName] = (categoryTotals[catName] || 0) + itemVal
        totalStockVal += itemVal
      }
    }

    const categoriesDistribution = Object.entries(categoryTotals)
      .map(([name, val]) => ({
        name,
        pct: totalStockVal > 0 ? `${Math.round((val / totalStockVal) * 100)}%` : '0%',
        value: new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          maximumFractionDigits: 0,
        }).format(val),
        rawVal: val,
      }))
      .sort((a, b) => b.rawVal - a.rawVal)
      .slice(0, 6)
      .map(({ name, pct, value }) => ({ name, pct, value }))

    // 2. Top productos vendidos reales de la bodega desde sale_items
    const { data: salesRows } = await supabaseClient
      .from('sales')
      .select(`
        id,
        created_at,
        total_amount,
        total_cost_amount,
        sale_items (
          product_id,
          quantity,
          total,
          products ( name, sku )
        )
      `)
      .eq('location_id', locationId)
      .neq('status', 'CANCELLED')
      .order('created_at', { ascending: false })
      .limit(500)

    const productSalesMap: Record<string, { name: string; sku: string; units: number; total: number }> = {}

    if (salesRows) {
      for (const sale of salesRows) {
        const items = (sale.sale_items as any[]) || []
        for (const it of items) {
          const pid = it.product_id
          const p = it.products || {}
          if (!productSalesMap[pid]) {
            productSalesMap[pid] = {
              name: p.name || 'Producto',
              sku: p.sku || 'SKU',
              units: 0,
              total: 0,
            }
          }
          productSalesMap[pid].units += Number(it.quantity || 0)
          productSalesMap[pid].total += Number(it.total || 0)
        }
      }
    }

    const topSelling = Object.values(productSalesMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((item) => ({
        name: item.name,
        sku: item.sku,
        units: item.units,
        sales: new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          maximumFractionDigits: 0,
        }).format(item.total),
      }))

    // 3. Ventas de los últimos 7 días agrupadas por día real
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    const today = new Date()
    const last7Days: { dateStr: string; dayLabel: string; sales: number; profit: number; ops: number }[] = []

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
      const dateStr = d.toISOString().slice(0, 10)
      const dayLabel = i === 0 ? 'Hoy' : dayNames[d.getDay()]
      last7Days.push({ dateStr, dayLabel, sales: 0, profit: 0, ops: 0 })
    }

    if (salesRows) {
      for (const s of salesRows) {
        const sDate = s.created_at?.slice(0, 10)
        const bucket = last7Days.find((b) => b.dateStr === sDate)
        if (bucket) {
          const tot = Number(s.total_amount || 0)
          const cost = Number(s.total_cost_amount || 0)
          bucket.sales += tot
          bucket.profit += tot - cost
          bucket.ops += 1
        }
      }
    }

    const weeklyData = last7Days.map((b) => ({
      day: b.dayLabel,
      sales: b.sales,
      profit: b.profit,
      ops: b.ops,
    }))

    return {
      topSelling,
      categoriesDistribution,
      weeklyData,
    }
  }

  /**
   * Consulta relaciones de clientes vinculados
   */
  async findCustomersByLocationId(_locationId: string): Promise<CustomerLocationRelation[]> {
    return []
  }

  /**
   * Consulta relaciones de proveedores vinculados
   */
  async findSuppliersByLocationId(_locationId: string): Promise<SupplierLocationRelation[]> {
    return []
  }

  /**
   * Consulta transferencias desde/hacia esta bodega
   */
  async findTransfersByLocationId(
    locationId: string,
    direction: 'ALL' | 'IN' | 'OUT' = 'ALL'
  ): Promise<WarehouseTransfer[]> {
    let query = supabaseClient.from('transfers').select(`
      id,
      code,
      origin_location_id,
      destination_location_id,
      status,
      created_at,
      updated_at,
      notes,
      origin:origin_location_id ( name ),
      destination:destination_location_id ( name )
    `)

    if (direction === 'IN') {
      query = query.eq('destination_location_id', locationId)
    } else if (direction === 'OUT') {
      query = query.eq('origin_location_id', locationId)
    } else {
      query = query.or(`origin_location_id.eq.${locationId},destination_location_id.eq.${locationId}`)
    }

    const { data, error } = await query

    if (error || !data) return []

    return data.map((t: any) => ({
      id: t.id,
      code: t.code,
      originLocationId: t.origin_location_id,
      originLocationName: t.origin?.name || 'Origen',
      destinationLocationId: t.destination_location_id,
      destinationLocationName: t.destination?.name || 'Destino',
      status: t.status,
      itemsCount: 0,
      totalUnits: 0,
      totalValueAtCost: 0,
      items: [],
      requestedBy: 'Sistema',
      notes: t.notes || '',
      createdAt: t.created_at,
      updatedAt: t.updated_at || t.created_at,
    }))
  }

  /**
   * Consulta los usuarios asignados a esta sede desde public.user_locations
   */
  async findUsersByLocationId(locationId: string): Promise<WarehouseUserAssignment[]> {
    const { data, error } = await supabaseClient
      .from('user_locations')
      .select(`
        user_id,
        is_primary,
        assigned_at,
        users (
          id,
          email,
          full_name,
          roles (
            code,
            name
          )
        )
      `)
      .eq('location_id', locationId)

    if (error || !data) return []

    return data.map((ul: any) => {
      const u = ul.users || {}
      const role = u.roles?.code || 'SELLER'
      return {
        id: `asg-${ul.user_id}-${locationId}`,
        userId: ul.user_id,
        userName: u.full_name || u.email || 'Usuario',
        userEmail: u.email || '',
        userRole: role,
        locationId,
        locationName: 'Sede',
        isPrimaryLocation: Boolean(ul.is_primary),
        assignedAt: ul.assigned_at,
        lastAccessAt: 'Reciente',
        status: 'ACTIVE',
      }
    })
  }


  /**
   * Consulta logs de auditoría para una sede
   */
  async getAuditLogsByLocationId(locationId: string): Promise<WarehouseAuditLog[]> {
    const { data, error } = await supabaseClient
      .from('audit_logs')
      .select('*')
      .eq('entity_name', 'locations')
      .eq('entity_id', locationId)
      .order('created_at', { ascending: false })

    if (error || !data) return []

    return data.map((a: any) => ({
      id: a.id,
      action: a.action,
      locationId: a.entity_id,
      locationName: 'Bodega',
      userId: a.user_id || '',
      userName: a.user_name || 'Sistema',
      timestamp: a.created_at,
      changes: {
        details: a.action,
        previousValue: a.previous_value,
        newValue: a.new_value,
      },
    }))
  }

  /**
   * Asigna un usuario a una sede en public.user_locations
   */
  async assignUser(assignment: WarehouseUserAssignment): Promise<WarehouseUserAssignment> {
    const { error } = await supabaseClient
      .from('user_locations')
      .upsert({
        user_id: assignment.userId,
        location_id: assignment.locationId,
        is_primary: assignment.isPrimaryLocation,
        assigned_at: new Date().toISOString(),
      })

    if (error) {
      console.error('Error asignando usuario a bodega:', error)
      throw new Error(`Error asignando usuario: ${error.message}`)
    }

    return assignment
  }

  /**
   * Desvincula un usuario de una sede en public.user_locations
   */
  async unassignUser(userId: string, locationId: string): Promise<void> {
    const { error } = await supabaseClient
      .from('user_locations')
      .delete()
      .eq('user_id', userId)
      .eq('location_id', locationId)

    if (error) {
      console.error('Error desvinculando usuario de bodega:', error)
      throw new Error(`Error al desvincular usuario: ${error.message}`)
    }
  }

  /**
   * Crea una transferencia logística entre sedes
   */
  async createTransfer(transfer: WarehouseTransfer): Promise<WarehouseTransfer> {
    const { data: authUser } = await supabaseClient.auth.getUser()

    const { data, error } = await supabaseClient
      .from('transfers')
      .insert({
        code: transfer.code,
        origin_location_id: transfer.originLocationId,
        destination_location_id: transfer.destinationLocationId,
        status: 'PENDING',
        created_by_user_id: authUser.user?.id || null,
        notes: transfer.notes,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creando transferencia:', error)
      throw new Error(`Error creando transferencia: ${error.message}`)
    }

    return {
      ...transfer,
      id: data.id,
      status: data.status,
    }
  }
}

export const warehouseRepository = new WarehouseRepository()
