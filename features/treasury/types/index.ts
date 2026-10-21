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
 * Integrado con Contabilidad: al ejecutar un pago o registrar un recaudo, el servidor causa en la
 * misma transacción su comprobante (CE egreso, RC recibo de caja, CI consignación/ingreso a banco)
 * con la subcuenta PUC real de la cuenta bancaria o caja.
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
  /** Tipo de comprobante contable: CE (pagos), RC o CI (recaudos) */
  voucherTypeCode?: string | null
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
  /** Tipo de comprobante contable: CE (pagos), RC o CI (recaudos) */
  voucherTypeCode?: string | null
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
  bankAccountName?: string
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

/** Resultado de registrar un pago o recaudo: documento de tesorería y su comprobante contable. */
export interface TreasuryPostingResult {
  documentId: string
  documentNumber: string
  amount: number
  accountingEntryId: string | null
  accountingEntryNumber: string | null
  voucherTypeCode: string | null
  idempotentReplay: boolean
}

/** Cliente elegible para un recaudo (con su saldo de cartera). */
export interface ReceiptCustomerOption {
  id: string
  name: string
  documentNumber: string
  currentBalance: number
}

export interface TreasuryStats {
  totalCashAndBanks: number
  scheduledPaymentsTotal: number
  scheduledPaymentsCount: number
  paidThisMonthTotal: number
  collectedThisMonthTotal: number
  activeAccountsCount: number
}
