/**
 * SUPER MÁS ERP/POS - Repositorio de Catálogo Distribuidora
 *
 * Conecta con la capa centralizada de datos de Supabase (db.ts),
 * consultando productos maestros (products.json), categorías (categories.json),
 * marcas (brands.json) y niveles de stock (stock_levels.json).
 *
 * REGLA DE SEGURIDAD CRÍTICA:
 * Sanitiza cualquier dato sensible de costos, márgenes o proveedores antes
 * de entregar la información al servicio o a la interfaz.
 */

import { db } from '@/lib/supabase/db'
import {
  DistributorCatalogProduct,
  DistributorCatalogFilters,
  DistributorCatalogPaginatedResult,
  DistributorCatalogStats,
  StockAvailabilityLevel,
  ProductCatalogConfigUpdate,
  BulkActionType,
} from '../types'

class DistributorCatalogRepository {
  private getProductStore(): any[] {
    return (db.products as any[]) || []
  }

  private getStockLevelsStore(): any[] {
    return (db.stockLevels as any[]) || []
  }

  /**
   * Calcula la salud de stock comercial multi-bodega para un producto.
   * Regla de negocio:
   * - Si hay existencia en cualquier bodega y supera el umbral: AVAILABLE (Disponible).
   * - Si hay existencia pero está por debajo del umbral mínimo: LOW_STOCK (Pocas unidades).
   * - Si ninguna bodega tiene existencia: OUT_OF_STOCK (Agotado).
   */
  private calculateAvailability(product: any): {
    availability: StockAvailabilityLevel
    availabilityLabel: 'Disponible' | 'Pocas unidades' | 'Agotado'
  } {
    const stockLevels = this.getStockLevelsStore()
    const productStockLevels = stockLevels.filter((s) => s.productId === product.id)

    let totalCurrentStock = 0
    let minThreshold = product.minStockThreshold || 50

    if (productStockLevels.length > 0) {
      totalCurrentStock = productStockLevels.reduce((acc, curr) => acc + (curr.currentStock || 0), 0)
    } else {
      totalCurrentStock = product.totalStock || product.availableUnits || 0
    }

    if (totalCurrentStock <= 0) {
      return { availability: 'OUT_OF_STOCK', availabilityLabel: 'Agotado' }
    }
    if (totalCurrentStock <= minThreshold) {
      return { availability: 'LOW_STOCK', availabilityLabel: 'Pocas unidades' }
    }
    return { availability: 'AVAILABLE', availabilityLabel: 'Disponible' }
  }

