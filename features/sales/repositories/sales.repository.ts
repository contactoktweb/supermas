import { supabaseClient } from '@/lib/supabase/client'
import { dianApiClient } from '@/features/invoices/services/dian-api.client'
import { resolveUserCompanyId } from '@/lib/supabase/tenant'
import {
  Sale,
  SaleItem,
  SaleDetail,
  SaleFilterParams,
  SaleStats,
  SaleStatus,
  PaymentMethod,
  SaleDocumentType,
} from '../types'
import { displayLabel, ACTION_LABELS } from '@/lib/labels/display-labels'

function mapDbPaymentMethodToDomain(pm?: string): PaymentMethod {
  switch (pm) {
    case 'CASH':
      return 'EFECTIVO'
    case 'CREDIT_CARD':
    case 'DEBIT_CARD':
      return 'TARJETA'
    case 'BANK_TRANSFER':
      return 'TRANSFERENCIA'
    case 'CREDIT':
      return 'CREDITO'
    case 'MIXED':
      return 'MIXTO'
    default:
      return 'EFECTIVO'
  }
}

function mapDomainPaymentMethodToDb(pm: PaymentMethod): 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'CREDIT' | 'MIXED' {
  switch (pm) {
    case 'EFECTIVO':
      return 'CASH'
    case 'TARJETA':
      return 'CREDIT_CARD'
    case 'TRANSFERENCIA':
      return 'BANK_TRANSFER'
    case 'CREDITO':
      return 'CREDIT'
    case 'MIXTO':
      return 'MIXED'
    default:
      return 'CASH'
  }
}

function mapDbStatusToDomain(status?: string): SaleStatus {
  switch (status) {
    case 'ISSUED':
      return 'CONFIRMED'
    case 'PENDING':
      return 'PENDING'
    case 'CANCELLED':
      return 'CANCELLED'
    case 'RETURNED':
      return 'RETURNED'
    default:
      return 'CONFIRMED'
  }
}

/** Pago de una venta tal como lo recibe el servidor (amount null = saldo restante del total que calcula). */
export type SalePaymentInput = {
  method: 'CASH' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CREDIT'
  amount: number | null
  bank_account_id?: string
}

/** Respuesta de fn_create_sale_with_payments (073). */
export interface CreateSaleRpcResult {
  success: boolean
  idempotent_replay: boolean
  sale_id: string
  sale_number: string
  total_amount: number
  accounting_entry_id: string | null
  accounting_entry_number: string | null
  voucher_type_code: string | null
}

/** Respuesta de fn_cancel_sale (079). */
export interface CancelSaleRpcResult {
  success: boolean
  already_cancelled: boolean
  sale_id: string
  sale_number: string
  reversed_units?: number
  cash_refunded?: number
  bank_reversed?: number
  credit_reversed?: number
  accounting_reversals?: Array<{ original_entry_number: string; reversal_entry_number: string }>
}

export class SalesRepository {
  /**
   * Resuelve el company_id del usuario autenticado actual de forma estricta
   */
  async resolveCompanyId(preferredCompanyId?: string): Promise<string> {
    return resolveUserCompanyId(supabaseClient, preferredCompanyId)
  }

