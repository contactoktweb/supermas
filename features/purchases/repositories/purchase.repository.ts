import { supabaseClient } from '@/lib/supabase/client'
import { SupabaseClient } from '@supabase/supabase-js'
import {
  Purchase,
  PurchaseFilterParams,
  PurchaseStats,
  PurchaseItem,
  PurchasePayment,
  PurchaseReceipt,
  PurchaseReceiptItem,
  ReceivePurchaseInput,
  RegisterPaymentInput,
  CreatePurchaseInput,
  UpdatePurchaseInput,
} from '../types'

/**
 * Mapea un registro de public.purchases con sus relaciones a la entidad de dominio Purchase
 */
function mapDbRowToPurchase(row: any): Purchase {
  const sup = row.suppliers || {}
  const loc = row.locations || {}
  const rawItems = (row.purchase_items as any[]) || []
  const rawPayments = (row.supplier_payments as any[]) || []
  const confirmedUser = row.confirmed_by_user || {}
  const receivedUser = row.received_by_user || {}

  const items: PurchaseItem[] = rawItems.map((it) => {
    const p = it.products || {}
    const taxRate = Number(it.tax_rate_percent || 0)
    return {
      id: it.id,
      productId: it.product_id,
      productName: p.name || 'Producto',
      sku: p.sku || 'SKU',
      barcode: p.barcode || undefined,
      unitOfMeasure: p.unit_of_measure || 'UND',
      imageUrl: p.primary_image_url || p.image_url || undefined,
      quantity: Number(it.quantity || 0),
      receivedQuantity: Number(it.received_quantity || 0),
      unitCost: Number(it.unit_cost || 0),
      discountPercent: Number(it.discount_percent || 0),
      discountAmount: Number(it.discount_amount || 0),
      taxRatePercent: taxRate,
      taxCode: taxRate === 19 ? 'IVA_19' : taxRate === 5 ? 'IVA_5' : 'IVA_0',
      taxAmount: Number(it.tax_amount || 0),
      subtotal: Number(it.subtotal || 0),
      total: Number(it.total || 0),
    }
  })

  const payments: PurchasePayment[] = rawPayments.map((pay) => {
    const payUser = pay.created_by_user || {}
    return {
      id: pay.id,
      purchaseId: pay.purchase_id || row.id,
      date: pay.payment_date || pay.created_at,
      amount: Number(pay.amount || 0),
      paymentMethod: (pay.payment_method as any) || 'TRANSFERENCIA',
      reference: pay.transaction_reference || 'N/A',
      notes: pay.notes || undefined,
      registeredByUserId: pay.created_by_user_id || undefined,
      registeredByUserName: payUser.full_name || undefined,
      createdAt: pay.created_at,
    }
  })

  const subtotal = Number(row.subtotal_amount || 0)
  const discountTotal = Number(row.discount_amount || 0)
  const taxTotal = Number(row.tax_amount || 0)
  const total = Number(row.total_amount || 0)
  const paidAmount = Number(row.paid_amount || 0)
  const pendingBalance = Math.max(0, total - paidAmount)

  let status: Purchase['status'] = 'CONFIRMADA'
  const invStatus = (row.inventory_status || '').toUpperCase()
  if (invStatus === 'CANCELLED' || invStatus === 'CANCELADA') {
    status = 'CANCELADA'
  } else if (invStatus === 'DRAFT' || invStatus === 'BORRADOR') {
    status = 'BORRADOR'
  } else if (invStatus === 'PARTIALLY_RECEIVED' || invStatus === 'RECIBIDA_PARCIALMENTE') {
    status = 'RECIBIDA_PARCIALMENTE'
  } else if (invStatus === 'RECEIVED' || invStatus === 'RECIBIDA') {
    if (row.payment_status === 'PAID' || pendingBalance <= 0) {
      status = 'PAID'
    } else if (paidAmount > 0) {
      status = 'PAYMENT_PENDING'
    } else {
      status = 'RECIBIDA'
    }
  } else {
    status = 'CONFIRMADA'
  }

  return {
    id: row.id,
    purchaseNumber: row.purchase_number,
    supplierInvoiceNumber: row.supplier_invoice_number,
    invoiceNumber: row.purchase_number,
    date: row.issue_date,
    dueDate: row.due_date || undefined,
    supplierId: row.supplier_id,
    supplierName: sup.name || sup.legal_name || 'Proveedor',
    supplierNit: sup.tax_id || '',
    supplierPhone: sup.phone || undefined,
    supplierEmail: sup.email || undefined,
    destinationLocationId: row.location_id,
    destinationLocationName: loc.name || 'Bodega',
    destinationLocationCode: loc.code || 'BOD',
    locationId: row.location_id,
    paymentType: row.payment_terms || 'CONTADO',
    paymentTerms: row.payment_terms || 'CONTADO',
    status,
    subtotal,
    discountTotal,
    taxTotal,
    total,
    paidAmount,
    pendingBalance,
    totalCost: total,
    itemsCount: items.reduce((acc, i) => acc + i.quantity, 0),
    items,
    payments,
    attachments: [],
    createdByUserId: row.confirmed_by_user_id || undefined,
    createdByUserName: confirmedUser.full_name || undefined,
    notes: row.notes || undefined,
    confirmedAt: row.confirmed_at || undefined,
    confirmedByUserId: row.confirmed_by_user_id || undefined,
    confirmedByUserName: confirmedUser.full_name || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    receptionInfo: row.received_at
      ? {
          receivedAt: row.received_at,
          receivedByUserId: row.received_by_user_id || undefined,
          receivedByUserName: receivedUser.full_name || 'Recepción Bodega',
          notes: 'Mercancía recibida en bodega',
        }
      : undefined,
  }
}

