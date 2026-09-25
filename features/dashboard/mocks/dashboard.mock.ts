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
export const mockWarehouseCards: WarehouseDashboardCard[] = []
export const mockTopProducts: TopProductItem[] = []
export const mockInventoryDistribution: InventoryDistributionItem[] = []
export const mockQuickActions: QuickActionItem[] = db.dashboardMetrics.quickActions as unknown as QuickActionItem[]
export const mockActivityFeed: ActivityFeedItem[] = []
export const mockLoginAudits: LoginAuditItem[] = []
export const mockPendingAttention: PendingAttentionItem[] = []