  /**
   * Mapea un registro de public.sales a la entidad de dominio Sale
   */
  private mapDbRowToSale(s: any): Sale {
    const cust = s.customers || {}
    const loc = s.locations || {}
    const user = s.users || {}
    const rawItems = (s.sale_items as any[]) || []

    const items: SaleItem[] = rawItems.map((it) => {
      const p = it.products || {}
      return {
        id: it.id,
        productId: it.product_id,
        productName: p.name || 'Producto',
        sku: p.sku || 'SKU',
        barcode: p.barcode || '',
        unitOfMeasure: p.unit_of_measure || p.unit_type || 'UND',
        imageUrl: p.primary_image_url || p.image_url || '',
        quantity: Number(it.quantity || 0),
        unitPrice: Number(it.unit_price || 0),
        unitCost: Number(it.unit_cost || 0),
        discountPercent: Number(it.discount_percent || 0),
        discountAmount: Math.round(Number(it.subtotal || 0) * (Number(it.discount_percent || 0) / 100)),
        taxRatePercent: Number(it.tax_rate_percent || 0),
        taxAmount: Number(it.tax_amount || 0),
        subtotal: Number(it.subtotal || 0),
        total: Number(it.total || 0),
      }
    })

    const totalUnits = items.reduce((acc, i) => acc + i.quantity, 0)
    const subtotal = Number(s.subtotal_amount || 0)
    const discountTotal = Number(s.discount_amount || 0)
    const taxTotal = Number(s.tax_amount || 0)
    const totalAmount = Number(s.total_amount || 0)
    const totalCost = Number(s.total_cost_amount || 0)
    const totalProfit = totalAmount - taxTotal - totalCost
    const profitMarginPercent = totalAmount > 0 ? Math.round((totalProfit / totalAmount) * 100) : 0

    const customerName = cust.company_name || `${cust.first_name || ''} ${cust.last_name || ''}`.trim() || 'Consumidor Final'
    const customerDoc = `${cust.document_type || 'CC'} ${cust.document_number || '222222222222'}`

    return {
      id: s.id,
      saleNumber: s.sale_number,
      customerId: s.customer_id,
      customerName,
      customerDoc,
      customerType: cust.customer_type === 'COMPANY' ? 'COMPANY' : 'NATURAL',
      customerCategory: cust.customer_category || 'RETAIL',
      priceList: cust.customer_category === 'WHOLESALE' ? 'WHOLESALE' : cust.customer_category === 'VIP' ? 'VIP' : 'DEFAULT',
      locationId: s.location_id,
      locationName: loc.name || 'Bodega',
      sellerId: s.seller_user_id || '',
      sellerName: user.full_name || user.email || 'Vendedor',
      date: s.created_at,
      items,
      itemsCount: items.length,
      totalUnits,
      subtotal,
      discountTotal,
      taxTotal,
      totalAmount,
      totalCost,
      totalProfit,
      profitMarginPercent,
      paymentMethod: mapDbPaymentMethodToDomain(s.payment_method),
      paymentStatus: s.payment_status === 'PENDING' || (s.payment_method === 'CREDIT' && Number(s.paid_amount || 0) <= 0)
        ? 'PENDING'
        : (s.payment_status === 'PARTIAL' || (Number(s.paid_amount || 0) > 0 && Number(s.paid_amount || 0) < totalAmount - 0.01))
        ? 'PARTIALLY_PAID'
        : 'PAID',
      paidAmount: Number(s.paid_amount !== undefined && s.paid_amount !== null ? s.paid_amount : (s.payment_method === 'CREDIT' ? 0 : totalAmount)),
      dueDate: s.due_date || s.created_at,
      paymentTerms: s.payment_terms || (s.payment_method === 'CREDIT' ? 'CREDITO' : 'CONTADO'),
      status: mapDbStatusToDomain(s.status),
      documentType: 'FACTURA_POS',
      notes: s.notes || undefined,
      createdAt: s.created_at,
      updatedAt: s.updated_at || s.created_at,
    }
  }

  /**
   * Obtiene la lista de ventas filtrada, ordenada y paginada desde PostgreSQL
   */
  async findFiltered(filters: SaleFilterParams = {}): Promise<{
    items: Sale[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }> {
    let query = supabaseClient
      .from('sales')
      .select(`
        id,
        sale_number,
        location_id,
        customer_id,
        seller_user_id,
        cash_session_id,
        subtotal_amount,
        discount_amount,
        tax_amount,
        total_amount,
        total_cost_amount,
        payment_method,
        payment_status,
        paid_amount,
        payment_terms,
        due_date,
        status,
        notes,
        created_at,
        updated_at,
        customers (
          id,
          first_name,
          last_name,
          company_name,
          document_type,
          document_number,
          customer_type,
          customer_category
        ),
        locations (
          id,
          name,
          code
        ),
        users (
          id,
          full_name,
          email
        ),
        sale_items (
          id,
          product_id,
          quantity,
          unit_cost,
          unit_price,
          discount_percent,
          tax_rate_percent,
          tax_amount,
          subtotal,
          total,
          products (
            name,
            sku,
            barcode,
            unit_of_measure,
            primary_image_url
          )
        )
      `, { count: 'exact' })

    if (filters.customerId && filters.customerId !== 'ALL') {
      query = query.eq('customer_id', filters.customerId)
    }

    if (filters.locationId && filters.locationId !== 'ALL') {
      query = query.eq('location_id', filters.locationId)
    }

    if (filters.paymentMethod && filters.paymentMethod !== 'ALL') {
      query = query.eq('payment_method', mapDomainPaymentMethodToDb(filters.paymentMethod))
    }

    if (filters.status && filters.status !== 'ALL') {
      const dbStatus = filters.status === 'CANCELLED' ? 'CANCELLED' : filters.status === 'PENDING' ? 'PENDING' : 'ISSUED'
      query = query.eq('status', dbStatus)
    }

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate)
    }
    if (filters.endDate) {
      const endStr = filters.endDate.includes('T') ? filters.endDate : `${filters.endDate}T23:59:59.999Z`
      query = query.lte('created_at', endStr)
    }