/**
 * Mapea errores de PostgreSQL / RPC a errores comprensibles de dominio
 */
export function parsePurchaseDatabaseError(error: any): Error {
  if (!error) return new Error('Error desconocido en la base de datos.')

  const msg = error.message || String(error)
  const code = error.code || ''

  if (msg.includes('proveedor no existe o pertenece a otra empresa')) {
    return new Error('El proveedor seleccionado no existe o pertenece a otra empresa.')
  }
  if (msg.includes('proveedor seleccionado se encuentra inactivo')) {
    return new Error('El proveedor seleccionado se encuentra inactivo.')
  }
  if (msg.includes('bodega de destino no existe o pertenece a otra empresa')) {
    return new Error('La bodega de destino no existe o pertenece a otra empresa.')
  }
  if (msg.includes('bodega de destino seleccionada se encuentra inactiva')) {
    return new Error('La bodega de destino seleccionada se encuentra inactiva.')
  }
  if (msg.includes('bodega de destino no tiene habilitadas operaciones de compra')) {
    return new Error('La bodega de destino no tiene habilitadas operaciones de compra (allow_purchases = false).')
  }
  if (msg.includes('usuario no tiene acceso a la bodega seleccionada')) {
    return new Error('No tienes acceso autorizado a la bodega de destino seleccionada.')
  }
  if (msg.includes('No tienes permisos suficientes para registrar compras')) {
    return new Error('No tienes permisos para registrar compras (purchases.create requerido).')
  }
  if (msg.includes('No tienes permisos para modificar compras')) {
    return new Error('No tienes permisos para modificar compras (purchases.create requerido).')
  }
  if (msg.includes('No tienes permisos para confirmar compras')) {
    return new Error('No tienes permisos para confirmar compras (purchases.create requerido).')
  }
  if (msg.includes('No tienes permisos para anular compras')) {
    return new Error('No tienes permisos para anular compras (purchases.create requerido).')
  }
  if (msg.includes('Debe incluir al menos un producto')) {
    return new Error('Debe incluir al menos un producto en la orden de compra.')
  }
  if (msg.includes('La cantidad de cada producto debe ser estrictamente mayor a 0')) {
    return new Error(msg)
  }
  if (msg.includes('El costo unitario no puede ser negativo')) {
    return new Error(msg)
  }
  if (msg.includes('no existe o pertenece a otra empresa') && msg.includes('producto')) {
    return new Error(msg)
  }
  if (msg.includes('se encuentra inactivo') && msg.includes('producto')) {
    return new Error(msg)
  }
  if (msg.includes('Solo las órdenes de compra en borrador pueden ser modificadas')) {
    return new Error(msg)
  }
  if (msg.includes('La orden de compra ya fue confirmada')) {
    return new Error(msg)
  }
  if (msg.includes('está confirmada y es inmutable')) {
    return new Error('La orden de compra ya fue confirmada y no puede ser modificada. Para cambiar productos o costos debe cancelarse y emitirse una nueva.')
  }
  if (msg.includes('No se pueden eliminar líneas de una orden de compra')) {
    return new Error('No se pueden eliminar líneas de una orden de compra confirmada.')
  }
  if (msg.includes('No está permitido anular órdenes con mercancía recibida') || msg.includes('tiene ítems con cantidades recibidas')) {
    return new Error('No está permitido anular órdenes con mercancía recibida en bodega. Debe tramitarse devolución a proveedor.')
  }
  if (msg.includes('Exceso de recepción:')) {
    return new Error(msg)
  }
  if (msg.includes('No se puede recibir una orden en estado BORRADOR')) {
    return new Error('No se puede recibir una orden en estado BORRADOR. Debe confirmarse primero.')
  }
  if (msg.includes('No se puede recibir una orden en estado CANCELADA')) {
    return new Error('No se puede recibir una orden en estado CANCELADA.')
  }
  if (msg.includes('La orden de compra ya ha sido RECIBIDA')) {
    return new Error('La orden de compra ya ha sido RECIBIDA en su totalidad.')
  }
  if (msg.includes('La cantidad a recibir debe ser estrictamente mayor a 0')) {
    return new Error(msg)
  }
  if (msg.includes('No tienes permisos suficientes para registrar recepciones')) {
    return new Error('No tienes permisos suficientes para registrar recepciones (purchases.create requerido).')
  }
  if (msg.includes('no pertenece a la orden de compra')) {
    return new Error(msg)
  }
  if (code === '23505' && msg.includes('purchase_number')) {
    return new Error('El número de orden de compra ya existe en esta empresa.')
  }
  if (code === '42501') {
    return new Error(`Permiso denegado por políticas de seguridad: ${msg}`)
  }

  return new Error(msg)
}

