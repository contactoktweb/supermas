/**
 * SUPER MÁS ERP/POS - Repositorio de Cotizaciones y Presupuestos (QuoteRepository)
 *
 * Conexión 100% transaccional sobre PostgreSQL (Supabase).
 * Tablas: public.quotes, public.quote_items y public.products. La conversión en venta la hace el servidor.
 * Aislamiento multi-tenant estricto mediante company_id. Cero mocks, cero db.ts.
 */

import { supabaseClient } from '@/lib/supabase/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveUserCompanyId } from '@/lib/supabase/tenant'
import type { SalePaymentInput } from '@/features/sales/repositories/sales.repository'
import {
  Quote,
  QuoteConversionResult,
  QuoteItem,
  QuoteStatus,
  CreateQuoteInput,
  UpdateQuoteInput,
  QuoteFilterParams,
  QuoteStats,
  QuotePriceSource,
} from '../types'

function getDbClient() {
  if (typeof window === 'undefined' && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return supabaseAdmin
  }
  return supabaseClient
}

/** Respuesta de fn_convert_quote_to_sale (079). */
interface QuoteConversionRpcResult {
  success: boolean
  idempotent_replay: boolean
  sale_id: string
  sale_number: string
  total_amount: number
  accounting_entry_number: string | null
  price_source?: QuotePriceSource | null
}

export class QuoteRepository {
  /**
   * Resuelve el company_id activo de forma segura
   */
  async resolveCompanyId(preferredCompanyId?: string): Promise<string> {
    if (preferredCompanyId) return preferredCompanyId
    const resolved = await resolveUserCompanyId()
    if (resolved) return resolved

    const client = getDbClient()
    const {
      data: { user },
    } = await client.auth.getUser()
    const appMetadata = user?.app_metadata
    if (appMetadata?.company_id) return appMetadata.company_id

    throw new Error('No se pudo resolver el company_id para el módulo de Cotizaciones.')
  }

