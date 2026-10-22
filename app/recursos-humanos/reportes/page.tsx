'use client'

import { HrRouteShell } from '@/features/hr/components/shared/HrRouteShell'
import { HrReportsPage } from '@/features/hr/components/reports/HrReportsPage'

export default function ReportesRrhhRoutePage() {
  return (
    <HrRouteShell section="Reportes de personal">
      <HrReportsPage />
    </HrRouteShell>
  )
}
