/**
 * SUPER MÁS ERP/POS - Tipos e Interfaces del Módulo Ventas
 */

export type SaleStatus = 'PENDING' | 'CONFIRMED' | 'INVOICED' | 'CANCELLED' | 'RETURNED'

export type PaymentMethod = 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'CREDITO' | 'MIXTO'

export type PaymentStatus = 'PAID' | 'PENDING' | 'PARTIALLY_PAID'

export type SaleDocumentType = 'FACTURA_ELECTRONICA' | 'FACTURA_POS' | 'REMISION' | 'NINGUNO'

export interface SaleItem {
  id: string
  productId: string
  productName: string
  sku: string
  barcode: string
  unitOfMeasure: string
  imageUrl: string
  quantity: number
  unitPrice: number
  unitCost: number
  discountPercent: number
  discountAmount: number
  taxRatePercent: number
  taxAmount: number
  subtotal: number
  total: number
  notes?: string
}

export interface Sale {
  id: string
  saleNumber: string
  customerId: string
  customerName: string
  customerDoc: string
  customerType: 'NATURAL' | 'COMPANY'
  customerCategory: string
  priceList: 'DEFAULT' | 'WHOLESALE' | 'VIP'
  locationId: string
  locationName: string
  sellerId: string
  sellerName: string
  date: string
  items: SaleItem[]
  itemsCount: number
  totalUnits: number
  subtotal: number
  discountTotal: number
  taxTotal: number
  totalAmount: number
  totalCost: number
  totalProfit: number
  profitMarginPercent: number
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  status: SaleStatus
  documentType: SaleDocumentType
  invoiceId?: string
  invoiceNumber?: string
  remissionId?: string
  remissionNumber?: string
  cancellationReason?: string
  cancelledAt?: string
  cancelledBy?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface SaleStats {
  periodTotalSales: number
  periodSalesCount: number
  averageTicket: number
  totalUnitsSold: number
  uniqueCustomersServed: number
  pendingToInvoiceCount: number
  cancelledSalesCount: number
}

export interface SaleFilterParams {
  query?: string
  customerId?: string
  locationId?: string
  sellerName?: string
  status?: SaleStatus | 'ALL'
  paymentMethod?: PaymentMethod | 'ALL'
  documentType?: SaleDocumentType | 'ALL'
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
  sortBy?: 'saleNumber' | 'date' | 'totalAmount' | 'customerName' | 'status'
  sortDirection?: 'asc' | 'desc'
}

export interface CreateSaleItemDTO {
  productId: string
  quantity: number
  unitPrice?: number
  discountPercent?: number
  taxRatePercent?: number
  notes?: string
}

export interface CreateSaleDTO {
  customerId: string
  locationId: string
  items: CreateSaleItemDTO[]
  paymentMethod: PaymentMethod
  documentTypeToGenerate?: 'FACTURA_POS' | 'FACTURA_ELECTRONICA' | 'REMISION' | 'NINGUNO'
  notes?: string
  discountReason?: string
}

export interface CancelSaleDTO {
  saleId: string
  reason: string
}

export interface CreateInvoiceFromSaleDTO {
  saleId: string
  type: 'FACTURA_ELECTRONICA' | 'FACTURA_POS'
  paymentMethod?: PaymentMethod
}

export interface CreateRemissionFromSaleDTO {
  saleId: string
  deliveredBy?: string
  driverName?: string
  receivedBy?: string
  notes?: string
}

export interface SaleReturnItemDTO {
  productId: string
  quantity: number
  reason: string
}

export interface SaleReturnDTO {
  saleId: string
  items: SaleReturnItemDTO[]
  reason: string
}

export interface SaleDetail extends Sale {
  customer?: {
    id: string
    displayName: string
    documentNumber: string
    documentType: string
    phone: string
    email: string
    address: string
    city: string
    creditLimit: number
    currentBalance: number
  }
  invoice?: {
    id: string
    invoiceNumber: string
    date: string
    dianStatus: string
    dianCufe?: string
    total: number
    status: string
  }
  remission?: {
    id: string
    remissionNumber: string
    date: string
    status: string
    driverName?: string
    deliveredBy?: string
  }
  inventoryMovements: Array<{
    id: string
    movementNumber: string
    type: string
    productId: string
    productName: string
    sku: string
    quantityOut: number
    quantityIn: number
    createdAt: string
    notes?: string
  }>
  auditLogs: Array<{
    id: string
    timestamp: string
    user: string
    action: string
    details: string
    oldValues?: Record<string, unknown>
    newValues?: Record<string, unknown>
  }>
}

export interface SalesUserContext {
  userId: string
  userName: string
  userRole?: string
  maxAllowedDiscountPercent: number
  permissions: string[]
}
