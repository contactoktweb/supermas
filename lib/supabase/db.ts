/**
 * SUPER MÁS ERP/POS - Capa de Simulación de Base de Datos Supabase / PostgreSQL
 *
 * Este módulo centraliza todos los datos simulados en formato JSON estructurado
 * como tablas relacionales. Cuando se conecte el cliente oficial de Supabase
 * (@supabase/supabase-js o Prisma), la aplicación solo interactuará con esta
 * interfaz sin que los componentes UI contengan datos de prueba "hardcodeados".
 */

import locationsData from './mock-db/locations.json'
import productsData from './mock-db/products.json'
import stockLevelsData from './mock-db/stock_levels.json'
import inventoryMovementsData from './mock-db/inventory_movements.json'
import productMovementsData from './mock-db/product_movements.json'
import warehouseInventoryData from './mock-db/warehouse_inventory.json'
import warehouseMovementsData from './mock-db/warehouse_movements.json'
import transfersData from './mock-db/transfers.json'
import transferLocationsData from './mock-db/transfer_locations.json'
import transferAvailabilityData from './mock-db/transfer_availability.json'
import salesData from './mock-db/sales.json'
import purchasesData from './mock-db/purchases.json'
import customersData from './mock-db/customers.json'
import invoicesData from './mock-db/invoices.json'
import remissionsData from './mock-db/remissions.json'
import webOrdersData from './mock-db/web_orders.json'
import customerPaymentsData from './mock-db/customer_payments.json'
import customerDocumentsData from './mock-db/customer_documents.json'
import suppliersData from './mock-db/suppliers.json'
import usersData from './mock-db/users.json'
import userAssignmentsData from './mock-db/user_assignments.json'
import taxConfigsData from './mock-db/tax_configs.json'
import accountingEntriesData from './mock-db/accounting_entries.json'
import accountingAccountsData from './mock-db/accounting_accounts.json'
import accountingMovementsData from './mock-db/accounting_movements.json'
import exogenaNormativaData from './mock-db/exogena_normativa.json'
import exogenaGenerationsData from './mock-db/exogena_generations.json'
import categoriesData from './mock-db/categories.json'
import brandsData from './mock-db/brands.json'
import dashboardMetricsData from './mock-db/dashboard_metrics.json'
import auditLogsData from './mock-db/audit_logs.json'
import warehouseOverviewAnalyticsData from './mock-db/warehouse_overview_analytics.json'
import operationalModulesData from './mock-db/operational_modules.json'
import cashRegistersData from './mock-db/cash_registers.json'
import cashMovementsData from './mock-db/cash_movements.json'
import alertsData from './mock-db/alerts.json'
import alertRulesData from './mock-db/alert_rules.json'
import companySettingsData from './mock-db/company_settings.json'
import inventorySettingsData from './mock-db/inventory_settings.json'
import posSettingsData from './mock-db/pos_settings.json'
import ecommerceSettingsData from './mock-db/ecommerce_settings.json'
import settingsData from './mock-db/settings.json'

export interface SupabaseMockTableMap {
  locations: typeof locationsData
  products: typeof productsData
  stock_levels: typeof stockLevelsData
  inventory_movements: typeof inventoryMovementsData
  product_movements: typeof productMovementsData
  warehouse_inventory: typeof warehouseInventoryData
  warehouse_movements: typeof warehouseMovementsData
  transfers: typeof transfersData
  transfer_locations: typeof transferLocationsData
  transfer_availability: typeof transferAvailabilityData
  sales: typeof salesData
  invoices: typeof invoicesData
  remissions: typeof remissionsData
  web_orders: typeof webOrdersData
  customer_payments: typeof customerPaymentsData
  customer_documents: typeof customerDocumentsData
  purchases: typeof purchasesData
  customers: typeof customersData
  suppliers: typeof suppliersData
  users: typeof usersData
  user_assignments: typeof userAssignmentsData
  tax_configs: typeof taxConfigsData
  accounting_entries: typeof accountingEntriesData
  accounting_accounts: typeof accountingAccountsData
  accounting_movements: typeof accountingMovementsData
  exogena_normativa: typeof exogenaNormativaData
  exogena_generations: typeof exogenaGenerationsData
  categories: typeof categoriesData
  brands: typeof brandsData
  dashboard_metrics: typeof dashboardMetricsData
  audit_logs: typeof auditLogsData
  warehouse_overview_analytics: typeof warehouseOverviewAnalyticsData
  operational_modules: typeof operationalModulesData
  cash_registers: typeof cashRegistersData
  cash_movements: typeof cashMovementsData
  alerts: typeof alertsData
  alert_rules: typeof alertRulesData
  company_settings: typeof companySettingsData
  inventory_settings: typeof inventorySettingsData
  pos_settings: typeof posSettingsData
  ecommerce_settings: typeof ecommerceSettingsData
  settings: typeof settingsData
}

export const db = {
  locations: locationsData,
  products: productsData,
  stockLevels: stockLevelsData,
  inventoryMovements: inventoryMovementsData,
  productMovements: productMovementsData,
  warehouseInventory: warehouseInventoryData,
  warehouseMovements: warehouseMovementsData,
  transfers: transfersData,
  transferLocations: transferLocationsData,
  transferAvailability: transferAvailabilityData,
  sales: salesData,
  invoices: invoicesData,
  remissions: remissionsData,
  webOrders: webOrdersData,
  customerPayments: customerPaymentsData,
  customerDocuments: customerDocumentsData,
  purchases: purchasesData,
  customers: customersData,
  suppliers: suppliersData,
  users: usersData,
  userAssignments: userAssignmentsData,
  taxConfigs: taxConfigsData,
  accountingEntries: accountingEntriesData,
  accountingAccounts: accountingAccountsData,
  accountingMovements: accountingMovementsData,
  exogenaNormativa: exogenaNormativaData,
  exogenaGenerations: exogenaGenerationsData,
  categories: categoriesData,
  brands: brandsData,
  dashboardMetrics: dashboardMetricsData,
  auditLogs: auditLogsData,
  warehouseOverviewAnalytics: warehouseOverviewAnalyticsData,
  operationalModules: operationalModulesData,
  cashRegisters: cashRegistersData,
  cashMovements: cashMovementsData,
  alerts: alertsData,
  alertRules: alertRulesData,
  companySettings: companySettingsData,
  inventorySettings: inventorySettingsData,
  posSettings: posSettingsData,
  ecommerceSettings: ecommerceSettingsData,
  settings: settingsData,
}

/**
 * Cliente que emula la API fluida de consultas de Supabase:
 * e.g. supabaseMock.from('products').select()
 */
export const supabaseMock = {
  from<K extends keyof SupabaseMockTableMap>(table: K) {
    const rawData = (db as Record<string, unknown>)[
      table === 'stock_levels'
        ? 'stockLevels'
        : table === 'inventory_movements'
        ? 'inventoryMovements'
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
        : table
    ] as SupabaseMockTableMap[K]

    return {
      async select(): Promise<{ data: SupabaseMockTableMap[K]; error: null }> {
        // Retorna copia para evitar mutaciones accidentales del store JSON base
        return {
          data: JSON.parse(JSON.stringify(rawData)),
          error: null,
        }
      },
    }
  },
}

/**
 * Helpers dinámicos para selectores y filtros que los componentes pueden consultar
 * en lugar de tener listas fijas en el código UI.
 */
export function getDbLocationOptions() {
  return db.transferLocations.map((l) => ({
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
    ...db.users.map((u) => ({ value: u.name, label: `${u.name} (${u.role})` })),
  ]
}
