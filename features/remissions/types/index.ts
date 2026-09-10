/**
 * SUPER MÁS ERP/POS - Tipos e Interfaces del Módulo Remisiones
 *
 * La Remisión representa la entrega física y despacho de mercancía al cliente,
 * separada de la Venta (comercial) y de la Factura (tributario/fiscal).
 */

export type RemissionStatus =
  | 'DRAFT'
  | 'CREATED'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'CANCELLED'

export interface RemissionItem {
  id: string
  productId: string
  productName: string
  sku: string
  barcode?: string
  unitOfMeasure: string
  quantityRequested: number
  quantityDelivered: number
  unitCost?: number
  unitPrice?: number
  notes?: string
}

export interface RemissionTimelineEvent {
  id: string
  status: RemissionStatus
  label: string
  timestamp: string
  user: string
  notes?: string
}

export interface Remission {
  id: string
  remissionNumber: string // e.g. REM-2026-00192
  prefix: string // e.g. REM
  
  // Relación Comercial y Tributaria
  saleId?: string | null
  saleNumber?: string | null
  invoiceId?: string | null
  invoiceNumber?: string | null
  
  // Cliente
  customerId: string
  customerName: string
  customerDoc: string
  customerPhone?: string
  customerAddress?: string
  customerCity?: string
  
  // Bodega Origen
  locationId: string
  locationName: string
  
  // Fechas
  date: string // ISO string
  createdAt: string
  updatedAt: string
  
  // Estado del flujo logístico
  status: RemissionStatus
  
  // Productos y Totales
  items: RemissionItem[]
  itemsCount: number
  totalUnits: number
  
  // Destino & Contacto de Entrega
  deliveryAddress?: string
  deliveryCity?: string
  contactPerson?: string
  contactPhone?: string
  
  // Datos de Despacho / Logística
  carrierName?: string | null
  vehiclePlate?: string | null
  driverName?: string | null
  driverDoc?: string | null
  dispatchedAt?: string | null
  dispatchedBy?: string | null
  
  // Datos de Entrega Final
  deliveredAt?: string | null
  deliveredBy?: string | null
  receivedBy?: string | null
  receivedDoc?: string | null
  deliveryEvidenceNotes?: string | null
  evidenceImageUrl?: string | null
  signatureImageUrl?: string | null
  
  // Anulación
  cancelReason?: string | null
  cancelledAt?: string | null
  cancelledBy?: string | null
  
  notes?: string
  createdBy: string
}

export interface RemissionStats {
  totalRemissions: number
  pendingDispatch: number // DRAFT + CREATED
  inTransit: number // DISPATCHED
  delivered: number // DELIVERED
  cancelled: number // CANCELLED
  deliveredUnits: number
  uniqueCustomers: number
}

export interface RemissionFilters {
  query?: string
  status?: RemissionStatus | 'ALL'
  locationId?: string | 'ALL'
  customerId?: string
  dateFrom?: string
  dateTo?: string
  sellerName?: string
  tab?: string
  page?: number
  pageSize?: number
  sortBy?: 'date' | 'remissionNumber' | 'customerName' | 'status'
  sortDirection?: 'asc' | 'desc'
}

export interface CreateRemissionPayload {
  customerId: string
  customerName?: string
  customerDoc?: string
  customerPhone?: string
  customerAddress?: string
  customerCity?: string
  locationId: string
  locationName?: string
  saleId?: string | null
  saleNumber?: string | null
  deliveryAddress?: string
  deliveryCity?: string
  contactPerson?: string
  contactPhone?: string
  notes?: string
  items: Array<{
    productId: string
    productName?: string
    sku?: string
    barcode?: string
    unitOfMeasure?: string
    quantityRequested: number
    unitCost?: number
    unitPrice?: number
    notes?: string
  }>
  status?: 'DRAFT' | 'CREATED'
}

export interface CreateFromSalePayload {
  saleId: string
  deliveryAddress?: string
  contactPerson?: string
  contactPhone?: string
  notes?: string
}

export interface DispatchRemissionPayload {
  remissionId: string
  carrierName: string
  vehiclePlate?: string
  driverName: string
  driverDoc?: string
  notes?: string
}

export interface DeliverRemissionPayload {
  remissionId: string
  deliveredAt?: string
  deliveredBy?: string
  receivedBy: string
  receivedDoc?: string
  deliveryEvidenceNotes?: string
  signatureNote?: string
}

export interface CancelRemissionPayload {
  remissionId: string
  reason: string
}

export interface RemissionUserContext {
  userId: string
  userName: string
  userRole: string
  permissions: string[]
  allowedLocations?: string[]
}
