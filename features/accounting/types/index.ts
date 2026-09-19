/**
 * SUPER MÁS ERP/POS - Tipos del Módulo de Contabilidad
 *
 * Define el modelo formal para el Plan Único de Cuentas (PUC Colombia),
 * asientos de partida doble, libros contables, estados financieros,
 * sistema de costos y análisis por bodega.
 */

export type AccountClass = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type AccountType =
  | 'ASSET'
  | 'LIABILITY'
  | 'EQUITY'
  | 'REVENUE'
  | 'EXPENSE'
  | 'COST'
  | 'PRODUCTION_COST'

export type AccountNature = 'DEBIT' | 'CREDIT'

export type AccountLevel = 'CLASS' | 'GROUP' | 'ACCOUNT' | 'SUBACCOUNT' | 'AUXILIARY'

export type AccountStatus = 'ACTIVE' | 'INACTIVE'

export interface AccountingAccount {
  id: string
  code: string
  name: string
  accountClass: AccountClass
  type: AccountType
  nature: AccountNature
  level: AccountLevel
  parentId: string | null
  balance: number
  status: AccountStatus
  requiresThirdParty: boolean
  requiresCostCenter: boolean
  isSystemAccount: boolean
  description?: string
  createdAt?: string
  updatedAt?: string
}

export type AccountingEntryStatus = 'DRAFT' | 'POSTED' | 'REVERSED'

export type AccountingSourceType =
  | 'SALE'
  | 'PURCHASE'
  | 'INVOICE'
  | 'COST_OF_SALES'
  | 'CUSTOMER_PAYMENT'
  | 'SUPPLIER_PAYMENT'
  | 'MANUAL'
  | 'TRANSFER'
  | 'INVENTORY_ADJUSTMENT'
  | 'REVERSAL'

export interface AccountingEntryLine {
  id: string
  accountId: string
  accountCode: string
  accountName: string
  debit: number
  credit: number
  description: string
  taxConfigId?: string
  taxRatePercent?: number
  baseAmount?: number
  costCenterId?: string
  costCenterName?: string
}

export interface AccountingEntry {
  id: string
  entryNumber: string
  date: string
  period: string // YYYY-MM
  sourceType: AccountingSourceType
  sourceId?: string
  documentNumber?: string
  description: string
  status: AccountingEntryStatus
  locationId?: string
  locationName?: string
  thirdPartyId?: string
  thirdPartyName?: string
  thirdPartyDoc?: string
  lines: AccountingEntryLine[]
  totalDebit: number
  totalCredit: number
  isBalanced: boolean
  reversalOfEntryId?: string
  reversedByEntryId?: string
  reversalReason?: string
  createdByUserId?: string
  createdByUserName?: string
  confirmedAt?: string
  createdAt: string
  updatedAt?: string
}

export interface AccountingMovement {
  id: string
  entryId: string
  entryNumber: string
  date: string
  period: string
  accountId: string
  accountCode: string
  accountName: string
  nature: AccountNature
  sourceType: AccountingSourceType
  sourceId?: string
  sourceDocumentNumber?: string
  locationId?: string
  locationName?: string
  thirdPartyId?: string
  thirdPartyName?: string
  thirdPartyDoc?: string
  debit: number
  credit: number
  balanceAfter: number
  description: string
  createdAt: string
}

export interface AccountingFilters {
  query?: string
  accountClass?: AccountClass | 'ALL'
  nature?: AccountNature | 'ALL'
  status?: AccountStatus | 'ALL'
  sourceType?: AccountingSourceType | 'ALL'
  entryStatus?: AccountingEntryStatus | 'ALL'
  dateFrom?: string
  dateTo?: string
  locationId?: string | 'ALL'
  accountId?: string | 'ALL'
  page: number
  pageSize: number
}

export interface MonthlyFinancialPoint {
  month: string
  label: string
  revenue: number
  cost: number
  expenses: number
  profit: number
}

export interface WarehouseFinancialSummary {
  locationId: string
  locationCode: string
  locationName: string
  type: string
  salesTotal: number
  costsTotal: number
  grossProfit: number
  marginPercent: number
  inventoryValued: number
  pendingReceivables: number
  pendingPayables: number
  movementsCount: number
}

