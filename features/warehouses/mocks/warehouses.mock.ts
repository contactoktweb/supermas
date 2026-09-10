import { db } from '@/lib/supabase'
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

export const INITIAL_LOCATIONS: LocationWithMetrics[] = db.locations as unknown as LocationWithMetrics[]
export const MOCK_INVENTORY_ITEMS: WarehouseInventoryItem[] = db.warehouseInventory as unknown as WarehouseInventoryItem[]
export const MOCK_MOVEMENTS: WarehouseMovement[] = db.warehouseMovements as unknown as WarehouseMovement[]
export const MOCK_SALES: WarehouseSaleRecord[] = db.sales as unknown as WarehouseSaleRecord[]
export const MOCK_PURCHASES: WarehousePurchaseRecord[] = db.purchases as unknown as WarehousePurchaseRecord[]
export const MOCK_CUSTOMERS_RELATION: CustomerLocationRelation[] = db.customers as unknown as CustomerLocationRelation[]
export const MOCK_SUPPLIERS_RELATION: SupplierLocationRelation[] = db.suppliers as unknown as SupplierLocationRelation[]
export const MOCK_TRANSFERS: WarehouseTransfer[] = db.transfers as unknown as WarehouseTransfer[]
export const MOCK_USER_ASSIGNMENTS: WarehouseUserAssignment[] = db.userAssignments as unknown as WarehouseUserAssignment[]
export const MOCK_AUDIT_LOGS: WarehouseAuditLog[] = db.auditLogs as unknown as WarehouseAuditLog[]
