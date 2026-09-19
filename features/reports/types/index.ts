/**
 * SUPER MÁS ERP/POS - Tipos y Modelos del Módulo Reportes y Analítica
 *
 * Consolidación analítica transversal: Ventas, Compras, Inventarios, Kardex,
 * Costos & Utilidad, Bodegas, Clientes, Proveedores, Cajas, Facturación,
 * Contabilidad y Ecommerce.
 */

export type ReportType =
  | 'OVERVIEW'
  | 'SALES'
  | 'PURCHASES'
  | 'INVENTORY'
  | 'KARDEX'
  | 'COSTS'
  | 'WAREHOUSES'
  | 'CUSTOMERS'
  | 'SUPPLIERS'
  | 'CASH'
  | 'BILLING'
  | 'ACCOUNTING'
  | 'ECOMMERCE'

export type ReportPeriod =
  | 'TODAY'
  | 'YESTERDAY'
  | 'THIS_WEEK'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'THIS_QUARTER'
  | 'THIS_YEAR'
  | 'ALL_TIME'
  | 'CUSTOM'

export type ExportFormat = 'EXCEL' | 'CSV' | 'PDF'

export interface ReportFilterCriteria {
  reportType?: ReportType
  period?: ReportPeriod
  startDate?: string
  endDate?: string
  locationId?: string
  secondLocationId?: string // Para comparación de bodegas
  userId?: string
  categoryId?: string
  productId?: string
  customerId?: string
  supplierId?: string
  paymentMethod?: string
  movementType?: string
  cashRegisterId?: string
  searchQuery?: string
  limit?: number
  offset?: number
}

// --------------------------------------------------------------------------
// PERMISOS DE SEGURIDAD ANALÍTICA
// --------------------------------------------------------------------------
export type ReportPermission =
  | 'reports.read'
  | 'reports.sales'
  | 'reports.purchases'
  | 'reports.inventory'
  | 'reports.costs'
  | 'reports.customers'
  | 'reports.suppliers'
  | 'reports.cash'
  | 'reports.billing'
  | 'reports.accounting'
  | 'reports.export'
  | 'reports.financial'

export interface UserReportContext {
  userId: string
  name: string
  role: string
  locationId?: string
  permissions: ReportPermission[]
}

// --------------------------------------------------------------------------
// DASHBOARD GLOBAL DE REPORTES
// --------------------------------------------------------------------------
export interface ReportDashboardKPIs {
  // Ventas
  salesTotal: number
  salesCount: number
  averageTicket: number
  salesChangePercent: number

  // Inventario
  inventoryValueAtCost?: number | null // null si no tiene permisos financieros
  inventoryValueAtSale: number
  availableProductsCount: number
  lowStockProductsCount: number
  outOfStockProductsCount: number

  // Compras
  purchasesTotal: number
  purchasesCount: number
  activeSuppliersCount: number

  // Finanzas
  totalRevenue: number
  totalCostOfGoodsSold?: number | null // null si no tiene permisos
  grossProfit?: number | null // null si no tiene permisos
  grossMarginPercent?: number | null // null si no tiene permisos

  // Ecommerce
  webOrdersCount: number
  webSalesTotal: number
  webPendingOrdersCount: number
}

export interface ChartDataPoint {
  label: string
  date?: string
  value: number
  secondaryValue?: number
  tertiaryValue?: number
  metadata?: Record<string, unknown>
}

export interface DistributionPoint {
  label: string
  value: number
  percentage: number
  color?: string
}

export interface ReportDashboardOverview {
  kpis: ReportDashboardKPIs
  salesTrend: ChartDataPoint[]
  purchasesTrend: ChartDataPoint[]
  categoryDistribution: DistributionPoint[]
  warehouseSalesShare: DistributionPoint[]
  topSellingProducts: {
    productId: string
    name: string
    sku: string
    quantitySold: number
    revenue: number
  }[]
}

// --------------------------------------------------------------------------
// REPORTE DE VENTAS
// --------------------------------------------------------------------------
export interface SalesReportRow {
  id: string
  date: string
  invoiceNumber: string
  saleNumber: string
  customerName: string
  customerDoc: string
  sellerName: string
  locationId: string
  locationName: string
  paymentMethod: string
  itemsCount: number
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number
}

export interface SalesReportData {
  summary: {
    totalSales: number
    documentCount: number
    averageTicket: number
    totalItemsSold: number
    totalDiscounts: number
    totalTaxes: number
  }
  byDay: ChartDataPoint[]
  byMonth: ChartDataPoint[]
  byWarehouse: DistributionPoint[]
  byCategory: DistributionPoint[]
  bySeller: { sellerName: string; totalSales: number; documentCount: number }[]
  rows: SalesReportRow[]
  totalRows: number
}

// --------------------------------------------------------------------------
// REPORTE DE COMPRAS
// --------------------------------------------------------------------------
export interface PurchasesReportRow {
  id: string
  date: string
  purchaseNumber: string
  supplierInvoiceNumber: string
  supplierName: string
  supplierNit: string
  destinationLocationName: string
  paymentType: string
  status: string
  dueDate: string
  subtotal: number
  taxTotal: number
  total: number
  paidAmount: number
  pendingBalance: number
}

