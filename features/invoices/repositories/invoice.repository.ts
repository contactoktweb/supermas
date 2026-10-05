import { supabaseClient } from '@/lib/supabase/client'
import { resolveUserCompanyId } from '@/lib/supabase/tenant'
import {
  Invoice,
  InvoiceItem,
  InvoiceFilters,
  InvoiceStats,
  DIANTransmissionLog,
  DIANStatus,
  InvoicePaymentMethod,
} from '../types'

function mapDbDianStatusToDomain(status?: string): DIANStatus {
  switch (status) {
    case 'ACCEPTED':
    case 'VALIDADA_DIAN':
      return 'ACEPTADA'
    case 'REJECTED':
      return 'RECHAZADA'
    case 'PENDING':
      return 'PENDIENTE'
    default:
      return 'PENDIENTE'
  }
}

function mapDomainDianStatusToDb(status: DIANStatus): string {
  switch (status) {
    case 'ACEPTADA':
    case 'VALIDADA_DIAN':
      return 'ACCEPTED'
    case 'RECHAZADA':
      return 'REJECTED'
    case 'PENDIENTE':
      return 'PENDING'
    default:
      return 'PENDING'
  }
}

export class InvoiceRepository {
  /**
   * Resuelve el company_id del usuario autenticado actual bajo RLS de forma estricta
   */
  private async resolveCompanyId(): Promise<string> {
    return resolveUserCompanyId(supabaseClient)
  }

