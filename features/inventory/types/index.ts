export type StockHealthStatus =
  | 'AVAILABLE'
  | 'LOW_STOCK'
  | 'CRITICAL'
  | 'OUT_OF_STOCK'

export type InventoryViewMode = 'CONSOLIDATED' | 'BY_LOCATION'

export type InventoryTabFilter = 'ALL' | 'LOW_STOCK' | 'CRITICAL' | 'OUT_OF_STOCK'

export interface LocationStockBreakdown {
  locationId: string
  locationName: string
  locationCode: string
  stock: number
  minStock: number
  criticalStock: number
  health: StockHealthStatus
  averageCost: number
  valueAtCost: number
  lastMovementAt?: string
  lastMovementDoc?: string
}

export interface InventoryStockLevel {
  id: string
  productId: string
  productName: string
  sku: string
  barcode?: string
  category: string
  brand: string
  unitOfMeasure: string
  imageUrl?: string
  locationId: string
  locationName: string
  locationCode: string
  currentStock: number
  minStock: number
  criticalStock: number
  reorderPoint?: number
  averageCost: number // Redacted if no cost.read
  totalValueAtCost: number // Redacted if no cost.read
  stockHealth: StockHealthStatus
  lastMovementAt?: string
  lastMovementType?: string
  lastMovementDoc?: string
}

export interface ConsolidatedProductStock {
  productId: string
  productName: string
  sku: string
  barcode?: string
  category: string
  brand: string
  unitOfMeasure: string
  imageUrl?: string
  totalStock: number
  totalValueAtCost: number
  averageCost: number
  overallHealth: StockHealthStatus
  minStockConsolidated: number
  criticalStockConsolidated: number
  locationsCount: number
  locationBreakdown: LocationStockBreakdown[]
  lastMovementAt?: string
  lastMovementType?: string
  lastMovementDoc?: string
}

export interface InventoryKPIs {
  totalValueAtCost: number
  totalUnitsAvailable: number
  productsWithStock: number
  lowStockCount: number
  criticalStockCount: number
  outOfStockCount: number
  isCostRedacted: boolean
}

export interface InventoryFilterParams {
  query?: string
  locationId?: string | 'ALL'
  category?: string | 'ALL'
  brand?: string | 'ALL'
  stockHealth?: StockHealthStatus | 'ALL'
  hasStock?: 'ALL' | 'WITH_STOCK' | 'ZERO_STOCK'
  tab?: InventoryTabFilter
  page?: number
  pageSize?: number
  sortField?: InventorySortField
  sortDirection?: 'asc' | 'desc'
  viewMode?: InventoryViewMode
}

export type InventorySortField =
  | 'productName'
  | 'sku'
  | 'category'
  | 'currentStock'
  | 'totalStock'
  | 'stockHealth'
  | 'totalValueAtCost'
  | 'lastMovementAt'
  | 'locationName'

export interface InventoryColumnVisibility {
  product: boolean
  sku: boolean
  barcode: boolean
  category: boolean
  location: boolean
  currentStock: boolean
  minStock: boolean
  criticalStock: boolean
  status: boolean
  averageCost: boolean
  totalValue: boolean
  lastMovement: boolean
  actions: boolean
}

export interface StockAdjustmentInput {
  locationId: string
  productId: string
  type: 'IN' | 'OUT'
  quantity: number
  reason: string
  notes?: string
  evidenceUrl?: string
  responsibleUserId?: string
  responsibleUserName?: string
}

export interface PhysicalCountItem {
  productId: string
  productName: string
  sku: string
  category: string
  unitOfMeasure: string
  systemStock: number
  physicalStock: number
  difference: number
  differenceValue?: number
}

export interface PhysicalCountSession {
  id: string
  sessionNumber: string
  locationId: string
  locationName: string
  createdAt: string
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  notes?: string
  items: PhysicalCountItem[]
}

export interface QuickTransferInput {
  productId: string
  productName: string
  sku: string
  originLocationId: string
  destinationLocationId: string
  quantity: number
  notes?: string
}

export interface ThresholdUpdateInput {
  productId: string
  locationId: string
  minStock: number
  criticalStock: number
  reorderPoint?: number
}

export interface UserPermissionContext {
  userId: string
  userRole: 'ADMIN' | 'SELLER' | 'WAREHOUSE_MANAGER' | 'AUDITOR'
  assignedLocationId?: string
  permissions: string[]
}
