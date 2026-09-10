import { db } from '@/lib/supabase'
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
} from '../types'

export const mockUserProfiles: UserProfile[] = db.users as unknown as UserProfile[]
export const mockMetricsByPeriod: Record<PeriodType, DashboardMetrics> = db.dashboardMetrics.metricsByPeriod as unknown as Record<PeriodType, DashboardMetrics>
export const mockSalesChartByPeriod: Record<PeriodType, SalesChartPoint[]> = db.dashboardMetrics.salesChartByPeriod as unknown as Record<PeriodType, SalesChartPoint[]>
export const mockWarehouseCards: WarehouseDashboardCard[] = db.dashboardMetrics.warehouseCards as unknown as WarehouseDashboardCard[]
export const mockTopProducts: TopProductItem[] = db.dashboardMetrics.topProducts as unknown as TopProductItem[]
export const mockInventoryDistribution: InventoryDistributionItem[] = db.dashboardMetrics.inventoryDistribution as unknown as InventoryDistributionItem[]
export const mockQuickActions: QuickActionItem[] = db.dashboardMetrics.quickActions as unknown as QuickActionItem[]
export const mockActivityFeed: ActivityFeedItem[] = db.dashboardMetrics.activityFeed as unknown as ActivityFeedItem[]
export const mockLoginAudits: LoginAuditItem[] = db.dashboardMetrics.loginAudits as unknown as LoginAuditItem[]
export const mockPendingAttention: PendingAttentionItem[] = db.dashboardMetrics.pendingAttention as unknown as PendingAttentionItem[]
