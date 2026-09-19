/**
 * SUPER MÁS ERP/POS - Tipos del Módulo Pedidos Web
 *
 * Define las interfaces, estados y modelos de datos para la administración
 * de pedidos provenientes del ecommerce (Catálogo Super Más y Catálogo Distribuidora),
 * trazabilidad, checklists, reservas e integración con ventas y facturación.
 */

export type WebOrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY_TO_DISPATCH'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'

export type WebOrderChannel = 'CATALOGO_SUPERMAS' | 'CATALOGO_DISTRIBUIDORA'

export type WebPaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'

export type StockAvailabilityLevel = 'AVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK'

export interface WebOrderItem {
  id: string
  productId: string
  productName: string
  sku: string
  barcode: string
  unitOfMeasure: string
  imageUrl?: string
  quantity: number
  unitPrice: number
  discountPercent: number
  discountAmount: number
  taxRatePercent: number
  taxAmount: number
  subtotal: number
  total: number
}

export interface WebOrderChecklist {
  itemsReviewed: boolean
  quantitiesVerified: boolean
  customerConfirmed: boolean
  addressConfirmed: boolean
  paymentVerified: boolean
  completedAt?: string
  completedBy?: string
}

export interface WebOrderTimelineEvent {
  status: WebOrderStatus
  timestamp: string
  actor: string
  notes: string
}

export interface WebOrder {
  id: string
  orderNumber: string
  createdAt: string
  channel: WebOrderChannel
  status: WebOrderStatus
  customerId: string
  customerName: string
  customerDoc?: string
  customerEmail: string
  customerPhone: string
  shippingAddress: string
  city: string
  department?: string
  deliveryNotes?: string
  assignedLocationId: string
  assignedLocationName: string
  assignedLocationCode: string
  itemsCount: number
  totalUnits: number
  subtotal: number
  discountTotal: number
  taxTotal: number
  shippingCost: number
  totalAmount: number
  paymentMethod: string
  paymentStatus: WebPaymentStatus
  paymentReference?: string
  paidAt?: string
  saleId?: string
  saleNumber?: string
  invoiceId?: string
  invoiceNumber?: string
  dianStatus?: string
  trackingNumber?: string
  courier?: string
  assignedUserId?: string
  assignedUserName?: string
  cancellationReason?: string
  cancelledAt?: string
  cancelledBy?: string
  items: WebOrderItem[]
  checklist?: WebOrderChecklist
  timeline: WebOrderTimelineEvent[]
}

export interface WebOrderStats {
  pendingCount: number
  confirmedCount: number
  preparingCount: number
  readyToDispatchCount: number
  shippedCount: number
  deliveredCount: number
  cancelledCount: number
  totalOrdersCount: number
  totalWebSalesAmount: number
  averageTicket: number
}

export interface WebOrderFilters {
  search?: string
  orderNumber?: string
  customer?: string
  dateFrom?: string
  dateTo?: string
  status?: WebOrderStatus | 'ALL'
  channel?: WebOrderChannel | 'ALL'
  paymentMethod?: string | 'ALL'
  locationId?: string | 'ALL'
  invoiceStatus?: 'ALL' | 'INVOICED' | 'PENDING'
  sortBy?: 'date' | 'total' | 'orderNumber' | 'status'
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface WebOrderPaginatedResult {
  orders: WebOrder[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type WebOrderPermission =
  | 'web_orders.read'
  | 'web_orders.confirm'
  | 'web_orders.prepare'
  | 'web_orders.dispatch'
  | 'web_orders.cancel'
  | 'web_orders.invoice'
  | 'web_orders.export'

export interface InventoryCheckResult {
  productId: string
  sku: string
  productName: string
  requestedQuantity: number
  availability: StockAvailabilityLevel
  canFulfill: boolean
  isEcommerceWarehouseAvailable: boolean
  notes?: string
}
