/**
 * MÓDULO DE PRODUCTOS — SUPER MÁS ERP/POS
 * Tipos de dominio, modelos de datos alineados con PostgreSQL (public.products),
 * listas de precios extensibles, configuración tributaria y canales web.
 */

export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'

export type ProductStockHealth = 'AVAILABLE' | 'LOW_STOCK' | 'CRITICAL' | 'OUT_OF_STOCK'

export type WebAvailability = 'AVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK'

export type WebCatalogChannel = 'SUPER_MAS' | 'DISTRIBUIDORA' | 'BOTH' | 'NONE'

export type UnitOfMeasure = 'UND' | 'KG' | 'PAQ' | 'CAJA' | 'LT' | 'GR' | 'MT' | 'DOCENA'

export type TaxProfile = 'EXENTO' | 'EXCLUIDO' | 'IVA_0' | 'IVA_5' | 'IVA_19' | 'CUSTOM'

export interface TaxRateConfig {
  id: string
  code: string
  name: string
  ratePercent: number
  percentage?: number // PostgreSQL column: public.tax_rates.percentage
  type?: string // 'IVA', 'EXCLUIDO', 'NO_GRAVADO', 'OTRO'
  isActive?: boolean
  description?: string
  isDefault?: boolean
}

export interface PriceTier {
  id?: string
  name: string
  code: string // e.g. 'NORMAL', 'MAYORISTA', 'DISTRIBUIDOR', 'SUPERMERCADO'
  price: number
  minQuantity?: number
  isDefault?: boolean
  isActive?: boolean
  startDate?: string | null
  endDate?: string | null
  description?: string
}

export interface ProductPrice {
  id: string
  companyId: string
  productId: string
  priceListCode: string
  priceListName: string
  price: number
  minQuantity: number
  isDefault: boolean
  isActive: boolean
  startDate?: string | null
  endDate?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface WarehouseStockDetail {
  locationId: string
  locationName: string
  locationCode: string
  locationType: 'PHYSICAL_STORE' | 'MAIN_WAREHOUSE' | 'SATELLITE_WAREHOUSE' | 'CROSS_DOCK'
  quantity: number
  minStock: number
  criticalStock: number
  averageCost: number // Permission-protected (cost.read)
  inventoryValueAtCost: number // Permission-protected (cost.read)
  stockHealth: ProductStockHealth
  percentageOfTotalStock: number // Para barras de distribución animadas (%)
}

export interface ProductMovementSummary {
  id: string
  timestamp: string
  type: 'VENTA' | 'COMPRA' | 'TRANSFERENCIA_ENTRADA' | 'TRANSFERENCIA_SALIDA' | 'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO'
  quantity: number
  unitCost: number
  previousBalance: number
  newBalance: number
  documentRef: string
  locationName: string
  userName: string
}

export interface ProductAuditEntry {
  id: string
  productId: string
  fieldChanged: string
  oldValue: string
  newValue: string
  changedBy: string
  changedAt: string
  reason?: string
}

/**
 * Modelo canónico de Producto alineado con public.products en PostgreSQL.
 * Las relaciones hacia categoría y marca se expresan mediante UUIDs (categoryId, brandId).
 */
export interface Product {
  // Columnas maestras de PostgreSQL (public.products)
  id: string
  companyId: string
  categoryId: string
  brandId: string
  sku: string
  barcode?: string
  name: string
  slug: string
  shortDescription?: string
  fullDescription?: string
  unitOfMeasure: UnitOfMeasure
  costPrice: number
  publicSalePrice: number
  wholesalePrice: number
  minWholesaleQuantity: number
  taxRatePercent: number
  isTaxExempt: boolean
  primaryImageUrl?: string
  secondaryImages: string[]
  minStockThreshold: number
  criticalStockThreshold: number
  isActive: boolean
  isPublishedSupermas: boolean
  isPublishedDistributor: boolean
  inventoryType: string
  accountingCategoryId?: string
  createdAt: string
  updatedAt: string

  // Relaciones tipadas para joins y visualización UI
  category?: {
    id: string
    name: string
    code?: string
    slug?: string
  } | null
  brand?: {
    id: string
    name: string
    slug?: string
  } | null
  categoryName?: string
  brandName?: string

  // Propiedades calculadas y de compatibilidad para vistas
  imageUrl: string
  images: string[]
  description: string
  status: ProductStatus
  taxProfile: TaxProfile
  vatRatePercent: number
  isExempt: boolean
  prices: PriceTier[]
  normalPrice: number
  distributorPrice?: number
  averageCost: number
  inventoryValueAtCost: number
  profitMarginAmount: number
  profitMarginPercent: number
  totalStock: number
  availableUnits: number
  stockHealth: ProductStockHealth
  webSuperMas: boolean
  webDistribuidora: boolean
  webAvailability: WebAvailability
  warehouseStock: WarehouseStockDetail[]
  auditTrail?: ProductAuditEntry[]
}

export interface ProductFilterParams {
  query?: string
  category?: string
  brand?: string
  categoryId?: string
  brandId?: string
  status?: 'ALL' | ProductStatus
  stockHealth?: 'ALL' | ProductStockHealth
  locationId?: string
  webChannel?: 'ALL' | 'SUPER_MAS' | 'DISTRIBUIDORA' | 'BOTH' | 'NONE'
  page?: number
  pageSize?: number
  sortField?: ProductSortField
  sortDirection?: ProductSortDirection
}

export type ProductSortField =
  | 'name'
  | 'sku'
  | 'barcode'
  | 'category'
  | 'brand'
  | 'stock'
  | 'normalPrice'
  | 'wholesalePrice'
  | 'averageCost'
  | 'margin'
  | 'status'
  | 'updatedAt'

export type ProductSortDirection = 'asc' | 'desc'

export interface PaginatedProductsResponse {
  items: Product[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  isCostRedacted: boolean
}

export interface GlobalProductsStats {
  totalProducts: number
  activeProducts: number
  outOfStockProducts: number
  lowStockProducts: number
  totalInventoryValueAtCost: number // Protegido por RBAC
  webPublishedProducts: number
  isCostRedacted: boolean
}

export interface UserPermissionContext {
  userId: string
  userName: string
  userRole: string
  permissions: string[]
}

/**
 * Payload de entrada para crear un producto.
 * companyId NO se expone al usuario; es resuelto por la sesión/RLS.
 * categoryId y brandId son UUIDs obligatorios.
 */
export interface CreateProductInput {
  name: string
  sku: string
  barcode?: string
  description?: string
  categoryId: string
  brandId: string
  unitOfMeasure: UnitOfMeasure
  imageUrl?: string
  images?: string[]
  status: ProductStatus
  taxProfile: TaxProfile
  vatRatePercent: number
  prices: PriceTier[]
  minStockThreshold?: number
  criticalStockThreshold?: number
  webSuperMas: boolean
  webDistribuidora: boolean
  warehouseDistribution?: {
    locationId: string
    minStock: number
    criticalStock: number
  }[]
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  auditReason?: string
}

export interface ProductColumnVisibility {
  image: boolean
  sku: boolean
  barcode: boolean
  name: boolean
  category: boolean
  brand: boolean
  stock: boolean
  status: boolean
  cost: boolean
  normalPrice: boolean
  wholesalePrice: boolean
  margin: boolean
  webSuperMas: boolean
  webDistribuidora: boolean
  actions: boolean
}
