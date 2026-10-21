/**
 * SUPER MÁS ERP/POS - Tipos del Módulo de Contabilidad
 *
 * Define el modelo formal para el Plan Único de Cuentas (PUC Colombia),
 * asientos de partida doble, libros contables, estados financieros,
 * sistema de costos y análisis por bodega.
 */

import type { PostingAccountOption } from '../utils/posting-accounts'

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
  /** Tipo de comprobante (accounting_voucher_types, migración 064). Vacío en asientos anteriores. */
  voucherTypeCode?: string
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
  /** Código del tipo de comprobante (FC, CC, ...). */
  voucherTypeCode?: string | 'ALL'
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
  /** Rango de cuentas PUC (incluyente; la final incluye sus subcuentas). Vacío = todas. */
  accountFrom?: string
  accountTo?: string
  /** Fecha de corte (YYYY-MM-DD) del Balance General. */
  cutoffDate?: string
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
  /** "Cuentas de X a Y" / "Todas las cuentas". */
  accountRangeLabel?: string
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

/**
 * Nodo del árbol PUC con saldos (Clase → Grupo → Cuenta → Subcuenta → Auxiliar).
 * Los importes de un nodo incluyen los de todo su subárbol; el saldo se expresa según la
 * naturaleza del propio nodo (DEBIT = débitos − créditos; CREDIT = créditos − débitos).
 */
export interface FinancialStatementNode {
  id: string
  code: string
  name: string
  level: AccountLevel
  /** 1 = Clase … 5 = Auxiliar. */
  levelNumber: number
  accountClass: number
  nature: AccountNature
  /** Saldo anterior (movimientos previos al periodo), según naturaleza. */
  openingBalance: number
  /** Débitos / créditos del periodo (en el Balance General: acumulados hasta la fecha de corte). */
  debit: number
  credit: number
  /** Saldo final según naturaleza: saldo anterior + movimientos del periodo. */
  balance: number
  /** Nodo creado para agrupar cuentas cuyo padre no existe en el catálogo. */
  isSynthetic: boolean
  children: FinancialStatementNode[]
}

export interface BalanceSheetParams {
  /** Fecha de corte YYYY-MM-DD (incluida). */
  cutoffDate: string
  locationId?: string | 'ALL'
  accountFrom?: string
  accountTo?: string
}

/** Estado de Situación Financiera desglosado por niveles del PUC. */
export interface BalanceSheetReport {
  /** Texto del corte, p. ej. "Corte al 21/10/2026". */
  period: string
  cutoffDate: string
  locationId?: string
  locationName?: string
  accountFrom?: string
  accountTo?: string
  accountRangeLabel: string
  /** Clase 1, 2 y 3 con todo su desglose (null si no hay cuentas de la clase en el rango). */
  assets: FinancialStatementNode | null
  liabilities: FinancialStatementNode | null
  equity: FinancialStatementNode | null
  /** Resultado del ejercicio aún no cerrado: Ingresos (4) − Gastos (5) − Costos (6) − Costos de producción (7). */
  currentYearResult: number
  resultBreakdown: {
    revenues: number
    expenses: number
    costOfSales: number
    productionCosts: number
  }
  totalAssets: number
  totalLiabilities: number
  /** Saldo de la clase 3 (sin el resultado del ejercicio). */
  totalEquityAccounts: number
  /** Patrimonio total = clase 3 + resultado del ejercicio. */
  totalEquity: number
  totalLiabilitiesAndEquity: number
  isBalanced: boolean
  difference: number
  /** true si hay al menos un saldo distinto de cero en las clases 1 a 7. */
  hasBalances: boolean
  generatedAt: string
}

/** Datos institucionales para los encabezados de los reportes (tabla companies). */
export interface AccountingCompanyHeader {
  legalName: string
  tradeName: string
  taxId: string
  verificationDigit: string
  taxRegime: string
  legalRepresentative: string
}

/** Débitos y créditos por cuenta (id de la cuenta → importes). */
export type AccountMovementTotalsMap = Map<string, { debit: number; credit: number }>

/** Totales del Balance de Comprobación consultados en la base (saldo anterior y periodo). */
export interface TrialBalanceTotals {
  opening: AccountMovementTotalsMap
  period: AccountMovementTotalsMap
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

export interface AccountingAccountRef {
  id: string
  code: string
  name: string
}

/**
 * Cuentas de una línea de inventario (accounting_inventory_account_map, migración 062):
 * la causación de ventas y devoluciones asienta inventario, costo e ingreso por esta línea.
 */
export interface InventoryLineAccounts {
  /** Fila del mapa; null si la línea nunca se configuró. */
  mapId: string | null
  inventoryAccount: AccountingAccountRef & { groupCode: string; groupName: string }
  /** null: la línea usa las cuentas por defecto (COST_OF_SALES / SALES_INCOME). */
  costAccount: AccountingAccountRef | null
  incomeAccount: AccountingAccountRef | null
  isActive: boolean
}

export interface InventoryLineAccountsConfig {
  lines: InventoryLineAccounts[]
  /** Auxiliares activas elegibles (la base valida además el par inventario → costo). */
  costAccounts: PostingAccountOption[]
  incomeAccounts: PostingAccountOption[]
  defaultCostAccount: AccountingAccountRef | null
  defaultIncomeAccount: AccountingAccountRef | null
}

/**
 * Tipo de comprobante contable (accounting_voucher_types, migración 064). Cada tipo lleva su propio
 * consecutivo por empresa: FC-000001, CC-000001...
 */
export interface AccountingVoucherType {
  id: string
  code: string
  name: string
  description?: string
  /** document_type que el servidor asigna a este tipo (MANUAL = elegible en el asiento manual). */
  defaultDocumentTypes: string[]
  /** Los tipos del sistema no se renombran ni se desactivan. */
  isSystem: boolean
  isActive: boolean
  sortOrder: number
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
  /** Sede (locations.id) o 'ALL'; reemplaza el texto libre de sucursal. */
  locationId?: string
  locationName?: string
  /** Empresa del usuario para el encabezado del archivo (razón social, NIT y DV). */
  companyHeader?: AccountingCompanyHeader | null
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
  locationId?: string
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
  /** "Cuentas de X a Y" / "Todas las cuentas". */
  accountRangeLabel: string
  locationName?: string
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


