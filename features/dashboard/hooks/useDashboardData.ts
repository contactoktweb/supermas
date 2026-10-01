'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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
import { useAuth } from '@/features/auth'

export function useDashboardData() {
  const { user } = useAuth()

  const currentUser: UserProfile = useMemo(() => {
    if (!user) {
      return {
        id: '',
        name: 'Cargando...',
        email: '',
        role: 'SUPERADMIN',
        roleName: 'Superadministrador',
        locationName: 'Consolidado General',
        avatar: 'SM',
        lastLoginAt: new Date().toISOString(),
      }
    }
    return {
      id: user.id,
      name: user.fullName,
      email: user.email,
      role: (user.roleCode as any) || 'SUPERADMIN',
      roleName: user.roleName,
      locationId: user.locationIds[0],
      locationName:
        user.locationIds.length > 1
          ? `Múltiples Sedes (${user.locationIds.length})`
          : 'Sede Principal',
      avatar: user.avatar,
      lastLoginAt: user.lastLoginAt || new Date().toISOString(),
    }
  }, [user])

  const availableProfiles = useMemo(() => [currentUser], [currentUser])
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
    if (!currentUser.id) return

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
      console.error('Error al cargar datos del dashboard:', err)
      setError(err?.message || 'Error al cargar métricas del sistema')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [period, currentUser])

  useEffect(() => {
    loadData()
  }, [loadData])

  const refreshData = () => {
    setIsRefreshing(true)
    loadData()
  }

  const changeUser = (_userId: string) => {
    // En producción con Auth real el usuario se cambia iniciando sesión legítimamente
  }

  const handleCustomRangeChange = (range: DateRange) => {
    setCustomRange(range)
    setPeriod('CUSTOM')
  }

  return {
    currentUser,
    setCurrentUser: () => {},
    changeUser,
    availableProfiles,
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
