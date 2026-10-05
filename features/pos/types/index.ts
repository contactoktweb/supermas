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

export type CashRegisterStatus = 'OPEN' | 'CLOSED' | 'MAINTENANCE'
export type CashSessionStatus = 'OPEN' | 'CLOSED'
export type CashMovementType = 'OPENING_FLOAT' | 'CASH_IN' | 'CASH_OUT' | 'SALE_CASH'

export interface CashRegister {
  id: string
  companyId: string
  locationId: string
  locationName?: string
  code: string
  name: string
  currentStatus: CashRegisterStatus
  createdAt: string
  activeSessionId?: string | null
}

export interface CashSession {
  id: string
  companyId: string
  locationId: string
  locationName?: string
  cashRegisterId: string
  cashRegisterCode?: string
  cashRegisterName?: string
  userId: string
  cashierName?: string
  openingTime: string
  closingTime?: string | null
  openingFloat: number
  expectedCashAmount?: number | null
  countedCashAmount?: number | null
  differenceAmount?: number | null
  status: CashSessionStatus
  supervisorNotes?: string | null
  createdAt: string
}

export interface CashMovement {
  id: string
  companyId?: string
  sessionId: string
  type: CashMovementType
  amount: number
  reason: string
  authorizedByUserId?: string | null
  authorizerName?: string | null
  createdAt: string
}

export interface CashSessionSummary {
  sessionId: string
  status: CashSessionStatus
  cashRegisterId: string
  cashRegisterCode: string
  cashRegisterName: string
  cashierName: string
  locationName: string
  openingTime: string
  closingTime?: string | null
  openingFloat: number
  salesCash: number
  cashIn: number
  cashOut: number
  expectedCashAmount: number
  countedCashAmount?: number | null
  differenceAmount?: number | null
  salesCard: number
  salesTransfer: number
  salesCredit: number
  salesMixed: number
  totalSales: number
  transactionsCount: number
  movementsCount: number
  supervisorNotes?: string | null
}

export interface OpenSessionPayload {
  cashRegisterId: string
  openingFloat: number
  notes?: string
}

export interface RecordCashMovementPayload {
  sessionId: string
  type: 'CASH_IN' | 'CASH_OUT'
  amount: number
  reason: string
}

export interface CloseSessionPayload {
  sessionId: string
  countedCashAmount: number
  supervisorNotes?: string
}

