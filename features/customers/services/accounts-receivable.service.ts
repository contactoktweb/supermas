/**
 * SUPER MÁS ERP/POS - Servicio de Cuentas por Cobrar (AccountsReceivableService)
 * 
 * Administra el ciclo fiduciario de Cartera y CxC de Clientes:
 * - Consulta de cartera y saldos pendientes reales en PostgreSQL.
 * - Clasificación dinámica de antigüedad (Aging / Cartera Corriente y Vencida).
 * - Registro de abonos y cancelaciones fiduciarias.
 * - Integración con Caja POS, Cuentas Bancarias y Tesorería.
 * - Estado de Cuenta del Cliente y trazabilidad de pagos.
 */

import { supabaseClient } from '@/lib/supabase/client'

export interface AccountReceivableItem {
  id: string
  saleId: string
  saleNumber: string
  customerId: string
  customerName: string
  customerDoc: string
  customerPhone?: string
  customerEmail?: string
  locationId: string
  locationName: string
  locationCode: string
  issueDate: string
  dueDate: string
  creditDays: number
  daysRemainingOrOverdue: number
  isOverdue: boolean
  originalAmount: number
  paidAmount: number
  pendingBalance: number
  status: 'PENDIENTE' | 'PAGO_PARCIAL' | 'PAGADA' | 'VENCIDA' | 'ANULADA'
  paymentTerms: string
  paymentsCount: number
  agingBucket: 'CORRIENTE' | '1-30 DÍAS' | '31-60 DÍAS' | '61-90 DÍAS' | 'MÁS DE 90 DÍAS'
  notes?: string
}

export interface AccountsReceivableStats {
  totalPendingBalance: number
  totalOverdueBalance: number
  totalCurrentBalance: number
  pendingInvoicesCount: number
  overdueInvoicesCount: number
  totalCollectedThisMonth: number
  customersWithBalanceCount: number
  customersOverdueCount: number
}

export interface AgingBucketSummary {
  bucket: 'CORRIENTE' | '1-30 DÍAS' | '31-60 DÍAS' | '61-90 DÍAS' | 'MÁS DE 90 DÍAS'
  count: number
  amount: number
}

export interface AccountsReceivableFilterParams {
  query?: string
  customerId?: string
  locationId?: string
  status?: 'ALL' | 'PENDIENTE' | 'PAGO_PARCIAL' | 'PAGADA' | 'VENCIDA' | 'ANULADA'
  agingBucket?: 'ALL' | 'CORRIENTE' | '1-30 DÍAS' | '31-60 DÍAS' | '61-90 DÍAS' | 'MÁS DE 90 DÍAS'
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}

export interface RegisterCustomerPaymentInput {
  saleId: string
  amount: number
  paymentMethod: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'CHEQUE' | 'OTRO'
  date?: string
  reference?: string
  bankAccountId?: string
  notes?: string
}

export interface CustomerAccountStatement {
  customer: {
    id: string
    displayName: string
    documentNumber: string
    documentType: string
    phone: string
    email: string
    address: string
    city: string
    creditLimit: number
    creditDays: number
    currentBalance: number
    availableCredit: number
    status: string
  }
  summary: {
    totalPendingBalance: number
    totalOverdueBalance: number
    totalCurrentBalance: number
    invoicesCount: number
    paymentsCount: number
  }
  aging: AgingBucketSummary[]
  receivables: AccountReceivableItem[]
  payments: Array<{
    id: string
    paymentNumber: string
    date: string
    amount: number
    paymentMethod: string
    reference?: string
    saleNumber?: string
    notes?: string
  }>
}

/**
 * Calcula de forma dinámica la franja de vencimiento / aging de una obligación
 */
