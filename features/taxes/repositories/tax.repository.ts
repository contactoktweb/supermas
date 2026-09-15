/**
 * SUPER MÁS ERP/POS - Repositorio de Impuestos
 *
 * Conecta directamente con la capa de datos de Supabase (db.ts / mock-db)
 * integrando tax_configs, products, sales, purchases, invoices, accounting_entries y audit_logs.
 */

import { db } from '@/lib/supabase/db'
import {
  TaxConfig,
  TaxFilters,
  TaxStats,
  TaxAssociatedProduct,
  TaxReportItem,
  TaxReportSummary,
  TaxReportFilters,
} from '../types'
import { TaxConfigFormData } from '../schemas/tax.schema'

class TaxRepository {
  private getTodayStr(): string {
    return new Date().toISOString().split('T')[0]
  }

  /**
   * Obtiene la lista filtrada, ordenada y paginada de configuraciones tributarias
   * enriquecida con métricas relacionales de productos asociados.
   */
  async findAll(filters?: TaxFilters): Promise<{ data: TaxConfig[]; total: number }> {
    const today = this.getTodayStr()
    const allConfigs = (db.taxConfigs as unknown as TaxConfig[]) || []
    const allProducts = db.products || []

    // Mapeo dinámico de productos asociados por taxConfigId o código
    const productCountMap = new Map<string, number>()
    for (const prod of allProducts) {
      const cfgId = (prod as any).taxConfigId
      const code = (prod as any).taxProfile
      if (cfgId) {
        productCountMap.set(cfgId, (productCountMap.get(cfgId) || 0) + 1)
      }
      if (code) {
        productCountMap.set(`code-${code}`, (productCountMap.get(`code-${code}`) || 0) + 1)
      }
    }

    let filtered = allConfigs.map((cfg) => {
      const byId = productCountMap.get(cfg.id) || 0
      const byCode = productCountMap.get(`code-${cfg.code}`) || 0
      return {
        ...cfg,
        associatedProductsCount: Math.max(byId, byCode),
      }
    })

    // Filtro por texto de búsqueda
    if (filters?.query) {
      const q = filters.query.toLowerCase().trim()
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.code.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q))
      )
    }

    // Filtro por tipo de impuesto
    if (filters?.type && filters.type !== 'ALL') {
      filtered = filtered.filter((t) => t.type === filters.type)
    }

    // Filtro por estado
    if (filters?.status && filters.status !== 'ALL') {
      filtered = filtered.filter((t) => t.status === filters.status)
    }

    // Filtro por vigencia
    if (filters?.vigencia && filters.vigencia !== 'ALL') {
      if (filters.vigencia === 'ACTIVE') {
        filtered = filtered.filter(
          (t) =>
            t.status === 'ACTIVE' &&
            t.validFrom <= today &&
            (t.validUntil === null || t.validUntil >= today)
        )
      } else if (filters.vigencia === 'EXPIRED') {
        filtered = filtered.filter((t) => t.validUntil !== null && t.validUntil < today)
      } else if (filters.vigencia === 'FUTURE') {
        filtered = filtered.filter((t) => t.validFrom > today)
      }
    }

    // Ordenamiento
    const sortBy = filters?.sortBy || 'RATE_DESC'
    filtered.sort((a, b) => {
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

    const total = filtered.length
    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 10
    const startIdx = (page - 1) * pageSize
    const paginated = filtered.slice(startIdx, startIdx + pageSize)

    return {
      data: JSON.parse(JSON.stringify(paginated)),
      total,
    }
  }

  /**
   * Encuentra una configuración por ID con estadísticas detalladas de uso en ventas y compras.
   */
  async findById(id: string): Promise<TaxConfig | null> {
    const allConfigs = (db.taxConfigs as unknown as TaxConfig[]) || []
    const config = allConfigs.find((c) => c.id === id)
    if (!config) return null

    // Calcular estadísticas de uso en ventas
    const allSales = db.sales || []
    let salesCount = 0
    let totalSalesTaxAmount = 0
    for (const sale of allSales) {
      let saleHasTax = false
      for (const item of sale.items || []) {
        if (
          item.taxRatePercent === config.ratePercent ||
          (item as any).taxConfigId === config.id
        ) {
          totalSalesTaxAmount += item.taxAmount || 0
          saleHasTax = true
        }
      }
      if (saleHasTax) salesCount++
    }

    // Calcular estadísticas de uso en compras
    const allPurchases = db.purchases || []
    let purchasesCount = 0
    let totalPurchasesTaxAmount = 0
    for (const pur of allPurchases) {
      let purHasTax = false
      for (const item of (pur as any).items || []) {
        if (
          item.taxRatePercent === config.ratePercent ||
          item.taxCode === config.code ||
          (item as any).taxConfigId === config.id
        ) {
          totalPurchasesTaxAmount += item.taxAmount || 0
          purHasTax = true
        }
      }
      if (purHasTax) purchasesCount++
    }

    // Productos asociados
    const allProducts = db.products || []
    const associatedProductsCount = allProducts.filter(
      (p) => (p as any).taxConfigId === config.id || p.taxProfile === config.code
    ).length

    return {
      ...JSON.parse(JSON.stringify(config)),
      associatedProductsCount,
      salesCount,
      totalSalesTaxAmount,
      purchasesCount,
      totalPurchasesTaxAmount,
    }
  }

  /**
   * Encuentra una configuración por código exacto.
   */
  async findByCode(code: string): Promise<TaxConfig | null> {
    const allConfigs = (db.taxConfigs as unknown as TaxConfig[]) || []
    const found = allConfigs.find(
      (c) => c.code.toLowerCase() === code.trim().toLowerCase()
    )
    return found ? JSON.parse(JSON.stringify(found)) : null
  }

  /**
   * Crea una nueva configuración tributaria en db.taxConfigs y registra auditoría.
   */
  async create(
    data: TaxConfigFormData,
    user: { id: string; name: string }
  ): Promise<TaxConfig> {
    const newId = `tax-${data.code.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`
    const nowIso = new Date().toISOString()

    const newConfig: TaxConfig = {
      id: newId,
      name: data.name,
      code: data.code,
      type: data.type,
      ratePercent: Number(data.ratePercent),
      status: data.status,
      validFrom: data.validFrom,
      validUntil: data.validUntil || null,
      description: data.description || '',
      isDefault: Boolean(data.isDefault),
      generatedTaxAccountId: data.generatedTaxAccountId || '',
      generatedTaxAccountName: data.generatedTaxAccountName || '',
      deductibleTaxAccountId: data.deductibleTaxAccountId || '',
      deductibleTaxAccountName: data.deductibleTaxAccountName || '',
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    }

    // Insertar en almacén mock
    ;(db.taxConfigs as any[]).push(newConfig)

    // Auditoría
    this.logAudit({
      action: 'TAX_CONFIG_CREATED',
      taxConfigId: newConfig.id,
      taxConfigCode: newConfig.code,
      taxConfigName: newConfig.name,
      userId: user.id,
      userName: user.name,
      changes: {
        field: 'all',
        newValue: newConfig,
        details: `Configuración tributaria ${newConfig.name} (${newConfig.code} - ${newConfig.ratePercent}%) creada exitosamente.`,
      },
    })

    return JSON.parse(JSON.stringify(newConfig))
  }

  /**
   * Actualiza una configuración existente y registra auditoría.
   */
  async update(
    id: string,
    data: Partial<TaxConfigFormData>,
    user: { id: string; name: string }
  ): Promise<TaxConfig> {
    const allConfigs = db.taxConfigs as any[]
    const index = allConfigs.findIndex((c) => c.id === id)
    if (index === -1) {
      throw new Error(`Configuración de impuesto con ID ${id} no encontrada.`)
    }

    const previous = { ...allConfigs[index] }
    const nowIso = new Date().toISOString()

    const updated: TaxConfig = {
      ...previous,
      ...(data.name && { name: data.name }),
      ...(data.type && { type: data.type }),
      ...(data.ratePercent !== undefined && { ratePercent: Number(data.ratePercent) }),
      ...(data.status && { status: data.status }),
      ...(data.validFrom && { validFrom: data.validFrom }),
      validUntil: data.validUntil !== undefined ? data.validUntil : previous.validUntil,
      description: data.description !== undefined ? data.description : previous.description,
      isDefault: data.isDefault !== undefined ? Boolean(data.isDefault) : previous.isDefault,
      generatedTaxAccountId:
        data.generatedTaxAccountId !== undefined
          ? data.generatedTaxAccountId
          : previous.generatedTaxAccountId,
      generatedTaxAccountName:
        data.generatedTaxAccountName !== undefined
          ? data.generatedTaxAccountName
          : previous.generatedTaxAccountName,
      deductibleTaxAccountId:
        data.deductibleTaxAccountId !== undefined
          ? data.deductibleTaxAccountId
          : previous.deductibleTaxAccountId,
      deductibleTaxAccountName:
        data.deductibleTaxAccountName !== undefined
          ? data.deductibleTaxAccountName
          : previous.deductibleTaxAccountName,
      version: (previous.version || 1) + 1,
      updatedAt: nowIso,
    }

    allConfigs[index] = updated

    // Auditoría
    const isRateChange = previous.ratePercent !== updated.ratePercent
    this.logAudit({
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
          ? `Tarifa modificada de ${previous.ratePercent}% a ${updated.ratePercent}%. Versión incrementada a v${updated.version}.`
          : `Actualizada información general de ${updated.name}.`,
      },
    })

    return JSON.parse(JSON.stringify(updated))
  }

  /**
   * Desactiva una configuración (soft-delete para proteger históricos).
   */
  async deactivate(
    id: string,
    reason: string,
    user: { id: string; name: string }
  ): Promise<TaxConfig> {
    const allConfigs = db.taxConfigs as any[]
    const index = allConfigs.findIndex((c) => c.id === id)
    if (index === -1) {
      throw new Error(`Configuración de impuesto con ID ${id} no encontrada.`)
    }

    const previous = { ...allConfigs[index] }
    const today = this.getTodayStr()
    const nowIso = new Date().toISOString()

    const updated: TaxConfig = {
      ...previous,
      status: 'INACTIVE',
      validUntil: previous.validUntil || today,
      version: (previous.version || 1) + 1,
      updatedAt: nowIso,
    }

    allConfigs[index] = updated

    this.logAudit({
      action: 'TAX_CONFIG_DEACTIVATED',
      taxConfigId: updated.id,
      taxConfigCode: updated.code,
      taxConfigName: updated.name,
      userId: user.id,
      userName: user.name,
      changes: {
        field: 'status',
        previousValue: previous.status,
        newValue: 'INACTIVE',
        details: `Configuración desactivada. Motivo: ${reason || 'Desactivación administrativa'}. Histórico protegido.`,
      },
    })

    return JSON.parse(JSON.stringify(updated))
  }

  /**
   * Reactiva una configuración tributaria.
   */
  async activate(id: string, user: { id: string; name: string }): Promise<TaxConfig> {
    const allConfigs = db.taxConfigs as any[]
    const index = allConfigs.findIndex((c) => c.id === id)
    if (index === -1) {
      throw new Error(`Configuración de impuesto con ID ${id} no encontrada.`)
    }

    const previous = { ...allConfigs[index] }
    const nowIso = new Date().toISOString()

    const updated: TaxConfig = {
      ...previous,
      status: 'ACTIVE',
      validUntil: null,
      version: (previous.version || 1) + 1,
      updatedAt: nowIso,
    }

    allConfigs[index] = updated

    this.logAudit({
      action: 'TAX_CONFIG_ACTIVATED',
      taxConfigId: updated.id,
      taxConfigCode: updated.code,
      taxConfigName: updated.name,
      userId: user.id,
      userName: user.name,
      changes: {
        field: 'status',
        previousValue: previous.status,
        newValue: 'ACTIVE',
        details: `Configuración reactivada para nuevos productos y documentos.`,
      },
    })

    return JSON.parse(JSON.stringify(updated))
  }

  /**
   * Retorna las estadísticas tributarias globales del ERP calculadas desde db.
   */
  async getStats(): Promise<TaxStats> {
    const allConfigs = (db.taxConfigs as unknown as TaxConfig[]) || []
    const allProducts = db.products || []
    const allSales = db.sales || []
    const allPurchases = db.purchases || []

    const activeConfigsCount = allConfigs.filter((c) => c.status === 'ACTIVE').length

    let taxedProductsCount = 0
    let exemptProductsCount = 0

    for (const prod of allProducts) {
      if ((prod as any).vatRatePercent > 0) {
        taxedProductsCount++
      } else {
        exemptProductsCount++
      }
    }

    const salesWithTaxesCount = allSales.filter((s) => (s.taxTotal || 0) > 0).length
    const purchasesWithTaxesCount = allPurchases.filter(
      (p) => (p.taxTotal || 0) > 0
    ).length

    // Impuesto generado en ventas (IVA Débito Fiscal)
    const generatedTaxPeriod = allSales.reduce(
      (acc, s) => acc + (s.taxTotal || 0),
      0
    )

    // Impuesto descontable en compras (IVA Crédito Fiscal)
    const deductibleTaxPeriod = allPurchases.reduce(
      (acc, p) => acc + (p.taxTotal || 0),
      0
    )

    const netTaxPayable = generatedTaxPeriod - deductibleTaxPeriod

    return {
      activeConfigsCount,
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
   * Consulta paginada y filtrable de productos vinculados a una configuración tributaria.
   */
  async getAssociatedProducts(
    taxConfigId: string,
    filters?: { query?: string; page?: number; pageSize?: number }
  ): Promise<{ data: TaxAssociatedProduct[]; total: number }> {
    const allConfigs = (db.taxConfigs as unknown as TaxConfig[]) || []
    const config = allConfigs.find((c) => c.id === taxConfigId)
    const configName = config?.name || 'Configuración Tributaria'
    const configRate = config?.ratePercent || 0
    const configCode = config?.code || ''

    const allProducts = db.products || []
    let associated = allProducts.filter(
      (p) => (p as any).taxConfigId === taxConfigId || p.taxProfile === configCode
    )

    if (filters?.query) {
      const q = filters.query.toLowerCase().trim()
      associated = associated.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q)
      )
    }

    const total = associated.length
    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 10
    const startIdx = (page - 1) * pageSize
    const paginated = associated.slice(startIdx, startIdx + pageSize)

    const mapped: TaxAssociatedProduct[] = paginated.map((p) => ({
      id: p.id,
      sku: p.sku,
      barcode: p.barcode,
      name: p.name,
      category: p.category,
      brand: p.brand,
      normalPrice: p.normalPrice,
      wholesalePrice: p.wholesalePrice,
      unitOfMeasure: p.unitOfMeasure,
      status: p.status,
      taxProfile: p.taxProfile,
      taxConfigId: (p as any).taxConfigId || taxConfigId,
      taxConfigName: configName,
      ratePercent: (p as any).vatRatePercent !== undefined ? (p as any).vatRatePercent : configRate,
      totalStock: p.totalStock,
    }))

    return {
      data: mapped,
      total,
    }
  }

  /**
   * Genera el informe tributario consolidado a partir de ventas, compras y facturas.
   */
  async getTaxReports(filters?: TaxReportFilters): Promise<{
    items: TaxReportItem[]
    summary: TaxReportSummary
  }> {
    const allSales = db.sales || []
    const allPurchases = db.purchases || []
    const reportItems: TaxReportItem[] = []

    // 1. Procesar Ventas (Impuesto Generado)
    for (const s of allSales) {
      if (filters?.documentType && filters.documentType !== 'ALL' && filters.documentType !== 'SALE') {
        continue
      }
      if (filters?.locationId && filters.locationId !== 'ALL' && s.locationId !== filters.locationId) {
        continue
      }
      if (filters?.dateFrom && s.date < filters.dateFrom) continue
      if (filters?.dateUntil && s.date > filters.dateUntil) continue

      for (const item of s.items || []) {
        if ((item.taxAmount || 0) >= 0) {
          reportItems.push({
            id: `rep-sale-${s.id}-${item.id}`,
            documentNumber: s.saleNumber,
            documentType: 'SALE',
            date: s.date,
            locationId: s.locationId,
            locationName: s.locationName,
            thirdPartyDoc: s.customerDoc,
            thirdPartyName: s.customerName,
            taxConfigCode: item.taxRatePercent === 19 ? 'IVA_19' : item.taxRatePercent === 5 ? 'IVA_5' : 'EXENTO',
            taxConfigName: item.taxRatePercent === 19 ? 'IVA General 19%' : item.taxRatePercent === 5 ? 'IVA Reducido 5%' : 'Exento',
            ratePercent: item.taxRatePercent || 0,
            baseAmount: item.subtotal || 0,
            taxAmount: item.taxAmount || 0,
            totalAmount: item.total || 0,
            operationType: 'GENERATED',
          })
        }
      }
    }

    // 2. Procesar Compras (Impuesto Descontable)
    for (const p of allPurchases) {
      if (filters?.documentType && filters.documentType !== 'ALL' && filters.documentType !== 'PURCHASE') {
        continue
      }
      if (filters?.locationId && filters.locationId !== 'ALL' && p.locationId !== filters.locationId) {
        continue
      }
      if (filters?.dateFrom && p.date < filters.dateFrom) continue
      if (filters?.dateUntil && p.date > filters.dateUntil) continue

      for (const item of (p as any).items || []) {
        reportItems.push({
          id: `rep-pur-${p.id}-${item.id}`,
          documentNumber: p.purchaseNumber,
          documentType: 'PURCHASE',
          date: p.date,
          locationId: p.locationId || (p as any).destinationLocationId,
          locationName: (p as any).destinationLocationName || 'Bodega Principal',
          thirdPartyDoc: p.supplierNit || '',
          thirdPartyName: p.supplierName || '',
          taxConfigCode: item.taxCode || (item.taxRatePercent === 19 ? 'IVA_19' : 'EXENTO'),
          taxConfigName: item.taxCode === 'EXENTO' ? 'Exento de IVA' : `IVA ${item.taxRatePercent}%`,
          ratePercent: item.taxRatePercent || 0,
          baseAmount: item.subtotal || 0,
          taxAmount: item.taxAmount || 0,
          totalAmount: item.total || 0,
          operationType: 'DEDUCTIBLE',
        })
      }
    }

    // Filtrar por impuesto si se especificó
    let finalItems = reportItems
    if (filters?.taxConfigId && filters.taxConfigId !== 'ALL') {
      finalItems = finalItems.filter((i) => i.taxConfigCode.includes(filters.taxConfigId!) || i.ratePercent.toString() === filters.taxConfigId)
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
   * Registra una entrada en audit_logs.json a través de db.auditLogs.
   */
  logAudit(entry: {
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
  }): void {
    const auditRecord = {
      id: `aud-tax-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      action: entry.action,
      locationId: 'loc-001',
      locationName: 'Sede Principal (CEDI)',
      userId: entry.userId,
      userName: entry.userName,
      timestamp: 'Justo ahora',
      changes: entry.changes,
    }
    ;(db.auditLogs as any[]).unshift(auditRecord)
  }
}

export const taxRepository = new TaxRepository()
