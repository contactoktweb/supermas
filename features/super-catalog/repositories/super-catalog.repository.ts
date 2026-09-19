/**
 * SUPER MÁS ERP/POS - Repositorio del Catálogo Super Más
 *
 * Conecta con la capa centralizada de datos (lib/supabase/db.ts).
 * Administra productos maestros (products.json), niveles de stock (stock_levels.json),
 * categorías (categories.json), marcas (brands.json), impuestos (tax_configs.json)
 * y métricas de ventas web (web_orders.json).
 *
 * REGLA DE SEGURIDAD CRÍTICA:
 * Nunca expone costos, márgenes de utilidad, proveedores ni existencias numéricas
 * en las vistas orientadas a clientes o públicas.
 */

import { db } from '@/lib/supabase/db'
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

class SuperCatalogRepository {
  private getProductStore(): any[] {
    return (db.products as any[]) || []
  }

  private getStockLevelsStore(): any[] {
    return (db.stockLevels as any[]) || []
  }

  private getLocationsStore(): any[] {
    return (db.locations as any[]) || []
  }

  private getTaxConfigsStore(): any[] {
    return (db.taxConfigs as any[]) || []
  }

  private getWebOrdersStore(): any[] {
    return (db.webOrders as any[]) || []
  }

  /**
   * Calcula las métricas de ventas web acumuladas para un producto desde web_orders.json.
   */
  private getProductWebMetrics(productId: string): { totalSoldUnits: number; webOrdersCount: number } {
    const orders = this.getWebOrdersStore()
    let totalSoldUnits = 0
    let webOrdersCount = 0

    orders.forEach((order) => {
      if (order.status !== 'CANCELLED' && Array.isArray(order.items)) {
        const item = order.items.find((it: any) => it.productId === productId)
        if (item) {
          totalSoldUnits += item.quantity || 0
          webOrdersCount += 1
        }
      }
    })

    return { totalSoldUnits, webOrdersCount }
  }

  /**
   * Calcula la salud comercial multi-bodega con umbral configurable.
   */
  private calculateAvailability(
    product: any,
    lowStockThreshold?: number
  ): {
    availability: StockAvailabilityLevel
    availabilityLabel: 'Disponible' | 'Pocas unidades' | 'Agotado'
    totalCurrentStock: number
    warehouseSummary: WarehouseStockSummaryItem[]
  } {
    const stockLevels = this.getStockLevelsStore()
    const locations = this.getLocationsStore()

    const productStockLevels = stockLevels.filter((s) => s.productId === product.id)
    const threshold = lowStockThreshold ?? product.webLowStockThreshold ?? product.minStockThreshold ?? 10

    let totalCurrentStock = 0
    const warehouseSummary: WarehouseStockSummaryItem[] = []

    locations.forEach((loc) => {
      const level = productStockLevels.find((s) => s.locationId === loc.id)
      const qty = level ? level.currentStock || 0 : 0
      totalCurrentStock += qty

      warehouseSummary.push({
        locationId: loc.id,
        locationName: loc.name,
        locationCode: loc.code,
        currentStock: qty,
        isEcommerceSource: Boolean(loc.settings?.isEcommerceProcessingSource),
      })
    })

    // Si no había stockLevels detallados para este producto, usar los totales agregados
    if (productStockLevels.length === 0) {
      totalCurrentStock = product.totalStock || product.availableUnits || 0
    }

    let availability: StockAvailabilityLevel = 'AVAILABLE'
    let availabilityLabel: 'Disponible' | 'Pocas unidades' | 'Agotado' = 'Disponible'

    if (totalCurrentStock <= 0) {
      availability = 'OUT_OF_STOCK'
      availabilityLabel = 'Agotado'
    } else if (totalCurrentStock <= threshold) {
      availability = 'LOW_STOCK'
      availabilityLabel = 'Pocas unidades'
    } else {
      availability = 'AVAILABLE'
      availabilityLabel = 'Disponible'
    }

    return {
      availability,
      availabilityLabel,
      totalCurrentStock,
      warehouseSummary,
    }
  }

