'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { BalanceSheetReport, FinancialStatementNode } from '../../types'
import { useAccountingLocations } from '../../hooks/useAccountingLocations'
import { ACCOUNT_LEVEL_LABEL, collectExpandableNodeIds, pruneZeroNodes } from '../../utils/account-tree'
import { formatCop, formatIsoDateEs, todayBogotaIsoDate } from '../../utils/report-format'
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

interface AccountingBalanceSheetTabProps {
  balanceSheet: BalanceSheetReport | null
  locationId?: string
  cutoffDate?: string
  onFiltersChange: (filters: { locationId?: string; cutoffDate?: string }) => void
  onOpenBalancePdf?: () => void
  onOpenTrialBalancePdf?: () => void
}

interface StatementSectionProps {
  title: string
  total: number
  tone: 'assets' | 'liabilities' | 'equity'
  nodes: FinancialStatementNode[]
  expandedIds: ReadonlySet<string>
  onToggle: (id: string) => void
  children?: React.ReactNode
}

const SECTION_TONES: Record<StatementSectionProps['tone'], string> = {
  assets: 'bg-blue-900',
  liabilities: 'bg-amber-700',
  equity: 'bg-teal-800',
}

function StatementSection({ title, total, tone, nodes, expandedIds, onToggle, children }: StatementSectionProps) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm transition-shadow hover:shadow-md">
      <header className={`px-3.5 py-2.5 ${SECTION_TONES[tone]} text-white flex items-center justify-between gap-3`}>
        <h3 className="text-xs font-semibold uppercase tracking-wider m-0">{title}</h3>
        <span className="font-mono text-xs font-bold whitespace-nowrap">{formatCop(total)}</span>
      </header>
      <FinancialStatementTree nodes={nodes} expandedIds={expandedIds} onToggle={onToggle} caption={title} />
      {children}
    </section>
  )
}

