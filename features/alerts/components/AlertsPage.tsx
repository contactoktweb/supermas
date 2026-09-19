'use client'

import React from 'react'
import { useAlerts } from '../hooks/useAlerts'
import { AlertsHeader } from './AlertsHeader'
import { AlertsStats } from './AlertsStats'
import { AlertsFilters } from './AlertsFilters'
import { AlertsTable } from './AlertsTable'
import { AlertDetailDrawer } from './drawers/AlertDetailDrawer'
import { AlertRulesModal } from './modals/AlertRulesModal'
import { AlertSkeleton } from './AlertSkeleton'
import { AlertToast } from './AlertToast'
import { UserAlertContext } from '../types'
import { DEFAULT_ALERT_USER } from '../services/alert.service'

interface AlertsPageProps {
  userContext?: UserAlertContext
}

export function AlertsPage({ userContext = DEFAULT_ALERT_USER }: AlertsPageProps) {
  const {
    alerts,
    total,
    stats,
    rules,
    filters,
    isLoading,
    isScanning,
    selectedAlert,
    isDrawerOpen,
    isRulesModalOpen,
    toast,
    setFilter,
    resetFilters,
    markAsRead,
    markAllAsRead,
    attendAlert,
    resolveAlert,
    closeAlert,
    scanSystem,
    updateRuleConfig,
    openAlertDetail,
    setIsDrawerOpen,
    setIsRulesModalOpen,
    setToast,
  } = useAlerts(userContext)

  return (
    <div className="space-y-6 page-enter pb-10">
      {/* 1. Header with single h1 */}
      <AlertsHeader
        onScan={scanSystem}
        onMarkAllAsRead={markAllAsRead}
        onOpenRules={() => setIsRulesModalOpen(true)}
        isScanning={isScanning}
        unreadCount={stats?.totalNew ?? 0}
      />

      {/* 2. Stats and KPI Breakdown */}
      <AlertsStats
        stats={stats}
        activeModule={filters.module || 'ALL'}
        onSelectModule={(mod) => setFilter('module', mod)}
        onFilterCritical={() => {
          setFilter('onlyCritical', true)
          setFilter('priority', 'CRITICA')
        }}
        onFilterNew={() => {
          setFilter('status', 'NEW')
        }}
      />

      {/* 3. Filters Bar */}
      <AlertsFilters filters={filters} onFilterChange={setFilter} onReset={resetFilters} />

      {/* 4. Table or Loading Skeleton */}
      {isLoading ? (
        <AlertSkeleton />
      ) : (
        <AlertsTable
          alerts={alerts}
          total={total}
          page={filters.page || 1}
          pageSize={filters.pageSize || 15}
          onPageChange={(p) => setFilter('page', p)}
          onSelectAlert={openAlertDetail}
          onMarkRead={markAsRead}
        />
      )}

      {/* 5. Alert Detail Slide-out Drawer */}
      <AlertDetailDrawer
        alert={selectedAlert}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onAttend={attendAlert}
        onResolve={resolveAlert}
        onCloseAlert={closeAlert}
      />

      {/* 6. Rules Configuration Modal */}
      <AlertRulesModal
        rules={rules}
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
        onUpdateRule={updateRuleConfig}
      />

      {/* 7. Toast Feedback */}
      <AlertToast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
