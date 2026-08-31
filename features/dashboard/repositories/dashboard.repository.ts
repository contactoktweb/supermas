import {
  DashboardMetrics,
  SalesChartPoint,
  WarehouseDashboardCard,
  TopProductItem,
  InventoryDistributionItem,
  ActivityFeedItem,
  LoginAuditItem,
  PendingAttentionItem,
  PeriodType,
} from '../types'
import {
  mockMetricsByPeriod,
  mockSalesChartByPeriod,
  mockWarehouseCards,
  mockTopProducts,
  mockInventoryDistribution,
  mockActivityFeed,
  mockLoginAudits,
  mockPendingAttention,
} from '../mocks/dashboard.mock'

class DashboardRepository {
  private loginAudits: LoginAuditItem[] = [...mockLoginAudits]
  private activityFeed: ActivityFeedItem[] = [...mockActivityFeed]

  async getMetrics(period: PeriodType, locationId?: string): Promise<DashboardMetrics> {
    // Simulate DB query delay
    await new Promise((resolve) => setTimeout(resolve, 60))
    const base = mockMetricsByPeriod[period] || mockMetricsByPeriod.TODAY

    // If filtered by specific location, scale metrics proportionately
    if (locationId) {
      const loc = mockWarehouseCards.find((w) => w.id === locationId)
      if (loc) {
        const factor = loc.occupancyPct / 100
        return {
          ...base,
          todaySales: {
            ...base.todaySales,
            value: loc.todaySales,
            count: Math.round(base.todaySales.count * factor),
          },
          periodSales: {
            ...base.periodSales,
            value: Math.round(base.periodSales.value * factor),
            count: Math.round(base.periodSales.count * factor),
          },
          grossProfit: base.grossProfit
            ? {
                ...base.grossProfit,
                value: Math.round(base.grossProfit.value * factor),
              }
            : undefined,
          inventoryAtCost: base.inventoryAtCost
            ? {
                ...base.inventoryAtCost,
                value: loc.inventoryAtCost || 0,
              }
            : undefined,
        }
      }
    }

    return JSON.parse(JSON.stringify(base))
  }

  async getSalesChart(
    period: PeriodType,
    locationId?: string
  ): Promise<SalesChartPoint[]> {
    await new Promise((resolve) => setTimeout(resolve, 50))
    const points = mockSalesChartByPeriod[period] || mockSalesChartByPeriod.TODAY
    if (!locationId) return points

    const loc = mockWarehouseCards.find((w) => w.id === locationId)
    const factor = loc ? loc.occupancyPct / 100 : 1

    return points.map((pt) => ({
      ...pt,
      sales: Math.round(pt.sales * factor),
      purchases: Math.round(pt.purchases * factor),
      profit: pt.profit ? Math.round(pt.profit * factor) : undefined,
      transactions: Math.max(1, Math.round(pt.transactions * factor)),
    }))
  }

  async getWarehouseSummaries(): Promise<WarehouseDashboardCard[]> {
    await new Promise((resolve) => setTimeout(resolve, 40))
    return JSON.parse(JSON.stringify(mockWarehouseCards))
  }

  async getTopProducts(
    _period: PeriodType,
    _locationId?: string
  ): Promise<TopProductItem[]> {
    await new Promise((resolve) => setTimeout(resolve, 40))
    return JSON.parse(JSON.stringify(mockTopProducts))
  }

  async getInventoryDistribution(): Promise<InventoryDistributionItem[]> {
    await new Promise((resolve) => setTimeout(resolve, 30))
    return JSON.parse(JSON.stringify(mockInventoryDistribution))
  }

  async getActivityFeed(
    limit: number = 10,
    locationId?: string
  ): Promise<ActivityFeedItem[]> {
    await new Promise((resolve) => setTimeout(resolve, 40))
    let items = [...this.activityFeed]
    if (locationId) {
      const loc = mockWarehouseCards.find((w) => w.id === locationId)
      if (loc) {
        items = items.filter((i) => i.locationName.includes(loc.name))
      }
    }
    return items.slice(0, limit)
  }

  async getLoginAudits(limit: number = 20): Promise<LoginAuditItem[]> {
    await new Promise((resolve) => setTimeout(resolve, 40))
    return this.loginAudits.slice(0, limit)
  }

  async recordLoginAudit(
    entry: Omit<LoginAuditItem, 'id'>
  ): Promise<LoginAuditItem> {
    const newItem: LoginAuditItem = {
      ...entry,
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    }
    this.loginAudits.unshift(newItem)
    return newItem
  }

  async getPendingAttention(locationId?: string): Promise<PendingAttentionItem[]> {
    await new Promise((resolve) => setTimeout(resolve, 30))
    let items = [...mockPendingAttention]
    if (locationId) {
      items = items.filter(
        (it) => it.module === 'Inventario' || it.module === 'Logística'
      )
    }
    return items
  }
}

export const dashboardRepository = new DashboardRepository()
