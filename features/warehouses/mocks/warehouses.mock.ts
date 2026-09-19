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
export const MOCK_SALES: WarehouseSaleRecord[] = ((db.sales as any[]) || []).map((s) => ({
  id: s.id,
  locationId: s.locationId || 'loc-001',
  saleCode: s.saleCode || s.saleNumber || `VTA-${s.id}`,
  date: s.date || s.createdAt || 'Hoy',
  customerName: s.customerName || 'Cliente General',
  customerDoc: s.customerDoc || 'CC 000.000.000',
  sellerName: s.sellerName || 'Laura Gómez',
  itemsCount: s.itemsCount || (s.items ? s.items.length : 1),
  totalAmount: Number(s.totalAmount || s.total || 0),
  costAmount: Number(s.costAmount || s.totalCost || 0),
  profitAmount: Number(s.profitAmount ?? s.totalProfit ?? Math.round((s.totalAmount || s.total || 0) * 0.25)),
  paymentMethod: s.paymentMethod || 'EFECTIVO',
  status: s.status === 'INVOICED' ? 'EMITIDA' : s.status || 'EMITIDA',
}))

export const MOCK_PURCHASES: WarehousePurchaseRecord[] = ((db.purchases as any[]) || []).map((p) => ({
  id: p.id,
  locationId: p.locationId || 'loc-001',
  invoiceNumber: p.invoiceNumber || p.purchaseNumber || p.supplierInvoiceNumber || `COM-${p.id}`,
  supplierName: p.supplierName || 'Proveedor General',
  supplierNit: p.supplierNit || 'NIT 900.000.000-1',
  date: p.date || p.createdAt || 'Hoy',
  itemsCount: p.itemsCount || (p.items ? p.items.length : 1),
  totalCost: Number(p.totalCost || p.total || 0),
  paymentTerms: p.paymentTerms || (p.paymentType === 'CREDITO' ? 'CREDITO' : 'CONTADO'),
  status: p.status === 'PAYMENT_PENDING' ? 'PENDIENTE' : p.status || 'PAGADA',
}))
export const MOCK_CUSTOMERS_RELATION: CustomerLocationRelation[] = ((db.customers as any[]) || []).map((c) => ({
  id: c.id,
  customerId: c.id,
  customerName: c.customerName || c.displayName || c.businessName || 'Cliente Super Más',
  documentType: c.documentType || 'NIT',
  documentNumber: c.documentNumber || '000000000',
  phone: c.phone || c.mobile || '',
  email: c.email || '',
  locationId: c.locationId || c.preferredLocationId || 'loc-001',
  purchasesCount: Number(c.purchasesCount || 1),
  totalPurchased: Number(c.totalPurchased || 0),
  lastPurchaseDate: c.lastPurchaseDate || 'Reciente',
  currentBalance: Number(c.currentBalance || 0),
  status: (c.status === 'ACTIVE' || c.status === 'INACTIVE' || c.status === 'CREDIT_HOLD') ? c.status : 'ACTIVE',
}))

export const MOCK_SUPPLIERS_RELATION: SupplierLocationRelation[] = ((db.suppliers as any[]) || []).map((s) => ({
  id: s.id,
  supplierId: s.id,
  supplierName: s.supplierName || s.businessName || s.commercialName || 'Proveedor Super Más',
  nit: s.nit || s.documentNumber || '900.000.000-1',
  contactName: s.contactName || 'Contacto Comercial',
  phone: s.phone || '',
  email: s.email || '',
  locationId: s.locationId || 'loc-001',
  deliveriesCount: Number(s.deliveriesCount || 10),
  totalPurchased: Number(s.totalPurchased || 0),
  lastDeliveryDate: s.lastDeliveryDate || s.lastPurchaseDate || 'Reciente',
  pendingInvoicesCount: Number(s.pendingInvoicesCount || 0),
  currentBalance: Number(s.currentBalance || 0),
  status: (s.status === 'ACTIVE' || s.status === 'IN_REVIEW' || s.status === 'INACTIVE') ? s.status : 'ACTIVE',
}))
export const MOCK_TRANSFERS: WarehouseTransfer[] = db.transfers as unknown as WarehouseTransfer[]
export const MOCK_USER_ASSIGNMENTS: WarehouseUserAssignment[] = db.userAssignments as unknown as WarehouseUserAssignment[]
export const MOCK_AUDIT_LOGS: WarehouseAuditLog[] = db.auditLogs as unknown as WarehouseAuditLog[]
