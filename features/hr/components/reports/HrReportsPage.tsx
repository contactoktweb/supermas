'use client'

import { useCallback, useState } from 'react'
import { AppIcon, type LightIconName } from '@/components/ui/Icon'
import { extractErrorMessage } from '@/lib/utils'
import { HrPageHeader } from '../shared/HrPageHeader'
import { HrAccessDenied, HrEmptyState, HrErrorBanner, HrTableSkeleton } from '../shared/HrStates'
import { HrToastContainer } from '../shared/HrToastContainer'
import { HR_PAGE_CLASS } from '../shared/hr-ui'
import { useHrPermissions } from '../../hooks/useHrPermissions'
import { useHrQuery } from '../../hooks/useHrQuery'
import { useHrToasts } from '../../hooks/useHrToasts'
import { hrReportService, type HrReportKind } from '../../services/hr-report.service'
import { downloadTable, type ExportFormat } from '../../utils/hr-export'
import { addDaysIso, firstDayOfMonthIso, todayIso } from '../../utils/hr-format'

const PREVIEW_ROWS = 50

const REPORTS: { kind: HrReportKind; title: string; description: string; icon: LightIconName; usesRange: boolean }[] = [
  { kind: 'PLANTA', title: 'Planta de personal', description: 'Empleados vigentes con cargo, área, sede, contrato y antigüedad.', icon: 'users', usesRange: false },
  { kind: 'MOVIMIENTOS', title: 'Ingresos y retiros', description: 'Ingresos, reingresos y retiros con causa en el rango.', icon: 'userPlus', usesRange: true },
  { kind: 'AUSENTISMO', title: 'Ausentismo', description: 'Novedades aprobadas y días de ausencia en el rango.', icon: 'calendarMark', usesRange: true },
  { kind: 'VACACIONES', title: 'Vacaciones pendientes', description: 'Saldos, periodos vencidos y alertas por empleado.', icon: 'vacation', usesRange: false },
  { kind: 'NOMINA', title: 'Datos para nómina', description: 'Salario, seguridad social, cuenta y novedades del periodo. No liquida valores.', icon: 'dollar', usesRange: true },
]

const FILE_NAMES: Record<HrReportKind, string> = {
  PLANTA: 'planta-de-personal',
  MOVIMIENTOS: 'ingresos-y-retiros',
  AUSENTISMO: 'ausentismo',
  VACACIONES: 'vacaciones-pendientes',
  NOMINA: 'datos-para-nomina',
}