export class PurchaseRepository {
  private client: SupabaseClient

  constructor(client: SupabaseClient = supabaseClient) {
    this.client = client
  }

  withClient(client: SupabaseClient): PurchaseRepository {
    return new PurchaseRepository(client)
  }
  /**
   * Resuelve el company_id activo del usuario autenticado de forma estricta
   */
  async resolveCompanyId(): Promise<string> {
    const { data: authData } = await this.client.auth.getUser()
    if (authData.user) {
      const { data: userProfile } = await this.client
        .from('users')
        .select('company_id')
        .eq('id', authData.user.id)
        .maybeSingle()

      if (userProfile?.company_id) return userProfile.company_id
    }
    throw new Error('No se pudo resolver la empresa activa del usuario autenticado.')
  }

  /**
   * Consulta compras con filtros dinámicos, ordenamiento y paginación reales desde PostgreSQL
   */
  async findAll(params: PurchaseFilterParams): Promise<{ data: Purchase[]; total: number }> {
    let query = this.client.from('purchases').select(
      `
        id,
        purchase_number,
        supplier_invoice_number,
        supplier_id,
        location_id,
        issue_date,
        due_date,
        subtotal_amount,
        discount_amount,
        tax_amount,
        total_amount,
        paid_amount,
        payment_terms,
        payment_status,
        inventory_status,
        invoice_attachment_url,
        notes,
        confirmed_at,
        confirmed_by_user_id,
        created_at,
        updated_at,
        received_at,
        received_by_user_id,
        confirmed_by_user:users!confirmed_by_user_id (
          id,
          full_name,
          email
        ),
        received_by_user:users!received_by_user_id (
          id,
          full_name,
          email
        ),
        suppliers (
          id,
          name,
          legal_name,
          tax_id,
          phone,
          email
        ),
        locations (
          id,
          code,
          name,
          city
        ),
        purchase_items (
          id,
          product_id,
          quantity,
          received_quantity,
          unit_cost,
          discount_percent,
          discount_amount,
          tax_rate_percent,
          tax_amount,
          subtotal,
          total,
          products (
            id,
            name,
            sku,
            barcode,
            unit_of_measure,
            primary_image_url
          )
        ),
        supplier_payments (
          id,
          payment_date,
          amount,
          payment_method,
          transaction_reference,
          notes,
          created_by_user_id,
          created_at,
          created_by_user:users!created_by_user_id (
            id,
            full_name
          )
        )
      `,
      { count: 'exact' }
    )

    // 1. Búsqueda por texto (número de compra, factura proveedor, notas)
    if (params.query && params.query.trim()) {
      const q = params.query.trim().toLowerCase()
      query = query.or(
        `purchase_number.ilike.%${q}%,supplier_invoice_number.ilike.%${q}%,notes.ilike.%${q}%`
      )
    }

    // 2. Filtro por proveedor
    if (params.supplierId && params.supplierId !== 'ALL') {
      query = query.eq('supplier_id', params.supplierId)
    }

    // 3. Filtro por bodega de destino
    if (params.locationId && params.locationId !== 'ALL') {
      query = query.eq('location_id', params.locationId)
    }

    // 4. Filtro por estado
    if (params.status && params.status !== 'ALL') {
      const st = params.status as string
      if (st === 'DRAFT' || st === 'BORRADOR') {
        query = query.in('inventory_status', ['DRAFT', 'BORRADOR'])
      } else if (st === 'CONFIRMED' || st === 'CONFIRMADA' || st === 'PENDING_RECEPTION' || st === 'PENDING') {
        query = query.in('inventory_status', ['CONFIRMED', 'CONFIRMADA', 'PENDING', 'PENDING_RECEPTION'])
      } else if (st === 'PARTIALLY_RECEIVED' || st === 'RECIBIDA_PARCIALMENTE') {
        query = query.in('inventory_status', ['PARTIALLY_RECEIVED', 'RECIBIDA_PARCIALMENTE'])
      } else if (st === 'RECEIVED' || st === 'RECIBIDA') {
        query = query.in('inventory_status', ['RECEIVED', 'RECIBIDA'])
      } else if (st === 'CANCELLED' || st === 'CANCELADA') {
        query = query.in('inventory_status', ['CANCELLED', 'CANCELADA'])
      } else if (st === 'PAYMENT_PENDING' || st === 'PARTIAL') {
        query = query.eq('payment_status', 'PARTIAL').not('inventory_status', 'in', '("CANCELLED","CANCELADA")')
      } else if (st === 'PAID') {
        query = query.eq('payment_status', 'PAID').not('inventory_status', 'in', '("CANCELLED","CANCELADA")')
      } else if (st === 'OVERDUE') {
        query = query.eq('payment_status', 'OVERDUE').not('inventory_status', 'in', '("CANCELLED","CANCELADA")')
      }
    }

    // 5. Filtro por forma de pago
    if (params.paymentType && params.paymentType !== 'ALL') {
      query = query.eq('payment_terms', params.paymentType)
    }

    // 6. Rango de fechas
    if (params.startDate) {
      query = query.gte('issue_date', params.startDate)
    }
    if (params.endDate) {
      query = query.lte('issue_date', params.endDate)
    }

    // 7. Ordenamiento
    const sortField = (params.sortField || 'date') as string
    const sortDirection = params.sortDirection || 'desc'
    const ascending = sortDirection === 'asc'

    if (sortField === 'date') {
      query = query.order('issue_date', { ascending }).order('created_at', { ascending })
    } else if (sortField === 'total' || sortField === 'totalCost') {
      query = query.order('total_amount', { ascending })
    } else {
      query = query.order('created_at', { ascending })
    }

    // 8. Paginación
    const page = Math.max(1, params.page || 1)
    const pageSize = Math.max(1, params.pageSize || 10)
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    query = query.range(from, to)

    const { data, count, error } = await query

    if (error) {
      console.error('Error consultando compras en PostgreSQL:', error)
      throw new Error(`Error consultando compras: ${error.message}`)
    }

    const items = (data || []).map(mapDbRowToPurchase)

    return {
      data: items,
      total: count || 0,
    }
  }

