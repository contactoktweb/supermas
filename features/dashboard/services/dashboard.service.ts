import {
  UserProfile,
  DashboardMetrics,
  SalesChartPoint,
  WarehouseDashboardCard,
  TopProductItem,
  InventoryDistributionItem,
  QuickActionItem,
  ActivityFeedItem,
  LoginAuditItem,
  PendingAttentionItem,
  PeriodType,
  UserRole,
} from '../types'
import { dashboardRepository } from '../repositories/dashboard.repository'
import { mockQuickActions } from '../mocks/dashboard.mock'

export class DashboardService {
  /**
   * Evaluates if a given role has permissions to view costs and financial profit
   */
  hasFinancialAccess(role: UserRole): boolean {
    return ['SUPERADMIN', 'ADMIN', 'ACCOUNTANT'].includes(role)
  }

  /**
   * Evaluates if a role can view the Login Audit log
   */
  hasAuditAccess(role: UserRole): boolean {
    return ['SUPERADMIN', 'ADMIN'].includes(role)
  }

  /**
   * Evaluates specific user permissions
   */
  getUserPermissions(role: UserRole): Set<string> {
    const permissions = new Set<string>()

    // Common permissions
    permissions.add('sale.read')
    permissions.add('product.read')
    permissions.add('inventory.read')
    permissions.add('alert.read')

    switch (role) {
      case 'SUPERADMIN':
      case 'ADMIN':
        permissions.add('sale.create')
        permissions.add('purchase.create')
        permissions.add('purchase.read')
        permissions.add('inventory.transfer')
        permissions.add('inventory.adjust')
        permissions.add('product.create')
        permissions.add('product.write')
        permissions.add('cost.read')
        permissions.add('financial.read')
        permissions.add('invoice.read')
        permissions.add('invoice.create')
        permissions.add('supplier.create')
        permissions.add('supplier.read')
        permissions.add('customer.create')
        permissions.add('customer.read')
        permissions.add('ecommerce.manage')
        permissions.add('audit.read')
        permissions.add('user.manage')
        break

      case 'WAREHOUSE_ADMIN':
        permissions.add('inventory.transfer')
        permissions.add('inventory.adjust')
        permissions.add('purchase.read')
        permissions.add('product.write')
        permissions.add('cost.read')
        permissions.add('supplier.read')
        break

      case 'POINT_ADMIN':
        permissions.add('sale.create')
        permissions.add('inventory.transfer')
        permissions.add('customer.create')
        permissions.add('customer.read')
        permissions.add('invoice.read')
        permissions.add('invoice.create')
        break

      case 'SELLER':
        permissions.add('sale.create')
        permissions.add('customer.create')
        permissions.add('customer.read')
        break

      case 'ACCOUNTANT':
        permissions.add('cost.read')
        permissions.add('financial.read')
        permissions.add('invoice.read')
        permissions.add('purchase.read')
        permissions.add('audit.read')
        break
    }

    return permissions
  }

  /**
   * Get consolidated dashboard metrics with RBAC redaction
   */
  async getDashboardMetrics(
    period: PeriodType,
    user: UserProfile
  ): Promise<DashboardMetrics> {
    const rawMetrics = await dashboardRepository.getMetrics(period, user.locationId)
    const canSeeFinancials = this.hasFinancialAccess(user.role)

    if (!canSeeFinancials) {
      return {
        ...rawMetrics,
        grossProfit: undefined,
        inventoryAtCost: undefined,
        purchases: undefined,
        accountsPayable: undefined,
        isFinancialRedacted: true,
      }
    }

    return {
      ...rawMetrics,
      isFinancialRedacted: false,
    }
  }

  /**
   * Get sales chart points with RBAC redaction
   */
  async getSalesChart(
    period: PeriodType,
    user: UserProfile
  ): Promise<SalesChartPoint[]> {
    const rawPoints = await dashboardRepository.getSalesChart(period, user.locationId)
    const canSeeFinancials = this.hasFinancialAccess(user.role)

    if (!canSeeFinancials) {
      return rawPoints.map((p) => ({
        label: p.label,
        sales: p.sales,
        purchases: 0,
        transactions: p.transactions,
      }))
    }

    return rawPoints
  }

