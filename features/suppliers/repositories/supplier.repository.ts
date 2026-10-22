import { supabaseClient } from '@/lib/supabase/client'
import { resolveUserCompanyId } from '@/lib/supabase/tenant'
import {
  Supplier,
  SupplierFilterParams,
  SupplierStats,
  SupplierProductSummary,
  SupplierInvoiceSummary,
  SupplierPaymentSummary,
  SupplierWarehouseRelation,
  SupplierDocumentItem,
} from '../types'
import {
  INVENTORY_STATUS,
  PAYABLE_INVENTORY_STATUSES,
  PENDING_RECEPTION_STATUSES,
  hasReceivedGoods,
  isPayablePurchase,
  pendingPurchaseBalance,
  todayBogota,
} from '@/features/purchases/utils/purchase-status'

/**
 * Mapea una fila de public.suppliers (con compras anidadas) a la entidad de dominio Supplier
 */
function mapDbRowToSupplier(row: any): Supplier {
  const purchases = (row.purchases as any[]) || []
  const totalPurchased = purchases
    .filter((p) => isPayablePurchase(p.inventory_status))
    .reduce((acc, p) => acc + Number(p.total_amount || 0), 0)
  const currentBalance = purchases.reduce((acc, p) => acc + pendingPurchaseBalance(p), 0)
  const pendingInvoicesCount = purchases.filter((p) => pendingPurchaseBalance(p) > 0).length
  // Entregas: compras con mercancía recibida, total o parcialmente.
  const deliveriesCount = purchases.filter((p) => hasReceivedGoods(p.inventory_status)).length

  let lastPurchaseDate: string | undefined = undefined
  if (purchases.length > 0) {
    const dates = purchases
      .map((p) => p.issue_date)
      .filter(Boolean)
      .sort()
    lastPurchaseDate = dates[dates.length - 1]
  }

  return {
    id: row.id,
    supplierId: row.id,
    companyId: row.company_id,
    documentType: 'NIT',
    documentNumber: row.tax_id || '',
    verificationDigit: row.verification_digit || undefined,
    nit: row.tax_id || '',
    businessName: row.legal_name || row.name || '',
    commercialName: row.commercial_name || row.name || '',
    supplierName: row.name || row.legal_name || '',
    personType: row.person_type || 'JURIDICA',
    contactName: row.contact_name || '',
    phone: row.phone || '',
    whatsapp: row.whatsapp || undefined,
    email: row.email || '',
    address: row.address || '',
    city: row.city || '',
    department: row.department || '',
    country: 'Colombia',
    status: row.is_active ? 'ACTIVE' : 'INACTIVE',
    creditDays: Number(row.payment_terms_days || 0),
    creditLimit: Number(row.credit_limit || 0),
    notes: row.notes || undefined,
    deliveriesCount,
    totalPurchased,
    currentBalance,
    pendingInvoicesCount,
    lastPurchaseDate,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  }
}

export class SupplierRepository {
  /**
   * Resuelve el company_id del usuario autenticado actual de forma estricta
   */
  private async resolveCompanyId(): Promise<string> {
    return resolveUserCompanyId(supabaseClient)
  }

