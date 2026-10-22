'use client'

import { HrRouteShell } from '@/features/hr/components/shared/HrRouteShell'
import { HrDashboardPage } from '@/features/hr/components/dashboard/HrDashboardPage'

export default function PanelRrhhRoutePage() {
  return (
    <HrRouteShell section="Panel de RRHH">
      <HrDashboardPage />
    </HrRouteShell>
  )
}
