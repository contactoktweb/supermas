/**
 * SUPER MÁS ERP/POS - Repositorio de Catálogo Distribuidora (DistributorCatalogRepository)
 *
 * Conectado directamente a PostgreSQL/Supabase con aislamiento multiempresa por company_id.
 * Cero mocks, cero db.ts.
 *
 * REGLAS DE SEGURIDAD CRÍTICAS:
 * - Sanitiza cualquier dato sensible de costos, márgenes o proveedores.
 * - La disponibilidad pública se calcula sumando stock_levels de todas las bodegas activas
 *   y mapea únicamente a: AVAILABLE, LOW_STOCK, OUT_OF_STOCK.
 */

import { supabaseClient } from '@/lib/supabase/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveUserCompanyId } from '@/lib/supabase/tenant'
import {
  DistributorCatalogProduct,
  DistributorCatalogFilters,
  DistributorCatalogPaginatedResult,
  DistributorCatalogStats,
  StockAvailabilityLevel,
  ProductCatalogConfigUpdate,
  BulkActionType,
} from '../types'

function getDbClient() {
  if (typeof window === 'undefined' && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return supabaseAdmin
  }
  return supabaseClient
}

export class DistributorCatalogRepository {
  /**
   * Resuelve el company_id activo de forma estricta
   */
  async resolveCompanyId(preferredCompanyId?: string): Promise<string> {
    return resolveUserCompanyId(getDbClient(), preferredCompanyId)
  }

