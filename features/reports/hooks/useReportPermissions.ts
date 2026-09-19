'use client'

import { useMemo } from 'react'
import { reportService, DEFAULT_ANALYTICS_USER } from '../services/report.service'
import { UserReportContext, ReportPermission } from '../types'

export function useReportPermissions(user: UserReportContext = DEFAULT_ANALYTICS_USER) {
  const permissions = useMemo(() => {
    const has = (p: ReportPermission) => reportService.hasPermission(p, user)

    return {
      user,
      canRead: has('reports.read'),
      canSales: has('reports.sales'),
      canPurchases: has('reports.purchases'),
      canInventory: has('reports.inventory'),
      canCosts: has('reports.costs'),
      canCustomers: has('reports.customers'),
      canSuppliers: has('reports.suppliers'),
      canCash: has('reports.cash'),
      canBilling: has('reports.billing'),
      canAccounting: has('reports.accounting'),
      canExport: has('reports.export'),
      canFinancial: has('reports.financial'),
    }
  }, [user])

  return permissions
}
