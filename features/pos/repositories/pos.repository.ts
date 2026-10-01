import { supabaseClient } from '@/lib/supabase/client'
import {
  POSProduct,
  POSCustomer,
  POSDailySaleSummary,
  POSTicketReceipt,
  POSPaymentMethod,
} from '../types'

function mapPaymentMethodToDb(pm: POSPaymentMethod): 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'CREDIT' | 'MIXED' {
  switch (pm) {
    case 'EFECTIVO':
      return 'CASH'
    case 'TARJETA':
      return 'CREDIT_CARD'
    case 'TRANSFERENCIA':
      return 'BANK_TRANSFER'
    case 'MIXTO':
      return 'MIXED'
    default:
      return 'CASH'
  }
}

function mapPaymentMethodFromDb(dbPm: string): POSPaymentMethod {
  switch (dbPm) {
    case 'CASH':
      return 'EFECTIVO'
    case 'CREDIT_CARD':
    case 'DEBIT_CARD':
      return 'TARJETA'
    case 'BANK_TRANSFER':
      return 'TRANSFERENCIA'
    case 'MIXED':
      return 'MIXTO'
    default:
      return 'EFECTIVO'
  }
}

export class POSRepository {
  /**
   * Resuelve el company_id del usuario autenticado actual bajo RLS
   */
  private async resolveCompanyId(): Promise<string> {
    const { data: authUser } = await supabaseClient.auth.getUser()
    if (authUser.user) {
      const { data: userRow } = await supabaseClient
        .from('users')
        .select('company_id')
        .eq('id', authUser.user.id)
        .maybeSingle()
      if (userRow?.company_id) return userRow.company_id
    }
    const { data: comp } = await supabaseClient
      .from('companies')
      .select('id')
      .limit(1)
      .single()
    if (comp?.id) return comp.id
    throw new Error('No se pudo resolver la empresa asociada para POS.')
  }

  /**
   * Resuelve el seller_user_id válido en public.users
   */
  private async resolveUserId(preferredUserId?: string): Promise<string> {
    if (preferredUserId && preferredUserId.length === 36) {
      const { data } = await supabaseClient
        .from('users')
        .select('id')
        .eq('id', preferredUserId)
        .maybeSingle()
      if (data?.id) return data.id
    }

    const { data: authUser } = await supabaseClient.auth.getUser()
    if (authUser.user?.id) return authUser.user.id

    const { data: firstUser } = await supabaseClient
      .from('users')
      .select('id')
      .limit(1)
      .single()
    if (firstUser?.id) return firstUser.id

    throw new Error('No se encontró un usuario válido para asociar como vendedor.')
  }

  /**
   * Obtiene productos seguros para POS (sin costos ni proveedores) filtrados por bodega real
   */
  async getProductsForLocation(
    locationId: string,
    query?: string,
    category?: string
  ): Promise<POSProduct[]> {
    // 1. Obtener productos activos desde public.products
    let prodQuery = supabaseClient
      .from('products')
      .select(`
        id,
        sku,
        barcode,
        name,
        unit_of_measure,
        public_sale_price,
        wholesale_price,
        primary_image_url,
        is_active,
        tax_rate_percent,
        is_tax_exempt,
        categories ( name )
      `)
      .eq('is_active', true)

    if (category && category !== 'ALL') {
      prodQuery = prodQuery.ilike('categories.name', category)
    }

    const { data: rawProducts, error: prodErr } = await prodQuery
    if (prodErr || !rawProducts) {
      console.error('Error al consultar productos para POS:', prodErr)
      return []
    }

    // 2. Obtener niveles de stock reales para esta bodega
    const { data: rawStock, error: stockErr } = await supabaseClient
      .from('stock_levels')
      .select('product_id, quantity, reserved_quantity')
      .eq('location_id', locationId)

    if (stockErr) {
      console.error('Error al consultar stock_levels para POS:', stockErr)
    }

    const stockMap = new Map<string, number>()
    if (rawStock) {
      for (const s of rawStock) {
        const available = Math.max(0, Number(s.quantity || 0) - Number(s.reserved_quantity || 0))
        stockMap.set(s.product_id, available)
      }
    }

    const q = query ? query.toLowerCase().trim() : ''

    const filtered = (rawProducts as any[])
      .filter((p) => {
        if (q) {
          const matchName = p.name?.toLowerCase().includes(q)
          const matchSku = p.sku?.toLowerCase().includes(q)
          const matchBarcode = p.barcode ? p.barcode.toLowerCase().includes(q) : false
          if (!matchName && !matchSku && !matchBarcode) return false
        }
        return true
      })
      .map((p) => {
        const availableStock = stockMap.get(p.id) || 0
        const taxRate = p.is_tax_exempt ? 0 : Number(p.tax_rate_percent || 19)
        const isExempt = Boolean(p.is_tax_exempt || taxRate === 0)

        const sanitized: POSProduct = {
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode || '',
          category: p.categories?.name || 'General',
          unitOfMeasure: p.unit_of_measure || 'UND',
          imageUrl: p.primary_image_url || '',
          normalPrice: Number(p.public_sale_price || 0),
          wholesalePrice: p.wholesale_price ? Number(p.wholesale_price) : undefined,
          availableStock,
          vatRatePercent: taxRate,
          isExempt,
          status: p.is_active ? 'ACTIVE' : 'INACTIVE',
        }
        return sanitized
      })

    return filtered
  }

