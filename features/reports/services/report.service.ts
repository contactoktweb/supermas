/**
 * SUPER MÁS ERP/POS - Servicio Central de Reportes y Analítica (ReportService)
 *
 * Fachada de negocio encargada de:
 * 1. Validar esquemas y permisos granulares RBAC (reports.*).
 * 2. Aplicar sanitización obligatoria de costos y datos financieros a usuarios no autorizados.
 * 3. Orquestar consultas desacopladas vía reportRepository y construcciones analíticas vía reportBuilder.
 * 4. Integrar módulos especializados (accountingReportService, costService) sin duplicar reglas.
 * 5. Registrar trazabilidad inmutable mediante auditService.log().
 */

import { reportRepository } from '../repositories/report.repository'
import { reportBuilder } from '../builders/report.builder'
import { reportExportService, ExportColumnDefinition } from './report-export.service'
import { accountingReportService } from '@/features/accounting/services/accounting-report.service'
import { accountingRepository } from '@/features/accounting/repositories/accounting.repository'
import { auditService } from '@/features/audit/services/audit.service'
import {
  ReportType,
  ReportFilterCriteria,
  ReportDashboardOverview,
  SalesReportData,
  PurchasesReportData,
  InventoryReportData,
  KardexReportData,
  CostsReportData,
  WarehousesReportData,
  CustomersReportData,
  SuppliersReportData,
  CashRegistersReportData,
  BillingReportData,
  AccountingReportData,
  EcommerceReportData,
  ReportCardNavInfo,
  UserReportContext,
  ReportPermission,
  ExportFormat,
} from '../types'
import { reportFilterCriteriaSchema } from '../schemas/report.schema'

export const DEFAULT_ANALYTICS_USER: UserReportContext = {
  userId: 'usr-001',
  name: 'Carlos Morales',
  role: 'SUPERADMIN',
  locationId: 'loc-001',
  permissions: [
    'reports.read',
    'reports.sales',
    'reports.purchases',
    'reports.inventory',
    'reports.costs',
    'reports.customers',
    'reports.suppliers',
    'reports.cash',
    'reports.billing',
    'reports.accounting',
    'reports.export',
    'reports.financial',
  ],
}

const ROLE_PERMISSIONS: Record<string, ReportPermission[]> = {
  SUPERADMIN: [
    'reports.read',
    'reports.sales',
    'reports.purchases',
    'reports.inventory',
    'reports.costs',
    'reports.customers',
    'reports.suppliers',
    'reports.cash',
    'reports.billing',
    'reports.accounting',
    'reports.export',
    'reports.financial',
  ],
  ADMIN: [
    'reports.read',
    'reports.sales',
    'reports.purchases',
    'reports.inventory',
    'reports.costs',
    'reports.customers',
    'reports.suppliers',
    'reports.cash',
    'reports.billing',
    'reports.accounting',
    'reports.export',
    'reports.financial',
  ],
  GERENTE: [
    'reports.read',
    'reports.sales',
    'reports.purchases',
    'reports.inventory',
    'reports.costs',
    'reports.customers',
    'reports.suppliers',
    'reports.cash',
    'reports.billing',
    'reports.accounting',
    'reports.export',
    'reports.financial',
  ],
  CONTADOR: [
    'reports.read',
    'reports.sales',
    'reports.purchases',
    'reports.inventory',
    'reports.costs',
    'reports.billing',
    'reports.accounting',
    'reports.export',
    'reports.financial',
  ],
  CAJERO: ['reports.read', 'reports.sales', 'reports.cash', 'reports.billing'],
  BODEGUERO: ['reports.read', 'reports.inventory', 'reports.export'],
}

export class ReportService {
  /**
   * Valida si el usuario activo cuenta con un permiso específico
   */
  hasPermission(permission: ReportPermission, user: UserReportContext = DEFAULT_ANALYTICS_USER): boolean {
    if (user.role === 'SUPERADMIN') return true
    if (user.permissions?.includes(permission)) return true
    const rolePerms = ROLE_PERMISSIONS[user.role.toUpperCase()] || []
    return rolePerms.includes(permission)
  }

  /**
   * Lanza un error si el usuario no tiene el permiso requerido
   */
  assertPermission(permission: ReportPermission, user: UserReportContext = DEFAULT_ANALYTICS_USER): void {
    if (!this.hasPermission(permission, user)) {
      throw new Error(
        `Acceso denegado: El usuario "${user.name}" (${user.role}) no tiene el permiso analítico requerido: "${permission}".`
      )
    }
  }

