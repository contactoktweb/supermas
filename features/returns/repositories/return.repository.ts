/**
 * SUPER MÁS ERP/POS - Repositorio Real de Devoluciones (ReturnRepository)
 * 
 * Persistencia fiduciaria 100% real en PostgreSQL / Supabase:
 * - Aislamiento multi-tenant estricto mediante resolveUserCompanyId
 * - Enlaces relacionales con customers, suppliers, locations, products y return_items
 * - Invocación a RPCs atómicas con bloqueo pesimista y actualización del Kardex:
 *   * fn_process_customer_return (CUSTOMER_RETURN reingresa a Kardex)
 *   * fn_process_supplier_return (SUPPLIER_RETURN descuenta de Kardex)
 *   * fn_return_disposition_options / fn_list_damaged_return_items / fn_dispatch_damaged_return_item
 *     (068: productos en mal estado con destino producción o proveedor, sin reingreso al stock vendible)
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { supabaseClient } from '@/lib/supabase/client'
import { resolveUserCompanyId } from '@/lib/supabase/tenant'
import {
  ReturnRecord,
  ReturnFilterParams,
  ReturnStats,
  ProcessCustomerReturnInput,
  ProcessSupplierReturnInput,
  ReturnItem,
  ReturnDispositionOptions,
  DamagedReturnFilters,
  DamagedReturnListResult,
  DamagedReturnItem,
  DispatchDamagedItemInput,
  DispatchDamagedItemResult,
} from '../types'

const DEFAULT_DAMAGED_PAGE_SIZE = 15

const RETURN_QUERY_SELECT = `
  id,
  code,
  return_type,
  status,
  source_document_type,
  source_document_id,
  source_document_code,
  customer_id,
  supplier_id,
  location_id,
  total_items,
  total_units,
  total_amount,
  reason,
  notes,
  created_by_user_id,
  created_at,
  updated_at,
  company_id,
  customer:customers!customer_id (
    id,
    company_name,
    commercial_name,
    first_name,
    last_name,
    document_number
  ),
  supplier:suppliers!supplier_id (
    id,
    name,
    commercial_name,
    tax_id
  ),
  location:locations!location_id (
    id,
    code,
    name
  ),
  user:users!created_by_user_id (
    id,
    full_name
  ),
  items:return_items (
    id,
    return_id,
    product_id,
    quantity,
    unit_cost,
    unit_price,
    total_amount,
    reason,
    item_condition,
    disposition_destination,
    disposition_status,
    disposition_notes,
    dispatched_at,
    disposition_supplier:suppliers!disposition_supplier_id (
      name,
      commercial_name
    ),
    disposition_location:locations!disposition_location_id (
      name
    ),
    product:products!product_id (
      id,
      name,
      sku,
      barcode,
      unit_of_measure
    )
  )
`

export class ReturnRepository {
  private client: SupabaseClient

  constructor(client: SupabaseClient = supabaseClient) {
    this.client = client
  }

  /**
   * Obtiene lista de devoluciones con filtros y paginación en PostgreSQL
   */
  async findAll(
    filters: ReturnFilterParams = {},
    companyId?: string
  ): Promise<{
    data: ReturnRecord[]
    total: number
    page: number
    pageSize: number
  }> {
    const activeCompanyId = companyId || (await resolveUserCompanyId(this.client))

    let query = this.client
      .from('returns')
      .select(RETURN_QUERY_SELECT, { count: 'exact' })
      .eq('company_id', activeCompanyId)

    if (filters.returnType && filters.returnType !== 'ALL') {
      query = query.eq('return_type', filters.returnType)
    }

    if (filters.status && filters.status !== 'ALL') {
      query = query.eq('status', filters.status)
    }

    if (filters.locationId && filters.locationId !== 'ALL') {
      query = query.eq('location_id', filters.locationId)
    }

    if (filters.dateFrom) {
      query = query.gte('created_at', filters.dateFrom)
    }

    if (filters.dateTo) {
      query = query.lte('created_at', filters.dateTo)
    }

    if (filters.query && filters.query.trim()) {
      const q = filters.query.trim()
      query = query.or(`code.ilike.%${q}%,source_document_code.ilike.%${q}%,reason.ilike.%${q}%`)
    }

    const isAsc = filters.sortDirection === 'asc'
    if (filters.sortBy === 'code') {
      query = query.order('code', { ascending: isAsc })
    } else if (filters.sortBy === 'total_amount') {
      query = query.order('total_amount', { ascending: isAsc })
    } else {
      query = query.order('created_at', { ascending: isAsc })
    }

    const page = filters.page && filters.page > 0 ? filters.page : 1
    const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 10
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      throw new Error(`Error al consultar devoluciones: ${error.message}`)
    }

    return {
      data: (data || []).map((row: any) => this.mapToDomain(row)),
      total: count || 0,
      page,
      pageSize,
    }
  }

  /**
   * Busca devolución por ID o código consecutivo
   */
  async findById(id: string, companyId?: string): Promise<ReturnRecord | null> {
    const activeCompanyId = companyId || (await resolveUserCompanyId(this.client))

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

    let query = this.client
      .from('returns')
      .select(RETURN_QUERY_SELECT)
      .eq('company_id', activeCompanyId)

    if (isUuid) {
      query = query.eq('id', id)
    } else {
      query = query.eq('code', id)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      throw new Error(`Error al buscar devolución ${id}: ${error.message}`)
    }

    return data ? this.mapToDomain(data) : null
  }

  /**
   * Obtiene devoluciones asociadas a un documento origen (venta o compra)
   */
  async findBySourceDocument(sourceDocId: string, companyId?: string): Promise<ReturnRecord[]> {
    const activeCompanyId = companyId || (await resolveUserCompanyId(this.client))

    const { data, error } = await this.client
      .from('returns')
      .select(RETURN_QUERY_SELECT)
      .eq('company_id', activeCompanyId)
      .eq('source_document_id', sourceDocId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Error al buscar devoluciones del documento ${sourceDocId}: ${error.message}`)
    }

    return (data || []).map((r: any) => this.mapToDomain(r))
  }

  /**
   * Calcula estadísticas consolidadas del módulo de Devoluciones
   */
  async getStats(companyId?: string): Promise<ReturnStats> {
    const activeCompanyId = companyId || (await resolveUserCompanyId(this.client))

    const { data, error } = await this.client
      .from('returns')
      .select('return_type, status, total_units, total_amount')
      .eq('company_id', activeCompanyId)
      .neq('status', 'CANCELLED')

    if (error) {
      throw new Error(`Error al calcular estadísticas de devoluciones: ${error.message}`)
    }

    let customerReturnsCount = 0
    let customerReturnsAmount = 0
    let supplierReturnsCount = 0
    let supplierReturnsAmount = 0
    let totalUnitsReturned = 0

    for (const r of data || []) {
      const units = Number(r.total_units || 0)
      const amount = Number(r.total_amount || 0)
      totalUnitsReturned += units

      if (r.return_type === 'CUSTOMER_RETURN') {
        customerReturnsCount++
        customerReturnsAmount += amount
      } else if (r.return_type === 'SUPPLIER_RETURN') {
        supplierReturnsCount++
        supplierReturnsAmount += amount
      }
    }

    return {
      totalReturns: (data || []).length,
      customerReturnsCount,
      customerReturnsAmount,
      supplierReturnsCount,
      supplierReturnsAmount,
      totalUnitsReturned,
    }
  }

  /**
   * Procesa devolución de cliente mediante la RPC atómica fn_process_customer_return
   */
  async processCustomerReturn(input: ProcessCustomerReturnInput): Promise<ReturnRecord> {
    const itemsJson = input.items.map((it) => ({
      product_id: it.productId,
      quantity: it.quantity,
      reason: it.reason || null,
      condition: it.condition,
      destination: it.condition === 'MAL_ESTADO' ? it.destination || null : null,
      supplier_id: it.condition === 'MAL_ESTADO' && it.destination === 'PROVEEDOR' ? it.supplierId || null : null,
      production_location_id:
        it.condition === 'MAL_ESTADO' && it.destination === 'PRODUCCION' ? it.productionLocationId || null : null,
      disposition_notes: it.condition === 'MAL_ESTADO' ? it.dispositionNotes?.trim() || null : null,
    }))

    const { data, error } = await this.client.rpc('fn_process_customer_return', {
      p_sale_id: input.saleId,
      p_items: itemsJson,
      p_reason: input.reason,
      p_notes: input.notes || null,
    })

    if (error) {
      throw new Error(`Error al procesar devolución de cliente: ${error.message}`)
    }

    const createdId = data.return_id
    const record = await this.findById(createdId)
    if (!record) {
      throw new Error(`Devolución procesada pero no se pudo recuperar con ID ${createdId}`)
    }
    return record
  }

  /**
   * Procesa devolución a proveedor mediante la RPC atómica fn_process_supplier_return
   */
  async processSupplierReturn(input: ProcessSupplierReturnInput): Promise<ReturnRecord> {
    const itemsJson = input.items.map((it) => ({
      product_id: it.productId,
      quantity: it.quantity,
      reason: it.reason || null,
    }))

    const { data, error } = await this.client.rpc('fn_process_supplier_return', {
      p_purchase_id: input.purchaseId,
      p_items: itemsJson,
      p_reason: input.reason,
      p_notes: input.notes || null,
    })

    if (error) {
      throw new Error(`Error al procesar devolución a proveedor: ${error.message}`)
    }

    const createdId = data.return_id
    const record = await this.findById(createdId)
    if (!record) {
      throw new Error(`Devolución procesada pero no se pudo recuperar con ID ${createdId}`)
    }
    return record
  }

  /**
   * Obtiene ventas con productos disponibles para devolución
   */
  async getReturnableSales(companyId?: string): Promise<any[]> {
    const activeCompanyId = companyId || (await resolveUserCompanyId(this.client))

    const { data, error } = await this.client
      .from('sales')
      .select(`
        id,
        sale_number,
        total_amount,
        created_at,
        customer_id,
        location_id,
        customer:customers!customer_id (id, company_name, commercial_name, first_name, last_name, document_number),
        location:locations!location_id (id, name),
        items:sale_items (id, product_id, quantity, unit_price, unit_cost, product:products!product_id(id, name, sku))
      `)
      .eq('company_id', activeCompanyId)
      .neq('status', 'CANCELLED')
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Error al consultar ventas para devolución: ${error.message}`)
    }

    return (data || []).map((s: any) => {
      const custName = s.customer
        ? (s.customer.company_name || s.customer.commercial_name || `${s.customer.first_name || ''} ${s.customer.last_name || ''}`).trim()
        : 'Cliente'
      return {
        id: s.id,
        saleNumber: s.sale_number,
        totalAmount: s.total_amount,
        createdAt: s.created_at,
        customerName: custName,
        customerDoc: s.customer?.document_number || '',
        locationId: s.location_id,
        locationName: s.location?.name || '',
        items: s.items || [],
      }
    })
  }

  /**
   * Obtiene compras con productos disponibles para devolución a proveedor
   */
  async getReturnablePurchases(companyId?: string): Promise<any[]> {
    const activeCompanyId = companyId || (await resolveUserCompanyId(this.client))

    const { data, error } = await this.client
      .from('purchases')
      .select(`
        id,
        purchase_number,
        supplier_invoice_number,
        total_amount,
        created_at,
        supplier_id,
        location_id,
        supplier:suppliers!supplier_id (id, name, commercial_name, tax_id),
        location:locations!location_id (id, name),
        items:purchase_items (id, product_id, quantity, received_quantity, unit_cost, product:products!product_id(id, name, sku))
      `)
      .eq('company_id', activeCompanyId)
      .eq('inventory_status', 'RECEIVED')
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Error al consultar compras para devolución: ${error.message}`)
    }

    return (data || []).map((p: any) => {
      const suppName = p.supplier
        ? (p.supplier.commercial_name || p.supplier.name || 'Proveedor').trim()
        : 'Proveedor'
      return {
        id: p.id,
        purchaseNumber: p.purchase_number,
        supplierInvoiceNumber: p.supplier_invoice_number,
        totalAmount: p.total_amount,
        createdAt: p.created_at,
        supplierName: suppName,
        supplierNit: p.supplier?.tax_id || '',
        locationId: p.location_id,
        locationName: p.location?.name || '',
        items: p.items || [],
      }
    })
  }

  /**
   * Proveedores activos, sedes activas y proveedor sugerido por producto (última compra recibida)
   * para elegir el destino de los productos en mal estado de una venta.
   */
  async getDispositionOptions(saleId: string): Promise<ReturnDispositionOptions> {
    const { data, error } = await this.client.rpc('fn_return_disposition_options', { p_sale_id: saleId })

    if (error) {
      throw new Error(`No se pudieron cargar proveedores y sedes para la devolución: ${error.message}`)
    }

    const raw = (data || {}) as {
      suppliers?: { id: string; name: string; tax_id: string }[]
      locations?: { id: string; code: string; name: string }[]
      suggestions?: {
        product_id: string
        supplier_id: string
        supplier_name: string
        purchase_number: string
        purchase_date: string | null
      }[]
    }

    return {
      suppliers: (raw.suppliers || []).map((s) => ({ id: s.id, name: s.name, taxId: s.tax_id })),
      locations: (raw.locations || []).map((l) => ({ id: l.id, code: l.code, name: l.name })),
      suggestions: (raw.suggestions || []).map((s) => ({
        productId: s.product_id,
        supplierId: s.supplier_id,
        supplierName: s.supplier_name,
        purchaseNumber: s.purchase_number,
        purchaseDate: s.purchase_date,
      })),
    }
  }

  /**
   * Listado "Productos en mal estado por destino" (paginado en PostgreSQL).
   */
  async listDamagedItems(filters: DamagedReturnFilters = {}): Promise<DamagedReturnListResult> {
    const page = filters.page && filters.page > 0 ? filters.page : 1
    const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : DEFAULT_DAMAGED_PAGE_SIZE

    const { data, error } = await this.client.rpc('fn_list_damaged_return_items', {
      p_destination: filters.destination && filters.destination !== 'ALL' ? filters.destination : null,
      p_status: filters.status && filters.status !== 'ALL' ? filters.status : null,
      p_search: filters.query?.trim() || null,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    })

    if (error) {
      throw new Error(`Error al consultar productos en mal estado: ${error.message}`)
    }

    const raw = (data || {}) as {
      rows?: any[]
      total?: number
      show_cost?: boolean
      summary?: {
        pending_supplier_units?: number
        pending_production_units?: number
        pending_lines?: number
        sent_lines?: number
      }
    }

    return {
      data: (raw.rows || []).map((row) => this.mapDamagedItem(row)),
      total: Number(raw.total || 0),
      page,
      pageSize,
      showCost: Boolean(raw.show_cost),
      summary: {
        pendingSupplierUnits: Number(raw.summary?.pending_supplier_units || 0),
        pendingProductionUnits: Number(raw.summary?.pending_production_units || 0),
        pendingLines: Number(raw.summary?.pending_lines || 0),
        sentLines: Number(raw.summary?.sent_lines || 0),
      },
    }
  }

  /**
   * Marca una línea en mal estado como enviada a producción o al proveedor (Kardex, auditoría y DC).
   */
  async dispatchDamagedItem(input: DispatchDamagedItemInput): Promise<DispatchDamagedItemResult> {
    const { data, error } = await this.client.rpc('fn_dispatch_damaged_return_item', {
      p_return_item_id: input.returnItemId,
      p_dispatch_reference: input.dispatchReference?.trim() || null,
      p_notes: input.notes?.trim() || null,
    })

    if (error) {
      throw new Error(`No se pudo marcar como enviado: ${error.message}`)
    }

    return {
      alreadyDispatched: Boolean(data?.already_dispatched),
      accountingEntryNumber: data?.accounting_entry_number || null,
      accountingNote: data?.accounting_note || null,
    }
  }

  private mapDamagedItem(row: any): DamagedReturnItem {
    return {
      id: row.id,
      returnId: row.return_id,
      returnCode: row.return_code,
      returnDate: row.return_date,
      saleNumber: row.sale_number || null,
      locationName: row.location_name || null,
      customerName: row.customer_name || null,
      productId: row.product_id,
      productName: row.product_name || 'Producto',
      sku: row.sku || null,
      quantity: Number(row.quantity || 0),
      unitCost: row.unit_cost === null || row.unit_cost === undefined ? null : Number(row.unit_cost),
      totalCost: row.total_cost === null || row.total_cost === undefined ? null : Number(row.total_cost),
      reason: row.reason || null,
      destination: row.destination,
      status: row.status,
      supplierName: row.supplier_name || null,
      supplierTaxId: row.supplier_tax_id || null,
      purchaseNumber: row.purchase_number || null,
      productionLocationName: row.production_location_name || null,
      dispositionNotes: row.disposition_notes || null,
      registeredByName: row.registered_by_name || null,
      dispatchedAt: row.dispatched_at || null,
      dispatchedByName: row.dispatched_by_name || null,
      dispatchReference: row.dispatch_reference || null,
      dispatchNotes: row.dispatch_notes || null,
      returnEntryNumber: row.return_entry_number || null,
      dispatchEntryNumber: row.dispatch_entry_number || null,
    }
  }

  private mapToDomain(raw: any): ReturnRecord {
    const custName = raw.customer
      ? (raw.customer.company_name || raw.customer.commercial_name || `${raw.customer.first_name || ''} ${raw.customer.last_name || ''}`).trim()
      : null
    const suppName = raw.supplier
      ? (raw.supplier.commercial_name || raw.supplier.name || '').trim()
      : null

    const mappedItems: ReturnItem[] = (raw.items || []).map((it: any) => ({
      id: it.id,
      returnId: it.return_id,
      productId: it.product_id,
      productName: it.product?.name || 'Producto',
      sku: it.product?.sku || '',
      barcode: it.product?.barcode || undefined,
      unitOfMeasure: it.product?.unit_of_measure || undefined,
      quantity: Number(it.quantity || 0),
      unitCost: Number(it.unit_cost || 0),
      unitPrice: Number(it.unit_price || 0),
      totalAmount: Number(it.total_amount || 0),
      reason: it.reason || undefined,
      condition: it.item_condition === 'MAL_ESTADO' ? 'MAL_ESTADO' : 'BUENO',
      destination: it.disposition_destination || null,
      dispositionStatus: it.disposition_status || null,
      dispositionSupplierName: it.disposition_supplier
        ? (it.disposition_supplier.commercial_name || it.disposition_supplier.name || '').trim() || null
        : null,
      dispositionLocationName: it.disposition_location?.name || null,
      dispositionNotes: it.disposition_notes || null,
      dispatchedAt: it.dispatched_at || null,
    }))

    return {
      id: raw.id,
      code: raw.code,
      returnType: raw.return_type,
      status: raw.status,
      sourceDocumentType: raw.source_document_type,
      sourceDocumentId: raw.source_document_id,
      sourceDocumentCode: raw.source_document_code || undefined,
      customerId: raw.customer_id || null,
      customerName: custName,
      supplierId: raw.supplier_id || null,
      supplierName: suppName,
      locationId: raw.location_id,
      locationName: raw.location?.name || 'Bodega',
      totalItems: Number(raw.total_items || mappedItems.length),
      totalUnits: Number(raw.total_units || 0),
      totalAmount: Number(raw.total_amount || 0),
      reason: raw.reason,
      notes: raw.notes || null,
      createdByUserId: raw.created_by_user_id || null,
      createdByUserName: raw.user?.full_name || null,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
      items: mappedItems,
    }
  }
}

export const returnRepository = new ReturnRepository()
