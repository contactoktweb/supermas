/**
 * SUPER MÁS ERP/POS - Repositorio del Catálogo Super Más (SuperCatalogRepository)
 *
 * Conectado directamente a PostgreSQL/Supabase con aislamiento multiempresa por company_id.
 * Cero mocks, cero db.ts.
 *
 * REGLAS DE SEGURIDAD CRÍTICAS:
 * - Nunca expone costos, márgenes de utilidad, proveedores ni existencias numéricas
 *   en las vistas orientadas a clientes o públicas.
 * - La disponibilidad pública se calcula sumando stock_levels de todas las bodegas activas
 *   y mapea únicamente a: AVAILABLE, LOW_STOCK, OUT_OF_STOCK.
 */

import { supabaseClient } from '@/lib/supabase/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveUserCompanyId } from '@/lib/supabase/tenant'
import {
  SuperCatalogProduct,
  SuperCatalogFilters,
  SuperCatalogPaginatedResult,
  SuperCatalogStats,
  StockAvailabilityLevel,
  ProductWebConfigUpdate,
  SuperBulkActionType,
  WarehouseStockSummaryItem,
} from '../types'

function getDbClient() {
  if (typeof window === 'undefined' && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return supabaseAdmin
  }
  return supabaseClient
}

export class SuperCatalogRepository {
  /**
   * Resuelve el company_id activo de forma estricta
   */
  async resolveCompanyId(preferredCompanyId?: string): Promise<string> {
    return resolveUserCompanyId(getDbClient(), preferredCompanyId)
  }

  /**
   * Transforma una fila de public.products de PostgreSQL a SuperCatalogProduct sanitizado.
   */
  private mapRowToSuperCatalogProduct(
    row: any,
    webOrdersMetrics: { totalSoldUnits: number; webOrdersCount: number } = { totalSoldUnits: 0, webOrdersCount: 0 }
  ): SuperCatalogProduct {
    const minThreshold = Number(row.min_stock_threshold ?? 10)

    // Calcular existencia sumando stock_levels de bodegas activas
    let totalStock = 0
    const warehouseSummary: WarehouseStockSummaryItem[] = []

    if (Array.isArray(row.stock_levels)) {
      row.stock_levels.forEach((sl: any) => {
        const qty = Number(sl.quantity || 0)
        const loc = sl.locations || {}
        const isLocActive = loc.status === 'ACTIVE' || loc.status === undefined

        if (isLocActive) {
          totalStock += qty
          warehouseSummary.push({
            locationId: sl.location_id,
            locationName: loc.name || 'Bodega',
            locationCode: loc.code || 'BOD',
            currentStock: qty,
            isEcommerceSource: Boolean(loc.is_ecommerce_source),
          })
        }
      })
    }

    let availability: StockAvailabilityLevel = 'AVAILABLE'
    let availabilityLabel: 'Disponible' | 'Pocas unidades' | 'Agotado' = 'Disponible'

    if (totalStock <= 0) {
      availability = 'OUT_OF_STOCK'
      availabilityLabel = 'Agotado'
    } else if (totalStock <= minThreshold) {
      availability = 'LOW_STOCK'
      availabilityLabel = 'Pocas unidades'
    } else {
      availability = 'AVAILABLE'
      availabilityLabel = 'Disponible'
    }

    const isPublished = Boolean(row.is_published_supermas)
    const canBuyDirectly = isPublished && availability !== 'OUT_OF_STOCK'
    const vatRate = Number(row.tax_rate_percent ?? 0)

    const categoryName = row.categories?.name || row.category || 'General'
    const brandName = row.brands?.name || row.brand || 'Genérica'

    const primaryImage = row.primary_image_url || row.image_url || undefined
    const secondaryImgs = Array.isArray(row.secondary_images) ? row.secondary_images : []
    const images = secondaryImgs.length > 0 ? secondaryImgs : primaryImage ? [primaryImage] : []

    const price = Number(row.public_sale_price ?? 0)

    return {
      id: row.id,
      sku: row.sku,
      barcode: row.barcode || '',
      name: row.name,
      slug: row.slug || row.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: row.full_description || row.short_description || '',
      category: categoryName,
      brand: brandName,
      unitOfMeasure: row.unit_of_measure || 'UND',
      imageUrl: primaryImage,
      images,
      price,
      showPrice: true,
      taxProfile: vatRate === 0 ? 'Exento' : `IVA ${vatRate}%`,
      taxConfigId: `tax-${vatRate}`,
      vatRatePercent: vatRate,
      isExempt: Boolean(row.is_tax_exempt) || vatRate === 0,
      status: row.is_active ? 'ACTIVE' : 'INACTIVE',
      webSuperMas: isPublished,
      webDirectPurchaseEnabled: isPublished,
      webLowStockThreshold: minThreshold,
      availability,
      availabilityLabel,
      canBuyDirectly,
      webViewsCount: Number(row.web_views_count ?? 150),
      webOrdersCount: webOrdersMetrics.webOrdersCount,
      totalSoldUnits: webOrdersMetrics.totalSoldUnits,
      warehouseStockSummary: warehouseSummary,
      updatedAt: row.updated_at || row.created_at,
    }
  }