  /**
   * Transforma y sanitiza el producto maestro a producto de catálogo distribuidora.
   * Elimina cualquier campo sensible (costos, márgenes, compras, proveedores).
   */
  private mapToCatalogProduct(p: any): DistributorCatalogProduct {
    const { availability, availabilityLabel } = this.calculateAvailability(p)

    const isDistributorActive = Boolean(p.webDistribuidora)
    const isSuperMasActive = Boolean(p.webSuperMas)
    const isDirectPurchaseActive = Boolean(p.webDirectPurchaseEnabled)
    const isWhatsAppActive = p.webWhatsAppInquiryEnabled !== false

    // Regla comercial: Compra directa requiere estar activo en Distribuidora, activo en Super Más,
    // tener la opción de compra habilitada y tener stock disponible.
    const canBuyDirectly =
      isDistributorActive &&
      isSuperMasActive &&
      isDirectPurchaseActive &&
      availability !== 'OUT_OF_STOCK'

    const canContactWhatsApp = isDistributorActive && isWhatsAppActive

    // Generar enlace dinámico de WhatsApp si está activo
    const phone = (p.webWhatsAppPhone || '+573128849021').replace(/\D/g, '')
    const message = encodeURIComponent(
      `Hola Distribuidora Super Más, estoy interesado en cotizar el producto "${p.name}" (SKU: ${p.sku}).`
    )
    const whatsappUrl = `https://wa.me/${phone}?text=${message}`

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
      images: p.images || [],
      distributorPrice: p.distributorPrice || p.wholesalePrice || p.normalPrice || 0,
      normalPrice: p.normalPrice || 0,
      status: p.status || 'ACTIVE',
      webDistribuidora: isDistributorActive,
      webSuperMas: isSuperMasActive,
      webDirectPurchaseEnabled: isDirectPurchaseActive,
      webWhatsAppInquiryEnabled: isWhatsAppActive,
      webWhatsAppPhone: p.webWhatsAppPhone || '+57 312 884 9021',
      availability,
      availabilityLabel,
      canBuyDirectly,
      canContactWhatsApp,
      whatsappUrl,
      updatedAt: p.updatedAt,
    }
  }

  /**
   * Consulta el catálogo de productos para distribuidores aplicando filtros,
   * ordenamiento y paginación.
   */
  async findAll(filters: DistributorCatalogFilters = {}): Promise<DistributorCatalogPaginatedResult> {
    const rawList = this.getProductStore()
    const mapped = rawList.map((p) => this.mapToCatalogProduct(p))

    let filtered = [...mapped]

    // 1. Filtro de búsqueda (nombre, SKU, código de barras)
    if (filters.search && filters.search.trim() !== '') {
      const q = filters.search.toLowerCase().trim()
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q)
      )
    }

    // 2. Filtro por Categoría
    if (filters.category && filters.category !== 'ALL') {
      filtered = filtered.filter((p) => p.category.toLowerCase() === filters.category!.toLowerCase())
    }

    // 3. Filtro por Marca
    if (filters.brand && filters.brand !== 'ALL') {
      filtered = filtered.filter((p) => p.brand.toLowerCase() === filters.brand!.toLowerCase())
    }

    // 4. Filtro por Disponibilidad
    if (filters.availability && filters.availability !== 'ALL') {
      filtered = filtered.filter((p) => p.availability === filters.availability)
    }

    // 5. Filtro por Estado en Catálogo Distribuidora
    if (filters.distributorStatus && filters.distributorStatus !== 'ALL') {
      if (filters.distributorStatus === 'PUBLISHED') {
        filtered = filtered.filter((p) => p.webDistribuidora === true)
      } else if (filters.distributorStatus === 'HIDDEN') {
        filtered = filtered.filter((p) => p.webDistribuidora === false)
      }
    }

    // 6. Filtro por Estado en Catálogo Super Más
    if (filters.superMasStatus && filters.superMasStatus !== 'ALL') {
      if (filters.superMasStatus === 'PUBLISHED') {
        filtered = filtered.filter((p) => p.webSuperMas === true)
      } else if (filters.superMasStatus === 'HIDDEN') {
        filtered = filtered.filter((p) => p.webSuperMas === false)
      }
    }

    // 7. Filtro por Compra Web Directa
    if (filters.directPurchase && filters.directPurchase !== 'ALL') {
      if (filters.directPurchase === 'ENABLED') {
        filtered = filtered.filter((p) => p.canBuyDirectly === true)
      } else if (filters.directPurchase === 'DISABLED') {
        filtered = filtered.filter((p) => p.canBuyDirectly === false)
      }
    }

    // 8. Ordenamiento
    const sortBy = filters.sortBy || 'name'
    const sortOrder = filters.sortOrder || 'asc'
    filtered.sort((a, b) => {
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

    const total = filtered.length
    const page = filters.page || 1
    const pageSize = filters.pageSize || 10
    const start = (page - 1) * pageSize
    const paginated = filtered.slice(start, start + pageSize)

    return {
      products: JSON.parse(JSON.stringify(paginated)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    }
  }

  /**
   * Obtiene un producto individual sanitizado por su ID.
   */
  async findById(id: string): Promise<DistributorCatalogProduct | null> {
    const rawList = this.getProductStore()
    const found = rawList.find((p) => p.id === id)
    if (!found) return null
    return this.mapToCatalogProduct(found)
  }

  /**
   * Actualiza la configuración comercial de un producto maestro en el almacén central.
   */
  async updateConfig(
    productId: string,
    updates: ProductCatalogConfigUpdate
  ): Promise<DistributorCatalogProduct> {
    const rawList = this.getProductStore()
    const index = rawList.findIndex((p) => p.id === productId)
    if (index === -1) {
      throw new Error(`El producto con ID ${productId} no existe.`)
    }

    const now = new Date().toISOString()
    const updatedRaw = {
      ...rawList[index],
      ...updates,
      updatedAt: now,
    }

    rawList[index] = updatedRaw
    return this.mapToCatalogProduct(updatedRaw)
  }

  /**
   * Ejecuta actualización masiva sobre un conjunto de productos seleccionados.
   */
  async bulkUpdate(
    productIds: string[],
    action: BulkActionType
  ): Promise<{ updatedCount: number; updatedProducts: DistributorCatalogProduct[] }> {
    const rawList = this.getProductStore()
    const now = new Date().toISOString()
    const updatedProducts: DistributorCatalogProduct[] = []

    let updatedCount = 0

    rawList.forEach((prod, index) => {
      if (productIds.includes(prod.id)) {
        let changed = false
        const patch: Partial<any> = { updatedAt: now }

        switch (action) {
          case 'PUBLISH':
            patch.webDistribuidora = true
            changed = true
            break
          case 'HIDE':
            patch.webDistribuidora = false
            changed = true
            break
          case 'ENABLE_WHATSAPP':
            patch.webWhatsAppInquiryEnabled = true
            changed = true
            break
          case 'DISABLE_WHATSAPP':
            patch.webWhatsAppInquiryEnabled = false
            changed = true
            break
          case 'ENABLE_DIRECT_PURCHASE':
            patch.webDirectPurchaseEnabled = true
            changed = true
            break
          case 'DISABLE_DIRECT_PURCHASE':
            patch.webDirectPurchaseEnabled = false
            changed = true
            break
        }

        if (changed) {
          rawList[index] = { ...prod, ...patch }
          updatedProducts.push(this.mapToCatalogProduct(rawList[index]))
          updatedCount++
        }
      }
    })

    return { updatedCount, updatedProducts }
  }

  /**
   * Obtiene las métricas globales del catálogo distribuidora para los KPI cards.
   */
  async getStats(): Promise<DistributorCatalogStats> {
    const rawList = this.getProductStore()
    const mapped = rawList.map((p) => this.mapToCatalogProduct(p))

    let publishedCount = 0
    let hiddenCount = 0
    let availableCount = 0
    let lowStockCount = 0
    let outOfStockCount = 0
    let directPurchaseActiveCount = 0

    mapped.forEach((p) => {
      if (p.webDistribuidora) {
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

      if (p.canBuyDirectly) {
        directPurchaseActiveCount++
      }
    })

    return {
      publishedCount,
      hiddenCount,
      availableCount,
      lowStockCount,
      outOfStockCount,
      directPurchaseActiveCount,
      totalProductsCount: mapped.length,
    }
  }

  /**
   * Obtiene la lista oficial de categorías desde categories.json.
   */
  async getCategories(): Promise<string[]> {
    return ((db.categories as string[]) || []).slice()
  }

  /**
   * Obtiene la lista oficial de marcas desde brands.json.
   */
  async getBrands(): Promise<string[]> {
    return ((db.brands as string[]) || []).slice()
  }
}

export const distributorCatalogRepository = new DistributorCatalogRepository()
