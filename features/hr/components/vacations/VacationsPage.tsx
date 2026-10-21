'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect, type SelectOption } from '@/components/ui/CustomSelect'
import { ScrollableTabs } from '@/components/ui/ScrollableTabs'
import { HrPageHeader } from '../shared/HrPageHeader'
import { HrKpiCard } from '../shared/HrKpiCard'
import { HrBadge } from '../shared/HrBadge'
import { HrAccessDenied, HrEmptyState, HrErrorBanner, HrTableSkeleton } from '../shared/HrStates'
import { HrToastContainer } from '../shared/HrToastContainer'
import { HR_PAGE_CLASS } from '../shared/hr-ui'
import { VacationRequestListPanel } from './VacationRequestListPanel'
import { VacationRequestModal } from './VacationRequestModal'
import { useHrPermissions } from '../../hooks/useHrPermissions'
import { useHrQuery } from '../../hooks/useHrQuery'
import { useHrToasts } from '../../hooks/useHrToasts'
import { hrAbsenceService } from '../../services/hr-absence.service'
import { hrEmployeeService } from '../../services/hr-employee.service'
import {
  VACATION_ALERT_LABELS,
  VACATION_ALERT_TONES,
  VACATION_REQUEST_STATUS_LABELS,
  employeeProfilePath,
  toSelectOptions,
} from '../../constants'
import { formatDate, formatDays } from '../../utils/hr-format'
import type { VacationRequestStatus } from '../../types'

type VacationsTab = 'control' | 'requests'

const STATUS_OPTIONS: SelectOption[] = [{ value: 'ALL', label: 'Todos los estados' }, ...toSelectOptions(VACATION_REQUEST_STATUS_LABELS)]

