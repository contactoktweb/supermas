/**
 * SUPER MÁS ERP/POS - Repositorio Real de Traslados (TransferRepository)
 * 
 * Persistencia fiduciaria 100% real en PostgreSQL / Supabase:
 * - Aislamiento multi-tenant estricto mediante resolveUserCompanyId
 * - Enlaces relacionales con locations, products, users y transfer_items
 * - Invocación a RPCs atómicas con bloqueo pesimista y actualización del Kardex:
 *   * fn_create_transfer
 *   * fn_dispatch_transfer (TRANSFER_OUT en Kardex)
 *   * fn_receive_transfer (TRANSFER_IN en Kardex)
 *   * fn_cancel_transfer (Reversión a Kardex)
 */

import {
  Transfer,
  TransferStatus,
  TransferItem,
  TransferFilterParams,
  GlobalTransferStats,
  TransferPaginationResult,
  TransferCreateInput,
  TransferDispatchInput,
  TransferReceiveInput,
  TransferRejectInput,
} from '../types'
import { supabaseClient } from '@/lib/supabase/client'
import { resolveUserCompanyId } from '@/lib/supabase/tenant'

const TRANSFER_QUERY_SELECT = `
  id,
  code,
  origin_location_id,
  destination_location_id,
  status,
  dispatch_date,
  receipt_date,
  created_by_user_id,
  dispatched_by_user_id,
  received_by_user_id,
  rejected_by_user_id,
  rejected_at,
  rejection_reason,
  has_incident,
  incident_notes,
  notes,
  created_at,
  updated_at,
  company_id,
  origin:locations!origin_location_id (id, name, code),
  destination:locations!destination_location_id (id, name, code),
  creator:users!created_by_user_id (id, full_name, role:roles!role_id(name)),
  dispatcher:users!dispatched_by_user_id (id, full_name),
  receiver:users!received_by_user_id (id, full_name),
  rejecter:users!rejected_by_user_id (id, full_name),
  items:transfer_items (
    id,
    product_id,
    requested_quantity,
    sent_quantity,
    received_quantity,
    unit_cost,
    has_discrepancy,
    discrepancy_note,
    created_at,
    product:products (id, name, sku, barcode, unit_of_measure, category:categories(name))
  )
`

function mapDbRowToTransfer(row: any): Transfer {
  const items: TransferItem[] = (row.items || []).map((i: any) => {
    const req = Number(i.requested_quantity || 0)
    const sent = Number(i.sent_quantity || 0)
    const recv = Number(i.received_quantity || 0)
    const cost = Number(i.unit_cost || 0)
    return {
      id: i.id,
      productId: i.product_id,
      productName: i.product?.name || 'Producto',
      sku: i.product?.sku || 'SKU',
      barcode: i.product?.barcode || undefined,
      category: i.product?.category?.name || 'General',
      unitOfMeasure: i.product?.unit_of_measure || 'UND',
      imageUrl: undefined,
      availableStockAtOrigin: req,
      requestedUnits: req,
      dispatchedUnits: sent,
      receivedUnits: recv,
      unitCost: cost,
      totalCost: req * cost,
      hasDiscrepancy: Boolean(i.has_discrepancy),
      discrepancyNote: i.discrepancy_note || undefined,
    }
  })

  const totalUnitsRequested = items.reduce((acc, i) => acc + i.requestedUnits, 0)
  const totalUnitsDispatched = items.reduce((acc, i) => acc + i.dispatchedUnits, 0)
  const totalUnitsReceived = items.reduce((acc, i) => acc + i.receivedUnits, 0)
  const totalValueAtCost = items.reduce((acc, i) => acc + i.totalCost, 0)

  return {
    id: row.id,
    code: row.code,
    originLocationId: row.origin_location_id,
    originLocationName: row.origin?.name || 'Bodega Origen',
    originLocationCode: row.origin?.code || 'ORIG',
    destinationLocationId: row.destination_location_id,
    destinationLocationName: row.destination?.name || 'Bodega Destino',
    destinationLocationCode: row.destination?.code || 'DEST',
    status: row.status as TransferStatus,
    items,
    totalItemsCount: items.length,
    totalUnitsRequested,
    totalUnitsDispatched,
    totalUnitsReceived,
    totalValueAtCost,
    createdByUserId: row.created_by_user_id || '',
    createdByUserName: row.creator?.full_name || 'Sistema',
    createdByUserRole: row.creator?.role?.name || 'Coordinador de Logística',
    dispatchedByUserId: row.dispatched_by_user_id || undefined,
    dispatchedByUserName: row.dispatcher?.full_name || undefined,
    dispatchedAt: row.dispatch_date || undefined,
    receivedByUserId: row.received_by_user_id || undefined,
    receivedByUserName: row.receiver?.full_name || undefined,
    receivedAt: row.receipt_date || undefined,
    rejectedByUserId: row.rejected_by_user_id || undefined,
    rejectedByUserName: row.rejecter?.full_name || undefined,
    rejectedAt: row.rejected_at || undefined,
    rejectionReason: row.rejection_reason || undefined,
    hasIncident: Boolean(row.has_incident),
    incidentNotes: row.incident_notes || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  }
}

