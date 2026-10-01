import { supabaseClient } from '@/lib/supabase/client'
import {
  Purchase,
  PurchaseFilterParams,
  PurchaseStats,
  PurchaseItem,
  PurchasePayment,
  ReceivePurchaseInput,
  RegisterPaymentInput,
} from '../types'

/**
 * Mapea un registro de public.purchases con sus relaciones a la entidad de dominio Purchase
 */
function mapDbRowToPurchase(row: any): Purchase {
  const sup = row.suppliers || {}
  const loc = row.locations || {}
  const rawItems = (row.purchase_items as any[]) || []
  const rawPayments = (row.supplier_payments as any[]) || []

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
      imageUrl: p.image_url || undefined,
      quantity: Number(it.quantity || 0),
      receivedQuantity: row.inventory_status === 'RECEIVED' ? Number(it.quantity || 0) : 0,
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

  const payments: PurchasePayment[] = rawPayments.map((pay) => ({
    id: pay.id,
    purchaseId: pay.purchase_id || row.id,
    date: pay.payment_date || pay.created_at,
    amount: Number(pay.amount || 0),
    paymentMethod: (pay.payment_method as any) || 'TRANSFERENCIA',
    reference: pay.transaction_reference || 'N/A',
    notes: pay.notes || undefined,
    registeredByUserId: pay.created_by_user_id || 'usr-001',
    registeredByUserName: 'Administrador',
    createdAt: pay.created_at,
  }))

  const subtotal = Number(row.subtotal_amount || 0)
  const discountTotal = Number(row.discount_amount || 0)
  const taxTotal = Number(row.tax_amount || 0)
  const total = Number(row.total_amount || 0)
  const paidAmount = Number(row.paid_amount || 0)
  const pendingBalance = Math.max(0, total - paidAmount)

  let status: Purchase['status'] = 'PENDING_RECEPTION'
  if (row.inventory_status === 'CANCELLED') {
    status = 'CANCELLED'
  } else if (row.inventory_status === 'RECEIVED') {
    if (row.payment_status === 'PAID' || pendingBalance <= 0) {
      status = 'PAID'
    } else if (paidAmount > 0) {
      status = 'PAYMENT_PENDING'
    } else {
      status = 'RECEIVED'
    }
  } else if (row.inventory_status === 'DRAFT') {
    status = 'DRAFT'
  } else {
    status = 'PENDING_RECEPTION'
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
    createdByUserId: row.created_by_user_id || 'usr-001',
    createdByUserName: 'Administrador',
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    receptionInfo: row.received_at
      ? {
          receivedAt: row.received_at,
          receivedByUserId: row.received_by_user_id || undefined,
          receivedByUserName: 'Recepción Bodega',
          notes: 'Mercancía recibida en bodega',
        }
      : undefined,
  }
}

export class PurchaseRepository {
  /**
   * Resuelve el company_id activo del usuario autenticado
   */
  private async resolveCompanyId(): Promise<string> {
    const { data: comp } = await supabaseClient.from('companies').select('id').limit(1).single()
    if (comp?.id) return comp.id

    const { data: userProfile } = await supabaseClient
      .from('users')
      .select('company_id')
      .limit(1)
      .single()

    if (userProfile?.company_id) return userProfile.company_id
    throw new Error('No se pudo resolver la empresa activa del usuario.')
  }

