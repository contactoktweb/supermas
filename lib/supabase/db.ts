/**
 * SUPER MÁS ERP/POS - Capa de Simulación y Acceso de Base de Datos Supabase / PostgreSQL
 *
 * Configuración para INSTALACIÓN LIMPIA Y CONEXIÓN SUPABASE VACÍA:
 * - Tablas comerciales (productos, clientes, proveedores, ventas, compras, inventario,
 *   kardex, facturas, remisiones, cajas, pedidos web) inician con CERO REGISTROS ([]).
 * - No se cargan datos ficticios ni mocks de prueba en producción.
 * - Solo se preservan tablas de configuración inicial del sistema (roles/permisos,
 *   perfiles tributarios DIAN, estructura PUC base, reglas de alertas y usuario administrador inicial).
 */

import taxConfigsData from './mock-db/tax_configs.json'
import accountingAccountsData from './mock-db/accounting_accounts.json'
import accountingPeriodsData from './mock-db/accounting_periods.json'
import exogenaNormativaData from './mock-db/exogena_normativa.json'
import operationalModulesData from './mock-db/operational_modules.json'
import alertRulesData from './mock-db/alert_rules.json'
import companySettingsData from './mock-db/company_settings.json'
import inventorySettingsData from './mock-db/inventory_settings.json'
import posSettingsData from './mock-db/pos_settings.json'
import ecommerceSettingsData from './mock-db/ecommerce_settings.json'
import settingsData from './mock-db/settings.json'
import usersData from './mock-db/users.json'

// Usuario administrador inicial para permitir el acceso y configuración del sistema
const initialAdminUser = usersData.find((u) => u.role === 'SUPERADMIN') || {
  id: 'usr-001',
  name: 'Mauricio Andrade',
  firstName: 'Mauricio',
  lastName: 'Andrade',
  email: 'admin@supermas.com.co',
  username: 'mandrade',
  phone: '+57 310 445 8821',
  role: 'SUPERADMIN',
  status: 'ACTIVE',
  locationIds: [],
  locationName: 'Administración Central',
  avatar: 'MA',
  createdAt: new Date().toISOString(),
  lastLoginAt: new Date().toISOString(),
}

// Métricas de dashboard en ceros absolutos (sin datos simulados)
const emptyDashboardMetrics = {
  metricsByPeriod: {
    TODAY: {
      todaySales: { value: 0, deltaYesterdayPct: 0, count: 0 },
      periodSales: { value: 0, deltaPct: 0, count: 0 },
      grossProfit: { value: 0, marginPct: 0, deltaPct: 0 },
      inventoryAtCost: { value: 0, deltaPct: 0 },
      purchases: { value: 0, count: 0 },
      accountsPayable: { value: 0, pendingInvoices: 0 },
      productsCount: { total: 0, active: 0, lowStock: 0, critical: 0, outOfStock: 0 },
      pendingTransfers: { total: 0, inTransit: 0, pending: 0 },
      webOrders: { totalToday: 0, newOrders: 0, preparing: 0 },
    },
    THIS_WEEK: {
      todaySales: { value: 0, deltaYesterdayPct: 0, count: 0 },
      periodSales: { value: 0, deltaPct: 0, count: 0 },
      grossProfit: { value: 0, marginPct: 0, deltaPct: 0 },
      inventoryAtCost: { value: 0, deltaPct: 0 },
      purchases: { value: 0, count: 0 },
      accountsPayable: { value: 0, pendingInvoices: 0 },
      productsCount: { total: 0, active: 0, lowStock: 0, critical: 0, outOfStock: 0 },
      pendingTransfers: { total: 0, inTransit: 0, pending: 0 },
      webOrders: { totalToday: 0, newOrders: 0, preparing: 0 },
    },
    THIS_MONTH: {
      todaySales: { value: 0, deltaYesterdayPct: 0, count: 0 },
      periodSales: { value: 0, deltaPct: 0, count: 0 },
      grossProfit: { value: 0, marginPct: 0, deltaPct: 0 },
      inventoryAtCost: { value: 0, deltaPct: 0 },
      purchases: { value: 0, count: 0 },
      accountsPayable: { value: 0, pendingInvoices: 0 },
      productsCount: { total: 0, active: 0, lowStock: 0, critical: 0, outOfStock: 0 },
      pendingTransfers: { total: 0, inTransit: 0, pending: 0 },
      webOrders: { totalToday: 0, newOrders: 0, preparing: 0 },
    },
    THIS_YEAR: {
      todaySales: { value: 0, deltaYesterdayPct: 0, count: 0 },
      periodSales: { value: 0, deltaPct: 0, count: 0 },
      grossProfit: { value: 0, marginPct: 0, deltaPct: 0 },
      inventoryAtCost: { value: 0, deltaPct: 0 },
      purchases: { value: 0, count: 0 },
      accountsPayable: { value: 0, pendingInvoices: 0 },
      productsCount: { total: 0, active: 0, lowStock: 0, critical: 0, outOfStock: 0 },
      pendingTransfers: { total: 0, inTransit: 0, pending: 0 },
      webOrders: { totalToday: 0, newOrders: 0, preparing: 0 },
    },
  },
  salesChartByPeriod: {
    TODAY: [],
    THIS_WEEK: [],
    THIS_MONTH: [],
    THIS_YEAR: [],
  },
  warehouseCards: [],
  topProducts: [],
  inventoryDistribution: [],
  quickActions: [
    { id: 'qa-1', title: 'Nueva Venta POS', subtitle: 'Facturación directa en caja', icon: 'pos', targetView: 'POS', requiredPermission: 'pos.sell', highlight: true },
    { id: 'qa-2', title: 'Nuevo Producto', subtitle: 'Registrar producto en catálogo', icon: 'products', targetView: 'Productos', requiredPermission: 'product.create' },
    { id: 'qa-3', title: 'Nueva Compra', subtitle: 'Orden de compra a proveedor', icon: 'purchases', targetView: 'Compras', requiredPermission: 'purchase.create' },
    { id: 'qa-4', title: 'Configurar Bodega', subtitle: 'Registrar sede o bodega', icon: 'warehouse', targetView: 'Bodegas', requiredPermission: 'warehouse.write' },
  ],
  activityFeed: [],
  loginAudits: [],
  pendingAttention: [],
}

