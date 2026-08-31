export type MovementType =
  | 'COMPRA'
  | 'VENTA'
  | 'TRANSFERENCIA_ENTRADA'
  | 'TRANSFERENCIA_SALIDA'
  | 'AJUSTE_ENTRADA'
  | 'AJUSTE_SALIDA'
  | 'DEVOLUCION'
  | 'REMISION'
  | 'REVERSION'

export type SourceDocumentType =
  | 'PURCHASE_INVOICE'
  | 'POS_SALE'
  | 'ELECTRONIC_INVOICE'
  | 'WAREHOUSE_TRANSFER'
  | 'STOCK_ADJUSTMENT'
  | 'CUSTOMER_RETURN'
  | 'REMISSION_ORDER'
  | 'REVERSION_ENTRY'

export interface InventoryMovement {
  id: string
  movementNumber: string
  createdAt: string // ISO string
  productId: string
  productName: string
  sku: string
  barcode?: string
  category: string
  unitOfMeasure: string
  imageUrl?: string
  locationId: string
  locationName: string
  locationCode: string
  type: MovementType
  quantityIn: number
  quantityOut: number
  quantityDelta: number
  previousStock: number
  resultingStock: number
  unitCost: number // Redacted if no cost.read
  averageCostAfter: number // Redacted if no cost.read
  totalValue: number // Redacted if no cost.read
  sourceDocumentType: SourceDocumentType
  sourceDocumentId: string
  sourceDocumentNumber: string
  userId: string
  userName: string
  userRole: string
  notes?: string
  destinationLocationName?: string
  originLocationName?: string
  isReversion?: boolean
  originalMovementId?: string
  evidenceUrl?: string
}

export type KardexSortField =
  | 'createdAt'
  | 'productName'
  | 'sku'
  | 'locationName'
  | 'type'
  | 'quantityIn'
  | 'quantityOut'
  | 'resultingStock'
  | 'totalValue'

export interface KardexFilterParams {
  query?: string
  productId?: string
  sku?: string
  locationId?: string
  movementType?: MovementType | 'ALL'
  userId?: string | 'ALL'
  documentQuery?: string
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
  sortField?: KardexSortField
  sortDirection?: 'asc' | 'desc'
}

export interface GlobalKardexStats {
  totalMovements: number
  totalEntriesCount: number
  totalExitsCount: number
  totalUnitsIn: number
  totalUnitsOut: number
  totalValueInAtCost: number
  totalValueOutAtCost: number
  distinctProductsCount: number
  isCostRedacted: boolean
}

export interface KardexPaginationResult {
  items: InventoryMovement[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  isCostRedacted: boolean
}

export interface KardexColumnVisibility {
  createdAt: boolean
  product: boolean
  sku: boolean
  location: boolean
  movementType: boolean
  document: boolean
  quantityIn: boolean
  quantityOut: boolean
  previousStock: boolean
  resultingStock: boolean
  unitCost: boolean
  averageCost: boolean
  totalValue: boolean
  user: boolean
  actions: boolean
}

export interface UserPermissionContext {
  userId: string
  userRole: 'ADMIN' | 'SELLER' | 'WAREHOUSE_MANAGER' | 'AUDITOR'
  assignedLocationId?: string
  permissions: string[]
}

export interface ProductKardexSummary {
  productId: string
  productName: string
  sku: string
  category: string
  imageUrl?: string
  totalStockAllWarehouses: number
  unitOfMeasure: string
  warehousesDistribution: {
    locationId: string
    locationName: string
    locationCode: string
    stock: number
  }[]
  lastMovementAt: string
  lastMovementType: MovementType
}
