'use client'

import { HrRouteShell } from '@/features/hr/components/shared/HrRouteShell'
import { OrgStructurePage } from '@/features/hr/components/structure/OrgStructurePage'

export default function EstructuraRoutePage() {
  return (
    <HrRouteShell section="Áreas y cargos">
      <OrgStructurePage />
    </HrRouteShell>
  )
}