  /**
   * Resuelve el contexto completo con fechas
   */
  private resolveCriteria(rawCriteria?: ReportFilterCriteria): ReportFilterCriteria {
    const valid = reportFilterCriteriaSchema.parse(rawCriteria || {})
    const dateRange = reportBuilder.resolveDateRange(valid.period)
    return {
      ...valid,
      startDate: valid.startDate || dateRange.startDate,
      endDate: valid.endDate || dateRange.endDate,
    }
  }

  /**
   * Obtiene el Dashboard Global de Reportes
   */
  async getDashboard(
    rawCriteria?: ReportFilterCriteria,
    user: UserReportContext = DEFAULT_ANALYTICS_USER
  ): Promise<ReportDashboardOverview> {
    this.assertPermission('reports.read', user)

    const criteria = this.resolveCriteria(rawCriteria)
    const canViewFinancials =
      this.hasPermission('reports.financial', user) && this.hasPermission('reports.costs', user)

    const [sales, purchases, products, stockLevels, webOrders] = await Promise.all([
      reportRepository.getSales(criteria),
      reportRepository.getPurchases(criteria),
      reportRepository.getProducts(),
      reportRepository.getStockLevels(criteria.locationId),
      reportRepository.getWebOrders(criteria),
    ])

    const overview = reportBuilder.buildDashboardOverview({
      sales,
      purchases,
      products,
      stockLevels,
      webOrders,
      canViewFinancials,
    })

    await auditService.log({
      action: 'REPORT_GENERATED',
      module: 'REPORTS',
      entityType: 'REPORT_DASHBOARD',
      entityId: 'OVERVIEW',
      entityReference: 'Dashboard General de Reportes',
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      locationId: user.locationId,
      level: 'INFO',
      details: `Generado Dashboard General de Reportes para periodo ${criteria.period || 'ESTE_MES'}.`,
    })

    return overview
  }

  /**
   * Obtiene el Reporte de Ventas
   */
  async getSalesReport(
    rawCriteria?: ReportFilterCriteria,
    user: UserReportContext = DEFAULT_ANALYTICS_USER
  ): Promise<SalesReportData> {
    this.assertPermission('reports.sales', user)

    const criteria = this.resolveCriteria(rawCriteria)
    const [sales, products] = await Promise.all([
      reportRepository.getSales(criteria),
      reportRepository.getProducts(),
    ])

    const report = reportBuilder.buildSalesReport(sales, products)

    await auditService.log({
      action: 'REPORT_GENERATED',
      module: 'REPORTS',
      entityType: 'REPORT_SALES',
      entityId: 'SALES',
      entityReference: 'Reporte de Ventas',
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      locationId: user.locationId,
      level: 'INFO',
      details: `Generado Reporte de Ventas (${report.summary.documentCount} documentos, Total: $${report.summary.totalSales.toLocaleString('es-CO')}).`,
    })

    return report
  }

  /**
   * Obtiene el Reporte de Compras
   */
  async getPurchasesReport(
    rawCriteria?: ReportFilterCriteria,
    user: UserReportContext = DEFAULT_ANALYTICS_USER
  ): Promise<PurchasesReportData> {
    this.assertPermission('reports.purchases', user)

    const criteria = this.resolveCriteria(rawCriteria)
    const purchases = await reportRepository.getPurchases(criteria)
    const report = reportBuilder.buildPurchasesReport(purchases)

    await auditService.log({
      action: 'REPORT_GENERATED',
      module: 'REPORTS',
      entityType: 'REPORT_PURCHASES',
      entityId: 'PURCHASES',
      entityReference: 'Reporte de Compras',
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      locationId: user.locationId,
      level: 'INFO',
      details: `Generado Reporte de Compras (${report.summary.purchaseCount} órdenes de compra).`,
    })

    return report
  }