export function HrReportsPage() {
  const permissions = useHrPermissions()
  const { toasts, notify, dismiss } = useHrToasts()
  const [kind, setKind] = useState<HrReportKind>('PLANTA')
  const [from, setFrom] = useState(firstDayOfMonthIso())
  const [to, setTo] = useState(todayIso())
  const [includeSensitive, setIncludeSensitive] = useState(false)
  const [exporting, setExporting] = useState<ExportFormat | null>(null)

  const selected = REPORTS.find((r) => r.kind === kind) ?? REPORTS[0]
  const rangeError = selected.usesRange && from > to ? 'La fecha inicial no puede ser posterior a la final.' : null
  const sensitive = kind === 'NOMINA' && includeSensitive && permissions.canSensitive

  const loader = useCallback(
    () => hrReportService.build(kind, { from, to, includeSensitive: sensitive }),
    [kind, from, to, sensitive]
  )
  const { data, isLoading, error, reload } = useHrQuery(loader, permissions.canRead && !rangeError)

  if (!permissions.isLoading && !permissions.canRead) return <HrAccessDenied />

  const handleExport = async (format: ExportFormat) => {
    if (!data) return
    setExporting(format)
    try {
      await hrReportService.logExport(kind, data.table.rows.length, sensitive)
      const suffix = selected.usesRange ? `${from}_a_${to}` : todayIso()
      downloadTable(data.table, `${FILE_NAMES[kind]}_${suffix}`, format)
      notify('success', 'Reporte exportado', `${data.table.title} • ${data.table.rows.length} filas`)
    } catch (err) {
      notify('error', 'No se pudo exportar', extractErrorMessage(err))
    } finally {
      setExporting(null)
    }
  }

  const rows = data?.table.rows ?? []

  return (
    <div className={HR_PAGE_CLASS}>
      <HrPageHeader
        eyebrow="Recursos Humanos • Reportes y exportaciones"
        title="Reportes de personal"
        subtitle="Consulta la planta, los movimientos, el ausentismo, las vacaciones pendientes y los datos listos para nómina."
        actions={
          <>
            <button type="button" className="outline-button" onClick={() => void handleExport('csv')} disabled={!data || rows.length === 0 || exporting !== null}>
              <AppIcon name={exporting === 'csv' ? 'refresh' : 'download'} size={16} className={exporting === 'csv' ? 'spin' : ''} />
              <span>CSV</span>
            </button>
            <button type="button" className="primary-button" onClick={() => void handleExport('xls')} disabled={!data || rows.length === 0 || exporting !== null}>
              <AppIcon name={exporting === 'xls' ? 'refresh' : 'download'} size={16} className={exporting === 'xls' ? 'spin' : ''} />
              <span>Excel</span>
            </button>
          </>
        }
      />

      <section aria-labelledby="hr-report-picker-title">
        <h2 id="hr-report-picker-title" className="sr-only">
          Seleccione el reporte
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5" role="radiogroup" aria-label="Tipo de reporte">
          {REPORTS.map((report, index) => (
            <button
              key={report.kind}
              type="button"
              role="radio"
              aria-checked={kind === report.kind}
              onClick={() => setKind(report.kind)}
              className={`flex flex-col items-start gap-2 rounded-xl border bg-white p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-[var(--navy)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
                kind === report.kind ? 'border-[var(--red)] shadow-[inset_3px_0_var(--red)]' : 'border-[var(--line)]'
              } page-enter`}
              style={{ animationDelay: `${index * 0.04}s` }}
            >
              <span className={`stat-icon ${kind === report.kind ? 'red' : 'blue'}`} aria-hidden="true">
                <AppIcon name={report.icon} size={18} />
              </span>
              <strong className="text-[13px]">{report.title}</strong>
              <span className="text-[11px] leading-snug text-[var(--muted)]">{report.description}</span>
            </button>
          ))}
        </div>
      </section>

      {(selected.usesRange || kind === 'NOMINA') && (
        <div className="toolbar inventory-toolbar page-enter flex-wrap" aria-label="Parámetros del reporte">
          {selected.usesRange && (
            <>
              <label className="search-box w-full! sm:w-auto! text-[11px]">
                <span>Desde</span>
                <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="search-box w-full! sm:w-auto! text-[11px]">
                <span>Hasta</span>
                <input type="date" value={to} min={from} max={addDaysIso(todayIso(), 366)} onChange={(e) => setTo(e.target.value)} />
              </label>
            </>
          )}
          {kind === 'NOMINA' && permissions.canSensitive && (
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={includeSensitive} onChange={(e) => setIncludeSensitive(e.target.checked)} />
              Incluir número de cuenta completo (dato sensible, queda auditado)
            </label>
          )}
        </div>
      )}

      {rangeError && <HrErrorBanner message={rangeError} />}
      {error && <HrErrorBanner message={error} onRetry={() => void reload()} />}

      {data && data.summary.length > 0 && (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Resumen del reporte">
          {data.summary.map((item) => (
            <article key={item.label} className="panel p-4! page-enter">
              <span className="text-[11px] font-semibold text-[var(--muted)]">{item.label}</span>
              <strong className="mt-1 block text-lg">{item.value}</strong>
            </article>
          ))}
        </section>
      )}

      <section className="table-panel animated-table page-enter" aria-labelledby="hr-report-preview-title">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
          <h2 id="hr-report-preview-title" className="m-0 text-[14px] font-bold">
            {selected.title}
          </h2>
          {rows.length > PREVIEW_ROWS && (
            <span className="text-[11px] text-[var(--muted)]">
              Vista previa de {PREVIEW_ROWS} de {rows.length} filas; la exportación incluye todas.
            </span>
          )}
        </div>
        <div className="table-scroll">
          <table className="min-w-[960px]!">
            <thead>
              <tr>
                {(data?.table.columns ?? ['Cargando']).map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <HrTableSkeleton columns={data?.table.columns.length ?? 1} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={data?.table.columns.length ?? 1}>
                    <HrEmptyState icon="reports" title="Sin datos" description="No hay información para los parámetros seleccionados." />
                  </td>
                </tr>
              ) : (
                rows.slice(0, PREVIEW_ROWS).map((row, index) => (
                  <tr key={index}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex}>{cell === null || cell === undefined || cell === '' ? '—' : typeof cell === 'number' ? cell.toLocaleString('es-CO') : cell}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <HrToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