  /**
   * Obtiene una compra por su ID con relaciones completas
   */
  async findById(id: string): Promise<Purchase | null> {
    const { data, error } = await this.client
      .from('purchases')
      .select(
        `
        id,
        purchase_number,
        supplier_invoice_number,
        supplier_id,
        location_id,
        issue_date,
        due_date,
        subtotal_amount,
        discount_amount,
        tax_amount,
        total_amount,
        paid_amount,
        payment_terms,
        payment_status,
        inventory_status,
        invoice_attachment_url,
        notes,
        confirmed_at,
        confirmed_by_user_id,
        created_at,
        updated_at,
        received_at,
        received_by_user_id,
        confirmed_by_user:users!confirmed_by_user_id (
          id,
          full_name,
          email
        ),
        received_by_user:users!received_by_user_id (
          id,
          full_name,
          email
        ),
        suppliers (
          id,
          name,
          legal_name,
          tax_id,
          phone,
          email
        ),
        locations (
          id,
          code,
          name,
          city
        ),
        purchase_items (
          id,
          product_id,
          quantity,
          received_quantity,
          unit_cost,
          discount_percent,
          discount_amount,
          tax_rate_percent,
          tax_amount,
          subtotal,
          total,
          products (
            id,
            name,
            sku,
            barcode,
            unit_of_measure,
            primary_image_url
          )
        ),
        supplier_payments (
          id,
          payment_date,
          amount,
          payment_method,
          transaction_reference,
          notes,
          created_by_user_id,
          created_at,
          created_by_user:users!created_by_user_id (
            id,
            full_name
          )
        )
      `
      )
      .eq('id', id)
      .single()

    if (error || !data) return null

    return mapDbRowToPurchase(data)
  }

