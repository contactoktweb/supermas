/**
 * SUPER MÁS ERP/POS - Tipos del Módulo Catálogo Super Más
 *
 * Administra los productos para venta directa desde la tienda web oficial de Super Más,
 * adición al carrito, generación de Pedidos Web y articulación con facturación y stock.
 */

export type StockAvailabilityLevel = 'AVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK'

export interface WarehouseStockSummaryItem {
  locationId: string
  locationName: string
  locationCode: string
  currentStock: number
  isEcommerceSource: boolean
}

export interface SuperCatalogProduct {
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
  images: string[]
  price: number
  showPrice: boolean
  taxProfile: string
  taxConfigId: string
  vatRatePercent: number
  isExempt: boolean
  status: 'ACTIVE' | 'INACTIVE'
  webSuperMas: boolean
  webDirectPurchaseEnabled: boolean
  webLowStockThreshold: number
  availability: StockAvailabilityLevel
  availabilityLabel: 'Disponible' | 'Pocas unidades' | 'Agotado'
  canBuyDirectly: boolean
  webViewsCount: number
  webOrdersCount: number
  totalSoldUnits: number
  /**
   * Resumen de stock interno por bodega visible ÚNICAMENTE en el drawer administrativo.
   * NUNCA se expone en la vista cliente del ecommerce.
   */
  warehouseStockSummary: WarehouseStockSummaryItem[]
  updatedAt?: string
}

export interface SuperCatalogStats {
  publishedCount: number
  hiddenCount: number
  availableCount: number
  lowStockCount: number
  outOfStockCount: number
  topSellingProduct: {
    id: string
    name: string
    sku: string
    soldUnits: number
  } | null
  mostViewedProduct: {
    id: string
    name: string
    sku: string
    views: number
  } | null
  totalSalesFromWeb: number
  totalProductsCount: number
}

export interface SuperCatalogFilters {
  search?: string
  category?: string | 'ALL'
  brand?: string | 'ALL'
  availability?: StockAvailabilityLevel | 'ALL'
  catalogStatus?: 'ALL' | 'PUBLISHED' | 'HIDDEN'
  purchaseStatus?: 'ALL' | 'ENABLED' | 'DISABLED'
  priceMin?: number
  priceMax?: number
  sortBy?: 'name' | 'price' | 'sku' | 'category' | 'brand' | 'availability' | 'sales' | 'views'
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface SuperCatalogPaginatedResult {
  products: SuperCatalogProduct[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ProductWebConfigUpdate {
  webSuperMas?: boolean
  webDirectPurchaseEnabled?: boolean
  price?: number
  showPrice?: boolean
  webLowStockThreshold?: number
  taxConfigId?: string
  images?: string[]
  imageUrl?: string
}

export type SuperBulkActionType =
  | 'PUBLISH'
  | 'HIDE'
  | 'ENABLE_PURCHASE'
  | 'DISABLE_PURCHASE'

export type SuperCatalogPermission =
  | 'super_catalog.read'
  | 'super_catalog.update'
  | 'super_catalog.publish'
  | 'super_catalog.price'
  | 'super_catalog.images'
  | 'super_catalog.bulk_update'
  | 'super_catalog.export'