export interface PurchasesReportData {
  summary: {
    totalPurchases: number
    purchaseCount: number
    activeSuppliers: number
    totalItemsPurchased: number
    cashPurchasesTotal: number
    creditPurchasesTotal: number
    pendingBalanceTotal: number
    overdueCount: number
  }
  bySupplier: { supplierName: string; totalAmount: number; count: number }[]
  byWarehouse: DistributionPoint[]
  paymentTypeShare: DistributionPoint[]
  rows: PurchasesReportRow[]
  totalRows: number
}

// --------------------------------------------------------------------------
// REPORTE DE INVENTARIO
// --------------------------------------------------------------------------
export interface InventoryReportRow {
  productId: string
  name: string
  sku: string
  barcode: string
  category: string
  brand: string
  unitOfMeasure: string
  stockTotal: number
  normalPrice: number
  unitCost?: number | null // Confidencial
  inventoryValueAtCost?: number | null // Confidencial
  inventoryValueAtSale: number
  grossMarginPercent?: number | null // Confidencial
  availabilityStatus: 'AVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK'
  locationsBreakdown: { locationId: string; locationName: string; units: number }[]
}

export interface InventoryReportData {
  summary: {
    inventoryValueAtCost?: number | null
    inventoryValueAtSale: number
    totalProductsCount: number
    availableCount: number
    lowStockCount: number
    outOfStockCount: number
    overallMarginPercent?: number | null
  }
  byWarehouse: DistributionPoint[]
  byCategory: DistributionPoint[]
  byBrand: DistributionPoint[]
  rows: InventoryReportRow[]
  totalRows: number
}

// --------------------------------------------------------------------------
// REPORTE KARDEX
// --------------------------------------------------------------------------
export interface KardexReportRow {
  id: string
  timestamp: string
  movementType: string
  reference: string
  productId: string
  productName: string
  sku: string
  locationName: string
  quantityIn: number
  quantityOut: number
  resultingStock: number
  unitCost?: number | null
  totalCost?: number | null
  user: string
  notes?: string
}

export interface KardexReportData {
  summary: {
    initialStockQuantity: number
    totalInflowsUnits: number
    totalOutflowsUnits: number
    finalStockQuantity: number
    totalInflowsValue?: number | null
    totalOutflowsValue?: number | null
  }
  byMovementType: DistributionPoint[]
  rows: KardexReportRow[]
  totalRows: number
}

// --------------------------------------------------------------------------
// REPORTE COSTOS Y UTILIDAD (CMV)
// --------------------------------------------------------------------------
export interface CostAnalysisReportRow {
  productId: string
  name: string
  sku: string
  category: string
  unitsSold: number
  averageSellingPrice: number
  averageCost?: number | null
  totalRevenue: number
  totalCostOfGoodsSold?: number | null
  grossProfit?: number | null
  grossMarginPercent?: number | null
}

export interface CostsReportData {
  summary: {
    totalRevenue: number
    costOfGoodsSold?: number | null
    grossProfit?: number | null
    grossMarginPercent?: number | null
    unitsSoldTotal: number
  }
  byCategory: {
    category: string
    revenue: number
    cost?: number | null
    profit?: number | null
    marginPercent?: number | null
  }[]
  byWarehouse: {
    warehouseName: string
    revenue: number
    cost?: number | null
    profit?: number | null
    marginPercent?: number | null
  }[]
  monthlyTrend: ChartDataPoint[]
  rows: CostAnalysisReportRow[]
  totalRows: number
}

// --------------------------------------------------------------------------
// REPORTE POR BODEGAS Y COMPARATIVA
// --------------------------------------------------------------------------
export interface WarehousePerformanceMetrics {
  locationId: string
  name: string
  code: string
  type: string
  salesTotal: number
  salesCount: number
  averageTicket: number
  purchasesTotal: number
  inventoryUnits: number
  inventoryValueAtCost?: number | null
  inventoryValueAtSale: number
  grossProfit?: number | null
  grossMarginPercent?: number | null
  activeCustomersCount: number
  activeSuppliersCount: number
  movementsCount: number
}

export interface WarehouseComparisonData {
  warehouseA: WarehousePerformanceMetrics
  warehouseB: WarehousePerformanceMetrics
  differences: {
    salesDiff: number
    salesPercentDiff: number
    profitDiff?: number | null
    inventoryUnitsDiff: number
    ticketDiff: number
  }
}

export interface WarehousesReportData {
  warehouses: WarehousePerformanceMetrics[]
  comparison?: WarehouseComparisonData | null
}

// --------------------------------------------------------------------------
// REPORTE CLIENTES
// --------------------------------------------------------------------------
export interface CustomerReportRow {
  customerId: string
  name: string
  documentNumber: string
  customerType: string
  category: string
  purchasesCount: number
  totalPurchased: number
  averageTicket: number
  lastPurchaseDate: string
  currentReceivableBalance: number
  creditLimit: number
  status: string
}