  /**
   * Búsqueda por código de barras o SKU exacto para lector óptico
   */
  async findByBarcodeOrSku(code: string, locationId: string): Promise<POSProduct | null> {
    const clean = code.trim().toLowerCase()
    if (!clean) return null

    const products = await this.getProductsForLocation(locationId)
    return (
      products.find(
        (p) => p.barcode.toLowerCase() === clean || p.sku.toLowerCase() === clean
      ) || null
    )
  }

  /**
   * Obtiene o busca clientes para el POS desde public.customers
   */
  async searchCustomers(query?: string): Promise<POSCustomer[]> {
    let qBuilder = supabaseClient
      .from('customers')
      .select('id, first_name, last_name, company_name, document_type, document_number, phone, email, address, customer_category, credit_limit, current_balance, is_active')
      .eq('is_active', true)
      .limit(20)

    if (query && query.trim() !== '') {
      const q = query.trim()
      qBuilder = qBuilder.or(`document_number.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,company_name.ilike.%${q}%,phone.ilike.%${q}%`)
    }

    const { data, error } = await qBuilder

    if (error || !data) {
      console.error('Error al consultar clientes en PostgreSQL:', error)
      return []
    }

    return data.map((c: any) => {
      const displayName = c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Cliente'
      const priceList = c.customer_category === 'WHOLESALE' ? 'WHOLESALE' : c.customer_category === 'VIP' ? 'VIP' : 'DEFAULT'
      return {
        id: c.id,
        displayName,
        documentNumber: c.document_number,
        documentType: c.document_type || 'CC',
        phone: c.phone || '',
        email: c.email || undefined,
        address: c.address || undefined,
        priceList,
        creditLimit: Number(c.credit_limit || 0),
        currentBalance: Number(c.current_balance || 0),
      }
    })
  }

  /**
   * Obtiene el cliente genérico institucional "Consumidor Final" (NIT/CC: 222222222222)
   */
  async getGenericCustomer(): Promise<POSCustomer> {
    const { data } = await supabaseClient
      .from('customers')
      .select('id, first_name, last_name, company_name, document_type, document_number, phone, email, address, credit_limit, current_balance')
      .eq('document_number', '222222222222')
      .maybeSingle()

    if (data) {
      return {
        id: data.id,
        displayName: data.company_name || 'Consumidor Final',
        documentNumber: data.document_number,
        documentType: data.document_type || 'CC',
        phone: data.phone || '+57 000 000 0000',
        priceList: 'DEFAULT',
        creditLimit: Number(data.credit_limit || 0),
        currentBalance: Number(data.current_balance || 0),
      }
    }

    // Si aún no existe el registro en la BD, crearlo bajo RLS de la empresa
    const companyId = await this.resolveCompanyId()
    const { data: created, error } = await supabaseClient
      .from('customers')
      .insert({
        company_id: companyId,
        document_type: 'CC',
        document_number: '222222222222',
        first_name: 'Consumidor',
        last_name: 'Final',
        company_name: 'Consumidor Final',
        customer_type: 'INDIVIDUAL',
        customer_category: 'RETAIL',
        phone: '+57 000 000 0000',
        city: 'Medellín',
        department: 'Antioquia',
        is_active: true,
      })
      .select()
      .maybeSingle()

    if (created) {
      return {
        id: created.id,
        displayName: 'Consumidor Final',
        documentNumber: '222222222222',
        documentType: 'CC',
        phone: '+57 000 000 0000',
        priceList: 'DEFAULT',
        creditLimit: 0,
        currentBalance: 0,
      }
    }

    return {
      id: '22222222-2222-2222-2222-222222222222',
      displayName: 'Consumidor Final',
      documentNumber: '222222222222',
      documentType: 'CC',
      phone: '+57 000 000 0000',
      priceList: 'DEFAULT',
      creditLimit: 0,
      currentBalance: 0,
    }
  }