export interface AccountingDashboard {
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  totalRevenues: number
  totalExpenses: number
  totalCosts: number
  netProfit: number
  profitMarginPercent: number
  totalValuedInventory: number
  accountsReceivableTotal: number
  accountsPayableTotal: number
  cashAndBanksTotal: number
  taxPayableTotal: number
  postedEntriesCount: number
  pendingDraftEntriesCount: number
  monthlyFinancials: MonthlyFinancialPoint[]
  warehouseBreakdown: WarehouseFinancialSummary[]
}

export interface BalanceSheetItem {
  code: string
  name: string
  balance: number
  percentage: number
}

export interface BalanceSheetReport {
  period: string
  locationId?: string
  locationName?: string
  currentAssets: BalanceSheetItem[]
  nonCurrentAssets: BalanceSheetItem[]
  totalAssets: number
  currentLiabilities: BalanceSheetItem[]
  nonCurrentLiabilities: BalanceSheetItem[]
  totalLiabilities: number
  equityItems: BalanceSheetItem[]
  totalEquity: number
  totalLiabilitiesAndEquity: number
  isBalanced: boolean
  difference: number
}

export interface IncomeStatementReport {
  period: string
  locationId?: string
  locationName?: string
  operatingRevenues: BalanceSheetItem[]
  totalRevenues: number
  costOfSales: BalanceSheetItem[]
  totalCosts: number
  grossProfit: number
  grossMarginPercent: number
  administrativeExpenses: BalanceSheetItem[]
  sellingExpenses: BalanceSheetItem[]
  totalOperatingExpenses: number
  operatingProfit: number
  nonOperatingIncome: number
  nonOperatingExpenses: number
  netProfit: number
  netMarginPercent: number
}

export interface GeneralLedgerReport {
  accountId: string
  accountCode: string
  accountName: string
  period: string
  initialBalance: number
  movements: AccountingMovement[]
  totalDebit: number
  totalCredit: number
  finalBalance: number
}

export interface AccountsReceivableItem {
  customerId: string
  customerName: string
  customerDoc: string
  invoiceId: string
  invoiceNumber: string
  locationName: string
  date: string
  dueDate: string
  total: number
  paidAmount: number
  pendingBalance: number
  daysOverdue: number
  status: 'CURRENT' | 'OVERDUE' | 'CRITICAL'
}

export interface AccountsPayableItem {
  supplierId: string
  supplierName: string
  supplierDoc: string
  purchaseId: string
  purchaseNumber: string
  supplierInvoiceNumber: string
  locationName: string
  date: string
  dueDate: string
  total: number
  paidAmount: number
  pendingBalance: number
  daysOverdue: number
  status: 'CURRENT' | 'OVERDUE' | 'CRITICAL'
}

export type CostMethod = 'WEIGHTED_AVERAGE' | 'FIFO'

export interface CostAnalysisItem {
  productId: string
  sku: string
  barcode: string
  name: string
  category: string
  unitOfMeasure: string
  locationId: string
  locationName: string
  averageCost: number
  lastPurchaseCost: number
  normalPrice: number
  wholesalePrice: number
  profitMarginCOP: number
  profitMarginPercent: number
  stockQuantity: number
  totalValuedCost: number
}

export interface ExogenaPrepItem {
  conceptCode: string
  conceptDescription: string
  thirdPartyDoc: string
  thirdPartyName: string
  accountCode: string
  paymentAmount: number
  taxBaseAmount: number
  withholdingTaxAmount: number
}

export interface InventoryAccountMapping {
  categoryId: string
  categoryName: string
  inventoryAccountId: string
  inventoryAccountCode: string
  inventoryAccountName: string
  costAccountId: string
  costAccountCode: string
  costAccountName: string
  revenueAccountId: string
  revenueAccountCode: string
  revenueAccountName: string
}

export type AccountingPermission =
  | 'accounting.read'
  | 'accounting.accounts'
  | 'accounting.entries'
  | 'accounting.confirm'
  | 'accounting.cancel'
  | 'accounting.reports'
  | 'accounting.costs'
  | 'accounting.config'
