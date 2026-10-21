'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { AppIcon } from '@/components/ui/Icon'
import { HrBadge } from '../shared/HrBadge'
import { HrDecisionModal, type HrDecision } from '../shared/HrDecisionModal'
import { HrEmptyState, HrTableSkeleton } from '../shared/HrStates'
import { hrAbsenceService } from '../../services/hr-absence.service'
import { REQUEST_STATUS_TONES, VACATION_REQUEST_STATUS_LABELS, employeeProfilePath } from '../../constants'
import { formatDate, todayIso } from '../../utils/hr-format'
import type { HrNotify } from '../../hooks/useHrToasts'
import type { VacationRequest } from '../../types'

interface VacationRequestListPanelProps {
  title: string
  requests: VacationRequest[]
  isLoading: boolean
  showEmployee: boolean
  canManage: boolean
  notify: HrNotify
  onChanged: () => void
  emptyAction?: React.ReactNode
}

type RowDecision = Exclude<HrDecision, 'archive'>

const DECISION_TITLES: Record<RowDecision, string> = {
  approve: 'Aprobar vacaciones',
  reject: 'Rechazar vacaciones',
  cancel: 'Cancelar vacaciones',
}

/** Solicitudes de vacaciones con aprobación (asigna días a los periodos más antiguos), rechazo y cancelación. */
export function VacationRequestListPanel({ title, requests, isLoading, showEmployee, canManage, notify, onChanged, emptyAction }: VacationRequestListPanelProps) {
  const [action, setAction] = useState<{ request: VacationRequest; decision: RowDecision } | null>(null)
  const columns = showEmployee ? 7 : 6
  const today = todayIso()

  const confirm = async (notes: string) => {
    if (!action) return
    const { request, decision } = action
    if (decision === 'cancel') await hrAbsenceService.cancelVacationRequest(request.id, notes)
    else await hrAbsenceService.reviewVacationRequest(request.id, decision === 'approve', notes)
    setAction(null)
    notify(
      decision === 'approve' ? 'success' : 'info',
      decision === 'approve' ? 'Vacaciones aprobadas' : decision === 'reject' ? 'Solicitud rechazada' : 'Vacaciones canceladas',
      `${request.employeeName ?? ''} • ${request.businessDays} días hábiles`
    )
    onChanged()
  }

  const canCancel = (r: VacationRequest) => r.status === 'PENDIENTE' || (r.status === 'APROBADA' && r.startDate > today)

  return (
    <section className="table-panel animated-table page-enter" aria-label={title}>
      <div className="table-scroll">
        <table className={showEmployee ? 'min-w-[920px]!' : 'min-w-[760px]!'}>
          <thead>
            <tr>
              {showEmployee && <th scope="col">Empleado</th>}
              <th scope="col">Periodo de disfrute</th>
              <th scope="col">Días hábiles</th>
              <th scope="col">Reintegro</th>
              <th scope="col">Observaciones</th>
              <th scope="col">Estado</th>
              <th scope="col" className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <HrTableSkeleton columns={columns} />
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={columns}>
                  <HrEmptyState icon="vacation" title="Sin solicitudes" description="No hay vacaciones programadas para los criterios seleccionados." action={emptyAction} />
                </td>
              </tr>
            ) : (
              requests.map((r) => (
                <tr key={r.id}>
                  {showEmployee && (
                    <td>
                      <Link href={employeeProfilePath(r.employeeId, 'vacaciones')} className="font-semibold text-[var(--navy)] hover:underline">
                        {r.employeeName ?? 'Empleado'}
                      </Link>
                      <small className="mono">{r.employeeCode}</small>
                    </td>
                  )}
                  <td>
                    {formatDate(r.startDate)} a {formatDate(r.endDate)}
                    <small>{r.calendarDays} días calendario</small>
                  </td>
                  <td className="font-bold text-[var(--foreground)]">{r.businessDays}</td>
                  <td>{formatDate(r.returnDate)}</td>
                  <td>
                    <span className="block max-w-[240px] truncate">{r.cancelReason ?? r.reviewNotes ?? r.notes ?? '—'}</span>
                  </td>
                  <td>
                    <HrBadge tone={REQUEST_STATUS_TONES[r.status]}>{VACATION_REQUEST_STATUS_LABELS[r.status]}</HrBadge>
                  </td>
                  <td>
                    {canManage && (
                      <div className="flex justify-end gap-1">
                        {r.status === 'PENDIENTE' && (
                          <>
                            <button type="button" className="outline-button compact" onClick={() => setAction({ request: r, decision: 'approve' })} aria-label="Aprobar vacaciones">
                              <AppIcon name="check" size={14} />
                              <span>Aprobar</span>
                            </button>
                            <button type="button" className="outline-button compact" onClick={() => setAction({ request: r, decision: 'reject' })} aria-label="Rechazar vacaciones">
                              <AppIcon name="close" size={14} />
                              <span>Rechazar</span>
                            </button>
                          </>
                        )}
                        {canCancel(r) && (
                          <button type="button" className="outline-button compact" onClick={() => setAction({ request: r, decision: 'cancel' })} aria-label="Cancelar vacaciones">
                            <AppIcon name="trash" size={14} />
                            <span>Cancelar</span>
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {action && (
        <HrDecisionModal
          decision={action.decision}
          title={DECISION_TITLES[action.decision]}
          subtitle={`${action.request.employeeName ?? ''} • ${formatDate(action.request.startDate)} a ${formatDate(action.request.endDate)} • ${action.request.businessDays} días hábiles`}
          onClose={() => setAction(null)}
          onConfirm={confirm}
        />
      )}
    </section>
  )
}