  /**
   * Transforma y sanitiza el producto maestro a producto del Catálogo Super Más.
   */
  private mapToSuperCatalogProduct(p: any): SuperCatalogProduct {
    const threshold = p.webLowStockThreshold ?? p.minStockThreshold ?? 10
    const { availability, availabilityLabel, warehouseSummary } = this.calculateAvailability(p, threshold)

    const isSuperMasActive = Boolean(p.webSuperMas)
    const isDirectPurchaseActive = Boolean(p.webDirectPurchaseEnabled)
    const canBuyDirectly = isSuperMasActive && isDirectPurchaseActive && availability !== 'OUT_OF_STOCK'

    const { totalSoldUnits, webOrdersCount } = this.getProductWebMetrics(p.id)

    // Impuesto asociado
    const taxConfigs = this.getTaxConfigsStore()
    const taxConfig = taxConfigs.find((t) => t.id === p.taxConfigId) || taxConfigs[0]
    const vatRate = taxConfig ? taxConfig.ratePercent : p.vatRatePercent ?? 0

    return {
      id: p.id,
      sku: p.sku,
      barcode: p.barcode,
      name: p.name,
      slug: p.slug,
      description: p.description || '',
      category: p.category,
      brand: p.brand,
      unitOfMeasure: p.unitOfMeasure,
      imageUrl: p.imageUrl,
      images: Array.isArray(p.images) && p.images.length > 0 ? p.images : p.imageUrl ? [p.imageUrl] : [],
      price: p.normalPrice || 0,
      showPrice: p.webShowPrice !== false,
      taxProfile: p.taxProfile || (taxConfig ? taxConfig.name : 'Exento'),
      taxConfigId: p.taxConfigId || (taxConfig ? taxConfig.id : 'tax-exento'),
      vatRatePercent: vatRate,
      isExempt: vatRate === 0,
      status: p.status || 'ACTIVE',
      webSuperMas: isSuperMasActive,
      webDirectPurchaseEnabled: isDirectPurchaseActive,
      webLowStockThreshold: threshold,
      availability,
      availabilityLabel,
      canBuyDirectly,
      webViewsCount: p.webViewsCount || 250,
      webOrdersCount,
      totalSoldUnits,
      warehouseStockSummary: warehouseSummary,
      updatedAt: p.updatedAt || new Date().toISOString(),
    }
  }