    query = query.order('created_at', { ascending: filters.sortDirection === 'asc' ? true : false })

    const { data, count, error } = await query

    if (error || !data) {
      console.error('Error consultando ventas en PostgreSQL:', error)
      return {
        items: [],
        total: 0,
        page: filters.page || 1,
        pageSize: filters.pageSize || 10,
        totalPages: 1,
      }
    }

    let items: Sale[] = data.map((row) => this.mapDbRowToSale(row))

    if (filters.query?.trim()) {
      const q = filters.query.toLowerCase().trim()
      items = items.filter(
        (s) =>
          s.saleNumber.toLowerCase().includes(q) ||
          s.customerName.toLowerCase().includes(q) ||
          s.customerDoc.toLowerCase().includes(q) ||
          s.sellerName.toLowerCase().includes(q) ||
          s.locationName.toLowerCase().includes(q)
      )
    }

    const total = count !== null ? count : items.length
    const page = Math.max(1, filters.page || 1)
    const pageSize = Math.max(1, filters.pageSize || 10)
    const totalPages = Math.ceil(items.length / pageSize) || 1
    const startIndex = (page - 1) * pageSize
    const paginated = items.slice(startIndex, startIndex + pageSize)

    return {
      items: paginated,
      total: items.length,
      page,
      pageSize,
      totalPages,
    }
  }

  /**
   * Obtiene todas las ventas
   */
  async findAll(): Promise<Sale[]> {
    const res = await this.findFiltered({ pageSize: 1000 })
    return res.items
  }

  /**
   * Obtiene las líneas de una venta específica
   */
  async getItems(saleId: string): Promise<SaleItem[]> {
    const { data, error } = await supabaseClient
      .from('sale_items')
      .select(`
        id,
        product_id,
        quantity,
        unit_cost,
        unit_price,
        discount_percent,
        tax_rate_percent,
        tax_amount,
        subtotal,
        total,
        products (
          name,
          sku,
          barcode,
          unit_of_measure,
          primary_image_url
        )
      `)
      .eq('sale_id', saleId)

    if (error || !data) return []

    return data.map((it: any) => {
      const p = it.products || {}
      return {
        id: it.id,
        productId: it.product_id,
        productName: p.name || 'Producto',
        sku: p.sku || 'SKU',
        barcode: p.barcode || '',
        unitOfMeasure: p.unit_of_measure || p.unit_type || 'UND',
        imageUrl: p.primary_image_url || p.image_url || '',
        quantity: Number(it.quantity || 0),
        unitPrice: Number(it.unit_price || 0),
        unitCost: Number(it.unit_cost || 0),
        discountPercent: Number(it.discount_percent || 0),
        discountAmount: Math.round(Number(it.subtotal || 0) * (Number(it.discount_percent || 0) / 100)),
        taxRatePercent: Number(it.tax_rate_percent || 0),
        taxAmount: Number(it.tax_amount || 0),
        subtotal: Number(it.subtotal || 0),
        total: Number(it.total || 0),
      }
    })
  }

  /**
   * Busca venta por ID con sus líneas normalizadas
   */
  async findById(id: string): Promise<Sale | null> {
    const { data, error } = await supabaseClient
      .from('sales')
      .select(`
        id,
        sale_number,
        location_id,
        customer_id,
        seller_user_id,
        cash_session_id,
        subtotal_amount,
        discount_amount,
        tax_amount,
        total_amount,
        total_cost_amount,
        payment_method,
        payment_status,
        paid_amount,
        payment_terms,
        due_date,
        status,
        notes,
        created_at,
        updated_at,
        customers (
          id,
          first_name,
          last_name,
          company_name,
          document_type,
          document_number,
          customer_type,
          customer_category
        ),
        locations (
          id,
          name,
          code
        ),
        users (
          id,
          full_name,
          email
        ),
        sale_items (
          id,
          product_id,
          quantity,
          unit_cost,
          unit_price,
          discount_percent,
          tax_rate_percent,
          tax_amount,
          subtotal,
          total,
          products (
            name,
            sku,
            barcode,
            unit_of_measure,
            primary_image_url
          )
        )
      `)
      .eq('id', id)
      .maybeSingle()

    if (error || !data) return null
    return this.mapDbRowToSale(data)
  }

  /**
   * Obtiene el detalle relacional completo de la venta
   */
  async getDetail(id: string): Promise<SaleDetail | null> {
    const sale = await this.findById(id)
    if (!sale) return null

    // 1. Cliente
    const { data: customerRow } = await supabaseClient
      .from('customers')
      .select('*')
      .eq('id', sale.customerId)
      .maybeSingle()

    const customer = customerRow
      ? {
          id: customerRow.id,
          displayName: customerRow.company_name || `${customerRow.first_name || ''} ${customerRow.last_name || ''}`.trim() || 'Cliente',
          documentNumber: customerRow.document_number,
          documentType: customerRow.document_type || 'CC',
          phone: customerRow.phone || '',
          email: customerRow.email || '',
          address: customerRow.address || '',
          city: customerRow.city || 'Medellín',
          creditLimit: Number(customerRow.credit_limit || 0),
          currentBalance: Number(customerRow.current_balance || 0),
        }
      : undefined

    // 2. Factura electrónica DIAN si existe
    const { data: eInvoice } = await supabaseClient
      .from('electronic_invoices')
      .select('*')
      .eq('sale_id', sale.id)
      .eq('document_type', 'INVOICE') // las notas crédito/débito comparten sale_id con la factura
      .maybeSingle()

    const invoice = eInvoice
      ? {
          id: eInvoice.id,
          invoiceNumber: eInvoice.full_number || `${eInvoice.prefix}-${eInvoice.number}`,
          date: eInvoice.created_at,
          dianStatus: eInvoice.dian_status,
          dianCufe: eInvoice.cufe,
          total: Number(eInvoice.total_amount || 0),
          status: 'PAID',
        }
      : undefined

    // 3. Remisión relacionada si existe
    const { data: rem } = await supabaseClient
      .from('remissions')
      .select('*')
      .eq('sale_id', sale.id)
      .maybeSingle()

    const remission = rem
      ? {
          id: rem.id,
          remissionNumber: rem.code,
          date: rem.created_at,
          status: rem.status,
          driverName: rem.driver_name,
        }
      : undefined

    // 4. Movimientos de inventario generados
    const { data: movs } = await supabaseClient
      .from('inventory_movements')
      .select(`
        id,
        consecutive,
        movement_type,
        product_id,
        quantity_in,
        quantity_out,
        created_at,
        document_reference,
        reason,
        products ( name, sku )
      `)
      .eq('document_reference', sale.saleNumber)

    const saleMovements = (movs || []).map((m: any) => ({
      id: m.id,
      movementNumber: `MOV-${m.consecutive || m.id.slice(0, 6)}`,
      type: m.movement_type,
      productId: m.product_id,
      productName: m.products?.name || 'Producto',
      sku: m.products?.sku || 'SKU',
      quantityIn: Number(m.quantity_in || 0),
      quantityOut: Number(m.quantity_out || 0),
      createdAt: m.created_at,
      sourceDocumentId: sale.id,
      sourceDocumentNumber: sale.saleNumber,
      notes: m.reason || '',
    }))

    // 5. Auditoría
    const { data: audits } = await supabaseClient
      .from('audit_logs')
      .select('*')
      .eq('entity_name', 'sales')
      .eq('entity_id', sale.id)
      .order('created_at', { ascending: false })

    const saleAudit = (audits || []).map((a: any) => ({
      id: a.id,
      timestamp: a.created_at,
      user: a.user_name || 'Sistema',
      action: a.action,
      details: `${displayLabel(ACTION_LABELS, a.action)} de la venta ${sale.saleNumber}`,
      oldValues: a.previous_value,
      newValues: a.new_value,
    }))

    return {
      ...sale,
      customer,
      invoice,
      remission,
      inventoryMovements: saleMovements,
      auditLogs: saleAudit,
    }
  }

  /**
   * Crea la venta del módulo Ventas en una sola transacción del servidor (fn_create_sale_with_payments):
   * número, precios, IVA, costo, stock/kardex, pagos, caja del usuario, banco, cartera y asiento.
   * El navegador solo envía ids, cantidades, descuentos y pagos.
   */
  async createWithPayments(input: {
    locationId: string
    customerId: string
    idempotencyKey: string
    items: Array<{ productId: string; quantity: number; discountPercent: number }>
    payments: SalePaymentInput[]
    notes?: string
  }): Promise<CreateSaleRpcResult> {
    const { data, error } = await supabaseClient.rpc('fn_create_sale_with_payments', {
      p_location_id: input.locationId,
      p_customer_id: input.customerId,
      p_idempotency_key: input.idempotencyKey,
      p_items: input.items.map((it) => ({
        product_id: it.productId,
        quantity: it.quantity,
        discount_percent: it.discountPercent,
      })),
      p_payments: input.payments,
      p_notes: input.notes ?? null,
    })
    if (error) throw new Error(error.message)
    const res = data as CreateSaleRpcResult | null
    if (!res?.success || !res.sale_id) {
      throw new Error('El servidor no confirmó el registro de la venta. Intente de nuevo: no se duplicará.')
    }
    return res
  }

  /**
   * Anula la venta en una sola transacción del servidor (fn_cancel_sale, 079): stock (kardex), caja,
   * banco, cartera y asiento contable. El servidor bloquea la anulación si la venta tiene factura
   * electrónica (se usa nota crédito), devoluciones, remisiones o abonos.
   */
  async cancelSale(saleId: string, reason: string): Promise<CancelSaleRpcResult> {
    const { data, error } = await supabaseClient.rpc('fn_cancel_sale', {
      p_sale_id: saleId,
      p_reason: reason,
    })
    if (error) throw new Error(error.message)
    const res = data as CancelSaleRpcResult | null
    if (!res?.success) {
      throw new Error('El servidor no confirmó la anulación de la venta. Actualice el listado y verifique su estado.')
    }
    return res
  }

  /**
   * Devolución de mercancía en buen estado por la RPC atómica de Devoluciones (fn_process_customer_return, 068):
   * reingreso a kardex y documento de devolución. Las devoluciones con mercancía en mal estado se
   * registran desde el módulo Devoluciones.
   */
  async processCustomerReturn(input: {
    saleId: string
    reason: string
    items: Array<{ productId: string; quantity: number; reason?: string }>
  }): Promise<{ returnId: string; code: string }> {
    const { data, error } = await supabaseClient.rpc('fn_process_customer_return', {
      p_sale_id: input.saleId,
      p_items: input.items.map((it) => ({
        product_id: it.productId,
        quantity: it.quantity,
        reason: it.reason || null,
        condition: 'BUENO',
      })),
      p_reason: input.reason,
      p_notes: null,
    })
    if (error) throw new Error(error.message)
    const res = data as { success?: boolean; return_id?: string; code?: string } | null
    if (!res?.success || !res.return_id) {
      throw new Error('El servidor no confirmó la devolución. Actualice el listado y verifique en Devoluciones.')
    }
    return { returnId: res.return_id, code: res.code || '' }
  }

  /**
   * Genera factura POS / Electrónica DIAN separada
   */
  async generateInvoice(
    sale: Sale,
    type: 'FACTURA_ELECTRONICA' | 'FACTURA_POS',
    user: { userId: string; userName: string }
  ): Promise<{ invoiceId: string; invoiceNumber: string }> {
    const companyId = await this.resolveCompanyId()

    if (type === 'FACTURA_ELECTRONICA') {
      // La factura electrónica la numera, construye y transmite el servidor (resolución DIAN vigente).
      const res = await dianApiClient.emitFromSale(sale.id)
      return { invoiceId: res.invoiceId, invoiceNumber: res.documentNumber }
    } else {
      const invoiceNumber = `POS-${sale.saleNumber.slice(-4)}`
      return { invoiceId: sale.id, invoiceNumber }
    }
  }

  /**
   * Genera guía de remisión asociada a la venta
   */
  async generateRemission(
    sale: Sale,
    details: { deliveredBy?: string; driverName?: string; receivedBy?: string; notes?: string },
    user: { userId: string; userName: string }
  ): Promise<{ remissionId: string; remissionNumber: string }> {
    const companyId = await this.resolveCompanyId()
    const code = `REM-${Date.now().toString().slice(-6)}`

    const { data: created, error } = await supabaseClient
      .from('remissions')
      .insert({
        company_id: companyId,
        code,
        sale_id: sale.id,
        customer_id: sale.customerId,
        origin_location_id: sale.locationId,
        status: 'CREATED',
        driver_name: details.driverName || 'Conductor Asignado',
        notes: details.notes || `Remisión generada por venta ${sale.saleNumber}`,
      })
      .select()
      .single()

    if (error || !created) {
      throw new Error(`Error al generar remisión: ${error?.message}`)
    }

    return { remissionId: created.id, remissionNumber: code }
  }

  /**
   * Registra auditoría en public.audit_logs
   */
  async logAudit(entry: {
    user: string
    action: string
    details: string
    entityId: string
    oldValues?: Record<string, unknown>
    newValues?: Record<string, unknown>
  }): Promise<void> {
    const companyId = await this.resolveCompanyId()
    const { data: authUser } = await supabaseClient.auth.getUser()

    await supabaseClient.from('audit_logs').insert({
      company_id: companyId,
      user_id: authUser.user?.id || null,
      user_name: entry.user || 'Sistema',
      module: 'SALES',
      entity_name: 'sales',
      entity_id: entry.entityId,
      action: entry.action,
      previous_value: entry.oldValues || null,
      new_value: entry.newValues || null,
    })
  }

  /**
   * Calcula estadísticas clave del módulo Ventas desde PostgreSQL
   */
  async getStats(): Promise<SaleStats> {
    const { data: sales, error } = await supabaseClient
      .from('sales')
      .select('id, total_amount, status, customer_id, sale_items ( quantity )')

    if (error || !sales) {
      return {
        periodTotalSales: 0,
        periodSalesCount: 0,
        averageTicket: 0,
        totalUnitsSold: 0,
        uniqueCustomersServed: 0,
        pendingToInvoiceCount: 0,
        cancelledSalesCount: 0,
      }
    }

    const nonCancelled = sales.filter((s) => s.status !== 'CANCELLED')
    const periodTotalSales = nonCancelled.reduce((sum, s) => sum + Number(s.total_amount || 0), 0)
    const periodSalesCount = nonCancelled.length
    const averageTicket = periodSalesCount > 0 ? Math.round(periodTotalSales / periodSalesCount) : 0

    let totalUnitsSold = 0
    for (const s of nonCancelled) {
      const items = (s.sale_items as any[]) || []
      for (const it of items) {
        totalUnitsSold += Number(it.quantity || 0)
      }
    }

    const uniqueCustomers = new Set(nonCancelled.map((s) => s.customer_id))
    const uniqueCustomersServed = uniqueCustomers.size
    const cancelledSalesCount = sales.filter((s) => s.status === 'CANCELLED').length

    return {
      periodTotalSales,
      periodSalesCount,
      averageTicket,
      totalUnitsSold,
      uniqueCustomersServed,
      pendingToInvoiceCount: 0,
      cancelledSalesCount,
    }
  }
}

export const salesRepository = new SalesRepository()
