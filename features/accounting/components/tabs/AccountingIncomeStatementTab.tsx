'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { FinancialStatementNode, IncomeStatementReport } from '../../types'
import { useAccountingLocations } from '../../hooks/useAccountingLocations'
import { useAccountingCompanyHeader } from '../../hooks/useAccountingReportContext'
import { accountingExportService } from '../../services/accounting-export.service'
import { ACCOUNT_LEVEL_LABEL, collectExpandableNodeIds, pruneZeroNodes } from '../../utils/account-tree'
import { incomeStatementLines, incomeStatementSections, IncomeStatementSectionKey } from '../../utils/income-statement'
import {
  currentBogotaMonthRange,
  formatCop,
  isFullMonthRange,
  isIsoDate,
  monthDateRange,
} from '../../utils/report-format'
import { FinancialStatementTree } from '../reports/FinancialStatementTree'
import { DatePicker } from '@/components/ui/DatePicker'
import { SelectField } from '@/components/ui/SelectField'

/** Al abrir el reporte se despliegan clases y grupos (nivel 2): quedan visibles las cuentas de 4 dígitos. */
const DEFAULT_EXPAND_LEVEL = 2

const LEVEL_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: ACCOUNT_LEVEL_LABEL.CLASS },
  { value: 2, label: ACCOUNT_LEVEL_LABEL.GROUP },
  { value: 3, label: ACCOUNT_LEVEL_LABEL.ACCOUNT },
  { value: 4, label: ACCOUNT_LEVEL_LABEL.SUBACCOUNT },
  { value: 5, label: ACCOUNT_LEVEL_LABEL.AUXILIARY },
]

const SECTION_TONES: Record<IncomeStatementSectionKey, string> = {
  revenues: 'bg-emerald-800',
  costOfSales: 'bg-rose-800',
  productionCosts: 'bg-rose-700',
  expenses: 'bg-amber-700',
}

type PeriodMode = 'MONTH' | 'RANGE'

export interface IncomeStatementFiltersChange {
  locationId?: string
  resultsDateFrom?: string
  resultsDateTo?: string
}

interface AccountingIncomeStatementTabProps {
  incomeStatement: IncomeStatementReport | null
  locationId?: string
  dateFrom?: string
  dateTo?: string
  onFiltersChange: (filters: IncomeStatementFiltersChange) => void
  onOpenPdf?: () => void
}

interface MarginCardProps {
  label: string
  value: number
  hint: string
  tone: string
}

function MarginCard({ label, value, hint, tone }: MarginCardProps) {
  return (
    <div className={`p-4 rounded-xl border transition-transform motion-safe:hover:-translate-y-0.5 ${tone}`}>
      <span className="text-[11px] font-semibold uppercase block mb-1 opacity-80">{label}</span>
      <strong className={`text-lg font-mono block ${value < 0 ? 'text-rose-700' : ''}`}>{formatCop(value)}</strong>
      <span className="text-[11px] block mt-1 opacity-80">{hint}</span>
    </div>
  )
}