  /**
   * Registra una nueva orden de compra en PostgreSQL mediante la RPC atómica fn_create_purchase_order
   */
  async create(input: CreatePurchaseInput | Purchase): Promise<Purchase> {
    const supplierId = 'supplierId' in input ? input.supplierId : (input as any).supplierId
    const destinationLocationId =
      'destinationLocationId' in input
        ? input.destinationLocationId
        : (input as any).locationId || (input as any).destinationLocationId
    const supplierInvoiceNumber =
      'supplierInvoiceNumber' in input
        ? input.supplierInvoiceNumber
        : (input as any).supplierInvoiceNumber || (input as any).invoiceNumber
    const date = 'date' in input ? input.date : (input as any).date
    const paymentType = 'paymentType' in input ? input.paymentType : (input as any).paymentType || 'CONTADO'
    const dueDate = input.dueDate
    const notes = input.notes
    const saveAsDraft =
      'saveAsDraft' in input
        ? input.saveAsDraft
        : (input as any).status === 'BORRADOR' || (input as any).status === 'DRAFT'

    const itemsPayload = (input.items || []).map((it: any) => ({
      product_id: it.productId,
      quantity: Number(it.quantity),
      unit_cost: Number(it.unitCost),
      discount_percent: Number(it.discountPercent || 0),
      tax_rate_percent: Number(it.taxRatePercent !== undefined ? it.taxRatePercent : 19),
    }))

    const { data: createdId, error } = await this.client.rpc('fn_create_purchase_order', {
      p_supplier_id: supplierId,
      p_location_id: destinationLocationId,
      p_supplier_invoice_number: (supplierInvoiceNumber || '').trim(),
      p_issue_date: date ? date.split('T')[0] : null,
      p_due_date: dueDate ? dueDate.split('T')[0] : null,
      p_payment_terms: paymentType,
      p_notes: notes || null,
      p_save_as_draft: Boolean(saveAsDraft),
      p_items: itemsPayload,
    })

    if (error || !createdId) {
      console.error('Error ejecutando fn_create_purchase_order:', error)
      throw parsePurchaseDatabaseError(error)
    }

    const created = await this.findById(createdId)
    if (!created) {
      throw new Error('Orden de compra creada pero no pudo ser consultada tras el registro.')
    }

    return created
  }

