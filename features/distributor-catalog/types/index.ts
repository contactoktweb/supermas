/**
 * SUPER MÁS ERP/POS - Tipos del Módulo Catálogo Distribuidora
 *
 * Define modelos y tipos para la administración de productos del catálogo público B2B,
 * visibilidad comercial, contacto por WhatsApp, vinculación con Catálogo Super Más
 * y compra directa online.
 */

export type StockAvailabilityLevel = 'AVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK'

export interface DistributorCatalogProduct {
  id: string
  sku: string
  barcode: string
  name: string
  slug: string
  description: string
  category: string
  brand: string
  unitOfMeasure: string
  imageUrl?: string
  images?: string[]
  distributorPrice: number
  normalPrice: number
  status: 'ACTIVE' | 'INACTIVE'
  webDistribuidora: boolean
  webSuperMas: boolean
  webDirectPurchaseEnabled: boolean
  webWhatsAppInquiryEnabled: boolean
  webWhatsAppPhone?: string
  availability: StockAvailabilityLevel
  availabilityLabel: 'Disponible' | 'Pocas unidades' | 'Agotado'
  canBuyDirectly: boolean
  canContactWhatsApp: boolean
  whatsappUrl?: string
  updatedAt?: string
}

export interface DistributorCatalogStats {
  publishedCount: number
  hiddenCount: number
  availableCount: number
  lowStockCount: number
  outOfStockCount: number
  directPurchaseActiveCount: number
  totalProductsCount: number
}

export interface DistributorCatalogFilters {
  search?: string
  category?: string | 'ALL'
  brand?: string | 'ALL'
  availability?: StockAvailabilityLevel | 'ALL'
  distributorStatus?: 'ALL' | 'PUBLISHED' | 'HIDDEN'
  superMasStatus?: 'ALL' | 'PUBLISHED' | 'HIDDEN'
  directPurchase?: 'ALL' | 'ENABLED' | 'DISABLED'
  sortBy?: 'name' | 'price' | 'sku' | 'category' | 'brand' | 'availability'
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface DistributorCatalogPaginatedResult {
  products: DistributorCatalogProduct[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type DistributorCatalogPermission =
  | 'distributor_catalog.read'
  | 'distributor_catalog.update'
  | 'distributor_catalog.publish'
  | 'distributor_catalog.bulk_update'
  | 'distributor_catalog.preview'
  | 'distributor_catalog.export'

export type BulkActionType =
  | 'PUBLISH'
  | 'HIDE'
  | 'ENABLE_WHATSAPP'
  | 'DISABLE_WHATSAPP'
  | 'ENABLE_DIRECT_PURCHASE'
  | 'DISABLE_DIRECT_PURCHASE'

export interface ProductCatalogConfigUpdate {
  webDistribuidora?: boolean
  webSuperMas?: boolean
  webDirectPurchaseEnabled?: boolean
  webWhatsAppInquiryEnabled?: boolean
  webWhatsAppPhone?: string
}
