/**
 * SUPER MÁS ERP/POS - Servicio de Negocio de Catálogo Distribuidora
 *
 * Administra la disponibilidad comercial, visibilidad en canales B2B,
 * configuración de WhatsApp y compra directa online.
 * Registra auditoría transversal y aplica control de acceso por roles.
 */

import { distributorCatalogRepository } from '../repositories/distributor-catalog.repository'
import { auditService } from '@/features/audit/services/audit.service'
import {
  DistributorCatalogProduct,
  DistributorCatalogFilters,
  DistributorCatalogPaginatedResult,
  DistributorCatalogStats,
  DistributorCatalogPermission,
  ProductCatalogConfigUpdate,
  BulkActionType,
} from '../types'
import {
  productCatalogConfigSchema,
  productCatalogConfigUpdateSchema,
  bulkActionSchema,
} from '../schemas/distributor-catalog.schema'

export interface UserContext {
  id: string
  name: string
  role: string
  locationId?: string
  permissions?: DistributorCatalogPermission[]
}

const DEFAULT_ADMIN_USER: UserContext = {
  id: 'user-01',
  name: 'Laura Gómez',
  role: 'SUPERADMIN',
  locationId: 'loc-001',
}

const ROLE_PERMISSIONS: Record<string, DistributorCatalogPermission[]> = {
  SUPERADMIN: [
    'distributor_catalog.read',
    'distributor_catalog.update',
    'distributor_catalog.publish',
    'distributor_catalog.bulk_update',
    'distributor_catalog.preview',
    'distributor_catalog.export',
  ],
  ADMIN: [
    'distributor_catalog.read',
    'distributor_catalog.update',
    'distributor_catalog.publish',
    'distributor_catalog.bulk_update',
    'distributor_catalog.preview',
    'distributor_catalog.export',
  ],
  ADMINISTRATOR: [
    'distributor_catalog.read',
    'distributor_catalog.update',
    'distributor_catalog.publish',
    'distributor_catalog.bulk_update',
    'distributor_catalog.preview',
    'distributor_catalog.export',
  ],
  WAREHOUSE_ADMIN: [
    'distributor_catalog.read',
    'distributor_catalog.update',
    'distributor_catalog.publish',
    'distributor_catalog.bulk_update',
    'distributor_catalog.preview',
    'distributor_catalog.export',
  ],
  POINT_ADMIN: [
    'distributor_catalog.read',
    'distributor_catalog.preview',
    'distributor_catalog.export',
  ],
  ACCOUNTANT: [
    'distributor_catalog.read',
    'distributor_catalog.preview',
    'distributor_catalog.export',
  ],
  SELLER: ['distributor_catalog.read', 'distributor_catalog.preview'],
  CASHIER: ['distributor_catalog.read'],
}

export class DistributorCatalogService {
  /**
   * Valida si un rol de usuario posee un permiso operativo específico.
   */
  hasPermission(
    permission: DistributorCatalogPermission,
    userRole: string = 'SUPERADMIN',
    customPermissions?: DistributorCatalogPermission[]
  ): boolean {
    if (customPermissions && customPermissions.includes(permission)) {
      return true
    }
    const normalizedRole = userRole.toUpperCase()
    const allowed = ROLE_PERMISSIONS[normalizedRole] || []
    return allowed.includes(permission)
  }

  private assertPermission(permission: DistributorCatalogPermission, user: UserContext): void {
    if (!this.hasPermission(permission, user.role, user.permissions)) {
      throw new Error(
        `Permiso denegado: Se requiere el permiso '${permission}' para ejecutar esta acción en Catálogo Distribuidora.`
      )
    }
  }

  /**
   * Consulta el catálogo de productos aplicando filtros y ordenamiento.
   */
  async getProducts(
    filters: DistributorCatalogFilters = {},
    user: UserContext = DEFAULT_ADMIN_USER
  ): Promise<DistributorCatalogPaginatedResult> {
    this.assertPermission('distributor_catalog.read', user)
    return distributorCatalogRepository.findAll(filters)
  }

  /**
   * Obtiene un producto individual por ID.
   */
  async getProductById(
    id: string,
    user: UserContext = DEFAULT_ADMIN_USER
  ): Promise<DistributorCatalogProduct | null> {
    this.assertPermission('distributor_catalog.read', user)
    return distributorCatalogRepository.findById(id)
  }

  /**
   * Consulta los indicadores del catálogo para los KPI cards.
   */
  async getStats(user: UserContext = DEFAULT_ADMIN_USER): Promise<DistributorCatalogStats> {
    this.assertPermission('distributor_catalog.read', user)
    return distributorCatalogRepository.getStats()
  }

