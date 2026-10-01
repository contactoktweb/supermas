import {
  InventoryMovement,
  KardexFilterParams,
  GlobalKardexStats,
  KardexPaginationResult,
  ProductKardexSummary,
  MovementType,
  SourceDocumentType,
} from '../types'
import { supabaseClient } from '@/lib/supabase/client'

function mapDbMovementTypeToDomain(type: string): MovementType {
  switch (type) {
    case 'PURCHASE_ENTRY':
      return 'COMPRA'
    case 'SALE_OUT':
      return 'VENTA'
    case 'TRANSFER_IN':
      return 'TRANSFERENCIA_ENTRADA'
    case 'TRANSFER_OUT':
      return 'TRANSFERENCIA_SALIDA'
    case 'POSITIVE_ADJUSTMENT':
      return 'AJUSTE_ENTRADA'
    case 'NEGATIVE_ADJUSTMENT':
      return 'AJUSTE_SALIDA'
    case 'CUSTOMER_RETURN':
    case 'SUPPLIER_RETURN':
      return 'DEVOLUCION'
    default:
      return (type as MovementType) || 'AJUSTE_ENTRADA'
  }
}

function mapDomainMovementTypeToDb(type: string): string {
  switch (type) {
    case 'COMPRA':
      return 'PURCHASE_ENTRY'
    case 'VENTA':
      return 'SALE_OUT'
    case 'TRANSFERENCIA_ENTRADA':
      return 'TRANSFER_IN'
    case 'TRANSFERENCIA_SALIDA':
      return 'TRANSFER_OUT'
    case 'AJUSTE_ENTRADA':
      return 'POSITIVE_ADJUSTMENT'
    case 'AJUSTE_SALIDA':
      return 'NEGATIVE_ADJUSTMENT'
    case 'DEVOLUCION':
      return 'CUSTOMER_RETURN'
    default:
      return type
  }
}

function mapDbDocumentTypeToDomain(docType: string): SourceDocumentType {
  switch (docType) {
    case 'PURCHASE_INVOICE':
      return 'PURCHASE_INVOICE'
    case 'SALE':
    case 'POS_SALE':
      return 'POS_SALE'
    case 'TRANSFER':
    case 'WAREHOUSE_TRANSFER':
      return 'WAREHOUSE_TRANSFER'
    case 'ADJUSTMENT':
    case 'INVENTARIO_INICIAL':
      return 'STOCK_ADJUSTMENT'
    case 'CUSTOMER_RETURN':
      return 'CUSTOMER_RETURN'
    case 'REMISSION':
      return 'REMISSION_ORDER'
    case 'REVERSION':
      return 'REVERSION_ENTRY'
    default:
      return 'STOCK_ADJUSTMENT'
  }
}

