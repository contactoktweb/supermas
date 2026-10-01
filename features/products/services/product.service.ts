import {
  Product,
  ProductFilterParams,
  PaginatedProductsResponse,
  GlobalProductsStats,
  UserPermissionContext,
  CreateProductInput,
  UpdateProductInput,
  ProductMovementSummary,
  WebAvailability,
  ProductStockHealth,
  ProductAuditEntry,
  TaxRateConfig,
} from '../types'
import { productRepository } from '../repositories/product.repository'
import { productFormSchema, updateProductSchema } from '../schemas/product.schema'
import { categoryService } from '@/features/categories/services/category.service'
import { brandService } from '@/features/brands/services/brand.service'

export class ProductService {
  /**
   * Obtiene listado paginado y filtrado de productos, aplicando control de privacidad RBAC.
   */
  async listProducts(
    params: ProductFilterParams,
    userContext?: UserPermissionContext
  ): Promise<PaginatedProductsResponse> {
    const response = await productRepository.findAll(params)
    const canReadCost = this.hasPermission(userContext, 'cost.read')

    const items = response.items.map((p) => this.sanitizeProductForUser(p, canReadCost))

    return {
      items,
      total: response.total,
      page: response.page,
      pageSize: response.pageSize,
      totalPages: response.totalPages,
      isCostRedacted: !canReadCost,
    }
  }

  /**
   * Obtiene el detalle completo de un producto por ID.
   */
  async getProduct(
    id: string,
    userContext?: UserPermissionContext
  ): Promise<Product | null> {
    const product = await productRepository.findById(id)
    if (!product) return null

    const canReadCost = this.hasPermission(userContext, 'cost.read')
    return this.sanitizeProductForUser(product, canReadCost)
  }

  /**
   * Crea un nuevo producto validando unicidad de SKU y reglas de negocio.
   */
  async createProduct(
    input: CreateProductInput,
    userContext?: UserPermissionContext
  ): Promise<Product> {
    // 1. Validar esquema con Zod
    const validated = productFormSchema.parse(input)

    // 2. Comprobar duplicidad de SKU
    const existingSku = await productRepository.findBySku(validated.sku)
    if (existingSku) {
      throw new Error(`El SKU "${validated.sku}" ya se encuentra registrado en el sistema.`)
    }

    // 3. Comprobar duplicidad de código de barras si fue suministrado
    if (validated.barcode) {
      const existingBarcode = await productRepository.findByBarcode(validated.barcode)
      if (existingBarcode) {
        throw new Error(
          `El código de barras "${validated.barcode}" ya pertenece al producto "${existingBarcode.name}".`
        )
      }
    }

    // 4. Estructurar listas de precios
    const normalPrice = validated.prices.find((p) => p.code === 'NORMAL')?.price || 0
    const wholesalePrice =
      validated.prices.find((p) => p.code === 'MAYORISTA')?.price || normalPrice

    const initialCost = (validated as any).estimatedCost || 0

    const created = await productRepository.create({
      categoryId: validated.categoryId,
      brandId: validated.brandId,
      sku: validated.sku,
      barcode: validated.barcode || undefined,
      name: validated.name,
      slug: this.slugify(validated.name),
      shortDescription: validated.description || '',
      fullDescription: validated.description || '',
      unitOfMeasure: validated.unitOfMeasure,
      costPrice: initialCost,
      publicSalePrice: normalPrice,
      wholesalePrice: wholesalePrice,
      minWholesaleQuantity: 12,
      taxRatePercent: validated.vatRatePercent,
      isTaxExempt: validated.taxProfile === 'EXENTO' || validated.taxProfile === 'EXCLUIDO',
      primaryImageUrl: validated.imageUrl || '',
      secondaryImages: validated.images && validated.images.length > 0 ? validated.images : [],
      minStockThreshold: validated.minStockThreshold || 15,
      criticalStockThreshold: validated.criticalStockThreshold || 5,
      isActive: validated.status === 'ACTIVE',
      isPublishedSupermas: validated.webSuperMas,
      isPublishedDistributor: validated.webDistribuidora,
      inventoryType: 'MERCHANDISE',
    })

    return created
  }