  /**
   * Consulta paginada y filtrada del Catálogo Super Más.
   */
  async findAll(filters: SuperCatalogFilters = {}): Promise<SuperCatalogPaginatedResult> {
    const rawList = this.getProductStore()
    const mapped = rawList.map((p) => this.mapToSuperCatalogProduct(p))

    let filtered = [...mapped]

    // 1. Búsqueda por término (nombre, SKU, código de barras)
    if (filters.search && filters.search.trim() !== '') {
      const q = filters.search.toLowerCase().trim()
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q)
      )
    }

    // 2. Filtro de Categoría
    if (filters.category && filters.category !== 'ALL') {
      filtered = filtered.filter((p) => p.category.toLowerCase() === filters.category!.toLowerCase())
    }

    // 3. Filtro de Marca
    if (filters.brand && filters.brand !== 'ALL') {
      filtered = filtered.filter((p) => p.brand.toLowerCase() === filters.brand!.toLowerCase())
    }

    // 4. Filtro de Disponibilidad
    if (filters.availability && filters.availability !== 'ALL') {
      filtered = filtered.filter((p) => p.availability === filters.availability)
    }

    // 5. Filtro de Estado Catálogo (Publicado / Oculto)
    if (filters.catalogStatus && filters.catalogStatus !== 'ALL') {
      if (filters.catalogStatus === 'PUBLISHED') {
        filtered = filtered.filter((p) => p.webSuperMas === true)
      } else if (filters.catalogStatus === 'HIDDEN') {
        filtered = filtered.filter((p) => p.webSuperMas === false)
      }
    }

    // 6. Filtro de Compra Directa
    if (filters.purchaseStatus && filters.purchaseStatus !== 'ALL') {
      if (filters.purchaseStatus === 'ENABLED') {
        filtered = filtered.filter((p) => p.webDirectPurchaseEnabled === true)
      } else if (filters.purchaseStatus === 'DISABLED') {
        filtered = filtered.filter((p) => p.webDirectPurchaseEnabled === false)
      }
    }

    // 7. Rango de precios
    if (typeof filters.priceMin === 'number') {
      filtered = filtered.filter((p) => p.price >= filters.priceMin!)
    }
    if (typeof filters.priceMax === 'number') {
      filtered = filtered.filter((p) => p.price <= filters.priceMax!)
    }

    // 8. Ordenamiento
    const sortBy = filters.sortBy || 'name'
    const sortOrder = filters.sortOrder || 'asc'
    filtered.sort((a, b) => {
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

    // 9. Paginación
    const page = filters.page && filters.page > 0 ? filters.page : 1
    const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 10
    const total = filtered.length
    const totalPages = Math.ceil(total / pageSize) || 1
    const startIndex = (page - 1) * pageSize
    const paginated = filtered.slice(startIndex, startIndex + pageSize)

    return {
      products: paginated,
      total,
      page,
      pageSize,
      totalPages,
    }
  }

  /**
   * Obtiene un producto por su identificador.
   */
  async findById(id: string): Promise<SuperCatalogProduct | null> {
    const raw = this.getProductStore().find((p) => p.id === id)
    if (!raw) return null
    return this.mapToSuperCatalogProduct(raw)
  }

  /**
   * Calcula las estadísticas globales para las tarjetas del Dashboard.
   */
  async getStats(): Promise<SuperCatalogStats> {
    const rawList = this.getProductStore()
    const mapped = rawList.map((p) => this.mapToSuperCatalogProduct(p))

    let publishedCount = 0
    let hiddenCount = 0
    let availableCount = 0
    let lowStockCount = 0
    let outOfStockCount = 0

    let topProduct: SuperCatalogProduct | null = null
    let mostViewed: SuperCatalogProduct | null = null

    mapped.forEach((p) => {
      if (p.webSuperMas) {
        publishedCount++
      } else {
        hiddenCount++
      }

      if (p.availability === 'AVAILABLE') {
        availableCount++
      } else if (p.availability === 'LOW_STOCK') {
        lowStockCount++
      } else if (p.availability === 'OUT_OF_STOCK') {
        outOfStockCount++
      }

      if (!topProduct || p.totalSoldUnits > topProduct.totalSoldUnits) {
        topProduct = p
      }

      if (!mostViewed || p.webViewsCount > mostViewed.webViewsCount) {
        mostViewed = p
      }
    })

    // Total de ventas web calculadas desde web_orders.json
    const webOrders = this.getWebOrdersStore()
    const totalSalesFromWeb = webOrders
      .filter((o) => o.status !== 'CANCELLED' && o.channel === 'CATALOGO_SUPERMAS')
      .reduce((acc, curr) => acc + (curr.totalAmount || 0), 0)

    return {
      publishedCount,
      hiddenCount,
      availableCount,
      lowStockCount,
      outOfStockCount,
      topSellingProduct: topProduct
        ? {
            id: (topProduct as SuperCatalogProduct).id,
            name: (topProduct as SuperCatalogProduct).name,
            sku: (topProduct as SuperCatalogProduct).sku,
            soldUnits: (topProduct as SuperCatalogProduct).totalSoldUnits,
          }
        : null,
      mostViewedProduct: mostViewed
        ? {
            id: (mostViewed as SuperCatalogProduct).id,
            name: (mostViewed as SuperCatalogProduct).name,
            sku: (mostViewed as SuperCatalogProduct).sku,
            views: (mostViewed as SuperCatalogProduct).webViewsCount,
          }
        : null,
      totalSalesFromWeb,
      totalProductsCount: mapped.length,
    }
  }

  /**
   * Obtiene categorías disponibles desde categories.json.
   */
  async getCategories(): Promise<string[]> {
    const categories = (db.categories as any[]) || []
    if (categories.length > 0) {
      return categories.map((c) => c.name || c).filter(Boolean)
    }
    const products = this.getProductStore()
    return Array.from(new Set(products.map((p) => p.category))).filter(Boolean)
  }

  /**
   * Obtiene marcas disponibles desde brands.json.
   */
  async getBrands(): Promise<string[]> {
    const brands = (db.brands as any[]) || []
    if (brands.length > 0) {
      return brands.map((b) => b.name || b).filter(Boolean)
    }
    const products = this.getProductStore()
    return Array.from(new Set(products.map((p) => p.brand))).filter(Boolean)
  }

  /**
   * Obtiene configuraciones tributarias desde tax_configs.json.
   */
  async getTaxConfigs(): Promise<any[]> {
    return this.getTaxConfigsStore()
  }

  /**
   * Actualiza la configuración de venta web del producto maestro.
   */
  async updateConfig(productId: string, config: ProductWebConfigUpdate): Promise<SuperCatalogProduct> {
    const product = this.getProductStore().find((p) => p.id === productId)
    if (!product) {
      throw new Error(`El producto ${productId} no existe en el catálogo maestro.`)
    }

    if (config.webSuperMas !== undefined) {
      product.webSuperMas = config.webSuperMas
    }
    if (config.webDirectPurchaseEnabled !== undefined) {
      product.webDirectPurchaseEnabled = config.webDirectPurchaseEnabled
    }
    if (config.price !== undefined) {
      product.normalPrice = config.price
      if (Array.isArray(product.prices)) {
        const normPrice = product.prices.find((pr: any) => pr.code === 'NORMAL' || pr.isDefault)
        if (normPrice) normPrice.price = config.price
      }
    }
    if (config.showPrice !== undefined) {
      product.webShowPrice = config.showPrice
    }
    if (config.webLowStockThreshold !== undefined) {
      product.webLowStockThreshold = config.webLowStockThreshold
    }
    if (config.taxConfigId !== undefined) {
      product.taxConfigId = config.taxConfigId
      const tax = this.getTaxConfigsStore().find((t) => t.id === config.taxConfigId)
      if (tax) {
        product.vatRatePercent = tax.ratePercent
        product.taxProfile = tax.name
        product.isExempt = tax.ratePercent === 0
      }
    }
    if (config.imageUrl !== undefined) {
      product.imageUrl = config.imageUrl
    }
    if (config.images !== undefined) {
      product.images = config.images
    }

    product.updatedAt = new Date().toISOString()
    return this.mapToSuperCatalogProduct(product)
  }

  /**
   * Actualización masiva de productos seleccionados.
   */
  async bulkUpdate(
    productIds: string[],
    action: SuperBulkActionType
  ): Promise<{ updatedCount: number; updatedProducts: SuperCatalogProduct[] }> {
    const updatedProducts: SuperCatalogProduct[] = []

    for (const id of productIds) {
      const p = this.getProductStore().find((item) => item.id === id)
      if (!p) continue

      switch (action) {
        case 'PUBLISH':
          p.webSuperMas = true
          break
        case 'HIDE':
          p.webSuperMas = false
          p.webDirectPurchaseEnabled = false
          break
        case 'ENABLE_PURCHASE':
          p.webSuperMas = true
          p.webDirectPurchaseEnabled = true
          break
        case 'DISABLE_PURCHASE':
          p.webDirectPurchaseEnabled = false
          break
      }

      p.updatedAt = new Date().toISOString()
      updatedProducts.push(this.mapToSuperCatalogProduct(p))
    }

    return {
      updatedCount: updatedProducts.length,
      updatedProducts,
    }
  }
}

export const superCatalogRepository = new SuperCatalogRepository()
