'use client'

import { HrInfoGrid } from '../shared/HrInfoGrid'
import {
  CONTRACT_TYPE_LABELS,
  EMPLOYEE_STATUS_LABELS,
  SALARY_TYPE_LABELS,
  TERMINATION_CAUSE_LABELS,
  WORK_SCHEDULE_LABELS,
} from '../../constants'
import { formatCOP, formatDate, formatSeniority } from '../../utils/hr-format'
import type { Employee } from '../../types'

export function EmployeeLaborTab({ employee }: { employee: Employee }) {
  const isRetired = employee.status === 'RETIRADO'

  return (
    <div className="flex flex-col gap-4">
      <HrInfoGrid
        title="Cargo y ubicación"
        items={[
          { label: 'Cargo', value: employee.positionName },
          { label: 'Área', value: employee.areaName ?? 'Sin área' },
          { label: 'Sede', value: employee.locationName ?? 'Sin sede asignada' },
          { label: 'Jefe inmediato', value: employee.managerName ?? 'Sin jefe inmediato' },
          { label: 'Estado', value: EMPLOYEE_STATUS_LABELS[employee.status] },
        ]}
      />
      <HrInfoGrid
        title="Contrato y remuneración"
        items={[
          { label: 'Tipo de contrato', value: CONTRACT_TYPE_LABELS[employee.contractType] },
          { label: 'Fecha de ingreso', value: formatDate(employee.hireDate) },
          { label: 'Fin del contrato', value: employee.contractEndDate ? formatDate(employee.contractEndDate) : 'No aplica' },
          { label: 'Antigüedad', value: formatSeniority(employee.hireDate, employee.terminationDate ?? undefined) },
          { label: 'Salario mensual', value: formatCOP(employee.salary) },
          { label: 'Tipo de salario', value: SALARY_TYPE_LABELS[employee.salaryType] },
          { label: 'Jornada', value: WORK_SCHEDULE_LABELS[employee.workSchedule] },
          { label: 'Horas semanales', value: employee.weeklyHours },
        ]}
      />
      {isRetired && (
        <HrInfoGrid
          title="Retiro"
          items={[
            { label: 'Fecha de retiro', value: formatDate(employee.terminationDate) },
            { label: 'Causa', value: employee.terminationCause ? TERMINATION_CAUSE_LABELS[employee.terminationCause] : null },
            { label: 'Motivo', value: employee.terminationReason },
          ]}
        />
      )}
    </div>
  )
}
