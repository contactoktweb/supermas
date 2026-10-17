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
  | 'CREDIT_NOTE'
  | 'DEBIT_NOTE'
  | 'ACCOUNTING_ADJUSTMENT'
  | 'CLOSING_ENTRY'

export type LegalNature = 'NATURAL' | 'JURIDICA'

export type ThirdPartyType = 'CLIENTE' | 'PROVEEDOR' | 'EMPLEADO' | 'ACREEDOR' | 'OTRO'

export interface ThirdParty {
  id: string
  companyId?: string
  documentType: string // 'CC' | 'NIT' | 'CE' | 'PASSPORT' | 'TI'
  documentNumber: string
  verificationDigit?: string
  legalNature: LegalNature
  firstName?: string
  otherNames?: string
  firstSurname?: string
  secondSurname?: string
  companyName: string // Razón Social o Nombre Completo
  commercialName?: string
  thirdPartyType: ThirdPartyType
  email?: string
  phone?: string
  address?: string
  city?: string
  department?: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface AccountingEntryLine {
  id: string
  accountId: string
  accountCode: string
  accountName: string
  debit: number
  credit: number
  description: string
  dueDate?: string
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
  dueDate?: string
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

export type PeriodMode = 'MONTH' | 'YEAR' | 'RANGE'

export interface AccountingFilters {
  query?: string
  accountClass?: AccountClass | 'ALL'
  nature?: AccountNature | 'ALL'
  level?: AccountLevel | 'ALL' | 'IMPUTABLE'
  status?: AccountStatus | 'ALL'
  sourceType?: AccountingSourceType | 'ALL'
  entryStatus?: AccountingEntryStatus | 'ALL'
  periodMode?: PeriodMode
  year?: number
  month?: string // '01' to '12' or 'YYYY-MM'
  dateFrom?: string
  dateTo?: string
  locationId?: string | 'ALL'
  accountId?: string | 'ALL'
  thirdPartyId?: string | 'ALL'
  costCenterId?: string | 'ALL'
  page: number
  pageSize: number
}

export interface AuxiliaryLedgerMovementItem extends AccountingMovement {
  runningBalance: number
  costCenterName?: string
}

export interface AuxiliaryLedgerAccountSummary {
  accountId: string
  accountCode: string
  accountName: string
  nature: AccountNature
  accountClass: AccountClass
  initialBalance: number
  totalDebit: number
  totalCredit: number
  finalBalance: number
  movementsCount: number
}

export interface AuxiliaryLedgerReport {
  selectedAccount: AccountingAccount | null
  periodMode: PeriodMode
  periodLabel: string
  dateFrom: string
  dateTo: string
  initialBalance: number
  totalDebit: number
  totalCredit: number
  finalBalance: number
  accountSummaries: AuxiliaryLedgerAccountSummary[]
  movements: AuxiliaryLedgerMovementItem[]
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

export type InventoryType =
  | 'RAW_MATERIAL' // Materias primas (1405)
  | 'WORK_IN_PROCESS' // Productos en proceso (1410)
  | 'FINISHED_GOOD' // Productos terminados (1430)
  | 'MERCHANDISE' // Mercancías para la venta (1435)

export interface InventoryAccountMapping {
  categoryId: string
  categoryName: string
  inventoryType: InventoryType
  inventoryTypeName: string
  inventoryAccountId: string
  inventoryAccountCode: string
  inventoryAccountName: string
  costAccountId: string
  costAccountCode: string
  costAccountName: string
  revenueAccountId: string
  revenueAccountCode: string
  revenueAccountName: string
  description?: string
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
  | 'accounting.periods'

export type AccountingPeriodStatus = 'OPEN' | 'CLOSED'

export interface AccountingPeriod {
  id: string
  companyId?: string
  periodCode: string // ej: '2026-08', '2026-09'
  year: number
  month: number
  monthName: string
  startDate: string
  endDate: string
  status: AccountingPeriodStatus
  closedAt?: string | null
  closedByUserId?: string | null
  closedByUserName?: string | null
  reopenedAt?: string | null
  reopenedByUserId?: string | null
  reopenedReason?: string | null
  entriesCount?: number
  totalDebits?: number
  totalCredits?: number
  createdAt?: string
  updatedAt?: string
}

export type AccountingExportType =
  | 'third_parties'
  | 'entries'
  | 'movements'
  | 'accounts'
  | 'journal'
  | 'balance'
  | 'trial_balance'

export type AccountingExportFormat = 'CSV' | 'EXCEL' | 'JSON' | 'PDF'

export interface AccountingExportFilterOptions {
  startDate?: string
  endDate?: string
  startAccountCode?: string
  endAccountCode?: string
  branch?: string
  costCenter?: string
  administrativeArea?: string
  voucherType?: string
  prefix?: string
  startNumber?: string
  endNumber?: string
  selectedThirdPartyId?: string
  thirdPartyType?: ThirdPartyType | 'ALL'
  legalNature?: LegalNature | 'ALL'
  entryStatus?: AccountingEntryStatus | 'ALL'
  searchQuery?: string
  mainAccountCode?: string
  maxLevel?: TrialBalanceLevelFilter
  includeThirdParties?: boolean
  hideZeroBalances?: boolean
}

export interface AccountingExportPdfParams {
  reportType: AccountingExportType
  mainAccountCode?: string
  startAccountCode?: string
  endAccountCode?: string
  branch?: string
  costCenter?: string
  administrativeArea?: string
  voucherType?: string
  selectedThirdPartyId?: string
  thirdPartyType?: ThirdPartyType | 'ALL'
  legalNature?: LegalNature | 'ALL'
  entryStatus?: AccountingEntryStatus | 'ALL'
  searchQuery?: string
  maxLevel?: TrialBalanceLevelFilter
  includeThirdParties?: boolean
  hideZeroBalances?: boolean
  startDate?: string
  endDate?: string
}

export type TrialBalanceLevelFilter = 'CLASS' | 'GROUP' | 'ACCOUNT' | 'SUBACCOUNT' | 'AUXILIARY' | 'ALL'

export interface TrialBalanceThirdPartyDetail {
  id?: string
  docType: string
  docNumber: string
  name: string
  initialBalance: number
  debit: number
  credit: number
  finalBalance: number
}

export interface TrialBalanceRow {
  code: string
  name: string
  accountClass: number
  level: AccountLevel
  nature: AccountNature
  initialBalance: number
  debit: number
  credit: number
  finalBalance: number
  hasMovements: boolean
  thirdParties?: TrialBalanceThirdPartyDetail[]
}

export interface TrialBalanceReportData {
  companyName: string
  companyNit: string
  startDate: string
  endDate: string
  branch?: string
  costCenter?: string
  administrativeArea?: string
  startAccountCode?: string
  endAccountCode?: string
  voucherType?: string
  selectedThirdPartyName?: string
  mainAccountCode: string
  mainAccountName: string
  maxLevel: TrialBalanceLevelFilter
  includeThirdParties: boolean
  rows: TrialBalanceRow[]
  totalInitialDebit: number
  totalInitialCredit: number
  totalDebit: number
  totalCredit: number
  totalFinalDebit: number
  totalFinalCredit: number
  isBalanced: boolean
  generatedAt: string
}


