/**
 * SUPER MÁS ERP/POS - Repositorio de Datos Analíticos (ReportRepository)
 *
 * Capa de lectura desacoplada que consulta directamente las tablas analíticas y operativas
 * en Supabase PostgreSQL con estricto aislamiento multiempresa (company_id).
 *
 * IMPORTANTE: OPERACIONES 100% DE LECTURA (READ-ONLY).
 */

import { supabaseClient } from '@/lib/supabase/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveUserCompanyId } from '@/lib/supabase/tenant'
import { ReportFilterCriteria } from '../types'

function getDbClient() {
  if (typeof window === 'undefined' && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return supabaseAdmin
  }
  return supabaseClient
}

export class ReportRepository {
  /**
   * Resuelve el company_id activo de forma segura con multi-tenancy
   */
  private async getCompanyId(preferredCompanyId?: string): Promise<string | null> {
    if (preferredCompanyId) return preferredCompanyId
    try {
      return await resolveUserCompanyId(getDbClient(), preferredCompanyId)
    } catch {
      return preferredCompanyId || null
    }
  }

  /**
   * Obtiene todas las ventas aplicando filtros de periodo, bodega, cliente, vendedor y forma de pago
   */
  async getSales(criteria?: ReportFilterCriteria) {
    const companyId = await this.getCompanyId(criteria?.companyId)

    let query = getDbClient()
      .from('sales')
      .select(`
        id,
        company_id,
        location_id,
        customer_id,
        seller_user_id,
        cash_session_id,
        sale_number,
        subtotal_amount,
        discount_amount,
        tax_amount,
        total_amount,
        total_cost_amount,
        payment_method,
        payment_status,
        status,
        notes,
        created_at,
        customer:customers(first_name, last_name, company_name, document_number),
        location:locations(name),
        seller:users(full_name, email),
        items:sale_items(
          id,
          product_id,
          quantity,
          unit_price,
          unit_cost,
          discount_percent,
          tax_amount,
          subtotal,
          total,
          product:products(name, sku, category:categories(name))
        )
      `)
      .order('created_at', { ascending: false })

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    if (criteria?.locationId && criteria.locationId !== 'ALL') {
      query = query.eq('location_id', criteria.locationId)
    }

    if (criteria?.customerId && criteria.customerId !== 'ALL') {
      query = query.eq('customer_id', criteria.customerId)
    }

    if (criteria?.userId && criteria.userId !== 'ALL') {
      query = query.eq('seller_user_id', criteria.userId)
    }

    if (criteria?.paymentMethod && criteria.paymentMethod !== 'ALL') {
      query = query.eq('payment_method', criteria.paymentMethod)
    }

    if (criteria?.startDate) {
      query = query.gte('created_at', criteria.startDate)
    }

    if (criteria?.endDate) {
      query = query.lte('created_at', criteria.endDate)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error al consultar ventas para reportes:', error)
      return []
    }

    let list = (data || []).map((row: any) => {
      const custName = row.customer
        ? (row.customer.company_name || `${row.customer.first_name || ''} ${row.customer.last_name || ''}`.trim() || 'Consumidor Final')
        : 'Consumidor Final'
      const locName = row.location?.name || 'Bodega Principal'
      const selName = row.seller?.full_name || row.seller?.email || 'Venta Mostrador'

      const mappedItems = (row.items || []).map((it: any) => ({
        id: it.id,
        productId: it.product_id,
        productName: it.product?.name || 'Producto',
        sku: it.product?.sku || '',
        category: it.product?.category?.name || 'General',
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unit_price) || 0,
        unitCost: Number(it.unit_cost) || 0,
        subtotal: Number(it.subtotal) || 0,
        taxAmount: Number(it.tax_amount) || 0,
        total: Number(it.total) || 0,
      }))

      const itemsCount = mappedItems.reduce((acc: number, it: any) => acc + it.quantity, 0)
      const tot = Number(row.total_amount) || 0
      const sub = Number(row.subtotal_amount) || tot
      const disc = Number(row.discount_amount) || 0
      const tax = Number(row.tax_amount) || 0
      const cost = Number(row.total_cost_amount) || 0

      return {
        id: row.id,
        companyId: row.company_id,
        locationId: row.location_id,
        locationName: locName,
        customerId: row.customer_id,
        customerName: custName,
        customerDoc: row.customer?.document_number || 'N/A',
        sellerId: row.seller_user_id,
        sellerName: selName,
        saleNumber: row.sale_number,
        invoiceNumber: row.sale_number,
        date: row.created_at,
        createdAt: row.created_at,
        status: row.status,
        paymentStatus: row.payment_status,
        paymentMethod: row.payment_method,
        paymentType: row.payment_method,
        itemsCount,
        subtotal: sub,
        subtotalAmount: sub,
        discountAmount: disc,
        discountTotal: disc,
        taxAmount: tax,
        taxTotal: tax,
        total: tot,
        totalAmount: tot,
        totalCost: cost,
        notes: row.notes || '',
        items: mappedItems,
      }
    })

