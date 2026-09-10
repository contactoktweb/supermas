/**
 * SUPER MÁS ERP/POS - Tipos del Módulo de Proveedores (Suppliers)
 */

export type DocumentType = 'NIT' | 'CC' | 'CE' | 'RUT' | 'PASAPORTE'
export type SupplierStatus = 'ACTIVE' | 'INACTIVE'

export interface Supplier {
  id: string
  supplierId?: string                     // Alias retrocompatible
  documentType: DocumentType
  documentNumber: string
  nit: string                             // Alias estándar tributario
  businessName: string                    // Razón Social
  commercialName?: string                 // Nombre Comercial
  supplierName?: string                   // Alias retrocompatible
  contactName: string                     // Contacto principal
  phone: string
  email: string
  address: string
  city: string
  department: string
  country: string
  locationId?: string                     // Bodega sede preferente
  status: SupplierStatus
  creditDays: number
  creditLimit: number
  notes?: string

  // Métricas agregadas y retrocompatibilidad
  deliveriesCount: number
  totalPurchased: number
  currentBalance: number                  // Saldo pendiente por pagar
  pendingInvoicesCount: number
  lastDeliveryDate?: string
  lastPurchaseDate?: string
  createdAt: string
  updatedAt: string
}

export interface SupplierStats {
  totalSuppliers: number
  activeSuppliers: number
  suppliersWithRecentPurchases: number
  totalPendingBalance: number
  pendingInvoicesCount: number
  overdueInvoicesCount: number
  totalPurchasedPeriod: number
  suppliedProductsCount: number
  isCostRedacted: boolean
}

export interface SupplierFilterParams {
  query?: string
  documentNumber?: string
  status?: SupplierStatus | 'ALL'
  locationId?: string
  hasPendingBalance?: boolean
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
  sortField?:
    | 'businessName'
    | 'documentNumber'
    | 'totalPurchased'
    | 'currentBalance'
    | 'lastPurchaseDate'
    | 'createdAt'
  sortDirection?: 'asc' | 'desc'
}

export interface PaginatedSuppliersResponse {
  items: Supplier[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  isCostRedacted: boolean
}

export interface CreateSupplierInput {
  documentType: DocumentType
  documentNumber: string
  businessName: string
  commercialName?: string
  contactName: string
  phone: string
  email: string
  address: string
  city: string
  department: string
  country?: string
  status?: SupplierStatus
  creditDays?: number
  creditLimit?: number
  notes?: string
}

export interface UpdateSupplierInput extends Partial<CreateSupplierInput> {
  id: string
}

export interface SupplierProductSummary {
  productId: string
  productName: string
  sku: string
  category: string
  unitOfMeasure: string
  imageUrl?: string
  lastUnitCost: number
  lastPurchaseDoc: string
  lastPurchaseDate: string
  totalUnitsSupplied: number
  totalValueSupplied: number
}

export interface SupplierInvoiceSummary {
  purchaseId: string
  purchaseNumber: string
  invoiceNumber: string
  date: string
  dueDate?: string
  total: number
  paidAmount: number
  pendingBalance: number
  status: 'PENDIENTE' | 'PAGADA' | 'VENCIDA'
  hasAttachment: boolean
  attachmentUrl?: string
  attachmentName?: string
}

export interface SupplierPaymentSummary {
  paymentId: string
  purchaseId: string
  purchaseNumber: string
  invoiceNumber: string
  date: string
  amount: number
  paymentMethod: string
  reference: string
  registeredByUserName: string
  notes?: string
}

export interface SupplierWarehouseRelation {
  locationId: string
  locationName: string
  locationCode: string
  purchasesCount: number
  totalAmount: number
  lastOperationDate?: string
}

export interface SupplierDocumentItem {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  url: string
  uploadedAt: string
  uploadedBy: string
  purchaseNumber?: string
  invoiceNumber?: string
}

export interface UserPermissionContext {
  userId: string
  userName: string
  userRole: string
  permissions: string[]
  locationId?: string
}
