'use client'

import { HrRouteShell } from '@/features/hr/components/shared/HrRouteShell'
import { NoveltiesPage } from '@/features/hr/components/novelties/NoveltiesPage'

export default function NovedadesRoutePage() {
  return (
    <HrRouteShell section="Novedades">
      <NoveltiesPage />
    </HrRouteShell>
  )
}