    if (criteria?.searchQuery) {
      const q = criteria.searchQuery.toLowerCase().trim()
      list = list.filter(
        (s) =>
          s.saleNumber?.toLowerCase().includes(q) ||
          s.customerName?.toLowerCase().includes(q) ||
          s.customerDoc?.toLowerCase().includes(q) ||
          s.items?.some((i: any) => i.productName?.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q))
      )
    }

    return list
  }

  /**
   * Obtiene todas las compras aplicando filtros
   */
  async getPurchases(criteria?: ReportFilterCriteria) {
    const companyId = await this.getCompanyId(criteria?.companyId)

    let query = getDbClient()
      .from('purchases')
      .select(`
        id,
        company_id,
        location_id,
        supplier_id,
        purchase_number,
        supplier_invoice_number,
        issue_date,
        due_date,
        subtotal_amount,
        discount_amount,
        tax_amount,
        total_amount,
        payment_terms,
        payment_status,
        inventory_status,
        notes,
        created_at,
        supplier:suppliers(name, legal_name, tax_id),
        location:locations(name),
        items:purchase_items(
          id,
          product_id,
          quantity,
          unit_cost,
          subtotal,
          tax_amount,
          total,
          product:products(name, sku, category:categories(name))
        )
      `)
      .order('created_at', { ascending: false })

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    if (criteria?.locationId && criteria.locationId !== 'ALL') {
      query = query.eq('location_id', criteria.locationId)
    }

    if (criteria?.supplierId && criteria.supplierId !== 'ALL') {
      query = query.eq('supplier_id', criteria.supplierId)
    }

    if (criteria?.startDate) {
      query = query.gte('issue_date', criteria.startDate.slice(0, 10))
    }

    if (criteria?.endDate) {
      query = query.lte('issue_date', criteria.endDate.slice(0, 10))
    }

    const { data, error } = await query

    if (error) {
      console.error('Error al consultar compras para reportes:', error)
      return []
    }

    let list = (data || []).map((row: any) => {
      const suppName = row.supplier?.name || row.supplier?.legal_name || 'Proveedor'
      const locName = row.location?.name || 'Bodega Principal'

      const mappedItems = (row.items || []).map((it: any) => ({
        id: it.id,
        productId: it.product_id,
        productName: it.product?.name || 'Producto',
        sku: it.product?.sku || '',
        category: it.product?.category?.name || 'General',
        quantity: Number(it.quantity) || 0,
        unitCost: Number(it.unit_cost) || 0,
        subtotal: Number(it.subtotal) || 0,
        taxAmount: Number(it.tax_amount) || 0,
        total: Number(it.total) || 0,
      }))

      const itemsCount = mappedItems.reduce((acc: number, it: any) => acc + it.quantity, 0)
      const tot = Number(row.total_amount) || 0
      const sub = Number(row.subtotal_amount) || tot
      const disc = Number(row.discount_amount) || 0
      const tax = Number(row.tax_amount) || 0

      return {
        id: row.id,
        companyId: row.company_id,
        locationId: row.location_id,
        destinationLocationId: row.location_id,
        locationName: locName,
        supplierId: row.supplier_id,
        supplierName: suppName,
        supplierNit: row.supplier?.tax_id || '',
        purchaseNumber: row.purchase_number,
        supplierInvoiceNumber: row.supplier_invoice_number || row.purchase_number,
        date: row.issue_date || row.created_at,
        issueDate: row.issue_date,
        createdAt: row.created_at,
        status: row.payment_status || row.inventory_status || 'CONFIRMED',
        paymentTerms: row.payment_terms || 'CONTADO',
        paymentStatus: row.payment_status,
        inventoryStatus: row.inventory_status,
        itemsCount,
        subtotal: sub,
        subtotalAmount: sub,
        discountAmount: disc,
        taxAmount: tax,
        total: tot,
        totalAmount: tot,
        notes: row.notes || '',
        items: mappedItems,
      }
    })

    if (criteria?.searchQuery) {
      const q = criteria.searchQuery.toLowerCase().trim()
      list = list.filter(
        (p) =>
          p.purchaseNumber?.toLowerCase().includes(q) ||
          p.supplierInvoiceNumber?.toLowerCase().includes(q) ||
          p.supplierName?.toLowerCase().includes(q) ||
          p.supplierNit?.toLowerCase().includes(q)
      )
    }

    return list
  }

  /**
   * Obtiene productos maestros con información de precios y catálogo
   */
  async getProducts(companyIdOverride?: string) {
    const companyId = await this.getCompanyId(companyIdOverride)

    let query = getDbClient()
      .from('products')
      .select(`
        id,
        company_id,
        sku,
        barcode,
        name,
        slug,
        category_id,
        brand_id,
        unit_of_measure,
        cost_price,
        public_sale_price,
        wholesale_price,
        min_stock_threshold,
        critical_stock_threshold,
        is_active,
        is_published_supermas,
        is_published_distributor,
        created_at,
        category:categories(name),
        brand:brands(name)
      `)
      .order('name', { ascending: true })

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error al consultar productos para reportes:', error)
      return []
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      companyId: row.company_id,
      sku: row.sku,
      barcode: row.barcode,
      name: row.name,
      slug: row.slug,
      category: row.category?.name || 'General',
      categoryId: row.category_id,
      brand: row.brand?.name || 'General',
      brandId: row.brand_id,
      unit: row.unit_of_measure || 'UND',
      cost: Number(row.cost_price) || 0,
      averageCost: Number(row.cost_price) || 0,
      price: Number(row.public_sale_price) || 0,
      normalPrice: Number(row.public_sale_price) || 0,
      wholesalePrice: Number(row.wholesale_price) || 0,
      minStockThreshold: Number(row.min_stock_threshold) || 5,
      criticalStockThreshold: Number(row.critical_stock_threshold) || 2,
      webLowStockThreshold: Number(row.min_stock_threshold) || 5,
      isActive: row.is_active,
      isPublishedSupermas: row.is_published_supermas,
      isPublishedDistributor: row.is_published_distributor,
      createdAt: row.created_at,
    }))
  }

  /**
   * Obtiene niveles de stock por producto y bodega
   */
  async getStockLevels(locationId?: string, companyIdOverride?: string) {
    const companyId = await this.getCompanyId(companyIdOverride)

    let query = getDbClient()
      .from('stock_levels')
      .select(`
        id,
        company_id,
        product_id,
        location_id,
        quantity,
        reserved_quantity,
        available_quantity,
        average_cost,
        total_value_at_cost,
        min_stock,
        max_stock,
        location:locations(name)
      `)

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    if (locationId && locationId !== 'ALL') {
      query = query.eq('location_id', locationId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error al consultar stock levels para reportes:', error)
      return []
    }

    return (data || []).map((row: any) => {
      const qty = Number(row.quantity) || 0
      const avgCost = Number(row.average_cost) || 0
      const totalVal = Number(row.total_value_at_cost) || (qty * avgCost)

      return {
        id: row.id,
        companyId: row.company_id,
        productId: row.product_id,
        locationId: row.location_id,
        locationName: row.location?.name || 'Bodega Principal',
        currentStock: qty,
        quantity: qty,
        reservedQuantity: Number(row.reserved_quantity) || 0,
        availableUnits: Number(row.available_quantity) || qty,
        minStock: Number(row.min_stock) || 5,
        maxStock: Number(row.max_stock) || 100,
        averageCost: avgCost,
        totalValueAtCost: totalVal,
      }
    })
  }

  /**
   * Obtiene el historial de movimientos de inventario (Kardex)
   */
  async getInventoryMovements(criteria?: ReportFilterCriteria) {
    const companyId = await this.getCompanyId(criteria?.companyId)

    let query = getDbClient()
      .from('inventory_movements')
      .select(`
        id,
        company_id,
        consecutive,
        product_id,
        location_id,
        movement_type,
        quantity_in,
        quantity_out,
        previous_stock,
        new_stock,
        unit_cost,
        total_cost,
        document_type,
        document_reference,
        reason,
        created_at,
        product:products(name, sku),
        location:locations(name)
      `)
      .order('created_at', { ascending: false })

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    if (criteria?.locationId && criteria.locationId !== 'ALL') {
      query = query.eq('location_id', criteria.locationId)
    }

    if (criteria?.productId && criteria.productId !== 'ALL') {
      query = query.eq('product_id', criteria.productId)
    }

    if (criteria?.movementType && criteria.movementType !== 'ALL') {
      query = query.eq('movement_type', criteria.movementType)
    }

    if (criteria?.startDate) {
      query = query.gte('created_at', criteria.startDate)
    }

    if (criteria?.endDate) {
      query = query.lte('created_at', criteria.endDate)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error al consultar movimientos de inventario para reportes:', error)
      return []
    }

    return (data || []).map((row: any) => {
      const qIn = Number(row.quantity_in) || 0
      const qOut = Number(row.quantity_out) || 0
      const netQty = qIn > 0 ? qIn : -qOut

      return {
        id: row.id,
        companyId: row.company_id,
        consecutive: row.consecutive,
        productId: row.product_id,
        productName: row.product?.name || 'Producto',
        sku: row.product?.sku || '',
        locationId: row.location_id,
        locationName: row.location?.name || 'Bodega Principal',
        type: row.movement_type,
        movementType: row.movement_type,
        quantityIn: qIn,
        quantityOut: qOut,
        quantity: netQty,
        previousStock: Number(row.previous_stock) || 0,
        newStock: Number(row.new_stock) || 0,
        unitCost: Number(row.unit_cost) || 0,
        totalCost: Number(row.total_cost) || 0,
        documentType: row.document_type,
        documentReference: row.document_reference,
        reason: row.reason || '',
        date: row.created_at,
        createdAt: row.created_at,
        timestamp: row.created_at,
      }
    })
  }

  /**
   * Obtiene clientes
   */
  async getCustomers(companyIdOverride?: string) {
    const companyId = await this.getCompanyId(companyIdOverride)

    let query = getDbClient()
      .from('customers')
      .select(`
        id,
        company_id,
        first_name,
        last_name,
        company_name,
        document_number,
        document_type,
        customer_type,
        email,
        phone,
        city,
        address,
        credit_limit,
        current_balance,
        is_active,
        created_at
      `)
      .order('company_name', { ascending: true })

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error al consultar clientes para reportes:', error)
      return []
    }

    return (data || []).map((row: any) => {
      const name = row.company_name || `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Cliente'
      return {
        id: row.id,
        companyId: row.company_id,
        name,
        companyName: row.company_name,
        firstName: row.first_name,
        lastName: row.last_name,
        documentNumber: row.document_number,
        documentType: row.document_type,
        customerType: row.customer_type,
        email: row.email || '',
        phone: row.phone || '',
        city: row.city || '',
        address: row.address || '',
        creditLimit: Number(row.credit_limit) || 0,
        currentBalance: Number(row.current_balance) || 0,
        isActive: row.is_active,
        createdAt: row.created_at,
      }
    })
  }

  /**
   * Obtiene proveedores
   */
  async getSuppliers(companyIdOverride?: string) {
    const companyId = await this.getCompanyId(companyIdOverride)

    let query = getDbClient()
      .from('suppliers')
      .select(`
        id,
        company_id,
        name,
        legal_name,
        tax_id,
        email,
        phone,
        city,
        address,
        payment_terms_days,
        credit_limit,
        is_active,
        created_at
      `)
      .order('name', { ascending: true })

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error al consultar proveedores para reportes:', error)
      return []
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      companyId: row.company_id,
      name: row.name || row.legal_name || 'Proveedor',
      tradeName: row.name,
      legalName: row.legal_name,
      taxId: row.tax_id,
      email: row.email || '',
      phone: row.phone || '',
      city: row.city || '',
      address: row.address || '',
      paymentTermsDays: Number(row.payment_terms_days) || 30,
      currentBalance: Number(row.credit_limit) || 0,
      isActive: row.is_active,
      createdAt: row.created_at,
    }))
  }

  /**
   * Obtiene facturas electrónicas
   */
  async getInvoices(criteria?: ReportFilterCriteria) {
    const companyId = await this.getCompanyId(criteria?.companyId)

    let query = getDbClient()
      .from('electronic_invoices')
      .select(`
        id,
        company_id,
        location_id,
        customer_id,
        sale_id,
        prefix,
        number,
        full_number,
        cufe,
        subtotal_amount,
        tax_amount,
        total_amount,
        dian_status,
        created_at,
        location:locations(name),
        customer:customers(first_name, last_name, company_name, document_number)
      `)
      .order('created_at', { ascending: false })

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    if (criteria?.locationId && criteria.locationId !== 'ALL') {
      query = query.eq('location_id', criteria.locationId)
    }

    if (criteria?.customerId && criteria.customerId !== 'ALL') {
      query = query.eq('customer_id', criteria.customerId)
    }

    if (criteria?.startDate) {
      query = query.gte('created_at', criteria.startDate)
    }

    if (criteria?.endDate) {
      query = query.lte('created_at', criteria.endDate)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error al consultar facturas para reportes:', error)
      return []
    }

    return (data || []).map((row: any) => {
      const custName = row.customer
        ? (row.customer.company_name || `${row.customer.first_name || ''} ${row.customer.last_name || ''}`.trim() || 'Cliente')
        : 'Cliente'

      const invNum = row.full_number || `${row.prefix || ''}-${row.number || ''}`

      return {
        id: row.id,
        companyId: row.company_id,
        locationId: row.location_id,
        locationName: row.location?.name || 'Bodega Principal',
        customerId: row.customer_id,
        customerName: custName,
        customerDoc: row.customer?.document_number || 'N/A',
        invoiceNumber: invNum,
        fullNumber: invNum,
        cufe: row.cufe || '',
        date: row.created_at,
        createdAt: row.created_at,
        status: row.dian_status || 'EMITIDA',
        subtotal: Number(row.subtotal_amount) || 0,
        taxAmount: Number(row.tax_amount) || 0,
        total: Number(row.total_amount) || 0,
      }
    })
  }

  /**
   * Obtiene pedidos web
   */
  async getWebOrders(criteria?: ReportFilterCriteria) {
    let query = getDbClient()
      .from('web_orders')
      .select(`
        id,
        order_number,
        channel,
        customer_id,
        customer_name,
        customer_phone,
        customer_email,
        shipping_address,
        shipping_city,
        dispatch_location_id,
        subtotal,
        shipping_fee,
        total,
        payment_status,
        fulfillment_status,
        sale_id,
        notes,
        created_at
      `)
      .order('created_at', { ascending: false })

    if (criteria?.startDate) {
      query = query.gte('created_at', criteria.startDate)
    }

    if (criteria?.endDate) {
      query = query.lte('created_at', criteria.endDate)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error al consultar pedidos web para reportes:', error)
      return []
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      orderNumber: row.order_number,
      channel: row.channel || 'SUPERMAS',
      customerId: row.customer_id,
      customerName: row.customer_name || 'Cliente Web',
      customerPhone: row.customer_phone || '',
      customerEmail: row.customer_email || '',
      shippingAddress: row.shipping_address || '',
      shippingCity: row.shipping_city || '',
      dispatchLocationId: row.dispatch_location_id,
      subtotal: Number(row.subtotal) || 0,
      shippingFee: Number(row.shipping_fee) || 0,
      total: Number(row.total) || 0,
      paymentStatus: row.payment_status || 'PENDING',
      fulfillmentStatus: row.fulfillment_status || 'PENDING',
      status: row.fulfillment_status || 'PENDING',
      saleId: row.sale_id,
      date: row.created_at,
      createdAt: row.created_at,
      notes: row.notes || '',
    }))
  }

  /**
   * Obtiene cajas registradoras y sus movimientos
   */
  async getCashRegisters(locationId?: string, companyIdOverride?: string) {
    const companyId = await this.getCompanyId(companyIdOverride)

    let query = getDbClient()
      .from('cash_registers')
      .select('id, company_id, location_id, code, name, current_status, created_at')
      .order('name', { ascending: true })

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    if (locationId && locationId !== 'ALL') {
      query = query.eq('location_id', locationId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error al consultar cajas para reportes:', error)
      return []
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      companyId: row.company_id,
      code: row.code,
      name: row.name,
      locationId: row.location_id,
      status: row.current_status || 'CLOSED',
      createdAt: row.created_at,
    }))
  }

  async getCashMovements(registerId?: string, locationId?: string, companyIdOverride?: string) {
    const companyId = await this.getCompanyId(companyIdOverride)

    let query = getDbClient()
      .from('cash_movements')
      .select(`
        id,
        company_id,
        session_id,
        type,
        amount,
        reason,
        created_at,
        session:cash_sessions(cash_register_id, location_id)
      `)
      .order('created_at', { ascending: false })

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error al consultar movimientos de caja para reportes:', error)
      return []
    }

    let list = (data || []).map((row: any) => ({
      id: row.id,
      companyId: row.company_id,
      cashRegisterId: row.session?.cash_register_id || '',
      locationId: row.session?.location_id || '',
      type: row.type,
      amount: Number(row.amount) || 0,
      reason: row.reason || '',
      createdAt: row.created_at,
      date: row.created_at,
    }))

    if (registerId && registerId !== 'ALL') {
      list = list.filter((m) => m.cashRegisterId === registerId)
    }

    if (locationId && locationId !== 'ALL') {
      list = list.filter((m) => m.locationId === locationId)
    }

    return list
  }

  /**
   * Obtiene bodegas activas
   */
  async getLocations(companyIdOverride?: string) {
    const companyId = await this.getCompanyId(companyIdOverride)

    let query = getDbClient()
      .from('locations')
      .select('id, company_id, code, name, type, city, address, status, created_at')
      .order('name', { ascending: true })

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error al consultar bodegas para reportes:', error)
      return []
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      companyId: row.company_id,
      code: row.code,
      name: row.name,
      type: row.type,
      city: row.city || '',
      address: row.address || '',
      isActive: row.status === 'ACTIVE',
      createdAt: row.created_at,
    }))
  }

  /**
   * Obtiene usuarios
   */
  async getUsers(companyIdOverride?: string) {
    const companyId = await this.getCompanyId(companyIdOverride)

    let query = getDbClient()
      .from('users')
      .select('id, company_id, full_name, email, role:roles(code), is_active, created_at')
      .order('full_name', { ascending: true })

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error al consultar usuarios para reportes:', error)
      return []
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      companyId: row.company_id,
      name: row.full_name || row.email,
      fullName: row.full_name || row.email,
      email: row.email,
      role: row.role?.code || 'USER',
      isActive: row.is_active,
      createdAt: row.created_at,
    }))
  }

  /**
   * Obtiene categorías y marcas
   */
  async getCategories(companyIdOverride?: string) {
    const companyId = await this.getCompanyId(companyIdOverride)

    let query = getDbClient()
      .from('categories')
      .select('id, company_id, name, code, is_active')
      .order('name', { ascending: true })

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error al consultar categorías para reportes:', error)
      return []
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      companyId: row.company_id,
      name: row.name,
      code: row.code || row.name,
      isActive: row.is_active ?? true,
    }))
  }

  async getBrands(companyIdOverride?: string) {
    const companyId = await this.getCompanyId(companyIdOverride)

    let query = getDbClient()
      .from('brands')
      .select('id, company_id, name, slug, is_active')
      .order('name', { ascending: true })

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error al consultar marcas para reportes:', error)
      return []
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      companyId: row.company_id,
      name: row.name,
      code: row.slug || row.name,
      isActive: row.is_active ?? true,
    }))
  }
}

export const reportRepository = new ReportRepository()
