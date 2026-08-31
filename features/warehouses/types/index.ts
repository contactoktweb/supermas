export type LocationType = 'WAREHOUSE' | 'STORE_POINT' | 'DISTRIBUTION_CENTER'

export type LocationStatus = 'ACTIVE' | 'INACTIVE'

export type InventoryHealthStatus = 'NORMAL' | 'LOW_STOCK' | 'CRITICAL' | 'OUT_OF_STOCK'

export interface LocationSettings {
  allowInventoryOperations: boolean
  allowSales: boolean
  allowPurchases: boolean
  allowTransfers: boolean
  isStorePoint: boolean
  isEcommerceProcessingSource: boolean
  lowStockAlertThresholdPercent: number
  autoBlockOnZeroStock: boolean
  notes?: string
}

export interface Location {
  id: string
  code: string
  name: string
  type: LocationType
  status: LocationStatus
  address: string
  city: string
  department?: string
  phone?: string
  email?: string
  managerName?: string
  managerEmail?: string
  managerPhone?: string
  description?: string
  settings: LocationSettings
  createdAt: string
  updatedAt: string
}

export interface LocationWithMetrics extends Location {
  inventoryValueAtCost: number // SUM(quantity * averageCost)
  productsCount: number
  availableUnits: number
  todaySalesAmount: number
  monthSalesAmount: number
  monthPurchasesAmount: number
  estimatedProfit: number
  profitMarginPercent: number
  lowStockProductsCount: number
  outOfStockProductsCount: number
  pendingTransfersCount: number
  activeAlertsCount: number
  assignedUsersCount: number
  openCashRegistersCount: number
  lastActivityAt: string
}

export interface GlobalWarehousesStats {
  totalWarehouses: number
  activeWarehouses: number
  inactiveWarehouses: number
  totalInventoryValueAtCost: number
  totalTodaySales: number
  totalLowStockProducts: number
  totalPendingTransfers: number
  totalActiveAlerts: number
}

export type WarehouseSortOption =
  | 'NAME_ASC'
  | 'NAME_DESC'
  | 'INVENTORY_DESC'
  | 'INVENTORY_ASC'
  | 'SALES_DESC'
  | 'ALERTS_DESC'

export interface WarehouseFilters {
  query?: string
  type?: 'ALL' | LocationType
  status?: 'ALL' | LocationStatus
  inventoryHealth?: 'ALL' | InventoryHealthStatus
  sortBy?: WarehouseSortOption
  page?: number
  pageSize?: number
}

export interface WarehouseInventoryItem {
  id: string
  productId: string
  locationId: string
  productName: string
  sku: string
  barcode: string
  category: string
  brand: string
  unit: string
  currentStock: number
  minStock: number
  maxStock: number
  averageCost: number
  totalValueAtCost: number
  normalSalePrice: number
  wholesalePrice?: number
  status: InventoryHealthStatus
  lastMovementAt: string
  updatedAt: string
}

export type MovementType =
  | 'COMPRA'
  | 'VENTA'
  | 'ENTRADA'
  | 'SALIDA'
  | 'TRANSFERENCIA_ENTRADA'
  | 'TRANSFERENCIA_SALIDA'
  | 'AJUSTE_POSITIVO'
  | 'AJUSTE_NEGATIVO'
  | 'DEVOLUCION'

export interface WarehouseMovement {
  id: string
  locationId: string
  locationName: string
  productId: string
  productName: string
  sku: string
  type: MovementType
  documentRef: string
  quantityIn: number
  quantityOut: number
  previousBalance: number
  newBalance: number
  unitCost: number
  totalCost: number
  userId: string
  userName: string
  notes?: string
  createdAt: string
}

export interface WarehouseSaleRecord {
  id: string
  locationId: string
  saleCode: string
  date: string
  customerName: string
  customerDoc: string
  sellerName: string
  itemsCount: number
  totalAmount: number
  costAmount: number
  profitAmount: number
  paymentMethod: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'CREDITO' | 'MIXTO'
  status: 'EMITIDA' | 'PENDIENTE' | 'ANULADA'
}

export interface WarehousePurchaseRecord {
  id: string
  locationId: string
  invoiceNumber: string
  supplierName: string
  supplierNit: string
  date: string
  itemsCount: number
  totalCost: number
  paymentTerms: 'CONTADO' | 'CREDITO'
  status: 'PAGADA' | 'PENDIENTE' | 'POR_VENCER' | 'VENCIDA'
}

export interface CustomerLocationRelation {
  id: string
  customerId: string
  customerName: string
  documentType: string
  documentNumber: string
  phone: string
  email: string
  locationId: string
  purchasesCount: number
  totalPurchased: number
  lastPurchaseDate: string
  currentBalance: number
  status: 'ACTIVE' | 'INACTIVE' | 'CREDIT_HOLD'
}

export interface SupplierLocationRelation {
  id: string
  supplierId: string
  supplierName: string
  nit: string
  contactName: string
  phone: string
  email: string
  locationId: string
  deliveriesCount: number
  totalPurchased: number
  lastDeliveryDate: string
  pendingInvoicesCount: number
  currentBalance: number
  status: 'ACTIVE' | 'IN_REVIEW' | 'INACTIVE'
}

export type TransferStatus = 'PENDIENTE' | 'EN_TRANSITO' | 'RECIBIDA' | 'RECHAZADA' | 'CANCELADA'

export interface WarehouseTransferItem {
  productId: string
  productName: string
  sku: string
  units: number
  unitCost: number
}

export interface WarehouseTransfer {
  id: string
  code: string
  originLocationId: string
  originLocationName: string
  destinationLocationId: string
  destinationLocationName: string
  status: TransferStatus
  itemsCount: number
  totalUnits: number
  totalValueAtCost: number
  items: WarehouseTransferItem[]
  requestedBy: string
  dispatchedBy?: string
  receivedBy?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface WarehouseUserAssignment {
  id: string
  userId: string
  userName: string
  userEmail: string
  userRole: 'SUPERADMIN' | 'STORE_ADMIN' | 'POINT_ADMIN' | 'SELLER' | 'INVENTORY_CLERK'
  locationId: string
  locationName: string
  isPrimaryLocation: boolean
  assignedAt: string
  lastAccessAt: string
  status: 'ACTIVE' | 'INACTIVE'
}

export type PeriodFilter = 'TODAY' | '7_DAYS' | '30_DAYS' | 'MONTH' | 'YEAR' | 'CUSTOM'

export interface WarehouseDeactivationCheck {
  canDeactivate: boolean
  pendingTransfersCount: number
  openCashRegistersCount: number
  activeOrdersCount: number
  blockingReasons: string[]
}

export interface WarehouseAuditLog {
  id: string
  action:
    | 'LOCATION_CREATED'
    | 'LOCATION_UPDATED'
    | 'LOCATION_DEACTIVATED'
    | 'USER_ASSIGNED'
    | 'USER_UNASSIGNED'
    | 'ECOMMERCE_SOURCE_CHANGED'
    | 'STOCK_ADJUSTED'
    | 'TRANSFER_CREATED'
  locationId: string
  locationName: string
  userId: string
  userName: string
  timestamp: string
  changes: {
    field?: string
    previousValue?: any
    newValue?: any
    details?: string
  }
}