  /**
   * Obtiene la sesión activa de caja (cash_sessions) para la ubicación o caja
   */
  async getActiveSession(registerId?: string, locationId?: string): Promise<any | null> {
    let query = supabaseClient
      .from('cash_sessions')
      .select(`
        id,
        cash_register_id,
        user_id,
        status,
        opening_time,
        opening_float,
        cash_registers ( id, code, name, location_id )
      `)
      .eq('status', 'OPEN')

    if (registerId) {
      query = query.eq('cash_register_id', registerId)
    }

    const { data, error } = await query

    if (error || !data || data.length === 0) return null

    if (locationId) {
      const match = data.find((s: any) => s.cash_registers?.location_id === locationId)
      return match || data[0]
    }

    return data[0]
  }

  /**
   * Registra la transacción completa de venta POS en PostgreSQL:
   * 1. Inserta en public.sales
   * 2. Inserta líneas en public.sale_items
   * 3. Registra SALE_OUT en public.inventory_movements -> PostgreSQL Trigger procesa stock_levels
   * 4. Si el pago es EFECTIVO y hay turno abierto, registra en public.cash_movements
   * 5. Registra auditoría en public.audit_logs
   */
  async executePOSSale(receipt: POSTicketReceipt, saleData: any): Promise<void> {
    const companyId = await this.resolveCompanyId()
    const sellerUserId = await this.resolveUserId(saleData.sellerId)

    // 1. Verificar sesión activa de caja
    const activeSession = await this.getActiveSession(undefined, receipt.locationId)
    const sessionId = activeSession?.id || null

    // 2. Calcular costo total de la venta a partir de las líneas
    let totalCostAmount = 0
    if (saleData.items) {
      for (const it of saleData.items) {
        totalCostAmount += (Number(it.unitCost || 0) * Number(it.quantity || 0))
      }
    }

    // 3. Insertar venta en public.sales
    const { data: createdSale, error: saleErr } = await supabaseClient
      .from('sales')
      .insert({
        company_id: companyId,
        location_id: receipt.locationId,
        customer_id: saleData.customerId,
        seller_user_id: sellerUserId,
        cash_session_id: sessionId,
        sale_number: receipt.saleNumber,
        subtotal_amount: receipt.subtotal,
        discount_amount: receipt.discountTotal,
        tax_amount: receipt.taxTotal,
        total_amount: receipt.totalAmount,
        total_cost_amount: totalCostAmount,
        payment_method: mapPaymentMethodToDb(receipt.paymentMethod),
        status: 'ISSUED',
        notes: saleData.notes || `Venta rápida POS ${receipt.saleNumber}`,
      })
      .select()
      .single()

    if (saleErr || !createdSale) {
      console.error('Error insertando venta en public.sales:', saleErr)
      throw new Error(`Error al procesar venta POS en base de datos: ${saleErr?.message}`)
    }

    // 4. Insertar líneas en public.sale_items
    const saleItemsPayload = (saleData.items || []).map((it: any) => ({
      company_id: companyId,
      sale_id: createdSale.id,
      product_id: it.productId,
      quantity: it.quantity,
      unit_cost: it.unitCost || 0,
      unit_price: it.unitPrice,
      discount_percent: it.discountPercent || 0,
      tax_rate_percent: it.taxRatePercent || 0,
      tax_amount: it.taxAmount || 0,
      subtotal: it.subtotal,
      total: it.total,
    }))

    if (saleItemsPayload.length > 0) {
      const { error: itemsErr } = await supabaseClient
        .from('sale_items')
        .insert(saleItemsPayload)

      if (itemsErr) {
        console.error('Error insertando líneas de venta:', itemsErr)
        throw new Error(`Error guardando detalles de la venta: ${itemsErr.message}`)
      }
    }

    // 5. Registrar movimientos SALE_OUT en public.inventory_movements
    // El trigger process_inventory_movement() descontará el stock y validará existencias.
    for (const item of saleData.items) {
      // Consultar existencias previas
      const { data: stockRow } = await supabaseClient
        .from('stock_levels')
        .select('quantity, average_cost')
        .eq('product_id', item.productId)
        .eq('location_id', receipt.locationId)
        .maybeSingle()

      const prevStock = stockRow ? Number(stockRow.quantity || 0) : 0
      const newStock = Math.max(0, prevStock - Number(item.quantity || 0))
      const unitCost = stockRow ? Number(stockRow.average_cost || 0) : Number(item.unitCost || 0)

      const { error: movErr } = await supabaseClient
        .from('inventory_movements')
        .insert({
          company_id: companyId,
          product_id: item.productId,
          location_id: receipt.locationId,
          movement_type: 'SALE_OUT',
          quantity_in: 0,
          quantity_out: item.quantity,
          previous_stock: prevStock,
          new_stock: newStock,
          unit_cost: unitCost,
          total_cost: Number(item.quantity) * unitCost,
          document_type: 'POS_SALE',
          document_reference: receipt.saleNumber,
          reason: `Venta POS mostrador ${receipt.saleNumber}`,
          user_id: sellerUserId,
        })

      if (movErr) {
        console.error('Error registrando salida de inventario por venta:', movErr)
        throw new Error(`Error actualizando Kardex por venta: ${movErr.message}`)
      }
    }

    // 6. Si el pago es en efectivo y hay caja abierta, registrar movimiento en public.cash_movements
    if (receipt.paymentMethod === 'EFECTIVO' && sessionId) {
      await supabaseClient
        .from('cash_movements')
        .insert({
          session_id: sessionId,
          type: 'SALE_CASH',
          amount: receipt.totalAmount,
          reason: `Ingreso por venta POS ${receipt.saleNumber}`,
          authorized_by_user_id: sellerUserId,
        })
    }

    // 7. Registro de auditoría en public.audit_logs
    await supabaseClient
      .from('audit_logs')
      .insert({
        company_id: companyId,
        user_id: sellerUserId,
        entity_name: 'sales',
        entity_id: createdSale.id,
        action: 'POS_SALE_COMPLETED',
        new_value: {
          saleNumber: receipt.saleNumber,
          totalAmount: receipt.totalAmount,
          paymentMethod: receipt.paymentMethod,
          itemsCount: receipt.itemsCount,
        },
      })
  }