export class KardexRepository {
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
    throw new Error('No se pudo resolver la empresa asociada para operaciones de Kardex.')
  }

  /**
   * Consulta paginada y filtrada de movimientos de inventario (Kardex) directamente desde PostgreSQL.
   * Regla Fase 4: Estrictamente inmutable, lectura real de public.inventory_movements bajo RLS.
   */
  async findMany(filters: KardexFilterParams): Promise<KardexPaginationResult> {
    let query = supabaseClient
      .from('inventory_movements')
      .select(`
        id,
        consecutive,
        product_id,
        location_id,
        movement_type,
        quantity_in,
        quantity_out,
        previous_stock,
        new_stock,
        unit_cost,
        total_cost,
        document_type,
        document_reference,
        reason,
        user_id,
        created_at,
        products (
          id,
          sku,
          barcode,
          name,
          unit_type,
          image_url,
          categories ( name )
        ),
        locations (
          id,
          code,
          name
        ),
        users (
          id,
          full_name,
          email,
          roles ( name )
        )
      `, { count: 'exact' })

    // Filtros de base de datos
    if (filters.productId && filters.productId !== 'ALL') {
      query = query.eq('product_id', filters.productId)
    }

    if (filters.locationId && filters.locationId !== 'ALL') {
      query = query.eq('location_id', filters.locationId)
    }

    if (filters.movementType && filters.movementType !== 'ALL') {
      const dbType = mapDomainMovementTypeToDb(filters.movementType)
      query = query.eq('movement_type', dbType)
    }

    if (filters.userId && filters.userId !== 'ALL') {
      query = query.eq('user_id', filters.userId)
    }

    if (filters.documentQuery && filters.documentQuery.trim() !== '') {
      query = query.ilike('document_reference', `%${filters.documentQuery.trim()}%`)
    }

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate)
    }
    if (filters.endDate) {
      const endStr = filters.endDate.includes('T') ? filters.endDate : `${filters.endDate}T23:59:59.999Z`
      query = query.lte('created_at', endStr)
    }

    // Ordenamiento por fecha descendente
    query = query.order('created_at', { ascending: filters.sortDirection === 'asc' ? true : false })

    const { data, count, error } = await query

    if (error || !data) {
      console.error('Error al consultar Kardex en PostgreSQL:', error)
      return {
        items: [],
        total: 0,
        page: filters.page || 1,
        pageSize: filters.pageSize || 10,
        totalPages: 1,
        isCostRedacted: false,
      }
    }

    // Mapeo a dominio
    let items: InventoryMovement[] = data.map((row: any) => {
      const p = row.products || {}
      const loc = row.locations || {}
      const u = row.users || {}
      const qIn = Number(row.quantity_in || 0)
      const qOut = Number(row.quantity_out || 0)
      const prevStock = Number(row.previous_stock || 0)
      const newStock = Number(row.new_stock || 0)
      const uCost = Number(row.unit_cost || 0)
      const tCost = Number(row.total_cost || 0)

      return {
        id: row.id,
        movementNumber: `MOV-${row.consecutive ? String(row.consecutive).padStart(6, '0') : row.id.slice(0, 8)}`,
        createdAt: row.created_at,
        productId: row.product_id,
        productName: p.name || 'Producto',
        sku: p.sku || 'SKU',
        barcode: p.barcode || '',
        category: p.categories?.name || 'General',
        unitOfMeasure: p.unit_type || 'UND',
        imageUrl: p.image_url || undefined,
        locationId: row.location_id,
        locationName: loc.name || 'Bodega',
        locationCode: loc.code || 'BOD',
        type: mapDbMovementTypeToDomain(row.movement_type),
        quantityIn: qIn,
        quantityOut: qOut,
        quantityDelta: qIn - qOut,
        previousStock: prevStock,
        resultingStock: newStock,
        unitCost: uCost,
        averageCostAfter: uCost,
        totalValue: tCost,
        sourceDocumentType: mapDbDocumentTypeToDomain(row.document_type),
        sourceDocumentId: row.document_reference || row.id,
        sourceDocumentNumber: row.document_reference || `DOC-${row.id.slice(0, 6)}`,
        userId: row.user_id || '',
        userName: u.full_name || u.email || 'Sistema',
        userRole: u.roles?.name || 'ADMIN',
        notes: row.reason || '',
        isReversion: row.reason?.toLowerCase().includes('reversión') || false,
      }
    })

    // Filtro por texto general en memoria para los campos relacionados
    if (filters.query && filters.query.trim() !== '') {
      const q = filters.query.toLowerCase().trim()
      items = items.filter(
        (m) =>
          m.productName.toLowerCase().includes(q) ||
          m.sku.toLowerCase().includes(q) ||
          (m.barcode && m.barcode.toLowerCase().includes(q)) ||
          m.sourceDocumentNumber.toLowerCase().includes(q) ||
          m.userName.toLowerCase().includes(q) ||
          m.locationName.toLowerCase().includes(q) ||
          m.locationCode.toLowerCase().includes(q) ||
          (m.notes && m.notes.toLowerCase().includes(q))
      )
    }

    if (filters.sku && filters.sku.trim() !== '') {
      items = items.filter((m) => m.sku.toLowerCase() === filters.sku!.toLowerCase().trim())
    }

    const total = count !== null ? count : items.length
    const page = Math.max(1, filters.page || 1)
    const pageSize = Math.max(1, filters.pageSize || 10)
    const totalPages = Math.ceil(items.length / pageSize) || 1
    const startIndex = (page - 1) * pageSize
    const paginatedItems = items.slice(startIndex, startIndex + pageSize)

    return {
      items: paginatedItems,
      total: items.length,
      page,
      pageSize,
      totalPages,
      isCostRedacted: false,
    }
  }

  /**
   * Obtiene un movimiento por su ID único desde PostgreSQL
   */
  async findById(id: string): Promise<InventoryMovement | null> {
    const { data, error } = await supabaseClient
      .from('inventory_movements')
      .select(`
        id,
        consecutive,
        product_id,
        location_id,
        movement_type,
        quantity_in,
        quantity_out,
        previous_stock,
        new_stock,
        unit_cost,
        total_cost,
        document_type,
        document_reference,
        reason,
        user_id,
        created_at,
        products (
          id,
          sku,
          barcode,
          name,
          unit_type,
          image_url,
          categories ( name )
        ),
        locations (
          id,
          code,
          name
        ),
        users (
          id,
          full_name,
          email,
          roles ( name )
        )
      `)
      .eq('id', id)
      .maybeSingle()

    if (error || !data) return null

    const p = data.products as any || {}
    const loc = data.locations as any || {}
    const u = data.users as any || {}
    const qIn = Number(data.quantity_in || 0)
    const qOut = Number(data.quantity_out || 0)

    return {
      id: data.id,
      movementNumber: `MOV-${data.consecutive ? String(data.consecutive).padStart(6, '0') : data.id.slice(0, 8)}`,
      createdAt: data.created_at,
      productId: data.product_id,
      productName: p.name || 'Producto',
      sku: p.sku || 'SKU',
      barcode: p.barcode || '',
      category: p.categories?.name || 'General',
      unitOfMeasure: p.unit_type || 'UND',
      imageUrl: p.image_url || undefined,
      locationId: data.location_id,
      locationName: loc.name || 'Bodega',
      locationCode: loc.code || 'BOD',
      type: mapDbMovementTypeToDomain(data.movement_type),
      quantityIn: qIn,
      quantityOut: qOut,
      quantityDelta: qIn - qOut,
      previousStock: Number(data.previous_stock || 0),
      resultingStock: Number(data.new_stock || 0),
      unitCost: Number(data.unit_cost || 0),
      averageCostAfter: Number(data.unit_cost || 0),
      totalValue: Number(data.total_cost || 0),
      sourceDocumentType: mapDbDocumentTypeToDomain(data.document_type),
      sourceDocumentId: data.document_reference || data.id,
      sourceDocumentNumber: data.document_reference || `DOC-${data.id.slice(0, 6)}`,
      userId: data.user_id || '',
      userName: u.full_name || u.email || 'Sistema',
      userRole: u.roles?.name || 'ADMIN',
      notes: data.reason || '',
      isReversion: data.reason?.toLowerCase().includes('reversión') || false,
    }
  }

  /**
   * Resumen de Kardex para un producto específico consultando existencias y últimos movimientos reales
   */
  async findProductKardexSummary(productId: string): Promise<ProductKardexSummary | null> {
    const { data: prod } = await supabaseClient
      .from('products')
      .select('id, name, sku, image_url, unit_type, categories(name)')
      .eq('id', productId)
      .maybeSingle()

    if (!prod) return null

    // Existencias por bodega desde public.stock_levels
    const { data: stockLevels } = await supabaseClient
      .from('stock_levels')
      .select(`
        location_id,
        quantity,
        locations ( id, name, code )
      `)
      .eq('product_id', productId)

    const warehousesDistribution = (stockLevels || []).map((sl: any) => ({
      locationId: sl.location_id,
      locationName: sl.locations?.name || 'Bodega',
      locationCode: sl.locations?.code || 'BOD',
      stock: Number(sl.quantity || 0),
    }))

    const totalStock = warehousesDistribution.reduce((acc, w) => acc + w.stock, 0)

    // Último movimiento
    const { data: lastMov } = await supabaseClient
      .from('inventory_movements')
      .select('created_at, movement_type')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return {
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      category: (prod.categories as any)?.name || 'General',
      imageUrl: prod.image_url || undefined,
      totalStockAllWarehouses: totalStock,
      unitOfMeasure: prod.unit_type || 'UND',
      warehousesDistribution,
      lastMovementAt: lastMov?.created_at || 'Sin movimientos',
      lastMovementType: lastMov ? mapDbMovementTypeToDomain(lastMov.movement_type) : 'AJUSTE_ENTRADA',
    }
  }

  /**
   * Estadísticas globales de movimientos del periodo desde PostgreSQL
   */
  async getGlobalStats(filters?: KardexFilterParams): Promise<GlobalKardexStats> {
    let query = supabaseClient
      .from('inventory_movements')
      .select('product_id, movement_type, quantity_in, quantity_out, total_cost')

    if (filters?.locationId && filters.locationId !== 'ALL') {
      query = query.eq('location_id', filters.locationId)
    }
    if (filters?.productId && filters.productId !== 'ALL') {
      query = query.eq('product_id', filters.productId)
    }
    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate)
    }
    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate + 'T23:59:59.999Z')
    }

    const { data, error } = await query

    if (error || !data) {
      return {
        totalMovements: 0,
        totalEntriesCount: 0,
        totalExitsCount: 0,
        totalUnitsIn: 0,
        totalUnitsOut: 0,
        totalValueInAtCost: 0,
        totalValueOutAtCost: 0,
        distinctProductsCount: 0,
        isCostRedacted: false,
      }
    }

    let totalEntriesCount = 0
    let totalExitsCount = 0
    let totalUnitsIn = 0
    let totalUnitsOut = 0
    let totalValueInAtCost = 0
    let totalValueOutAtCost = 0
    const prodSet = new Set<string>()

    for (const m of data) {
      const qIn = Number(m.quantity_in || 0)
      const qOut = Number(m.quantity_out || 0)
      const val = Number(m.total_cost || 0)

      if (qIn > 0) {
        totalEntriesCount++
        totalUnitsIn += qIn
        totalValueInAtCost += val
      }
      if (qOut > 0) {
        totalExitsCount++
        totalUnitsOut += qOut
        totalValueOutAtCost += val
      }
      prodSet.add(m.product_id)
    }

    return {
      totalMovements: data.length,
      totalEntriesCount,
      totalExitsCount,
      totalUnitsIn,
      totalUnitsOut,
      totalValueInAtCost,
      totalValueOutAtCost,
      distinctProductsCount: prodSet.size,
      isCostRedacted: false,
    }
  }

  /**
   * Registra una reversión compensatoria inmutable en PostgreSQL.
   * REGLA FASE 4: Inmutabilidad estricta. No modifica ni elimina el registro original;
   * inserta un nuevo movimiento compensatorio en public.inventory_movements.
   */
  async createReversion(
    originalMovementId: string,
    reason: string,
    userName: string,
    userRole: string
  ): Promise<InventoryMovement> {
    const original = await this.findById(originalMovementId)
    if (!original) {
      throw new Error(`El movimiento ${originalMovementId} no existe en el Kardex.`)
    }

    const isOriginalEntry = original.quantityIn > 0
    const qty = isOriginalEntry ? original.quantityIn : original.quantityOut

    const companyId = await this.resolveCompanyId()
    const revNumber = `REV-${Date.now().toString().slice(-6)}`

    // Consulta el stock actual antes de revertir
    const { data: currentStockLevel } = await supabaseClient
      .from('stock_levels')
      .select('quantity, average_cost')
      .eq('product_id', original.productId)
      .eq('location_id', original.locationId)
      .maybeSingle()

    const previousStock = currentStockLevel ? Number(currentStockLevel.quantity || 0) : 0
    const unitCost = currentStockLevel ? Number(currentStockLevel.average_cost || 0) : original.unitCost

    if (isOriginalEntry && previousStock < qty) {
      throw new Error(
        `No se puede revertir la entrada original de ${qty} unidades porque el saldo actual en bodega (${previousStock}) es inferior a la cantidad a compensar.`
      )
    }

    const resultingStock = isOriginalEntry ? previousStock - qty : previousStock + qty
    const movementType = isOriginalEntry ? 'NEGATIVE_ADJUSTMENT' : 'POSITIVE_ADJUSTMENT'

    const { data: authUser } = await supabaseClient.auth.getUser()

    const { data: newRow, error } = await supabaseClient
      .from('inventory_movements')
      .insert({
        company_id: companyId,
        product_id: original.productId,
        location_id: original.locationId,
        movement_type: movementType,
        quantity_in: isOriginalEntry ? 0 : qty,
        quantity_out: isOriginalEntry ? qty : 0,
        previous_stock: previousStock,
        new_stock: resultingStock,
        unit_cost: unitCost,
        total_cost: qty * unitCost,
        document_type: 'REVERSION',
        document_reference: revNumber,
        reason: `Reversión de movimiento ${original.sourceDocumentNumber}. Motivo: ${reason}`,
        user_id: authUser.user?.id || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error insertando movimiento de reversión:', error)
      throw new Error(`Error al crear reversión: ${error.message}`)
    }

    return (await this.findById(newRow.id))!
  }

  /**
   * Registra un movimiento inmutable en el Kardex (public.inventory_movements).
   */
  async recordMovement(input: {
    productId: string
    productName: string
    sku: string
    barcode?: string
    category?: string
    unitOfMeasure?: string
    imageUrl?: string
    locationId: string
    locationName: string
    locationCode: string
    timestamp?: string
    type: any
    sourceDocType: any
    sourceDocNumber: string
    sourceDocId?: string
    quantityIn: number
    quantityOut: number
    previousStock: number
    resultingStock: number
    unitCost: number
    totalCost: number
    unitPrice?: number
    totalPrice?: number
    responsibleUserId: string
    responsibleUserName: string
    responsibleUserRole?: string
    notes?: string
    evidenceUrl?: string
  }): Promise<InventoryMovement> {
    const companyId = await this.resolveCompanyId()
    const dbMovementType = mapDomainMovementTypeToDb(input.type)

    const { data, error } = await supabaseClient
      .from('inventory_movements')
      .insert({
        company_id: companyId,
        product_id: input.productId,
        location_id: input.locationId,
        movement_type: dbMovementType,
        quantity_in: input.quantityIn,
        quantity_out: input.quantityOut,
        previous_stock: input.previousStock,
        new_stock: input.resultingStock,
        unit_cost: input.unitCost,
        total_cost: input.totalCost,
        document_type: String(input.sourceDocType || 'ADJUSTMENT'),
        document_reference: input.sourceDocNumber,
        reason: input.notes,
        user_id: input.responsibleUserId || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error insertando movimiento en Kardex:', error)
      throw new Error(`Error al registrar movimiento: ${error.message}`)
    }

    return (await this.findById(data.id))!
  }

  /**
   * Obtiene opciones reales de bodegas y usuarios para los filtros del Kardex
   */
  async getFilterOptions(): Promise<{
    locations: Array<{ value: string; label: string }>
    users: Array<{ value: string; label: string }>
  }> {
    const [locsRes, usersRes] = await Promise.all([
      supabaseClient
        .from('locations')
        .select('id, code, name')
        .eq('status', 'ACTIVE')
        .order('name', { ascending: true }),
      supabaseClient
        .from('users')
        .select('id, full_name, email')
        .order('full_name', { ascending: true }),
    ])

    const locations = [
      { value: 'ALL', label: 'Todas las bodegas' },
      ...(locsRes.data || []).map((l: any) => ({
        value: l.id,
        label: l.code ? `[${l.code}] ${l.name}` : l.name,
      })),
    ]

    const users = [
      { value: 'ALL', label: 'Todos los responsables' },
      ...(usersRes.data || []).map((u: any) => ({
        value: u.id,
        label: u.full_name || u.email || 'Usuario',
      })),
    ]

    return { locations, users }
  }
}

export const kardexRepository = new KardexRepository()