  /**
   * Actualiza los datos de un producto bajo RLS en PostgreSQL.
   */
  async updateProduct(
    id: string,
    input: UpdateProductInput,
    userContext?: UserPermissionContext
  ): Promise<Product> {
    const existing = await productRepository.findById(id)
    if (!existing) {
      throw new Error(`Producto con ID ${id} no encontrado.`)
    }

    // 1. Validar esquema parcial o completo
    const validated = updateProductSchema.parse(input)

    // 2. Si cambia el SKU, verificar que no choque con otro producto
    if (validated.sku && validated.sku !== existing.sku) {
      const duplicateSku = await productRepository.findBySku(validated.sku)
      if (duplicateSku && duplicateSku.id !== id) {
        throw new Error(`El SKU "${validated.sku}" ya está en uso por otro producto.`)
      }
    }

    const updatePayload: Partial<Product> = {}
    if (validated.name !== undefined) updatePayload.name = validated.name
    if (validated.sku !== undefined) updatePayload.sku = validated.sku
    if (validated.barcode !== undefined) updatePayload.barcode = validated.barcode
    if (validated.description !== undefined) {
      updatePayload.shortDescription = validated.description
      updatePayload.fullDescription = validated.description
    }
    if (validated.categoryId !== undefined) updatePayload.categoryId = validated.categoryId
    if (validated.brandId !== undefined) updatePayload.brandId = validated.brandId
    if (validated.unitOfMeasure !== undefined) updatePayload.unitOfMeasure = validated.unitOfMeasure
    if (validated.status !== undefined) updatePayload.isActive = validated.status === 'ACTIVE'
    if (validated.imageUrl !== undefined) updatePayload.primaryImageUrl = validated.imageUrl
    if (validated.images !== undefined) updatePayload.secondaryImages = validated.images
    if (validated.webSuperMas !== undefined) updatePayload.isPublishedSupermas = validated.webSuperMas
    if (validated.webDistribuidora !== undefined)
      updatePayload.isPublishedDistributor = validated.webDistribuidora
    if (validated.minStockThreshold !== undefined)
      updatePayload.minStockThreshold = validated.minStockThreshold
    if (validated.criticalStockThreshold !== undefined)
      updatePayload.criticalStockThreshold = validated.criticalStockThreshold
    if (validated.vatRatePercent !== undefined)
      updatePayload.taxRatePercent = validated.vatRatePercent
    if (validated.taxProfile !== undefined) {
      updatePayload.isTaxExempt =
        validated.taxProfile === 'EXENTO' || validated.taxProfile === 'EXCLUIDO'
    }
    if (validated.prices) {
      const normalPrice = validated.prices.find((p) => p.code === 'NORMAL')?.price
      if (normalPrice !== undefined) updatePayload.publicSalePrice = normalPrice
      const wholesalePrice = validated.prices.find((p) => p.code === 'MAYORISTA')?.price
      if (wholesalePrice !== undefined) updatePayload.wholesalePrice = wholesalePrice
    }
    if ((validated as any).estimatedCost !== undefined) {
      updatePayload.costPrice = (validated as any).estimatedCost
    }

    const updated = await productRepository.update(id, updatePayload)
    const canReadCost = this.hasPermission(userContext, 'cost.read')
    return this.sanitizeProductForUser(updated, canReadCost)
  }

  /**
   * Desactiva un producto de forma segura (Soft Delete) manteniendo integridad histórica.
   * La auditoría es generada automáticamente por el trigger fn_audit_products() (029).
   */
  async deactivateProduct(
    id: string,
    _reason?: string,
    _userContext?: UserPermissionContext
  ): Promise<Product> {
    const existing = await productRepository.findById(id)
    if (!existing) {
      throw new Error(`Producto con ID ${id} no encontrado.`)
    }

    const updated = await productRepository.softDelete(id)
    return updated
  }

  /**
   * Obtiene las estadísticas globales del catálogo de productos con protección RBAC.
   */
  async getGlobalStats(
    userContext?: UserPermissionContext
  ): Promise<GlobalProductsStats> {
    const stats = await productRepository.getGlobalStats()
    const canReadCost = this.hasPermission(userContext, 'cost.read')

    if (!canReadCost) {
      return {
        ...stats,
        totalInventoryValueAtCost: 0,
        isCostRedacted: true,
      }
    }

    return stats
  }

  /**
   * Consulta el stock y la distribución porcentual por bodega.
   */
  async getProductStock(id: string) {
    const product = await productRepository.findById(id)
    if (!product) throw new Error(`Producto ${id} no encontrado`)

    const totalStock = product.totalStock
    const stockDistribution = product.warehouseStock.map((w) => {
      const percentage = totalStock > 0 ? (w.quantity / totalStock) * 100 : 0
      return {
        ...w,
        percentageOfTotalStock: Number(percentage.toFixed(1)),
      }
    })

    return {
      totalStock,
      availableUnits: product.availableUnits,
      stockHealth: product.stockHealth,
      warehouses: stockDistribution,
    }
  }

  /**
   * Obtiene los movimientos de Kardex recientes del producto desde PostgreSQL.
   */
  async getProductMovements(id: string): Promise<ProductMovementSummary[]> {
    return productRepository.getProductMovements(id)
  }

  /**
   * Centraliza la fórmula de margen de utilidad: (Precio Sin IVA - Costo Promedio).
   */
  calculateProfitMargin(
    normalSalePrice: number,
    vatRatePercent: number,
    averageCost: number
  ): { amount: number; percentage: number } {
    if (normalSalePrice <= 0) {
      return { amount: 0, percentage: 0 }
    }

    const divisor = 1 + (vatRatePercent || 0) / 100
    const priceWithoutVat = normalSalePrice / divisor
    const amount = Number((priceWithoutVat - (averageCost || 0)).toFixed(2))
    const percentage =
      priceWithoutVat > 0 ? Number(((amount / priceWithoutVat) * 100).toFixed(2)) : 0

    return { amount, percentage }
  }

