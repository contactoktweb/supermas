'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { AppIcon } from '@/components/ui/Icon'
import { HrBadge } from '../shared/HrBadge'
import { HrDecisionModal, type HrDecision } from '../shared/HrDecisionModal'
import { HrEmptyState, HrTableSkeleton } from '../shared/HrStates'
import { hrAbsenceService } from '../../services/hr-absence.service'
import {
  NOVELTY_STATUS_LABELS,
  NOVELTY_TYPE_LABELS,
  REQUEST_STATUS_TONES,
  employeeProfilePath,
} from '../../constants'
import { formatDate, formatDays } from '../../utils/hr-format'
import type { HrNotify } from '../../hooks/useHrToasts'
import type { Novelty } from '../../types'

interface NoveltyListPanelProps {
  title: string
  novelties: Novelty[]
  isLoading: boolean
  showEmployee: boolean
  canManage: boolean
  notify: HrNotify
  onChanged: () => void
  emptyAction?: React.ReactNode
}

type RowDecision = Exclude<HrDecision, 'archive'>

const DECISION_TITLES: Record<RowDecision, string> = {
  approve: 'Aprobar novedad',
  reject: 'Rechazar novedad',
  cancel: 'Anular novedad',
}

/** Tabla de novedades con aprobación, rechazo y anulación. */
export function NoveltyListPanel({ title, novelties, isLoading, showEmployee, canManage, notify, onChanged, emptyAction }: NoveltyListPanelProps) {
  const [action, setAction] = useState<{ novelty: Novelty; decision: RowDecision } | null>(null)
  const columns = showEmployee ? 8 : 7

  const confirm = async (notes: string) => {
    if (!action) return
    const { novelty, decision } = action
    if (decision === 'cancel') await hrAbsenceService.cancelNovelty(novelty.id, notes)
    else await hrAbsenceService.reviewNovelty(novelty.id, decision === 'approve', notes)
    setAction(null)
    notify(
      decision === 'approve' ? 'success' : 'info',
      decision === 'approve' ? 'Novedad aprobada' : decision === 'reject' ? 'Novedad rechazada' : 'Novedad anulada',
      `${NOVELTY_TYPE_LABELS[novelty.noveltyType]}${novelty.employeeName ? ` de ${novelty.employeeName}` : ''}`
    )
    onChanged()
  }

  const duration = (n: Novelty) => (n.hours !== null ? `${n.hours} h` : `${formatDays(n.calendarDays)} (${n.businessDays} hábiles)`)

  return (
    <section className="table-panel animated-table page-enter" aria-label={title}>
      <div className="table-scroll">
        <table className={showEmployee ? 'min-w-[1000px]!' : 'min-w-[860px]!'}>
          <thead>
            <tr>
              {showEmployee && <th scope="col">Empleado</th>}
              <th scope="col">Novedad</th>
              <th scope="col">Desde</th>
              <th scope="col">Hasta</th>
              <th scope="col">Duración</th>
              <th scope="col">Remunerada</th>
              <th scope="col">Estado</th>
              <th scope="col" className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <HrTableSkeleton columns={columns} />
            ) : novelties.length === 0 ? (
              <tr>
                <td colSpan={columns}>
                  <HrEmptyState icon="calendarMark" title="Sin novedades" description="No hay novedades registradas para los criterios seleccionados." action={emptyAction} />
                </td>
              </tr>
            ) : (
              novelties.map((n) => (
                <tr key={n.id}>
                  {showEmployee && (
                    <td>
                      <Link href={employeeProfilePath(n.employeeId, 'novedades')} className="font-semibold text-[var(--navy)] hover:underline">
                        {n.employeeName ?? 'Empleado'}
                      </Link>
                      <small className="mono">{n.employeeCode}</small>
                    </td>
                  )}
                  <td>
                    <span className="block font-semibold text-[var(--foreground)]">{NOVELTY_TYPE_LABELS[n.noveltyType]}</span>
                    {n.description && <small className="max-w-[280px] truncate">{n.description}</small>}
                    {(n.reviewNotes || n.cancelReason) && <small className="max-w-[280px] truncate">Nota: {n.cancelReason ?? n.reviewNotes}</small>}
                  </td>
                  <td>{formatDate(n.startDate)}</td>
                  <td>{formatDate(n.endDate)}</td>
                  <td>{duration(n)}</td>
                  <td>{n.isPaid ? 'Sí' : 'No'}</td>
                  <td>
                    <HrBadge tone={REQUEST_STATUS_TONES[n.status]}>{NOVELTY_STATUS_LABELS[n.status]}</HrBadge>
                  </td>
                  <td>
                    {canManage && (
                      <div className="flex justify-end gap-1">
                        {n.status === 'PENDIENTE' && (
                          <>
                            <button type="button" className="outline-button compact" onClick={() => setAction({ novelty: n, decision: 'approve' })} aria-label="Aprobar novedad">
                              <AppIcon name="check" size={14} />
                              <span>Aprobar</span>
                            </button>
                            <button type="button" className="outline-button compact" onClick={() => setAction({ novelty: n, decision: 'reject' })} aria-label="Rechazar novedad">
                              <AppIcon name="close" size={14} />
                              <span>Rechazar</span>
                            </button>
                          </>
                        )}
                        {(n.status === 'PENDIENTE' || n.status === 'APROBADA') && (
                          <button type="button" className="outline-button compact" onClick={() => setAction({ novelty: n, decision: 'cancel' })} aria-label="Anular novedad">
                            <AppIcon name="trash" size={14} />
                            <span>Anular</span>
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
          subtitle={`${NOVELTY_TYPE_LABELS[action.novelty.noveltyType]} • ${formatDate(action.novelty.startDate)} a ${formatDate(action.novelty.endDate)}`}
          onClose={() => setAction(null)}
          onConfirm={confirm}
        />
      )}
    </section>
  )
}
