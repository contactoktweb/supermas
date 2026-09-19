/**
 * SUPER MÁS ERP/POS - Servicio del Catálogo Super Más
 *
 * Fachada de negocio encargada de validar permisos RBAC, esquemas Zod,
 * registrar trazabilidad inmutable mediante auditService.log() y coordinar
 * las operaciones del catálogo de venta web directa.
 */

import { superCatalogRepository } from '../repositories/super-catalog.repository'
import {
  SuperCatalogProduct,
  SuperCatalogFilters,
  SuperCatalogPaginatedResult,
  SuperCatalogStats,
  SuperCatalogPermission,
  ProductWebConfigUpdate,
  SuperBulkActionType,
} from '../types'
import {
  superProductConfigUpdateSchema,
  superProductPriceSchema,
  superProductImagesSchema,
  superBulkActionSchema,
} from '../schemas/super-catalog.schema'
import { auditService } from '@/features/audit/services/audit.service'

export interface UserContext {
  id: string
  name: string
  role: string
  locationId?: string
  permissions?: SuperCatalogPermission[]
}

const DEFAULT_ADMIN_USER: UserContext = {
  id: 'user-01',
  name: 'Laura Gómez',
  role: 'SUPERADMIN',
  locationId: 'loc-001',
}

const ROLE_PERMISSIONS: Record<string, SuperCatalogPermission[]> = {
  SUPERADMIN: [
    'super_catalog.read',
    'super_catalog.update',
    'super_catalog.publish',
    'super_catalog.price',
    'super_catalog.images',
    'super_catalog.bulk_update',
    'super_catalog.export',
  ],
  ADMIN: [
    'super_catalog.read',
    'super_catalog.update',
    'super_catalog.publish',
    'super_catalog.price',
    'super_catalog.images',
    'super_catalog.bulk_update',
    'super_catalog.export',
  ],
  ADMINISTRATOR: [
    'super_catalog.read',
    'super_catalog.update',
    'super_catalog.publish',
    'super_catalog.price',
    'super_catalog.images',
    'super_catalog.bulk_update',
    'super_catalog.export',
  ],
  WAREHOUSE_ADMIN: [
    'super_catalog.read',
    'super_catalog.update',
    'super_catalog.publish',
    'super_catalog.price',
    'super_catalog.images',
    'super_catalog.bulk_update',
    'super_catalog.export',
  ],
  POINT_ADMIN: [
    'super_catalog.read',
    'super_catalog.price',
    'super_catalog.export',
  ],
  ACCOUNTANT: [
    'super_catalog.read',
    'super_catalog.price',
    'super_catalog.export',
  ],
  SELLER: [
    'super_catalog.read',
    'super_catalog.export',
  ],
  CASHIER: [
    'super_catalog.read',
  ],
}

export class SuperCatalogService {
  /**
   * Valida si un usuario posee un permiso operativo específico.
   */
  hasPermission(
    permission: SuperCatalogPermission,
    userRole: string = 'SUPERADMIN',
    customPermissions?: SuperCatalogPermission[]
  ): boolean {
    if (customPermissions && customPermissions.includes(permission)) {
      return true
    }
    const normalizedRole = userRole.toUpperCase()
    const allowed = ROLE_PERMISSIONS[normalizedRole] || []
    return allowed.includes(permission)
  }

  private assertPermission(permission: SuperCatalogPermission, user: UserContext): void {
    if (!this.hasPermission(permission, user.role, user.permissions)) {
      throw new Error(
        `Permiso denegado: Se requiere el permiso '${permission}' para ejecutar esta acción en Catálogo Super Más.`
      )
    }
  }

  /**
   * Consulta el catálogo de productos con filtros y paginación.
   */
  async getProducts(
    filters: SuperCatalogFilters = {},
    user: UserContext = DEFAULT_ADMIN_USER
  ): Promise<SuperCatalogPaginatedResult> {
    this.assertPermission('super_catalog.read', user)
    return superCatalogRepository.findAll(filters)
  }

  /**
   * Obtiene un producto por su ID.
   */
  async getProductById(
    id: string,
    user: UserContext = DEFAULT_ADMIN_USER
  ): Promise<SuperCatalogProduct | null> {
    this.assertPermission('super_catalog.read', user)
    return superCatalogRepository.findById(id)
  }

  /**
   * Obtiene los indicadores y métricas del dashboard.
   */
  async getStats(user: UserContext = DEFAULT_ADMIN_USER): Promise<SuperCatalogStats> {
    this.assertPermission('super_catalog.read', user)
    return superCatalogRepository.getStats()
  }