  /**
   * Obtiene el listado de categorías disponibles.
   */
  async getCategories(): Promise<string[]> {
    return distributorCatalogRepository.getCategories()
  }

  /**
   * Obtiene el listado de marcas disponibles.
   */
  async getBrands(): Promise<string[]> {
    return distributorCatalogRepository.getBrands()
  }

  /**
   * Actualiza la configuración de canales de un producto maestro.
   */
  async updateProductConfig(
    productId: string,
    config: ProductCatalogConfigUpdate,
    user: UserContext = DEFAULT_ADMIN_USER
  ): Promise<DistributorCatalogProduct> {
    this.assertPermission('distributor_catalog.update', user)

    // Validar con Zod
    productCatalogConfigUpdateSchema.parse(config)

    const before = await distributorCatalogRepository.findById(productId)
    if (!before) {
      throw new Error(`El producto ${productId} no existe.`)
    }

    const updated = await distributorCatalogRepository.updateConfig(productId, config)

    // Registrar en auditoría
    await auditService.log({
      action: 'CATALOG_PRODUCT_UPDATED',
      module: 'PRODUCTS',
      entityType: 'PRODUCT_CATALOG_CONFIG',
      entityId: productId,
      entityReference: updated.sku,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      locationId: user.locationId,
      level: 'INFO',
      details: `Configuración comercial del producto ${updated.name} (${updated.sku}) actualizada por ${user.name}.`,
      changes: [
        {
          field: 'webDistribuidora',
          label: 'Publicado Distribuidora',
          previousValue: String(before.webDistribuidora),
          newValue: String(updated.webDistribuidora),
        },
        {
          field: 'webSuperMas',
          label: 'Publicado Super Más',
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
          field: 'webWhatsAppInquiryEnabled',
          label: 'Contacto WhatsApp',
          previousValue: String(before.webWhatsAppInquiryEnabled),
          newValue: String(updated.webWhatsAppInquiryEnabled),
        },
      ],
    })

    return updated
  }

  /**
   * Publica un producto en el Catálogo Distribuidora.
   */
  async publishProduct(
    productId: string,
    user: UserContext = DEFAULT_ADMIN_USER
  ): Promise<DistributorCatalogProduct> {
    this.assertPermission('distributor_catalog.publish', user)
    return this.updateProductConfig(productId, { webDistribuidora: true }, user)
  }

  /**
   * Oculta un producto del Catálogo Distribuidora.
   */
  async hideProduct(
    productId: string,
    user: UserContext = DEFAULT_ADMIN_USER
  ): Promise<DistributorCatalogProduct> {
    this.assertPermission('distributor_catalog.publish', user)
    return this.updateProductConfig(productId, { webDistribuidora: false }, user)
  }

  /**
   * Ejecuta una acción masiva sobre una lista de productos seleccionados.
   */
  async bulkUpdate(
    productIds: string[],
    action: BulkActionType,
    user: UserContext = DEFAULT_ADMIN_USER
  ): Promise<{ updatedCount: number; updatedProducts: DistributorCatalogProduct[] }> {
    this.assertPermission('distributor_catalog.bulk_update', user)

    bulkActionSchema.parse({ action, productIds })

    const result = await distributorCatalogRepository.bulkUpdate(productIds, action)

    await auditService.log({
      action: 'CATALOG_BULK_UPDATED',
      module: 'PRODUCTS',
      entityType: 'PRODUCT_CATALOG_BULK',
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
   * Exporta los productos filtrados a formato CSV descargable.
   */
  async exportToCsv(
    filters: DistributorCatalogFilters = {},
    user: UserContext = DEFAULT_ADMIN_USER
  ): Promise<string> {
    this.assertPermission('distributor_catalog.export', user)

    const { products } = await distributorCatalogRepository.findAll({
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
      'Precio_Distribuidor',
      'Precio_Publico',
      'Estado_Distribuidora',
      'Estado_SuperMas',
      'Disponibilidad',
      'Compra_Directa_Web',
      'Contacto_WhatsApp',
      'Telefono_WhatsApp',
    ]

    const rows = products.map((p) => [
      `"${p.sku}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.barcode}"`,
      `"${p.category}"`,
      `"${p.brand}"`,
      p.distributorPrice,
      p.normalPrice,
      p.webDistribuidora ? 'PUBLICADO' : 'OCULTO',
      p.webSuperMas ? 'ACTIVO' : 'INACTIVO',
      `"${p.availabilityLabel}"`,
      p.canBuyDirectly ? 'SI' : 'NO',
      p.canContactWhatsApp ? 'SI' : 'NO',
      `"${p.webWhatsAppPhone || ''}"`,
    ])

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  }
}

export const distributorCatalogService = new DistributorCatalogService()