  /**
   * Genera el siguiente consecutivo secuencial de cotización (ej. COT-000001)
   */
  async getNextQuoteNumber(preferredCompanyId?: string): Promise<string> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)

    const { data } = await client
      .from('quotes')
      .select('quote_number')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (!data || data.length === 0) {
      return 'COT-000001'
    }

    const lastNum = data[0].quote_number
    const match = lastNum.match(/COT-(\d+)/i)
    if (match) {
      const nextSeq = parseInt(match[1], 10) + 1
      return `COT-${String(nextSeq).padStart(6, '0')}`
    }

    return `COT-${Date.now().toString().slice(-6)}`
  }

  /**
   * Mapea un registro de PostgreSQL a Quote de dominio
   */
  private mapDbToQuote(row: any, items: any[] = []): Quote {
    const mappedItems: QuoteItem[] = (items || []).map((it) => {
      const prod = it.products || {}
      return {
        id: it.id,
        quoteId: it.quote_id,
        productId: it.product_id,
        productName: prod.name || it.product_name || 'Producto',
        sku: prod.sku || it.sku || '',
        barcode: prod.barcode || it.barcode || undefined,
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unit_price) || 0,
        unitCost: Number(it.unit_cost) || 0,
        discountPercent: Number(it.discount_percent) || 0,
        discountAmount: Number(it.discount_amount) || 0,
        taxRatePercent: Number(it.tax_rate_percent) || 0,
        taxAmount: Number(it.tax_amount) || 0,
        subtotal: Number(it.subtotal) || 0,
        total: Number(it.total) || 0,
      }
    })

    const totalUnits = mappedItems.reduce((acc, it) => acc + it.quantity, 0)

    return {
      id: row.id,
      companyId: row.company_id,
      quoteNumber: row.quote_number,
      locationId: row.location_id,
      locationName: row.locations?.name || undefined,
      customerId: row.customer_id || null,
      customerName: row.customer_name,
      customerDocument: row.customer_document || null,
      customerEmail: row.customer_email || null,
      customerPhone: row.customer_phone || null,
      sellerUserId: row.seller_user_id || null,
      sellerUserName: row.users?.full_name || undefined,
      status: row.status as QuoteStatus,
      issueDate: row.issue_date,
      validUntil: row.valid_until,
      subtotalAmount: Number(row.subtotal_amount) || 0,
      discountAmount: Number(row.discount_amount) || 0,
      taxAmount: Number(row.tax_amount) || 0,
      totalAmount: Number(row.total_amount) || 0,
      saleId: row.sale_id || null,
      notes: row.notes || null,
      termsConditions: row.terms_conditions || null,
      items: mappedItems,
      itemsCount: mappedItems.length,
      totalUnits,
      createdAt: row.created_at,
      updatedAt: row.updated_at || row.created_at,
    }
  }

  /**
   * Crea una nueva cotización con sus líneas en PostgreSQL
   */
  async create(input: CreateQuoteInput, preferredCompanyId?: string): Promise<Quote> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)
    const quoteNumber = await this.getNextQuoteNumber(companyId)
    const nowIso = new Date().toISOString()
    const issueDate = input.issueDate || nowIso.split('T')[0]

    // 1. Consultar productos para precios, costos e impuestos
    const productIds = input.items.map((it) => it.productId)
    const { data: dbProducts, error: prodErr } = await client
      .from('products')
      .select('id, name, sku, barcode, cost_price, public_sale_price, tax_rate_percent')
      .in('id', productIds)

    if (prodErr) {
      throw new Error(`Error cargando productos para cotización: ${prodErr.message}`)
    }

    const prodMap = new Map((dbProducts || []).map((p) => [p.id, p]))

    // 2. Calcular líneas y totales
    let totalSubtotal = 0
    let totalDiscount = 0
    let totalTax = 0
    let totalAmount = 0

    const itemsPayload: any[] = []

    for (const it of input.items) {
      const prod = prodMap.get(it.productId)
      const unitCost = Number(prod?.cost_price) || 0
      const unitPrice = it.unitPrice !== undefined ? it.unitPrice : Number(prod?.public_sale_price) || 0
      const discountPercent = it.discountPercent || 0
      const taxRatePercent = it.taxRatePercent !== undefined ? it.taxRatePercent : Number(prod?.tax_rate_percent) || 0

      const lineGross = it.quantity * unitPrice
      const lineDiscount = Math.round(lineGross * (discountPercent / 100))
      const lineBase = lineGross - lineDiscount
      const lineTax = Math.round(lineBase * (taxRatePercent / 100))
      const lineTotal = lineBase + lineTax

      totalSubtotal += lineGross
      totalDiscount += lineDiscount
      totalTax += lineTax
      totalAmount += lineTotal

      itemsPayload.push({
        company_id: companyId,
        product_id: it.productId,
        quantity: it.quantity,
        unit_price: unitPrice,
        unit_cost: unitCost,
        discount_percent: discountPercent,
        discount_amount: lineDiscount,
        tax_rate_percent: taxRatePercent,
        tax_amount: lineTax,
        subtotal: lineGross,
        total: lineTotal,
        created_at: nowIso,
      })
    }

    // 3. Insertar encabezado de cotización
    const { data: createdQuote, error: quoteErr } = await client
      .from('quotes')
      .insert({
        company_id: companyId,
        quote_number: quoteNumber,
        location_id: input.locationId,
        customer_id: input.customerId || null,
        customer_name: input.customerName,
        customer_document: input.customerDocument || null,
        customer_email: input.customerEmail || null,
        customer_phone: input.customerPhone || null,
        seller_user_id: input.sellerUserId || null,
        status: 'DRAFT',
        issue_date: issueDate,
        valid_until: input.validUntil,
        subtotal_amount: totalSubtotal,
        discount_amount: totalDiscount,
        tax_amount: totalTax,
        total_amount: totalAmount,
        notes: input.notes || null,
        terms_conditions: input.termsConditions || 'Validez de la oferta según fecha de expiración. Precios sujetos a disponibilidad de inventario.',
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select(
        `
        *,
        locations:location_id ( id, name ),
        users:seller_user_id ( id, full_name )
      `
      )
      .single()

    if (quoteErr || !createdQuote) {
      throw new Error(`Error creando cotización: ${quoteErr?.message}`)
    }

    // 4. Insertar líneas con quote_id
    const linesToInsert = itemsPayload.map((it) => ({
      ...it,
      quote_id: createdQuote.id,
    }))

    const { data: createdLines, error: linesErr } = await client
      .from('quote_items')
      .insert(linesToInsert)
      .select('*, products:product_id(name, sku, barcode)')

    if (linesErr) {
      throw new Error(`Error insertando líneas de cotización: ${linesErr.message}`)
    }

    return this.mapDbToQuote(createdQuote, createdLines || [])
  }

  /**
   * Consulta cotizaciones filtradas y paginadas desde PostgreSQL
   */
  async findFiltered(
    filters: QuoteFilterParams = {},
    preferredCompanyId?: string
  ): Promise<{ data: Quote[]; total: number }> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)

    let query = client
      .from('quotes')
      .select(
        `
        *,
        locations:location_id ( id, name ),
        users:seller_user_id ( id, full_name ),
        quote_items (
          *,
          products:product_id ( name, sku, barcode )
        )
      `,
        { count: 'exact' }
      )
      .eq('company_id', companyId)

    if (filters.query && filters.query.trim()) {
      const q = `%${filters.query.trim()}%`
      query = query.or(
        `quote_number.ilike.${q},customer_name.ilike.${q},customer_document.ilike.${q}`
      )
    }

    if (filters.status && filters.status !== 'ALL') {
      query = query.eq('status', filters.status)
    }

    if (filters.customerId) {
      query = query.eq('customer_id', filters.customerId)
    }

    if (filters.locationId && filters.locationId !== 'ALL') {
      query = query.eq('location_id', filters.locationId)
    }

    if (filters.sellerUserId) {
      query = query.eq('seller_user_id', filters.sellerUserId)
    }

    if (filters.startDate) {
      query = query.gte('issue_date', filters.startDate)
    }

    if (filters.endDate) {
      query = query.lte('issue_date', filters.endDate)
    }

    query = query.order('created_at', { ascending: false })

    const page = filters.page || 1
    const pageSize = filters.pageSize || 15
    const startIdx = (page - 1) * pageSize
    query = query.range(startIdx, startIdx + pageSize - 1)

    const { data, count, error } = await query

    if (error) {
      throw new Error(`Error consultando cotizaciones: ${error.message}`)
    }

    const quotes = (data || []).map((row: any) =>
      this.mapDbToQuote(row, row.quote_items || [])
    )

    return {
      data: quotes,
      total: count || 0,
    }
  }

  /**
   * Busca cotización por ID con sus líneas
   */
  async findById(id: string, preferredCompanyId?: string): Promise<Quote | null> {
    const client = getDbClient()
    let query = client
      .from('quotes')
      .select(
        `
        *,
        locations:location_id ( id, name ),
        users:seller_user_id ( id, full_name ),
        quote_items (
          *,
          products:product_id ( name, sku, barcode )
        )
      `
      )
      .eq('id', id)

    if (preferredCompanyId) {
      query = query.eq('company_id', preferredCompanyId)
    }

    const { data, error } = await query.maybeSingle()

    if (error || !data) return null
    return this.mapDbToQuote(data, data.quote_items || [])
  }

  /**
   * Actualiza el estado de una cotización (DRAFT -> SENT -> ACCEPTED -> REJECTED -> EXPIRED)
   */
  async updateStatus(
    id: string,
    status: QuoteStatus,
    reason?: string,
    preferredCompanyId?: string
  ): Promise<Quote> {
    const client = getDbClient()
    const nowIso = new Date().toISOString()

    const dbUpdates: any = {
      status,
      updated_at: nowIso,
    }

    if (reason) {
      dbUpdates.notes = reason
    }

    let query = client
      .from('quotes')
      .update(dbUpdates)
      .eq('id', id)

    if (preferredCompanyId) {
      query = query.eq('company_id', preferredCompanyId)
    }

    const { data, error } = await query
      .select(
        `
        *,
        locations:location_id ( id, name ),
        users:seller_user_id ( id, full_name ),
        quote_items (
          *,
          products:product_id ( name, sku, barcode )
        )
      `
      )
      .single()

    if (error || !data) {
      throw new Error(`Error actualizando estado de cotización ${id}: ${error?.message}`)
    }

    return this.mapDbToQuote(data, data.quote_items || [])
  }

  /**
   * Convierte la cotización en venta en una sola transacción del servidor (fn_convert_quote_to_sale, 079):
   * precio (acordado solo si la cotización está vigente y quien convierte puede aprobar precios), IVA,
   * costo, stock/kardex, pagos, caja/banco/cartera, asiento y marca de cotización convertida.
   * Reintentar con la misma clave, o sobre una cotización ya convertida, devuelve la misma venta.
   */
  async convertToSale(
    quoteId: string,
    input: { payments: SalePaymentInput[]; idempotencyKey: string },
    preferredCompanyId?: string
  ): Promise<QuoteConversionResult> {
    const { data, error } = await supabaseClient.rpc('fn_convert_quote_to_sale', {
      p_quote_id: quoteId,
      p_payments: input.payments,
      p_idempotency_key: input.idempotencyKey,
    })
    if (error) throw new Error(error.message)
    const res = data as QuoteConversionRpcResult | null
    if (!res?.success || !res.sale_id) {
      throw new Error('El servidor no confirmó la conversión. Intente de nuevo: no se duplicará la venta.')
    }

    const quote = await this.findById(quoteId, preferredCompanyId)
    if (!quote) {
      throw new Error(`La venta ${res.sale_number} quedó registrada, pero la cotización no se pudo cargar. Actualice el listado.`)
    }

    return {
      saleId: res.sale_id,
      saleNumber: res.sale_number,
      totalAmount: Number(res.total_amount) || 0,
      idempotentReplay: Boolean(res.idempotent_replay),
      priceSource: res.price_source ?? null,
      accountingEntryNumber: res.accounting_entry_number ?? null,
      quote,
    }
  }

  /**
   * Obtiene estadísticas agregadas de cotizaciones
   */
  async getStats(preferredCompanyId?: string): Promise<QuoteStats> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)

    const { data, error } = await client
      .from('quotes')
      .select('status, total_amount')
      .eq('company_id', companyId)

    if (error) {
      throw new Error(`Error obteniendo estadísticas de cotizaciones: ${error.message}`)
    }

    const list = data || []
    let draftCount = 0
    let sentCount = 0
    let acceptedCount = 0
    let convertedCount = 0
    let expiredCount = 0
    let rejectedCount = 0
    let totalQuotedAmount = 0
    let convertedAmount = 0

    list.forEach((q: any) => {
      const amt = Number(q.total_amount) || 0
      totalQuotedAmount += amt

      switch (q.status) {
        case 'DRAFT':
          draftCount++
          break
        case 'SENT':
          sentCount++
          break
        case 'ACCEPTED':
          acceptedCount++
          break
        case 'CONVERTED':
          convertedCount++
          convertedAmount += amt
          break
        case 'EXPIRED':
          expiredCount++
          break
        case 'REJECTED':
          rejectedCount++
          break
      }
    })

    const totalQuotes = list.length
    const conversionRatePercent =
      totalQuotes > 0 ? Number(((convertedCount / totalQuotes) * 100).toFixed(1)) : 0

    return {
      totalQuotes,
      draftCount,
      sentCount,
      acceptedCount,
      convertedCount,
      expiredCount,
      rejectedCount,
      totalQuotedAmount,
      convertedAmount,
      conversionRatePercent,
    }
  }
}

export const quoteRepository = new QuoteRepository()
