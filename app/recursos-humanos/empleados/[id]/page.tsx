'use client'

import { Suspense, use } from 'react'
import { HrRouteShell } from '@/features/hr/components/shared/HrRouteShell'
import { EmployeeProfilePage } from '@/features/hr/components/profile/EmployeeProfilePage'
import { HR_ROUTES } from '@/features/hr/constants'

export default function EmpleadoFichaRoutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <HrRouteShell section="Ficha del empleado" parent={{ label: 'Empleados', href: HR_ROUTES.employees }}>
      <Suspense fallback={null}>
        <EmployeeProfilePage employeeId={id} />
      </Suspense>
    </HrRouteShell>
  )
}
