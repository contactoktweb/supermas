/**
 * SUPER MÁS ERP/POS - Repositorio de Pedidos Web (WebOrderRepository)
 *
 * Conectado directamente a PostgreSQL/Supabase con las tablas
 * public.web_orders, public.web_order_items, public.products, public.stock_levels y public.locations.
 * Aislamiento multiempresa estricto por company_id. Cero mocks, cero db.ts.
 */

import { supabaseClient } from '@/lib/supabase/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveUserCompanyId } from '@/lib/supabase/tenant'
import { effectiveVatRatePercent } from '@/features/public-catalog/utils/tax'
import type { SalePaymentInput } from '@/features/sales/repositories/sales.repository'
import {
  WebOrderConversionResult,
  WebOrder,
  WebOrderFilters,
  WebOrderPaginatedResult,
  WebOrderStats,
  InventoryCheckResult,
  StockAvailabilityLevel,
  WebOrderItem,
  WebOrderStatus,
  WebOrderChannel,
  WebPaymentStatus,
} from '../types'

function getDbClient() {
  if (typeof window === 'undefined' && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return supabaseAdmin
  }
  return supabaseClient
}

export class WebOrderRepository {
  /**
   * Resuelve el company_id activo de forma estricta
   */
  async resolveCompanyId(preferredCompanyId?: string): Promise<string> {
    return resolveUserCompanyId(getDbClient(), preferredCompanyId)
  }

  /**
   * Mapea una fila de PostgreSQL a la entidad de dominio WebOrder.
   */
  private mapRowToWebOrder(row: any): WebOrder {
    const rawItems = Array.isArray(row.web_order_items) ? row.web_order_items : []
    // El pedido guarda el subtotal antes de IVA y el total con IVA (086); los anteriores a 086 no llevan IVA.
    const shippingFee = Number(row.shipping_fee || 0)
    const orderTax = Math.max(0, Number(row.total || 0) - Number(row.subtotal || 0) - shippingFee)
    const items: WebOrderItem[] = rawItems.map((item: any) => {
      const prod = item.products || {}
      const qty = Number(item.quantity || 0)
      const uPrice = Number(item.unit_price || 0)
      const sub = Number(item.subtotal || qty * uPrice)
      const taxRate = effectiveVatRatePercent(prod)
      const lineTax = orderTax > 0 ? Math.round(sub * taxRate) / 100 : 0
      return {
        id: item.id,
        productId: item.product_id,
        productName: prod.name || 'Producto',
        sku: prod.sku || 'SKU',
        barcode: prod.barcode || '',
        unitOfMeasure: prod.unit_of_measure || 'UND',
        imageUrl: prod.primary_image_url || undefined,
        quantity: qty,
        unitPrice: uPrice,
        discountPercent: 0,
        discountAmount: 0,
        taxRatePercent: taxRate,
        taxAmount: lineTax,
        subtotal: sub,
        total: sub + lineTax,
      }
    })

    const totalUnits = items.reduce((acc, it) => acc + it.quantity, 0)
    const loc = row.locations || {}

    let status = (row.fulfillment_status || 'PENDING') as WebOrderStatus
    if (status === ('DISPATCHED' as any)) {
      status = 'SHIPPED'
    }

    const channel: WebOrderChannel =
      row.channel === 'SUPER_MAS' || row.channel === 'CATALOGO_SUPERMAS' || row.channel === 'SUPERMAS_B2C'
        ? 'CATALOGO_SUPERMAS'
        : 'CATALOGO_DISTRIBUIDORA'

    const paymentStatus = (row.payment_status || 'PENDING') as WebPaymentStatus

    return {
      id: row.id,
      orderNumber: row.order_number,
      createdAt: row.created_at,
      channel,
      status,
      customerId: row.customer_id || '',
      customerName: row.customer_name || 'Cliente Web',
      customerDoc: row.customers?.document_number || undefined,
      customerEmail: row.customer_email || '',
      customerPhone: row.customer_phone || '',
      shippingAddress: row.shipping_address || '',
      city: row.shipping_city || 'Medellín',
      deliveryNotes: row.notes || undefined,
      assignedLocationId: row.dispatch_location_id,
      assignedLocationName: loc.name || 'Bodega Principal',
      assignedLocationCode: loc.code || 'BOD',
      itemsCount: items.length,
      totalUnits,
      subtotal: Number(row.subtotal || 0),
      discountTotal: 0,
      taxTotal: orderTax,
      shippingCost: shippingFee,
      totalAmount: Number(row.total || 0),
      paymentMethod: 'ONLINE',
      paymentStatus,
      saleId: row.sale_id || undefined,
      saleNumber: row.sales?.sale_number || undefined,
      items,
      checklist: {
        itemsReviewed: status !== 'PENDING',
        quantitiesVerified: status !== 'PENDING',
        customerConfirmed: status !== 'PENDING',
        addressConfirmed: status !== 'PENDING',
        paymentVerified: paymentStatus === 'PAID',
      },
      timeline: [
        {
          status: 'PENDING',
          timestamp: row.created_at,
          actor: 'Cliente Web',
          notes: 'Pedido recibido en tienda virtual.',
        },
      ],
    }
  }