  /**
   * Consulta compras con filtros dinámicos, ordenamiento y paginación reales desde PostgreSQL
   */
  async findAll(params: PurchaseFilterParams): Promise<{ data: Purchase[]; total: number }> {
    let query = supabaseClient.from('purchases').select(
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
        created_at,
        updated_at,
        received_at,
        received_by_user_id,
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
            image_url
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
          created_at
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
      if (st === 'DRAFT') {
        query = query.eq('inventory_status', 'DRAFT')
      } else if (st === 'PENDING_RECEPTION' || st === 'PENDING') {
        query = query.eq('inventory_status', 'PENDING')
      } else if (st === 'RECEIVED') {
        query = query.eq('inventory_status', 'RECEIVED')
      } else if (st === 'CANCELLED') {
        query = query.eq('inventory_status', 'CANCELLED')
      } else if (st === 'PAYMENT_PENDING' || st === 'PARTIAL') {
        query = query.eq('payment_status', 'PENDING').neq('inventory_status', 'CANCELLED')
      } else if (st === 'PAID') {
        query = query.eq('payment_status', 'PAID').neq('inventory_status', 'CANCELLED')
      } else if (st === 'OVERDUE') {
        query = query.eq('payment_status', 'OVERDUE').neq('inventory_status', 'CANCELLED')
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
    const { data, error } = await supabaseClient
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
        created_at,
        updated_at,
        received_at,
        received_by_user_id,
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
            image_url
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
          created_at
        )
      `
      )
      .eq('id', id)
      .single()

    if (error || !data) return null

    return mapDbRowToPurchase(data)
  }

  /**
   * Registra una nueva compra en PostgreSQL bajo RLS (compra + ítems)
   */
  async create(purchase: Purchase): Promise<Purchase> {
    const companyId = await this.resolveCompanyId()

    const issueDate = purchase.date
      ? purchase.date.split('T')[0]
      : new Date().toISOString().split('T')[0]

    let dueDate = purchase.dueDate ? purchase.dueDate.split('T')[0] : null
    if (!dueDate) {
      if (purchase.paymentType === 'CONTADO') {
        dueDate = issueDate
      } else {
        const d = new Date()
        d.setDate(d.getDate() + 30)
        dueDate = d.toISOString().split('T')[0]
      }
    }

    const isPaid = purchase.paymentType === 'CONTADO'
    const inventoryStatus =
      purchase.status === 'RECEIVED'
        ? 'RECEIVED'
        : purchase.status === 'DRAFT'
        ? 'DRAFT'
        : 'PENDING'

    // 1. Insertar cabecera de compra en public.purchases
    const { data: purchaseRow, error: purchaseError } = await supabaseClient
      .from('purchases')
      .insert({
        company_id: companyId,
        purchase_number: purchase.purchaseNumber,
        supplier_invoice_number: purchase.supplierInvoiceNumber,
        supplier_id: purchase.supplierId,
        location_id: purchase.destinationLocationId || purchase.locationId,
        issue_date: issueDate,
        due_date: dueDate,
        subtotal_amount: purchase.subtotal,
        discount_amount: purchase.discountTotal || 0,
        tax_amount: purchase.taxTotal,
        total_amount: purchase.total,
        paid_amount: isPaid ? purchase.total : 0,
        payment_terms: purchase.paymentType,
        payment_status: isPaid ? 'PAID' : 'PENDING',
        inventory_status: inventoryStatus,
        notes: purchase.notes || null,
      })
      .select()
      .single()

    if (purchaseError || !purchaseRow) {
      console.error('Error insertando compra en public.purchases:', purchaseError)
      throw new Error(`Error registrando compra: ${purchaseError?.message || 'Error desconocido'}`)
    }

    // 2. Insertar líneas en public.purchase_items
    if (purchase.items && purchase.items.length > 0) {
      const itemsPayload = purchase.items.map((it) => ({
        company_id: companyId,
        purchase_id: purchaseRow.id,
        product_id: it.productId,
        quantity: it.quantity,
        unit_cost: it.unitCost,
        discount_percent: it.discountPercent || 0,
        discount_amount: it.discountAmount || 0,
        tax_rate_percent: it.taxRatePercent,
        tax_amount: it.taxAmount,
        subtotal: it.subtotal,
        total: it.total,
      }))

      const { error: itemsError } = await supabaseClient
        .from('purchase_items')
        .insert(itemsPayload)

      if (itemsError) {
        console.error('Error insertando líneas de compra en public.purchase_items:', itemsError)
        throw new Error(`Error registrando líneas de compra: ${itemsError.message}`)
      }
    }

    // 3. Si la compra es de contado, registrar el pago en public.supplier_payments y egreso de caja si aplica
    if (isPaid && purchase.total > 0) {
      const { error: payError } = await supabaseClient.from('supplier_payments').insert({
        company_id: companyId,
        location_id: purchaseRow.location_id,
        purchase_id: purchaseRow.id,
        payment_number: `PAG-${Date.now().toString().slice(-6)}`,
        payment_date: issueDate,
        amount: purchase.total,
        payment_method: 'EFECTIVO',
        transaction_reference: `CONTADO-${purchaseRow.purchase_number}`,
        notes: 'Pago de contado al registrar la orden de compra',
        created_by_user_id:
          purchase.createdByUserId && purchase.createdByUserId.length === 36
            ? purchase.createdByUserId
            : null,
      })

      if (payError) {
        console.error('Error insertando pago de contado en supplier_payments:', payError)
      }

      // Movimiento financiero en caja si existe sesión abierta
      const { data: openSession } = await supabaseClient
        .from('cash_sessions')
        .select('id')
        .eq('status', 'OPEN')
        .limit(1)
        .maybeSingle()

      if (openSession?.id) {
        await supabaseClient.from('cash_movements').insert({
          session_id: openSession.id,
          type: 'EXPENSE',
          amount: purchase.total,
          reason: `Egreso por compra de contado ${purchaseRow.purchase_number}`,
          authorized_by_user_id:
            purchase.createdByUserId && purchase.createdByUserId.length === 36
              ? purchase.createdByUserId
              : null,
        })
      }
    }

    // Si la compra se creó directamente recibida (por ejemplo en carga inicial), procesar recepción
    if (inventoryStatus === 'RECEIVED') {
      await this.receive(purchaseRow.id, { purchaseId: purchaseRow.id }, { id: 'sys', name: 'Sistema' })
    }

    const created = await this.findById(purchaseRow.id)
    if (!created) {
      throw new Error('Compra creada pero no pudo ser consultada tras el registro.')
    }

    return created
  }

  /**
   * Recibe físicamente una compra en bodega:
   * Genera los movimientos en public.inventory_movements, lo cual dispara
   * automáticamente el trigger process_inventory_movement() en PostgreSQL
   * para actualizar el stock y el costo promedio ponderado de esa bodega específica.
   */
  async receive(
    purchaseId: string,
    input: ReceivePurchaseInput,
    user: { id: string; name: string }
  ): Promise<Purchase> {
    const { data: purchaseRow, error: pError } = await supabaseClient
      .from('purchases')
      .select(
        `
        id,
        company_id,
        purchase_number,
        supplier_invoice_number,
        location_id,
        inventory_status,
        payment_status,
        payment_terms,
        total_amount,
        paid_amount,
        purchase_items (
          id,
          product_id,
          quantity,
          unit_cost,
          total
        )
      `
      )
      .eq('id', purchaseId)
      .single()

    if (pError || !purchaseRow) {
      throw new Error(`Compra no encontrada (ID: ${purchaseId})`)
    }

    if (purchaseRow.inventory_status === 'RECEIVED') {
      throw new Error('Esta compra ya ha sido recibida previamente.')
    }

    if (purchaseRow.inventory_status === 'CANCELLED') {
      throw new Error('No es posible recibir una compra que ha sido anulada.')
    }

    const items = (purchaseRow.purchase_items as any[]) || []
    if (items.length === 0) {
      throw new Error('La compra no tiene productos para recibir en inventario.')
    }

    // 1. Obtener niveles de stock actuales para calcular previous_stock y new_stock
    const productIds = items.map((it) => it.product_id)
    const { data: currentStocks } = await supabaseClient
      .from('stock_levels')
      .select('product_id, quantity')
      .eq('location_id', purchaseRow.location_id)
      .in('product_id', productIds)

    const stockMap = new Map<string, number>()
    for (const s of currentStocks || []) {
      stockMap.set(s.product_id, Number(s.quantity) || 0)
    }

    // Registrar cada entrada de inventario en public.inventory_movements
    const movementsPayload = items.map((it) => {
      const prevStock = stockMap.get(it.product_id) || 0
      const qty = Number(it.quantity)
      return {
        company_id: purchaseRow.company_id,
        location_id: purchaseRow.location_id,
        product_id: it.product_id,
        movement_type: 'PURCHASE_ENTRY',
        quantity_in: qty,
        quantity_out: 0,
        previous_stock: prevStock,
        new_stock: prevStock + qty,
        unit_cost: Number(it.unit_cost),
        total_cost: qty * Number(it.unit_cost),
        document_type: 'PURCHASE_INVOICE',
        document_reference: purchaseRow.purchase_number,
        reason: `Entrada física por recepción de compra ${purchaseRow.purchase_number} (Factura proveedor: ${purchaseRow.supplier_invoice_number})`,
        user_id: user.id && user.id.length === 36 ? user.id : null,
      }
    })

    const { error: movError } = await supabaseClient
      .from('inventory_movements')
      .insert(movementsPayload)

    if (movError) {
      console.error('Error insertando movimientos de Kardex en recepción:', movError)
      throw new Error(`Error ingresando inventario en Kardex: ${movError.message}`)
    }

    // 2. Actualizar estado de la compra en public.purchases
    const { error: updateError } = await supabaseClient
      .from('purchases')
      .update({
        inventory_status: 'RECEIVED',
        received_at: new Date().toISOString(),
        received_by_user_id: user.id && user.id.length === 36 ? user.id : null,
        notes: input.notes ? `[RECEPCIÓN: ${input.notes}]` : undefined,
      })
      .eq('id', purchaseId)

    if (updateError) {
      console.error('Error actualizando estado de compra a RECEIVED:', updateError)
      throw new Error(`Error actualizando estado de la compra: ${updateError.message}`)
    }

    // 3. Sincronizar catálogo maestro de productos con el nuevo costo promedio ponderado de stock_levels
    for (const it of items) {
      const { data: stockRow } = await supabaseClient
        .from('stock_levels')
        .select('average_cost')
        .eq('product_id', it.product_id)
        .eq('location_id', purchaseRow.location_id)
        .maybeSingle()

      if (stockRow?.average_cost) {
        await supabaseClient
          .from('products')
          .update({ cost_price: stockRow.average_cost })
          .eq('id', it.product_id)
      }
    }

    const updated = await this.findById(purchaseId)
    if (!updated) {
      throw new Error('Error recuperando la compra tras la recepción.')
    }

    return updated
  }

  /**
   * Registra un abono o pago a proveedor (Cuentas por Pagar)
   */
  async registerPayment(
    input: RegisterPaymentInput,
    user: { id: string; name: string }
  ): Promise<Purchase> {
    const { data: purchaseRow, error: pError } = await supabaseClient
      .from('purchases')
      .select('id, company_id, location_id, purchase_number, total_amount, paid_amount, payment_status, inventory_status')
      .eq('id', input.purchaseId)
      .single()

    if (pError || !purchaseRow) {
      throw new Error(`Compra no encontrada (ID: ${input.purchaseId})`)
    }

    if (purchaseRow.inventory_status === 'CANCELLED') {
      throw new Error('No se pueden registrar pagos a una compra anulada.')
    }

    const currentTotal = Number(purchaseRow.total_amount || 0)
    const currentPaid = Number(purchaseRow.paid_amount || 0)
    const currentPending = currentTotal - currentPaid

    if (currentPending <= 0) {
      throw new Error('Esta compra ya se encuentra totalmente pagada.')
    }

    if (input.amount <= 0) {
      throw new Error('El valor a pagar debe ser mayor a 0.')
    }

    if (input.amount > currentPending + 0.01) {
      throw new Error(
        `El valor a pagar ($${input.amount.toLocaleString('es-CO')}) supera el saldo pendiente ($${currentPending.toLocaleString('es-CO')}).`
      )
    }

    // 1. Insertar comprobante en public.supplier_payments
    const { error: payError } = await supabaseClient
      .from('supplier_payments')
      .insert({
        company_id: purchaseRow.company_id,
        location_id: purchaseRow.location_id,
        purchase_id: purchaseRow.id,
        payment_number: `PAG-${Date.now().toString().slice(-6)}`,
        payment_date: new Date().toISOString().split('T')[0],
        amount: input.amount,
        payment_method: input.paymentMethod || 'TRANSFERENCIA',
        transaction_reference: input.reference || null,
        notes: input.notes || null,
        created_by_user_id: user.id && user.id.length === 36 ? user.id : null,
      })

    if (payError) {
      console.error('Error insertando pago a proveedor:', payError)
      throw new Error(`Error registrando comprobante de pago: ${payError.message}`)
    }

    // Registrar egreso financiero en caja o banco según corresponda
    try {
      if (input.paymentMethod === 'EFECTIVO') {
        const { data: openSession } = await supabaseClient
          .from('cash_sessions')
          .select('id')
          .eq('status', 'OPEN')
          .limit(1)
          .maybeSingle()

        if (openSession?.id) {
          await supabaseClient.from('cash_movements').insert({
            session_id: openSession.id,
            type: 'EXPENSE',
            amount: input.amount,
            reason: `Abono a proveedor compra ${purchaseRow.purchase_number}`,
            authorized_by_user_id: user.id && user.id.length === 36 ? user.id : null,
          })
        }
      } else if (input.paymentMethod === 'TRANSFERENCIA' || input.paymentMethod === 'CONSIGNACION') {
        const { data: bankAccount } = await supabaseClient
          .from('bank_accounts')
          .select('id, current_balance')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle()

        if (bankAccount?.id) {
          const newBalance = Math.max(0, Number(bankAccount.current_balance) - input.amount)
          await supabaseClient
            .from('bank_accounts')
            .update({ current_balance: newBalance, updated_at: new Date().toISOString() })
            .eq('id', bankAccount.id)

          await supabaseClient.from('bank_movements').insert({
            company_id: purchaseRow.company_id,
            location_id: purchaseRow.location_id,
            bank_account_id: bankAccount.id,
            movement_number: `MOV-PAG-${Date.now().toString().slice(-6)}`,
            movement_date: new Date().toISOString().split('T')[0],
            movement_type: 'CREDIT',
            amount: input.amount,
            balance_after: newBalance,
            concept: `Pago a proveedor compra ${purchaseRow.purchase_number}`,
            reference: input.reference || null,
            is_reconciled: true,
            created_by_user_id: user.id && user.id.length === 36 ? user.id : null,
          })
        }
      }
    } catch (finErr) {
      console.warn('Advertencia al registrar egreso financiero en tesorería/caja:', finErr)
    }

    // 2. Calcular nuevo saldo y estado
    const newPaidAmount = currentPaid + input.amount
    const newStatus = newPaidAmount >= currentTotal - 0.01 ? 'PAID' : 'PARTIAL'

    // 3. Actualizar public.purchases
    const { error: updateError } = await supabaseClient
      .from('purchases')
      .update({
        paid_amount: newPaidAmount,
        payment_status: newStatus,
      })
      .eq('id', purchaseRow.id)

    if (updateError) {
      console.error('Error actualizando saldo de la compra:', updateError)
      throw new Error(`Error actualizando saldo de la compra: ${updateError.message}`)
    }

    const updated = await this.findById(purchaseRow.id)
    if (!updated) {
      throw new Error('Error recuperando compra tras registro de pago.')
    }

    return updated
  }

  /**
   * Anula una compra siempre y cuando la mercancía no haya sido recibida físicamente
   */
  async cancel(purchaseId: string, reason: string, _user: { id: string; name: string }): Promise<Purchase> {
    const { data: purchaseRow, error: pError } = await supabaseClient
      .from('purchases')
      .select('id, purchase_number, inventory_status, notes')
      .eq('id', purchaseId)
      .single()

    if (pError || !purchaseRow) {
      throw new Error(`Compra no encontrada (ID: ${purchaseId})`)
    }

    if (purchaseRow.inventory_status === 'RECEIVED') {
      throw new Error(
        `Compras inmutables: No está permitido anular compras cuya mercancía ya fue recibida en bodega (Compra: ${purchaseRow.purchase_number}). Debe tramitarse devolución a proveedor.`
      )
    }

    const { error: updateError } = await supabaseClient
      .from('purchases')
      .update({
        inventory_status: 'CANCELLED',
        payment_status: 'CANCELLED',
        notes: `${purchaseRow.notes || ''} [ANULADA: ${reason.trim()}]`,
      })
      .eq('id', purchaseId)

    if (updateError) {
      console.error('Error cancelando compra:', updateError)
      throw new Error(`Error cancelando compra: ${updateError.message}`)
    }

    const updated = await this.findById(purchaseId)
    if (!updated) {
      throw new Error('Error recuperando compra anulada.')
    }

    return updated
  }

  /**
   * Obtiene estadísticas globales de compras desde PostgreSQL
   */
  async getPurchaseStats(_userContext?: any): Promise<PurchaseStats> {
    const { data, error } = await supabaseClient
      .from('purchases')
      .select('id, total_amount, paid_amount, payment_status, inventory_status, due_date')
      .neq('inventory_status', 'CANCELLED')

    if (error || !data) {
      console.error('Error consultando estadísticas de compras:', error)
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

      if (p.inventory_status === 'PENDING' || p.inventory_status === 'DRAFT') {
        pendingPurchasesCount++
      } else if (p.inventory_status === 'RECEIVED') {
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