/** Control de vacaciones: periodos vencidos, alertas críticas y solicitudes de toda la empresa. */
export function VacationsPage() {
  const permissions = useHrPermissions()
  const { toasts, notify, dismiss } = useHrToasts()
  const [tab, setTab] = useState<VacationsTab>('control')
  const [status, setStatus] = useState<VacationRequestStatus | 'ALL'>('PENDIENTE')
  const [isCreating, setIsCreating] = useState(false)

  const alertsLoader = useCallback(async () => {
    await hrEmployeeService.refresh()
    return hrAbsenceService.listVacationAlerts()
  }, [])
  const alerts = useHrQuery(alertsLoader, permissions.canRead)

  const requestsLoader = useCallback(() => hrAbsenceService.listVacationRequests({ status }), [status])
  const requests = useHrQuery(requestsLoader, permissions.canRead)

  const alertRows = useMemo(
    () =>
      (alerts.data ?? [])
        .slice()
        .sort((a, b) => b.pendingPeriods - a.pendingPeriods || (a.daysToNextPeriod ?? 9999) - (b.daysToNextPeriod ?? 9999)),
    [alerts.data]
  )
  const stats = useMemo(
    () => ({
      overdue: alertRows.filter((a) => a.alertLevel !== 'AL_DIA').length,
      critical: alertRows.filter((a) => a.alertLevel === 'CRITICA').length,
      upToDate: alertRows.filter((a) => a.alertLevel === 'AL_DIA').length,
      pendingDays: alertRows.reduce((sum, a) => sum + a.pendingDays, 0),
    }),
    [alertRows]
  )

  if (!permissions.isLoading && !permissions.canRead) return <HrAccessDenied />

  const reloadAll = () => {
    void alerts.reload()
    void requests.reload()
  }

  return (
    <div className={HR_PAGE_CLASS}>
      <HrPageHeader
        eyebrow="Recursos Humanos • Política: todas las vacaciones se disfrutan"
        title="Control de vacaciones"
        subtitle="Periodos causados sin disfrutar, alertas por acumulación (Art. 190 CST) y aprobación de solicitudes."
        actions={
          <>
            <button type="button" className="outline-button" onClick={reloadAll} disabled={alerts.isLoading}>
              <AppIcon name="refresh" size={16} className={alerts.isLoading ? 'spin' : ''} />
              <span>Actualizar</span>
            </button>
            {permissions.canManage && (
              <button type="button" className="primary-button" onClick={() => setIsCreating(true)}>
                <AppIcon name="vacation" size={16} />
                <span>Programar vacaciones</span>
              </button>
            )}
          </>
        }
      />

      <section className="stats-grid max-lg:grid-cols-2! max-sm:grid-cols-1!" aria-label="Indicadores de vacaciones">
        <HrKpiCard title="Con periodo vencido" value={stats.overdue} icon="warning" tone={stats.overdue > 0 ? 'amber' : 'teal'} badge="Vencidas" note={stats.overdue > 0 ? 'Deben programarse' : 'Sin periodos vencidos'} isPositive={stats.overdue === 0} index={1} />
        <HrKpiCard title="Alertas críticas" value={stats.critical} icon="alertTriangle" tone={stats.critical > 0 ? 'red' : 'teal'} badge="Críticas" note="Cerca de acumular 2 periodos" isPositive={stats.critical === 0} index={2} />
        <HrKpiCard title="Empleados al día" value={stats.upToDate} icon="check" tone="teal" badge="Al día" note="Sin periodos vencidos" index={3} />
        <HrKpiCard title="Días vencidos sin disfrutar" value={Math.round(stats.pendingDays)} icon="calendar" tone="purple" badge="Días hábiles" note="Suma de periodos vencidos" isPositive={stats.pendingDays === 0} index={4} />
      </section>

      <ScrollableTabs>
        <button type="button" role="tab" aria-selected={tab === 'control'} className={`drawer-tab flex items-center gap-2 ${tab === 'control' ? 'active' : ''}`} onClick={() => setTab('control')}>
          <AppIcon name="clipboardCheck" size={15} />
          <span>Control por empleado</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === 'requests'} className={`drawer-tab flex items-center gap-2 ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')}>
          <AppIcon name="calendarMark" size={15} />
          <span>Solicitudes</span>
        </button>
      </ScrollableTabs>

      {tab === 'control' ? (
        <section className="flex flex-col gap-3" aria-labelledby="hr-vacation-control-title">
          <h2 id="hr-vacation-control-title" className="sr-only">
            Control de vacaciones por empleado
          </h2>
          {alerts.error && <HrErrorBanner message={alerts.error} onRetry={() => void alerts.reload()} />}
          <div className="table-panel animated-table page-enter">
            <div className="table-scroll">
              <table className="min-w-[900px]!">
                <thead>
                  <tr>
                    <th scope="col">Empleado</th>
                    <th scope="col">Periodos vencidos</th>
                    <th scope="col">Días vencidos</th>
                    <th scope="col">Saldo total</th>
                    <th scope="col">Vencido desde</th>
                    <th scope="col">Próximo periodo</th>
                    <th scope="col">Alerta</th>
                    <th scope="col" className="text-right">Ficha</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.isLoading ? (
                    <HrTableSkeleton columns={8} />
                  ) : alertRows.length === 0 ? (
                    <tr>
                      <td colSpan={8}>
                        <HrEmptyState icon="vacation" title="Sin empleados con vacaciones" description="Aquí aparecen los empleados vigentes con contrato que causa vacaciones." />
                      </td>
                    </tr>
                  ) : (
                    alertRows.map((a) => (
                      <tr key={a.employeeId}>
                        <td>
                          <strong className="block text-[13px] text-[var(--foreground)]">{a.fullName}</strong>
                          <small className="mono">{a.employeeCode}</small>
                        </td>
                        <td>{a.pendingPeriods}</td>
                        <td>{formatDays(a.pendingDays)}</td>
                        <td>{formatDays(a.availableDays)}</td>
                        <td>{formatDate(a.oldestPendingPeriodEnd)}</td>
                        <td>
                          {formatDate(a.currentPeriodEnd)}
                          {a.daysToNextPeriod !== null && <small>En {a.daysToNextPeriod} días</small>}
                        </td>
                        <td>
                          <HrBadge tone={VACATION_ALERT_TONES[a.alertLevel]}>{VACATION_ALERT_LABELS[a.alertLevel]}</HrBadge>
                        </td>
                        <td className="text-right">
                          <Link href={employeeProfilePath(a.employeeId, 'vacaciones')} className="outline-button compact inline-flex items-center gap-1" aria-label={`Ver vacaciones de ${a.fullName}`}>
                            <AppIcon name="eye" size={14} />
                            <span>Ver</span>
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-3" aria-labelledby="hr-vacation-requests-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="hr-vacation-requests-title" className="m-0 text-[15px] font-bold">
              Solicitudes de vacaciones
            </h2>
            <div className="w-full sm:w-64">
              <CustomSelect size="sm" value={status} onChange={(v) => setStatus(v as VacationRequestStatus | 'ALL')} options={STATUS_OPTIONS} />
            </div>
          </div>
          {requests.error && <HrErrorBanner message={requests.error} onRetry={() => void requests.reload()} />}
          <VacationRequestListPanel
            title="Solicitudes de vacaciones de la empresa"
            requests={requests.data ?? []}
            isLoading={requests.isLoading}
            showEmployee
            canManage={permissions.canManage}
            notify={notify}
            onChanged={reloadAll}
          />
        </section>
      )}

      {isCreating && (
        <VacationRequestModal
          onClose={() => setIsCreating(false)}
          onSaved={() => {
            setIsCreating(false)
            notify('success', 'Vacaciones programadas', 'La solicitud queda pendiente de aprobación.')
            reloadAll()
          }}
        />
      )}

      <HrToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
