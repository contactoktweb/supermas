import {
  LocationWithMetrics,
  WarehouseInventoryItem,
  WarehouseMovement,
  WarehouseSaleRecord,
  WarehousePurchaseRecord,
  CustomerLocationRelation,
  SupplierLocationRelation,
  WarehouseTransfer,
  WarehouseUserAssignment,
  WarehouseAuditLog,
} from '../types'

export const INITIAL_LOCATIONS: LocationWithMetrics[] = []
export const MOCK_INVENTORY_ITEMS: WarehouseInventoryItem[] = []
export const MOCK_MOVEMENTS: WarehouseMovement[] = []
export const MOCK_SALES: WarehouseSaleRecord[] = []
export const MOCK_PURCHASES: WarehousePurchaseRecord[] = []
export const MOCK_CUSTOMERS_RELATION: CustomerLocationRelation[] = []
export const MOCK_SUPPLIERS_RELATION: SupplierLocationRelation[] = []
export const MOCK_TRANSFERS: WarehouseTransfer[] = []
export const MOCK_USER_ASSIGNMENTS: WarehouseUserAssignment[] = []
export const MOCK_AUDIT_LOGS: WarehouseAuditLog[] = []