  /**
   * Actualiza una orden de compra en estado BORRADOR mediante la RPC fn_update_purchase_order
   */
  async update(purchaseId: string, input: UpdatePurchaseInput): Promise<Purchase> {
    const itemsPayload = (input.items || []).map((it: any) => ({
      product_id: it.productId,
      quantity: Number(it.quantity),
      unit_cost: Number(it.unitCost),
      discount_percent: Number(it.discountPercent || 0),
      tax_rate_percent: Number(it.taxRatePercent !== undefined ? it.taxRatePercent : 19),
    }))

    const { data: updatedId, error } = await this.client.rpc('fn_update_purchase_order', {
      p_purchase_id: purchaseId,
      p_supplier_id: input.supplierId,
      p_location_id: input.destinationLocationId,
      p_supplier_invoice_number: input.supplierInvoiceNumber.trim(),
      p_issue_date: input.date ? input.date.split('T')[0] : null,
      p_due_date: input.dueDate ? input.dueDate.split('T')[0] : null,
      p_payment_terms: input.paymentType,
      p_notes: input.notes || null,
      p_save_as_draft: Boolean(input.saveAsDraft),
      p_items: itemsPayload,
    })

    if (error || !updatedId) {
      console.error('Error ejecutando fn_update_purchase_order:', error)
      throw parsePurchaseDatabaseError(error)
    }

    const updated = await this.findById(purchaseId)
    if (!updated) {
      throw new Error('Orden de compra actualizada pero no pudo ser consultada.')
    }

    return updated
  }

  /**
   * Confirma formalmente una orden de compra en estado BORRADOR
   */
  async confirm(purchaseId: string, _user?: { id: string; name: string }): Promise<Purchase> {
    const { error } = await this.client.rpc('fn_confirm_purchase_order', {
      p_purchase_id: purchaseId,
    })

    if (error) {
      console.error('Error ejecutando fn_confirm_purchase_order:', error)
      throw parsePurchaseDatabaseError(error)
    }

    const updated = await this.findById(purchaseId)
    if (!updated) throw new Error('Error recuperando orden confirmada.')
    return updated
  }

  /**
   * Anula una orden de compra siempre y cuando la mercancía no haya sido recibida
   */
  async cancel(purchaseId: string, reason: string, _user?: { id: string; name: string }): Promise<Purchase> {
    const { error } = await this.client.rpc('fn_cancel_purchase_order', {
      p_purchase_id: purchaseId,
      p_reason: reason,
    })

    if (error) {
      console.error('Error ejecutando fn_cancel_purchase_order:', error)
      throw parsePurchaseDatabaseError(error)
    }

    const updated = await this.findById(purchaseId)
    if (!updated) throw new Error('Error recuperando compra anulada.')
    return updated
  }

