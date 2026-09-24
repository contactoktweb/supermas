/**
 * SUPER MÁS ERP/POS - Tipos del Módulo de Tesorería
 *
 * Módulo independiente especializado en:
 * - Cuentas bancarias y caja general
 * - Dispersión de pagos a proveedores y terceros
 * - Recaudos de clientes
 * - Movimientos de extracto bancario
 * - Conciliación bancaria
 *
 * Integrado con Contabilidad: Al confirmarse un pago o recaudo,
 * Tesorería solicita a Contabilidad la generación del asiento oficial de partida doble.
 */

export type BankAccountType = 'CORRIENTE' | 'AHORROS' | 'CAJA_EFECTIVO'

export interface BankAccount {
  id: string
  companyId?: string
  locationId?: string | null
  locationName?: string | null
  bankName: string
  accountNumber: string
  accountType: BankAccountType
  currency: string
  currentBalance: number
  accountingAccountId: string
  accountingAccountCode: string
  accountingAccountName: string
  status: 'ACTIVE' | 'INACTIVE'
  description?: string
  createdById?: string
  updatedById?: string
  createdAt?: string
  updatedAt?: string
}

export type TreasuryPaymentStatus = 'SCHEDULED' | 'PAID' | 'CANCELLED'

export interface TreasuryPayment {
  id: string
  companyId?: string
  locationId?: string | null
  locationName?: string | null
  paymentNumber: string // ej: TES-PAG-2026-00101
  type: 'SUPPLIER_PAYMENT' | 'EXPENSE_PAYMENT' | 'TAX_PAYMENT' | 'OTHER'
  purchaseId?: string
  purchaseNumber?: string
  supplierInvoiceNumber?: string
  thirdPartyType: 'SUPPLIER' | 'CREDITOR' | 'DIAN'
  thirdPartyId: string
  thirdPartyName: string
  thirdPartyDoc: string
  bankAccountId: string
  bankAccountName: string
  paymentMethod: 'TRANSFERENCIA' | 'CHEQUE' | 'EFECTIVO'
  amount: number
  paymentDate: string
  dueDate?: string
  referenceNumber?: string
  supportDocumentUrl?: string
  status: TreasuryPaymentStatus
  accountingEntryId?: string | null
  accountingEntryNumber?: string | null
  debitAccountCode: string
  debitAccountName: string
  creditAccountCode: string
  creditAccountName: string
  notes?: string
  createdById?: string
  createdByName?: string
  updatedById?: string
  createdAt: string
  updatedAt?: string
}

export type TreasuryReceiptStatus = 'COLLECTED' | 'RECONCILED' | 'CANCELLED'

export interface TreasuryReceipt {
  id: string
  companyId?: string
  locationId?: string | null
  locationName?: string | null
  receiptNumber: string // ej: TES-REC-2026-00051
  invoiceId?: string
  invoiceNumber?: string
  customerId: string
  customerName: string
  customerDoc: string
  bankAccountId: string
  bankAccountName: string
  paymentMethod: 'TRANSFERENCIA' | 'CONSIGNACION' | 'EFECTIVO' | 'TARJETA'
  amount: number
  receiptDate: string
  referenceNumber?: string
  status: TreasuryReceiptStatus
  accountingEntryId?: string | null
  accountingEntryNumber?: string | null
  debitAccountCode: string
  debitAccountName: string
  creditAccountCode: string
  creditAccountName: string
  notes?: string
  createdById?: string
  createdByName?: string
  updatedById?: string
  createdAt: string
  updatedAt?: string
}

export interface BankMovement {
  id: string
  companyId?: string
  locationId?: string | null
  bankAccountId: string
  movementNumber: string
  date: string
  type: 'DEBIT' | 'CREDIT'
  amount: number
  balanceAfter: number
  concept: string
  reference?: string
  treasuryPaymentId?: string
  treasuryReceiptId?: string
  isReconciled: boolean
  reconciledAt?: string
  createdById?: string
  createdAt?: string
  updatedAt?: string
}

export interface BankReconciliation {
  id: string
  bankAccountId: string
  period: string // YYYY-MM
  statementBalance: number
  bookBalance: number
  difference: number
  status: 'RECONCILED' | 'PENDING' | 'DISCREPANCY'
  reconciledAt?: string
  reconciledBy?: string
  notes?: string
}

export interface TreasuryStats {
  totalCashAndBanks: number
  scheduledPaymentsTotal: number
  scheduledPaymentsCount: number
  paidThisMonthTotal: number
  collectedThisMonthTotal: number
  activeAccountsCount: number
}
