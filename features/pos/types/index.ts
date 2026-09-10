/**
 * SUPER MÁS ERP/POS - Tipos e Interfaces del Módulo POS (Punto de Venta)
 *
 * SEGURIDAD: Ningún tipo expuesto al cajero/operador POS debe incluir
 * costos de adquisición, márgenes de utilidad, cuentas contables ni datos de proveedores.
 */

export type POSPaymentMethod = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'MIXTO' | 'OTRO'

export interface POSProduct {
  id: string
  name: string
  sku: string
  barcode: string
  category: string
  unitOfMeasure: string
  imageUrl: string
  normalPrice: number
  wholesalePrice?: number
  distributorPrice?: number
  availableStock: number
  vatRatePercent: number
  isExempt: boolean
  status: 'ACTIVE' | 'INACTIVE'
}

export interface POSCustomer {
  id: string
  displayName: string
  documentNumber: string
  documentType: string
  phone: string
  email?: string
  address?: string
  priceList: 'DEFAULT' | 'WHOLESALE' | 'VIP'
  creditLimit: number
  currentBalance: number
  isWholesale?: boolean
  name?: string
  isActive?: boolean
}

export interface POSCartItem {
  id: string
  productId: string
  productName: string
  sku: string
  barcode: string
  unitOfMeasure: string
  imageUrl: string
  quantity: number
  unitPrice: number
  discountPercent: number
  discountAmount: number
  taxRatePercent: number
  taxAmount: number
  subtotal: number
  total: number
  availableStock: number
  discountReason?: string
}

export interface POSTotals {
  subtotal: number
  discountTotal: number
  taxTotal: number
  totalAmount: number
  totalUnits: number
  itemCount?: number
  discountAmount?: number
  taxAmount?: number
}

export interface POSSalePayload {
  customerId: string
  locationId: string
  paymentMethod: POSPaymentMethod
  amountPaid: number
  notes?: string
  items: Array<{
    productId: string
    quantity: number
    discountPercent?: number
    discountReason?: string
  }>
}

export interface POSTicketReceipt {
  saleId: string
  invoiceNumber: string
  saleNumber: string
  date: string
  time?: string
  issuedAtBogota?: string
  cashRegisterNumber?: string
  locationId: string
  locationName: string
  cashierName: string
  customerName: string
  customerDoc: string
  items: Array<{
    name: string
    sku: string
    quantity: number
    unitPrice: number
    discountAmount: number
    total: number
    taxRatePercent: number
  }>
  itemsCount: number
  totalUnits: number
  subtotal: number
  discountTotal: number
  discountAmount?: number
  taxTotal: number
  taxAmount?: number
  totalAmount: number
  paymentMethod: POSPaymentMethod
  amountPaid: number
  changeAmount: number
  change?: number
  dianCufe?: string
}

export interface POSDailySaleSummary {
  id?: string
  saleId: string
  saleNumber: string
  invoiceNumber?: string
  time: string
  customerName: string
  cashierName?: string
  itemsCount: number
  totalAmount: number
  paymentMethod: POSPaymentMethod
  status: string
}

export interface POSUserContext {
  userId: string
  userName: string
  userRole: string
  locationId: string
  locationName: string
  cashRegisterNumber?: string
  permissions: string[]
}