export function AccountingBalanceSheetTab({
  balanceSheet,
  locationId = 'ALL',
  cutoffDate,
  onFiltersChange,
  onOpenBalancePdf,
  onOpenTrialBalancePdf,
}: AccountingBalanceSheetTabProps) {
  const locations = useAccountingLocations()
  const [hideZeroBalances, setHideZeroBalances] = useState(true)
  // null = despliegue por defecto; luego lo controla el usuario.
  const [expandedOverride, setExpandedOverride] = useState<Set<string> | null>(null)
  // Nivel elegido en "Desplegar hasta" ('' = el usuario abrió o cerró ramas a mano).
  const [expandLevel, setExpandLevel] = useState<number | ''>(DEFAULT_EXPAND_LEVEL + 1)
  const today = todayBogotaIsoDate()

  const sections = useMemo(() => {
    const prepare = (node: FinancialStatementNode | null) => {
      if (!node) return []
      return hideZeroBalances ? pruneZeroNodes([node]) : [node]
    }
    return {
      assets: prepare(balanceSheet?.assets ?? null),
      liabilities: prepare(balanceSheet?.liabilities ?? null),
      equity: prepare(balanceSheet?.equity ?? null),
    }
  }, [balanceSheet, hideZeroBalances])

  const allNodes = useMemo(() => [...sections.assets, ...sections.liabilities, ...sections.equity], [sections])
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

  if (!balanceSheet) return null

  const isRangeLimited = Boolean(balanceSheet.accountFrom || balanceSheet.accountTo)
  const { resultBreakdown } = balanceSheet

  return (
    <div className="space-y-5 page-enter">
      {/* Encabezado y filtros */}
      <section className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 m-0">Estado de Situación Financiera (Balance General)</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {balanceSheet.period} — {balanceSheet.locationName ? `Sede: ${balanceSheet.locationName}` : 'Consolidado de todas las sedes'}
              {isRangeLimited ? ` — ${balanceSheet.accountRangeLabel}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenBalancePdf && (
              <button
                type="button"
                className="primary-button text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-sm font-bold active:scale-[0.98] transition-transform"
                style={{ background: 'var(--navy, #001B5C)' }}
                onClick={onOpenBalancePdf}
              >
                <AppIcon name="printer" size={14} />
                <span>Balance General (PDF)</span>
              </button>
            )}
            {onOpenTrialBalancePdf && (
              <button
                type="button"
                className="outline-button text-xs py-1.5 px-3 flex items-center gap-1.5 active:scale-[0.98] transition-transform"
                onClick={onOpenTrialBalancePdf}
              >
                <AppIcon name="receipt" size={14} />
                <span>Balance de Comprobación</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-3 border-t border-gray-100 text-xs">
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-gray-600">Fecha de corte</span>
            <DatePicker
              value={cutoffDate || balanceSheet.cutoffDate}
              max={today}
              size="sm"
              onChange={(value) => {
                if (/^\d{4}-\d{2}-\d{2}$/.test(value)) onFiltersChange({ cutoffDate: value })
              }}
            />
          </label>

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

          <div className="flex flex-col gap-1">
            <span className="font-semibold text-gray-600">Vista</span>
            <div className="flex flex-wrap items-center gap-1.5 min-h-9">
              <button
                type="button"
                className="outline-button compact text-[11px] px-2 py-1 flex items-center gap-1 active:scale-95 transition-transform"
                onClick={() => {
                  setExpandedOverride(collectExpandableNodeIds(allNodes, 6))
                  setExpandLevel(5)
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
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hideZeroBalances}
            onChange={(e) => setHideZeroBalances(e.target.checked)}
            className="rounded border-slate-300 text-blue-900 focus:ring-blue-900"
          />
          <span>Ocultar cuentas con saldo en cero</span>
        </label>
      </section>

      {!balanceSheet.hasBalances ? (
        <div className="p-8 text-center bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="grid place-items-center w-13 h-13 rounded-xl bg-blue-50 text-[var(--navy)] mx-auto mb-3.5 p-3">
            <AppIcon name="accounting" size={26} />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">Sin saldos contables a la fecha de corte</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            No hay comprobantes contabilizados hasta el {formatIsoDateEs(balanceSheet.cutoffDate)}
            {balanceSheet.locationName ? ` en la sede ${balanceSheet.locationName}` : ''}. Pruebe con otra fecha de corte o sede.
          </p>
        </div>
      ) : (
        <>
          {/* Totales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 transition-transform motion-safe:hover:-translate-y-0.5">
              <span className="text-xs font-semibold text-blue-700 uppercase block mb-1">Total activo</span>
              <strong className="text-xl font-mono text-blue-950 block">{formatCop(balanceSheet.totalAssets)}</strong>
              <span className="text-[11px] text-blue-600 block mt-1">Clase 1 (débitos − créditos)</span>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 transition-transform motion-safe:hover:-translate-y-0.5">
              <span className="text-xs font-semibold text-amber-700 uppercase block mb-1">Total pasivo</span>
              <strong className="text-xl font-mono text-amber-950 block">{formatCop(balanceSheet.totalLiabilities)}</strong>
              <span className="text-[11px] text-amber-700 block mt-1">Clase 2 (créditos − débitos)</span>
            </div>
            <div className="p-4 rounded-xl bg-teal-50 border border-teal-100 transition-transform motion-safe:hover:-translate-y-0.5">
              <span className="text-xs font-semibold text-teal-700 uppercase block mb-1">Total patrimonio</span>
              <strong className="text-xl font-mono text-teal-950 block">{formatCop(balanceSheet.totalEquity)}</strong>
              <span className="text-[11px] text-teal-700 block mt-1">Clase 3 + resultado del ejercicio</span>
            </div>
          </div>

          {/* Ecuación patrimonial */}
          <div
            role="status"
            className={`p-3 rounded-lg border flex flex-wrap items-center justify-between gap-2 text-xs font-medium ${
              isRangeLimited
                ? 'bg-slate-50 border-slate-200 text-slate-700'
                : balanceSheet.isBalanced
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-start gap-2 min-w-0">
              <AppIcon name={isRangeLimited ? 'info' : balanceSheet.isBalanced ? 'check' : 'warning'} size={18} />
              <span>
                <strong>Activo = Pasivo + Patrimonio:</strong> {formatCop(balanceSheet.totalAssets)} ={' '}
                {formatCop(balanceSheet.totalLiabilities)} + {formatCop(balanceSheet.totalEquity)}
              </span>
            </div>
            <span className="font-mono text-xs font-bold">
              {isRangeLimited
                ? 'Rango de cuentas parcial: la ecuación aplica al balance completo'
                : balanceSheet.isBalanced
                ? 'Cuadrado (diferencia $ 0,00)'
                : `Descuadre: ${formatCop(balanceSheet.difference)}`}
            </span>
          </div>

          {/* Árboles */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
            <StatementSection
              title="1. Activo"
              total={balanceSheet.totalAssets}
              tone="assets"
              nodes={sections.assets}
              expandedIds={expandedIds}
              onToggle={handleToggle}
            />

            <div className="space-y-5">
              <StatementSection
                title="2. Pasivo"
                total={balanceSheet.totalLiabilities}
                tone="liabilities"
                nodes={sections.liabilities}
                expandedIds={expandedIds}
                onToggle={handleToggle}
              />

              <StatementSection
                title="3. Patrimonio"
                total={balanceSheet.totalEquity}
                tone="equity"
                nodes={sections.equity}
                expandedIds={expandedIds}
                onToggle={handleToggle}
              >
                <div className="border-t border-slate-200 bg-teal-50/40 px-3 py-2.5 text-xs space-y-1.5">
                  <div className="flex items-center justify-between gap-3 font-semibold text-slate-900">
                    <span>Resultado del ejercicio (sin cierre)</span>
                    <span className={`font-mono whitespace-nowrap ${balanceSheet.currentYearResult < 0 ? 'text-rose-700' : ''}`}>
                      {formatCop(balanceSheet.currentYearResult)}
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-slate-600">
                    <dt>Ingresos (4)</dt>
                    <dd className="text-right font-mono m-0">{formatCop(resultBreakdown.revenues)}</dd>
                    <dt>Gastos (5)</dt>
                    <dd className="text-right font-mono m-0">{formatCop(-resultBreakdown.expenses)}</dd>
                    <dt>Costos de ventas (6)</dt>
                    <dd className="text-right font-mono m-0">{formatCop(-resultBreakdown.costOfSales)}</dd>
                    <dt>Costos de producción (7)</dt>
                    <dd className="text-right font-mono m-0">{formatCop(-resultBreakdown.productionCosts)}</dd>
                  </dl>
                  <div className="flex items-center justify-between gap-3 pt-1.5 border-t border-teal-100 font-bold text-teal-950">
                    <span>Total patrimonio</span>
                    <span className="font-mono whitespace-nowrap">{formatCop(balanceSheet.totalEquity)}</span>
                  </div>
                </div>
              </StatementSection>

              <div className="px-3.5 py-3 rounded-xl bg-gray-900 text-white flex items-center justify-between gap-3 text-xs font-semibold">
                <span className="uppercase tracking-wider">Total pasivo + patrimonio</span>
                <span className="font-mono font-bold whitespace-nowrap">{formatCop(balanceSheet.totalLiabilitiesAndEquity)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
