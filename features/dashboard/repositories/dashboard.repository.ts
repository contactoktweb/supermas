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
import { productRepository } from '@/features/products/repositories/product.repository'
import { warehouseRepository } from '@/features/warehouses/repositories/warehouse.repository'
import { transferRepository } from '@/features/transfers/repositories/transfer.repository'
import { db } from '@/lib/supabase'

class DashboardRepository {
  private loginAudits: LoginAuditItem[] = [
    {
      id: 'log-sys-01',
      userId: 'usr-admin-001',
      userName: 'Mauricio Andrade',
      userEmail: 'admin@supermas.com.co',
      roleSnapshot: 'SUPERADMIN',
      locationName: 'Consolidado General',
      loginAt: new Date().toISOString(),
      status: 'SUCCESS',
      ipAddress: '190.85.122.45',
      userAgent: 'Chrome 128 / macOS',
      browser: 'Chrome 128',
      os: 'macOS',
      sessionId: 'sess-001',
    },
  ]
  private activityFeed: ActivityFeedItem[] = []

  async getMetrics(period: PeriodType, _locationId?: string): Promise<DashboardMetrics> {
    await new Promise((resolve) => setTimeout(resolve, 30))

    // Consultar estados reales desde los repositorios
    const productStats = await productRepository.getGlobalStats()
    const transferStats = await transferRepository.getGlobalStats()

    // Para una base de datos limpia sin ventas registradas
    const totalSales = db.sales.length
    const todaySalesCount = db.sales.filter((s: any) =>
      s.date?.startsWith(new Date().toISOString().slice(0, 10))
    ).length

    return {
      period,
      todaySales: {
        value: 0,
        deltaYesterdayPct: 0,
        count: todaySalesCount,
        ticketAverage: 0,
      },
      periodSales: {
        value: 0,
        deltaPct: 0,
        count: totalSales,
      },
      grossProfit: {
        value: 0,
        marginPct: 0,
        deltaPct: 0,
      },
      inventoryAtCost: {
        value: productStats.totalInventoryValueAtCost,
        deltaPct: 0,
      },
      purchases: {
        value: 0,
        count: db.purchases.length,
        deltaPct: 0,
      },
      accountsPayable: {
        pendingBalance: 0,
        dueSoonCount: 0,
        overdueCount: 0,
      },
      productsCount: {
        total: productStats.totalProducts,
        active: productStats.activeProducts,
        lowStock: productStats.lowStockProducts,
        critical: 0,
        outOfStock: productStats.outOfStockProducts,
      },
      pendingTransfers: {
        total: (transferStats.pendingCount || 0) + (transferStats.inTransitCount || 0),
        inTransit: transferStats.inTransitCount || 0,
        pending: transferStats.pendingCount || 0,
      },
      webOrders: {
        totalToday: db.webOrders.length,
        newOrders: 0,
        preparing: 0,
        ready: 0,
      },
      activeAlerts: {
        inventory: 0,
        purchases: 0,
        billing: 0,
        system: 0,
        total: 0,
      },
      cashRegisters: {
        openCount: 0,
        currentCash: 0,
        turnSales: 0,
      },
      isFinancialRedacted: false,
    }
  }

  async getSalesChart(
    _period: PeriodType,
    _locationId?: string
  ): Promise<SalesChartPoint[]> {
    await new Promise((resolve) => setTimeout(resolve, 20))
    // Sin ventas en instalación limpia -> Arreglo vacío de puntos para activar Empty State
    return []
  }

  async getWarehouseSummaries(): Promise<WarehouseDashboardCard[]> {
    await new Promise((resolve) => setTimeout(resolve, 20))
    const { data: locations } = await warehouseRepository.findAll()
    return locations.map((loc) => ({
      id: loc.id,
      name: loc.name,
      code: loc.code,
      city: loc.city || 'Medellín',
      type: loc.type,
      status: loc.status,
      inventoryAtCost: loc.inventoryValueAtCost || 0,
      inventoryUnits: loc.availableUnits || 0,
      todaySales: loc.todaySalesAmount || 0,
      totalProducts: loc.productsCount || 0,
      lowStockCount: loc.lowStockProductsCount || 0,
      outOfStockCount: loc.outOfStockProductsCount || 0,
      pendingTransfersCount: loc.pendingTransfersCount || 0,
      occupancyPct: 0,
      isEcommerce: loc.settings?.isEcommerceProcessingSource || false,
    }))
  }

  async getTopProducts(
    _period: PeriodType,
    _locationId?: string
  ): Promise<TopProductItem[]> {
    await new Promise((resolve) => setTimeout(resolve, 20))
    // Cero productos vendidos en instalación limpia
    return []
  }

  async getInventoryDistribution(): Promise<InventoryDistributionItem[]> {
    await new Promise((resolve) => setTimeout(resolve, 20))
    // Cero existencias de inventario en instalación limpia
    return []
  }

  async getActivityFeed(
    limit: number = 10,
    _locationId?: string
  ): Promise<ActivityFeedItem[]> {
    await new Promise((resolve) => setTimeout(resolve, 20))
    return [...this.activityFeed].slice(0, limit)
  }

  async getLoginAudits(limit: number = 20): Promise<LoginAuditItem[]> {
    await new Promise((resolve) => setTimeout(resolve, 20))
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

  async getPendingAttention(_locationId?: string): Promise<PendingAttentionItem[]> {
    await new Promise((resolve) => setTimeout(resolve, 20))
    // Sin alertas iniciales en instalación limpia
    return []
  }
}

export const dashboardRepository = new DashboardRepository()