  /**
   * Obtiene categorías disponibles.
   */
  async getCategories(): Promise<string[]> {
    return superCatalogRepository.getCategories()
  }

  /**
   * Obtiene marcas disponibles.
   */
  async getBrands(): Promise<string[]> {
    return superCatalogRepository.getBrands()
  }

  /**
   * Obtiene lista de perfiles impositivos.
   */
  async getTaxConfigs(): Promise<any[]> {
    return superCatalogRepository.getTaxConfigs()
  }

  /**
   * Actualiza la configuración comercial de un producto.
   */
  async updateProductConfig(
    productId: string,
    config: ProductWebConfigUpdate,
    user: UserContext = DEFAULT_ADMIN_USER
  ): Promise<SuperCatalogProduct> {
    this.assertPermission('super_catalog.update', user)

    superProductConfigUpdateSchema.parse(config)

    const before = await superCatalogRepository.findById(productId)
    if (!before) {
      throw new Error(`El producto con ID ${productId} no fue encontrado.`)
    }

    const updated = await superCatalogRepository.updateConfig(productId, config)

    await auditService.log({
      action: 'SUPER_CATALOG_PRODUCT_UPDATED',
      module: 'PRODUCTS',
      entityType: 'PRODUCT_SUPER_CATALOG',
      entityId: productId,
      entityReference: `${updated.sku} - ${updated.name}`,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      locationId: user.locationId,
      level: 'INFO',
      details: `Configuración web de "${updated.name}" actualizada por ${user.name}.`,
      changes: [
        {
          field: 'webSuperMas',
          label: 'Catálogo Super Más',
          previousValue: String(before.webSuperMas),
          newValue: String(updated.webSuperMas),
        },
        {
          field: 'webDirectPurchaseEnabled',
          label: 'Compra Directa',
          previousValue: String(before.webDirectPurchaseEnabled),
          newValue: String(updated.webDirectPurchaseEnabled),
        },
        {
          field: 'price',
          label: 'Precio Web',
          previousValue: String(before.price),
          newValue: String(updated.price),
        },
      ],
    })

    return updated
  }

  /**
   * Publica un producto en la web oficial de Super Más.
   */
  async publishProduct(
    productId: string,
    user: UserContext = DEFAULT_ADMIN_USER
  ): Promise<SuperCatalogProduct> {
    this.assertPermission('super_catalog.publish', user)
    return this.updateProductConfig(productId, { webSuperMas: true }, user)
  }

  /**
   * Oculta un producto del catálogo web oficial.
   */
  async hideProduct(
    productId: string,
    user: UserContext = DEFAULT_ADMIN_USER
  ): Promise<SuperCatalogProduct> {
    this.assertPermission('super_catalog.publish', user)
    return this.updateProductConfig(
      productId,
      { webSuperMas: false, webDirectPurchaseEnabled: false },
      user
    )
  }

  /**
   * Actualiza el precio de venta web y su impuesto.
   */
  async updatePrice(
    productId: string,
    price: number,
    showPrice: boolean = true,
    taxConfigId: string = 'tax-exento',
    user: UserContext = DEFAULT_ADMIN_USER
  ): Promise<SuperCatalogProduct> {
    this.assertPermission('super_catalog.price', user)

    superProductPriceSchema.parse({ price, showPrice, taxConfigId })

    const before = await superCatalogRepository.findById(productId)
    if (!before) {
      throw new Error(`El producto con ID ${productId} no existe.`)
    }

    const updated = await superCatalogRepository.updateConfig(productId, {
      price,
      showPrice,
      taxConfigId,
    })

    await auditService.log({
      action: 'PRICE_MODIFIED',
      module: 'PRODUCTS',
      entityType: 'PRODUCT_PRICE',
      entityId: productId,
      entityReference: `${updated.sku} - ${updated.name}`,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      locationId: user.locationId,
      level: 'INFO',
      details: `Precio web actualizado de $${before.price} a $${price} por ${user.name}.`,
      changes: [
        { field: 'price', label: 'Precio Web', previousValue: String(before.price), newValue: String(price) },
        { field: 'taxConfigId', label: 'Perfil IVA', previousValue: before.taxConfigId, newValue: taxConfigId },
      ],
    })

    return updated
  }