  /**
   * Obtiene el Reporte de Inventario
   */
  async getInventoryReport(
    rawCriteria?: ReportFilterCriteria,
    user: UserReportContext = DEFAULT_ANALYTICS_USER
  ): Promise<InventoryReportData> {
    this.assertPermission('reports.inventory', user)

    const criteria = this.resolveCriteria(rawCriteria)
    const canViewFinancials = this.hasPermission('reports.costs', user)

    const [products, stockLevels, locations] = await Promise.all([
      reportRepository.getProducts(),
      reportRepository.getStockLevels(criteria.locationId),
      reportRepository.getLocations(),
    ])

    const report = reportBuilder.buildInventoryReport({
      products,
      stockLevels,
      locations,
      canViewFinancials,
    })

    await auditService.log({
      action: 'REPORT_GENERATED',
      module: 'REPORTS',
      entityType: 'REPORT_INVENTORY',
      entityId: 'INVENTORY',
      entityReference: 'Reporte de Inventario',
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      locationId: user.locationId,
      level: 'INFO',
      details: `Generado Reporte de Inventario (${report.summary.totalProductsCount} productos analizados).`,
    })

    return report
  }

  /**
   * Obtiene el Reporte de Kardex (Movimientos)
   */
  async getKardexReport(
    rawCriteria?: ReportFilterCriteria,
    user: UserReportContext = DEFAULT_ANALYTICS_USER
  ): Promise<KardexReportData> {
    this.assertPermission('reports.inventory', user)

    const criteria = this.resolveCriteria(rawCriteria)
    const canViewFinancials = this.hasPermission('reports.costs', user)

    const [movements, products] = await Promise.all([
      reportRepository.getInventoryMovements(criteria),
      reportRepository.getProducts(),
    ])

    const report = reportBuilder.buildKardexReport(movements, products, canViewFinancials)

    await auditService.log({
      action: 'REPORT_GENERATED',
      module: 'REPORTS',
      entityType: 'REPORT_KARDEX',
      entityId: 'KARDEX',
      entityReference: 'Reporte de Kardex Valorizado',
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      locationId: user.locationId,
      level: 'INFO',
      details: `Generado Kardex de Movimientos (${report.totalRows} registros).`,
    })

    return report
  }

  /**
   * Obtiene el Reporte de Costos y Utilidad (CMV)
   */
  async getCostsReport(
    rawCriteria?: ReportFilterCriteria,
    user: UserReportContext = DEFAULT_ANALYTICS_USER
  ): Promise<CostsReportData> {
    this.assertPermission('reports.costs', user)

    const criteria = this.resolveCriteria(rawCriteria)
    const canViewFinancials = this.hasPermission('reports.costs', user)

    const [sales, products] = await Promise.all([
      reportRepository.getSales(criteria),
      reportRepository.getProducts(),
    ])

    const report = reportBuilder.buildCostsReport({
      sales,
      products,
      canViewFinancials,
    })

    await auditService.log({
      action: 'REPORT_SENSITIVE_ACCESSED',
      module: 'REPORTS',
      entityType: 'REPORT_COSTS',
      entityId: 'COSTS_PROFIT',
      entityReference: 'Reporte Confidencial de Costos y Utilidad',
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      locationId: user.locationId,
      level: 'WARNING',
      details: `Consulta de Costos de Mercancía Vendida (CMV) y Utilidad Bruta ejecutada por ${user.name}.`,
    })

    return report
  }

  /**
   * Obtiene el Reporte de Bodegas y Comparativa Bodega A vs B
   */
  async getWarehousesReport(
    rawCriteria?: ReportFilterCriteria,
    user: UserReportContext = DEFAULT_ANALYTICS_USER
  ): Promise<WarehousesReportData> {
    this.assertPermission('reports.read', user)

    const criteria = this.resolveCriteria(rawCriteria)
    const canViewFinancials = this.hasPermission('reports.costs', user)

    const [locations, sales, purchases, stockLevels, products, inventoryMovements] =
      await Promise.all([
        reportRepository.getLocations(),
        reportRepository.getSales(criteria),
        reportRepository.getPurchases(criteria),
        reportRepository.getStockLevels(),
        reportRepository.getProducts(),
        reportRepository.getInventoryMovements(criteria),
      ])

    const comparisonIds =
      criteria.locationId && criteria.secondLocationId
        ? { warehouseAId: criteria.locationId, warehouseBId: criteria.secondLocationId }
        : undefined

    const report = reportBuilder.buildWarehousesReport({
      locations,
      sales,
      purchases,
      stockLevels,
      products,
      inventoryMovements,
      comparisonIds,
      canViewFinancials,
    })

    await auditService.log({
      action: 'REPORT_GENERATED',
      module: 'REPORTS',
      entityType: 'REPORT_WAREHOUSES',
      entityId: 'WAREHOUSES',
      entityReference: 'Reporte Comparativo de Bodegas',
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      locationId: user.locationId,
      level: 'INFO',
      details: `Generado Reporte de Rendimiento por Bodega${
        comparisonIds ? ` (Comparación: ${comparisonIds.warehouseAId} vs ${comparisonIds.warehouseBId})` : ''
      }.`,
    })

    return report
  }