export function calculateAgingBucket(
  dueDateStr: string,
  pendingBalance: number
): 'CORRIENTE' | '1-30 DÍAS' | '31-60 DÍAS' | '61-90 DÍAS' | 'MÁS DE 90 DÍAS' {
  if (pendingBalance <= 0) return 'CORRIENTE'
  const todayStr = new Date().toISOString().split('T')[0]
  const today = new Date(todayStr).getTime()
  const due = new Date(dueDateStr).getTime()
  const diffDays = Math.floor((today - due) / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return 'CORRIENTE'
  if (diffDays <= 30) return '1-30 DÍAS'
  if (diffDays <= 60) return '31-60 DÍAS'
  if (diffDays <= 90) return '61-90 DÍAS'
  return 'MÁS DE 90 DÍAS'
}

export class AccountsReceivableService {
  /**
   * Consulta paginada y filtrada de Cuentas por Cobrar reales en PostgreSQL
   */
  async list(params: AccountsReceivableFilterParams = {}): Promise<{
    items: AccountReceivableItem[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }> {
    const page = Math.max(1, params.page || 1)
    const pageSize = Math.max(1, params.pageSize || 15)
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabaseClient.from('sales').select(
      `
        id,
        sale_number,
        company_id,
        location_id,
        customer_id,
        subtotal_amount,
        tax_amount,
        total_amount,
        paid_amount,
        payment_method,
        payment_status,
        payment_terms,
        due_date,
        status,
        notes,
        created_at,
        customers (
          id,
          first_name,
          last_name,
          company_name,
          document_number,
          phone,
          email,
          credit_days
        ),
        locations (
          id,
          name,
          code
        ),
        customer_payments (
          id,
          payment_number,
          payment_date,
          amount,
          payment_method,
          transaction_reference
        )
      `,
      { count: 'exact' }
    )

    // Solo ventas no anuladas salvo que se consulte específicamente ANULADA
    if (params.status === 'ANULADA') {
      query = query.eq('status', 'CANCELLED')
    } else {
      query = query.not('status', 'eq', 'CANCELLED')
    }

    // Filtrar por cliente
    if (params.customerId && params.customerId !== 'ALL') {
      query = query.eq('customer_id', params.customerId)
    }

    // Filtrar por punto / bodega
    if (params.locationId && params.locationId !== 'ALL') {
      query = query.eq('location_id', params.locationId)
    }

    // Rango de fechas
    if (params.startDate) {
      query = query.gte('created_at', params.startDate)
    }
    if (params.endDate) {
      query = query.lte('created_at', params.endDate)
    }

    // Ordenar por fecha de vencimiento ascendente
    query = query.order('due_date', { ascending: true, nullsFirst: false }).range(from, to)

    const { data, count, error } = await query

    if (error) {
      console.error('Error consultando Cuentas por Cobrar en PostgreSQL:', error)
      throw new Error(`Error consultando Cuentas por Cobrar: ${error.message}`)
    }

    const todayStr = new Date().toISOString().split('T')[0]
    const today = new Date(todayStr).getTime()

    let items: AccountReceivableItem[] = (data || []).map((row: any) => {
      const cust = row.customers || {}
      const loc = row.locations || {}
      const payments = (row.customer_payments as any[]) || []

      const originalAmount = Number(row.total_amount || 0)
      const paidAmount = Number(row.paid_amount || 0)
      const pendingBalance = Math.max(0, originalAmount - paidAmount)

      const issueDate = row.created_at ? row.created_at.split('T')[0] : todayStr
      const dueDate = row.due_date || issueDate

      const dueTime = new Date(dueDate).getTime()
      const diffDays = Math.round((dueTime - today) / (1000 * 60 * 60 * 24))
      const isOverdue = diffDays < 0 && pendingBalance > 0

      const issueTime = new Date(issueDate).getTime()
      const creditDays = Math.max(0, Math.round((dueTime - issueTime) / (1000 * 60 * 60 * 24)))

      let status: 'PENDIENTE' | 'PAGO_PARCIAL' | 'PAGADA' | 'VENCIDA' | 'ANULADA' = 'PENDIENTE'
      if (row.status === 'CANCELLED') {
        status = 'ANULADA'
      } else if (pendingBalance <= 0 || row.payment_status === 'PAID') {
        status = 'PAGADA'
      } else if (isOverdue) {
        status = 'VENCIDA'
      } else if (paidAmount > 0) {
        status = 'PAGO_PARCIAL'
      } else {
        status = 'PENDIENTE'
      }

      const agingBucket = calculateAgingBucket(dueDate, pendingBalance)

      const customerName =
        cust.company_name ||
        [cust.first_name, cust.last_name].filter(Boolean).join(' ') ||
        'Cliente'

      return {
        id: row.id,
        saleId: row.id,
        saleNumber: row.sale_number,
        customerId: row.customer_id,
        customerName,
        customerDoc: cust.document_number || '—',
        customerPhone: cust.phone || undefined,
        customerEmail: cust.email || undefined,
        locationId: row.location_id,
        locationName: loc.name || 'Bodega Principal',
        locationCode: loc.code || 'BOD',
        issueDate,
        dueDate,
        creditDays,
        daysRemainingOrOverdue: diffDays,
        isOverdue,
        originalAmount,
        paidAmount,
        pendingBalance,
        status,
        paymentTerms: row.payment_terms || (row.payment_method === 'CREDIT' ? 'CREDITO' : 'CONTADO'),
        paymentsCount: payments.length,
        agingBucket,
        notes: row.notes || undefined,
      }
    })

    // Filtro por texto si se especificó
    if (params.query?.trim()) {
      const q = params.query.trim().toLowerCase()
      items = items.filter(
        (it) =>
          it.saleNumber.toLowerCase().includes(q) ||
          it.customerName.toLowerCase().includes(q) ||
          it.customerDoc.includes(q) ||
          it.notes?.toLowerCase().includes(q)
      )
    }

    // Filtro en memoria por estado si se especificó
    if (params.status && params.status !== 'ALL') {
      items = items.filter((it) => it.status === params.status)
    }

    // Filtro por franja de aging si se especificó
    if (params.agingBucket && params.agingBucket !== 'ALL') {
      items = items.filter((it) => it.agingBucket === params.agingBucket)
    }

    const total = count || items.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    }
  }

  /**
   * Obtiene métricas fiduciarias consolidadas de Cuentas por Cobrar
   */
  async getStats(): Promise<AccountsReceivableStats> {
    const { data: sales, error } = await supabaseClient
      .from('sales')
      .select('id, customer_id, total_amount, paid_amount, payment_status, due_date, status')
      .not('status', 'eq', 'CANCELLED')

    if (error || !sales) {
      return {
        totalPendingBalance: 0,
        totalOverdueBalance: 0,
        totalCurrentBalance: 0,
        pendingInvoicesCount: 0,
        overdueInvoicesCount: 0,
        totalCollectedThisMonth: 0,
        customersWithBalanceCount: 0,
        customersOverdueCount: 0,
      }
    }

    const todayStr = new Date().toISOString().split('T')[0]
    let totalPendingBalance = 0
    let totalOverdueBalance = 0
    let totalCurrentBalance = 0
    let pendingInvoicesCount = 0
    let overdueInvoicesCount = 0

    const customersWithBalanceSet = new Set<string>()
    const customersOverdueSet = new Set<string>()

    for (const s of sales) {
      const tot = Number(s.total_amount || 0)
      const paid = Number(s.paid_amount || 0)
      const pending = Math.max(0, tot - paid)

      if (pending > 0) {
        totalPendingBalance += pending
        pendingInvoicesCount++
        customersWithBalanceSet.add(s.customer_id)

        if (s.due_date && s.due_date < todayStr) {
          totalOverdueBalance += pending
          overdueInvoicesCount++
          customersOverdueSet.add(s.customer_id)
        } else {
          totalCurrentBalance += pending
        }
      }
    }

    // Recaudos del mes en curso desde customer_payments
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    const startOfMonthStr = startOfMonth.toISOString().split('T')[0]

    const { data: monthPayments } = await supabaseClient
      .from('customer_payments')
      .select('amount')
      .gte('payment_date', startOfMonthStr)

    const totalCollectedThisMonth = (monthPayments || []).reduce(
      (acc, pay) => acc + Number(pay.amount || 0),
      0
    )

    return {
      totalPendingBalance,
      totalOverdueBalance,
      totalCurrentBalance,
      pendingInvoicesCount,
      overdueInvoicesCount,
      totalCollectedThisMonth,
      customersWithBalanceCount: customersWithBalanceSet.size,
      customersOverdueCount: customersOverdueSet.size,
    }
  }

  /**
   * Resumen de Cartera agrupado por franjas de vencimiento (Aging)
   */
  async getAgingSummary(): Promise<AgingBucketSummary[]> {
    const { data: sales } = await supabaseClient
      .from('sales')
      .select('total_amount, paid_amount, due_date')
      .not('status', 'eq', 'CANCELLED')

    const buckets: Record<AgingBucketSummary['bucket'], { count: number; amount: number }> = {
      CORRIENTE: { count: 0, amount: 0 },
      '1-30 DÍAS': { count: 0, amount: 0 },
      '31-60 DÍAS': { count: 0, amount: 0 },
      '61-90 DÍAS': { count: 0, amount: 0 },
      'MÁS DE 90 DÍAS': { count: 0, amount: 0 },
    }

    for (const s of sales || []) {
      const tot = Number(s.total_amount || 0)
      const paid = Number(s.paid_amount || 0)
      const pending = Math.max(0, tot - paid)

      if (pending > 0) {
        const bucket = calculateAgingBucket(s.due_date || new Date().toISOString().split('T')[0], pending)
        buckets[bucket].count += 1
        buckets[bucket].amount += pending
      }
    }

    return (Object.keys(buckets) as AgingBucketSummary['bucket'][]).map((bucket) => ({
      bucket,
      count: buckets[bucket].count,
      amount: buckets[bucket].amount,
    }))
  }

  /**
   * Registra un pago o abono fiduciario a una Cuenta por Cobrar
   */
  async registerPayment(
    input: RegisterCustomerPaymentInput,
    user: { id?: string; name?: string } = {}
  ): Promise<{ paymentId: string; paymentNumber: string; newPendingBalance: number; newStatus: string }> {
    // 1. Validar la existencia de la venta
    const { data: saleRow, error: sErr } = await supabaseClient
      .from('sales')
      .select('id, company_id, location_id, customer_id, sale_number, total_amount, paid_amount, payment_status, status')
      .eq('id', input.saleId)
      .single()

    if (sErr || !saleRow) {
      throw new Error(`Cuenta por cobrar no encontrada (ID de venta: ${input.saleId})`)
    }

    if (saleRow.status === 'CANCELLED') {
      throw new Error('No es posible registrar pagos a una venta anulada.')
    }

    const currentTotal = Number(saleRow.total_amount || 0)
    const currentPaid = Number(saleRow.paid_amount || 0)
    const currentPending = Math.max(0, currentTotal - currentPaid)

    if (currentPending <= 0) {
      throw new Error('Esta obligación ya se encuentra totalmente saldada ($0 saldo pendiente).')
    }

    if (input.amount <= 0) {
      throw new Error('El valor a abonar debe ser mayor a cero.')
    }

    if (input.amount > currentPending + 0.01) {
      const formatMoney = (n: number) =>
        new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
      throw new Error(
        `El valor a pagar (${formatMoney(input.amount)}) supera el saldo pendiente (${formatMoney(currentPending)}).`
      )
    }

    const paymentNumber = `REC-${Date.now().toString().slice(-6)}`
    const paymentDate = input.date || new Date().toISOString().split('T')[0]
    const validUserId = user.id && user.id.length === 36 ? user.id : null

    // 2. Insertar comprobante en public.customer_payments
    const { data: createdPayment, error: payError } = await supabaseClient
      .from('customer_payments')
      .insert({
        company_id: saleRow.company_id,
        location_id: saleRow.location_id,
        sale_id: saleRow.id,
        customer_id: saleRow.customer_id,
        payment_number: paymentNumber,
        payment_date: paymentDate,
        amount: input.amount,
        payment_method: input.paymentMethod || 'EFECTIVO',
        transaction_reference: input.reference || null,
        bank_account_id: input.bankAccountId || null,
        notes: input.notes || null,
        created_by_user_id: validUserId,
      })
      .select()
      .single()

    if (payError || !createdPayment) {
      console.error('Error insertando comprobante en public.customer_payments:', payError)
      throw new Error(`Error registrando comprobante de recaudo: ${payError?.message || 'Error desconocido'}`)
    }

    // 3. Actualizar public.sales (paid_amount y payment_status)
    const newPaidAmount = currentPaid + input.amount
    const newStatus = newPaidAmount >= currentTotal - 0.01 ? 'PAID' : 'PARTIAL'

    const { error: saleUpdateErr } = await supabaseClient
      .from('sales')
      .update({
        paid_amount: newPaidAmount,
        payment_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', saleRow.id)

    if (saleUpdateErr) {
      console.error('Error actualizando saldo de la venta:', saleUpdateErr)
      throw new Error(`Error actualizando saldo de la venta: ${saleUpdateErr.message}`)
    }

    // 4. Actualizar saldo del cliente en public.customers
    const { data: customerRow } = await supabaseClient
      .from('customers')
      .select('current_balance')
      .eq('id', saleRow.customer_id)
      .maybeSingle()

    if (customerRow) {
      const prevBal = Number(customerRow.current_balance || 0)
      const newBal = Math.max(0, prevBal - input.amount)
      await supabaseClient
        .from('customers')
        .update({
          current_balance: newBal,
          updated_at: new Date().toISOString(),
        })
        .eq('id', saleRow.customer_id)
    }

    // 5. Integración con Tesorería y Caja/Bancos
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
            type: 'SALE_CASH',
            amount: input.amount,
            reason: `Recaudo cliente por venta ${saleRow.sale_number} (Comprobante ${paymentNumber})`,
            authorized_by_user_id: validUserId,
          })
        }
      } else {
        // Banco / Transferencia / Tarjeta: Aumenta saldo en bank_accounts y registra bank_movements + treasury_receipts
        let bankQuery = supabaseClient.from('bank_accounts').select('id, current_balance')
        if (input.bankAccountId) {
          bankQuery = bankQuery.eq('id', input.bankAccountId)
        } else {
          bankQuery = bankQuery.eq('is_active', true)
        }

        const { data: bankAccount } = await bankQuery.limit(1).maybeSingle()

        if (bankAccount?.id) {
          const newBankBalance = Number(bankAccount.current_balance || 0) + input.amount
          await supabaseClient
            .from('bank_accounts')
            .update({ current_balance: newBankBalance, updated_at: new Date().toISOString() })
            .eq('id', bankAccount.id)

          await supabaseClient.from('bank_movements').insert({
            company_id: saleRow.company_id,
            location_id: saleRow.location_id,
            bank_account_id: bankAccount.id,
            movement_number: `MOV-REC-${Date.now().toString().slice(-6)}`,
            movement_date: paymentDate,
            movement_type: 'DEBIT', // Ingreso bancario
            amount: input.amount,
            balance_after: newBankBalance,
            concept: `Recaudo cliente venta ${saleRow.sale_number} - Comprobante ${paymentNumber}`,
            reference: input.reference || null,
            is_reconciled: true,
            created_by_user_id: validUserId,
          })

          await supabaseClient.from('treasury_receipts').insert({
            company_id: saleRow.company_id,
            location_id: saleRow.location_id,
            receipt_number: `TES-REC-${Date.now().toString().slice(-6)}`,
            customer_id: saleRow.customer_id,
            bank_account_id: bankAccount.id,
            amount: input.amount,
            receipt_date: paymentDate,
            payment_method: input.paymentMethod || 'TRANSFERENCIA',
            reference_number: input.reference || null,
            status: 'COLLECTED',
            notes: input.notes || `Recaudo cartera venta ${saleRow.sale_number}`,
            created_by_user_id: validUserId,
          })
        }
      }
    } catch (finErr) {
      console.warn('Advertencia en integración de tesorería/caja para recaudo:', finErr)
    }

    const newPendingBalance = Math.max(0, currentPending - input.amount)

    return {
      paymentId: createdPayment.id,
      paymentNumber,
      newPendingBalance,
      newStatus,
    }
  }

  /**
   * Obtiene el Estado de Cuenta consolidado de un cliente
   */
  async getCustomerAccountStatement(customerId: string): Promise<CustomerAccountStatement> {
    const { data: custRow, error: cErr } = await supabaseClient
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single()

    if (cErr || !custRow) {
      throw new Error(`Cliente no encontrado (ID: ${customerId})`)
    }

    const isCompany = custRow.person_type === 'COMPANY' || custRow.customer_type === 'COMPANY'
    const displayName =
      custRow.company_name ||
      [custRow.first_name, custRow.last_name].filter(Boolean).join(' ') ||
      'Cliente'

    const creditLimit = Number(custRow.credit_limit || 0)
    const currentBalance = Number(custRow.current_balance || 0)
    const availableCredit = Math.max(0, creditLimit - currentBalance)

    // Consultar todas las ventas del cliente
    const { data: salesRows } = await supabaseClient
      .from('sales')
      .select('id, sale_number, created_at, due_date, total_amount, paid_amount, payment_status, payment_terms, status, notes, locations(name, code)')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    const todayStr = new Date().toISOString().split('T')[0]
    const today = new Date(todayStr).getTime()

    const receivables: AccountReceivableItem[] = (salesRows || []).map((s: any) => {
      const orig = Number(s.total_amount || 0)
      const paid = Number(s.paid_amount || 0)
      const pending = Math.max(0, orig - paid)
      const issueDate = s.created_at ? s.created_at.split('T')[0] : todayStr
      const dueDate = s.due_date || issueDate
      const dueTime = new Date(dueDate).getTime()
      const diffDays = Math.round((dueTime - today) / (1000 * 60 * 60 * 24))
      const isOverdue = diffDays < 0 && pending > 0
      const agingBucket = calculateAgingBucket(dueDate, pending)

      let status: 'PENDIENTE' | 'PAGO_PARCIAL' | 'PAGADA' | 'VENCIDA' | 'ANULADA' = 'PENDIENTE'
      if (s.status === 'CANCELLED') status = 'ANULADA'
      else if (pending <= 0 || s.payment_status === 'PAID') status = 'PAGADA'
      else if (isOverdue) status = 'VENCIDA'
      else if (paid > 0) status = 'PAGO_PARCIAL'
      else status = 'PENDIENTE'

      return {
        id: s.id,
        saleId: s.id,
        saleNumber: s.sale_number,
        customerId,
        customerName: displayName,
        customerDoc: custRow.document_number,
        locationId: s.location_id,
        locationName: s.locations?.name || 'Bodega Principal',
        locationCode: s.locations?.code || 'BOD',
        issueDate,
        dueDate,
        creditDays: Number(custRow.credit_days || 0),
        daysRemainingOrOverdue: diffDays,
        isOverdue,
        originalAmount: orig,
        paidAmount: paid,
        pendingBalance: pending,
        status,
        paymentTerms: s.payment_terms || 'CONTADO',
        paymentsCount: 0,
        agingBucket,
        notes: s.notes,
      }
    })

    // Consultar todos los pagos del cliente
    const { data: paymentsRows } = await supabaseClient
      .from('customer_payments')
      .select('id, payment_number, payment_date, amount, payment_method, transaction_reference, notes, sale_id, sales(sale_number)')
      .eq('customer_id', customerId)
      .order('payment_date', { ascending: false })

    const payments = (paymentsRows || []).map((p: any) => ({
      id: p.id,
      paymentNumber: p.payment_number,
      date: p.payment_date,
      amount: Number(p.amount || 0),
      paymentMethod: p.payment_method,
      reference: p.transaction_reference || undefined,
      saleNumber: p.sales?.sale_number || undefined,
      notes: p.notes || undefined,
    }))

    // Calcular distribución de Aging
    const buckets: Record<AgingBucketSummary['bucket'], { count: number; amount: number }> = {
      CORRIENTE: { count: 0, amount: 0 },
      '1-30 DÍAS': { count: 0, amount: 0 },
      '31-60 DÍAS': { count: 0, amount: 0 },
      '61-90 DÍAS': { count: 0, amount: 0 },
      'MÁS DE 90 DÍAS': { count: 0, amount: 0 },
    }

    let totalPendingBalance = 0
    let totalOverdueBalance = 0
    let totalCurrentBalance = 0

    for (const r of receivables) {
      if (r.pendingBalance > 0 && r.status !== 'ANULADA') {
        totalPendingBalance += r.pendingBalance
        buckets[r.agingBucket].count += 1
        buckets[r.agingBucket].amount += r.pendingBalance

        if (r.isOverdue) {
          totalOverdueBalance += r.pendingBalance
        } else {
          totalCurrentBalance += r.pendingBalance
        }
      }
    }

    const aging = (Object.keys(buckets) as AgingBucketSummary['bucket'][]).map((bucket) => ({
      bucket,
      count: buckets[bucket].count,
      amount: buckets[bucket].amount,
    }))

    return {
      customer: {
        id: custRow.id,
        displayName,
        documentNumber: custRow.document_number,
        documentType: custRow.document_type || 'CC',
        phone: custRow.phone || '',
        email: custRow.email || '',
        address: custRow.address || '',
        city: custRow.city || 'Medellín',
        creditLimit,
        creditDays: Number(custRow.credit_days || 0),
        currentBalance,
        availableCredit,
        status: custRow.is_active ? 'ACTIVE' : 'INACTIVE',
      },
      summary: {
        totalPendingBalance,
        totalOverdueBalance,
        totalCurrentBalance,
        invoicesCount: receivables.filter((r) => r.pendingBalance > 0).length,
        paymentsCount: payments.length,
      },
      aging,
      receivables,
      payments,
    }
  }

  /**
   * Obtiene el historial detallado de abonos para una venta específica
   */
  async getPaymentHistory(saleId: string) {
    const { data, error } = await supabaseClient
      .from('customer_payments')
      .select('id, payment_number, payment_date, amount, payment_method, transaction_reference, notes, created_at, created_by_user_id')
      .eq('sale_id', saleId)
      .order('payment_date', { ascending: false })

    if (error || !data) return []

    return data.map((p) => ({
      id: p.id,
      paymentNumber: p.payment_number,
      date: p.payment_date,
      amount: Number(p.amount || 0),
      paymentMethod: p.payment_method,
      reference: p.transaction_reference,
      notes: p.notes,
      createdAt: p.created_at,
    }))
  }
}

export const accountsReceivableService = new AccountsReceivableService()
