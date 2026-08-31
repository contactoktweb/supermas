'use client'

import React from 'react'
import { useDashboardData } from '../hooks/useDashboardData'
import { DashboardHeader } from './DashboardHeader'
import { DashboardStatsGrid } from './DashboardStatsGrid'
import { DashboardQuickActions } from './DashboardQuickActions'
import { DashboardChartsSection } from './DashboardChartsSection'
import { DashboardWarehousesSummary } from './DashboardWarehousesSummary'
import { DashboardAttentionSection } from './DashboardAttentionSection'
import { DashboardTopProducts } from './DashboardTopProducts'
import { DashboardActivityFeed } from './DashboardActivityFeed'
import { DashboardLoginAudit } from './DashboardLoginAudit'
import { DashboardSkeleton } from './DashboardSkeleton'
import { DashboardErrorState } from './DashboardErrorState'

interface DashboardViewProps {
  onNavigate?: (viewName: string, entityId?: string) => void
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const {
    currentUser,
    changeUser,
    availableProfiles,
    period,
    setPeriod,
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
  } = useDashboardData()

  const handleNavigate = (viewName: string, entityId?: string) => {
    if (onNavigate) {
      onNavigate(viewName, entityId)
    }
  }

  if (isLoading && !metrics) {
    return <DashboardSkeleton />
  }

  if (error && !metrics) {
    return <DashboardErrorState message={error} onRetry={refreshData} />
  }

  return (
    <div className="dashboard-master-shell">
      {/* 1. Header with dynamic greeting, role badge, last login & period switcher */}
      <DashboardHeader
        user={currentUser}
        period={period}
        onPeriodChange={setPeriod}
        onRefresh={refreshData}
        isRefreshing={isRefreshing}
        availableProfiles={availableProfiles}
        onUserChange={changeUser}
      />

      {/* 2. Key KPI Statistics Grid (Primary + Collapsible Secondary) */}
      {metrics && <DashboardStatsGrid metrics={metrics} user={currentUser} />}

      {/* 3. Quick Actions Matrix */}
      <DashboardQuickActions
        actions={quickActions}
        onSelectAction={(target) => handleNavigate(target)}
      />

      {/* 4. Interactive Charts Section (Ventas vs Compras + Distribución) */}
      <DashboardChartsSection
        chartPoints={chartPoints}
        distribution={distribution}
        period={period}
        user={currentUser}
      />

      {/* 5. Warehouses Status Cards Grid */}
      <DashboardWarehousesSummary
        warehouses={warehouses}
        user={currentUser}
        onSelectWarehouse={(id) => handleNavigate('Bodegas', id)}
        onViewAllWarehouses={() => handleNavigate('Bodegas')}
      />

      {/* 6. Operational Split Section: Attention Items + Top Products */}
      <div className="dashboard-grid bottom-grid">
        <DashboardAttentionSection
          items={pendingAttention}
          onSelectAction={(target) => handleNavigate(target)}
        />

        <DashboardTopProducts
          products={topProducts}
          onViewAllProducts={() => handleNavigate('Productos')}
        />
      </div>

      {/* 7. Live Real-time Operational Activity Feed */}
      <DashboardActivityFeed items={activityFeed} />

      {/* 8. System Access Security Audit Log */}
      <DashboardLoginAudit audits={loginAudits} user={currentUser} />
    </div>
  )
}
