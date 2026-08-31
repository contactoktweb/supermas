/**
 * MÓDULO DE PRODUCTOS — SUPER MÁS ERP/POS
 * Tipos de dominio, modelos de datos, listas de precios extensibles,
 * configuración tributaria y canales web.
 */

export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'

export type ProductStockHealth = 'AVAILABLE' | 'LOW_STOCK' | 'CRITICAL' | 'OUT_OF_STOCK'

export type WebAvailability = 'AVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK'

export type WebCatalogChannel = 'SUPER_MAS' | 'DISTRIBUIDORA' | 'BOTH' | 'NONE'

export type UnitOfMeasure = 'UND' | 'KG' | 'PAQ' | 'CAJA' | 'LT' | 'GR' | 'MT' | 'DOCENA'

export type TaxProfile = 'EXENTO' | 'EXCLUIDO' | 'IVA_0' | 'IVA_5' | 'IVA_19' | 'CUSTOM'

export interface TaxRateConfig {
  id: string
  name: string
  code: TaxProfile
  ratePercent: number
  description?: string
  isDefault?: boolean
}

export interface PriceTier {
  id: string
  name: string
  code: string // e.g. 'NORMAL', 'MAYORISTA', 'DISTRIBUIDOR', 'SUPERMERCADO'
  price: number
  minQuantity?: number
  isDefault?: boolean
  description?: string
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

export interface Product {
  id: string
  sku: string
  barcode: string
  name: string
  slug: string
  description: string
  category: string
  brand: string
  unitOfMeasure: UnitOfMeasure
  imageUrl: string
  images: string[]
  status: ProductStatus
  taxProfile: TaxProfile
  vatRatePercent: number
  isExempt: boolean
  prices: PriceTier[]
  normalPrice: number
  wholesalePrice: number
  distributorPrice?: number
  averageCost: number // Calculado por stock y protegido por RBAC
  inventoryValueAtCost: number // totalStock * averageCost
  profitMarginAmount: number // (normalPrice / (1 + vatRatePercent/100)) - averageCost
  profitMarginPercent: number // (profitMarginAmount / (normalPrice / (1 + vatRatePercent/100))) * 100
  totalStock: number // Existencia agregada en todas las bodegas
  availableUnits: number
  minStockThreshold: number
  criticalStockThreshold: number
  stockHealth: ProductStockHealth
  webSuperMas: boolean // Catálogo Super Más (compra directa web)
  webDistribuidora: boolean // Catálogo Distribuidora (contacto WhatsApp)
  webAvailability: WebAvailability // Derivado dinámicamente de la sumatoria de stock
  warehouseStock: WarehouseStockDetail[]
  auditTrail?: ProductAuditEntry[]
  createdAt: string
  updatedAt: string
}

export interface ProductFilterParams {
  query?: string
  category?: string
  brand?: string
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

export interface CreateProductInput {
  name: string
  sku: string
  barcode: string
  description?: string
  category: string
  brand: string
  unitOfMeasure: UnitOfMeasure
  imageUrl?: string
  images?: string[]
  status: ProductStatus
  taxProfile: TaxProfile
  vatRatePercent: number
  prices: {
    code: string
    name: string
    price: number
    minQuantity?: number
  }[]
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
