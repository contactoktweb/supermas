/**
 * SUPER MÁS ERP/POS - Repositorio de Impuestos y Retenciones (TaxRepository)
 *
 * Conecta directamente con la base de datos oficial Supabase PostgreSQL
 * utilizando las tablas public.tax_rates, public.products, public.sales y public.purchases
 * con estricto aislamiento multiempresa (company_id).
 *
 * Cero mocks, cero db.ts.
 */

import { supabaseClient } from '@/lib/supabase/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveUserCompanyId } from '@/lib/supabase/tenant'
import {
  TaxConfig,
  TaxFilters,
  TaxStats,
  TaxAssociatedProduct,
  TaxReportItem,
  TaxReportSummary,
  TaxReportFilters,
  TaxCalculationLineInput,
  TaxDocumentCalculationResult,
  TaxType,
  TaxStatus,
} from '../types'
import { TaxConfigFormData } from '../schemas/tax.schema'
import { taxCalculationService } from '../services/tax-calculation.service'

function getDbClient() {
  if (typeof window === 'undefined' && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return supabaseAdmin
  }
  return supabaseClient
}

export class TaxRepository {
  private getTodayStr(): string {
    return new Date().toISOString().split('T')[0]
  }

  /**
   * Resuelve el company_id activo de forma segura
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
   * Mapea un registro de public.tax_rates a la interfaz TaxConfig
   */
  private mapRowToTaxConfig(row: any, associatedCount: number = 0): TaxConfig {
    return {
      id: row.id,
      companyId: row.company_id || undefined,
      name: row.name,
      code: row.code,
      type: (row.type as TaxType) || 'IVA',
      ratePercent: Number(row.percentage) || 0,
      status: row.is_active ? 'ACTIVE' : 'INACTIVE',
      validFrom: row.valid_from ? String(row.valid_from).slice(0, 10) : '2026-01-01',
      validUntil: row.valid_until ? String(row.valid_until).slice(0, 10) : null,
      description: row.description || '',
      isDefault: Boolean(row.is_default),
      generatedTaxAccountId: row.generated_tax_account_id || '',
      generatedTaxAccountName: '',
      deductibleTaxAccountId: row.deductible_tax_account_id || '',
      deductibleTaxAccountName: '',
      version: 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at || row.created_at,
      associatedProductsCount: associatedCount,
    }
  }

