'use client'

import React, { useState, useMemo } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import {
  AccountingMovement,
  AccountingFilters,
  AccountingAccount,
  AccountingEntry,
  AuxiliaryLedgerReport,
  PeriodMode,
} from '../../types'
import { db } from '@/lib/supabase/db'

interface AccountingMovementsTabProps {
  movements: AccountingMovement[]
  accounts: AccountingAccount[]
  entries: AccountingEntry[]
  auxiliaryReport: AuxiliaryLedgerReport | null
  filters: AccountingFilters
  onFilterChange: (filters: Partial<AccountingFilters>) => void
  onSelectEntry?: (entry: AccountingEntry) => void
  onExportAuxiliary?: () => void
}

const MONTH_NAMES = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
]

const QUICK_ACCOUNT_SHORTCUTS = [
  { label: 'Todas las Cuentas', code: 'ALL' },
  { label: 'Caja (1105)', code: '1105' },
  { label: 'Bancos (1110)', code: '1110' },
  { label: 'Clientes / Cartera (1305)', code: '1305' },
  { label: 'Materias Primas (1405)', code: '1405' },
  { label: 'Prod. en Proceso (1410)', code: '1410' },
  { label: 'Prod. Terminados (1430)', code: '1430' },
  { label: 'Mercancías Inventario (1435)', code: '1435' },
  { label: 'Proveedores (2205)', code: '2205' },
  { label: 'IVA por Pagar (2408)', code: '2408' },
  { label: 'Ingresos Ventas (4135)', code: '4135' },
  { label: 'Costo de Ventas (6135)', code: '6135' },
]

function formatCOP(val: number): string {
  const rounded = Math.round(Number(val) || 0)
  return `$${rounded.toLocaleString('es-CO')}`
}