  /**
   * Consulta proveedores con filtros dinámicos, ordenamiento y paginación reales contra PostgreSQL
   */
  async findAll(params: SupplierFilterParams): Promise<{
    items: Supplier[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }> {
    let query = supabaseClient.from('suppliers').select(
      `
        id,
        company_id,
        tax_id,
        verification_digit,
        name,
        legal_name,
        commercial_name,
        person_type,
        contact_name,
        email,
        phone,
        whatsapp,
        address,
        city,
        department,
        payment_terms_days,
        credit_limit,
        is_active,
        notes,
        created_at,
        updated_at,
        purchases (
          id,
          total_amount,
          paid_amount,
          payment_status,
          inventory_status,
          issue_date
        )
      `,
      { count: 'exact' }
    )

    // 1. Búsqueda por texto (nombre, documento, contacto, email, ciudad); se quitan los caracteres
    // que rompen la sintaxis del filtro.
    const q = (params.query || '').trim().toLowerCase().replace(/[,()*%\\]/g, ' ').trim()
    if (q) {
      query = query.or(
        `name.ilike.%${q}%,legal_name.ilike.%${q}%,commercial_name.ilike.%${q}%,tax_id.ilike.%${q}%,contact_name.ilike.%${q}%,email.ilike.%${q}%,city.ilike.%${q}%`
      )
    }

    // 2. Filtro por Documento / NIT específico
    if (params.documentNumber && params.documentNumber.trim()) {
      query = query.eq('tax_id', params.documentNumber.trim())
    }

    // 3. Filtro por Estado
    if (params.status && params.status !== 'ALL') {
      query = query.eq('is_active', params.status === 'ACTIVE')
    }

    // Fecha de registro del proveedor
    if (params.startDate) query = query.gte('created_at', params.startDate)
    if (params.endDate) query = query.lte('created_at', `${params.endDate}T23:59:59`)

    // Proveedores con compras en una bodega y/o con saldo pendiente: se resuelven primero sus ids para
    // filtrar en el servidor y que el total y la paginación cuadren.
    const needsBodega = Boolean(params.locationId && params.locationId !== 'ALL')
    if (needsBodega || params.hasPendingBalance !== undefined) {
      let purchasesQuery = supabaseClient
        .from('purchases')
        .select('supplier_id, total_amount, paid_amount, payment_status, inventory_status')
        .in('inventory_status', PAYABLE_INVENTORY_STATUSES)
      if (needsBodega) purchasesQuery = purchasesQuery.eq('location_id', params.locationId!)
      const { data: related, error: relatedError } = await purchasesQuery
      if (relatedError) throw new Error('No se pudieron cargar los proveedores.')

      const withPending = new Set((related ?? []).filter((p) => pendingPurchaseBalance(p) > 0).map((p) => p.supplier_id))
      if (needsBodega) {
        const atLocation = new Set((related ?? []).map((p) => p.supplier_id))
        const ids = [...atLocation].filter((id) =>
          params.hasPendingBalance === undefined ? true : params.hasPendingBalance === withPending.has(id)
        )
        query = query.in('id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000'])
      } else if (params.hasPendingBalance) {
        const ids = [...withPending]
        query = query.in('id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000'])
      } else if (withPending.size > 0) {
        query = query.not('id', 'in', `(${[...withPending].join(',')})`)
      }
    }

    // 4. Ordenamiento
    const sortField = params.sortField || 'businessName'
    const sortDirection = params.sortDirection || 'asc'
    const ascending = sortDirection === 'asc'

    if (sortField === 'businessName') {
      query = query.order('legal_name', { ascending })
    } else if (sortField === 'documentNumber') {
      query = query.order('tax_id', { ascending })
    } else {
      query = query.order('created_at', { ascending })
    }

    // 5. Paginación
    const page = Math.max(1, params.page || 1)
    const pageSize = Math.max(1, params.pageSize || 10)
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    query = query.range(from, to)

    const { data, count, error } = await query

    if (error) {
      console.error('Error consultando proveedores en PostgreSQL:', error)
      throw new Error('No se pudieron cargar los proveedores.')
    }

    const total = count || 0
    const items = (data || []).map(mapDbRowToSupplier)