export interface CustomersReportData {
  summary: {
    totalCustomersCount: number
    activeCustomersCount: number
    newCustomersThisMonth: number
    averageSpendPerCustomer: number
    totalReceivables: number
  }
  topCustomers: CustomerReportRow[]
  byCategory: DistributionPoint[]
  rows: CustomerReportRow[]
  totalRows: number
}

// --------------------------------------------------------------------------
// REPORTE PROVEEDORES
// --------------------------------------------------------------------------
export interface SupplierReportRow {
  supplierId: string
  name: string
  nit: string
  purchasesCount: number
  totalPurchasedAmount: number
  pendingPayablesBalance: number
  overdueInvoicesCount: number
  overdueAmount: number
  lastPurchaseDate: string
}

export interface SuppliersReportData {
  summary: {
    totalSuppliersCount: number
    activeSuppliersCount: number
    totalPurchasesAmount: number
    totalPendingPayables: number
    overdueInvoicesTotal: number
  }
  topSuppliers: SupplierReportRow[]
  rows: SupplierReportRow[]
  totalRows: number
}

// --------------------------------------------------------------------------
// REPORTE CAJAS REGISTRADORAS
// --------------------------------------------------------------------------
export interface CashRegisterReportRow {
  id: string
  code: string
  name: string
  locationId: string
  locationName: string
  cashierName: string
  status: 'OPEN' | 'CLOSED'
  openedAt: string
  closedAt: string | null
  openingBalance: number
  cashSales: number
  otherSales: number
  cashInflows: number
  cashOutflows: number
  expectedCash: number
  actualCash: number
  difference: number
  notes: string
}

export interface CashMovementRow {
  id: string
  cashRegisterCode: string
  locationName: string
  type: string
  amount: number
  reference: string
  description: string
  cashierName: string
  timestamp: string
}

export interface CashRegistersReportData {
  summary: {
    totalRegisters: number
    openRegistersCount: number
    closedRegistersCount: number
    totalExpectedCash: number
    totalActualCash: number
    totalDifferences: number
  }
  registers: CashRegisterReportRow[]
  recentMovements: CashMovementRow[]
}

// --------------------------------------------------------------------------
// REPORTE FACTURACIÓN ELECTRÓNICA (DIAN)
// --------------------------------------------------------------------------
export interface BillingReportRow {
  id: string
  invoiceNumber: string
  customerName: string
  customerDoc: string
  locationName: string
  date: string
  dueDate: string
  subtotal: number
  taxTotal: number
  total: number
  pendingBalance: number
  dianStatus: 'VALIDADA_DIAN' | 'RECHAZADA_DIAN' | 'PENDIENTE_DIAN' | 'ANULADA'
  paymentMethod: string
  status: string
}

export interface BillingReportData {
  summary: {
    totalInvoicesCount: number
    dianAcceptedCount: number
    dianRejectedCount: number
    cancelledCount: number
    creditNotesCount: number
    totalInvoiced: number
    totalTaxesCollected: number
    totalPendingCollection: number
  }
  byDianStatus: DistributionPoint[]
  byPaymentMethod: DistributionPoint[]
  rows: BillingReportRow[]
  totalRows: number
}

// --------------------------------------------------------------------------
// REPORTE CONTABLE
// --------------------------------------------------------------------------
export interface AccountingReportData {
  summary: {
    totalAssets: number
    totalLiabilities: number
    totalEquity: number
    totalRevenues: number
    totalCosts: number
    totalExpenses: number
    netIncome: number
    accountingEquationSatisfied: boolean
  }
  journalSummary: {
    entriesCount: number
    totalDebits: number
    totalCredits: number
  }
  classDistribution: DistributionPoint[]
  receivablesTotal: number
  payablesTotal: number
}

// --------------------------------------------------------------------------
// REPORTE ECOMMERCE
// --------------------------------------------------------------------------
export interface EcommerceReportData {
  summary: {
    webOrdersTotalCount: number
    webSalesTotalRevenue: number
    averageWebOrderValue: number
    completedOrdersCount: number
    pendingOrdersCount: number
    cancelledOrdersCount: number
    cancellationRatePercent: number
    averagePrepMinutes: number
  }
  comparisonWebVsPos: {
    webRevenue: number
    posRevenue: number
    webSharePercent: number
    posSharePercent: number
    webTicket: number
    posTicket: number
  }
  ordersByStatus: DistributionPoint[]
  topWebProducts: {
    productId: string
    name: string
    sku: string
    quantity: number
    revenue: number
  }[]
}

// --------------------------------------------------------------------------
// CARD DE ACCESO RÁPIDO (HUB PRINCIPAL)
// --------------------------------------------------------------------------
export interface ReportCardNavInfo {
  id: ReportType
  title: string
  description: string
  href: string
  iconName: string
  accentColor: string
  primaryMetricLabel: string
  primaryMetricValue: string
  tag?: string
  requiredPermission: ReportPermission
}