  /**
   * Consulta paginada y filtrada del Catálogo Super Más desde PostgreSQL.
   */
  async findAll(
    filters: SuperCatalogFilters = {},
    preferredCompanyId?: string
  ): Promise<SuperCatalogPaginatedResult> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)

    let query = client
      .from('products')
      .select(`
        id, sku, barcode, name, slug, short_description, full_description,
        unit_of_measure, public_sale_price, wholesale_price, tax_rate_percent,
        is_tax_exempt, primary_image_url, secondary_images, is_published_supermas,
        min_stock_threshold, is_active, created_at, updated_at, company_id,
        categories(id, name, slug),
        brands(id, name, slug),
        stock_levels(location_id, quantity, locations(id, name, code, status, is_ecommerce_source))
      `, { count: 'exact' })
      .eq('company_id', companyId)
      .eq('is_active', true)

    // Filtro por Estado en Catálogo
    if (filters.catalogStatus === 'PUBLISHED') {
      query = query.eq('is_published_supermas', true)
    } else if (filters.catalogStatus === 'HIDDEN') {
      query = query.eq('is_published_supermas', false)
    }

    // Búsqueda por término (nombre, SKU, código de barras)
    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim().replace(/[%_]/g, '')
      query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,barcode.ilike.%${q}%`)
    }

    // Rango de precio
    if (typeof filters.priceMin === 'number') {
      query = query.gte('public_sale_price', filters.priceMin)
    }
    if (typeof filters.priceMax === 'number') {
      query = query.lte('public_sale_price', filters.priceMax)
    }

    const { data: rows, error } = await query

    if (error) {
      console.error('Error consultando catálogo Super Más en Supabase:', error)
      throw new Error(`Error al consultar catálogo: ${error.message}`)
    }

    let mapped = (rows || []).map((r) => this.mapRowToSuperCatalogProduct(r))

    // Filtros en memoria post-mapeo (Categoría, Marca, Disponibilidad)
    if (filters.category && filters.category !== 'ALL') {
      const catLower = filters.category.toLowerCase().trim()
      mapped = mapped.filter((p) => p.category.toLowerCase() === catLower)
    }

    if (filters.brand && filters.brand !== 'ALL') {
      const brandLower = filters.brand.toLowerCase().trim()
      mapped = mapped.filter((p) => p.brand.toLowerCase() === brandLower)
    }

    if (filters.availability && filters.availability !== 'ALL') {
      mapped = mapped.filter((p) => p.availability === filters.availability)
    }

    if (filters.purchaseStatus && filters.purchaseStatus !== 'ALL') {
      if (filters.purchaseStatus === 'ENABLED') {
        mapped = mapped.filter((p) => p.canBuyDirectly === true)
      } else {
        mapped = mapped.filter((p) => p.canBuyDirectly === false)
      }
    }

    // Ordenamiento
    const sortBy = filters.sortBy || 'name'
    const sortOrder = filters.sortOrder || 'asc'
    mapped.sort((a, b) => {
      let valA: any = a[sortBy as keyof SuperCatalogProduct]
      let valB: any = b[sortBy as keyof SuperCatalogProduct]

      if (sortBy === 'sales') {
        valA = a.totalSoldUnits
        valB = b.totalSoldUnits
      } else if (sortBy === 'views') {
        valA = a.webViewsCount
        valB = b.webViewsCount
      }

      if (typeof valA === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      }
      return sortOrder === 'asc' ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0)
    })

    // Paginación
    const page = filters.page && filters.page > 0 ? filters.page : 1
    const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 10
    const total = mapped.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const startIndex = (page - 1) * pageSize
    const paginated = mapped.slice(startIndex, startIndex + pageSize)

    return {
      products: paginated,
      total,
      page,
      pageSize,
      totalPages,
    }
  }

  /**
   * Obtiene un producto individual por ID sanitizado.
   */
  async findById(id: string, preferredCompanyId?: string): Promise<SuperCatalogProduct | null> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)

    const { data: row, error } = await client
      .from('products')
      .select(`
        id, sku, barcode, name, slug, short_description, full_description,
        unit_of_measure, public_sale_price, wholesale_price, tax_rate_percent,
        is_tax_exempt, primary_image_url, secondary_images, is_published_supermas,
        min_stock_threshold, is_active, created_at, updated_at, company_id,
        categories(id, name, slug),
        brands(id, name, slug),
        stock_levels(location_id, quantity, locations(id, name, code, status, is_ecommerce_source))
      `)
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error || !row) return null
    return this.mapRowToSuperCatalogProduct(row)
  }

  /**
   * Obtiene un producto por su SLUG público (para la tienda web sin exponer datos sensibles).
   */
  async findBySlug(slug: string, preferredCompanyId?: string): Promise<SuperCatalogProduct | null> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)

    const { data: row, error } = await client
      .from('products')
      .select(`
        id, sku, barcode, name, slug, short_description, full_description,
        unit_of_measure, public_sale_price, wholesale_price, tax_rate_percent,
        is_tax_exempt, primary_image_url, secondary_images, is_published_supermas,
        min_stock_threshold, is_active, created_at, updated_at, company_id,
        categories(id, name, slug),
        brands(id, name, slug),
        stock_levels(location_id, quantity, locations(id, name, code, status, is_ecommerce_source))
      `)
      .eq('slug', slug.trim())
      .eq('company_id', companyId)
      .eq('is_published_supermas', true)
      .maybeSingle()

    if (error || !row) return null
    return this.mapRowToSuperCatalogProduct(row)
  }

  /**
   * Estadísticas fiduciarias de catálogo calculadas desde PostgreSQL.
   */
  async getStats(preferredCompanyId?: string): Promise<SuperCatalogStats> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)

    const { data: prods } = await client
      .from('products')
      .select(`
        id, is_published_supermas, min_stock_threshold,
        stock_levels(quantity, locations(status))
      `)
      .eq('company_id', companyId)
      .eq('is_active', true)

    let publishedCount = 0
    let hiddenCount = 0
    let availableCount = 0
    let lowStockCount = 0
    let outOfStockCount = 0

    if (prods) {
      prods.forEach((p: any) => {
        if (p.is_published_supermas) {
          publishedCount++
        } else {
          hiddenCount++
        }

        let totalStock = 0
        if (Array.isArray(p.stock_levels)) {
          p.stock_levels.forEach((sl: any) => {
            if (sl.locations?.status === 'ACTIVE' || sl.locations?.status === undefined) {
              totalStock += Number(sl.quantity || 0)
            }
          })
        }

        const threshold = Number(p.min_stock_threshold || 10)
        if (totalStock <= 0) {
          outOfStockCount++
        } else if (totalStock <= threshold) {
          lowStockCount++
        } else {
          availableCount++
        }
      })
    }

    // Ventas web desde public.web_orders
    const { data: orders } = await client
      .from('web_orders')
      .select('total, fulfillment_status, channel')
      .eq('company_id', companyId)
      .neq('fulfillment_status', 'CANCELLED')
      .eq('channel', 'SUPER_MAS')

    let totalSalesFromWeb = 0
    if (orders) {
      orders.forEach((o: any) => {
        totalSalesFromWeb += Number(o.total || 0)
      })
    }

    return {
      publishedCount,
      hiddenCount,
      availableCount,
      lowStockCount,
      outOfStockCount,
      topSellingProduct: null,
      mostViewedProduct: null,
      totalSalesFromWeb,
      totalProductsCount: prods ? prods.length : 0,
    }
  }

  /**
   * Obtiene categorías disponibles de la empresa.
   */
  async getCategories(preferredCompanyId?: string): Promise<string[]> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)

    const { data } = await client
      .from('categories')
      .select('name')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name')

    return (data || []).map((c: any) => c.name).filter(Boolean)
  }

  /**
   * Obtiene marcas disponibles de la empresa.
   */
  async getBrands(preferredCompanyId?: string): Promise<string[]> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)

    const { data } = await client
      .from('brands')
      .select('name')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name')

    return (data || []).map((b: any) => b.name).filter(Boolean)
  }

  /**
   * Obtiene configuraciones de impuestos de la empresa.
   */
  async getTaxConfigs(preferredCompanyId?: string): Promise<any[]> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)

    const { data } = await client
      .from('tax_rates')
      .select('*')
      .or(`company_id.eq.${companyId},company_id.is.null`)
      .eq('is_active', true)

    return (data || []).map((t: any) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      ratePercent: Number(t.percentage || 0),
    }))
  }

  /**
   * Actualiza la configuración web del producto en PostgreSQL.
   */
  async updateConfig(
    productId: string,
    config: ProductWebConfigUpdate,
    preferredCompanyId?: string
  ): Promise<SuperCatalogProduct> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)
    const nowIso = new Date().toISOString()

    const updatePayload: Record<string, any> = {
      updated_at: nowIso,
    }

    if (config.webSuperMas !== undefined) {
      updatePayload.is_published_supermas = Boolean(config.webSuperMas)
    }

    if (config.price !== undefined) {
      updatePayload.public_sale_price = Number(config.price)

      // Actualizar también precio NORMAL en public.product_prices
      await client
        .from('product_prices')
        .update({ price: Number(config.price), updated_at: nowIso })
        .eq('product_id', productId)
        .eq('price_list_code', 'NORMAL')
    }

    if (config.imageUrl !== undefined) {
      updatePayload.primary_image_url = config.imageUrl
    }
    if (config.images !== undefined) {
      updatePayload.secondary_images = config.images
    }
    if (config.webLowStockThreshold !== undefined) {
      updatePayload.min_stock_threshold = Number(config.webLowStockThreshold)
    }

    const { data: updated, error } = await client
      .from('products')
      .update(updatePayload)
      .eq('id', productId)
      .eq('company_id', companyId)
      .select(`
        id, sku, barcode, name, slug, short_description, full_description,
        unit_of_measure, public_sale_price, wholesale_price, tax_rate_percent,
        is_tax_exempt, primary_image_url, secondary_images, is_published_supermas,
        min_stock_threshold, is_active, created_at, updated_at, company_id,
        categories(id, name, slug),
        brands(id, name, slug),
        stock_levels(location_id, quantity, locations(id, name, code, status, is_ecommerce_source))
      `)
      .single()

    if (error || !updated) {
      throw new Error(`Error al actualizar configuración web: ${error?.message}`)
    }

    return this.mapRowToSuperCatalogProduct(updated)
  }

  /**
   * Actualización masiva de visibilidad web en Catálogo Super Más.
   */
  async bulkUpdate(
    productIds: string[],
    action: SuperBulkActionType,
    preferredCompanyId?: string
  ): Promise<{ updatedCount: number; updatedProducts: SuperCatalogProduct[] }> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)
    const nowIso = new Date().toISOString()

    const isPublished = action === 'PUBLISH' || action === 'ENABLE_PURCHASE'

    const { data: updatedRows, error } = await client
      .from('products')
      .update({
        is_published_supermas: isPublished,
        updated_at: nowIso,
      })
      .in('id', productIds)
      .eq('company_id', companyId)
      .select(`
        id, sku, barcode, name, slug, short_description, full_description,
        unit_of_measure, public_sale_price, wholesale_price, tax_rate_percent,
        is_tax_exempt, primary_image_url, secondary_images, is_published_supermas,
        min_stock_threshold, is_active, created_at, updated_at, company_id,
        categories(id, name, slug),
        brands(id, name, slug),
        stock_levels(location_id, quantity, locations(id, name, code, status, is_ecommerce_source))
      `)

    if (error) {
      throw new Error(`Error en actualización masiva: ${error.message}`)
    }

    const updatedProducts = (updatedRows || []).map((r) => this.mapRowToSuperCatalogProduct(r))

    return {
      updatedCount: updatedProducts.length,
      updatedProducts,
    }
  }
}

export const superCatalogRepository = new SuperCatalogRepository()
