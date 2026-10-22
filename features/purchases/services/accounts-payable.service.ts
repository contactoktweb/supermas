import { supabaseClient } from '@/lib/supabase/client'
import { purchaseService } from './purchase.service'
import { RegisterPaymentInput, UserPermissionContext } from '../types'
import {
  INVENTORY_STATUS,
  PAYABLE_INVENTORY_STATUSES,
  isCancelledPurchase,
  pendingPurchaseBalance,
  todayBogota,
} from '../utils/purchase-status'

export interface AccountPayableItem {
  id: string
  purchaseId: string
  purchaseNumber: string
  supplierInvoiceNumber: string
  supplierId: string
  supplierName: string
  supplierNit: string
  supplierPhone?: string
  supplierEmail?: string
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
  status: 'PENDIENTE' | 'PARCIAL' | 'PAGADA' | 'VENCIDA' | 'ANULADA'
  paymentTerms: string
  paymentsCount: number
  notes?: string
}

export interface AccountsPayableStats {
  totalPendingBalance: number
  totalOverdueBalance: number
  pendingInvoicesCount: number
  overdueInvoicesCount: number
  paidThisMonth: number
  isCostRedacted: boolean
}

export interface AccountsPayableFilterParams {
  query?: string
  supplierId?: string
  locationId?: string
  status?: 'ALL' | 'PENDIENTE' | 'PARCIAL' | 'PAGADA' | 'VENCIDA' | 'ANULADA'
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}

