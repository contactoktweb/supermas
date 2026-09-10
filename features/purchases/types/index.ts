/**
 * SUPER MÁS ERP/POS - Tipos del Módulo de Compras (Purchases)
 */

export type PurchaseStatus =
  | 'DRAFT'              // Borrador de compra no emitido
  | 'PENDING_RECEPTION' // Emitida, pendiente de recibir mercancía
  | 'RECEIVED'          // Mercancía recibida físicamente en bodega
  | 'PAYMENT_PENDING'   // Recibida con saldo pendiente de pago (Crédito)
  | 'PAID'              // Pagada totalmente
  | 'CANCELLED'         // Anulada antes de recibir

export type PurchasePaymentType = 'CONTADO' | 'CREDITO'

export type PaymentMethod =
  | 'TRANSFERENCIA'
  | 'EFECTIVO'
  | 'CONSIGNACION'
  | 'CHEQUE'
  | 'OTRO'

export interface PurchaseItem {
  id: string
  productId: string
  productName: string
  sku: string
  barcode?: string
  unitOfMeasure: string
  imageUrl?: string
  quantity: number
  receivedQuantity: number
  unitCost: number
  discountPercent: number
  discountAmount: number
  taxRatePercent: number
  taxCode: string
  taxAmount: number
  subtotal: number
  total: number
}

export interface PurchasePayment {
  id: string
  purchaseId: string
  date: string
  amount: number
  paymentMethod: PaymentMethod
  reference: string
  notes?: string
  registeredByUserId: string
  registeredByUserName: string
  createdAt: string
}

export interface PurchaseAttachment {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  url: string
  uploadedAt: string
  uploadedBy: string
}

export interface PurchaseReceptionInfo {
  receivedAt: string
  receivedByUserId: string
  receivedByUserName: string
  notes?: string
}

export interface PurchaseCancellationInfo {
  cancelledAt: string
  cancelledByUserId: string
  cancelledByUserName: string
  reason: string
}

export interface Purchase {
  id: string
  purchaseNumber: string             // e.g. "COM-0002184"
  supplierInvoiceNumber: string      // e.g. "FAC-89214"
  // Compatibilidad con WarehousePurchaseRecord:
  invoiceNumber?: string             // Alias de purchaseNumber / supplierInvoiceNumber
  locationId?: string                // Alias de destinationLocationId
  totalCost?: number                 // Alias de total
  paymentTerms?: 'CONTADO' | 'CREDITO'
  itemsCount?: number

  date: string                       // Fecha de compra / emisión
  supplierId: string
  supplierName: string
  supplierNit: string
  supplierPhone?: string
  supplierEmail?: string

  destinationLocationId: string
  destinationLocationName: string
  destinationLocationCode: string

  paymentType: PurchasePaymentType
  dueDate?: string                   // Fecha límite de pago si es a crédito
  status: PurchaseStatus

  subtotal: number                   // Suma antes de descuentos e impuestos
  discountTotal: number              // Descuento total aplicado
  taxTotal: number                   // Impuestos totales liquidados
  total: number                      // Valor final a pagar

  paidAmount: number                 // Valor pagado acumulado
  pendingBalance: number             // Saldo pendiente de pago

  items: PurchaseItem[]
  payments: PurchasePayment[]
  attachments: PurchaseAttachment[]

  receptionInfo?: PurchaseReceptionInfo
  cancellationInfo?: PurchaseCancellationInfo

  createdByUserId: string
  createdByUserName: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface PurchaseFilterParams {
  query?: string
  supplierId?: string
  locationId?: string
  status?: PurchaseStatus | 'ALL'
  paymentType?: PurchasePaymentType | 'ALL'
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
  sortField?: 'date' | 'total' | 'purchaseNumber' | 'pendingBalance' | 'createdAt'
  sortDirection?: 'asc' | 'desc'
}

export interface PaginatedPurchasesResponse {
  items: Purchase[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  isCostRedacted: boolean
}

export interface PurchaseStats {
  totalPurchasedPeriod: number
  pendingReceptionCount: number
  creditPurchasesCount: number
  cashPurchasesCount: number
  pendingPaymentInvoicesCount: number
  overdueInvoicesCount: number
  receivedProductsUnits: number
  totalPendingBalance: number
  isCostRedacted: boolean
}

export interface CreatePurchaseItemInput {
  productId: string
  productName: string
  sku: string
  barcode?: string
  unitOfMeasure: string
  imageUrl?: string
  quantity: number
  unitCost: number
  discountPercent?: number
  taxCode?: string
  taxRatePercent?: number
}

export interface CreatePurchaseInput {
  supplierId: string
  supplierInvoiceNumber: string
  destinationLocationId: string
  date: string
  paymentType: PurchasePaymentType
  dueDate?: string
  notes?: string
  items: CreatePurchaseItemInput[]
  saveAsDraft?: boolean
  attachment?: {
    fileName: string
    fileType: string
    fileSize: number
    url: string
  }
}

export interface RegisterPaymentInput {
  purchaseId: string
  amount: number
  paymentMethod: PaymentMethod
  reference: string
  notes?: string
}

export interface ReceivePurchaseInput {
  purchaseId: string
  notes?: string
  receivedItems?: {
    itemId: string
    quantityReceived: number
  }[]
}

export interface CancelPurchaseInput {
  purchaseId: string
  reason: string
}

export interface SupplierOption {
  id: string
  name: string
  nit: string
  phone?: string
  email?: string
  currentBalance: number
}

export interface UserPermissionContext {
  userId: string
  userName: string
  userRole: string
  permissions: string[]
  locationId?: string
}
