'use client'

import { useCallback } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { HrEmptyState, HrErrorBanner } from '../shared/HrStates'
import { useHrQuery } from '../../hooks/useHrQuery'
import { useHrCatalogs } from '../../hooks/useHrCatalogs'
import { hrEmployeeService } from '../../services/hr-employee.service'
import {
  CONTRACT_TYPE_LABELS,
  EVENT_TYPE_ICONS,
  EVENT_TYPE_LABELS,
  SALARY_TYPE_LABELS,
  TERMINATION_CAUSE_LABELS,
  WORK_SCHEDULE_LABELS,
} from '../../constants'
import { formatCOP, formatDate, formatDateTime } from '../../utils/hr-format'
import type { ContractType, Employee, SalaryType, WorkSchedule } from '../../types'

const FIELD_LABELS: Record<string, string> = {
  position_id: 'Cargo',
  area_id: 'Área',
  location_id: 'Sede',
  manager_employee_id: 'Jefe inmediato',
  salary: 'Salario',
  salary_type: 'Tipo de salario',
  contract_type: 'Contrato',
  contract_end_date: 'Fin del contrato',
  work_schedule: 'Jornada',
  weekly_hours: 'Horas semanales',
  hire_date: 'Fecha de ingreso',
  status: 'Estado',
  vacation_days_compensated: 'Días de vacaciones compensados',
  compensation_reason: 'Motivo de la compensación',
}

/** Historial laboral inmutable (ingresos, cambios, retiros y reingresos). */
export function EmployeeHistoryTab({ employee }: { employee: Employee }) {
  const loader = useCallback(() => hrEmployeeService.listEvents(employee.id), [employee.id])
  const { data, isLoading, error, reload } = useHrQuery(loader)
  const { catalogs } = useHrCatalogs()

  const formatValue = (key: string, value: unknown): string => {
    if (value === null || value === undefined || value === '') return 'Sin definir'
    const text = String(value)
    switch (key) {
      case 'position_id':
        return catalogs.positions.find((p) => p.id === text)?.name ?? 'Cargo'
      case 'area_id':
        return catalogs.areas.find((a) => a.id === text)?.name ?? 'Área'
      case 'location_id':
        return catalogs.locations.find((l) => l.id === text)?.name ?? 'Sede'
      case 'manager_employee_id':
        return 'Asignado'
      case 'salary':
        return formatCOP(Number(value))
      case 'salary_type':
        return SALARY_TYPE_LABELS[text as SalaryType] ?? text
      case 'contract_type':
        return CONTRACT_TYPE_LABELS[text as ContractType] ?? text
      case 'work_schedule':
        return WORK_SCHEDULE_LABELS[text as WorkSchedule] ?? text
      case 'contract_end_date':
      case 'hire_date':
        return formatDate(text)
      default:
        return text
    }
  }

  const events = data ?? []

  return (
    <section className="panel page-enter" aria-labelledby="hr-history-title">
      <div className="panel-heading mb-4">
        <h3 id="hr-history-title" className="m-0 text-[14px] font-bold">
          Historial laboral
        </h3>
        <p>Registro inmutable de ingresos, cambios y retiros.</p>
      </div>
      {error && <HrErrorBanner message={error} onRetry={() => void reload()} />}
      {isLoading ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-slate-100 motion-safe:animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <HrEmptyState icon="history" title="Sin movimientos" description="El historial se genera automáticamente con el ingreso del empleado." />
      ) : (
        <ol className="m-0 flex list-none flex-col gap-0 p-0">
          {events.map((event, index) => {
            const keys = Array.from(new Set([...Object.keys(event.newValues), ...Object.keys(event.previousValues)])).filter(
              (key) => FIELD_LABELS[key] && (event.eventType === 'INGRESO' ? event.newValues[key] !== null : true)
            )
            return (
              <li key={event.id} className="timeline-item relative flex gap-3 pb-5" style={{ animationDelay: `${index * 0.04}s` }}>
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${event.eventType === 'RETIRO' ? 'bg-red-50 text-[var(--red)]' : 'bg-[#e9eef8] text-[var(--navy)]'}`}
                  aria-hidden="true"
                >
                  <AppIcon name={EVENT_TYPE_ICONS[event.eventType]} size={16} />
                </span>
                <div className="min-w-0 flex-1 border-b border-[var(--line)] pb-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <strong className="text-[13px]">{EVENT_TYPE_LABELS[event.eventType]}</strong>
                    <span className="text-[11px] text-[var(--muted)]">Efectivo {formatDate(event.effectiveDate)}</span>
                  </div>
                  {event.terminationCause && <p className="m-0 mt-1 text-xs">Causa: {TERMINATION_CAUSE_LABELS[event.terminationCause]}</p>}
                  {keys.length > 0 && (
                    <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-xs">
                      {keys.map((key) => (
                        <li key={key} className="flex flex-wrap gap-1">
                          <span className="text-[var(--muted)]">{FIELD_LABELS[key]}:</span>
                          {key in event.previousValues && event.eventType !== 'INGRESO' && (
                            <>
                              <span className="line-through opacity-70">{formatValue(key, event.previousValues[key])}</span>
                              <AppIcon name="arrowRight" size={12} />
                            </>
                          )}
                          <strong>{formatValue(key, event.newValues[key])}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                  {event.reason && <p className="m-0 mt-2 text-xs text-[var(--muted)]">Motivo: {event.reason}</p>}
                  <small className="mt-1 block text-[10px] text-[var(--muted)]">
                    {event.createdByName} • {formatDateTime(event.createdAt)}
                  </small>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