  /**
   * Transforma y sanitiza una fila de public.products a DistributorCatalogProduct.
   * Elimina cualquier campo sensible (costos, márgenes, compras, proveedores).
   */
  private mapRowToCatalogProduct(row: any): DistributorCatalogProduct {
    const minThreshold = Number(row.min_stock_threshold ?? 10)

    // Calcular existencia sumando stock_levels de bodegas activas
    let totalStock = 0
    if (Array.isArray(row.stock_levels)) {
      row.stock_levels.forEach((sl: any) => {
        const qty = Number(sl.quantity || 0)
        const loc = sl.locations || {}
        const isLocActive = loc.status === 'ACTIVE' || loc.status === undefined
        if (isLocActive) {
          totalStock += qty
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

    const isDistributorActive = Boolean(row.is_published_distributor)
    const isSuperMasActive = Boolean(row.is_published_supermas)
    const canBuyDirectly = isDistributorActive && isSuperMasActive && availability !== 'OUT_OF_STOCK'
    const canContactWhatsApp = isDistributorActive

    const phone = '573128849021'
    const message = encodeURIComponent(
      `Hola Distribuidora Super Más, estoy interesado en cotizar el producto "${row.name}" (SKU: ${row.sku}).`
    )
    const whatsappUrl = `https://wa.me/${phone}?text=${message}`

    const categoryName = row.categories?.name || row.category || 'General'
    const brandName = row.brands?.name || row.brand || 'Genérica'

    const primaryImage = row.primary_image_url || row.image_url || undefined
    const secondaryImgs = Array.isArray(row.secondary_images) ? row.secondary_images : []
    const images = secondaryImgs.length > 0 ? secondaryImgs : primaryImage ? [primaryImage] : []

    const normalPrice = Number(row.public_sale_price ?? 0)
    const distributorPrice = Number(row.wholesale_price ?? normalPrice)

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
      distributorPrice,
      normalPrice,
      status: row.is_active ? 'ACTIVE' : 'INACTIVE',
      webDistribuidora: isDistributorActive,
      webSuperMas: isSuperMasActive,
      webDirectPurchaseEnabled: isDistributorActive && isSuperMasActive,
      webWhatsAppInquiryEnabled: true,
      webWhatsAppPhone: '+57 312 884 9021',
      availability,
      availabilityLabel,
      canBuyDirectly,
      canContactWhatsApp,
      whatsappUrl,
      updatedAt: row.updated_at || row.created_at,
    }
  }

  /**
   * Consulta el catálogo de productos para distribuidores desde PostgreSQL.
   */
  async findAll(
    filters: DistributorCatalogFilters = {},
    preferredCompanyId?: string
  ): Promise<DistributorCatalogPaginatedResult> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)

    let query = client
      .from('products')
      .select(`
        id, sku, barcode, name, slug, short_description, full_description,
        unit_of_measure, public_sale_price, wholesale_price, tax_rate_percent,
        is_tax_exempt, primary_image_url, secondary_images, is_published_distributor,
        is_published_supermas, min_stock_threshold, is_active, created_at, updated_at, company_id,
        categories(id, name, slug),
        brands(id, name, slug),
        stock_levels(location_id, quantity, locations(id, name, code, status, is_ecommerce_source))
      `, { count: 'exact' })
      .eq('company_id', companyId)
      .eq('is_active', true)

    // Filtro por Estado en Catálogo Distribuidora
    if (filters.distributorStatus === 'PUBLISHED') {
      query = query.eq('is_published_distributor', true)
    } else if (filters.distributorStatus === 'HIDDEN') {
      query = query.eq('is_published_distributor', false)
    }

    // Filtro por Estado en Catálogo Super Más
    if (filters.superMasStatus === 'PUBLISHED') {
      query = query.eq('is_published_supermas', true)
    } else if (filters.superMasStatus === 'HIDDEN') {
      query = query.eq('is_published_supermas', false)
    }

    // Búsqueda por término (nombre, SKU, código de barras)
    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim().replace(/[%_]/g, '')
      query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,barcode.ilike.%${q}%`)
    }

    const { data: rows, error } = await query

    if (error) {
      console.error('Error consultando catálogo distribuidora en Supabase:', error)
      throw new Error(`Error al consultar catálogo: ${error.message}`)
    }

    let mapped = (rows || []).map((r) => this.mapRowToCatalogProduct(r))

    // Filtros en memoria post-mapeo (Categoría, Marca, Disponibilidad, Compra directa)
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

    if (filters.directPurchase && filters.directPurchase !== 'ALL') {
      if (filters.directPurchase === 'ENABLED') {
        mapped = mapped.filter((p) => p.canBuyDirectly === true)
      } else {
        mapped = mapped.filter((p) => p.canBuyDirectly === false)
      }
    }

    // Ordenamiento
    const sortBy = filters.sortBy || 'name'
    const sortOrder = filters.sortOrder || 'asc'
    mapped.sort((a, b) => {
      let comparison = 0
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortBy === 'price') {
        comparison = a.distributorPrice - b.distributorPrice
      } else if (sortBy === 'sku') {
        comparison = a.sku.localeCompare(b.sku)
      } else if (sortBy === 'category') {
        comparison = a.category.localeCompare(b.category)
      } else if (sortBy === 'brand') {
        comparison = a.brand.localeCompare(b.brand)
      } else if (sortBy === 'availability') {
        comparison = a.availability.localeCompare(b.availability)
      }
      return sortOrder === 'desc' ? -comparison : comparison
    })

    const total = mapped.length
    const page = filters.page && filters.page > 0 ? filters.page : 1
    const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 10
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const start = (page - 1) * pageSize
    const paginated = mapped.slice(start, start + pageSize)

    return {
      products: paginated,
      total,
      page,
      pageSize,
      totalPages,
    }
  }

  /**
   * Obtiene un producto individual sanitizado por su ID.
   */
  async findById(id: string, preferredCompanyId?: string): Promise<DistributorCatalogProduct | null> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)

    const { data: row, error } = await client
      .from('products')
      .select(`
        id, sku, barcode, name, slug, short_description, full_description,
        unit_of_measure, public_sale_price, wholesale_price, tax_rate_percent,
        is_tax_exempt, primary_image_url, secondary_images, is_published_distributor,
        is_published_supermas, min_stock_threshold, is_active, created_at, updated_at, company_id,
        categories(id, name, slug),
        brands(id, name, slug),
        stock_levels(location_id, quantity, locations(id, name, code, status, is_ecommerce_source))
      `)
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error || !row) return null
    return this.mapRowToCatalogProduct(row)
  }

  /**
   * Obtiene un producto por su SLUG público para la distribuidora.
   */
  async findBySlug(slug: string, preferredCompanyId?: string): Promise<DistributorCatalogProduct | null> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)

    const { data: row, error } = await client
      .from('products')
      .select(`
        id, sku, barcode, name, slug, short_description, full_description,
        unit_of_measure, public_sale_price, wholesale_price, tax_rate_percent,
        is_tax_exempt, primary_image_url, secondary_images, is_published_distributor,
        is_published_supermas, min_stock_threshold, is_active, created_at, updated_at, company_id,
        categories(id, name, slug),
        brands(id, name, slug),
        stock_levels(location_id, quantity, locations(id, name, code, status, is_ecommerce_source))
      `)
      .eq('slug', slug.trim())
      .eq('company_id', companyId)
      .eq('is_published_distributor', true)
      .maybeSingle()

    if (error || !row) return null
    return this.mapRowToCatalogProduct(row)
  }

  /**
   * Calcula las estadísticas comerciales para el catálogo de distribuidora.
   */
  async getStats(preferredCompanyId?: string): Promise<DistributorCatalogStats> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)

    const { data: prods } = await client
      .from('products')
      .select(`
        id, is_published_distributor, is_published_supermas, min_stock_threshold,
        stock_levels(quantity, locations(status))
      `)
      .eq('company_id', companyId)
      .eq('is_active', true)

    let publishedCount = 0
    let hiddenCount = 0
    let availableCount = 0
    let lowStockCount = 0
    let outOfStockCount = 0
    let directPurchaseActiveCount = 0

    if (prods) {
      prods.forEach((p: any) => {
        if (p.is_published_distributor) {
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
        let isAvail = false

        if (totalStock <= 0) {
          outOfStockCount++
        } else if (totalStock <= threshold) {
          lowStockCount++
          isAvail = true
        } else {
          availableCount++
          isAvail = true
        }

        if (p.is_published_distributor && p.is_published_supermas && isAvail) {
          directPurchaseActiveCount++
        }
      })
    }

    return {
      publishedCount,
      hiddenCount,
      availableCount,
      lowStockCount,
      outOfStockCount,
      directPurchaseActiveCount,
      totalProductsCount: prods ? prods.length : 0,
    }
  }

  /**
   * Actualiza la configuración comercial de un producto en PostgreSQL.
   */
  async updateConfig(
    productId: string,
    updates: ProductCatalogConfigUpdate,
    preferredCompanyId?: string
  ): Promise<DistributorCatalogProduct> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)
    const nowIso = new Date().toISOString()

    const updatePayload: Record<string, any> = {
      updated_at: nowIso,
    }

    if (updates.webDistribuidora !== undefined) {
      updatePayload.is_published_distributor = Boolean(updates.webDistribuidora)
    }
    if (updates.webSuperMas !== undefined) {
      updatePayload.is_published_supermas = Boolean(updates.webSuperMas)
    }

    const { data: updated, error } = await client
      .from('products')
      .update(updatePayload)
      .eq('id', productId)
      .eq('company_id', companyId)
      .select(`
        id, sku, barcode, name, slug, short_description, full_description,
        unit_of_measure, public_sale_price, wholesale_price, tax_rate_percent,
        is_tax_exempt, primary_image_url, secondary_images, is_published_distributor,
        is_published_supermas, min_stock_threshold, is_active, created_at, updated_at, company_id,
        categories(id, name, slug),
        brands(id, name, slug),
        stock_levels(location_id, quantity, locations(id, name, code, status, is_ecommerce_source))
      `)
      .single()

    if (error || !updated) {
      throw new Error(`Error al actualizar configuración de distribuidora: ${error?.message}`)
    }

    return this.mapRowToCatalogProduct(updated)
  }

  /**
   * Actualización masiva de visibilidad web en Catálogo Distribuidora.
   */
  async bulkUpdate(
    productIds: string[],
    action: BulkActionType,
    preferredCompanyId?: string
  ): Promise<{ updatedCount: number; updatedProducts: DistributorCatalogProduct[] }> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)
    const nowIso = new Date().toISOString()

    const updatePayload: Record<string, any> = {
      updated_at: nowIso,
    }

    switch (action) {
      case 'PUBLISH':
        updatePayload.is_published_distributor = true
        break
      case 'HIDE':
        updatePayload.is_published_distributor = false
        break
      case 'ENABLE_DIRECT_PURCHASE':
        updatePayload.is_published_distributor = true
        updatePayload.is_published_supermas = true
        break
      case 'DISABLE_DIRECT_PURCHASE':
        updatePayload.is_published_supermas = false
        break
    }

    const { data: updatedRows, error } = await client
      .from('products')
      .update(updatePayload)
      .in('id', productIds)
      .eq('company_id', companyId)
      .select(`
        id, sku, barcode, name, slug, short_description, full_description,
        unit_of_measure, public_sale_price, wholesale_price, tax_rate_percent,
        is_tax_exempt, primary_image_url, secondary_images, is_published_distributor,
        is_published_supermas, min_stock_threshold, is_active, created_at, updated_at, company_id,
        categories(id, name, slug),
        brands(id, name, slug),
        stock_levels(location_id, quantity, locations(id, name, code, status, is_ecommerce_source))
      `)

    if (error) {
      throw new Error(`Error en actualización masiva de distribuidora: ${error.message}`)
    }

    const updatedProducts = (updatedRows || []).map((r) => this.mapRowToCatalogProduct(r))

    return {
      updatedCount: updatedProducts.length,
      updatedProducts,
    }
  }

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
}

export const distributorCatalogRepository = new DistributorCatalogRepository()
