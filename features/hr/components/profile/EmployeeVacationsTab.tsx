'use client'

import { useCallback, useMemo, useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { HrBadge } from '../shared/HrBadge'
import { HrEmptyState, HrErrorBanner, HrTableSkeleton } from '../shared/HrStates'
import { VacationRequestListPanel } from '../vacations/VacationRequestListPanel'
import { VacationRequestModal } from '../vacations/VacationRequestModal'
import { useHrQuery } from '../../hooks/useHrQuery'
import { hrAbsenceService } from '../../services/hr-absence.service'
import {
  CONTRACTS_WITHOUT_VACATIONS,
  CONTRACT_TYPE_LABELS,
  HR_VACATION_DAYS_PER_YEAR,
  VACATION_PERIOD_STATUS_LABELS,
  VACATION_PERIOD_TONES,
} from '../../constants'
import { diffDaysIso, formatDate, formatDays, todayIso } from '../../utils/hr-format'
import type { HrNotify } from '../../hooks/useHrToasts'
import type { Employee } from '../../types'

const CRITICAL_THRESHOLD_DAYS = 90

interface EmployeeVacationsTabProps {
  employee: Employee
  canManage: boolean
  notify: HrNotify
  onEmployeeChanged: () => void
}

/**
 * Causación (15 días hábiles por año, Art. 186 CST), saldo por periodo y solicitudes.
 * Política de la empresa: todas las vacaciones causadas deben disfrutarse.
 */
export function EmployeeVacationsTab({ employee, canManage, notify, onEmployeeChanged }: EmployeeVacationsTabProps) {
  const [isRequesting, setIsRequesting] = useState(false)
  const hasVacations = !CONTRACTS_WITHOUT_VACATIONS.includes(employee.contractType)

  const loader = useCallback(
    () =>
      Promise.all([
        hrAbsenceService.listPeriods(employee.id, employee.hireDate),
        hrAbsenceService.listVacationRequests({ employeeId: employee.id }),
      ]),
    [employee.id, employee.hireDate]
  )
  const { data, isLoading, error, reload } = useHrQuery(loader)
  const periods = useMemo(() => data?.[0] ?? [], [data])
  const requests = data?.[1] ?? []

  const summary = useMemo(() => {
    const current = periods.filter((p) => p.isCurrentEmployment)
    const pendingPeriods = current.filter((p) => p.status === 'CAUSADO')
    const inProgress = current.find((p) => !p.isComplete)
    const available = current.reduce((sum, p) => sum + p.balance, 0)
    const pendingCommitted = requests.filter((r) => r.status === 'PENDIENTE').reduce((sum, r) => sum + r.businessDays, 0)
    const daysToNext = inProgress ? diffDaysIso(todayIso(), inProgress.periodEnd) : null
    const isCritical = pendingPeriods.length >= 2 || (pendingPeriods.length === 1 && daysToNext !== null && daysToNext <= CRITICAL_THRESHOLD_DAYS)
    return { pendingPeriods, inProgress, available: Math.round(available * 100) / 100, pendingCommitted, daysToNext, isCritical }
  }, [periods, requests])

  const handleChanged = () => {
    void reload()
    onEmployeeChanged()
  }

  if (!hasVacations) {
    return (
      <section className="panel">
        <HrEmptyState
          icon="vacation"
          title="Sin causación de vacaciones"
          description={`El contrato de ${CONTRACT_TYPE_LABELS[employee.contractType].toLowerCase()} no causa vacaciones en el ERP.`}
        />
      </section>
    )
  }

  const canRequest = canManage && employee.status !== 'RETIRADO'

  return (
    <section className="flex flex-col gap-4" aria-labelledby="hr-vacations-tab-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="hr-vacations-tab-title" className="m-0 text-[14px] font-bold">
          Vacaciones ({HR_VACATION_DAYS_PER_YEAR} días hábiles por año de servicio)
        </h3>
        {canRequest && (
          <button type="button" className="primary-button compact" onClick={() => setIsRequesting(true)}>
            <AppIcon name="vacation" size={14} />
            <span>Programar vacaciones</span>
          </button>
        )}
      </div>

      {error && <HrErrorBanner message={error} onRetry={() => void reload()} />}

      {!isLoading && summary.pendingPeriods.length > 0 && employee.status !== 'RETIRADO' && (
        <div
          className={`flex items-start gap-3 rounded-[10px] border p-3 text-xs ${summary.isCritical ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}
          role="alert"
        >
          <AppIcon name="warning" size={18} />
          <p className="m-0">
            {summary.pendingPeriods.length >= 2
              ? `Acumula ${summary.pendingPeriods.length} periodos causados sin disfrutar. `
              : 'Tiene un periodo causado sin disfrutar. '}
            {summary.isCritical && summary.pendingPeriods.length < 2 && summary.daysToNext !== null && `En ${summary.daysToNext} días completará el segundo periodo. `}
            La política de la empresa exige que todas las vacaciones se disfruten: prográmelas.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Saldo disponible', value: formatDays(summary.available), note: 'Días hábiles causados a hoy' },
          { label: 'Periodos vencidos', value: String(summary.pendingPeriods.length), note: 'Causados sin disfrutar' },
          {
            label: 'Periodo en curso',
            value: summary.inProgress ? formatDays(summary.inProgress.daysAccrued) : '—',
            note: summary.inProgress ? `Completa el ${formatDate(summary.inProgress.periodEnd)}` : 'Sin periodo en curso',
          },
        ].map((item) => (
          <article key={item.label} className="panel p-4!">
            <span className="text-[11px] font-semibold text-[var(--muted)]">{item.label}</span>
            <strong className="mt-1 block text-xl">{isLoading ? '—' : item.value}</strong>
            <small className="text-[11px] text-[var(--muted)]">{item.note}</small>
          </article>
        ))}
      </div>

      <div className="table-panel animated-table">
        <div className="table-scroll">
          <table className="min-w-[760px]!">
            <caption className="sr-only">Periodos de causación de vacaciones</caption>
            <thead>
              <tr>
                <th scope="col">Periodo</th>
                <th scope="col">Desde</th>
                <th scope="col">Hasta</th>
                <th scope="col">Causados</th>
                <th scope="col">Disfrutados</th>
                <th scope="col">Compensados</th>
                <th scope="col">Saldo</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <HrTableSkeleton columns={8} rows={3} />
              ) : periods.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <HrEmptyState icon="calendar" title="Sin periodos" description="Los periodos se generan desde la fecha de ingreso del empleado." />
                  </td>
                </tr>
              ) : (
                periods.map((p) => (
                  <tr key={p.id} className={p.isCurrentEmployment ? '' : 'opacity-60'}>
                    <td>
                      Periodo {p.periodNumber}
                      {!p.isCurrentEmployment && <small>Vínculo anterior</small>}
                    </td>
                    <td>{formatDate(p.periodStart)}</td>
                    <td>{formatDate(p.periodEnd)}</td>
                    <td>{p.daysAccrued}</td>
                    <td>{p.daysTaken}</td>
                    <td>{p.daysCompensated}</td>
                    <td className="font-bold text-[var(--foreground)]">{p.balance}</td>
                    <td>
                      <HrBadge tone={VACATION_PERIOD_TONES[p.status]}>{VACATION_PERIOD_STATUS_LABELS[p.status]}</HrBadge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <h3 className="m-0 text-[14px] font-bold">Solicitudes de vacaciones</h3>
      <VacationRequestListPanel
        title={`Solicitudes de vacaciones de ${employee.fullName}`}
        requests={requests}
        isLoading={isLoading}
        showEmployee={false}
        canManage={canManage}
        notify={notify}
        onChanged={handleChanged}
      />

      {isRequesting && (
        <VacationRequestModal
          employeeId={employee.id}
          employeeName={employee.fullName}
          availableDays={Math.max(summary.available - summary.pendingCommitted, 0)}
          onClose={() => setIsRequesting(false)}
          onSaved={() => {
            setIsRequesting(false)
            notify('success', 'Vacaciones programadas', 'La solicitud queda pendiente de aprobación.')
            void reload()
          }}
        />
      )}
    </section>
  )
}