  /**
   * Obtiene el Reporte de Clientes
   */
  async getCustomersReport(
    rawCriteria?: ReportFilterCriteria,
    user: UserReportContext = DEFAULT_ANALYTICS_USER
  ): Promise<CustomersReportData> {
    this.assertPermission('reports.customers', user)

    const criteria = this.resolveCriteria(rawCriteria)
    const [customers, sales] = await Promise.all([
      reportRepository.getCustomers(),
      reportRepository.getSales(criteria),
    ])

    const report = reportBuilder.buildCustomersReport(customers, sales)

    await auditService.log({
      action: 'REPORT_GENERATED',
      module: 'REPORTS',
      entityType: 'REPORT_CUSTOMERS',
      entityId: 'CUSTOMERS',
      entityReference: 'Reporte Comercial de Clientes',
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      locationId: user.locationId,
      level: 'INFO',
      details: `Generado Reporte de Clientes (${report.summary.totalCustomersCount} registrados).`,
    })

    return report
  }

  /**
   * Obtiene el Reporte de Proveedores
   */
  async getSuppliersReport(
    rawCriteria?: ReportFilterCriteria,
    user: UserReportContext = DEFAULT_ANALYTICS_USER
  ): Promise<SuppliersReportData> {
    this.assertPermission('reports.suppliers', user)

    const criteria = this.resolveCriteria(rawCriteria)
    const [suppliers, purchases] = await Promise.all([
      reportRepository.getSuppliers(),
      reportRepository.getPurchases(criteria),
    ])

    const report = reportBuilder.buildSuppliersReport(suppliers, purchases)

    await auditService.log({
      action: 'REPORT_GENERATED',
      module: 'REPORTS',
      entityType: 'REPORT_SUPPLIERS',
      entityId: 'SUPPLIERS',
      entityReference: 'Reporte de Proveedores y Cuentas por Pagar',
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      locationId: user.locationId,
      level: 'INFO',
      details: `Generado Reporte de Proveedores (${report.summary.totalSuppliersCount} proveedores).`,
    })

    return report
  }

  /**
   * Obtiene el Reporte de Cajas Registradoras
   */
  async getCashRegistersReport(
    rawCriteria?: ReportFilterCriteria,
    user: UserReportContext = DEFAULT_ANALYTICS_USER
  ): Promise<CashRegistersReportData> {
    this.assertPermission('reports.cash', user)

    const criteria = this.resolveCriteria(rawCriteria)
    const [registers, movements, locations] = await Promise.all([
      reportRepository.getCashRegisters(criteria.locationId),
      reportRepository.getCashMovements(criteria.cashRegisterId, criteria.locationId),
      reportRepository.getLocations(),
    ])

    const report = reportBuilder.buildCashRegistersReport(registers, movements, locations)

    await auditService.log({
      action: 'REPORT_GENERATED',
      module: 'REPORTS',
      entityType: 'REPORT_CASH',
      entityId: 'CASH',
      entityReference: 'Reporte de Arqueos y Cajas',
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      locationId: user.locationId,
      level: 'INFO',
      details: `Generado Reporte de Cajas Registradoras (${report.summary.openRegistersCount} abiertas, ${report.summary.closedRegistersCount} cerradas).`,
    })

    return report
  }

  /**
   * Obtiene el Reporte de Facturación Electrónica DIAN
   */
  async getBillingReport(
    rawCriteria?: ReportFilterCriteria,
    user: UserReportContext = DEFAULT_ANALYTICS_USER
  ): Promise<BillingReportData> {
    this.assertPermission('reports.billing', user)

    const criteria = this.resolveCriteria(rawCriteria)
    const invoices = await reportRepository.getInvoices(criteria)
    const report = reportBuilder.buildBillingReport(invoices)

    await auditService.log({
      action: 'REPORT_GENERATED',
      module: 'REPORTS',
      entityType: 'REPORT_BILLING',
      entityId: 'BILLING',
      entityReference: 'Reporte de Facturación DIAN',
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      locationId: user.locationId,
      level: 'INFO',
      details: `Generado Reporte de Facturación (${report.summary.totalInvoicesCount} facturas analizadas).`,
    })

    return report
  }