  /**
   * Deriva dinámicamente la disponibilidad web según la sumatoria de stock físico.
   */
  deriveWebAvailability(
    totalStock: number,
    minThreshold: number = 15
  ): WebAvailability {
    if (totalStock <= 0) return 'OUT_OF_STOCK'
    if (totalStock <= minThreshold) return 'LOW_STOCK'
    return 'AVAILABLE'
  }

  /**
   * Determina el estado de salud del stock según inventario actual y umbrales.
   */
  deriveStockHealth(
    quantity: number,
    minStock: number,
    criticalStock: number
  ): ProductStockHealth {
    if (quantity <= 0) return 'OUT_OF_STOCK'
    if (quantity <= criticalStock) return 'CRITICAL'
    if (quantity <= minStock) return 'LOW_STOCK'
    return 'AVAILABLE'
  }

  /**
   * Formatea valores monetarios en pesos colombianos ($COP).
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  /**
   * Exporta el catálogo filtrado a formato CSV estructurado.
   */
  exportToCsv(products: Product[], isCostRedacted: boolean = false): string {
    const headers = [
      'SKU',
      'Código de Barras',
      'Producto',
      'Categoría',
      'Marca',
      'Unidad',
      'Stock Total',
      'Estado',
      ...(isCostRedacted ? [] : ['Costo Promedio', 'Margen %']),
      'Precio Normal',
      'Precio Mayorista',
      'IVA %',
      'Catálogo Super Más',
      'Catálogo Distribuidora',
      'Disponibilidad Web',
    ]

    const rows = products.map((p) => [
      `"${p.sku}"`,
      `"${p.barcode}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.categoryName || p.category?.name || ''}"`,
      `"${p.brandName || p.brand?.name || ''}"`,
      `"${p.unitOfMeasure}"`,
      p.totalStock,
      `"${p.status}"`,
      ...(isCostRedacted
        ? []
        : [p.averageCost, `${p.profitMarginPercent.toFixed(1)}%`]),
      p.normalPrice,
      p.wholesalePrice,
      `${p.vatRatePercent}%`,
      p.webSuperMas ? 'SI' : 'NO',
      p.webDistribuidora ? 'SI' : 'NO',
      `"${p.webAvailability}"`,
    ])

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  }

  /**
   * Verifica permisos del usuario.
   */
  private hasPermission(
    userContext?: UserPermissionContext,
    permission?: string
  ): boolean {
    if (!userContext || !permission) return true
    if (userContext.userRole === 'ADMIN') return true
    return userContext.permissions.includes(permission)
  }

  /**
   * Aplica ofuscación a costos y márgenes si el usuario no tiene permiso.
   */
  private sanitizeProductForUser(product: Product, canReadCost: boolean): Product {
    if (canReadCost) return product

    return {
      ...product,
      averageCost: 0,
      costPrice: 0,
      inventoryValueAtCost: 0,
      profitMarginAmount: 0,
      profitMarginPercent: 0,
      warehouseStock: product.warehouseStock.map((w) => ({
        ...w,
        averageCost: 0,
        inventoryValueAtCost: 0,
      })),
    }
  }

  private slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
  }

  async getCategories(): Promise<string[]> {
    const { data } = await categoryService.listCategories({ status: 'ACTIVE' })
    return data.map((c) => c.name)
  }

  async getBrands(): Promise<string[]> {
    const { data } = await brandService.listBrands({ status: 'ACTIVE' })
    return data.map((b) => b.name)
  }

  /**
   * Búsqueda reactiva de productos para órdenes de compra, POS e inventario.
   * Filtra por nombre, SKU o código de barras y devuelve stock y costos actuales.
   */
  async search(query: string, locationId?: string) {
    const q = query.toLowerCase().trim()
    const allProducts = await productRepository.findAll({ query: '', pageSize: 200 })
    
    let filtered = allProducts.items
    if (q) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q))
      )
    }

    return filtered.map((p) => {
      let currentStock = p.totalStock
      if (locationId) {
        const stockInLocation = p.warehouseStock?.find((w) => w.locationId === locationId)
        if (stockInLocation) {
          currentStock = stockInLocation.quantity
        }
      }
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        imageUrl: p.imageUrl,
        unitOfMeasure: p.unitOfMeasure,
        currentCost: p.averageCost || 0,
        currentStock,
        totalStock: p.totalStock,
        vatRatePercent: p.vatRatePercent ?? 19,
        taxProfile: p.taxProfile || 'IVA_GENERAL',
      }
    })
  }

  async getTaxConfigs(): Promise<TaxRateConfig[]> {
    return productRepository.getTaxRates()
  }
}

export const productService = new ProductService()
