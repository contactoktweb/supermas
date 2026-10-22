'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import { AppIcon } from '@/components/ui/Icon'
import { HrPageHeader } from '../shared/HrPageHeader'
import { HrKpiCard } from '../shared/HrKpiCard'
import { HrBadge } from '../shared/HrBadge'
import { HrAccessDenied, HrCardSkeleton, HrErrorBanner } from '../shared/HrStates'
import { HR_PAGE_CLASS } from '../shared/hr-ui'
import { HrDistributionPanel } from './HrDistributionPanel'
import { useHrPermissions } from '../../hooks/useHrPermissions'
import { useHrQuery } from '../../hooks/useHrQuery'
import { hrEmployeeService } from '../../services/hr-employee.service'
import { hrAbsenceService } from '../../services/hr-absence.service'
import { hrDocumentService } from '../../services/hr-document.service'
import {
  DOCUMENT_TYPE_LABELS,
  HR_DOCUMENT_EXPIRY_WARNING_DAYS,
  HR_ROUTES,
  VACATION_ALERT_LABELS,
  VACATION_ALERT_TONES,
  employeeProfilePath,
} from '../../constants'
import { addDaysIso, formatDate, formatDays, todayIso } from '../../utils/hr-format'

const TOP_ALERTS = 6

/** Panel de RRHH: actualiza causación y avisos, y muestra indicadores de personal. */
export function HrDashboardPage() {
  const permissions = useHrPermissions()

  const loader = useCallback(async () => {
    await hrEmployeeService.refresh()
    const [summary, alerts, documents] = await Promise.all([
      hrAbsenceService.getDashboardSummary(),
      hrAbsenceService.listVacationAlerts(),
      hrDocumentService.listExpiringUntil(addDaysIso(todayIso(), HR_DOCUMENT_EXPIRY_WARNING_DAYS)),
    ])
    return { summary, alerts, documents }
  }, [])
  const { data, isLoading, error, reload } = useHrQuery(loader, permissions.canRead)

  if (!permissions.isLoading && !permissions.canRead) return <HrAccessDenied />

  const summary = data?.summary
  const alerts = (data?.alerts ?? [])
    .filter((a) => a.alertLevel !== 'AL_DIA')
    .sort((a, b) => (a.alertLevel === b.alertLevel ? b.pendingDays - a.pendingDays : a.alertLevel === 'CRITICA' ? -1 : 1))
    .slice(0, TOP_ALERTS)
  const documents = (data?.documents ?? []).slice(0, TOP_ALERTS)
  const today = todayIso()

  return (
    <div className={HR_PAGE_CLASS}>
      <HrPageHeader
        eyebrow={`Recursos Humanos • Corte ${formatDate(summary?.asOf || today)}`}
        title="Panel de Recursos Humanos"
        subtitle="Planta activa, ingresos y retiros, ausentismo, vacaciones pendientes y documentos por vencer."
        actions={
          <>
            <button type="button" className="outline-button" onClick={() => void reload()} disabled={isLoading}>
              <AppIcon name="refresh" size={16} className={isLoading ? 'spin' : ''} />
              <span>Actualizar</span>
            </button>
            <Link href={HR_ROUTES.employees} className="primary-button inline-flex items-center gap-2">
              <AppIcon name="users" size={16} />
              <span>Ver empleados</span>
            </Link>
          </>
        }
      />

      {error && <HrErrorBanner message={error} onRetry={() => void reload()} />}

      {isLoading && !summary ? (
        <section className="stats-grid max-lg:grid-cols-2! max-sm:grid-cols-1!" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <HrCardSkeleton key={i} />
          ))}
        </section>
      ) : summary ? (
        <section className="stats-grid max-lg:grid-cols-2! max-sm:grid-cols-1!" aria-label="Indicadores de personal">
          <HrKpiCard title="Empleados activos" value={summary.activeEmployees} icon="users" tone="blue" badge="Planta" note={`${summary.onVacation} en vacaciones • ${summary.incapacitated} incapacitados`} index={1} href={HR_ROUTES.employees} />
          <HrKpiCard title="Ingresos del mes" value={summary.hiresThisMonth} icon="userPlus" tone="teal" badge="Mes" note="Ingresos y reingresos" index={2} href={HR_ROUTES.reports} />
          <HrKpiCard title="Retiros del mes" value={summary.terminationsThisMonth} icon="userMinus" tone={summary.terminationsThisMonth > 0 ? 'amber' : 'teal'} badge="Mes" note="Con causa registrada" isPositive={summary.terminationsThisMonth === 0} index={3} href={HR_ROUTES.reports} />
          <HrKpiCard title="Novedades activas hoy" value={summary.activeNovelties} icon="calendarMark" tone="purple" badge="Hoy" note={`${summary.pendingNovelties} por aprobar`} isPositive={summary.pendingNovelties === 0} index={4} href={HR_ROUTES.novelties} />
          <HrKpiCard title="Vacaciones vencidas" value={summary.vacationOverdue} icon="vacation" tone={summary.vacationOverdue > 0 ? 'amber' : 'teal'} badge="Vacaciones" note={summary.vacationOverdue > 0 ? 'Periodos sin disfrutar' : 'Todas al día'} isPositive={summary.vacationOverdue === 0} index={5} href={HR_ROUTES.vacations} />
          <HrKpiCard title="Vacaciones críticas" value={summary.vacationCritical} icon="alertTriangle" tone={summary.vacationCritical > 0 ? 'red' : 'teal'} badge="Art. 190 CST" note="Cerca de 2 periodos acumulados" isPositive={summary.vacationCritical === 0} index={6} href={HR_ROUTES.vacations} />
          <HrKpiCard title="Solicitudes de vacaciones" value={summary.pendingVacationRequests} icon="clock" tone={summary.pendingVacationRequests > 0 ? 'amber' : 'teal'} badge="Aprobación" note="Pendientes de revisar" isPositive={summary.pendingVacationRequests === 0} index={7} href={HR_ROUTES.vacations} />
          <HrKpiCard title="Documentos por vencer" value={summary.documentsExpiring} icon="fileCheck" tone={summary.documentsExpired > 0 ? 'red' : summary.documentsExpiring > 0 ? 'amber' : 'teal'} badge={`${HR_DOCUMENT_EXPIRY_WARNING_DAYS} días`} note={`${summary.documentsExpired} vencidos`} isPositive={summary.documentsExpired === 0 && summary.documentsExpiring === 0} index={8} />
        </section>
      ) : null}

      <div className="dashboard-grid max-lg:grid-cols-1!">
        <section className="panel page-enter" aria-labelledby="hr-dash-vacations">
          <div className="panel-heading mb-2">
            <div>
              <h2 id="hr-dash-vacations">Vacaciones por programar</h2>
              <p>Política de la empresa: todos los periodos causados deben disfrutarse.</p>
            </div>
            <Link href={HR_ROUTES.vacations} className="text-button">
              Ver control <AppIcon name="chevronRight" size={12} />
            </Link>
          </div>
          {isLoading && !data ? (
            <HrCardSkeleton height={180} />
          ) : alerts.length === 0 ? (
            <p className="m-0 flex items-center gap-2 py-6 text-xs text-[var(--muted)]">
              <AppIcon name="check" size={16} color="var(--green)" /> Ningún empleado tiene periodos vencidos.
            </p>
          ) : (
            <ul className="m-0 list-none p-0">
              {alerts.map((a) => (
                <li key={a.employeeId} className="alert-row">
                  <AppIcon name={a.alertLevel === 'CRITICA' ? 'alertTriangle' : 'vacation'} size={18} />
                  <div>
                    <Link href={employeeProfilePath(a.employeeId, 'vacaciones')} className="font-bold text-[var(--foreground)] hover:underline">
                      {a.fullName}
                    </Link>
                    <span>
                      {a.pendingPeriods} {a.pendingPeriods === 1 ? 'periodo vencido' : 'periodos vencidos'} • {formatDays(a.pendingDays)}
                      {a.daysToNextPeriod !== null && ` • próximo en ${a.daysToNextPeriod} días`}
                    </span>
                  </div>
                  <HrBadge tone={VACATION_ALERT_TONES[a.alertLevel]}>{VACATION_ALERT_LABELS[a.alertLevel]}</HrBadge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel page-enter" aria-labelledby="hr-dash-documents">
          <div className="panel-heading mb-2">
            <div>
              <h2 id="hr-dash-documents">Documentos por vencer</h2>
              <p>Vencidos y con vencimiento en los próximos {HR_DOCUMENT_EXPIRY_WARNING_DAYS} días.</p>
            </div>
          </div>
          {isLoading && !data ? (
            <HrCardSkeleton height={180} />
          ) : documents.length === 0 ? (
            <p className="m-0 flex items-center gap-2 py-6 text-xs text-[var(--muted)]">
              <AppIcon name="check" size={16} color="var(--green)" /> No hay documentos próximos a vencer.
            </p>
          ) : (
            <ul className="m-0 list-none p-0">
              {documents.map((doc) => {
                const expired = (doc.expiresAt ?? '') < today
                return (
                  <li key={doc.id} className="alert-row">
                    <AppIcon name="fileCheck" size={18} />
                    <div>
                      <Link href={employeeProfilePath(doc.employeeId, 'documentos')} className="font-bold text-[var(--foreground)] hover:underline">
                        {doc.name}
                      </Link>
                      <span>
                        {doc.employeeName ?? 'Empleado'} • {DOCUMENT_TYPE_LABELS[doc.documentType]}
                      </span>
                    </div>
                    <HrBadge tone={expired ? 'danger' : 'warning'}>
                      {expired ? 'Vencido' : 'Vence'} {formatDate(doc.expiresAt)}
                    </HrBadge>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="bottom-grid max-lg:grid-cols-1!">
        <HrDistributionPanel title="Personal por área" description="Empleados vigentes" items={summary?.byArea ?? []} isLoading={isLoading && !summary} />
        <HrDistributionPanel title="Personal por sede" description="Bodegas y puntos de venta" items={summary?.byLocation ?? []} isLoading={isLoading && !summary} />
      </div>
    </div>
  )
}