  /**
   * Recepción física de mercancía mediante RPC atómica fn_receive_purchase_order.
   */
  async receive(
    purchaseId: string,
    input: ReceivePurchaseInput,
    _user?: { id: string; name: string }
  ): Promise<Purchase> {
    let itemsToReceive = input.receivedItems

    if (!itemsToReceive || itemsToReceive.length === 0) {
      const current = await this.findById(purchaseId)
      if (current) {
        itemsToReceive = current.items
          .map((it) => ({
            itemId: it.id,
            quantityReceived: Math.max(0, it.quantity - (it.receivedQuantity || 0)),
          }))
          .filter((it) => it.quantityReceived > 0)
      }
    }

    if (!itemsToReceive || itemsToReceive.length === 0) {
      throw new Error('Debe indicar al menos una unidad a recibir en esta entrega.')
    }

    const payloadItems = itemsToReceive.map((it) => ({
      item_id: it.itemId,
      quantity_received: it.quantityReceived,
    }))

    const { data: rpcResult, error } = await this.client.rpc('fn_receive_purchase_order', {
      p_purchase_id: purchaseId,
      p_supplier_remission_number: input.supplierRemissionNumber?.trim() || null,
      p_notes: input.notes?.trim() || null,
      p_items: payloadItems,
    })

    if (error) {
      console.error('Error ejecutando fn_receive_purchase_order:', error)
      throw parsePurchaseDatabaseError(error)
    }

    const updated = await this.findById(purchaseId)
    if (!updated) throw new Error('Error recuperando compra tras recepción.')
    if (rpcResult?.reception_number && updated.receptionInfo) {
      updated.receptionInfo.receptionNumber = rpcResult.reception_number
    }
    return updated
  }

  /**
   * Registra un abono o pago a proveedor mediante la RPC atómica fn_register_supplier_payment.
   */
  async registerPayment(
    input: RegisterPaymentInput,
    _user?: { id: string; name: string }
  ): Promise<Purchase> {
    const { data, error } = await this.client.rpc('fn_register_supplier_payment', {
      p_purchase_id: input.purchaseId,
      p_amount: input.amount,
      p_payment_date: input.date || new Date().toISOString().split('T')[0],
      p_payment_method: input.paymentMethod || 'BANK_TRANSFER',
      p_transaction_reference: input.reference || null,
      p_notes: input.notes || null,
      p_bank_account_id: input.bankAccountId || null,
      p_cash_session_id: input.cashSessionId || null,
    })

    if (error) {
      console.error('Error registrando pago a proveedor:', error)
      throw new Error(error.message || 'Error al registrar el pago a proveedor')
    }

    const updated = await this.findById(input.purchaseId)
    if (!updated) {
      throw new Error('Error recuperando compra tras registrar el pago.')
    }
    return updated
  }

  /**
   * Consulta las actas de recepción de una compra con sus líneas y productos
   */
  async getReceipts(purchaseId?: string): Promise<PurchaseReceipt[]> {
    let query = this.client
      .from('purchase_receipts')
      .select(`
        id,
        reception_number,
        purchase_id,
        location_id,
        reception_date,
        received_by_user_id,
        supplier_remission_number,
        notes,
        created_at,
        locations ( id, name, code ),
        purchases ( id, purchase_number, supplier_id, suppliers ( id, name, legal_name ) ),
        purchase_receipt_items (
          id,
          purchase_item_id,
          product_id,
          quantity_received,
          unit_cost,
          created_at,
          products ( id, name, sku, barcode )
        ),
        users:received_by_user_id ( id, full_name )
      `)
      .order('reception_date', { ascending: false })

    if (purchaseId) {
      query = query.eq('purchase_id', purchaseId)
    }

    const { data, error } = await query
    if (error) {
      console.error('Error consultando purchase_receipts:', error)
      return []
    }

    return (data || []).map((row: any) => {
      const items: PurchaseReceiptItem[] = (row.purchase_receipt_items || []).map((it: any) => ({
        id: it.id,
        receptionId: row.id,
        purchaseItemId: it.purchase_item_id,
        productId: it.product_id,
        productName: it.products?.name || 'Producto',
        sku: it.products?.sku || '',
        quantityReceived: Number(it.quantity_received) || 0,
        unitCost: Number(it.unit_cost) || 0,
        createdAt: it.created_at,
      }))

      return {
        id: row.id,
        receptionNumber: row.reception_number,
        purchaseId: row.purchase_id,
        purchaseNumber: row.purchases?.purchase_number || '',
        supplierId: row.purchases?.supplier_id,
        supplierName: row.purchases?.suppliers?.name || row.purchases?.suppliers?.legal_name || 'Proveedor',
        locationId: row.location_id,
        locationName: row.locations?.name || 'Bodega',
        locationCode: row.locations?.code || '',
        receptionDate: row.reception_date,
        receivedByUserId: row.received_by_user_id,
        receivedByUserName: row.users?.full_name || 'Almacenista',
        supplierRemissionNumber: row.supplier_remission_number || undefined,
        notes: row.notes || undefined,
        createdAt: row.created_at,
        items,
      }
    })
  }

