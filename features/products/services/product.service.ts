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
} from '../types'
import { productRepository } from '../repositories/product.repository'
import { productFormSchema } from '../schemas/product.schema'
import { PRODUCT_MOVEMENTS_MOCK } from '../mocks/product.mock'

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
    const distributorPrice = validated.prices.find(
      (p) => p.code === 'DISTRIBUIDOR'
    )?.price

    // 5. Cálculos financieros y margen
    const initialCost = 0 // El costo real se calcula a través de compras o inventario
    const margin = this.calculateProfitMargin(
      normalPrice,
      validated.vatRatePercent,
      initialCost
    )

    // 6. Configuración de bodegas inicial (stock en 0)
    const warehouseStock = (validated.warehouseDistribution || []).map((w, idx) => ({
      locationId: w.locationId,
      locationName: `Bodega ${idx + 1}`,
      locationCode: `BOD-00${idx + 1}`,
      locationType: 'MAIN_WAREHOUSE' as const,
      quantity: 0,
      minStock: w.minStock || 10,
      criticalStock: w.criticalStock || 5,
      averageCost: 0,
      inventoryValueAtCost: 0,
      stockHealth: 'OUT_OF_STOCK' as const,
      percentageOfTotalStock: 0,
    }))

    const now = new Date().toISOString()
    const newProduct: Product = {
      id: `prod-${Date.now()}`,
      sku: validated.sku,
      barcode: validated.barcode || '',
      name: validated.name,
      slug: this.slugify(validated.name),
      description: validated.description || '',
      category: validated.category,
      brand: validated.brand,
      unitOfMeasure: validated.unitOfMeasure,
      imageUrl:
        validated.imageUrl ||
        'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&auto=format&fit=crop&q=80',
      images: validated.images && validated.images.length > 0 ? validated.images : [],
      status: validated.status,
      taxProfile: validated.taxProfile,
      vatRatePercent: validated.vatRatePercent,
      isExempt: validated.taxProfile === 'EXENTO' || validated.taxProfile === 'EXCLUIDO',
      prices: validated.prices.map((p, i) => ({
        id: `price-${i + 1}`,
        name: p.name,
        code: p.code,
        price: p.price,
        minQuantity: p.minQuantity || 1,
        isDefault: p.code === 'NORMAL',
      })),
      normalPrice,
      wholesalePrice,
      distributorPrice,
      averageCost: initialCost,
      inventoryValueAtCost: 0,
      profitMarginAmount: margin.amount,
      profitMarginPercent: margin.percentage,
      totalStock: 0,
      availableUnits: 0,
      minStockThreshold: validated.minStockThreshold || 15,
      criticalStockThreshold: validated.criticalStockThreshold || 5,
      stockHealth: 'OUT_OF_STOCK',
      webSuperMas: validated.webSuperMas,
      webDistribuidora: validated.webDistribuidora,
      webAvailability: 'OUT_OF_STOCK',
      warehouseStock,
      auditTrail: [
        {
          id: `audit-${Date.now()}`,
          productId: '',
          fieldChanged: 'CREATION',
          oldValue: '',
          newValue: 'Producto creado en catálogo',
          changedBy: userContext?.userName || 'Administrador',
          changedAt: now,
          reason: validated.auditReason || 'Creación inicial de producto',
        },
      ],
      createdAt: now,
      updatedAt: now,
    }

    const created = await productRepository.create(newProduct)
    return created
  }

  /**
   * Actualiza los datos de un producto y genera trazabilidad de auditoría en cambios sensibles.
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
    const validated = productFormSchema.partial().parse(input)

    // 2. Si cambia el SKU, verificar que no choque con otro producto
    if (validated.sku && validated.sku !== existing.sku) {
      const duplicateSku = await productRepository.findBySku(validated.sku)
      if (duplicateSku && duplicateSku.id !== id) {
        throw new Error(`El SKU "${validated.sku}" ya está en uso por otro producto.`)
      }
    }

    // 3. Generar auditoría de cambios
    const auditEntries: ProductAuditEntry[] = existing.auditTrail || []
    const now = new Date().toISOString()
    const user = userContext?.userName || 'Administrador'

    if (validated.prices) {
      const newNormal = validated.prices.find((p) => p.code === 'NORMAL')?.price
      if (newNormal !== undefined && newNormal !== existing.normalPrice) {
        auditEntries.unshift({
          id: `audit-${Date.now()}-1`,
          productId: id,
          fieldChanged: 'PRECIO_NORMAL',
          oldValue: this.formatCurrency(existing.normalPrice),
          newValue: this.formatCurrency(newNormal),
          changedBy: user,
          changedAt: now,
          reason: input.auditReason || 'Actualización de lista de precios',
        })
      }

      const newWholesale = validated.prices.find((p) => p.code === 'MAYORISTA')?.price
      if (newWholesale !== undefined && newWholesale !== existing.wholesalePrice) {
        auditEntries.unshift({
          id: `audit-${Date.now()}-2`,
          productId: id,
          fieldChanged: 'PRECIO_MAYORISTA',
          oldValue: this.formatCurrency(existing.wholesalePrice),
          newValue: this.formatCurrency(newWholesale),
          changedBy: user,
          changedAt: now,
          reason: input.auditReason || 'Actualización de precio mayorista',
        })
      }
    }

    if (validated.taxProfile && validated.taxProfile !== existing.taxProfile) {
      auditEntries.unshift({
        id: `audit-${Date.now()}-3`,
        productId: id,
        fieldChanged: 'PERFIL_TRIBUTARIO',
        oldValue: `${existing.taxProfile} (${existing.vatRatePercent}%)`,
        newValue: `${validated.taxProfile} (${validated.vatRatePercent || 0}%)`,
        changedBy: user,
        changedAt: now,
        reason: input.auditReason || 'Ajuste de perfil de impuestos',
      })
    }

    if (validated.status && validated.status !== existing.status) {
      auditEntries.unshift({
        id: `audit-${Date.now()}-4`,
        productId: id,
        fieldChanged: 'ESTADO',
        oldValue: existing.status,
        newValue: validated.status,
        changedBy: user,
        changedAt: now,
        reason: input.auditReason || 'Cambio de estado operativo',
      })
    }

    // 4. Recalcular precios y márgenes
    const normalPrice =
      validated.prices?.find((p) => p.code === 'NORMAL')?.price ?? existing.normalPrice
    const wholesalePrice =
      validated.prices?.find((p) => p.code === 'MAYORISTA')?.price ??
      existing.wholesalePrice
    const distributorPrice =
      validated.prices?.find((p) => p.code === 'DISTRIBUIDOR')?.price ??
      existing.distributorPrice
    const vatRate = validated.vatRatePercent ?? existing.vatRatePercent

    const mappedPrices = validated.prices
      ? validated.prices.map((p, i) => ({
          id: p.id || `price-${i + 1}`,
          name: p.name,
          code: p.code,
          price: p.price,
          minQuantity: p.minQuantity || 1,
          isDefault: p.code === 'NORMAL',
        }))
      : existing.prices

    const margin = this.calculateProfitMargin(normalPrice, vatRate, existing.averageCost)

    const updated = await productRepository.update(id, {
      ...validated,
      prices: mappedPrices,
      normalPrice,
      wholesalePrice,
      distributorPrice,
      profitMarginAmount: margin.amount,
      profitMarginPercent: margin.percentage,
      auditTrail: auditEntries,
    })

    const canReadCost = this.hasPermission(userContext, 'cost.read')
    return this.sanitizeProductForUser(updated, canReadCost)
  }

  /**
   * Desactiva un producto de forma segura (Soft Delete) manteniendo integridad histórica.
   */
  async deactivateProduct(
    id: string,
    reason?: string,
    userContext?: UserPermissionContext
  ): Promise<Product> {
    const existing = await productRepository.findById(id)
    if (!existing) {
      throw new Error(`Producto con ID ${id} no encontrado.`)
    }

    const now = new Date().toISOString()
    const auditEntries = existing.auditTrail || []
    auditEntries.unshift({
      id: `audit-${Date.now()}`,
      productId: id,
      fieldChanged: 'DESACTIVACION',
      oldValue: existing.status,
      newValue: 'INACTIVE',
      changedBy: userContext?.userName || 'Administrador',
      changedAt: now,
      reason: reason || 'Desactivación lógica de producto',
    })

    const updated = await productRepository.update(id, {
      status: 'INACTIVE',
      webSuperMas: false,
      webDistribuidora: false,
      auditTrail: auditEntries,
    })

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
   * Obtiene los movimientos de Kardex recientes del producto.
   */
  async getProductMovements(id: string): Promise<ProductMovementSummary[]> {
    return PRODUCT_MOVEMENTS_MOCK[id] || []
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
      `"${p.category}"`,
      `"${p.brand}"`,
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
}

export const productService = new ProductService()
