import { CREDIT_NOTE_CONCEPTS, DEBIT_NOTE_CONCEPTS } from '../services/dian/dian-concepts'
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

/** Columnas de factura + relaciones. Incluye el snapshot de resolución y el estado real de transmisión DIAN. */
const INVOICE_SELECT = `
  id, prefix, number, full_number, document_type, cufe, qr_code_data, xml_signed_url, pdf_url,
  subtotal_amount, tax_amount, total_amount, dian_status, dian_status_code, dian_response_message, dian_response_date,
  dian_validation_errors, dian_track_id, transmission_state, last_error, environment,
  internal_number, dian_resolution, resolution_date, resolution_valid_from, resolution_valid_to,
  resolution_range_from, resolution_range_to, issue_date, issue_time, xml_file_name,
  original_invoice_id, note_concept_code, note_reason, return_id, created_at, updated_at, sale_id, customer_id, location_id,
  customers ( id, first_name, last_name, company_name, document_type, document_number, email, phone, address, city ),
  locations ( id, name, code ),
  sales ( id, sale_number, payment_method, status, seller_user_id, users ( full_name ) )
`

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

const EVENT_LABELS: Record<string, string> = {
  NUMBER_ASSIGNED: 'Consecutivo DIAN asignado',
  XML_BUILT: 'XML UBL 2.1, CUFE y QR generados',
  DIGITAL_SIGNATURE_APPLIED: 'Firma digital XAdES aplicada',
  DIAN_TRANSMISSION_ATTEMPT: 'Envío a la DIAN',
  DIAN_STATUS_QUERY: 'Consulta de estado en la DIAN',
  DIAN_RESPONSE_ACCEPTED: 'DIAN: documento aceptado',
  DIAN_RESPONSE_REJECTED: 'DIAN: documento rechazado',
  CONFIG_MISSING: 'Falta configuración DIAN en el servidor',
  CERTIFICATE_ERROR: 'Error con el certificado digital',
  VALIDATION_FAILED: 'Datos fiscales incompletos',
}