  /**
   * Mapea un registro de public.electronic_invoices a la entidad de dominio Invoice
   */
  private mapDbRowToInvoice(raw: any): Invoice {
    const cust = raw.customers || {}
    const loc = raw.locations || {}
    const sale = raw.sales || {}

    const subtotal = Number(raw.subtotal_amount || 0)
    const taxTotal = Number(raw.tax_amount || 0)
    const total = Number(raw.total_amount || subtotal + taxTotal)

    const dianStatus = mapDbDianStatusToDomain(raw.dian_status)
    const prefix = raw.prefix || 'FE'
    const num = raw.number || 1
    const invoiceNumber = raw.full_number || `${prefix}-${num}`
    const internalNumber = `FAC-${String(num).padStart(5, '0')}`

    const customerName = cust.company_name || `${cust.first_name || ''} ${cust.last_name || ''}`.trim() || 'Consumidor Final'
    const customerDoc = cust.document_number || '222222222222'

    return {
      id: raw.id,
      internalNumber,
      dianPrefix: prefix,
      dianNumber: Number(num),
      dianResolution: '18764000001',
      dianResolutionDate: '2026-01-15',
      dianRange: '1 - 100000',
      invoiceNumber,
      prefix,
      resolutionNumber: '18764000001',
      resolutionDate: '2026-01-15',
      type: raw.document_type === 'CREDIT_NOTE' ? 'NOTA_CREDITO' : raw.document_type === 'DEBIT_NOTE' ? 'NOTA_DEBITO' : 'ELECTRONICA',
      status: 'PAID',
      dianStatus,
      dianCufe: raw.cufe || undefined,
      dianQrCode: raw.qr_code_data || (raw.cufe ? `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${raw.cufe}` : undefined),
      dianXmlUrl: raw.xml_signed_url || undefined,
      dianPdfUrl: raw.pdf_url || undefined,
      saleId: raw.sale_id,
      saleNumber: sale.sale_number,
      customerId: raw.customer_id,
      customerName,
      customerDoc,
      customerDocType: cust.document_type || 'CC',
      customerEmail: cust.email || undefined,
      customerPhone: cust.phone || undefined,
      customerAddress: cust.address || undefined,
      customerCity: cust.city || 'Medellín',
      locationId: raw.location_id,
      locationName: loc.name || 'Bodega Principal',
      sellerId: sale.seller_user_id || '',
      sellerName: 'Vendedor',
      date: raw.created_at,
      dueDate: raw.created_at,
      issuedAtBogota: new Date(raw.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      items: [],
      itemsCount: 1,
      totalUnits: 1,
      subtotal,
      discountTotal: 0,
      taxTotal,
      taxesBreakdown: [
        {
          taxCode: 'IVA_19',
          taxName: 'IVA General 19%',
          ratePercent: 19,
          taxableBase: subtotal,
          taxAmount: taxTotal,
        },
      ],
      total,
      pendingBalance: 0,
      paymentMethod: (sale.payment_method === 'CASH' ? 'EFECTIVO' : sale.payment_method === 'CREDIT' ? 'CREDITO' : 'TRANSFERENCIA') as InvoicePaymentMethod,
      paymentTerms: 'Contado',
      transmissionHistory: [
        {
          id: `log-${raw.id.slice(0, 6)}`,
          timestamp: raw.created_at,
          user: 'Sistema DIAN',
          action: 'ENVIO_INICIAL',
          status: dianStatus === 'ACEPTADA' ? 'EXITOSO' : dianStatus === 'RECHAZADA' ? 'RECHAZADO' : 'EXITOSO',
          dianStatus,
          message: raw.dian_response_message || 'Documento registrado para validación DIAN.',
          cufe: raw.cufe || undefined,
        },
      ],
      createdAt: raw.created_at,
      updatedAt: raw.updated_at || raw.created_at,
    }
  }

  /**
   * Obtiene lista de facturas electrónicas desde public.electronic_invoices
   */
  async findAll(filters: InvoiceFilters = {}): Promise<{
    data: Invoice[]
    total: number
    page: number
    pageSize: number
  }> {
    let query = supabaseClient
      .from('electronic_invoices')
      .select(`
        id,
        prefix,
        number,
        full_number,
        document_type,
        cufe,
        qr_code_data,
        xml_signed_url,
        pdf_url,
        subtotal_amount,
        tax_amount,
        total_amount,
        dian_status,
        dian_response_message,
        created_at,
        updated_at,
        sale_id,
        customer_id,
        location_id,
        customers (
          id,
          first_name,
          last_name,
          company_name,
          document_type,
          document_number,
          email,
          phone,
          address,
          city
        ),
        locations (
          id,
          name,
          code
        ),
        sales (
          id,
          sale_number,
          payment_method,
          status,
          seller_user_id
        )
      `, { count: 'exact' })

    if (filters.locationId && filters.locationId !== 'ALL') {
      query = query.eq('location_id', filters.locationId)
    }

    if (filters.customerId && filters.customerId !== 'ALL') {
      query = query.eq('customer_id', filters.customerId)
    }

    if (filters.dianStatus && filters.dianStatus !== 'ALL') {
      const dbDian = mapDomainDianStatusToDb(filters.dianStatus)
      query = query.eq('dian_status', dbDian)
    }

    if (filters.dateFrom) {
      query = query.gte('created_at', filters.dateFrom)
    }
    if (filters.dateTo) {
      query = query.lte('created_at', `${filters.dateTo}T23:59:59.999Z`)
    }

    query = query.order('created_at', { ascending: false })

    const { data: rawRows, count, error } = await query

    if (error || !rawRows) {
      console.error('Error al consultar facturas electrónicas en PostgreSQL:', error)
      return { data: [], total: 0, page: 1, pageSize: 10 }
    }

    let items: Invoice[] = rawRows.map((r) => this.mapDbRowToInvoice(r))

    if (filters.query?.trim()) {
      const q = filters.query.toLowerCase().trim()
      items = items.filter(
        (i) =>
          i.invoiceNumber.toLowerCase().includes(q) ||
          i.customerName.toLowerCase().includes(q) ||
          i.customerDoc.includes(q) ||
          (i.dianCufe && i.dianCufe.toLowerCase().includes(q))
      )
    }

    const total = count !== null ? count : items.length
    const page = filters.page || 1
    const pageSize = filters.pageSize || 10
    const start = (page - 1) * pageSize
    const paginated = items.slice(start, start + pageSize)

    return {
      data: paginated,
      total: items.length,
      page,
      pageSize,
    }
  }

  /**
   * Obtiene factura por ID
   */
  async findById(id: string): Promise<Invoice | null> {
    const { data, error } = await supabaseClient
      .from('electronic_invoices')
      .select(`
        id,
        prefix,
        number,
        full_number,
        document_type,
        cufe,
        qr_code_data,
        xml_signed_url,
        pdf_url,
        subtotal_amount,
        tax_amount,
        total_amount,
        dian_status,
        dian_response_message,
        created_at,
        updated_at,
        sale_id,
        customer_id,
        location_id,
        customers (
          id,
          first_name,
          last_name,
          company_name,
          document_type,
          document_number,
          email,
          phone,
          address,
          city
        ),
        locations (
          id,
          name,
          code
        ),
        sales (
          id,
          sale_number,
          payment_method,
          status,
          seller_user_id
        )
      `)
      .eq('id', id)
      .maybeSingle()

    if (error || !data) return null
    return this.mapDbRowToInvoice(data)
  }

  /**
   * Obtiene factura por ID de Venta relacionada
   */
  async findBySaleId(saleId: string): Promise<Invoice | null> {
    const { data, error } = await supabaseClient
      .from('electronic_invoices')
      .select(`
        id,
        prefix,
        number,
        full_number,
        document_type,
        cufe,
        qr_code_data,
        xml_signed_url,
        pdf_url,
        subtotal_amount,
        tax_amount,
        total_amount,
        dian_status,
        dian_response_message,
        created_at,
        updated_at,
        sale_id,
        customer_id,
        location_id,
        customers (
          id,
          first_name,
          last_name,
          company_name,
          document_type,
          document_number,
          email,
          phone,
          address,
          city
        ),
        locations (
          id,
          name,
          code
        ),
        sales (
          id,
          sale_number,
          payment_method,
          status,
          seller_user_id
        )
      `)
      .eq('sale_id', saleId)
      .maybeSingle()

    if (error || !data) return null
    return this.mapDbRowToInvoice(data)
  }

  /**
   * Calcula estadísticas clave del módulo de facturación desde PostgreSQL
   */
  async getStats(): Promise<InvoiceStats> {
    const { data, error } = await supabaseClient
      .from('electronic_invoices')
      .select('total_amount, document_type, dian_status')

    if (error || !data) {
      return {
        totalGenerated: 0,
        electronicSent: 0,
        pendingDIAN: 0,
        rejectedDIAN: 0,
        cancelledCount: 0,
        totalAmountBilled: 0,
        creditNotesCount: 0,
        creditNotesTotal: 0,
        currency: 'COP',
      }
    }

    let totalGenerated = 0
    let electronicSent = 0
    let pendingDIAN = 0
    let rejectedDIAN = 0
    let cancelledCount = 0
    let totalAmountBilled = 0
    let creditNotesCount = 0
    let creditNotesTotal = 0

    for (const inv of data) {
      const tot = Number(inv.total_amount || 0)
      if (inv.document_type === 'CREDIT_NOTE') {
        creditNotesCount++
        creditNotesTotal += tot
        continue
      }

      totalGenerated++
      totalAmountBilled += tot

      if (inv.dian_status === 'ACCEPTED') {
        electronicSent++
      } else if (inv.dian_status === 'PENDING') {
        pendingDIAN++
      } else if (inv.dian_status === 'RECHAZADA') {
        rejectedDIAN++
      }
    }

    return {
      totalGenerated,
      electronicSent,
      pendingDIAN,
      rejectedDIAN,
      cancelledCount,
      totalAmountBilled,
      creditNotesCount,
      creditNotesTotal,
      currency: 'COP',
    }
  }

  /**
   * Obtiene ventas pendientes de facturar desde public.sales
   */
  async getSalesPendingInvoicing(): Promise<any[]> {
    const { data: sales, error } = await supabaseClient
      .from('sales')
      .select(`
        id,
        sale_number,
        total_amount,
        created_at,
        customer_id,
        customers ( first_name, last_name, company_name )
      `)
      .neq('status', 'CANCELLED')
      .order('created_at', { ascending: false })

    if (error || !sales) return []

    // Obtener ids de ventas que ya tienen factura
    const { data: existingInvoices } = await supabaseClient
      .from('electronic_invoices')
      .select('sale_id')

    const invoicedSet = new Set((existingInvoices || []).map((i: any) => i.sale_id).filter(Boolean))

    return sales
      .filter((s) => !invoicedSet.has(s.id))
      .map((s: any) => {
        const cust = s.customers || {}
        return {
          id: s.id,
          saleNumber: s.sale_number,
          customerName: cust.company_name || `${cust.first_name || ''} ${cust.last_name || ''}`.trim() || 'Consumidor Final',
          total: Number(s.total_amount || 0),
          date: s.created_at,
        }
      })
  }

  /**
   * Crea una nueva factura electrónica en public.electronic_invoices
   */
  async create(invoice: Invoice, _user: string = 'Administrador'): Promise<Invoice> {
    const companyId = await this.resolveCompanyId()
    const prefix = invoice.dianPrefix || 'FE'

    const { data: lastInv } = await supabaseClient
      .from('electronic_invoices')
      .select('number')
      .eq('prefix', prefix)
      .order('number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextNumber = lastInv ? Number(lastInv.number) + 1 : 1
    const cufe = invoice.dianCufe || Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')

    const { data, error } = await supabaseClient
      .from('electronic_invoices')
      .insert({
        company_id: companyId,
        location_id: invoice.locationId,
        sale_id: invoice.saleId,
        customer_id: invoice.customerId,
        prefix,
        number: nextNumber,
        document_type: invoice.type === 'NOTA_CREDITO' ? 'CREDIT_NOTE' : invoice.type === 'NOTA_DEBITO' ? 'DEBIT_NOTE' : 'INVOICE',
        cufe,
        subtotal_amount: invoice.subtotal,
        tax_amount: invoice.taxTotal,
        total_amount: invoice.total,
        dian_status: mapDomainDianStatusToDb(invoice.dianStatus),
      })
      .select()
      .single()

    if (error || !data) {
      throw new Error(`Error creando factura electrónica: ${error?.message}`)
    }

    return (await this.findById(data.id))!
  }

  /**
   * Crea una Nota Crédito afectando factura e inventario si aplica
   */
  async createCreditNote(
    creditNote: Invoice,
    originalInvoiceId: string,
    adjustInventory: boolean = true,
    user: string = 'Administrador'
  ): Promise<Invoice> {
    const companyId = await this.resolveCompanyId()
    const prefix = 'NC'

    const { data: lastInv } = await supabaseClient
      .from('electronic_invoices')
      .select('number')
      .eq('prefix', prefix)
      .order('number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextNumber = lastInv ? Number(lastInv.number) + 1 : 1
    const cufe = Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')

    const { data, error } = await supabaseClient
      .from('electronic_invoices')
      .insert({
        company_id: companyId,
        location_id: creditNote.locationId,
        sale_id: creditNote.saleId,
        customer_id: creditNote.customerId,
        prefix,
        number: nextNumber,
        document_type: 'CREDIT_NOTE',
        cufe,
        subtotal_amount: creditNote.subtotal,
        tax_amount: creditNote.taxTotal,
        total_amount: creditNote.total,
        dian_status: 'PENDING',
      })
      .select()
      .single()

    if (error || !data) {
      throw new Error(`Error creando nota crédito: ${error?.message}`)
    }

    // Si se ajusta inventario, registrar reingreso en inventory_movements
    if (adjustInventory && creditNote.items && creditNote.items.length > 0) {
      for (const item of creditNote.items) {
        const { data: stockRow } = await supabaseClient
          .from('stock_levels')
          .select('quantity, average_cost')
          .eq('product_id', item.productId)
          .eq('location_id', creditNote.locationId)
          .maybeSingle()

        const prevStock = stockRow ? Number(stockRow.quantity || 0) : 0
        const newStock = prevStock + Number(item.quantity || 0)
        const unitCost = stockRow ? Number(stockRow.average_cost || 0) : (item.unitCost || item.unitPrice * 0.7)

        await supabaseClient.from('inventory_movements').insert({
          company_id: companyId,
          product_id: item.productId,
          location_id: creditNote.locationId,
          movement_type: 'CUSTOMER_RETURN',
          quantity_in: item.quantity,
          quantity_out: 0,
          previous_stock: prevStock,
          new_stock: newStock,
          unit_cost: unitCost,
          total_cost: Number(item.quantity) * unitCost,
          document_type: 'CREDIT_NOTE',
          document_reference: `${prefix}-${nextNumber}`,
          reason: `Reingreso por Nota Crédito a Factura ${originalInvoiceId}`,
          user_id: null,
        })
      }
    }

    return (await this.findById(data.id))!
  }

  /**
   * Anula una factura con registro de auditoría
   */
  async cancelInvoice(invoiceId: string, reason: string, user: string = 'Administrador'): Promise<Invoice> {
    const { data, error } = await supabaseClient
      .from('electronic_invoices')
      .update({
        dian_status: 'REJECTED',
        dian_response_message: `Anulada por usuario ${user}. Motivo: ${reason}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .select()
      .single()

    if (error || !data) {
      throw new Error(`Error al anular factura: ${error?.message}`)
    }

    return (await this.findById(data.id))!
  }

  /**
   * Registra intento o respuesta de transmisión ante la DIAN
   */
  async recordDIANAttempt(
    invoiceId: string,
    log: DIANTransmissionLog,
    newDianStatus: DIANStatus,
    cufe?: string
  ): Promise<Invoice> {
    const updates: any = {
      dian_status: mapDomainDianStatusToDb(newDianStatus),
      dian_response_message: log.message,
      dian_response_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    if (cufe) {
      updates.cufe = cufe
    }

    const { data, error } = await supabaseClient
      .from('electronic_invoices')
      .update(updates)
      .eq('id', invoiceId)
      .select()
      .single()

    if (error || !data) {
      throw new Error(`Error al actualizar estado DIAN: ${error?.message}`)
    }

    return (await this.findById(data.id))!
  }
}

export const invoiceRepository = new InvoiceRepository()
