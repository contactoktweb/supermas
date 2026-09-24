/**
 * SUPER MÁS ERP/POS - Tipos e Interfaces del Módulo Facturación
 *
 * Separa claramente la Venta (Operación comercial) de la Factura (Documento tributario fiscal).
 */

export type InvoiceType =
  | 'ELECTRONICA'
  | 'POS'
  | 'NOTA_CREDITO'
  | 'NOTA_DEBITO'
  | 'DOCUMENTO_EQUIVALENTE'

export type InvoiceStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'PAYMENT_PENDING'
  | 'CANCELLED'

export type DIANStatus =
  | 'PENDIENTE'
  | 'ACEPTADA'
  | 'RECHAZADA'
  | 'VALIDADA_DIAN'
  | 'NO_APLICA'

export type InvoicePaymentMethod =
  | 'EFECTIVO'
  | 'TARJETA'
  | 'TRANSFERENCIA'
  | 'CREDITO'
  | 'MIXTO'

export interface InvoiceTaxSummary {
  taxCode: string
  taxName: string
  ratePercent: number
  taxableBase: number
  taxAmount: number
}

export interface InvoiceItem {
  id: string
  productId: string
  productName: string
  sku: string
  barcode?: string
  unitOfMeasure: string
  quantity: number
  unitPrice: number
  unitCost?: number
  discountPercent: number
  discountAmount: number
  taxCode: string // e.g. IVA_19, IVA_5, EXENTO
  taxRatePercent: number
  taxAmount: number
  subtotal: number
  total: number
  notes?: string
}

export interface DIANTransmissionLog {
  id: string
  timestamp: string
  user: string
  action: 'ENVIO_INICIAL' | 'REINTENTO' | 'CONSULTA_ESTADO' | 'CANCELACION'
  status: 'EXITOSO' | 'RECHAZADO' | 'ERROR_TECNICO'
  dianStatus: DIANStatus
  statusCode?: string
  message: string
  cufe?: string
  trackId?: string
  responseTimeMs?: number
}

export interface DianResolutionConfig {
  id: string
  companyId?: string
  dianPrefix: string // ej: 'FE', 'POS', 'NC'
  resolutionNumber: string // ej: '18764000001'
  resolutionDate: string // ej: '2026-01-15'
  validFrom: string
  validTo: string
  initialRange: number
  finalRange: number
  currentNumber: number
  documentType: InvoiceType
  locationId?: string
  locationName?: string
  technicalKey?: string
  isActive: boolean
  createdById?: string
  updatedById?: string
  createdAt?: string
  updatedAt?: string
}

export interface Invoice {
  id: string
  
  // Numeración Interna ERP (Consecutivo administrativo del sistema)
  internalNumber: string // e.g. FAC-00025, VENTA-000001
  
  // Autorización y Numeración Oficial Fiscal DIAN
  dianPrefix: string // e.g. FE, POS, NC
  dianNumber: number // e.g. 1250
  dianResolution: string // e.g. 18764000001
  dianResolutionDate?: string // e.g. 2026-01-15
  dianRange?: string // e.g. 1000 - 50000
  
  // Identificador compuesto (FE-1250)
  invoiceNumber: string
  prefix: string // Retrocompatibilidad
  resolutionNumber?: string // Retrocompatibilidad
  resolutionDate?: string
  type: InvoiceType
  status: InvoiceStatus
  dianStatus: DIANStatus
  dianCufe?: string
  dianQrCode?: string
  dianXmlUrl?: string
  dianPdfUrl?: string
  
  // Relations
  saleId?: string
  saleNumber?: string
  originalInvoiceId?: string // For Credit / Debit notes
  originalInvoiceNumber?: string
  
  customerId: string
  customerName: string
  customerDoc: string
  customerDocType?: string
  customerEmail?: string
  customerPhone?: string
  customerAddress?: string
  customerCity?: string
  
  locationId: string
  locationName: string
  
  sellerId?: string
  sellerName?: string
  
  date: string
  dueDate?: string
  issuedAtBogota?: string
  
  items: InvoiceItem[]
  itemsCount: number
  totalUnits: number
  
  // Financial & Tax Breakdown
  subtotal: number
  discountTotal: number
  taxTotal: number
  taxesBreakdown: InvoiceTaxSummary[]
  total: number
  pendingBalance: number
  
  paymentMethod: InvoicePaymentMethod
  paymentTerms?: string // Contado, Crédito 30 días, etc.
  notes?: string
  cancelReason?: string
  cancelledAt?: string
  cancelledBy?: string
  
  transmissionHistory: DIANTransmissionLog[]
  createdAt: string
  updatedAt: string
}

export interface InvoiceStats {
  totalGenerated: number
  electronicSent: number
  pendingDIAN: number
  rejectedDIAN: number
  cancelledCount: number
  totalAmountBilled: number
  creditNotesCount: number
  creditNotesTotal: number
  currency: string
}

export interface InvoiceFilters {
  query?: string
  type?: InvoiceType | 'ALL'
  status?: InvoiceStatus | 'ALL'
  dianStatus?: DIANStatus | 'ALL'
  locationId?: string | 'ALL'
  dateFrom?: string
  dateTo?: string
  customerId?: string
  sellerName?: string
  page?: number
  pageSize?: number
  tab?: string
}

export interface GenerateInvoicePayload {
  saleId: string
  type: InvoiceType
  prefix?: string
  resolutionNumber?: string
  paymentMethod?: InvoicePaymentMethod
  paymentTerms?: string
  notes?: string
  dueDate?: string
  sendToDianImmediately?: boolean
}

export interface CreditNotePayload {
  invoiceId: string
  reason:
    | 'DEVOLUCION_TOTAL'
    | 'DEVOLUCION_PARCIAL'
    | 'AJUSTE_PRECIO'
    | 'DESCUENTO_POSTERIOR'
    | 'ERROR_FACTURACION'
  notes: string
  items: Array<{
    productId: string
    quantity: number
    unitPrice: number
    taxRatePercent: number
  }>
  adjustInventory: boolean
  sendToDianImmediately?: boolean
}

export interface CancelInvoicePayload {
  invoiceId: string
  reason: string
}

export interface InvoiceUserContext {
  userId: string
  userName: string
  userRole: string
  permissions: string[]
}
