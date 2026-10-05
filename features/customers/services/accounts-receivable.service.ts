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
   * Registra un pago o abono fiduciario a una Cuenta por Cobrar mediante RPC atómica
   */
  async registerPayment(
    input: RegisterCustomerPaymentInput,
    user: { id?: string; name?: string } = {}
  ): Promise<{ paymentId: string; paymentNumber: string; newPendingBalance: number; newStatus: string }> {
    if (input.amount <= 0) {
      throw new Error('El valor a abonar debe ser mayor a cero.')
    }

    const { data, error } = await supabaseClient.rpc('fn_register_customer_payment', {
      p_sale_id: input.saleId,
      p_amount: input.amount,
      p_payment_date: input.date || new Date().toISOString().split('T')[0],
      p_payment_method: input.paymentMethod || 'EFECTIVO',
      p_transaction_reference: input.reference || null,
      p_notes: input.notes || null,
      p_bank_account_id: input.bankAccountId || null,
      p_cash_session_id: null,
    })

    if (error) {
      console.error('Error registrando recaudo fiduciario vía RPC fn_register_customer_payment:', error)
      throw new Error(error.message || 'Error registrando comprobante de recaudo.')
    }

    return {
      paymentId: data.payment_id,
      paymentNumber: data.payment_number,
      newPendingBalance: Number(data.pending_balance || 0),
      newStatus: data.payment_status,
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
