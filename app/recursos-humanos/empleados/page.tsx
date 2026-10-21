'use client'

import { HrRouteShell } from '@/features/hr/components/shared/HrRouteShell'
import { EmployeesPage } from '@/features/hr/components/employees/EmployeesPage'

export default function EmpleadosRoutePage() {
  return (
    <HrRouteShell section="Empleados">
      <EmployeesPage />
    </HrRouteShell>
  )
}
