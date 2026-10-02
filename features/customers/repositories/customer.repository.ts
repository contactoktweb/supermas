/**
 * SUPER MÁS ERP/POS - Repositorio Real de Clientes (CustomerRepository)
 * 
 * Acceso directo y exclusivo a PostgreSQL / Supabase con RLS, multi-tenancy
 * por company_id y trazabilidad fiduciaria.
 */

import { supabaseClient } from '@/lib/supabase/client'
import {
  Customer,
  CustomerFilterParams,
  CustomerStats,
  CustomerSaleSummary,
  CustomerInvoiceSummary,
  CustomerRemissionSummary,
  CustomerWebOrderSummary,
  CustomerPaymentSummary,
  CustomerDocumentSummary,
  CustomerLocationRelation,
  CustomerDetail,
  CustomerType,
  CustomerDocumentType,
  CustomerCategory,
  CustomerPriceList,
  CustomerStatus,
} from '../types'

/**
 * Mapea una fila de public.customers a la entidad de dominio Customer
 */
function mapDbRowToCustomer(row: any): Customer {
  const sales = (row.sales as any[]) || []
  const activeSales = sales.filter((s) => s.status !== 'CANCELLED')
  const totalPurchased = activeSales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0)
  const purchasesCount = activeSales.length

  let lastPurchaseDate: string | undefined = undefined
  let firstPurchaseDate: string | undefined = undefined

  if (activeSales.length > 0) {
    const dates = activeSales
      .map((s) => s.created_at || s.date)
      .filter(Boolean)
      .sort()
    firstPurchaseDate = dates[0]
    lastPurchaseDate = dates[dates.length - 1]
  }

  const isCompany = row.person_type === 'COMPANY' || row.customer_type === 'COMPANY'
  const displayName =
    row.company_name ||
    [row.first_name, row.last_name].filter(Boolean).join(' ') ||
    'Cliente'

  return {
    id: row.id,
    customerType: (isCompany ? 'COMPANY' : 'NATURAL') as CustomerType,
    documentType: (row.document_type || 'CC') as CustomerDocumentType,
    documentNumber: row.document_number || '',
    verificationDigit: row.verification_digit || undefined,
    firstName: row.first_name || undefined,
    lastName: row.last_name || undefined,
    businessName: row.company_name || undefined,
    commercialName: row.commercial_name || row.company_name || undefined,
    displayName,
    contactPerson: row.contact_name || '',
    phone: row.phone || '',
    mobile: row.phone || undefined,
    email: row.email || '',
    address: row.address || '',
    city: row.city || 'Medellín',
    department: row.department || 'Antioquia',
    country: 'Colombia',
    category: (row.customer_category || 'FREQUENT') as CustomerCategory,
    priceList: 'DEFAULT' as CustomerPriceList,
    creditLimit: Number(row.credit_limit || 0),
    creditDays: Number(row.credit_days || 0),
    currentBalance: Number(row.current_balance || 0),
    totalPurchased,
    purchasesCount,
    lastPurchaseDate,
    firstPurchaseDate,
    status: (row.is_active ? 'ACTIVE' : 'INACTIVE') as CustomerStatus,
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  }
}

export class CustomerRepository {
  /**
   * Resuelve el company_id autenticado
   */
  private async resolveCompanyId(): Promise<string> {
    const { data: comp } = await supabaseClient.from('companies').select('id').limit(1).maybeSingle()
    if (comp?.id) return comp.id

    const { data: userProfile } = await supabaseClient
      .from('users')
      .select('company_id')
      .limit(1)
      .maybeSingle()

    if (userProfile?.company_id) return userProfile.company_id

    throw new Error('No fue posible identificar la empresa activa (company_id no configurado).')
  }