export function AccountingIncomeStatementTab({
  incomeStatement,
  locationId = 'ALL',
  dateFrom,
  dateTo,
  onFiltersChange,
  onOpenPdf,
}: AccountingIncomeStatementTabProps) {
  const locations = useAccountingLocations()
  const { company } = useAccountingCompanyHeader(Boolean(incomeStatement))
  const defaultRange = currentBogotaMonthRange()
  const selectedFrom = isIsoDate(dateFrom) ? dateFrom : incomeStatement?.dateFrom || defaultRange.dateFrom
  const selectedTo = isIsoDate(dateTo) ? dateTo : incomeStatement?.dateTo || defaultRange.dateTo

  const [periodMode, setPeriodMode] = useState<PeriodMode>(() =>
    isFullMonthRange(selectedFrom, selectedTo) ? 'MONTH' : 'RANGE'
  )
  const [hideZeroBalances, setHideZeroBalances] = useState(true)
  // null = despliegue por defecto; luego lo controla el usuario.
  const [expandedOverride, setExpandedOverride] = useState<Set<string> | null>(null)
  // Nivel elegido en "Desplegar hasta" ('' = el usuario abrió o cerró ramas a mano).
  const [expandLevel, setExpandLevel] = useState<number | ''>(DEFAULT_EXPAND_LEVEL + 1)
  const [exportError, setExportError] = useState<string | null>(null)

  const sections = useMemo(() => {
    if (!incomeStatement) return []
    return incomeStatementSections(incomeStatement).map((section) => ({
      ...section,
      nodes: section.node ? (hideZeroBalances ? pruneZeroNodes([section.node]) : [section.node]) : [],
    }))
  }, [incomeStatement, hideZeroBalances])

  const allNodes = useMemo<FinancialStatementNode[]>(() => sections.flatMap((section) => section.nodes), [sections])
  const expandedIds = useMemo(
    () => expandedOverride ?? collectExpandableNodeIds(allNodes, DEFAULT_EXPAND_LEVEL + 1),
    [expandedOverride, allNodes]
  )

  const handleToggle = useCallback(
    (id: string) => {
      const next = new Set(expandedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      setExpandedOverride(next)
      setExpandLevel('')
    },
    [expandedIds]
  )

  const handlePeriodModeChange = (mode: PeriodMode) => {
    setPeriodMode(mode)
    if (mode === 'MONTH') {
      const range = monthDateRange(selectedFrom.slice(0, 7))
      onFiltersChange({ resultsDateFrom: range.dateFrom, resultsDateTo: range.dateTo })
    }
  }

  const handleRangeChange = (from: string, to: string) => {
    if (!isIsoDate(from) || !isIsoDate(to)) return
    // Un rango invertido se corrige moviendo el otro extremo.
    onFiltersChange(from <= to ? { resultsDateFrom: from, resultsDateTo: to } : { resultsDateFrom: to, resultsDateTo: from })
  }

  const handleExportExcel = () => {
    if (!incomeStatement) return
    try {
      setExportError(null)
      accountingExportService.exportIncomeStatement(incomeStatement, 'EXCEL', {
        hideZeroBalances,
        companyHeader: company,
      })
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : 'No se pudo exportar el Estado de Resultados.')
    }
  }

  if (!incomeStatement) return null

  const summaryLines = incomeStatementLines(incomeStatement)

  return (
    <div className="space-y-5 page-enter">
      {/* Encabezado y filtros */}
      <section className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 m-0">Estado de Resultados Integral (Pérdidas y Ganancias)</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {incomeStatement.period} —{' '}
              {incomeStatement.locationName ? `Sede: ${incomeStatement.locationName}` : 'Consolidado de todas las sedes'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenPdf && (
              <button
                type="button"
                className="primary-button text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-sm font-bold active:scale-[0.98] transition-transform"
                style={{ background: 'var(--navy, #001B5C)' }}
                onClick={onOpenPdf}
              >
                <AppIcon name="printer" size={14} />
                <span>Estado de Resultados (PDF)</span>
              </button>
            )}
            <button
              type="button"
              className="outline-button text-xs py-1.5 px-3 flex items-center gap-1.5 active:scale-[0.98] transition-transform"
              onClick={handleExportExcel}
            >
              <AppIcon name="download" size={14} />
              <span>Exportar a Excel</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-3 border-t border-gray-100 text-xs">
          <fieldset className="flex flex-col gap-1 min-w-0">
            <legend className="font-semibold text-gray-600 mb-1">Periodo</legend>
            <div className="inline-flex rounded-md border border-slate-300 overflow-hidden h-9" role="group">
              {(
                [
                  { mode: 'MONTH', label: 'Mes' },
                  { mode: 'RANGE', label: 'Rango de fechas' },
                ] as const
              ).map((option) => (
                <button
                  key={option.mode}
                  type="button"
                  aria-pressed={periodMode === option.mode}
                  className={`flex-1 px-2 text-xs font-semibold transition-colors ${
                    periodMode === option.mode ? 'bg-blue-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                  onClick={() => handlePeriodModeChange(option.mode)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          {periodMode === 'MONTH' ? (
            <label className="flex flex-col gap-1">
              <span className="font-semibold text-gray-600">Mes y año</span>
              <DatePicker
                mode="month"
                value={selectedFrom.slice(0, 7)}
                size="sm"
                onChange={(value) => {
                  if (!/^\d{4}-\d{2}$/.test(value)) return
                  const range = monthDateRange(value)
                  onFiltersChange({ resultsDateFrom: range.dateFrom, resultsDateTo: range.dateTo })
                }}
              />
            </label>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-gray-600">Desde</span>
                <DatePicker
                  value={selectedFrom}
                  size="sm"
                  onChange={(value) => handleRangeChange(value, selectedTo)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-gray-600">Hasta</span>
                <DatePicker
                  value={selectedTo}
                  size="sm"
                  onChange={(value) => handleRangeChange(selectedFrom, value)}
                />
              </label>
            </div>
          )}

          <label className="flex flex-col gap-1">
            <span className="font-semibold text-gray-600">Sede</span>
            <SelectField
              value={locationId}
              size="sm"
              onChange={(value) => onFiltersChange({ locationId: value })}
            >
              <option value="ALL">Todas las sedes (consolidado)</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </SelectField>
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-semibold text-gray-600">Desplegar hasta</span>
            <SelectField
              value={expandLevel}
              size="sm"
              onChange={(value) => {
                const level = Number(value)
                setExpandLevel(level)
                setExpandedOverride(collectExpandableNodeIds(allNodes, level))
              }}
            >
              {expandLevel === '' && <option value="">Personalizado</option>}
              {LEVEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideZeroBalances}
              onChange={(e) => setHideZeroBalances(e.target.checked)}
              className="rounded border-slate-300 text-blue-900 focus:ring-blue-900"
            />
            <span>Ocultar cuentas sin movimiento</span>
          </label>
          <button
            type="button"
            className="outline-button compact text-[11px] px-2 py-1 flex items-center gap-1 active:scale-95 transition-transform"
            onClick={() => {
              setExpandedOverride(collectExpandableNodeIds(allNodes, LEVEL_OPTIONS.length + 1))
              setExpandLevel(LEVEL_OPTIONS.length)
            }}
          >
            <AppIcon name="chevronDown" size={12} />
            <span>Expandir todo</span>
          </button>
          <button
            type="button"
            className="outline-button compact text-[11px] px-2 py-1 flex items-center gap-1 active:scale-95 transition-transform"
            onClick={() => {
              setExpandedOverride(new Set())
              setExpandLevel(1)
            }}
          >
            <AppIcon name="chevronUp" size={12} />
            <span>Contraer todo</span>
          </button>
        </div>

        {exportError && (
          <p role="alert" className="text-xs text-rose-700 flex items-start gap-1.5 m-0">
            <AppIcon name="warning" size={14} />
            <span>{exportError}</span>
          </p>
        )}
      </section>

      {!incomeStatement.hasActivity ? (
        <div className="p-8 text-center bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="grid place-items-center w-13 h-13 rounded-xl bg-blue-50 text-[var(--navy)] mx-auto mb-3.5 p-3">
            <AppIcon name="accounting" size={26} />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">Sin ingresos, costos ni gastos en el periodo</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            No hay comprobantes contabilizados en las clases 4 a 7 {incomeStatement.period.toLowerCase()}
            {incomeStatement.locationName ? ` en la sede ${incomeStatement.locationName}` : ''}. Pruebe con otro periodo o
            sede.
          </p>
        </div>
      ) : (
        <>
          {/* Tarjetas de resultado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <MarginCard
              label="Ingresos operacionales"
              value={incomeStatement.operatingRevenues}
              hint={`Total ingresos (4): ${formatCop(incomeStatement.totalRevenues)}`}
              tone="bg-emerald-50 border-emerald-100 text-emerald-950"
            />
            <MarginCard
              label="Utilidad bruta"
              value={incomeStatement.grossProfit}
              hint={`Margen bruto: ${incomeStatement.grossMarginPercent} %`}
              tone="bg-blue-50 border-blue-100 text-blue-950"
            />
            <MarginCard
              label="Utilidad operacional"
              value={incomeStatement.operatingProfit}
              hint={`Gastos operacionales: ${formatCop(incomeStatement.totalOperatingExpenses)}`}
              tone="bg-amber-50 border-amber-100 text-amber-950"
            />
            <MarginCard
              label={incomeStatement.netProfit < 0 ? 'Pérdida neta' : 'Utilidad neta'}
              value={incomeStatement.netProfit}
              hint={`Margen neto: ${incomeStatement.netMarginPercent} %`}
              tone="bg-teal-50 border-teal-100 text-teal-950"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)] gap-5 items-start">
            {/* Árboles por clase */}
            <div className="space-y-5 min-w-0">
              {sections.map((section) => (
                <section
                  key={section.key}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm transition-shadow hover:shadow-md"
                >
                  <header className={`px-3.5 py-2.5 ${SECTION_TONES[section.key]} text-white flex items-center justify-between gap-3`}>
                    <h3 className="text-xs font-semibold uppercase tracking-wider m-0">{section.title}</h3>
                    <span className="font-mono text-xs font-bold whitespace-nowrap">{formatCop(section.total)}</span>
                  </header>
                  <FinancialStatementTree
                    nodes={section.nodes}
                    expandedIds={expandedIds}
                    onToggle={handleToggle}
                    caption={section.title}
                  />
                </section>
              ))}
            </div>

            {/* Cascada de utilidades */}
            <section
              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden xl:sticky xl:top-4"
              aria-labelledby="income-statement-summary-title"
            >
              <header className="px-3.5 py-2.5 bg-gray-900 text-white">
                <h3 id="income-statement-summary-title" className="text-xs font-semibold uppercase tracking-wider m-0">
                  Resumen del resultado
                </h3>
              </header>
              <dl className="m-0 divide-y divide-slate-100 text-xs">
                {summaryLines.map((line) => (
                  <div
                    key={line.key}
                    className={`flex items-center justify-between gap-3 px-3.5 py-2 ${
                      line.kind === 'total'
                        ? 'bg-teal-900 text-white font-bold'
                        : line.kind === 'subtotal'
                        ? 'bg-slate-50 font-semibold text-slate-900'
                        : 'text-slate-700'
                    }`}
                  >
                    <dt className={line.kind === 'line' ? 'pl-2' : ''}>{line.label}</dt>
                    <dd
                      className={`m-0 font-mono whitespace-nowrap ${
                        line.kind !== 'total' && line.amount < 0 ? 'text-rose-700' : ''
                      }`}
                    >
                      {formatCop(line.amount)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