export class TransferRepository {
  private async resolveCompanyId(): Promise<string> {
    return resolveUserCompanyId(supabaseClient)
  }

  async getItems(transferId: string): Promise<any[]> {
    const { data: rawItems, error } = await supabaseClient
      .from('transfer_items')
      .select('*, product:products(id, name, sku)')
      .eq('transfer_id', transferId)

    if (error) {
      console.error('Error consultando ítems del traslado:', error)
      return []
    }
    return rawItems || []
  }

  async findMany(filters: TransferFilterParams = {}): Promise<TransferPaginationResult> {
    const companyId = await this.resolveCompanyId()

    let query = supabaseClient
      .from('transfers')
      .select(TRANSFER_QUERY_SELECT, { count: 'exact' })
      .eq('company_id', companyId)

    // Filtro por código específico
    if (filters.code && filters.code.trim() !== '') {
      query = query.ilike('code', `%${filters.code.trim()}%`)
    }

    // Filtro por bodega origen
    if (filters.originLocationId && filters.originLocationId !== 'ALL') {
      query = query.eq('origin_location_id', filters.originLocationId)
    }

    // Filtro por bodega destino
    if (filters.destinationLocationId && filters.destinationLocationId !== 'ALL') {
      query = query.eq('destination_location_id', filters.destinationLocationId)
    }

    // Filtro de dirección (INBOUND | OUTBOUND) relativo a activeLocationId
    if (filters.direction && filters.direction !== 'ALL' && filters.activeLocationId && filters.activeLocationId !== 'ALL') {
      if (filters.direction === 'INBOUND') {
        query = query.eq('destination_location_id', filters.activeLocationId)
      } else if (filters.direction === 'OUTBOUND') {
        query = query.eq('origin_location_id', filters.activeLocationId)
      }
    }

    // Filtro por estado
    if (filters.status && filters.status !== 'ALL') {
      query = query.eq('status', filters.status)
    }

    // Filtro por fechas
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate)
    }
    if (filters.endDate) {
      query = query.lte('created_at', `${filters.endDate}T23:59:59.999Z`)
    }

    // Búsqueda general
    if (filters.query && filters.query.trim() !== '') {
      const q = filters.query.trim()
      query = query.or(`code.ilike.%${q}%,notes.ilike.%${q}%`)
    }

    // Ordenamiento
    const sortField = filters.sortField || 'createdAt'
    const sortDirection = filters.sortDirection || 'desc'
    const ascending = sortDirection === 'asc'

    const dbSortField =
      sortField === 'code' ? 'code' : sortField === 'status' ? 'status' : 'created_at'

    query = query.order(dbSortField, { ascending })

    // Paginación
    const page = filters.page && filters.page > 0 ? filters.page : 1
    const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 20
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    query = query.range(from, to)

    const { data, count, error } = await query

    if (error) {
      console.error('Error consultando traslados en PostgreSQL:', error)
      throw new Error(`Error consultando traslados: ${error.message}`)
    }

    const items = (data || []).map(mapDbRowToTransfer)
    const total = count || 0
    const totalPages = Math.ceil(total / pageSize)

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
      isCostRedacted: false,
    }
  }

  async findById(id: string): Promise<Transfer | null> {
    const companyId = await this.resolveCompanyId()

    const { data, error } = await supabaseClient
      .from('transfers')
      .select(TRANSFER_QUERY_SELECT)
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) {
      console.error(`Error buscando traslado ${id}:`, error)
      throw new Error(`Error consultando traslado: ${error.message}`)
    }

    if (!data) return null
    return mapDbRowToTransfer(data)
  }

  async getGlobalStats(filters?: TransferFilterParams): Promise<GlobalTransferStats> {
    const companyId = await this.resolveCompanyId()

    const { data, error } = await supabaseClient
      .from('transfers')
      .select('status, items:transfer_items(sent_quantity, received_quantity, requested_quantity, unit_cost)')
      .eq('company_id', companyId)

    if (error || !data) {
      console.error('Error calculando estadísticas globales de traslados:', error)
      return {
        pendingCount: 0,
        inTransitCount: 0,
        receivedCount: 0,
        rejectedCount: 0,
        totalUnitsTransferred: 0,
        incidentCount: 0,
        isCostRedacted: false,
      }
    }

    let pendingCount = 0
    let inTransitCount = 0
    let receivedCount = 0
    let rejectedCount = 0
    let totalUnitsTransferred = 0
    let incidentCount = 0

    for (const t of data) {
      const st = t.status
      if (st === 'PENDING') pendingCount++
      else if (st === 'IN_TRANSIT') {
        inTransitCount++
        const items = (t.items as any[]) || []
        for (const item of items) {
          totalUnitsTransferred += Number(item.sent_quantity || 0)
        }
      } else if (st === 'RECEIVED') {
        receivedCount++
        const items = (t.items as any[]) || []
        for (const item of items) {
          totalUnitsTransferred += Number(item.received_quantity || 0)
        }
      } else if (st === 'REJECTED' || st === 'CANCELLED') {
        rejectedCount++
      }
    }

    return {
      pendingCount,
      inTransitCount,
      receivedCount,
      rejectedCount,
      totalUnitsTransferred,
      incidentCount,
      isCostRedacted: false,
    }
  }

  async create(input: TransferCreateInput, userContext?: any): Promise<Transfer> {
    const itemsPayload = input.items.map((i) => ({
      product_id: i.productId,
      quantity: i.units,
    }))

    const { data: result, error } = await supabaseClient.rpc('fn_create_transfer', {
      p_origin_location_id: input.originLocationId,
      p_destination_location_id: input.destinationLocationId,
      p_notes: input.notes || null,
      p_items: itemsPayload,
    })

    if (error || !result) {
      console.error('Error registrando traslado vía fn_create_transfer:', error)
      throw new Error(error?.message || 'Error registrando traslado en PostgreSQL.')
    }

    const created = await this.findById(result.transfer_id)
    if (!created) {
      throw new Error(`Traslado ${result.code} creado pero no pudo ser consultado.`)
    }
    return created
  }

  async dispatch(input: TransferDispatchInput, userContext?: any): Promise<Transfer> {
    const { data: result, error } = await supabaseClient.rpc('fn_dispatch_transfer', {
      p_transfer_id: input.transferId,
      p_notes: input.notes || null,
    })

    if (error || !result) {
      console.error('Error despachando traslado vía fn_dispatch_transfer:', error)
      throw new Error(error?.message || 'Error despachando traslado en PostgreSQL.')
    }

    const updated = await this.findById(input.transferId)
    if (!updated) {
      throw new Error(`Traslado ${input.transferId} no encontrado tras despacho.`)
    }
    return updated
  }

  async receive(input: TransferReceiveInput, userContext?: any): Promise<Transfer> {
    const receivedPayload = input.receivedItems
      ? input.receivedItems.map((ri) => ({
          product_id: ri.productId,
          received_quantity: ri.receivedUnits,
          notes: ri.notes || null,
        }))
      : null

    const { data: result, error } = await supabaseClient.rpc('fn_receive_transfer', {
      p_transfer_id: input.transferId,
      p_received_items: receivedPayload,
      p_notes: input.notes || null,
    })

    if (error || !result) {
      console.error('Error recibiendo traslado vía fn_receive_transfer:', error)
      throw new Error(error?.message || 'Error recibiendo traslado en PostgreSQL.')
    }

    const updated = await this.findById(input.transferId)
    if (!updated) {
      throw new Error(`Traslado ${input.transferId} no encontrado tras recepción.`)
    }
    return updated
  }

  async reject(input: TransferRejectInput, userContext?: any): Promise<Transfer> {
    const { data: result, error } = await supabaseClient.rpc('fn_cancel_transfer', {
      p_transfer_id: input.transferId,
      p_reason: input.reason || 'Rechazado por el usuario',
    })

    if (error || !result) {
      console.error('Error cancelando traslado vía fn_cancel_transfer:', error)
      throw new Error(error?.message || 'Error cancelando traslado en PostgreSQL.')
    }

    const updated = await this.findById(input.transferId)
    if (!updated) {
      throw new Error(`Traslado ${input.transferId} no encontrado tras cancelación.`)
    }
    return updated
  }
}

export const transferRepository = new TransferRepository()