  /**
   * Obtiene el Reporte Contable consumiendo accountingReportService
   */
  async getAccountingReport(
    rawCriteria?: ReportFilterCriteria,
    user: UserReportContext = DEFAULT_ANALYTICS_USER
  ): Promise<AccountingReportData> {
    this.assertPermission('reports.accounting', user)
    this.assertPermission('reports.financial', user)

    const criteria = this.resolveCriteria(rawCriteria)
    const [balanceSheet, incomeStatement, allEntries, cxc, cxp] = await Promise.all([
      accountingReportService.getBalanceSheet(undefined, criteria.locationId),
      accountingReportService.getIncomeStatement(undefined, criteria.locationId),
      accountingRepository.getAllEntries(),
      accountingReportService.getAccountsReceivable(),
      accountingReportService.getAccountsPayable(),
    ])

    let entries = allEntries.filter((e) => e.status === 'POSTED')
    if (criteria.locationId && criteria.locationId !== 'ALL') {
      entries = entries.filter((e) => e.locationId === criteria.locationId)
    }

    let totalDebits = 0
    let totalCredits = 0
    entries.forEach((e) => {
      e.lines?.forEach((l) => {
        totalDebits += Number(l.debit) || 0
        totalCredits += Number(l.credit) || 0
      })
    })

    const receivablesTotal = cxc.reduce((acc, c) => acc + (Number(c.pendingBalance) || 0), 0)
    const payablesTotal = cxp.reduce((acc, p) => acc + (Number(p.pendingBalance) || 0), 0)

    const classDistribution = [
      {
        label: '1. Activos',
        value: balanceSheet.totalAssets,
        percentage: 45.2,
      },
      {
        label: '2. Pasivos',
        value: balanceSheet.totalLiabilities,
        percentage: 24.1,
      },
      {
        label: '3. Patrimonio',
        value: balanceSheet.totalEquity,
        percentage: 30.7,
      },
    ]

    const report: AccountingReportData = {
      summary: {
        totalAssets: balanceSheet.totalAssets,
        totalLiabilities: balanceSheet.totalLiabilities,
        totalEquity: balanceSheet.totalEquity,
        totalRevenues: incomeStatement.totalRevenues,
        totalCosts: incomeStatement.totalCosts,
        totalExpenses: incomeStatement.totalOperatingExpenses,
        netIncome: incomeStatement.netProfit,
        accountingEquationSatisfied: balanceSheet.isBalanced,
      },
      journalSummary: {
        entriesCount: entries.length,
        totalDebits,
        totalCredits,
      },
      classDistribution,
      receivablesTotal,
      payablesTotal,
    }

    await auditService.log({
      action: 'REPORT_SENSITIVE_ACCESSED',
      module: 'REPORTS',
      entityType: 'REPORT_ACCOUNTING',
      entityId: 'ACCOUNTING',
      entityReference: 'Reporte Financiero Contable PUC',
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      locationId: user.locationId,
      level: 'WARNING',
      details: `Acceso a Estados Financieros Contables (Balance General y P&L) por ${user.name}.`,
    })

    return report
  }

  /**
   * Obtiene el Reporte de Ecommerce
   */
  async getEcommerceReport(
    rawCriteria?: ReportFilterCriteria,
    user: UserReportContext = DEFAULT_ANALYTICS_USER
  ): Promise<EcommerceReportData> {
    this.assertPermission('reports.sales', user)

    const criteria = this.resolveCriteria(rawCriteria)
    const [webOrders, sales, products] = await Promise.all([
      reportRepository.getWebOrders(criteria),
      reportRepository.getSales(criteria),
      reportRepository.getProducts(),
    ])

    const report = reportBuilder.buildEcommerceReport(webOrders, sales, products)

    await auditService.log({
      action: 'REPORT_GENERATED',
      module: 'REPORTS',
      entityType: 'REPORT_ECOMMERCE',
      entityId: 'ECOMMERCE',
      entityReference: 'Reporte de Ecommerce vs Ventas POS',
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      locationId: user.locationId,
      level: 'INFO',
      details: `Generado Reporte Ecommerce (${report.summary.webOrdersTotalCount} pedidos online, Ventas: $${report.summary.webSalesTotalRevenue.toLocaleString('es-CO')}).`,
    })

    return report
  }