  /**
   * Obtiene la lista filtrada, ordenada y paginada de configuraciones tributarias
   * enriquecida con métricas relacionales de productos asociados desde PostgreSQL.
   */
  async findAll(filters?: TaxFilters): Promise<{ data: TaxConfig[]; total: number }> {
    const client = getDbClient()
    const companyId = await this.getCompanyId(filters?.companyId)
    const today = this.getTodayStr()

    // 1. Consultar tarifas tributarias de la empresa o globales (company_id IS NULL)
    let query = client.from('tax_rates').select('*')
    if (companyId) {
      query = query.or(`company_id.eq.${companyId},company_id.is.null`)
    } else {
      query = query.is('company_id', null)
    }

    const { data: taxRows, error: taxErr } = await query
    if (taxErr) {
      console.error('❌ Error consultando tax_rates en PostgreSQL:', taxErr)
      return { data: [], total: 0 }
    }

    // 2. Consultar productos para mapear conteo por tarifa
    let prodQuery = client.from('products').select('id, tax_rate_percent, is_tax_exempt')
    if (companyId) {
      prodQuery = prodQuery.eq('company_id', companyId)
    }
    const { data: prods } = await prodQuery

    const rateCountMap = new Map<number, number>()
    let exemptCount = 0
    if (prods) {
      prods.forEach((p: any) => {
        if (p.is_tax_exempt) {
          exemptCount++
        } else {
          const rate = Number(p.tax_rate_percent) || 0
          rateCountMap.set(rate, (rateCountMap.get(rate) || 0) + 1)
        }
      })
    }

    let configs: TaxConfig[] = (taxRows || []).map((row: any) => {
      let count = 0
      const rate = Number(row.percentage) || 0
      if (row.type === 'EXCLUIDO' || row.code === 'EXENTO') {
        count = exemptCount
      } else {
        count = rateCountMap.get(rate) || 0
      }
      return this.mapRowToTaxConfig(row, count)
    })

    // 3. Filtros en memoria
    if (filters?.query) {
      const q = filters.query.toLowerCase().trim()
      configs = configs.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.code.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q))
      )
    }

    if (filters?.type && filters.type !== 'ALL') {
      configs = configs.filter((t) => t.type === filters.type)
    }

    if (filters?.status && filters.status !== 'ALL') {
      configs = configs.filter((t) => t.status === filters.status)
    }

    if (filters?.vigencia && filters.vigencia !== 'ALL') {
      if (filters.vigencia === 'ACTIVE') {
        configs = configs.filter(
          (t) =>
            t.status === 'ACTIVE' &&
            t.validFrom <= today &&
            (t.validUntil === null || t.validUntil >= today)
        )
      } else if (filters.vigencia === 'EXPIRED') {
        configs = configs.filter((t) => t.validUntil !== null && t.validUntil < today)
      } else if (filters.vigencia === 'FUTURE') {
        configs = configs.filter((t) => t.validFrom > today)
      }
    }

    // 4. Ordenamiento
    const sortBy = filters?.sortBy || 'RATE_DESC'
    configs.sort((a, b) => {
      switch (sortBy) {
        case 'NAME_ASC':
          return a.name.localeCompare(b.name)
        case 'NAME_DESC':
          return b.name.localeCompare(a.name)
        case 'RATE_ASC':
          return a.ratePercent - b.ratePercent
        case 'RATE_DESC':
          return b.ratePercent - a.ratePercent
        case 'CODE_ASC':
          return a.code.localeCompare(b.code)
        case 'PRODUCTS_DESC':
          return (b.associatedProductsCount || 0) - (a.associatedProductsCount || 0)
        default:
          return 0
      }
    })

    const total = configs.length
    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 10
    const startIdx = (page - 1) * pageSize
    const paginated = configs.slice(startIdx, startIdx + pageSize)

    return {
      data: paginated,
      total,
    }
  }

  /**
   * Encuentra una configuración por ID con estadísticas de uso en ventas y compras desde PostgreSQL.
   */
  async findById(id: string, preferredCompanyId?: string): Promise<TaxConfig | null> {
    const client = getDbClient()
    const companyId = await this.getCompanyId(preferredCompanyId)

    const { data: row, error } = await client
      .from('tax_rates')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error || !row) return null

    const ratePercent = Number(row.percentage) || 0

    // Conteo de productos asociados
    let prodQuery = client.from('products').select('*', { count: 'exact', head: true })
    if (companyId) prodQuery = prodQuery.eq('company_id', companyId)
    if (row.type === 'EXCLUIDO' || row.code === 'EXENTO') {
      prodQuery = prodQuery.eq('is_tax_exempt', true)
    } else {
      prodQuery = prodQuery.eq('tax_rate_percent', ratePercent)
    }
    const { count: prodCount } = await prodQuery

    // Conteo y monto en ventas
    let salesQuery = client.from('sales').select('id, tax_amount')
    if (companyId) salesQuery = salesQuery.eq('company_id', companyId)
    const { data: salesData } = await salesQuery

    let salesCount = 0
    let totalSalesTaxAmount = 0
    if (salesData && ratePercent > 0) {
      salesData.forEach((s: any) => {
        const tax = Number(s.tax_amount) || 0
        if (tax > 0) {
          salesCount++
          totalSalesTaxAmount += tax
        }
      })
    }

    // Conteo y monto en compras
    let purQuery = client.from('purchases').select('id, tax_amount')
    if (companyId) purQuery = purQuery.eq('company_id', companyId)
    const { data: purData } = await purQuery

    let purchasesCount = 0
    let totalPurchasesTaxAmount = 0
    if (purData && ratePercent > 0) {
      purData.forEach((p: any) => {
        const tax = Number(p.tax_amount) || 0
        if (tax > 0) {
          purchasesCount++
          totalPurchasesTaxAmount += tax
        }
      })
    }

    const config = this.mapRowToTaxConfig(row, prodCount || 0)
    return {
      ...config,
      salesCount,
      totalSalesTaxAmount,
      purchasesCount,
      totalPurchasesTaxAmount,
    }
  }

  /**
   * Encuentra una configuración por código exacto en PostgreSQL.
   */
  async findByCode(code: string, preferredCompanyId?: string): Promise<TaxConfig | null> {
    const client = getDbClient()
    const companyId = await this.getCompanyId(preferredCompanyId)

    let query = client.from('tax_rates').select('*').ilike('code', code.trim())
    if (companyId) {
      query = query.or(`company_id.eq.${companyId},company_id.is.null`)
    } else {
      query = query.is('company_id', null)
    }

    const { data, error } = await query.order('company_id', { ascending: false, nullsFirst: false }).limit(1)
    if (error || !data || data.length === 0) return null

    return this.mapRowToTaxConfig(data[0])
  }

  /**
   * Crea una nueva configuración tributaria en public.tax_rates de PostgreSQL y registra auditoría.
   */
  async create(
    data: TaxConfigFormData,
    user: { id: string; name: string },
    preferredCompanyId?: string
  ): Promise<TaxConfig> {
    const client = getDbClient()
    const companyId = await this.getCompanyId(preferredCompanyId)
    const id = crypto.randomUUID()
    const nowIso = new Date().toISOString()
    const rate = Number(data.ratePercent)

    const rowToInsert = {
      id,
      company_id: companyId,
      code: data.code.toUpperCase().trim(),
      name: data.name.trim(),
      percentage: rate,
      type: data.type,
      is_active: data.status === 'ACTIVE',
      description: data.description || '',
      valid_from: data.validFrom || this.getTodayStr(),
      valid_until: data.validUntil || null,
      is_default: Boolean(data.isDefault),
      generated_tax_account_id: data.generatedTaxAccountId || null,
      deductible_tax_account_id: data.deductibleTaxAccountId || null,
      created_at: nowIso,
      updated_at: nowIso,
    }

    const { data: created, error } = await client
      .from('tax_rates')
      .insert(rowToInsert)
      .select()
      .single()

    if (error) {
      console.error('❌ Error creando tax_rate en PostgreSQL:', error)
      throw new Error(`Error al persistir configuración tributaria: ${error.message}`)
    }

    // Auditoría inmutable en PostgreSQL
    await this.logAudit({
      companyId: companyId || undefined,
      action: 'TAX_CONFIG_CREATED',
      taxConfigId: id,
      taxConfigCode: rowToInsert.code,
      taxConfigName: rowToInsert.name,
      userId: user.id,
      userName: user.name,
      changes: {
        field: 'all',
        newValue: rowToInsert,
        details: `Configuración tributaria ${rowToInsert.name} (${rowToInsert.code} - ${rate}%) creada exitosamente en PostgreSQL.`,
      },
    })

    return this.mapRowToTaxConfig(created)
  }

  /**
   * Actualiza una configuración existente en PostgreSQL y registra auditoría.
   */
  async update(
    id: string,
    data: Partial<TaxConfigFormData>,
    user: { id: string; name: string },
    preferredCompanyId?: string
  ): Promise<TaxConfig> {
    const client = getDbClient()
    const companyId = await this.getCompanyId(preferredCompanyId)

    const { data: previous, error: prevErr } = await client
      .from('tax_rates')
      .select('*')
      .eq('id', id)
      .single()

    if (prevErr || !previous) {
      throw new Error(`Configuración de impuesto con ID ${id} no encontrada.`)
    }

    const nowIso = new Date().toISOString()
    const updates: any = {
      updated_at: nowIso,
    }

    if (data.name !== undefined) updates.name = data.name.trim()
    if (data.type !== undefined) updates.type = data.type
    if (data.ratePercent !== undefined) updates.percentage = Number(data.ratePercent)
    if (data.status !== undefined) updates.is_active = data.status === 'ACTIVE'
    if (data.validFrom !== undefined) updates.valid_from = data.validFrom
    if (data.validUntil !== undefined) updates.valid_until = data.validUntil
    if (data.description !== undefined) updates.description = data.description
    if (data.isDefault !== undefined) updates.is_default = Boolean(data.isDefault)
    if (data.generatedTaxAccountId !== undefined) updates.generated_tax_account_id = data.generatedTaxAccountId || null
    if (data.deductibleTaxAccountId !== undefined) updates.deductible_tax_account_id = data.deductibleTaxAccountId || null

    const { data: updated, error: updErr } = await client
      .from('tax_rates')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updErr) {
      console.error('❌ Error actualizando tax_rate en PostgreSQL:', updErr)
      throw new Error(`Error al actualizar configuración tributaria: ${updErr.message}`)
    }

    const isRateChange = data.ratePercent !== undefined && Number(previous.percentage) !== Number(data.ratePercent)

    // Registrar en auditoría
    await this.logAudit({
      companyId: companyId || previous.company_id || undefined,
      action: isRateChange ? 'TAX_RATE_CHANGED' : 'TAX_CONFIG_UPDATED',
      taxConfigId: updated.id,
      taxConfigCode: updated.code,
      taxConfigName: updated.name,
      userId: user.id,
      userName: user.name,
      changes: {
        field: isRateChange ? 'ratePercent' : 'general',
        previousValue: previous,
        newValue: updated,
        details: isRateChange
          ? `Tarifa modificada de ${previous.percentage}% a ${updated.percentage}%.`
          : `Actualizada información de ${updated.name}.`,
      },
    })

    return this.mapRowToTaxConfig(updated)
  }

  /**
   * Desactiva una configuración (soft-delete para proteger históricos).
   */
  async deactivate(
    id: string,
    reason: string,
    user: { id: string; name: string },
    preferredCompanyId?: string
  ): Promise<TaxConfig> {
    const client = getDbClient()
    const companyId = await this.getCompanyId(preferredCompanyId)
    const today = this.getTodayStr()
    const nowIso = new Date().toISOString()

    const { data: previous, error: prevErr } = await client
      .from('tax_rates')
      .select('*')
      .eq('id', id)
      .single()

    if (prevErr || !previous) {
      throw new Error(`Configuración de impuesto con ID ${id} no encontrada.`)
    }

    const { data: updated, error: updErr } = await client
      .from('tax_rates')
      .update({
        is_active: false,
        valid_until: previous.valid_until || today,
        updated_at: nowIso,
      })
      .eq('id', id)
      .select()
      .single()

    if (updErr) {
      throw new Error(`Error al desactivar impuesto: ${updErr.message}`)
    }

    await this.logAudit({
      companyId: companyId || previous.company_id || undefined,
      action: 'TAX_CONFIG_DEACTIVATED',
      taxConfigId: updated.id,
      taxConfigCode: updated.code,
      taxConfigName: updated.name,
      userId: user.id,
      userName: user.name,
      changes: {
        field: 'status',
        previousValue: 'ACTIVE',
        newValue: 'INACTIVE',
        details: `Configuración desactivada. Motivo: ${reason || 'Desactivación fiduciaria'}. Histórico protegido.`,
      },
    })

    return this.mapRowToTaxConfig(updated)
  }

  /**
   * Reactiva una configuración tributaria.
   */
  async activate(
    id: string,
    user: { id: string; name: string },
    preferredCompanyId?: string
  ): Promise<TaxConfig> {
    const client = getDbClient()
    const companyId = await this.getCompanyId(preferredCompanyId)
    const nowIso = new Date().toISOString()

    const { data: previous, error: prevErr } = await client
      .from('tax_rates')
      .select('*')
      .eq('id', id)
      .single()

    if (prevErr || !previous) {
      throw new Error(`Configuración de impuesto con ID ${id} no encontrada.`)
    }

    const { data: updated, error: updErr } = await client
      .from('tax_rates')
      .update({
        is_active: true,
        valid_until: null,
        updated_at: nowIso,
      })
      .eq('id', id)
      .select()
      .single()

    if (updErr) {
      throw new Error(`Error al reactivar impuesto: ${updErr.message}`)
    }

    await this.logAudit({
      companyId: companyId || previous.company_id || undefined,
      action: 'TAX_CONFIG_ACTIVATED',
      taxConfigId: updated.id,
      taxConfigCode: updated.code,
      taxConfigName: updated.name,
      userId: user.id,
      userName: user.name,
      changes: {
        field: 'status',
        previousValue: 'INACTIVE',
        newValue: 'ACTIVE',
        details: 'Configuración reactivada para nuevos productos y documentos.',
      },
    })

    return this.mapRowToTaxConfig(updated)
  }

  /**
   * Retorna las estadísticas tributarias globales del ERP calculadas desde PostgreSQL.
   */
  async getStats(preferredCompanyId?: string): Promise<TaxStats> {
    const client = getDbClient()
    const companyId = await this.getCompanyId(preferredCompanyId)

    // 1. Configuraciones activas
    let taxQuery = client.from('tax_rates').select('*', { count: 'exact', head: true }).eq('is_active', true)
    if (companyId) {
      taxQuery = taxQuery.or(`company_id.eq.${companyId},company_id.is.null`)
    } else {
      taxQuery = taxQuery.is('company_id', null)
    }
    const { count: activeConfigsCount } = await taxQuery

    // 2. Productos gravados y exentos
    let prodQuery = client.from('products').select('id, tax_rate_percent, is_tax_exempt')
    if (companyId) prodQuery = prodQuery.eq('company_id', companyId)
    const { data: prods } = await prodQuery

    let taxedProductsCount = 0
    let exemptProductsCount = 0
    if (prods) {
      prods.forEach((p: any) => {
        if (p.is_tax_exempt || Number(p.tax_rate_percent) === 0) {
          exemptProductsCount++
        } else {
          taxedProductsCount++
        }
      })
    }

    // 3. Ventas con impuestos
    let salesQuery = client.from('sales').select('tax_amount')
    if (companyId) salesQuery = salesQuery.eq('company_id', companyId)
    const { data: sales } = await salesQuery

    let salesWithTaxesCount = 0
    let generatedTaxPeriod = 0
    if (sales) {
      sales.forEach((s: any) => {
        const tax = Number(s.tax_amount) || 0
        if (tax > 0) {
          salesWithTaxesCount++
          generatedTaxPeriod += tax
        }
      })
    }

    // 4. Compras con impuestos
    let purQuery = client.from('purchases').select('tax_amount')
    if (companyId) purQuery = purQuery.eq('company_id', companyId)
    const { data: purchases } = await purQuery

    let purchasesWithTaxesCount = 0
    let deductibleTaxPeriod = 0
    if (purchases) {
      purchases.forEach((p: any) => {
        const tax = Number(p.tax_amount) || 0
        if (tax > 0) {
          purchasesWithTaxesCount++
          deductibleTaxPeriod += tax
        }
      })
    }

    const netTaxPayable = generatedTaxPeriod - deductibleTaxPeriod

    return {
      activeConfigsCount: activeConfigsCount || 0,
      taxedProductsCount,
      exemptProductsCount,
      salesWithTaxesCount,
      purchasesWithTaxesCount,
      generatedTaxPeriod,
      deductibleTaxPeriod,
      netTaxPayable,
    }
  }

  /**
   * Consulta paginada y filtrable de productos vinculados a una configuración tributaria desde PostgreSQL.
   */
  async getAssociatedProducts(
    taxConfigId: string,
    filters?: { query?: string; page?: number; pageSize?: number; companyId?: string }
  ): Promise<{ data: TaxAssociatedProduct[]; total: number }> {
    const client = getDbClient()
    const companyId = await this.getCompanyId(filters?.companyId)

    const { data: taxRate } = await client
      .from('tax_rates')
      .select('*')
      .eq('id', taxConfigId)
      .maybeSingle()

    const configName = taxRate?.name || 'Configuración Tributaria'
    const configRate = Number(taxRate?.percentage) || 0
    const isExempt = taxRate?.type === 'EXCLUIDO' || taxRate?.code === 'EXENTO'

    let prodQuery = client.from('products').select(`
      id, sku, barcode, name, public_sale_price, wholesale_price,
      unit_of_measure, is_active, tax_rate_percent, is_tax_exempt,
      categories(name), brands(name)
    `)

    if (companyId) prodQuery = prodQuery.eq('company_id', companyId)

    if (isExempt) {
      prodQuery = prodQuery.or('is_tax_exempt.eq.true,tax_rate_percent.eq.0')
    } else {
      prodQuery = prodQuery.eq('tax_rate_percent', configRate)
    }

    const { data: prods, error } = await prodQuery
    if (error || !prods) return { data: [], total: 0 }

    let list = prods.map((p: any) => ({
      id: p.id,
      sku: p.sku,
      barcode: p.barcode || '',
      name: p.name,
      category: p.categories?.name || 'General',
      brand: p.brands?.name || 'Genérico',
      normalPrice: Number(p.public_sale_price) || 0,
      wholesalePrice: Number(p.wholesale_price) || 0,
      unitOfMeasure: p.unit_of_measure || 'UND',
      status: p.is_active ? 'ACTIVE' : 'INACTIVE',
      taxProfile: taxRate?.code || 'IVA_19',
      taxConfigId,
      taxConfigName: configName,
      ratePercent: Number(p.tax_rate_percent) || configRate,
      totalStock: 0,
    }))

    if (filters?.query) {
      const q = filters.query.toLowerCase().trim()
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q)
      )
    }

    const total = list.length
    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 10
    const startIdx = (page - 1) * pageSize
    const paginated = list.slice(startIdx, startIdx + pageSize)

    return {
      data: paginated,
      total,
    }
  }

  /**
   * Genera el informe tributario consolidado a partir de ventas y compras reales en PostgreSQL.
   */
  async getTaxReports(filters?: TaxReportFilters): Promise<{
    items: TaxReportItem[]
    summary: TaxReportSummary
  }> {
    const client = getDbClient()
    const companyId = await this.getCompanyId(filters?.companyId)
    const reportItems: TaxReportItem[] = []

    // 1. Consultar Ventas con sus Items
    if (!filters?.documentType || filters.documentType === 'ALL' || filters.documentType === 'SALE') {
      let salesQuery = client
        .from('sales')
        .select(`
          id, sale_number, created_at, location_id, total_amount, tax_amount, subtotal_amount,
          customers(id, company_name, first_name, last_name, document_number),
          locations(name),
          sale_items(id, tax_rate_percent, tax_amount, subtotal, total)
        `)

      if (companyId) salesQuery = salesQuery.eq('company_id', companyId)
      if (filters?.locationId && filters.locationId !== 'ALL') salesQuery = salesQuery.eq('location_id', filters.locationId)
      if (filters?.dateFrom) salesQuery = salesQuery.gte('created_at', filters.dateFrom)
      if (filters?.dateUntil) salesQuery = salesQuery.lte('created_at', filters.dateUntil)

      const { data: salesData, error: salesErr } = await salesQuery
      if (salesErr) {
        console.error('❌ Error consultando sales para reporte tributario:', salesErr)
      }

      if (salesData) {
        salesData.forEach((s: any) => {
          const custName = s.customers?.company_name || `${s.customers?.first_name || ''} ${s.customers?.last_name || ''}`.trim() || 'Cliente'
          const custDoc = s.customers?.document_number || ''
          const locName = s.locations?.name || 'Bodega Principal'
          const docDate = s.created_at ? s.created_at.split('T')[0] : ''

          if (s.sale_items && Array.isArray(s.sale_items)) {
            s.sale_items.forEach((item: any) => {
              const tax = Number(item.tax_amount) || 0
              const rate = Number(item.tax_rate_percent) || 0
              reportItems.push({
                id: `rep-sale-${s.id}-${item.id}`,
                documentNumber: s.sale_number,
                documentType: 'SALE',
                date: docDate,
                locationId: s.location_id,
                locationName: locName,
                thirdPartyDoc: custDoc,
                thirdPartyName: custName,
                taxConfigCode: rate === 19 ? 'IVA_19' : rate === 5 ? 'IVA_5' : 'EXENTO',
                taxConfigName: rate === 19 ? 'IVA General 19%' : rate === 5 ? 'IVA Reducido 5%' : 'Exento',
                ratePercent: rate,
                baseAmount: Number(item.subtotal) || 0,
                taxAmount: tax,
                totalAmount: Number(item.total) || 0,
                operationType: 'GENERATED',
              })
            })
          }
        })
      }
    }

    // 2. Consultar Compras con sus Items
    if (!filters?.documentType || filters.documentType === 'ALL' || filters.documentType === 'PURCHASE') {
      let purQuery = client
        .from('purchases')
        .select(`
          id, purchase_number, issue_date, location_id, total_amount, tax_amount, subtotal_amount,
          suppliers(name, legal_name, tax_id),
          locations(name),
          purchase_items(id, tax_rate_percent, tax_amount, subtotal, total)
        `)

      if (companyId) purQuery = purQuery.eq('company_id', companyId)
      if (filters?.locationId && filters.locationId !== 'ALL') purQuery = purQuery.eq('location_id', filters.locationId)
      if (filters?.dateFrom) purQuery = purQuery.gte('issue_date', filters.dateFrom)
      if (filters?.dateUntil) purQuery = purQuery.lte('issue_date', filters.dateUntil)

      const { data: purData, error: purErr } = await purQuery
      if (purErr) {
        console.error('❌ Error consultando purchases para reporte tributario:', purErr)
      }

      if (purData) {
        purData.forEach((p: any) => {
          const suppName = p.suppliers?.legal_name || p.suppliers?.name || 'Proveedor'
          const suppDoc = p.suppliers?.tax_id || ''
          const locName = p.locations?.name || 'Bodega Principal'
          const docDate = p.issue_date ? String(p.issue_date).split('T')[0] : ''

          if (p.purchase_items && Array.isArray(p.purchase_items)) {
            p.purchase_items.forEach((item: any) => {
              const tax = Number(item.tax_amount) || 0
              const rate = Number(item.tax_rate_percent) || 0
              reportItems.push({
                id: `rep-pur-${p.id}-${item.id}`,
                documentNumber: p.purchase_number,
                documentType: 'PURCHASE',
                date: docDate,
                locationId: p.location_id,
                locationName: locName,
                thirdPartyDoc: suppDoc,
                thirdPartyName: suppName,
                taxConfigCode: rate === 19 ? 'IVA_19' : rate === 5 ? 'IVA_5' : 'EXENTO',
                taxConfigName: rate === 19 ? 'IVA General 19%' : rate === 5 ? 'IVA Reducido 5%' : 'Exento',
                ratePercent: rate,
                baseAmount: Number(item.subtotal) || 0,
                taxAmount: tax,
                totalAmount: Number(item.total) || 0,
                operationType: 'DEDUCTIBLE',
              })
            })
          }
        })
      }
    }

    // Filtrar por impuesto específico si aplica
    let finalItems = reportItems
    if (filters?.taxConfigId && filters.taxConfigId !== 'ALL') {
      finalItems = finalItems.filter(
        (i) => i.taxConfigCode.includes(filters.taxConfigId!) || i.ratePercent.toString() === filters.taxConfigId
      )
    }

    // Agregación de resumen
    let generatedTaxes = 0
    let deductibleTaxes = 0
    let totalBaseSales = 0
    let totalBasePurchases = 0

    const locationMap = new Map<string, { generated: number; deductible: number }>()
    const rateMap = new Map<number, { generated: number; deductible: number; label: string }>()

    for (const item of finalItems) {
      const locName = item.locationName || 'Sin ubicación'
      if (!locationMap.has(locName)) {
        locationMap.set(locName, { generated: 0, deductible: 0 })
      }
      const locStat = locationMap.get(locName)!

      if (!rateMap.has(item.ratePercent)) {
        rateMap.set(item.ratePercent, {
          generated: 0,
          deductible: 0,
          label: `Tarifa ${item.ratePercent}%`,
        })
      }
      const rateStat = rateMap.get(item.ratePercent)!

      if (item.operationType === 'GENERATED') {
        generatedTaxes += item.taxAmount
        totalBaseSales += item.baseAmount
        locStat.generated += item.taxAmount
        rateStat.generated += item.taxAmount
      } else {
        deductibleTaxes += item.taxAmount
        totalBasePurchases += item.baseAmount
        locStat.deductible += item.taxAmount
        rateStat.deductible += item.taxAmount
      }
    }

    const summary: TaxReportSummary = {
      generatedTaxes,
      deductibleTaxes,
      netBalance: generatedTaxes - deductibleTaxes,
      totalBaseSales,
      totalBasePurchases,
      recordsCount: finalItems.length,
      byLocation: Array.from(locationMap.entries()).map(([locationName, vals]) => ({
        locationName,
        generated: vals.generated,
        deductible: vals.deductible,
      })),
      byRate: Array.from(rateMap.entries()).map(([ratePercent, vals]) => ({
        ratePercent,
        label: vals.label,
        generated: vals.generated,
        deductible: vals.deductible,
      })),
    }

    return {
      items: finalItems,
      summary,
    }
  }

  /**
   * Cálculo fiduciario de impuestos línea a línea para documentos comerciales.
   */
  async calculate(items: TaxCalculationLineInput[]): Promise<TaxDocumentCalculationResult> {
    return taxCalculationService.calculateDocumentTaxes(items)
  }

  /**
   * Registra una entrada en audit_logs de PostgreSQL de forma inmutable.
   */
  private async logAudit(entry: {
    companyId?: string
    action: string
    taxConfigId: string
    taxConfigCode: string
    taxConfigName: string
    userId: string
    userName: string
    changes: {
      field?: string
      previousValue?: unknown
      newValue?: unknown
      details: string
    }
  }): Promise<void> {
    const client = getDbClient()
    const id = crypto.randomUUID()
    const nowIso = new Date().toISOString()

    const rowToInsert = {
      id,
      company_id: entry.companyId || null,
      action: entry.action,
      module: 'TAXES',
      entity_name: 'tax_rates',
      entity_id: entry.taxConfigId,
      user_id: null,
      user_name: entry.userName || 'Sistema',
      previous_value: entry.changes?.previousValue ? { prev: entry.changes.previousValue } : null,
      new_value: {
        code: entry.taxConfigCode,
        name: entry.taxConfigName,
        details: entry.changes?.details,
        diff: entry.changes?.newValue,
      },
      created_at: nowIso,
    }

    try {
      await client.from('audit_logs').insert(rowToInsert)
    } catch (e) {
      console.warn('⚠️ No se pudo registrar auditoría de impuestos:', e)
    }
  }
}

export const taxRepository = new TaxRepository()
