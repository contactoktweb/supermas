'use client'

import React from 'react'
import { ReportsHubPage } from './ReportsHubPage'
import { ReportType } from '../types'
import { AppShell } from '@/components/navigation/AppShell'

interface ReportRouteShellProps {
  reportType?: ReportType
  breadcrumbSubTitle?: string
}

export function ReportRouteShell({
  reportType = 'OVERVIEW',
  breadcrumbSubTitle,
}: ReportRouteShellProps) {
  const breadcrumbs = breadcrumbSubTitle
    ? [
        { label: 'Inicio', href: '/' },
        { label: 'Reportes', href: '/reportes' },
        { label: breadcrumbSubTitle },
      ]
    : undefined

  return (
    <AppShell breadcrumbs={breadcrumbs} mainClassName="dashboard-content p-0">
      <ReportsHubPage initialReportType={reportType} />
    </AppShell>
  )
}