  /**
   * Retorna las 12 tarjetas de acceso para el Hub principal de Reportes
   */
  async getNavigationCards(
    user: UserReportContext = DEFAULT_ANALYTICS_USER
  ): Promise<ReportCardNavInfo[]> {
    const allCards: ReportCardNavInfo[] = [
      {
        id: 'SALES',
        title: 'Ventas',
        description: 'Facturación, tickets promedio, volumen por vendedor y métodos de pago.',
        href: '/reportes/ventas',
        iconName: 'sales',
        accentColor: '#10b981',
        primaryMetricLabel: 'Ventas Hoy',
        primaryMetricValue: '$18.4M',
        tag: 'Comercial',
        requiredPermission: 'reports.sales',
      },
      {
        id: 'PURCHASES',
        title: 'Compras',
        description: 'Abastecimiento de proveedores, compras contado vs crédito y vencimientos.',
        href: '/reportes/compras',
        iconName: 'purchases',
        accentColor: '#3b82f6',
        primaryMetricLabel: 'Compras Periodo',
        primaryMetricValue: '$18.4M',
        tag: 'Operativo',
        requiredPermission: 'reports.purchases',
      },
      {
        id: 'INVENTORY',
        title: 'Inventario',
        description: 'Valorización del stock, rotación, productos disponibles y alertas de agotados.',
        href: '/reportes/inventario',
        iconName: 'inventory',
        accentColor: '#f59e0b',
        primaryMetricLabel: 'Valor Stock',
        primaryMetricValue: '$148.2M',
        tag: 'Logística',
        requiredPermission: 'reports.inventory',
      },
      {
        id: 'KARDEX',
        title: 'Kardex Valorizado',
        description: 'Trazabilidad estricta de entradas, salidas, transferencias y saldos resultantes.',
        href: '/reportes/kardex',
        iconName: 'kardex',
        accentColor: '#8b5cf6',
        primaryMetricLabel: 'Movimientos',
        primaryMetricValue: '1,420',
        tag: 'Auditoría',
        requiredPermission: 'reports.inventory',
      },
      {
        id: 'COSTS',
        title: 'Costos y Utilidad',
        description: 'Costo de mercancía vendida (CMV), utilidad bruta y márgenes porcentuales.',
        href: '/reportes/costos',
        iconName: 'accounting',
        accentColor: '#ec4899',
        primaryMetricLabel: 'Margen Prom.',
        primaryMetricValue: '28.4%',
        tag: 'Confidencial',
        requiredPermission: 'reports.costs',
      },
      {
        id: 'WAREHOUSES',
        title: 'Desempeño por Bodega',
        description: 'Rendimiento individual y comparativa directa entre Bodega A y Bodega B.',
        href: '/reportes/bodegas',
        iconName: 'warehouse',
        accentColor: '#6366f1',
        primaryMetricLabel: 'Bodegas Activas',
        primaryMetricValue: '4',
        tag: 'Multi-sede',
        requiredPermission: 'reports.read',
      },
      {
        id: 'CUSTOMERS',
        title: 'Clientes',
        description: 'Frecuencia de compra, ticket promedio, cartera por cobrar y top compradores.',
        href: '/reportes/clientes',
        iconName: 'customers',
        accentColor: '#06b6d4',
        primaryMetricLabel: 'Clientes Activos',
        primaryMetricValue: '142',
        tag: 'Fidelización',
        requiredPermission: 'reports.customers',
      },
      {
        id: 'SUPPLIERS',
        title: 'Proveedores',
        description: 'Volumen adquirido, cuentas por pagar pendientes y alertas de facturas vencidas.',
        href: '/reportes/proveedores',
        iconName: 'suppliers',
        accentColor: '#0ea5e9',
        primaryMetricLabel: 'Por Pagar (CxP)',
        primaryMetricValue: '$18.4M',
        tag: 'Financiero',
        requiredPermission: 'reports.suppliers',
      },
      {
        id: 'CASH',
        title: 'Cajas Registradoras',
        description: 'Arqueos diarios, aperturas, cierres, efectivo en caja y diferencias operativas.',
        href: '/reportes/cajas',
        iconName: 'cashRegisters',
        accentColor: '#14b8a6',
        primaryMetricLabel: 'Cajas Abiertas',
        primaryMetricValue: '2 / 4',
        tag: 'Punto de Venta',
        requiredPermission: 'reports.cash',
      },
      {
        id: 'BILLING',
        title: 'Facturación Electrónica',
        description: 'Control de CUFE, validaciones ante la DIAN, notas crédito y recaudos de IVA.',
        href: '/reportes/facturacion',
        iconName: 'invoices',
        accentColor: '#f97316',
        primaryMetricLabel: 'Facturas DIAN',
        primaryMetricValue: '100% OK',
        tag: 'Tributario',
        requiredPermission: 'reports.billing',
      },
      {
        id: 'ACCOUNTING',
        title: 'Contabilidad PUC',
        description: 'Balance general patrimonial, P&L de resultados, libro diario y balance de prueba.',
        href: '/reportes/contabilidad',
        iconName: 'accounting',
        accentColor: '#a855f7',
        primaryMetricLabel: 'Ecuación Patrimonial',
        primaryMetricValue: 'Cuadrada',
        tag: 'Gerencial',
        requiredPermission: 'reports.accounting',
      },
      {
        id: 'ECOMMERCE',
        title: 'Ecommerce Web',
        description: 'Pedidos web online, conversión, tiempos de despacho y comparativa vs ventas POS.',
        href: '/reportes/ecommerce',
        iconName: 'webOrders',
        accentColor: '#ef4444',
        primaryMetricLabel: 'Pedidos Web',
        primaryMetricValue: '28 / mes',
        tag: 'Online B2C',
        requiredPermission: 'reports.sales',
      },
    ]

    return allCards.filter((c) => this.hasPermission(c.requiredPermission, user))
  }