  /**
   * Obtiene la lista de pedidos web aplicando filtros desde PostgreSQL.
   */
  async findAll(
    filters: WebOrderFilters = {},
    preferredCompanyId?: string
  ): Promise<WebOrderPaginatedResult> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)

    let query = client
      .from('web_orders')
      .select(`
        id, order_number, channel, customer_id, customer_name, customer_phone,
        customer_email, shipping_address, shipping_city, dispatch_location_id,
        subtotal, shipping_fee, total, payment_status, fulfillment_status, sale_id,
        notes, created_at, updated_at, company_id,
        locations(id, name, code),
        customers(id, document_number),
        sales(id, sale_number),
        web_order_items(
          id, product_id, quantity, unit_price, subtotal,
          products(id, name, sku, barcode, unit_of_measure, primary_image_url, tax_rate_percent, is_tax_exempt, iva_treatment)
        )
      `, { count: 'exact' })
      .eq('company_id', companyId)

    if (filters.channel && filters.channel !== 'ALL') {
      const dbChannels =
        filters.channel === 'CATALOGO_SUPERMAS'
          ? ['SUPER_MAS', 'SUPERMAS_B2C']
          : ['DISTRIBUIDORA', 'DISTRIBUTOR_B2B']
      query = query.or([...dbChannels, filters.channel].map((c) => `channel.eq.${c}`).join(','))
    }

    if (filters.status && filters.status !== 'ALL') {
      const dbStatus = filters.status === 'SHIPPED' ? 'DISPATCHED' : filters.status
      query = query.eq('fulfillment_status', dbStatus)
    }

    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim().replace(/[%_]/g, '')
      query = query.or(`order_number.ilike.%${q}%,customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`)
    }

    if (filters.locationId && filters.locationId !== 'ALL') {
      query = query.eq('dispatch_location_id', filters.locationId)
    }

    if (filters.dateFrom) {
      query = query.gte('created_at', filters.dateFrom)
    }
    if (filters.dateTo) {
      query = query.lte('created_at', filters.dateTo)
    }

    query = query.order('created_at', { ascending: filters.sortOrder === 'asc' })

    // Paginación
    const page = filters.page && filters.page > 0 ? filters.page : 1
    const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 10
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data: rows, count, error } = await query

    if (error) {
      console.error('Error consultando pedidos web en PostgreSQL:', error)
      throw new Error(`Error al consultar pedidos web: ${error.message}`)
    }

    const orders = (rows || []).map((r) => this.mapRowToWebOrder(r))
    const total = count || orders.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    return {
      orders,
      total,
      page,
      pageSize,
      totalPages,
    }
  }

  /**
   * Obtiene un pedido web por su identificador único.
   */
  async findById(id: string, preferredCompanyId?: string): Promise<WebOrder | null> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)

    const { data: row, error } = await client
      .from('web_orders')
      .select(`
        id, order_number, channel, customer_id, customer_name, customer_phone,
        customer_email, shipping_address, shipping_city, dispatch_location_id,
        subtotal, shipping_fee, total, payment_status, fulfillment_status, sale_id,
        notes, created_at, updated_at, company_id,
        locations(id, name, code),
        customers(id, document_number),
        sales(id, sale_number),
        web_order_items(
          id, product_id, quantity, unit_price, subtotal,
          products(id, name, sku, barcode, unit_of_measure, primary_image_url, tax_rate_percent, is_tax_exempt, iva_treatment)
        )
      `)
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error || !row) return null
    return this.mapRowToWebOrder(row)
  }

  /**
   * Obtiene un pedido web por número de orden.
   */
  async findByOrderNumber(orderNumber: string, preferredCompanyId?: string): Promise<WebOrder | null> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)

    const { data: row, error } = await client
      .from('web_orders')
      .select(`
        id, order_number, channel, customer_id, customer_name, customer_phone,
        customer_email, shipping_address, shipping_city, dispatch_location_id,
        subtotal, shipping_fee, total, payment_status, fulfillment_status, sale_id,
        notes, created_at, updated_at, company_id,
        locations(id, name, code),
        customers(id, document_number),
        sales(id, sale_number),
        web_order_items(
          id, product_id, quantity, unit_price, subtotal,
          products(id, name, sku, barcode, unit_of_measure, primary_image_url, tax_rate_percent, is_tax_exempt, iva_treatment)
        )
      `)
      .eq('order_number', orderNumber.trim())
      .eq('company_id', companyId)
      .maybeSingle()

    if (error || !row) return null
    return this.mapRowToWebOrder(row)
  }

  /**
   * Actualiza el estado o propiedades de un pedido web en PostgreSQL.
   */
  async update(id: string, partial: Partial<WebOrder>, preferredCompanyId?: string): Promise<WebOrder> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)
    const nowIso = new Date().toISOString()

    const updatePayload: Record<string, any> = {
      updated_at: nowIso,
    }

    if (partial.status) {
      updatePayload.fulfillment_status = partial.status === 'SHIPPED' ? 'DISPATCHED' : partial.status
    }
    if (partial.paymentStatus) {
      updatePayload.payment_status = partial.paymentStatus
    }
    if (partial.saleId) {
      updatePayload.sale_id = partial.saleId
    }
    if (partial.deliveryNotes !== undefined) {
      updatePayload.notes = partial.deliveryNotes
    }

    const { error } = await client
      .from('web_orders')
      .update(updatePayload)
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) {
      throw new Error(`Error actualizando pedido web: ${error.message}`)
    }

    const updated = await this.findById(id, companyId)
    if (!updated) throw new Error(`Pedido web ${id} no encontrado tras actualizar.`)
    return updated
  }

  /**
   * Calcula los indicadores globales de pedidos web para el dashboard.
   */
  async getStats(preferredCompanyId?: string): Promise<WebOrderStats> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)

    const { data: rows } = await client
      .from('web_orders')
      .select('total, fulfillment_status')
      .eq('company_id', companyId)

    let pendingCount = 0
    let confirmedCount = 0
    let preparingCount = 0
    let readyToDispatchCount = 0
    let shippedCount = 0
    let deliveredCount = 0
    let cancelledCount = 0
    let totalWebSalesAmount = 0
    let deliveredOrdersWithSales = 0

    if (rows) {
      rows.forEach((ord: any) => {
        const st = ord.fulfillment_status
        switch (st) {
          case 'PENDING':
            pendingCount++
            break
          case 'CONFIRMED':
            confirmedCount++
            break
          case 'PREPARING':
            preparingCount++
            break
          case 'DISPATCHED':
            shippedCount++
            break
          case 'DELIVERED':
            deliveredCount++
            totalWebSalesAmount += Number(ord.total || 0)
            deliveredOrdersWithSales++
            break
          case 'CANCELLED':
            cancelledCount++
            break
        }
      })
    }

    const totalOrdersCount = rows ? rows.length : 0
    const averageTicket =
      deliveredOrdersWithSales > 0 ? Math.round(totalWebSalesAmount / deliveredOrdersWithSales) : 0

    return {
      pendingCount,
      confirmedCount,
      preparingCount,
      readyToDispatchCount,
      shippedCount,
      deliveredCount,
      cancelledCount,
      totalOrdersCount,
      totalWebSalesAmount,
      averageTicket,
    }
  }

  /**
   * Busca clientes existentes en la base de datos de clientes para evitar duplicaciones.
   */
  async findCustomer(
    query: { doc?: string; email?: string; phone?: string },
    preferredCompanyId?: string
  ): Promise<any | null> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)

    let q = client.from('customers').select('*').eq('company_id', companyId)

    if (query.doc) {
      q = q.eq('document_number', query.doc.trim())
    } else if (query.email) {
      q = q.eq('email', query.email.trim().toLowerCase())
    } else if (query.phone) {
      q = q.eq('phone', query.phone.trim())
    } else {
      return null
    }

    const { data } = await q.maybeSingle()
    return data || null
  }

  /**
   * Valida disponibilidad de inventario consultando stock_levels en todas las bodegas desde PostgreSQL.
   */
  async checkStockAvailability(
    items: { productId: string; quantity: number }[],
    preferredCompanyId?: string
  ): Promise<InventoryCheckResult[]> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)

    // Obtener bodega de ecommerce
    const { data: locations } = await client
      .from('locations')
      .select('id, name, code, is_ecommerce_source, status')
      .eq('company_id', companyId)
      .eq('status', 'ACTIVE')

    const ecommerceLocation = (locations || []).find((l: any) => l.is_ecommerce_source) || locations?.[0]
    const ecommerceLocId = ecommerceLocation?.id

    const results: InventoryCheckResult[] = []

    for (const item of items) {
      const { data: prod } = await client
        .from('products')
        .select(`
          id, name, sku, min_stock_threshold,
          stock_levels(quantity, location_id, locations(status))
        `)
        .eq('id', item.productId)
        .eq('company_id', companyId)
        .maybeSingle()

      let globalStock = 0
      let ecommerceStock = 0

      if (prod && Array.isArray(prod.stock_levels)) {
        prod.stock_levels.forEach((sl: any) => {
          if (sl.locations?.status === 'ACTIVE' || sl.locations?.status === undefined) {
            const q = Number(sl.quantity || 0)
            globalStock += q
            if (sl.location_id === ecommerceLocId) {
              ecommerceStock += q
            }
          }
        })
      }

      let availability: StockAvailabilityLevel = 'AVAILABLE'
      if (globalStock <= 0) {
        availability = 'OUT_OF_STOCK'
      } else if (globalStock <= (prod?.min_stock_threshold || 10) || globalStock < item.quantity) {
        availability = 'LOW_STOCK'
      }

      const canFulfill = ecommerceStock >= item.quantity
      const isEcommerceWarehouseAvailable = ecommerceStock > 0

      results.push({
        productId: item.productId,
        sku: prod?.sku || 'SKU',
        productName: prod?.name || 'Producto',
        requestedQuantity: item.quantity,
        availability,
        canFulfill,
        isEcommerceWarehouseAvailable,
        notes: canFulfill
          ? 'Stock suficiente en Bodega Ecommerce para despacho.'
          : isEcommerceWarehouseAvailable
          ? 'Stock parcial en Bodega Ecommerce. Requiere traslado o ajuste.'
          : 'Sin stock en Bodega Ecommerce asignada.',
      })
    }

    return results
  }

  /**
   * Convierte el pedido web en venta en una sola transacción del servidor (fn_convert_web_order_to_sale, 079):
   * precio vigente del ERP, IVA y costo del servidor, stock/kardex, pagos, caja/banco/cartera, asiento y
   * vínculo del pedido con la venta. Reintentar (misma clave o pedido ya convertido) devuelve la misma venta.
   */
  async convertToSale(
    orderId: string,
    input: { payments: SalePaymentInput[]; idempotencyKey: string }
  ): Promise<WebOrderConversionResult> {
    const { data, error } = await supabaseClient.rpc('fn_convert_web_order_to_sale', {
      p_web_order_id: orderId,
      p_payments: input.payments,
      p_idempotency_key: input.idempotencyKey,
    })
    if (error) throw new Error(error.message)
    const res = data as {
      success?: boolean
      idempotent_replay?: boolean
      sale_id?: string
      sale_number?: string
      total_amount?: number
      shipping_fee?: number
    } | null
    if (!res?.success || !res.sale_id || !res.sale_number) {
      throw new Error('El servidor no confirmó la venta del pedido. Intente de nuevo: no se duplicará.')
    }
    return {
      saleId: res.sale_id,
      saleNumber: res.sale_number,
      totalAmount: Number(res.total_amount) || 0,
      shippingFee: Number(res.shipping_fee) || 0,
      idempotentReplay: Boolean(res.idempotent_replay),
    }
  }

  /**
   * Cuentas bancarias que pueden recibir el pago (solo banco, tipo y últimos 4 dígitos).
   */
  async listPaymentBankAccounts(): Promise<Array<{ id: string; label: string }>> {
    const { data, error } = await supabaseClient.rpc('fn_list_payment_bank_accounts')
    if (error) throw new Error(`No se pudieron cargar las cuentas bancarias: ${error.message}`)
    return ((data as Array<{ id: string; bank_name: string; account_type: string; last4: string; has_ledger: boolean }>) || [])
      .filter((a) => a.has_ledger)
      .map((a) => ({
        id: a.id,
        label: `${a.bank_name} · ${a.account_type === 'CORRIENTE' ? 'Corriente' : 'Ahorros'} *${a.last4}`,
      }))
  }
}

export const webOrderRepository = new WebOrderRepository()