  /**
   * Actualiza la galería fotográfica de un producto.
   */
  async updateImages(
    productId: string,
    imageUrl?: string,
    images: string[] = [],
    user: UserContext = DEFAULT_ADMIN_USER
  ): Promise<SuperCatalogProduct> {
    this.assertPermission('super_catalog.images', user)

    superProductImagesSchema.parse({ imageUrl, images })

    const updated = await superCatalogRepository.updateConfig(productId, {
      imageUrl,
      images,
    })

    await auditService.log({
      action: 'SUPER_CATALOG_PRODUCT_UPDATED',
      module: 'PRODUCTS',
      entityType: 'PRODUCT_IMAGES',
      entityId: productId,
      entityReference: `${updated.sku} - ${updated.name}`,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      locationId: user.locationId,
      level: 'INFO',
      details: `Galería fotográfica de "${updated.name}" actualizada con ${images.length} imágenes por ${user.name}.`,
    })

    return updated
  }

  /**
   * Ejecuta una acción masiva en lote sobre productos seleccionados.
   */
  async bulkUpdate(
    productIds: string[],
    action: SuperBulkActionType,
    user: UserContext = DEFAULT_ADMIN_USER
  ): Promise<{ updatedCount: number; updatedProducts: SuperCatalogProduct[] }> {
    this.assertPermission('super_catalog.bulk_update', user)

    superBulkActionSchema.parse({ action, productIds })

    const result = await superCatalogRepository.bulkUpdate(productIds, action)

    await auditService.log({
      action: 'SUPER_CATALOG_BULK_UPDATED',
      module: 'PRODUCTS',
      entityType: 'PRODUCT_SUPER_CATALOG_BULK',
      entityId: 'bulk-action',
      entityReference: `${result.updatedCount} productos`,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      locationId: user.locationId,
      level: 'INFO',
      details: `Acción masiva '${action}' aplicada a ${result.updatedCount} productos por ${user.name}.`,
    })

    return result
  }

  /**
   * Simula la incorporación de un producto al carrito de compra web y calcula subtotal e IVA.
   */
  async simulateAddToCart(
    productId: string,
    quantity: number = 1
  ): Promise<{
    success: boolean
    message: string
    cartItem?: {
      productId: string
      productName: string
      sku: string
      unitPrice: number
      quantity: number
      taxRatePercent: number
      subtotal: number
      taxAmount: number
      total: number
    }
  }> {
    const product = await superCatalogRepository.findById(productId)
    if (!product) {
      return { success: false, message: 'Producto no encontrado en el catálogo.' }
    }

    if (!product.webSuperMas) {
      return { success: false, message: 'El producto no se encuentra disponible en la tienda online.' }
    }

    if (!product.canBuyDirectly) {
      return { success: false, message: 'El producto no tiene la opción de compra directa activa o está agotado.' }
    }

    if (quantity <= 0) {
      return { success: false, message: 'La cantidad a comprar debe ser mayor a 0.' }
    }

    const unitPrice = product.price
    const subtotal = unitPrice * quantity
    const taxRate = product.vatRatePercent || 0
    const taxAmount = Math.round(subtotal * (taxRate / 100))
    const total = subtotal + taxAmount

    return {
      success: true,
      message: `¡"${product.name}" agregado al carrito exitosamente!`,
      cartItem: {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        unitPrice,
        quantity,
        taxRatePercent: taxRate,
        subtotal,
        taxAmount,
        total,
      },
    }
  }

  /**
   * Exporta los productos filtrados a formato CSV descargable.
   */
  async exportToCsv(
    filters: SuperCatalogFilters = {},
    user: UserContext = DEFAULT_ADMIN_USER
  ): Promise<string> {
    this.assertPermission('super_catalog.export', user)

    const { products } = await superCatalogRepository.findAll({
      ...filters,
      page: 1,
      pageSize: 5000,
    })

    const headers = [
      'SKU',
      'Producto',
      'Codigo_Barras',
      'Categoria',
      'Marca',
      'Precio_Venta_Web',
      'IVA_Porcentaje',
      'Perfil_Tributario',
      'Publicado_Web',
      'Compra_Directa_Activa',
      'Disponibilidad',
      'Umbral_Pocas_Unidades',
      'Unidades_Vendidas_Web',
      'Visualizaciones_Web',
    ]

    const rows = products.map((p) => [
      `"${p.sku}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.barcode}"`,
      `"${p.category}"`,
      `"${p.brand}"`,
      p.price,
      `${p.vatRatePercent}%`,
      `"${p.taxProfile}"`,
      p.webSuperMas ? 'PUBLICADO' : 'OCULTO',
      p.webDirectPurchaseEnabled ? 'ACTIVO' : 'INACTIVO',
      `"${p.availabilityLabel}"`,
      p.webLowStockThreshold,
      p.totalSoldUnits,
      p.webViewsCount,
    ])

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  }
}

export const superCatalogService = new SuperCatalogService()