  /**
   * Get warehouse summaries filtered and sanitized by role
   */
  async getWarehouseSummaries(
    user: UserProfile
  ): Promise<WarehouseDashboardCard[]> {
    const list = await dashboardRepository.getWarehouseSummaries()
    const canSeeCosts = this.hasFinancialAccess(user.role)

    let filtered = list
    // If the user is assigned to a specific store/warehouse point, keep it prioritized
    if (user.locationId && user.role !== 'SUPERADMIN' && user.role !== 'ADMIN') {
      filtered = list.filter((w) => w.id === user.locationId)
    }

    return filtered.map((item) => ({
      ...item,
      inventoryAtCost: canSeeCosts ? item.inventoryAtCost : undefined,
    }))
  }

  /**
   * Get inventory distribution with cost protection
   */
  async getInventoryDistribution(
    user: UserProfile
  ): Promise<InventoryDistributionItem[]> {
    const list = await dashboardRepository.getInventoryDistribution()
    const canSeeCosts = this.hasFinancialAccess(user.role)

    return list.map((item) => ({
      ...item,
      value: canSeeCosts ? item.value : undefined,
    }))
  }

  /**
   * Get available quick actions filtered by user permissions
   */
  getQuickActions(user: UserProfile): QuickActionItem[] {
    const perms = this.getUserPermissions(user.role)
    return mockQuickActions.filter((qa) => perms.has(qa.requiredPermission))
  }

  /**
   * Get top products
   */
  async getTopProducts(
    period: PeriodType,
    user: UserProfile
  ): Promise<TopProductItem[]> {
    return dashboardRepository.getTopProducts(period, user.locationId)
  }

  /**
   * Get activity feed
   */
  async getActivityFeed(
    user: UserProfile,
    limit: number = 10
  ): Promise<ActivityFeedItem[]> {
    return dashboardRepository.getActivityFeed(limit, user.locationId)
  }

  /**
   * Get login audit logs (only if authorized)
   */
  async getLoginAudits(user: UserProfile, limit: number = 20): Promise<LoginAuditItem[]> {
    if (!this.hasAuditAccess(user.role)) {
      return []
    }
    return dashboardRepository.getLoginAudits(limit)
  }

  /**
   * Get actionable attention items
   */
  async getPendingAttention(user: UserProfile): Promise<PendingAttentionItem[]> {
    return dashboardRepository.getPendingAttention(user.locationId)
  }

  /**
   * Computes dynamic greeting based on America/Bogota hour
   */
  getDynamicGreeting(date: Date = new Date()): string {
    // Bogota is UTC-5
    const bogotaHour = new Date(
      date.toLocaleString('en-US', { timeZone: 'America/Bogota' })
    ).getHours()

    if (bogotaHour >= 5 && bogotaHour < 12) {
      return 'Buenos días'
    } else if (bogotaHour >= 12 && bogotaHour < 18.5) {
      return 'Buenas tardes'
    } else {
      return 'Buenas noches'
    }
  }

  /**
   * Format ISO date in Colombia timezone (America/Bogota)
   */
  formatDateTime(isoString: string, includeSeconds: boolean = false): string {
    try {
      const d = new Date(isoString)
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'America/Bogota',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }
      if (includeSeconds) {
        options.second = '2-digit'
      }
      return new Intl.DateTimeFormat('es-CO', options).format(d)
    } catch {
      return isoString
    }
  }

  /**
   * Currency formatter in Colombian Pesos
   */
  formatCOP(amount: number, compact: boolean = false): string {
    if (compact) {
      if (amount >= 1_000_000_000) {
        return `$${(amount / 1_000_000_000).toFixed(2)}B`
      }
      if (amount >= 1_000_000) {
        return `$${(amount / 1_000_000).toFixed(2)}M`
      }
      if (amount >= 1_000) {
        return `$${(amount / 1_000).toFixed(0)}K`
      }
    }
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(amount)
  }
}

export const dashboardService = new DashboardService()