export function AccountingMovementsTab({
  accounts,
  entries,
  auxiliaryReport,
  filters,
  onFilterChange,
  onSelectEntry,
  onExportAuxiliary,
}: AccountingMovementsTabProps) {
  const locations = db.locations || []

  // Extraer terceros únicos disponibles para el filtro
  const thirdParties = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of entries) {
      if (e.thirdPartyName) {
        map.set(e.thirdPartyDoc || e.thirdPartyName, e.thirdPartyName)
      }
    }
    // Agregar clientes y proveedores maestros
    for (const c of (db.customers as any[]) || []) {
      const doc = c.documentNumber || c.document_number || c.id
      const name = c.displayName || c.businessName || c.company_name || `${c.firstName || ''} ${c.lastName || ''}`.trim()
      if (doc && name) map.set(doc, name)
    }
    for (const s of (db.suppliers as any[]) || []) {
      const doc = s.documentNumber || s.nit || s.id
      const name = s.supplierName || s.businessName || s.name || s.commercialName
      if (doc && name) map.set(doc, name)
    }
    return Array.from(map.entries()).map(([doc, name]) => ({ doc, name }))
  }, [entries])

  const currentPeriodMode: PeriodMode = filters.periodMode || 'MONTH'
  const currentYear = filters.year || 2026
  const currentMonth = filters.month || '09'

  const selectedAccount = auxiliaryReport?.selectedAccount || null
  const isSpecificAccount = Boolean(selectedAccount)

  const handlePeriodModeChange = (mode: PeriodMode) => {
    onFilterChange({ periodMode: mode })
  }

  const handleViewEntry = (entryId: string, entryNumber: string) => {
    if (!onSelectEntry) return
    const entry = entries.find((e) => e.id === entryId || e.entryNumber === entryNumber)
    if (entry) {
      onSelectEntry(entry)
    }
  }

  return (
    <div className="space-y-5 page-enter">
      {/* 1. Barra Superior de Control y Periodo */}
      <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-xs space-y-4">
        {/* Fila 1: Título, Atajos Rápidos de Periodo y Exportación */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <AppIcon name="table" size={16} />
              <span>Libro Auxiliar Contable</span>
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Consulta agregada de saldos y movimientos por cuenta PUC y periodo (Año, Mes o Rango).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Selector de Modo de Periodo */}
            <div className="flex items-center bg-gray-100 p-1 rounded-lg">
              <button
                type="button"
                className={`text-xs px-3 py-1 font-semibold rounded-md transition-all ${
                  currentPeriodMode === 'MONTH' ? 'bg-white text-blue-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => handlePeriodModeChange('MONTH')}
              >
                Por Mes
              </button>
              <button
                type="button"
                className={`text-xs px-3 py-1 font-semibold rounded-md transition-all ${
                  currentPeriodMode === 'YEAR' ? 'bg-white text-blue-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => handlePeriodModeChange('YEAR')}
              >
                Por Año
              </button>
              <button
                type="button"
                className={`text-xs px-3 py-1 font-semibold rounded-md transition-all ${
                  currentPeriodMode === 'RANGE' ? 'bg-white text-blue-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => handlePeriodModeChange('RANGE')}
              >
                Rango de Fechas
              </button>
            </div>

            {/* Botón de Exportar Auxiliar */}
            {onExportAuxiliary && (
              <button
                type="button"
                className="outline-button text-xs py-1 px-3 flex items-center gap-1.5"
                onClick={onExportAuxiliary}
              >
                <AppIcon name="download" size={13} />
                <span>Exportar Auxiliar (CSV)</span>
              </button>
            )}
          </div>
        </div>

        {/* Fila 2: Selectores de Fecha según el Modo */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {currentPeriodMode === 'MONTH' && (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-600">Periodo:</span>
              <select
                className="filter-select text-xs font-semibold"
                value={currentMonth}
                onChange={(e) => onFilterChange({ month: e.target.value })}
              >
                {MONTH_NAMES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>

              <select
                className="filter-select text-xs font-semibold"
                value={currentYear}
                onChange={(e) => onFilterChange({ year: Number(e.target.value) })}
              >
                <option value={2026}>2026</option>
                <option value={2025}>2025</option>
                <option value={2024}>2024</option>
              </select>
            </div>
          )}

          {currentPeriodMode === 'YEAR' && (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-600">Año Fiscal:</span>
              <select
                className="filter-select text-xs font-semibold"
                value={currentYear}
                onChange={(e) => onFilterChange({ year: Number(e.target.value) })}
              >
                <option value={2026}>Año 2026</option>
                <option value={2025}>Año 2025</option>
                <option value={2024}>Año 2024</option>
              </select>
            </div>
          )}

          {currentPeriodMode === 'RANGE' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-gray-600">Desde:</span>
              <input
                type="date"
                className="filter-select text-xs"
                value={filters.dateFrom || '2026-09-01'}
                onChange={(e) => onFilterChange({ dateFrom: e.target.value })}
              />
              <span className="font-semibold text-gray-600">Hasta:</span>
              <input
                type="date"
                className="filter-select text-xs"
                value={filters.dateTo || '2026-09-30'}
                onChange={(e) => onFilterChange({ dateTo: e.target.value })}
              />
            </div>
          )}

          {/* Filtro por Tercero */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-600">Tercero:</span>
            <select
              className="filter-select text-xs max-w-[200px]"
              value={filters.thirdPartyId || 'ALL'}
              onChange={(e) => onFilterChange({ thirdPartyId: e.target.value })}
            >
              <option value="ALL">Todos los terceros</option>
              {thirdParties.map((t) => (
                <option key={t.doc} value={t.doc}>
                  {t.name} ({t.doc})
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Centro de Costo / Bodega */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-600">Centro / Bodega:</span>
            <select
              className="filter-select text-xs max-w-[180px]"
              value={filters.locationId || 'ALL'}
              onChange={(e) => onFilterChange({ locationId: e.target.value, costCenterId: e.target.value })}
            >
              <option value="ALL">Todas las bodegas</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Fila 3: Selección de Cuenta y Atajos Rápidos */}
        <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-700 min-w-max">Cuenta Contable:</span>
          <select
            className="filter-select text-xs font-bold text-blue-900 bg-blue-50/50 max-w-sm flex-1"
            value={filters.accountId || 'ALL'}
            onChange={(e) => onFilterChange({ accountId: e.target.value })}
          >
            <option value="ALL">Todas las cuentas (Resumen Consolidado)</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.code} — {acc.name} ({acc.nature === 'DEBIT' ? 'Débito' : 'Crédito'})
              </option>
            ))}
          </select>

          {/* Botones de acceso rápido a cuentas comunes */}
          <div className="flex flex-wrap items-center gap-1">
            {QUICK_ACCOUNT_SHORTCUTS.map((sc) => {
              const isSelected =
                (sc.code === 'ALL' && (!filters.accountId || filters.accountId === 'ALL')) ||
                filters.accountId === sc.code ||
                accounts.find((a) => a.id === filters.accountId)?.code.startsWith(sc.code)

              return (
                <button
                  key={sc.code}
                  type="button"
                  className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                    isSelected
                      ? 'bg-blue-900 text-white font-bold'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                  onClick={() => {
                    if (sc.code === 'ALL') {
                      onFilterChange({ accountId: 'ALL' })
                    } else {
                      const matchedAcc = accounts.find((a) => a.code === sc.code || a.code.startsWith(sc.code))
                      onFilterChange({ accountId: matchedAcc ? matchedAcc.id : sc.code })
                    }
                  }}
                >
                  {sc.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 2. Tarjeta Destacada de Resultados Agrupados (Saldo Inicial, Débitos, Créditos, Saldo Final) */}
      <div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              {isSpecificAccount ? 'Movimiento de la Cuenta' : 'Consolidado General del Periodo'}
            </span>
            <span className="badge badge-blue">
              {auxiliaryReport?.periodLabel || `${MONTH_NAMES.find((m) => m.value === currentMonth)?.label} ${currentYear}`}
            </span>
            {selectedAccount && (
              <span className="text-xs font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {selectedAccount.code} — {selectedAccount.name}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500">
            Naturaleza Cuenta: <strong>{selectedAccount ? (selectedAccount.nature === 'DEBIT' ? 'Débito (+ activo/gasto)' : 'Crédito (+ pasivo/ingreso)') : 'Multi-clase'}</strong>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          {/* Saldo Inicial */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-600 block mb-1">
              Saldo Inicial (Apertura Periodo)
            </span>
            <span className="font-mono text-lg font-bold text-slate-900 block">
              {formatCOP(auxiliaryReport?.initialBalance || 0)}
            </span>
            <span className="text-[10px] text-slate-400 mt-1 block">Acumulado previo a {auxiliaryReport?.dateFrom || 'este mes'}</span>
          </div>

          {/* Movimientos Débito */}
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
            <span className="text-[11px] font-semibold text-emerald-800 block mb-1">
              Movimientos Débito (+)
            </span>
            <span className="font-mono text-lg font-bold text-emerald-900 block">
              +{formatCOP(auxiliaryReport?.totalDebit || 0)}
            </span>
            <span className="text-[10px] text-emerald-600 mt-1 block">Cargos registrados en el periodo</span>
          </div>

          {/* Movimientos Crédito */}
          <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200">
            <span className="text-[11px] font-semibold text-rose-800 block mb-1">
              Movimientos Crédito (-)
            </span>
            <span className="font-mono text-lg font-bold text-rose-900 block">
              -{formatCOP(auxiliaryReport?.totalCredit || 0)}
            </span>
            <span className="text-[10px] text-rose-600 mt-1 block">Abonos registrados en el periodo</span>
          </div>

          {/* Saldo Final */}
          <div className="p-3.5 rounded-xl bg-blue-900 text-white shadow-xs">
            <span className="text-[11px] font-semibold text-blue-200 block mb-1">
              Saldo Final (Cierre Periodo)
            </span>
            <span className="font-mono text-lg font-bold text-white block">
              {formatCOP(auxiliaryReport?.finalBalance || 0)}
            </span>
            <span className="text-[10px] text-blue-300 mt-1 block">Saldo contable neto al cierre</span>
          </div>
        </div>
      </div>

      {/* 3. Si no hay cuenta específica seleccionada, mostrar la tabla de resumen por cuenta */}
      {!isSpecificAccount && (auxiliaryReport?.accountSummaries || []).length > 0 && (
        <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-xs font-bold text-gray-800">
              Resumen por Cuenta Contable en {auxiliaryReport?.periodLabel}
            </h3>
            <span className="text-[11px] text-gray-500">
              {(auxiliaryReport?.accountSummaries || []).length} cuentas con movimiento
            </span>
          </div>

          <div className="table-scroll">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-600 text-left">
                  <th className="py-2 px-3">Código PUC</th>
                  <th className="py-2 px-3">Denominación Cuenta</th>
                  <th className="py-2 px-3">Naturaleza</th>
                  <th className="py-2 px-3 text-right">Saldo Inicial</th>
                  <th className="py-2 px-3 text-right text-emerald-800">Débitos (+)</th>
                  <th className="py-2 px-3 text-right text-rose-800">Créditos (-)</th>
                  <th className="py-2 px-3 text-right font-bold">Saldo Final</th>
                  <th className="py-2 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(auxiliaryReport?.accountSummaries || []).map((summary) => (
                  <tr key={summary.accountId} className="hover:bg-blue-50/30">
                    <td className="py-2 px-3 font-mono font-bold text-blue-900">{summary.accountCode}</td>
                    <td className="py-2 px-3 font-medium text-gray-900">{summary.accountName}</td>
                    <td className="py-2 px-3 text-gray-500">
                      {summary.nature === 'DEBIT' ? 'Débito' : 'Crédito'}
                    </td>
                    <td className="py-2 px-3 font-mono text-right text-gray-600">
                      {formatCOP(summary.initialBalance)}
                    </td>
                    <td className="py-2 px-3 font-mono text-right font-semibold text-emerald-900">
                      {summary.totalDebit > 0 ? formatCOP(summary.totalDebit) : '—'}
                    </td>
                    <td className="py-2 px-3 font-mono text-right font-semibold text-rose-900">
                      {summary.totalCredit > 0 ? formatCOP(summary.totalCredit) : '—'}
                    </td>
                    <td className="py-2 px-3 font-mono text-right font-bold text-gray-900">
                      {formatCOP(summary.finalBalance)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        type="button"
                        className="outline-button text-[11px] py-0.5 px-2"
                        onClick={() => onFilterChange({ accountId: summary.accountId })}
                      >
                        Consultar Auxiliar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Tabla Detallada de Movimientos del Libro Auxiliar */}
      <div className="table-panel animated-table">
        <div className="p-3 bg-gray-50/80 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-800">
              Detalle Cronológico de Movimientos en el Periodo
            </span>
            <span className="badge badge-gray text-[10px]">
              {(auxiliaryReport?.movements || []).length} registros
            </span>
          </div>

          <div className="search-box max-w-xs">
            <AppIcon name="search" size={14} />
            <input
              placeholder="Buscar en descripción o documento..."
              value={filters.query || ''}
              onChange={(e) => onFilterChange({ query: e.target.value })}
            />
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: 95 }}>Fecha</th>
                <th style={{ width: 130 }}>Doc. / Asiento</th>
                <th style={{ width: 100 }}>Cuenta</th>
                <th>Concepto y Descripción</th>
                <th style={{ width: 160 }}>Tercero</th>
                <th style={{ width: 130 }}>Centro / Bodega</th>
                <th style={{ width: 115, textAlign: 'right' }}>Débito</th>
                <th style={{ width: 115, textAlign: 'right' }}>Crédito</th>
                <th style={{ width: 125, textAlign: 'right' }}>Saldo Acumulado</th>
                <th style={{ width: 95, textAlign: 'right' }}>Asiento</th>
              </tr>
            </thead>
            <tbody>
              {(auxiliaryReport?.movements || []).length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-gray-500">
                    No se encontraron movimientos contables registrados para los filtros seleccionados en este periodo.
                  </td>
                </tr>
              ) : (
                (auxiliaryReport?.movements || []).map((mov) => (
                  <tr key={mov.id} className="hover:bg-blue-50/40 transition-colors">
                    <td>
                      <span className="text-xs text-gray-600">{mov.date?.slice(0, 10)}</span>
                    </td>
                    <td>
                      <span className="font-mono text-xs font-bold text-gray-800">
                        {mov.sourceDocumentNumber || mov.entryNumber}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded">
                        {mov.accountCode}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-900 font-medium">{mov.description}</span>
                        <span className="text-[11px] text-gray-500">{mov.accountName}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-800 font-medium">{mov.thirdPartyName || '—'}</span>
                        {mov.thirdPartyDoc && (
                          <span className="text-[10px] text-gray-400 font-mono">{mov.thirdPartyDoc}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="text-xs text-gray-600">{mov.locationName || 'Bodega Principal'}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {mov.debit > 0 ? (
                        <span className="font-mono text-xs font-bold text-emerald-900">
                          +{formatCOP(mov.debit)}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {mov.credit > 0 ? (
                        <span className="font-mono text-xs font-bold text-rose-900">
                          -{formatCOP(mov.credit)}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="font-mono text-xs font-extrabold text-blue-950">
                        {formatCOP(mov.runningBalance)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="outline-button text-[11px] py-0.5 px-2"
                        title="Ver detalle del asiento contable"
                        onClick={() => handleViewEntry(mov.entryId, mov.entryNumber)}
                      >
                        Ver Asiento
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