  /**
   * Obtiene la lista de clientes con soporte para filtrado, ordenamiento y paginación
   */
  async findFiltered(filters: CustomerFilterParams): Promise<{
    items: Customer[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }> {
    const page = Math.max(1, filters.page || 1)
    const pageSize = Math.max(1, filters.pageSize || 10)
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabaseClient.from('customers').select(
      `
        id,
        company_id,
        document_type,
        document_number,
        verification_digit,
        first_name,
        last_name,
        company_name,
        commercial_name,
        contact_name,
        person_type,
        customer_type,
        customer_category,
        email,
        phone,
        address,
        city,
        department,
        credit_limit,
        credit_days,
        current_balance,
        is_active,
        notes,
        created_at,
        updated_at,
        sales (
          id,
          total_amount,
          status,
          created_at
        )
      `,
      { count: 'exact' }
    )

    // Filtro por texto libre
    if (filters.query?.trim()) {
      const q = filters.query.trim().toLowerCase()
      query = query.or(
        `document_number.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,company_name.ilike.%${q}%,commercial_name.ilike.%${q}%,email.ilike.%${q}%,city.ilike.%${q}%,phone.ilike.%${q}%`
      )
    }

    // Filtro por documento
    if (filters.documentNumber?.trim()) {
      const doc = filters.documentNumber.trim()
      query = query.ilike('document_number', `%${doc}%`)
    }

    // Filtro por tipo de persona
    if (filters.customerType && filters.customerType !== 'ALL') {
      if (filters.customerType === 'COMPANY') {
        query = query.or('person_type.eq.COMPANY,customer_type.eq.COMPANY')
      } else {
        query = query.or('person_type.eq.NATURAL,customer_type.eq.INDIVIDUAL')
      }
    }

    // Filtro por categoría
    if (filters.category && filters.category !== 'ALL') {
      query = query.eq('customer_category', filters.category)
    }

    // Filtro por ciudad
    if (filters.city && filters.city !== 'ALL') {
      query = query.ilike('city', filters.city)
    }

    // Filtro por estado
    if (filters.status && filters.status !== 'ALL') {
      query = query.eq('is_active', filters.status === 'ACTIVE')
    }

    // Filtro por saldo pendiente
    if (filters.hasBalance !== undefined) {
      if (filters.hasBalance) {
        query = query.gt('current_balance', 0)
      } else {
        query = query.eq('current_balance', 0)
      }
    }

    // Filtro por fecha de creación
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate)
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate)
    }

    // Ordenamiento
    const sortBy = filters.sortBy || 'displayName'
    const sortDir = filters.sortDirection || 'asc'
    const ascending = sortDir === 'asc'

    if (sortBy === 'currentBalance') {
      query = query.order('current_balance', { ascending })
    } else if (sortBy === 'createdAt') {
      query = query.order('created_at', { ascending })
    } else {
      query = query.order('company_name', { ascending, nullsFirst: false })
    }

    query = query.range(from, to)

    const { data, count, error } = await query

    if (error) {
      console.error('Error consultando clientes en PostgreSQL:', error)
      throw new Error(`Error consultando clientes: ${error.message}`)
    }

    const items = (data || []).map(mapDbRowToCustomer)
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
   * Obtiene todos los clientes sin paginación (selectores / exportación)
   */
  async findAll(): Promise<Customer[]> {
    const { data, error } = await supabaseClient
      .from('customers')
      .select('*, sales(id, total_amount, status, created_at)')
      .order('company_name', { ascending: true, nullsFirst: false })

    if (error) {
      console.error('Error consultando catálogo de clientes:', error)
      return []
    }

    return (data || []).map(mapDbRowToCustomer)
  }

  /**
   * Busca un cliente por su ID
   */
  async findById(id: string): Promise<Customer | null> {
    const { data, error } = await supabaseClient
      .from('customers')
      .select('*, sales(id, total_amount, status, created_at)')
      .eq('id', id)
      .maybeSingle()

    if (error || !data) return null
    return mapDbRowToCustomer(data)
  }

  /**
   * Busca un cliente por su número de documento
   */
  async findByDocument(doc: string): Promise<Customer | null> {
    const cleanDoc = doc.trim()
    const { data, error } = await supabaseClient
      .from('customers')
      .select('*, sales(id, total_amount, status, created_at)')
      .eq('document_number', cleanDoc)
      .maybeSingle()

    if (error || !data) return null
    return mapDbRowToCustomer(data)
  }

  /**
   * Obtiene el detalle completo del cliente con sus entidades relacionales reales
   */
  async getDetail(id: string): Promise<CustomerDetail | null> {
    const customer = await this.findById(id)
    if (!customer) return null

    // 1. Relación real con Ventas
    const { data: salesRaw } = await supabaseClient
      .from('sales')
      .select(
        `
        id,
        sale_number,
        created_at,
        location_id,
        seller_user_id,
        total_amount,
        total_cost_amount,
        estimated_profit_amount,
        payment_method,
        status,
        locations (name),
        users:seller_user_id (full_name)
      `
      )
      .eq('customer_id', id)
      .order('created_at', { ascending: false })

    const customerSales: CustomerSaleSummary[] = (salesRaw || []).map((s: any) => ({
      id: s.id,
      saleCode: s.sale_number,
      date: s.created_at,
      locationId: s.location_id,
      locationName: s.locations?.name || 'Bodega Principal',
      sellerName: s.users?.full_name || 'Vendedor',
      itemsCount: 1,
      totalAmount: Number(s.total_amount || 0),
      costAmount: s.total_cost_amount !== null ? Number(s.total_cost_amount) : undefined,
      profitAmount: s.estimated_profit_amount !== null ? Number(s.estimated_profit_amount) : undefined,
      paymentMethod: s.payment_method,
      status: s.status,
    }))

    // 2. Relación real con Recaudos / Abonos de cartera
    const { data: paymentsRaw } = await supabaseClient
      .from('customer_payments')
      .select(
        `
        id,
        payment_number,
        payment_date,
        amount,
        payment_method,
        transaction_reference,
        notes,
        created_at,
        created_by_user_id,
        users:created_by_user_id (full_name)
      `
      )
      .eq('customer_id', id)
      .order('payment_date', { ascending: false })

    const customerPayments: CustomerPaymentSummary[] = (paymentsRaw || []).map((p: any) => ({
      id: p.id,
      receiptNumber: p.payment_number,
      customerId: id,
      date: p.payment_date || p.created_at,
      amount: Number(p.amount || 0),
      paymentMethod: (p.payment_method || 'TRANSFERENCIA') as any,
      reference: p.transaction_reference || '—',
      user: p.users?.full_name || 'Sistema',
      notes: p.notes || undefined,
    }))

    // 3. Relación con ubicaciones donde ha comprado
    const locationMap = new Map<string, { name: string; code: string; count: number; total: number; lastDate?: string }>()
    for (const sale of customerSales) {
      const locId = sale.locationId || 'GENERAL'
      const existing = locationMap.get(locId) || {
        name: sale.locationName,
        code: 'BOD',
        count: 0,
        total: 0,
      }
      existing.count += 1
      existing.total += sale.totalAmount || 0
      if (!existing.lastDate || new Date(sale.date) > new Date(existing.lastDate)) {
        existing.lastDate = sale.date
      }
      locationMap.set(locId, existing)
    }

    const locationRelations: CustomerLocationRelation[] = Array.from(locationMap.entries()).map(
      ([locId, data]) => ({
        locationId: locId,
        locationName: data.name,
        locationCode: data.code,
        salesCount: data.count,
        totalPurchased: data.total,
        lastPurchaseDate: data.lastDate,
      })
    )

    // 4. Auditoría real desde public.audit_logs
    const { data: auditRaw } = await supabaseClient
      .from('audit_logs')
      .select('id, created_at, user_name, action, entity_id, previous_value, new_value')
      .eq('entity_name', 'customers')
      .eq('entity_id', id)
      .order('created_at', { ascending: false })
      .limit(20)

    const customerAudit = (auditRaw || []).map((a: any) => ({
      id: a.id,
      timestamp: a.created_at,
      user: a.user_name || 'Sistema',
      action: a.action,
      details: `Acción [${a.action}] sobre cliente ${customer.displayName}`,
      oldValues: a.previous_value,
      newValues: a.new_value,
    }))

    return {
      ...customer,
      sales: customerSales,
      invoices: [],
      remissions: [],
      webOrders: [],
      payments: customerPayments,
      documents: [],
      locationRelations,
      frequentProducts: [],
      auditLogs: customerAudit,
    }
  }

  /**
   * Crea un nuevo cliente en PostgreSQL
   */
  async create(customerData: Partial<Customer>): Promise<Customer> {
    const companyId = await this.resolveCompanyId()

    const isCompany = customerData.customerType === 'COMPANY'
    const companyName = customerData.businessName || (isCompany ? customerData.displayName : null)
    const firstName = !isCompany ? (customerData.firstName || customerData.displayName?.split(' ')[0] || null) : null
    const lastName = !isCompany ? (customerData.lastName || customerData.displayName?.split(' ').slice(1).join(' ') || null) : null

    const { data, error } = await supabaseClient
      .from('customers')
      .insert({
        company_id: companyId,
        document_type: customerData.documentType || 'CC',
        document_number: customerData.documentNumber?.trim(),
        verification_digit: customerData.verificationDigit?.trim() || null,
        first_name: firstName,
        last_name: lastName,
        company_name: companyName,
        commercial_name: customerData.commercialName || companyName,
        person_type: isCompany ? 'COMPANY' : 'NATURAL',
        customer_type: isCompany ? 'COMPANY' : 'INDIVIDUAL',
        customer_category: customerData.category || 'RETAIL',
        contact_name: customerData.contactPerson || null,
        phone: customerData.phone?.trim() || null,
        email: customerData.email?.trim().toLowerCase() || null,
        address: customerData.address?.trim() || null,
        city: customerData.city?.trim() || 'Medellín',
        department: customerData.department?.trim() || 'Antioquia',
        credit_limit: customerData.creditLimit || 0,
        credit_days: customerData.creditDays || 0,
        current_balance: customerData.currentBalance || 0,
        is_active: customerData.status !== 'INACTIVE',
        notes: customerData.notes?.trim() || null,
      })
      .select('*, sales(id, total_amount, status, created_at)')
      .single()

    if (error || !data) {
      console.error('Error insertando cliente en public.customers:', error)
      throw new Error(`Error registrando cliente: ${error?.message || 'Error desconocido'}`)
    }

    return mapDbRowToCustomer(data)
  }

  /**
   * Actualiza los datos de un cliente existente en PostgreSQL
   */
  async update(id: string, updates: Partial<Customer>): Promise<Customer | null> {
    const payload: any = {
      updated_at: new Date().toISOString(),
    }

    if (updates.documentType) payload.document_type = updates.documentType
    if (updates.documentNumber) payload.document_number = updates.documentNumber.trim()
    if (updates.verificationDigit !== undefined) payload.verification_digit = updates.verificationDigit || null
    if (updates.firstName !== undefined) payload.first_name = updates.firstName
    if (updates.lastName !== undefined) payload.last_name = updates.lastName
    if (updates.businessName !== undefined) payload.company_name = updates.businessName
    if (updates.commercialName !== undefined) payload.commercial_name = updates.commercialName
    if (updates.contactPerson !== undefined) payload.contact_name = updates.contactPerson
    if (updates.phone !== undefined) payload.phone = updates.phone
    if (updates.email !== undefined) payload.email = updates.email?.toLowerCase().trim()
    if (updates.address !== undefined) payload.address = updates.address
    if (updates.city !== undefined) payload.city = updates.city
    if (updates.department !== undefined) payload.department = updates.department
    if (updates.category !== undefined) payload.customer_category = updates.category
    if (updates.creditLimit !== undefined) payload.credit_limit = updates.creditLimit
    if (updates.creditDays !== undefined) payload.credit_days = updates.creditDays
    if (updates.currentBalance !== undefined) payload.current_balance = updates.currentBalance
    if (updates.status !== undefined) payload.is_active = updates.status === 'ACTIVE'
    if (updates.notes !== undefined) payload.notes = updates.notes

    if (updates.customerType) {
      payload.person_type = updates.customerType === 'COMPANY' ? 'COMPANY' : 'NATURAL'
      payload.customer_type = updates.customerType === 'COMPANY' ? 'COMPANY' : 'INDIVIDUAL'
    }

    const { data, error } = await supabaseClient
      .from('customers')
      .update(payload)
      .eq('id', id)
      .select('*, sales(id, total_amount, status, created_at)')
      .maybeSingle()

    if (error || !data) {
      console.error('Error actualizando cliente en PostgreSQL:', error)
      throw new Error(`Error actualizando cliente: ${error?.message || 'Error desconocido'}`)
    }

    return mapDbRowToCustomer(data)
  }

  /**
   * Desactiva un cliente
   */
  async deactivate(id: string): Promise<boolean> {
    const { error } = await supabaseClient
      .from('customers')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('Error desactivando cliente:', error)
      throw new Error(`Error al desactivar cliente: ${error.message}`)
    }
    return true
  }

  /**
   * Reactiva un cliente
   */
  async reactivate(id: string): Promise<boolean> {
    const { error } = await supabaseClient
      .from('customers')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('Error reactivando cliente:', error)
      throw new Error(`Error al reactivar cliente: ${error.message}`)
    }
    return true
  }

  /**
   * Obtiene métricas agregadas reales de clientes
   */
  async getStats(): Promise<CustomerStats> {
    const { data: custRows, error: custErr } = await supabaseClient
      .from('customers')
      .select('id, is_active, created_at')

    const { data: salesRows, error: salesErr } = await supabaseClient
      .from('sales')
      .select('id, customer_id, total_amount, status, created_at')
      .not('status', 'eq', 'CANCELLED')

    const totalCustomers = custRows?.length || 0
    const activeCustomers = custRows?.filter((c) => c.is_active).length || 0

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoIso = thirtyDaysAgo.toISOString()

    const newCustomersInPeriod =
      custRows?.filter((c) => c.created_at >= thirtyDaysAgoIso).length || 0

    const validSales = salesRows || []
    const totalSalesAmount = validSales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0)
    const averageTicket = validSales.length > 0 ? Math.round(totalSalesAmount / validSales.length) : 0

    const customerSalesMap = new Map<string, { count: number; total: number }>()
    for (const s of validSales) {
      const cur = customerSalesMap.get(s.customer_id) || { count: 0, total: 0 }
      cur.count += 1
      cur.total += Number(s.total_amount || 0)
      customerSalesMap.set(s.customer_id, cur)
    }

    const customersWithRecentPurchases = customerSalesMap.size

    let topBuyer: CustomerStats['topBuyer'] = null
    let maxSpent = 0
    for (const [cId, stats] of customerSalesMap.entries()) {
      if (stats.total > maxSpent) {
        maxSpent = stats.total
        topBuyer = {
          id: cId,
          name: 'Cliente VIP',
          totalPurchased: stats.total,
          purchasesCount: stats.count,
        }
      }
    }

    if (topBuyer?.id) {
      const { data: topCust } = await supabaseClient
        .from('customers')
        .select('company_name, first_name, last_name')
        .eq('id', topBuyer.id)
        .maybeSingle()

      if (topCust) {
        topBuyer.name =
          topCust.company_name ||
          [topCust.first_name, topCust.last_name].filter(Boolean).join(' ') ||
          'Cliente'
      }
    }

    return {
      totalCustomers,
      activeCustomers,
      newCustomersInPeriod,
      customersWithRecentPurchases,
      totalSalesAmount,
      topBuyer,
      averageTicket,
    }
  }
}

export const customerRepository = new CustomerRepository()