    const totalPages = Math.ceil(total / pageSize) || 1

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    }
  }

  /**
   * Obtiene un proveedor por ID con sus compras asociadas
   */
  async findById(id: string): Promise<Supplier | null> {
    const { data, error } = await supabaseClient
      .from('suppliers')
      .select(
        `
        id,
        company_id,
        tax_id,
        verification_digit,
        name,
        legal_name,
        commercial_name,
        person_type,
        contact_name,
        email,
        phone,
        whatsapp,
        address,
        city,
        department,
        payment_terms_days,
        credit_limit,
        is_active,
        notes,
        created_at,
        updated_at,
        purchases (
          id,
          total_amount,
          paid_amount,
          payment_status,
          inventory_status,
          issue_date
        )
      `
      )
      .eq('id', id)
      .single()

    if (error || !data) {
      return null
    }

    return mapDbRowToSupplier(data)
  }

  /**
   * Busca si un número de documento/NIT ya existe en la empresa actual
   */
  async findByDocument(documentNumber: string, excludeId?: string): Promise<Supplier | null> {
    const cleanDoc = documentNumber.replace(/[.\-\s]/g, '').trim()
    let query = supabaseClient.from('suppliers').select('id, tax_id, legal_name, name').eq('tax_id', cleanDoc)

    if (excludeId) {
      query = query.neq('id', excludeId)
    }

    const { data } = await query.limit(1).maybeSingle()
    if (!data) return null

    return {
      id: data.id,
      supplierId: data.id,
      documentType: 'NIT',
      documentNumber: data.tax_id,
      nit: data.tax_id,
      businessName: data.legal_name || data.name,
      contactName: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      department: '',
      country: 'Colombia',
      status: 'ACTIVE',
      creditDays: 30,
      creditLimit: 0,
      deliveriesCount: 0,
      totalPurchased: 0,
      currentBalance: 0,
      pendingInvoicesCount: 0,
      createdAt: '',
      updatedAt: '',
    }
  }

  /**
   * Registra un nuevo proveedor en PostgreSQL bajo RLS
   */
  async create(supplier: Supplier, _user?: { id: string; name: string }): Promise<Supplier> {
    const companyId = await this.resolveCompanyId()

    const insertPayload: any = {
      company_id: companyId,
      tax_id: supplier.documentNumber.replace(/[.\-\s]/g, '').trim(),
      verification_digit: supplier.verificationDigit || null,
      name: (supplier.commercialName?.trim() || supplier.businessName.trim()),
      legal_name: supplier.businessName.trim(),
      commercial_name: (supplier.commercialName?.trim() || supplier.businessName.trim()),
      person_type: supplier.personType || 'JURIDICA',
      contact_name: supplier.contactName.trim(),
      phone: supplier.phone.trim(),
      whatsapp: supplier.whatsapp?.trim() || null,
      email: supplier.email.trim().toLowerCase(),
      address: supplier.address.trim(),
      city: supplier.city.trim(),
      department: supplier.department.trim(),
      payment_terms_days: supplier.creditDays ?? 0,
      credit_limit: supplier.creditLimit || 0,
      notes: supplier.notes?.trim() || null,
      is_active: supplier.status === 'INACTIVE' ? false : true,
    }

    const { data, error } = await supabaseClient
      .from('suppliers')
      .insert(insertPayload)
      .select()
      .single()

    if (error || !data) {
      console.error('Error insertando proveedor en Supabase:', error)
      throw new Error(
        error?.code === '23505'
          ? 'Ya existe un proveedor registrado con ese número de documento.'
          : 'No se pudo crear el proveedor. Verifique los datos e intente de nuevo.'
      )
    }

    return mapDbRowToSupplier(data)
  }

  /**
   * Actualiza los datos de un proveedor existente en PostgreSQL
   */
  async update(
    id: string,
    data: Partial<Supplier>,
    _user?: { id: string; name: string }
  ): Promise<Supplier> {
    const updatePayload: any = {}

    if (data.businessName !== undefined) {
      updatePayload.legal_name = data.businessName.trim()
    }
    if (data.commercialName !== undefined) {
      updatePayload.commercial_name = data.commercialName.trim()
      updatePayload.name = data.commercialName.trim()
    }
    if (data.documentNumber !== undefined) {
      updatePayload.tax_id = data.documentNumber.trim()
    }
    if (data.verificationDigit !== undefined) {
      updatePayload.verification_digit = data.verificationDigit
    }
    if (data.personType !== undefined) {
      updatePayload.person_type = data.personType
    }
    if (data.contactName !== undefined) {
      updatePayload.contact_name = data.contactName.trim()
    }
    if (data.phone !== undefined) {
      updatePayload.phone = data.phone.trim()
    }
    if (data.whatsapp !== undefined) {
      updatePayload.whatsapp = data.whatsapp.trim()
    }
    if (data.email !== undefined) {
      updatePayload.email = data.email.trim().toLowerCase()
    }
    if (data.address !== undefined) {
      updatePayload.address = data.address.trim()
    }
    if (data.city !== undefined) {
      updatePayload.city = data.city.trim()
    }
    if (data.department !== undefined) {
      updatePayload.department = data.department.trim()
    }
    if (data.creditDays !== undefined) {
      updatePayload.payment_terms_days = data.creditDays
    }
    if (data.creditLimit !== undefined) {
      updatePayload.credit_limit = data.creditLimit
    }
    if (data.notes !== undefined) {
      updatePayload.notes = data.notes?.trim() || null
    }
    if (data.status !== undefined) {
      updatePayload.is_active = data.status === 'ACTIVE'
    }

    const { data: updated, error } = await supabaseClient
      .from('suppliers')
      .update(updatePayload)
      .eq('id', id)
      .select(
        `
        id,
        company_id,
        tax_id,
        verification_digit,
        name,
        legal_name,
        commercial_name,
        person_type,
        contact_name,
        email,
        phone,
        whatsapp,
        address,
        city,
        department,
        payment_terms_days,
        credit_limit,
        is_active,
        notes,
        created_at,
        updated_at,
        purchases (
          id,
          total_amount,
          paid_amount,
          payment_status,
          inventory_status,
          issue_date
        )
      `
      )
      .single()

    if (error || !updated) {
      console.error('Error actualizando proveedor en PostgreSQL:', error)
      throw new Error(
        error?.code === '23505'
          ? 'Ya existe un proveedor registrado con ese número de documento.'
          : 'No se pudo actualizar el proveedor. Verifique los datos e intente de nuevo.'
      )
    }

    return mapDbRowToSupplier(updated)
  }

  /**
   * Desactiva un proveedor validando que no tenga obligaciones pendientes ni compras abiertas
   */
  async deactivate(id: string, user: { id: string; name: string }): Promise<Supplier> {
    const supplier = await this.findById(id)
    if (!supplier) throw new Error(`Proveedor no encontrado (ID: ${id})`)

    if (supplier.currentBalance > 0) {
      throw new Error(
        `No es posible desactivar al proveedor "${supplier.businessName}" porque posee un saldo pendiente de $${supplier.currentBalance.toLocaleString('es-CO')}. Debe liquidar las cuentas por pagar primero.`
      )
    }

    const { data: openPurchases } = await supabaseClient
      .from('purchases')
      .select('id, purchase_number, inventory_status')
      .eq('supplier_id', id)
      .in('inventory_status', [...INVENTORY_STATUS.DRAFT, ...PENDING_RECEPTION_STATUSES])
      .limit(1)

    if (openPurchases && openPurchases.length > 0) {
      throw new Error(
        `No es posible desactivar al proveedor porque tiene la orden de compra ${openPurchases[0].purchase_number} pendiente de recepción.`
      )
    }

    return this.update(id, { status: 'INACTIVE' }, user)
  }

  /**
   * Reactiva un proveedor inactivo
   */
  async activate(id: string, user: { id: string; name: string }): Promise<Supplier> {
    return this.update(id, { status: 'ACTIVE' }, user)
  }

  /**
   * Obtiene estadísticas agregadas fiduciarias desde PostgreSQL
   */
  async getStats(_userContext?: any): Promise<SupplierStats> {
    const today = todayBogota()
    const monthStart = `${today.slice(0, 7)}-01`
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)

    const [suppliersRes, purchasesRes] = await Promise.all([
      supabaseClient.from('suppliers').select('id, is_active'),
      supabaseClient
        .from('purchases')
        .select('id, supplier_id, total_amount, paid_amount, payment_status, due_date, inventory_status, issue_date')
        .in('inventory_status', PAYABLE_INVENTORY_STATUSES),
    ])
    if (suppliersRes.error || purchasesRes.error) {
      throw new Error('No se pudieron calcular las estadísticas de proveedores.')
    }

    const suppliersData = suppliersRes.data ?? []
    const purchases = purchasesRes.data ?? []

    let totalPendingBalance = 0
    let pendingInvoicesCount = 0
    let overdueInvoicesCount = 0
    let totalPurchasedPeriod = 0
    const suppliersWithRecent = new Set<string>()

    for (const p of purchases) {
      const pending = pendingPurchaseBalance(p)
      if (pending > 0) {
        totalPendingBalance += pending
        pendingInvoicesCount++
        if (p.due_date && p.due_date < today) overdueInvoicesCount++
      }
      if (p.issue_date && p.issue_date >= thirtyDaysAgo) suppliersWithRecent.add(p.supplier_id)
      if (p.issue_date && p.issue_date >= monthStart) totalPurchasedPeriod += Number(p.total_amount || 0)
    }

    // Referencias distintas compradas en compras vigentes.
    let suppliedProductsCount = 0
    if (purchases.length > 0) {
      const { data: items } = await supabaseClient
        .from('purchase_items')
        .select('product_id')
        .in('purchase_id', purchases.map((p) => p.id))
      suppliedProductsCount = new Set((items ?? []).map((i) => i.product_id)).size
    }

    return {
      totalSuppliers: suppliersData.length,
      activeSuppliers: suppliersData.filter((s) => s.is_active).length,
      suppliersWithRecentPurchases: suppliersWithRecent.size,
      totalPendingBalance,
      pendingInvoicesCount,
      overdueInvoicesCount,
      totalPurchasedPeriod,
      suppliedProductsCount,
      isCostRedacted: false,
    }
  }


  /**
   * Obtiene la relación de productos suministrados por el proveedor desde PostgreSQL
   */
  async getSupplierProducts(supplierId: string): Promise<SupplierProductSummary[]> {
    const { data, error } = await supabaseClient
      .from('purchase_items')
      .select(
        `
        id,
        product_id,
        quantity,
        unit_cost,
        total,
        created_at,
        purchases!inner (
          id,
          supplier_id,
          purchase_number,
          issue_date
        ),
        products (
          id,
          name,
          sku,
          unit_of_measure,
          category_id,
          categories (name)
        )
      `
      )
      .eq('purchases.supplier_id', supplierId)

    if (error || !data) return []

    const productMap = new Map<string, SupplierProductSummary>()

    for (const row of data as any[]) {
      const prod = row.products || {}
      const purchase = row.purchases || {}
      const pid = row.product_id

      if (!productMap.has(pid)) {
        productMap.set(pid, {
          productId: pid,
          productName: prod.name || 'Producto',
          sku: prod.sku || 'SKU',
          category: prod.categories?.name || 'General',
          unitOfMeasure: prod.unit_of_measure || 'UND',
          lastUnitCost: Number(row.unit_cost || 0),
          lastPurchaseDoc: purchase.purchase_number || '',
          lastPurchaseDate: purchase.issue_date || row.created_at,
          totalUnitsSupplied: Number(row.quantity || 0),
          totalValueSupplied: Number(row.total || 0),
        })
      } else {
        const existing = productMap.get(pid)!
        existing.totalUnitsSupplied += Number(row.quantity || 0)
        existing.totalValueSupplied += Number(row.total || 0)
        if (purchase.issue_date && purchase.issue_date >= existing.lastPurchaseDate) {
          existing.lastUnitCost = Number(row.unit_cost || 0)
          existing.lastPurchaseDoc = purchase.purchase_number || ''
          existing.lastPurchaseDate = purchase.issue_date
        }
      }
    }

    return Array.from(productMap.values())
  }

  /**
   * Obtiene el historial de compras/facturas del proveedor desde PostgreSQL
   */
  async getSupplierInvoices(supplierId: string): Promise<SupplierInvoiceSummary[]> {
    const { data, error } = await supabaseClient
      .from('purchases')
      .select('id, purchase_number, supplier_invoice_number, issue_date, due_date, total_amount, paid_amount, payment_status, invoice_attachment_url')
      .eq('supplier_id', supplierId)
      .in('inventory_status', PAYABLE_INVENTORY_STATUSES)
      .order('issue_date', { ascending: false })

    if (error || !data) return []

    const now = todayBogota()

    return data.map((p) => {
      const total = Number(p.total_amount || 0)
      const paid = Number(p.paid_amount || 0)
      const pending = total - paid

      let status: 'PENDIENTE' | 'PAGADA' | 'VENCIDA' = 'PENDIENTE'
      if (p.payment_status === 'PAID' || pending <= 0) {
        status = 'PAGADA'
      } else if (p.due_date && p.due_date < now) {
        status = 'VENCIDA'
      }

      return {
        purchaseId: p.id,
        purchaseNumber: p.purchase_number,
        invoiceNumber: p.supplier_invoice_number,
        date: p.issue_date,
        dueDate: p.due_date || undefined,
        total,
        paidAmount: paid,
        pendingBalance: Math.max(0, pending),
        status,
        hasAttachment: !!p.invoice_attachment_url,
        attachmentUrl: p.invoice_attachment_url || undefined,
      }
    })
  }

  /**
   * Obtiene el historial de pagos efectuados al proveedor desde PostgreSQL
   */
  async getSupplierPayments(supplierId: string): Promise<SupplierPaymentSummary[]> {
    const { data, error } = await supabaseClient
      .from('supplier_payments')
      .select(
        `
        id,
        purchase_id,
        payment_date,
        amount,
        payment_method,
        transaction_reference,
        notes,
        creator:users!supplier_payments_created_by_user_id_fkey ( full_name ),
        purchases!inner (
          id,
          supplier_id,
          purchase_number,
          supplier_invoice_number
        )
      `
      )
      .eq('purchases.supplier_id', supplierId)
      .order('payment_date', { ascending: false })

    if (error || !data) return []

    return data.map((pay: any) => ({
      paymentId: pay.id,
      purchaseId: pay.purchase_id,
      purchaseNumber: pay.purchases?.purchase_number || '',
      invoiceNumber: pay.purchases?.supplier_invoice_number || '',
      date: pay.payment_date,
      amount: Number(pay.amount || 0),
      paymentMethod: pay.payment_method || 'TRANSFERENCIA',
      reference: pay.transaction_reference || '—',
      registeredByUserName: pay.creator?.full_name || '—',
      notes: pay.notes || undefined,
    }))
  }

  /**
   * Obtiene las bodegas donde el proveedor ha entregado mercancía
   */
  async getSupplierWarehouses(supplierId: string): Promise<SupplierWarehouseRelation[]> {
    const { data, error } = await supabaseClient
      .from('purchases')
      .select(
        `
        location_id,
        total_amount,
        issue_date,
        locations (
          id,
          code,
          name,
          city
        )
      `
      )
      .eq('supplier_id', supplierId)

    if (error || !data) return []

    const warehouseMap = new Map<string, SupplierWarehouseRelation>()

    for (const row of data as any[]) {
      const loc = row.locations
      if (!loc) continue

      if (!warehouseMap.has(loc.id)) {
        warehouseMap.set(loc.id, {
          locationId: loc.id,
          locationName: loc.name,
          locationCode: loc.code,
          purchasesCount: 1,
          totalAmount: Number(row.total_amount || 0),
          lastOperationDate: row.issue_date,
        })
      } else {
        const existing = warehouseMap.get(loc.id)!
        existing.purchasesCount++
        existing.totalAmount += Number(row.total_amount || 0)
        if (row.issue_date && row.issue_date > (existing.lastOperationDate || '')) {
          existing.lastOperationDate = row.issue_date
        }
      }
    }

    return Array.from(warehouseMap.values())
  }

  /**
   * Documentos adjuntos asociados al proveedor
   */
  async getSupplierDocuments(supplierId: string): Promise<SupplierDocumentItem[]> {
    const { data } = await supabaseClient
      .from('purchases')
      .select('id, purchase_number, supplier_invoice_number, invoice_attachment_url, created_at')
      .eq('supplier_id', supplierId)
      .not('invoice_attachment_url', 'is', null)

    if (!data) return []

    return data.map((p) => ({
      id: p.id,
      fileName: `Factura ${p.supplier_invoice_number || p.purchase_number}`,
      fileType: /\.(jpe?g|png)$/i.test(p.invoice_attachment_url || '') ? 'image' : 'application/pdf',
      fileSize: 0,
      url: p.invoice_attachment_url || '',
      uploadedAt: p.created_at,
      uploadedBy: '—',
    }))
  }

  /**
   * Consulta la bitácora de auditoría del proveedor desde PostgreSQL
   */
  async getSupplierAuditLogs(supplierId: string) {
    const { data } = await supabaseClient
      .from('audit_logs')
      .select('*')
      .eq('entity_name', 'suppliers')
      .eq('entity_id', supplierId)
      .order('created_at', { ascending: false })
    return data || []
  }

  /**
   * Exporta proveedores en formato CSV
   */
  exportToCsv(suppliers: Supplier[], isCostRedacted: boolean = false): string {
    const headers = [
      'Documento',
      'Razón Social',
      'Nombre Comercial',
      'Contacto',
      'Teléfono',
      'Email',
      'Ciudad',
      'Días Crédito',
      'Estado',
    ]
    if (!isCostRedacted) {
      headers.push('Cupo Crédito', 'Total Comprado', 'Saldo Pendiente')
    }
    const rows = suppliers.map((s) => {
      const base = [
        `"${s.documentNumber}"`,
        `"${s.businessName.replace(/"/g, '""')}"`,
        `"${(s.commercialName || '').replace(/"/g, '""')}"`,
        `"${s.contactName.replace(/"/g, '""')}"`,
        `"${s.phone}"`,
        `"${s.email}"`,
        `"${s.city}"`,
        s.creditDays,
        s.status === 'ACTIVE' ? 'Activo' : 'Inactivo',
      ]
      if (!isCostRedacted) {
        base.push(s.creditLimit, s.totalPurchased, s.currentBalance)
      }
      return base.join(',')
    })
    return [headers.join(','), ...rows].join('\n')
  }
}

export const supplierRepository = new SupplierRepository()