export interface SupabaseMockTableMap {
  locations: any[]
  products: any[]
  sale_items: any[]
  purchase_items: any[]
  transfer_items: any[]
  remission_items: any[]
  cash_sessions: any[]
  product_prices: any[]
  accounting_entry_lines: any[]
  stock_levels: any[]
  inventory_movements: any[]
  product_movements: Record<string, any[]>
  warehouse_inventory: any[]
  warehouse_movements: any[]
  transfers: any[]
  transfer_locations: any[]
  transfer_availability: any[]
  sales: any[]
  invoices: any[]
  remissions: any[]
  web_orders: any[]
  customer_payments: any[]
  customer_documents: any[]
  purchases: any[]
  customers: any[]
  suppliers: any[]
  users: typeof usersData
  user_assignments: any[]
  tax_configs: typeof taxConfigsData
  accounting_entries: any[]
  accounting_accounts: typeof accountingAccountsData
  accounting_movements: any[]
  exogena_normativa: typeof exogenaNormativaData
  exogena_generations: any[]
  categories: string[]
  brands: string[]
  dashboard_metrics: typeof emptyDashboardMetrics
  audit_logs: any[]
  warehouse_overview_analytics: {
    totalLocations: number
    totalCapacity: number
    totalCurrentStock: number
    averageOccupancyPct: number
  }
  operational_modules: typeof operationalModulesData
  cash_registers: any[]
  cash_movements: any[]
  alerts: any[]
  alert_rules: typeof alertRulesData
  company_settings: typeof companySettingsData
  inventory_settings: typeof inventorySettingsData
  pos_settings: typeof posSettingsData
  ecommerce_settings: typeof ecommerceSettingsData
  settings: typeof settingsData
  bank_accounts: any[]
  treasury_payments: any[]
  treasury_receipts: any[]
  dian_resolutions: any[]
  accounting_periods: typeof accountingPeriodsData
}

export const db = {
  // Tablas comerciales: TOTALMENTE VACÍAS
  locations: [] as any[],
  products: [] as any[],
  stockLevels: [] as any[],
  inventoryMovements: [] as any[],
  productMovements: {} as Record<string, any[]>,
  warehouseInventory: [] as any[],
  warehouseMovements: [] as any[],
  transfers: [] as any[],
  transferLocations: [] as any[],
  transferAvailability: [] as any[],
  sales: [] as any[],
  invoices: [] as any[],
  remissions: [] as any[],
  webOrders: [] as any[],
  customerPayments: [] as any[],
  customerDocuments: [] as any[],
  purchases: [] as any[],
  customers: [] as any[],
  suppliers: [] as any[],
  accountingEntries: [] as any[],
  accountingMovements: [] as any[],
  exogenaGenerations: [] as any[],
  categories: [] as string[],
  brands: [] as string[],
  auditLogs: [] as any[],
  warehouseOverviewAnalytics: {
    totalLocations: 0,
    totalCapacity: 0,
    totalCurrentStock: 0,
    averageOccupancyPct: 0,
  },
  cashRegisters: [] as any[],
  cashMovements: [] as any[],
  alerts: [] as any[],
  bankAccounts: [] as any[],
  treasuryPayments: [] as any[],
  treasuryReceipts: [] as any[],
  dianResolutions: [] as any[],
  saleItems: [] as any[],
  purchaseItems: [] as any[],
  transferItems: [] as any[],
  remissionItems: [] as any[],
  cashSessions: [] as any[],
  productPrices: [] as any[],
  accountingEntryLines: [] as any[],
  userAssignments: [] as any[],

  // Tablas de configuración inicial del sistema (Fase 6: Permitidas sin datos comerciales)
  users: [initialAdminUser] as typeof usersData,
  taxConfigs: taxConfigsData,
  accountingAccounts: accountingAccountsData,
  accountingPeriods: accountingPeriodsData,
  exogenaNormativa: exogenaNormativaData,
  operationalModules: operationalModulesData,
  alertRules: alertRulesData,
  companySettings: companySettingsData,
  inventorySettings: inventorySettingsData,
  posSettings: posSettingsData,
  ecommerceSettings: ecommerceSettingsData,
  settings: settingsData,
  dashboardMetrics: emptyDashboardMetrics,
}

