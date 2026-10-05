/**
 * SUPER MÁS ERP/POS - Repositorio Real de Remisiones (RemissionRepository)
 * 
 * Persistencia fiduciaria 100% real en PostgreSQL / Supabase:
 * - Aislamiento multi-tenant estricto mediante resolveUserCompanyId
 * - Enlaces relacionales con customers, locations, products y remission_items
 * - Invocación a RPCs atómicas con bloqueo pesimista y actualización del Kardex:
 *   * fn_create_remission
 *   * fn_update_remission_draft
 *   * fn_dispatch_remission (SALE_OUT en Kardex)
 *   * fn_deliver_remission (Confirmación de entrega)
 *   * fn_cancel_remission (CUSTOMER_RETURN reversión a Kardex si estaba despachada)
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { supabaseClient } from '@/lib/supabase/client'
import { resolveUserCompanyId } from '@/lib/supabase/tenant'
import {
  Remission,
  RemissionFilters,
  RemissionStats,
  DispatchRemissionPayload,
  DeliverRemissionPayload,
  RemissionItem,
  CreateRemissionPayload,
} from '../types'

const REMISSION_QUERY_SELECT = `
  id,
  code,
  sale_id,
  customer_id,
  origin_location_id,
  status,
  driver_name,
  driver_doc,
  driver_license,
  vehicle_plate,
  carrier_name,
  dispatch_date,
  delivery_date,
  delivery_address,
  delivery_city,
  contact_person,
  contact_phone,
  received_by,
  received_doc,
  delivery_evidence_notes,
  cancellation_reason,
  cancelled_at,
  notes,
  created_at,
  updated_at,
  company_id,
  customer:customers!customer_id (
    id,
    company_name,
    commercial_name,
    first_name,
    last_name,
    document_number,
    phone,
    address,
    city
  ),
  location:locations!origin_location_id (
    id,
    code,
    name
  ),
  items:remission_items (
    id,
    remission_id,
    product_id,
    quantity,
    delivered_quantity,
    unit_cost,
    unit_price,
    notes,
    product:products!product_id (
      id,
      name,
      sku,
      barcode,
      unit_of_measure
    )
  )
`

export class RemissionRepository {
  private client: SupabaseClient

  constructor(client: SupabaseClient = supabaseClient) {
    this.client = client
  }

  /**
   * Obtiene lista de remisiones con filtros dinámicos y paginación en PostgreSQL
   */
  async findAll(
    filters: RemissionFilters = {},
    companyId?: string
  ): Promise<{
    data: Remission[]
    total: number
    page: number
    pageSize: number
  }> {
    const activeCompanyId = companyId || (await resolveUserCompanyId(this.client))

    let query = this.client
      .from('remissions')
      .select(REMISSION_QUERY_SELECT, { count: 'exact' })
      .eq('company_id', activeCompanyId)

    // Filtro por Tab / Estado
    if (filters.tab && filters.tab !== 'Todas') {
      if (filters.tab === 'Borrador') query = query.eq('status', 'DRAFT')
      else if (filters.tab === 'Creadas') query = query.eq('status', 'CREATED')
      else if (filters.tab === 'En tránsito') query = query.eq('status', 'DISPATCHED')
      else if (filters.tab === 'Entregadas') query = query.eq('status', 'DELIVERED')
      else if (filters.tab === 'Anuladas') query = query.eq('status', 'CANCELLED')
    } else if (filters.status && filters.status !== 'ALL') {
      query = query.eq('status', filters.status)
    }

    // Filtro por Bodega
    if (filters.locationId && filters.locationId !== 'ALL') {
      query = query.eq('origin_location_id', filters.locationId)
    }

    // Filtro por Cliente
    if (filters.customerId && filters.customerId !== 'ALL') {
      query = query.eq('customer_id', filters.customerId)
    }

    // Filtros de fecha
    if (filters.dateFrom) {
      query = query.gte('created_at', filters.dateFrom)
    }
    if (filters.dateTo) {
      query = query.lte('created_at', filters.dateTo)
    }

    // Búsqueda de texto (código, transportador, conductor, placa)
    if (filters.query && filters.query.trim()) {
      const q = filters.query.trim()
      query = query.or(
        `code.ilike.%${q}%,driver_name.ilike.%${q}%,carrier_name.ilike.%${q}%,vehicle_plate.ilike.%${q}%`
      )
    }

    // Ordenamiento
    const isAsc = filters.sortDirection === 'asc'
    if (filters.sortBy === 'remissionNumber') {
      query = query.order('code', { ascending: isAsc })
    } else if (filters.sortBy === 'status') {
      query = query.order('status', { ascending: isAsc })
    } else {
      query = query.order('created_at', { ascending: isAsc })
    }

    // Paginación
    const page = filters.page && filters.page > 0 ? filters.page : 1
    const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 10
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      throw new Error(`Error al consultar remisiones: ${error.message}`)
    }

    return {
      data: (data || []).map((row: any) => this.mapToDomain(row)),
      total: count || 0,
      page,
      pageSize,
    }
  }

  /**
   * Busca remisión por ID o código consecutivo
   */
  async findById(id: string, companyId?: string): Promise<Remission | null> {
    const activeCompanyId = companyId || (await resolveUserCompanyId(this.client))

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

    let query = this.client
      .from('remissions')
      .select(REMISSION_QUERY_SELECT)
      .eq('company_id', activeCompanyId)

    if (isUuid) {
      query = query.eq('id', id)
    } else {
      query = query.eq('code', id)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      throw new Error(`Error al buscar remisión ${id}: ${error.message}`)
    }

    return data ? this.mapToDomain(data) : null
  }

  /**
   * Busca remisión por ID de venta relacionada
   */
  async findBySaleId(saleId: string, companyId?: string): Promise<Remission | null> {
    const activeCompanyId = companyId || (await resolveUserCompanyId(this.client))

    const { data, error } = await this.client
      .from('remissions')
      .select(REMISSION_QUERY_SELECT)
      .eq('company_id', activeCompanyId)
      .eq('sale_id', saleId)
      .maybeSingle()

    if (error) {
      throw new Error(`Error al buscar remisión de la venta ${saleId}: ${error.message}`)
    }

    return data ? this.mapToDomain(data) : null
  }

  /**
   * Calcula estadísticas consolidadas del módulo de Remisiones desde PostgreSQL
   */
  async getStats(companyId?: string): Promise<RemissionStats> {
    const activeCompanyId = companyId || (await resolveUserCompanyId(this.client))

    const { data, error } = await this.client
      .from('remissions')
      .select('status, customer_id, items:remission_items(quantity, delivered_quantity)')
      .eq('company_id', activeCompanyId)

    if (error) {
      throw new Error(`Error al calcular estadísticas de remisiones: ${error.message}`)
    }

    let pendingDispatch = 0
    let inTransit = 0
    let delivered = 0
    let cancelled = 0
    let deliveredUnits = 0
    const customerIds = new Set<string>()

    for (const r of data || []) {
      if (r.customer_id) {
        customerIds.add(String(r.customer_id))
      }

      if (r.status === 'CREATED' || r.status === 'DRAFT') {
        pendingDispatch++
      } else if (r.status === 'DISPATCHED') {
        inTransit++
      } else if (r.status === 'DELIVERED') {
        delivered++
        const items = (r.items as any[]) || []
        for (const it of items) {
          deliveredUnits += Number(it.delivered_quantity || it.quantity || 0)
        }
      } else if (r.status === 'CANCELLED') {
        cancelled++
      }
    }

    return {
      totalRemissions: (data || []).length,
      pendingDispatch,
      inTransit,
      delivered,
      cancelled,
      deliveredUnits,
      uniqueCustomers: customerIds.size,
    }
  }

  /**
   * Crea una nueva remisión llamando a la RPC atómica fn_create_remission
   */
  async create(payload: CreateRemissionPayload): Promise<Remission> {
    const itemsJson = (payload.items || []).map((it) => ({
      product_id: it.productId,
      quantity: it.quantityRequested,
      unit_price: it.unitPrice || 0,
      notes: it.notes || null,
    }))

    const { data, error } = await this.client.rpc('fn_create_remission', {
      p_customer_id: payload.customerId,
      p_origin_location_id: payload.locationId,
      p_items: itemsJson,
      p_sale_id: payload.saleId || null,
      p_delivery_address: payload.deliveryAddress || null,
      p_delivery_city: payload.deliveryCity || null,
      p_contact_person: payload.contactPerson || null,
      p_contact_phone: payload.contactPhone || null,
      p_carrier_name: null,
      p_vehicle_plate: null,
      p_driver_name: null,
      p_driver_doc: null,
      p_notes: payload.notes || null,
      p_as_draft: payload.status === 'DRAFT',
    })

    if (error) {
      throw new Error(`Error al crear remisión: ${error.message}`)
    }

    const createdId = data.remission_id
    const remission = await this.findById(createdId)
    if (!remission) {
      throw new Error(`Remisión creada pero no se pudo recuperar con ID ${createdId}`)
    }
    return remission
  }

  /**
   * Modifica una remisión en estado borrador (DRAFT)
   */
  async updateDraft(payload: {
    remissionId: string
    customerId: string
    locationId: string
    items: { productId: string; quantityRequested: number; unitPrice?: number; notes?: string }[]
    deliveryAddress?: string
    deliveryCity?: string
    contactPerson?: string
    contactPhone?: string
    notes?: string
  }): Promise<Remission> {
    const itemsJson = payload.items.map((it) => ({
      product_id: it.productId,
      quantity: it.quantityRequested,
      unit_price: it.unitPrice || 0,
      notes: it.notes || null,
    }))

    const { data, error } = await this.client.rpc('fn_update_remission_draft', {
      p_remission_id: payload.remissionId,
      p_customer_id: payload.customerId,
      p_origin_location_id: payload.locationId,
      p_items: itemsJson,
      p_delivery_address: payload.deliveryAddress || null,
      p_delivery_city: payload.deliveryCity || null,
      p_contact_person: payload.contactPerson || null,
      p_contact_phone: payload.contactPhone || null,
      p_notes: payload.notes || null,
    })

    if (error) {
      throw new Error(`Error al actualizar borrador de remisión: ${error.message}`)
    }

    const updated = await this.findById(payload.remissionId)
    if (!updated) {
      throw new Error(`No se pudo recuperar la remisión actualizada ${payload.remissionId}`)
    }
    return updated
  }

  /**
   * Despacha una remisión: cambia estado a DISPATCHED y descuenta inventario (Kardex SALE_OUT)
   */
  async dispatch(
    remissionId: string,
    dispatchData: DispatchRemissionPayload
  ): Promise<Remission> {
    const { data, error } = await this.client.rpc('fn_dispatch_remission', {
      p_remission_id: remissionId,
      p_carrier_name: dispatchData.carrierName || null,
      p_vehicle_plate: dispatchData.vehiclePlate || null,
      p_driver_name: dispatchData.driverName || null,
      p_driver_doc: dispatchData.driverDoc || null,
      p_notes: dispatchData.notes || null,
    })

    if (error) {
      throw new Error(`Error al despachar remisión: ${error.message}`)
    }

    const dispatched = await this.findById(remissionId)
    if (!dispatched) {
      throw new Error(`No se pudo recuperar la remisión despachada ${remissionId}`)
    }
    return dispatched
  }

  /**
   * Confirma la entrega física al cliente
   */
  async deliver(
    remissionId: string,
    deliverData: DeliverRemissionPayload
  ): Promise<Remission> {
    const { data, error } = await this.client.rpc('fn_deliver_remission', {
      p_remission_id: remissionId,
      p_received_by: deliverData.receivedBy,
      p_received_doc: deliverData.receivedDoc || null,
      p_delivery_notes: deliverData.deliveryEvidenceNotes || null,
    })

    if (error) {
      throw new Error(`Error al confirmar entrega de remisión: ${error.message}`)
    }

    const delivered = await this.findById(remissionId)
    if (!delivered) {
      throw new Error(`No se pudo recuperar la remisión entregada ${remissionId}`)
    }
    return delivered
  }

  /**
   * Anula una remisión y reversa inventario en Kardex si ya estaba despachada
   */
  async cancel(remissionId: string, reason: string): Promise<Remission> {
    const { data, error } = await this.client.rpc('fn_cancel_remission', {
      p_remission_id: remissionId,
      p_reason: reason,
    })

    if (error) {
      throw new Error(`Error al anular remisión: ${error.message}`)
    }

    const cancelled = await this.findById(remissionId)
    if (!cancelled) {
      throw new Error(`No se pudo recuperar la remisión anulada ${remissionId}`)
    }
    return cancelled
  }

  /**
   * Obtiene ventas disponibles para generar remisión
   */
  async getSalesPendingRemission(companyId?: string): Promise<any[]> {
    const activeCompanyId = companyId || (await resolveUserCompanyId(this.client))

    // Ventas de la empresa que no tengan remisión generada
    const { data: remSales } = await this.client
      .from('remissions')
      .select('sale_id')
      .eq('company_id', activeCompanyId)
      .not('sale_id', 'is', null)

    const excludedSaleIds = (remSales || []).map((r: any) => r.sale_id).filter(Boolean)

    let query = this.client
      .from('sales')
      .select(`
        id,
        sale_number,
        total_amount,
        created_at,
        customer_id,
        location_id,
        customer:customers!customer_id (
          id,
          company_name,
          commercial_name,
          first_name,
          last_name,
          document_number,
          address,
          city,
          phone
        ),
        location:locations!location_id (
          id,
          name
        )
      `)
      .eq('company_id', activeCompanyId)
      .neq('status', 'CANCELLED')

    if (excludedSaleIds.length > 0) {
      query = query.not('id', 'in', `(${excludedSaleIds.join(',')})`)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Error al obtener ventas pendientes de remisión: ${error.message}`)
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
        customerId: s.customer_id,
        customerName: custName,
        customerDoc: s.customer?.document_number || '',
        customerAddress: s.customer?.address || '',
        customerCity: s.customer?.city || '',
        customerPhone: s.customer?.phone || '',
        locationId: s.location_id,
        locationName: s.location?.name || '',
      }
    })
  }

  private mapToDomain(raw: any): Remission {
    const custName = raw.customer
      ? (raw.customer.company_name || raw.customer.commercial_name || `${raw.customer.first_name || ''} ${raw.customer.last_name || ''}`).trim()
      : 'Cliente'
    const custDoc = raw.customer?.document_number || ''
    const locationName = raw.location?.name || 'Bodega'

    const mappedItems: RemissionItem[] = (raw.items || []).map((it: any) => ({
      id: it.id,
      productId: it.product_id,
      productName: it.product?.name || 'Producto',
      sku: it.product?.sku || '',
      barcode: it.product?.barcode || '',
      unitOfMeasure: it.product?.unit_of_measure || 'UND',
      quantityRequested: Number(it.quantity || 0),
      quantityDelivered: Number(it.delivered_quantity || 0),
      unitCost: Number(it.unit_cost || 0),
      unitPrice: Number(it.unit_price || 0),
      notes: it.notes || undefined,
    }))

    const totalUnits = mappedItems.reduce((acc, it) => acc + it.quantityRequested, 0)

    return {
      id: raw.id,
      remissionNumber: raw.code,
      prefix: 'REM',
      saleId: raw.sale_id || null,
      saleNumber: null,
      invoiceId: null,
      invoiceNumber: null,
      customerId: raw.customer_id,
      customerName: custName,
      customerDoc: custDoc,
      customerPhone: raw.customer?.phone || raw.contact_phone || undefined,
      customerAddress: raw.delivery_address || raw.customer?.address || undefined,
      customerCity: raw.delivery_city || raw.customer?.city || undefined,
      locationId: raw.origin_location_id,
      locationName: locationName,
      date: raw.created_at,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
      status: raw.status,
      items: mappedItems,
      itemsCount: mappedItems.length,
      totalUnits,
      deliveryAddress: raw.delivery_address || undefined,
      deliveryCity: raw.delivery_city || undefined,
      contactPerson: raw.contact_person || undefined,
      contactPhone: raw.contact_phone || undefined,
      carrierName: raw.carrier_name || null,
      vehiclePlate: raw.vehicle_plate || null,
      driverName: raw.driver_name || null,
      driverDoc: raw.driver_doc || null,
      dispatchedAt: raw.dispatch_date || null,
      dispatchedBy: null,
      deliveredAt: raw.delivery_date || null,
      deliveredBy: null,
      receivedBy: raw.received_by || null,
      receivedDoc: raw.received_doc || null,
      deliveryEvidenceNotes: raw.delivery_evidence_notes || null,
      cancelReason: raw.cancellation_reason || null,
      cancelledAt: raw.cancelled_at || null,
      cancelledBy: null,
      notes: raw.notes || undefined,
      createdBy: String(raw.created_by_user_id || 'Sistema'),
    }
  }
}

export const remissionRepository = new RemissionRepository()