  /**
   * Obtiene estadísticas globales de compras desde PostgreSQL
   */
  async getPurchaseStats(_userContext?: any): Promise<PurchaseStats> {
    const { data, error } = await this.client
      .from('purchases')
      .select('id, total_amount, paid_amount, payment_status, inventory_status, due_date')
      .neq('inventory_status', 'CANCELADA')

    if (error || !data) {
      return {
        totalPurchasedPeriod: 0,
        pendingReceptionCount: 0,
        creditPurchasesCount: 0,
        cashPurchasesCount: 0,
        pendingPaymentInvoicesCount: 0,
        overdueInvoicesCount: 0,
        receivedProductsUnits: 0,
        totalPendingBalance: 0,
        isCostRedacted: false,
      }
    }

    const now = new Date().toISOString().split('T')[0]
    let totalPurchasesAmount = 0
    let totalPaidAmount = 0
    let totalPendingAmount = 0
    let pendingPurchasesCount = 0
    let receivedPurchasesCount = 0
    let overduePurchasesCount = 0

    for (const p of data) {
      const tot = Number(p.total_amount || 0)
      const paid = Number(p.paid_amount || 0)
      const pending = Math.max(0, tot - paid)

      totalPurchasesAmount += tot
      totalPaidAmount += paid
      totalPendingAmount += pending

      if (p.inventory_status === 'PENDING' || p.inventory_status === 'DRAFT' || p.inventory_status === 'BORRADOR') {
        pendingPurchasesCount++
      } else if (p.inventory_status === 'RECEIVED' || p.inventory_status === 'RECIBIDA') {
        receivedPurchasesCount++
      }

      if (p.payment_status !== 'PAID' && p.due_date && p.due_date < now) {
        overduePurchasesCount++
      }
    }

    return {
      totalPurchasedPeriod: totalPurchasesAmount,
      pendingReceptionCount: pendingPurchasesCount,
      creditPurchasesCount: pendingPurchasesCount,
      cashPurchasesCount: Math.max(0, data.length - pendingPurchasesCount),
      pendingPaymentInvoicesCount: pendingPurchasesCount,
      overdueInvoicesCount: overduePurchasesCount,
      receivedProductsUnits: 0,
      totalPendingBalance: totalPendingAmount,
      isCostRedacted: false,
    }
  }

  /**
   * Exporta compras en formato CSV
   */
  exportToCsv(purchases: Purchase[], isCostRedacted: boolean = false): string {
    const headers = [
      'Número Compra',
      'Factura Proveedor',
      'Fecha',
      'Proveedor',
      'NIT',
      'Bodega Destino',
      'Forma de Pago',
      'Estado',
    ]
    if (!isCostRedacted) {
      headers.push('Subtotal', 'IVA', 'Total', 'Pagado', 'Saldo Pendiente')
    }
    const rows = purchases.map((p) => {
      const base = [
        `"${p.purchaseNumber}"`,
        `"${p.supplierInvoiceNumber}"`,
        `"${p.date}"`,
        `"${p.supplierName.replace(/"/g, '""')}"`,
        `"${p.supplierNit}"`,
        `"${p.destinationLocationName}"`,
        `"${p.paymentType}"`,
        `"${p.status}"`,
      ]
      if (!isCostRedacted) {
        base.push(
          String(p.subtotal),
          String(p.taxTotal),
          String(p.total),
          String(p.paidAmount),
          String(p.pendingBalance)
        )
      }
      return base.join(',')
    })
    return [headers.join(','), ...rows].join('\n')
  }
}

export const purchaseRepository = new PurchaseRepository()
