/**
 * SUPER MÁS ERP/POS - Tipos del Módulo de Clientes (Customer Types)
 */

export type CustomerType = 'NATURAL' | 'COMPANY'

export type CustomerDocumentType = 'CC' | 'NIT' | 'CE' | 'PASSPORT' | 'OTHER'

export type CustomerCategory =
  | 'FINAL_CONSUMER'
  | 'FREQUENT'
  | 'WHOLESALE'
  | 'COMPANY'

export type CustomerPriceList = 'DEFAULT' | 'WHOLESALE' | 'VIP'

export type CustomerStatus = 'ACTIVE' | 'INACTIVE'

export interface Customer {
  id: string
  customerType: CustomerType
  documentType: CustomerDocumentType
  documentNumber: string
  firstName?: string
  lastName?: string
  businessName?: string
  commercialName?: string
  displayName: string
  contactPerson: string
  phone: string
  mobile?: string
  email: string
  address: string
  city: string
  department: string
  country: string
  category: CustomerCategory
  priceList: CustomerPriceList
  creditLimit: number
  creditDays: number
  currentBalance: number
  totalPurchased: number
  purchasesCount: number
  lastPurchaseDate?: string
  firstPurchaseDate?: string
  preferredLocationId?: string
  status: CustomerStatus
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface CustomerListItem {
  id: string
  displayName: string
  documentType: CustomerDocumentType
  documentNumber: string
  customerType: CustomerType
  phone: string
  email: string
  city: string
  department: string
  category: CustomerCategory
  priceList: CustomerPriceList
  creditLimit: number
  creditDays: number
  currentBalance: number
  totalPurchased: number
  purchasesCount: number
  lastPurchaseDate?: string
  status: CustomerStatus
}

export interface CustomerFilterParams {
  query?: string
  documentNumber?: string
  customerType?: CustomerType | 'ALL'
  category?: CustomerCategory | 'ALL'
  city?: string | 'ALL'
  status?: CustomerStatus | 'ALL'
  priceList?: CustomerPriceList | 'ALL'
  hasPurchases?: boolean
  hasBalance?: boolean
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
  sortBy?: 'displayName' | 'totalPurchased' | 'lastPurchaseDate' | 'createdAt' | 'currentBalance'
  sortDirection?: 'asc' | 'desc'
}

export interface CustomerStats {
  totalCustomers: number
  activeCustomers: number
  newCustomersInPeriod: number
  customersWithRecentPurchases: number
  totalSalesAmount: number
  topBuyer: {
    id: string
    name: string
    totalPurchased: number
    purchasesCount: number
  } | null
  averageTicket: number
}

export interface CustomerSaleSummary {
  id: string
  saleCode: string
  date: string
  locationId: string
  locationName: string
  sellerName: string
  itemsCount: number
  totalAmount: number
  costAmount?: number
  profitAmount?: number
  paymentMethod: string
  status: string
  invoiceId?: string
}

export interface CustomerInvoiceSummary {
  id: string
  invoiceNumber: string
  date: string
  dueDate: string
  locationId: string
  locationName: string
  subtotal: number
  taxTotal: number
  total: number
  pendingBalance: number
  status: 'PAID' | 'PARTIALLY_PAID' | 'PAYMENT_PENDING' | 'CANCELLED'
  paymentMethod: string
  dianStatus: 'VALIDADA_DIAN' | 'PENDIENTE' | 'RECHAZADA'
  dianCufe?: string
  itemsCount: number
  saleId?: string
}

export interface CustomerRemissionSummary {
  id: string
  remissionNumber: string
  date: string
  locationId: string
  locationName: string
  status: 'DELIVERED' | 'IN_TRANSIT' | 'PENDING'
  itemsCount: number
  totalUnits: number
  invoiceId?: string
  deliveredBy?: string
  driverName?: string
  receivedBy?: string
  notes?: string
}

export interface CustomerWebOrderSummary {
  id: string
  orderNumber: string
  date: string
  status: 'DELIVERED' | 'IN_TRANSIT' | 'PROCESSING' | 'PENDING' | 'CANCELLED'
  paymentStatus: 'PAID' | 'PENDING_CREDIT' | 'FAILED'
  paymentMethod: string
  totalAmount: number
  itemsCount: number
  channel: 'CATALOGO_SUPERMAS' | 'CATALOGO_DISTRIBUIDORA'
  shippingAddress: string
  assignedLocationId?: string
}

export interface CustomerPaymentSummary {
  id: string
  receiptNumber: string
  customerId?: string
  invoiceId?: string
  invoiceNumber?: string
  date: string
  amount: number
  paymentMethod: 'TRANSFERENCIA' | 'EFECTIVO' | 'TARJETA' | 'CHEQUE' | 'OTRO'
  reference: string
  user: string
  notes?: string
}

export interface CustomerDocumentSummary {
  id: string
  customerId?: string
  fileName: string
  fileUrl: string
  fileType: string
  fileSize: string
  category: 'RUT' | 'CAMARA_COMERCIO' | 'CEDULA' | 'ACUERDO_COMERCIAL' | 'OTRO'
  uploadedAt: string
  uploadedBy: string
  notes?: string
}

export interface CustomerLocationRelation {
  locationId: string
  locationName: string
  locationCode: string
  salesCount: number
  totalPurchased: number
  lastPurchaseDate?: string
}

export interface CustomerDetail extends Customer {
  sales: CustomerSaleSummary[]
  invoices: CustomerInvoiceSummary[]
  remissions: CustomerRemissionSummary[]
  webOrders: CustomerWebOrderSummary[]
  payments: CustomerPaymentSummary[]
  documents: CustomerDocumentSummary[]
  locationRelations: CustomerLocationRelation[]
  frequentProducts: {
    productId: string
    productName: string
    sku: string
    unitsBought: number
    totalSpent: number
    lastBoughtDate: string
  }[]
  auditLogs: {
    id: string
    timestamp: string
    user: string
    action: string
    details: string
    oldValues?: Record<string, unknown>
    newValues?: Record<string, unknown>
  }[]
}

export interface CreateCustomerDTO {
  customerType: CustomerType
  documentType: CustomerDocumentType
  documentNumber: string
  firstName?: string
  lastName?: string
  businessName?: string
  commercialName?: string
  contactPerson?: string
  phone: string
  mobile?: string
  email: string
  address: string
  city: string
  department: string
  country?: string
  category?: CustomerCategory
  priceList?: CustomerPriceList
  creditLimit?: number
  creditDays?: number
  preferredLocationId?: string
  notes?: string
}

export interface UpdateCustomerDTO {
  customerType?: CustomerType
  documentType?: CustomerDocumentType
  documentNumber?: string
  firstName?: string
  lastName?: string
  businessName?: string
  commercialName?: string
  contactPerson?: string
  phone?: string
  mobile?: string
  email?: string
  address?: string
  city?: string
  department?: string
  country?: string
  category?: CustomerCategory
  priceList?: CustomerPriceList
  creditLimit?: number
  creditDays?: number
  preferredLocationId?: string
  status?: CustomerStatus
  notes?: string
}

export interface CustomerPaymentDTO {
  customerId: string
  invoiceId?: string
  amount: number
  paymentMethod: 'TRANSFERENCIA' | 'EFECTIVO' | 'TARJETA' | 'CHEQUE' | 'OTRO'
  reference: string
  notes?: string
}

export interface CustomerDocumentDTO {
  customerId: string
  fileName: string
  fileSize: string
  fileType: string
  category: 'RUT' | 'CAMARA_COMERCIO' | 'CEDULA' | 'ACUERDO_COMERCIAL' | 'OTRO'
  notes?: string
}

export interface CustomerUserContext {
  userId: string
  userName: string
  permissions: string[]
}