  /**
   * Ejecuta la exportación de un reporte a Excel, CSV o PDF
   */
  async exportReportData(params: {
    reportType: ReportType
    format: ExportFormat
    criteria?: ReportFilterCriteria
    user?: UserReportContext
  }): Promise<void> {
    const user = params.user || DEFAULT_ANALYTICS_USER
    this.assertPermission('reports.export', user)

    const { reportType, format, criteria } = params
    let title = `Reporte_${reportType}`
    let filenameBase = `supermas_${reportType.toLowerCase()}`
    let columns: ExportColumnDefinition[] = []
    let rows: Array<Record<string, unknown>> = []

    switch (reportType) {
      case 'SALES': {
        const data = await this.getSalesReport(criteria, user)
        title = 'Reporte de Ventas Super Más'
        filenameBase = 'reporte_ventas'
        columns = [
          { key: 'invoiceNumber', header: 'Factura / Doc', format: 'text' },
          { key: 'date', header: 'Fecha', format: 'date' },
          { key: 'customerName', header: 'Cliente', format: 'text' },
          { key: 'sellerName', header: 'Vendedor', format: 'text' },
          { key: 'locationName', header: 'Bodega', format: 'text' },
          { key: 'paymentMethod', header: 'Método Pago', format: 'text' },
          { key: 'subtotal', header: 'Subtotal', format: 'currency' },
          { key: 'taxAmount', header: 'Impuestos', format: 'currency' },
          { key: 'total', header: 'Total Venta', format: 'currency' },
        ]
        rows = data.rows as unknown as Array<Record<string, unknown>>
        break
      }
      case 'PURCHASES': {
        const data = await this.getPurchasesReport(criteria, user)
        title = 'Reporte de Compras Super Más'
        filenameBase = 'reporte_compras'
        columns = [
          { key: 'purchaseNumber', header: 'Orden Compra', format: 'text' },
          { key: 'supplierInvoiceNumber', header: 'Factura Proveedor', format: 'text' },
          { key: 'date', header: 'Fecha', format: 'date' },
          { key: 'supplierName', header: 'Proveedor', format: 'text' },
          { key: 'destinationLocationName', header: 'Bodega Destino', format: 'text' },
          { key: 'paymentType', header: 'Condición', format: 'text' },
          { key: 'total', header: 'Total', format: 'currency' },
          { key: 'paidAmount', header: 'Pagado', format: 'currency' },
          { key: 'pendingBalance', header: 'Saldo Pendiente', format: 'currency' },
        ]
        rows = data.rows as unknown as Array<Record<string, unknown>>
        break
      }
      case 'INVENTORY': {
        const data = await this.getInventoryReport(criteria, user)
        title = 'Reporte de Inventario y Stock'
        filenameBase = 'reporte_inventario'
        columns = [
          { key: 'sku', header: 'SKU', format: 'text' },
          { key: 'name', header: 'Producto', format: 'text' },
          { key: 'category', header: 'Categoría', format: 'text' },
          { key: 'stockTotal', header: 'Stock Total', format: 'number' },
          { key: 'normalPrice', header: 'Precio Venta', format: 'currency' },
          { key: 'inventoryValueAtSale', header: 'Valor Venta Total', format: 'currency' },
          { key: 'availabilityStatus', header: 'Disponibilidad', format: 'text' },
        ]
        if (this.hasPermission('reports.costs', user)) {
          columns.push(
            { key: 'unitCost', header: 'Costo Prom.', format: 'currency' },
            { key: 'inventoryValueAtCost', header: 'Valor al Costo', format: 'currency' },
            { key: 'grossMarginPercent', header: 'Margen (%)', format: 'percent' }
          )
        }
        rows = data.rows as unknown as Array<Record<string, unknown>>
        break
      }
      case 'COSTS': {
        const data = await this.getCostsReport(criteria, user)
        title = 'Reporte Confidencial de Costos y Utilidad'
        filenameBase = 'reporte_costos_utilidad'
        columns = [
          { key: 'sku', header: 'SKU', format: 'text' },
          { key: 'name', header: 'Producto', format: 'text' },
          { key: 'category', header: 'Categoría', format: 'text' },
          { key: 'unitsSold', header: 'Unidades Vendidas', format: 'number' },
          { key: 'totalRevenue', header: 'Ingresos Totales', format: 'currency' },
          { key: 'totalCostOfGoodsSold', header: 'Costo Ventas (CMV)', format: 'currency' },
          { key: 'grossProfit', header: 'Utilidad Bruta', format: 'currency' },
          { key: 'grossMarginPercent', header: 'Margen (%)', format: 'percent' },
        ]
        rows = data.rows as unknown as Array<Record<string, unknown>>
        break
      }
      default: {
        const data = await this.getSalesReport(criteria, user)
        title = `Reporte_${reportType}`
        filenameBase = `reporte_${reportType.toLowerCase()}`
        columns = [
          { key: 'invoiceNumber', header: 'Documento', format: 'text' },
          { key: 'date', header: 'Fecha', format: 'date' },
          { key: 'customerName', header: 'Cliente', format: 'text' },
          { key: 'total', header: 'Total', format: 'currency' },
        ]
        rows = data.rows as unknown as Array<Record<string, unknown>>
      }
    }

    reportExportService.exportReport({
      format,
      title,
      filenameBase,
      columns,
      rows,
    })

    await auditService.log({
      action: 'REPORT_EXPORTED',
      module: 'REPORTS',
      entityType: 'REPORT_EXPORT',
      entityId: reportType,
      entityReference: title,
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      locationId: user.locationId,
      level: 'INFO',
      details: `Exportación de "${title}" realizada en formato ${format} con ${rows.length} registros por ${user.name}.`,
    })
  }

