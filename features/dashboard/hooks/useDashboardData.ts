'use client'

import { useState, useEffect, useCallback } from 'react'
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
  DateRange,
} from '../types'
import { dashboardService } from '../services/dashboard.service'
import { mockUserProfiles } from '../mocks/dashboard.mock'

export function useDashboardData() {
  const [currentUser, setCurrentUser] = useState<UserProfile>(mockUserProfiles[0])
  const [period, setPeriod] = useState<PeriodType>('TODAY')
  const [customRange, setCustomRange] = useState<DateRange>({
    startDate: '2026-08-01',
    endDate: '2026-08-31',
  })

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [chartPoints, setChartPoints] = useState<SalesChartPoint[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseDashboardCard[]>([])
  const [topProducts, setTopProducts] = useState<TopProductItem[]>([])
  const [distribution, setDistribution] = useState<InventoryDistributionItem[]>([])
  const [quickActions, setQuickActions] = useState<QuickActionItem[]>([])
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([])
  const [loginAudits, setLoginAudits] = useState<LoginAuditItem[]>([])
  const [pendingAttention, setPendingAttention] = useState<PendingAttentionItem[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      setError(null)
      const [
        metricsData,
        chartData,
        whData,
        prodData,
        distData,
        actData,
        auditData,
        attData,
      ] = await Promise.all([
        dashboardService.getDashboardMetrics(period, currentUser),
        dashboardService.getSalesChart(period, currentUser),
        dashboardService.getWarehouseSummaries(currentUser),
        dashboardService.getTopProducts(period, currentUser),
        dashboardService.getInventoryDistribution(currentUser),
        dashboardService.getActivityFeed(currentUser, 8),
        dashboardService.getLoginAudits(currentUser, 10),
        dashboardService.getPendingAttention(currentUser),
      ])

      setMetrics(metricsData)
      setChartPoints(chartData)
      setWarehouses(whData)
      setTopProducts(prodData)
      setDistribution(distData)
      setActivityFeed(actData)
      setLoginAudits(auditData)
      setPendingAttention(attData)
      setQuickActions(dashboardService.getQuickActions(currentUser))
    } catch (err: any) {
      setError(err?.message || 'Error al cargar los datos del dashboard')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [period, currentUser, customRange])

  useEffect(() => {
    setIsLoading(true)
    loadData()
  }, [loadData])

  const refreshData = () => {
    setIsRefreshing(true)
    loadData()
  }

  const changeUser = (userId: string) => {
    const found = mockUserProfiles.find((u) => u.id === userId)
    if (found) {
      setCurrentUser(found)
    }
  }

  const handleCustomRangeChange = (range: DateRange) => {
    setCustomRange(range)
    setPeriod('CUSTOM')
  }

  return {
    currentUser,
    setCurrentUser,
    changeUser,
    availableProfiles: mockUserProfiles,
    period,
    setPeriod,
    customRange,
    setCustomRange: handleCustomRangeChange,
    metrics,
    chartPoints,
    warehouses,
    topProducts,
    distribution,
    quickActions,
    activityFeed,
    loginAudits,
    pendingAttention,
    isLoading,
    isRefreshing,
    error,
    refreshData,
  }
}
