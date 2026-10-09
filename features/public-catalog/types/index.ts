/**
 * SUPER MÁS ERP/POS - Tipos del Módulo API Pública de Catálogos
 *
 * Expone productos hacia aplicaciones web externas (tienda B2C, portal B2B, ecommerce).
 *
 * REGLAS DE PRIVACIDAD Y SEGURIDAD:
 * - NUNCA expone costos de compra, márgenes de ganancia, proveedores ni cuentas contables.
 * - NUNCA expone inventario numérico exacto ni desgloses de bodegas internas.
 * - Disponibilidad pública expresada estrictamente como: AVAILABLE, LOW_STOCK, OUT_OF_STOCK.
 */

export type StockAvailabilityLevel = 'AVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK'
export type StockAvailabilityLabel = 'Disponible' | 'Pocas unidades' | 'Agotado'

/**
 * DTO público sanitizado para productos del Catálogo Super Más (B2C)
 */
export interface PublicSuperCatalogProduct {
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
  vatRatePercent: number
  isExempt: boolean
  availability: StockAvailabilityLevel
  availabilityLabel: StockAvailabilityLabel
  canBuyDirectly: boolean
  updatedAt?: string
}

/**
 * DTO público sanitizado para productos del Catálogo Distribuidora (B2B)
 */
export interface PublicDistributorCatalogProduct {
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
  distributorPrice: number
  normalPrice: number
  availability: StockAvailabilityLevel
  availabilityLabel: StockAvailabilityLabel
  canBuyDirectly: boolean
  canContactWhatsApp: boolean
  whatsappUrl?: string
  updatedAt?: string
}

export interface PublicCatalogPagination {
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface PublicCatalogListResponse<T> {
  success: boolean
  channel: 'supermas' | 'distributor'
  data: T[]
  pagination: PublicCatalogPagination
}

export interface PublicProductDetailResponse<T> {
  success: boolean
  channel: 'supermas' | 'distributor'
  data: T
}

export interface PublicCatalogFilters {
  search?: string
  category?: string
  brand?: string
  availability?: StockAvailabilityLevel
  minPrice?: number
  maxPrice?: number
  directPurchase?: boolean
  sortBy?: 'name' | 'price' | 'sku'
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  companyId?: string
}
