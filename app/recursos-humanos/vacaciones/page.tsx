'use client'

import { HrRouteShell } from '@/features/hr/components/shared/HrRouteShell'
import { VacationsPage } from '@/features/hr/components/vacations/VacationsPage'

export default function VacacionesRoutePage() {
  return (
    <HrRouteShell section="Vacaciones">
      <VacationsPage />
    </HrRouteShell>
  )
}