/**
 * Cliente seguro de simulación de consultas compatible con Supabase.
 * Para toda entidad comercial devuelve arreglos vacíos data: [].
 */
export const supabaseMock = {
  from<K extends keyof SupabaseMockTableMap>(table: K) {
    const rawData = (db as Record<string, unknown>)[
      table === 'stock_levels'
        ? 'stockLevels'
        : table === 'inventory_movements'
        ? 'inventoryMovements'
        : table === 'sale_items'
        ? 'saleItems'
        : table === 'purchase_items'
        ? 'purchaseItems'
        : table === 'transfer_items'
        ? 'transferItems'
        : table === 'remission_items'
        ? 'remissionItems'
        : table === 'cash_sessions'
        ? 'cashSessions'
        : table === 'product_prices'
        ? 'productPrices'
        : table === 'accounting_entry_lines'
        ? 'accountingEntryLines'
        : table === 'product_movements'
        ? 'productMovements'
        : table === 'warehouse_inventory'
        ? 'warehouseInventory'
        : table === 'warehouse_movements'
        ? 'warehouseMovements'
        : table === 'transfer_locations'
        ? 'transferLocations'
        : table === 'transfer_availability'
        ? 'transferAvailability'
        : table === 'user_assignments'
        ? 'userAssignments'
        : table === 'tax_configs'
        ? 'taxConfigs'
        : table === 'accounting_entries'
        ? 'accountingEntries'
        : table === 'accounting_accounts'
        ? 'accountingAccounts'
        : table === 'accounting_movements'
        ? 'accountingMovements'
        : table === 'exogena_normativa'
        ? 'exogenaNormativa'
        : table === 'exogena_generations'
        ? 'exogenaGenerations'
        : table === 'dashboard_metrics'
        ? 'dashboardMetrics'
        : table === 'audit_logs'
        ? 'auditLogs'
        : table === 'warehouse_overview_analytics'
        ? 'warehouseOverviewAnalytics'
        : table === 'web_orders'
        ? 'webOrders'
        : table === 'customer_payments'
        ? 'customerPayments'
        : table === 'customer_documents'
        ? 'customerDocuments'
        : table === 'operational_modules'
        ? 'operationalModules'
        : table === 'cash_registers'
        ? 'cashRegisters'
        : table === 'cash_movements'
        ? 'cashMovements'
        : table === 'alerts'
        ? 'alerts'
        : table === 'alert_rules'
        ? 'alertRules'
        : table === 'company_settings'
        ? 'companySettings'
        : table === 'inventory_settings'
        ? 'inventorySettings'
        : table === 'pos_settings'
        ? 'posSettings'
        : table === 'ecommerce_settings'
        ? 'ecommerceSettings'
        : table === 'settings'
        ? 'settings'
        : table === 'bank_accounts'
        ? 'bankAccounts'
        : table === 'treasury_payments'
        ? 'treasuryPayments'
        : table === 'treasury_receipts'
        ? 'treasuryReceipts'
        : table === 'dian_resolutions'
        ? 'dianResolutions'
        : table === 'accounting_periods'
        ? 'accountingPeriods'
        : table
    ] as SupabaseMockTableMap[K]

    return {
      async select(): Promise<{ data: SupabaseMockTableMap[K]; error: null }> {
        return {
          data: Array.isArray(rawData) ? JSON.parse(JSON.stringify(rawData)) : (rawData as any),
          error: null,
        }
      },
    }
  },
}

/**
 * Helpers dinámicos para selectores y filtros.
 * Cuando no hay datos registrados retornan arreglos vacíos o con la opción por defecto.
 */
export function getDbLocationOptions() {
  return db.locations.map((l: any) => ({
    value: l.id,
    label: l.name,
    badge: l.code,
  }))
}

export function getDbCategoryOptions() {
  return [
    { value: 'ALL', label: 'Todas las categorías' },
    ...db.categories.map((c) => ({ value: c, label: c })),
  ]
}

export function getDbBrandOptions() {
  return [
    { value: 'ALL', label: 'Todas las marcas' },
    ...db.brands.map((b) => ({ value: b, label: b })),
  ]
}

export function getDbUserOptions() {
  return [
    { value: 'ALL', label: 'Todos los responsables' },
    ...db.users.map((u: any) => ({ value: u.name, label: `${u.name} (${u.role})` })),
  ]
}