function describeEvent(e: any): string {
  const base = EVENT_LABELS[e.event_type] || e.event_type
  const r = e.response_received || {}
  const detail = r.statusMessage || r.message || r.fault || (Array.isArray(r.errors) && r.errors.length ? r.errors.join(' | ') : '') ||
    (Array.isArray(r.problems) ? r.problems.join(' | ') : '')
  return detail ? `${base}: ${detail}` : base
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
  private mapDbRowToInvoice(raw: any, items: InvoiceItem[] = []): Invoice {
    const cust = raw.customers || {}
    const loc = raw.locations || {}
    const sale = raw.sales || {}

    const subtotal = Number(raw.subtotal_amount || 0)
    const taxTotal = Number(raw.tax_amount || 0)
    const total = Number(raw.total_amount || subtotal + taxTotal)

    const dianStatus = mapDbDianStatusToDomain(raw.dian_status)
    const prefix = raw.prefix || ''
    const num = Number(raw.number || 0)
    // Número fiscal DIAN: prefijo + consecutivo sin separador (así va en el XML y en el CUFE)
    const invoiceNumber = `${prefix}${num}`

    const customerName = cust.company_name || `${cust.first_name || ''} ${cust.last_name || ''}`.trim() || 'Consumidor Final'
    const customerDoc = cust.document_number || '222222222222'
    const rangeFrom = raw.resolution_range_from != null ? Number(raw.resolution_range_from) : undefined
    const rangeTo = raw.resolution_range_to != null ? Number(raw.resolution_range_to) : undefined

    // Desglose de IVA real por tarifa / tratamiento (gravado, exento, excluido)
    const byCode = new Map<string, { rate: number; base: number; tax: number }>()
    for (const it of items) {
      const code = it.taxRatePercent > 0 ? `IVA_${it.taxRatePercent}` : it.taxCode || 'IVA_0'
      const cur = byCode.get(code) || { rate: it.taxRatePercent, base: 0, tax: 0 }
      cur.base += it.subtotal
      cur.tax += it.taxAmount
      byCode.set(code, cur)
    }
    const labelFor = (code: string, rate: number) =>
      code === 'EXCLUIDO' ? 'Excluido de IVA' : code === 'EXENTO' ? 'Exento de IVA (0%)' : `IVA ${rate}%`
    const taxesBreakdown = items.length
      ? [...byCode.entries()].sort((a, b) => b[1].rate - a[1].rate).map(([code, v]) => ({
          taxCode: code,
          taxName: labelFor(code, v.rate),
          ratePercent: v.rate,
          taxableBase: Math.round(v.base * 100) / 100,
          taxAmount: Math.round(v.tax * 100) / 100,
        }))
      : [{ taxCode: 'IVA', taxName: 'IVA', ratePercent: subtotal > 0 ? Math.round((taxTotal / subtotal) * 10000) / 100 : 0, taxableBase: subtotal, taxAmount: taxTotal }]

    const errors: string[] = Array.isArray(raw.dian_validation_errors) ? raw.dian_validation_errors.map(String) : []

    return {
      id: raw.id,
      internalNumber: raw.internal_number || sale.sale_number || '',
      dianPrefix: prefix,
      dianNumber: num,
      dianResolution: raw.dian_resolution || '',
      dianResolutionDate: raw.resolution_date || undefined,
      dianRange: rangeFrom !== undefined && rangeTo !== undefined ? `${rangeFrom} - ${rangeTo}` : undefined,
      invoiceNumber,
      prefix,
      resolutionNumber: raw.dian_resolution || undefined,
      resolutionDate: raw.resolution_date || undefined,
      resolutionValidFrom: raw.resolution_valid_from || undefined,
      resolutionValidTo: raw.resolution_valid_to || undefined,
      resolutionRangeFrom: rangeFrom,
      resolutionRangeTo: rangeTo,
      type: raw.document_type === 'CREDIT_NOTE' ? 'NOTA_CREDITO' : raw.document_type === 'DEBIT_NOTE' ? 'NOTA_DEBITO' : 'ELECTRONICA',
      status: 'ISSUED',
      dianStatus,
      dianCufe: raw.cufe || undefined,
      dianQrCode: raw.qr_code_data || undefined,
      dianXmlUrl: raw.xml_file_name ? `/api/dian/invoices/${raw.id}/xml` : undefined,
      dianPdfUrl: `/facturacion/representacion/${raw.id}`,
      environment: raw.environment || undefined,
      transmissionState: raw.transmission_state || 'PENDING',
      lastError: raw.last_error || undefined,
      dianValidationErrors: errors,
      dianTrackId: raw.dian_track_id || undefined,
      dianResponseMessage: raw.dian_response_message || undefined,
      dianResponseDate: raw.dian_response_date || undefined,
      hasXml: Boolean(raw.xml_file_name),
      issueDate: raw.issue_date || undefined,
      issueTime: raw.issue_time || undefined,
      saleId: raw.sale_id,
      saleNumber: sale.sale_number,
      originalInvoiceId: raw.original_invoice_id || undefined,
      noteConceptCode: raw.note_concept_code || undefined,
      noteConceptLabel: raw.note_concept_code
        ? (raw.document_type === 'CREDIT_NOTE' ? CREDIT_NOTE_CONCEPTS : DEBIT_NOTE_CONCEPTS)[String(raw.note_concept_code)]
        : undefined,
      noteReason: raw.note_reason || undefined,
      returnId: raw.return_id || undefined,
      customerId: raw.customer_id,
      customerName,
      customerDoc,
      customerDocType: cust.document_type || 'CC',
      customerEmail: cust.email || undefined,
      customerPhone: cust.phone || undefined,
      customerAddress: cust.address || undefined,
      customerCity: cust.city || undefined,
      locationId: raw.location_id,
      locationName: loc.name || '',
      sellerId: sale.seller_user_id || '',
      sellerName: sale.users?.full_name || '',
      date: raw.issue_date ? `${raw.issue_date}T${String(raw.issue_time || '00:00:00-05:00')}` : raw.created_at,
      dueDate: raw.created_at,
      issuedAtBogota: raw.issue_time ? String(raw.issue_time).slice(0, 5) : new Date(raw.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' }),
      items,
      itemsCount: items.length,
      totalUnits: items.reduce((s, it) => s + it.quantity, 0),
      subtotal,
      discountTotal: items.reduce((s, it) => s + it.discountAmount, 0),
      taxTotal,
      taxesBreakdown,
      total,
      pendingBalance: 0,
      paymentMethod: (sale.payment_method === 'CASH' ? 'EFECTIVO' : sale.payment_method === 'CREDIT' ? 'CREDITO' : sale.payment_method === 'MIXED' ? 'MIXTO' : sale.payment_method === 'BANK_TRANSFER' ? 'TRANSFERENCIA' : 'TARJETA') as InvoicePaymentMethod,
      paymentTerms: sale.payment_method === 'CREDIT' ? 'Crédito' : 'Contado',
      transmissionHistory: [],
      createdAt: raw.created_at,
      updatedAt: raw.updated_at || raw.created_at,
    }
  }

  /** Líneas reales de la venta asociada (para detalle y representación gráfica). */
  private async loadItems(saleId?: string): Promise<InvoiceItem[]> {
    if (!saleId) return []
    const { data } = await supabaseClient
      .from('sale_items')
      .select('id, product_id, quantity, unit_price, discount_percent, tax_rate_percent, tax_amount, subtotal, total, iva_treatment, created_at, products ( name, sku, barcode, unit_of_measure, iva_treatment )')
      .eq('sale_id', saleId)
      .order('created_at', { ascending: true })
    return (data || []).map((it: any) => {
      const gross = Number(it.quantity || 0) * Number(it.unit_price || 0)
      const net = Number(it.subtotal || 0)
      const rate = Number(it.tax_rate_percent || 0)
      return {
        id: it.id,
        productId: it.product_id,
        productName: it.products?.name || 'Producto',
        sku: it.products?.sku || '',
        barcode: it.products?.barcode || undefined,
        unitOfMeasure: it.products?.unit_of_measure || 'UND',
        quantity: Number(it.quantity || 0),
        unitPrice: Number(it.unit_price || 0),
        discountPercent: Number(it.discount_percent || 0),
        discountAmount: Math.max(0, Math.round((gross - net) * 100) / 100),
        taxCode: rate > 0 ? `IVA_${rate}` : (it.iva_treatment || it.products?.iva_treatment) === 'EXCLUIDO' ? 'EXCLUIDO' : (it.iva_treatment || it.products?.iva_treatment) === 'EXENTO' ? 'EXENTO' : 'IVA_0',
        taxRatePercent: rate,
        taxAmount: Number(it.tax_amount || 0),
        subtotal: net,
        total: Number(it.total || 0),
      }
    })
  }

  /** Devoluciones de clientes registradas sobre una venta (para ligarlas a una nota crédito). */
  async listReturnsForSale(saleId: string): Promise<Array<{ id: string; code: string; date: string; total: number; linked: boolean; status: string }>> {
    const { data } = await supabaseClient
      .from('returns')
      .select('id, code, created_at, total_amount, status')
      .eq('return_type', 'CUSTOMER_RETURN')
      .eq('source_document_type', 'SALE')
      .eq('source_document_id', saleId)
      .order('created_at', { ascending: false })
    const ids = (data || []).map((r: any) => r.id)
    let linked = new Set<string>()
    if (ids.length) {
      const { data: notes } = await supabaseClient.from('electronic_invoices').select('return_id').in('return_id', ids)
      linked = new Set((notes || []).map((n: any) => n.return_id))
    }
    return (data || []).map((r: any) => ({
      id: r.id,
      code: r.code,
      date: r.created_at,
      total: Number(r.total_amount || 0),
      linked: linked.has(r.id),
      status: r.status || '',
    }))
  }

  /** Líneas propias de una nota crédito/débito. */
  private async loadNoteLines(documentId: string): Promise<InvoiceItem[]> {
    const { data } = await supabaseClient
      .from('electronic_document_lines')
      .select('id, line_number, product_id, sku, description, quantity, unit_price, discount_percent, net_amount, iva_treatment, tax_rate_percent, tax_amount, total_amount, products ( barcode, unit_of_measure )')
      .eq('document_id', documentId)
      .order('line_number', { ascending: true })
    return (data || []).map((l: any) => {
      const gross = Number(l.quantity || 0) * Number(l.unit_price || 0)
      const net = Number(l.net_amount || 0)
      const rate = Number(l.tax_rate_percent || 0)
      return {
        id: l.id,
        productId: l.product_id || '',
        productName: l.description,
        sku: l.sku || '',
        barcode: l.products?.barcode || undefined,
        unitOfMeasure: l.products?.unit_of_measure || 'UND',
        quantity: Number(l.quantity || 0),
        unitPrice: Number(l.unit_price || 0),
        discountPercent: Number(l.discount_percent || 0),
        discountAmount: Math.max(0, Math.round((gross - net) * 100) / 100),
        taxCode: rate > 0 ? `IVA_${rate}` : l.iva_treatment === 'EXCLUIDO' ? 'EXCLUIDO' : 'EXENTO',
        taxRatePercent: rate,
        taxAmount: Number(l.tax_amount || 0),
        subtotal: net,
        total: Number(l.total_amount || 0),
      }
    })
  }

  /** Eventos DIAN reales (dian_events) como historial de transmisión. */
  private async loadEvents(invoiceId: string): Promise<DIANTransmissionLog[]> {
    const { data } = await supabaseClient
      .from('dian_events')
      .select('id, event_type, status, response_received, payload_sent, created_at')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false })
    return (data || []).map((e: any) => ({
      id: e.id,
      timestamp: e.created_at,
      user: 'Servidor DIAN',
      action: e.event_type === 'DIAN_STATUS_QUERY' ? 'CONSULTA_ESTADO' : e.event_type === 'DIAN_TRANSMISSION_ATTEMPT' ? 'ENVIO_INICIAL' : 'ENVIO_INICIAL',
      status: e.status === 'SUCCESS' ? 'EXITOSO' : e.event_type === 'DIAN_RESPONSE_REJECTED' ? 'RECHAZADO' : e.status === 'ERROR' ? 'ERROR_TECNICO' : 'EXITOSO',
      dianStatus: e.event_type === 'DIAN_RESPONSE_ACCEPTED' ? 'ACEPTADA' : e.event_type === 'DIAN_RESPONSE_REJECTED' ? 'RECHAZADA' : 'PENDIENTE',
      statusCode: e.response_received?.statusCode || undefined,
      message: describeEvent(e),
      trackId: e.response_received?.zipKey || undefined,
    }))
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
      .select(INVOICE_SELECT, { count: 'exact' })

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
      .select(INVOICE_SELECT)
      .eq('id', id)
      .maybeSingle()

    if (error || !data) return null
    const isNote = data.document_type === 'CREDIT_NOTE' || data.document_type === 'DEBIT_NOTE'
    const [items, events] = await Promise.all([
      isNote ? this.loadNoteLines(data.id) : this.loadItems(data.sale_id),
      this.loadEvents(data.id),
    ])
    const invoice = this.mapDbRowToInvoice(data, items)
    invoice.transmissionHistory = events

    if (isNote && data.original_invoice_id) {
      const { data: orig } = await supabaseClient
        .from('electronic_invoices')
        .select('prefix, number, cufe, issue_date')
        .eq('id', data.original_invoice_id)
        .maybeSingle()
      if (orig) {
        invoice.originalInvoiceNumber = `${orig.prefix}${orig.number}`
        invoice.originalInvoiceCufe = orig.cufe || undefined
        invoice.originalInvoiceDate = orig.issue_date || undefined
      }
    } else if (!isNote) {
      const { data: notes } = await supabaseClient
        .from('electronic_invoices')
        .select('id, prefix, number, document_type, total_amount, transmission_state, note_concept_code')
        .eq('original_invoice_id', data.id)
        .order('created_at', { ascending: true })
      invoice.relatedNotes = (notes || []).map((n: any) => ({
        id: n.id,
        number: `${n.prefix}${n.number}`,
        type: n.document_type === 'DEBIT_NOTE' ? 'NOTA_DEBITO' : 'NOTA_CREDITO',
        total: Number(n.total_amount || 0),
        transmissionState: n.transmission_state || 'PENDING',
        conceptLabel: n.note_concept_code
          ? (n.document_type === 'DEBIT_NOTE' ? DEBIT_NOTE_CONCEPTS : CREDIT_NOTE_CONCEPTS)[String(n.note_concept_code)]
          : undefined,
      }))
    }
    return invoice
  }

  /**
   * Obtiene factura por ID de Venta relacionada
   */
  async findBySaleId(saleId: string): Promise<Invoice | null> {
    const { data, error } = await supabaseClient
      .from('electronic_invoices')
      .select(INVOICE_SELECT)
      .eq('sale_id', saleId)
      .eq('document_type', 'INVOICE') // las notas comparten sale_id con su factura
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
      } else if (inv.dian_status === 'REJECTED') {
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
        location_id,
        customers ( first_name, last_name, company_name, document_type, document_number, email ),
        locations ( name, code ),
        sale_items (
          id,
          quantity,
          unit_price,
          total,
          products ( name, sku )
        )
      `)
      .neq('status', 'CANCELLED')
      .order('created_at', { ascending: false })

    if (error || !sales) return []

    // Obtener ids de ventas que ya tienen factura
    const { data: existingInvoices } = await supabaseClient
      .from('electronic_invoices')
      .select('sale_id')
      .eq('document_type', 'INVOICE')

    const invoicedSet = new Set((existingInvoices || []).map((i: any) => i.sale_id).filter(Boolean))

    return sales
      .filter((s) => !invoicedSet.has(s.id))
      .map((s: any) => {
        const cust = s.customers || {}
        const loc = s.locations || {}
        const customerName =
          cust.company_name ||
          `${cust.first_name || ''} ${cust.last_name || ''}`.trim() ||
          'Consumidor Final'
        const customerDoc = cust.document_number || ''
        const customerEmail = cust.email || ''

        const items = (s.sale_items || []).map((it: any) => ({
          id: it.id,
          productName: it.products?.name || 'Producto comercial',
          sku: it.products?.sku || '',
          quantity: Number(it.quantity || 1),
          unitPrice: Number(it.unit_price || 0),
          total: Number(it.total || (it.quantity || 1) * (it.unit_price || 0)),
        }))

        const totalVal = Number(s.total_amount || 0)

        return {
          id: s.id,
          saleNumber: s.sale_number,
          customerName,
          customerDoc,
          customerDocType: cust.document_type || 'CC',
          customerEmail,
          locationId: s.location_id,
          locationName: loc.name || 'Sede Principal',
          totalAmount: totalVal,
          total: totalVal,
          date: s.created_at,
          items,
        }
      })
  }

  /**
   * La factura electrónica de venta ya NO se crea desde el navegador.
   * La numera y la procesa el servidor (/api/dian/invoices → fn_create_electronic_invoice_from_sale).
   */
  async create(_invoice: Invoice, _user: string = 'Administrador'): Promise<Invoice> {
    throw new Error('La factura electrónica se emite desde el servidor de facturación (/api/dian/invoices).')
  }

  /**
   * Las notas crédito/débito ya NO se crean desde el navegador: las numera, valida, contabiliza
   * y transmite el servidor (/api/dian/notes → fn_create_electronic_note).
   */
  async createCreditNote(): Promise<Invoice> {
    throw new Error('Las notas crédito/débito se emiten desde el servidor de facturación (/api/dian/notes).')
  }

  /**
   * Una factura electrónica transmitida a la DIAN no se "anula" cambiando su estado:
   * se corrige o anula fiscalmente con una Nota Crédito (motivo 2 = anulación).
   */
  async cancelInvoice(_invoiceId: string, _reason: string, _user: string = 'Administrador'): Promise<Invoice> {
    throw new Error('Una factura electrónica no se anula cambiando su estado. Emita una Nota Crédito con motivo "Anulación de factura electrónica".')
  }
}

export const invoiceRepository = new InvoiceRepository()