  /**
   * Opciones para selectores en filtros
   */
  async getFilterOptions() {
    const [locations, categories, brands, users] = await Promise.all([
      reportRepository.getLocations(),
      reportRepository.getCategories(),
      reportRepository.getBrands(),
      reportRepository.getUsers(),
    ])

    return {
      locations: [
        { value: 'ALL', label: 'Todas las bodegas' },
        ...locations.map((l) => ({ value: l.id, label: l.name, code: l.code })),
      ],
      categories: [
        { value: 'ALL', label: 'Todas las categorías' },
        ...categories.map((c) => ({ value: c, label: c })),
      ],
      brands: [
        { value: 'ALL', label: 'Todas las marcas' },
        ...brands.map((b) => ({ value: b, label: b })),
      ],
      users: [
        { value: 'ALL', label: 'Todos los vendedores' },
        ...users.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` })),
      ],
      periods: [
        { value: 'TODAY', label: 'Hoy' },
        { value: 'YESTERDAY', label: 'Ayer' },
        { value: 'THIS_WEEK', label: 'Esta semana' },
        { value: 'THIS_MONTH', label: 'Este mes' },
        { value: 'LAST_MONTH', label: 'Mes anterior' },
        { value: 'THIS_QUARTER', label: 'Este trimestre' },
        { value: 'THIS_YEAR', label: 'Este año' },
        { value: 'ALL_TIME', label: 'Histórico completo' },
      ],
    }
  }
}

export const reportService = new ReportService()