  /**
   * Obtiene el listado de ventas del día para el cajero desde public.sales
   */
  async getDailySalesForUser(
    cashierName: string,
    locationId: string
  ): Promise<POSDailySaleSummary[]> {
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0).toISOString()

    const { data: sales, error } = await supabaseClient
      .from('sales')
      .select(`
        id,
        sale_number,
        total_amount,
        payment_method,
        status,
        created_at,
        customers ( first_name, last_name, company_name ),
        users ( full_name ),
        sale_items ( id )
      `)
      .eq('location_id', locationId)
      .gte('created_at', todayStart)
      .order('created_at', { ascending: false })

    if (error || !sales) {
      return []
    }

    return sales.map((s: any) => {
      const cust = s.customers || {}
      const customerName = cust.company_name || `${cust.first_name || ''} ${cust.last_name || ''}`.trim() || 'Consumidor Final'
      const cashier = s.users?.full_name || cashierName

      return {
        id: s.id,
        saleId: s.id,
        saleNumber: s.sale_number,
        invoiceNumber: `POS-${s.sale_number.slice(-4)}`,
        time: new Date(s.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        customerName,
        cashierName: cashier,
        itemsCount: (s.sale_items as any[])?.length || 1,
        totalAmount: Number(s.total_amount || 0),
        paymentMethod: mapPaymentMethodFromDb(s.payment_method),
        status: s.status,
      }
    })
  }

  /**
   * Obtiene sesiones de turnos de caja con filtros reales
   */
  async getSessions(filter?: { locationId?: string; registerId?: string }): Promise<any[]> {
    let query = supabaseClient
      .from('cash_sessions')
      .select(`
        id,
        cash_register_id,
        user_id,
        status,
        opening_time,
        closing_time,
        opening_float,
        cash_registers ( id, code, name, location_id )
      `)
      .order('opening_time', { ascending: false })

    if (filter?.registerId) {
      query = query.eq('cash_register_id', filter.registerId)
    }

    const { data, error } = await query
    if (error || !data) return []

    if (filter?.locationId && filter.locationId !== 'ALL') {
      return data.filter((s: any) => s.cash_registers?.location_id === filter.locationId)
    }

    return data
  }
}

export const posRepository = new POSRepository()