export class AccountsPayableService {
  /**
   * Consulta las Cuentas por Pagar reales desde public.purchases y sus relaciones
   */
  async list(
    params: AccountsPayableFilterParams = {},
    userContext?: UserPermissionContext
  ): Promise<{
    items: AccountPayableItem[]
    total: number
    page: number
    pageSize: number
    totalPages: number
    isCostRedacted: boolean
  }> {
    const page = Math.max(1, params.page || 1)
    const pageSize = Math.max(1, params.pageSize || 15)
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

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
        tax_amount,
        total_amount,
        paid_amount,
        payment_terms,
        payment_status,
        inventory_status,
        notes,
        created_at,
        suppliers (
          id,
          name,
          legal_name,
          tax_id,
          phone,
          email,
          payment_terms_days
        ),
        locations (
          id,
          code,
          name,
          city
        ),
        supplier_payments (
          id,
          payment_date,
          amount,
          payment_method,
          transaction_reference
        )
      `,
      { count: 'exact' }
    )

    const todayStr = todayBogota()

    // Solo compras que generan deuda (sin borradores ni anuladas), salvo que se pidan las anuladas.
    // El estado se filtra en el servidor para que la paginación y el total cuadren.
    if (params.status === 'ANULADA') {
      query = query.in('inventory_status', [...INVENTORY_STATUS.CANCELLED])
    } else {
      query = query.in('inventory_status', PAYABLE_INVENTORY_STATUSES)
      switch (params.status) {
        case 'PAGADA':
          query = query.eq('payment_status', 'PAID')
          break
        case 'VENCIDA':
          query = query.neq('payment_status', 'PAID').lt('due_date', todayStr)
          break
        case 'PENDIENTE':
        case 'PARCIAL':
          query = query
            .eq('payment_status', params.status === 'PENDIENTE' ? 'PENDING' : 'PARTIAL')
            .or(`due_date.is.null,due_date.gte.${todayStr}`)
          break
      }
    }

    // Texto: número, factura del proveedor, notas o nombre del proveedor.
    const term = (params.query || '').trim().replace(/[,()*%\\]/g, ' ').trim()
    if (term) {
      const { data: matchingSuppliers } = await supabaseClient
        .from('suppliers')
        .select('id')
        .or(`name.ilike.%${term}%,legal_name.ilike.%${term}%,tax_id.ilike.%${term}%`)
        .limit(50)
      const supplierIds = (matchingSuppliers ?? []).map((sup) => sup.id)
      const filters = [
        `purchase_number.ilike.%${term}%`,
        `supplier_invoice_number.ilike.%${term}%`,
        `notes.ilike.%${term}%`,
      ]
      if (supplierIds.length > 0) filters.push(`supplier_id.in.(${supplierIds.join(',')})`)
      query = query.or(filters.join(','))
    }

    // Filtro por Proveedor
    if (params.supplierId && params.supplierId !== 'ALL') {
      query = query.eq('supplier_id', params.supplierId)
    }

    // Filtro por Bodega
    if (params.locationId && params.locationId !== 'ALL') {
      query = query.eq('location_id', params.locationId)
    }

    // Rango de fechas de emisión o vencimiento
    if (params.startDate) {
      query = query.gte('issue_date', params.startDate)
    }
    if (params.endDate) {
      query = query.lte('issue_date', params.endDate)
    }

    // Ordenamiento por fecha de vencimiento ascendente
    query = query.order('due_date', { ascending: true, nullsFirst: false }).range(from, to)

    const { data, count, error } = await query

    if (error) {
      console.error('Error consultando Cuentas por Pagar:', error)
      throw new Error('No se pudieron cargar las cuentas por pagar.')
    }

    const today = new Date(todayStr).getTime()

    let items: AccountPayableItem[] = (data || []).map((row: any) => {
      const sup = row.suppliers || {}
      const loc = row.locations || {}
      const payments = (row.supplier_payments as any[]) || []

      const originalAmount = Number(row.total_amount || 0)
      const paidAmount = Number(row.paid_amount || 0)
      const pendingBalance = Math.max(0, originalAmount - paidAmount)

      const issueDate = row.issue_date || row.created_at.split('T')[0]
      const dueDate = row.due_date || issueDate

      const dueTime = new Date(dueDate).getTime()
      const diffDays = Math.round((dueTime - today) / (1000 * 60 * 60 * 24))
      const isOverdue = diffDays < 0 && pendingBalance > 0

      // Días de crédito
      const issueTime = new Date(issueDate).getTime()
      const creditDays = Math.max(0, Math.round((dueTime - issueTime) / (1000 * 60 * 60 * 24)))

      let status: 'PENDIENTE' | 'PARCIAL' | 'PAGADA' | 'VENCIDA' | 'ANULADA' = 'PENDIENTE'

      if (isCancelledPurchase(row.inventory_status)) {
        status = 'ANULADA'
      } else if (pendingBalance <= 0 || row.payment_status === 'PAID') {
        status = 'PAGADA'
      } else if (isOverdue) {
        status = 'VENCIDA'
      } else if (paidAmount > 0) {
        status = 'PARCIAL'
      } else {
        status = 'PENDIENTE'
      }

      return {
        id: row.id,
        purchaseId: row.id,
        purchaseNumber: row.purchase_number,
        supplierInvoiceNumber: row.supplier_invoice_number,
        supplierId: row.supplier_id,
        supplierName: sup.name || sup.legal_name || 'Proveedor',
        supplierNit: sup.tax_id || '',
        supplierPhone: sup.phone || undefined,
        supplierEmail: sup.email || undefined,
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
        paymentTerms: row.payment_terms || 'CONTADO',
        paymentsCount: payments.length,
        notes: row.notes || undefined,
      }
    })

    const canReadCost = userContext
      ? userContext.userRole === 'ADMIN' ||
        userContext.userRole === 'SUPERADMIN' ||
        userContext.userRole === 'ADMINISTRADOR' ||
        (Array.isArray(userContext.permissions) && userContext.permissions.includes('cost.read'))
      : true

    if (!canReadCost) {
      items = items.map((it) => ({
        ...it,
        originalAmount: 0,
        paidAmount: 0,
        pendingBalance: 0,
      }))
    }

    const total = count || 0
    const totalPages = Math.ceil(total / pageSize) || 1

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
      isCostRedacted: !canReadCost,
    }
  }

  /**
   * Obtiene métricas financieras consolidadas de Cuentas por Pagar
   */
  async getStats(userContext?: UserPermissionContext): Promise<AccountsPayableStats> {
    const { data, error } = await supabaseClient
      .from('purchases')
      .select('id, total_amount, paid_amount, payment_status, due_date, inventory_status')
      .in('inventory_status', PAYABLE_INVENTORY_STATUSES)

    if (error || !data) {
      throw new Error('No se pudieron calcular los indicadores de cuentas por pagar.')
    }

    const todayStr = todayBogota()
    let totalPendingBalance = 0
    let totalOverdueBalance = 0
    let pendingInvoicesCount = 0
    let overdueInvoicesCount = 0

    for (const p of data) {
      const pending = pendingPurchaseBalance(p)

      if (pending > 0) {
        totalPendingBalance += pending
        pendingInvoicesCount++

        if (p.due_date && p.due_date < todayStr) {
          totalOverdueBalance += pending
          overdueInvoicesCount++
        }
      }
    }

    // Pagos del mes en curso
    const startOfMonthStr = `${todayStr.slice(0, 7)}-01`

    const { data: monthPayments } = await supabaseClient
      .from('supplier_payments')
      .select('amount')
      .gte('payment_date', startOfMonthStr)

    const paidThisMonth = (monthPayments || []).reduce(
      (acc, pay) => acc + Number(pay.amount || 0),
      0
    )

    const canReadCost = userContext
      ? userContext.userRole === 'ADMIN' ||
        userContext.userRole === 'SUPERADMIN' ||
        userContext.userRole === 'ADMINISTRADOR' ||
        (Array.isArray(userContext.permissions) && userContext.permissions.includes('cost.read'))
      : true

    if (!canReadCost) {
      return {
        totalPendingBalance: 0,
        totalOverdueBalance: 0,
        pendingInvoicesCount,
        overdueInvoicesCount,
        paidThisMonth: 0,
        isCostRedacted: true,
      }
    }

    return {
      totalPendingBalance,
      totalOverdueBalance,
      pendingInvoicesCount,
      overdueInvoicesCount,
      paidThisMonth,
      isCostRedacted: false,
    }
  }

  /**
   * Registra un abono o cancelación total para una Cuenta por Pagar
   */
  async registerPayment(
    input: RegisterPaymentInput,
    userContext?: UserPermissionContext
  ) {
    return purchaseService.registerPayment(input, userContext)
  }

  /**
   * Obtiene el historial detallado de abonos para un documento
   */
  async getPaymentHistory(purchaseId: string) {
    const { data, error } = await supabaseClient
      .from('supplier_payments')
      .select(
        `
        id,
        purchase_id,
        payment_number,
        payment_date,
        amount,
        payment_method,
        transaction_reference,
        notes,
        created_at,
        created_by_user_id
      `
      )
      .eq('purchase_id', purchaseId)
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

export const accountsPayableService = new AccountsPayableService()
