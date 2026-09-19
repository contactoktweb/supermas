'use client'

import React from 'react'
import { IncomeStatementReport } from '../../types'
import { db } from '@/lib/supabase/db'

interface AccountingIncomeStatementTabProps {
  incomeStatement: IncomeStatementReport | null
  locationId?: string
  onLocationChange: (locId: string) => void
}

export function AccountingIncomeStatementTab({
  incomeStatement,
  locationId = 'ALL',
  onLocationChange,
}: AccountingIncomeStatementTabProps) {
  if (!incomeStatement) return null

  const locations = db.locations || []

  return (
    <div className="space-y-6 page-enter">
      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Estado de Resultados Integral (Pérdidas y Ganancias)</h2>
          <p className="text-xs text-gray-500">
            Periodo: {incomeStatement.period} {incomeStatement.locationName ? `— Bodega: ${incomeStatement.locationName}` : '— Consolidado Corporativo'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-gray-600">Filtrar por Bodega:</label>
          <select
            className="filter-select text-xs"
            value={locationId}
            onChange={(e) => onLocationChange(e.target.value)}
          >
            <option value="ALL">Todas las bodegas (Consolidado)</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tarjetas Resumen de Márgenes */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100">
          <span className="text-[11px] font-semibold text-blue-700 uppercase block mb-1">Ingresos Operacionales</span>
          <strong className="text-lg font-mono text-blue-950">${incomeStatement.totalRevenues.toLocaleString('es-CO')}</strong>
          <span className="text-[11px] text-blue-600 block mt-1">100% de la venta facturada</span>
        </div>

        <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-100">
          <span className="text-[11px] font-semibold text-rose-700 uppercase block mb-1">Costo de Mercancías</span>
          <strong className="text-lg font-mono text-rose-950">${incomeStatement.totalCosts.toLocaleString('es-CO')}</strong>
          <span className="text-[11px] text-rose-600 block mt-1">
            {((incomeStatement.totalCosts / incomeStatement.totalRevenues) * 100).toFixed(1)}% de los ingresos
          </span>
        </div>

        <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-100">
          <span className="text-[11px] font-semibold text-amber-700 uppercase block mb-1">Gastos de Operación</span>
          <strong className="text-lg font-mono text-amber-950">${incomeStatement.totalOperatingExpenses.toLocaleString('es-CO')}</strong>
          <span className="text-[11px] text-amber-600 block mt-1">Personal, arriendos y logística</span>
        </div>

        <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-100">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase block mb-1">Utilidad Neta</span>
          <strong className="text-lg font-mono text-emerald-950">${incomeStatement.netProfit.toLocaleString('es-CO')}</strong>
          <span className="text-[11px] text-emerald-600 block mt-1">Margen Neto: {incomeStatement.netMarginPercent}%</span>
        </div>
      </div>

      {/* Estructura Formal del Estado de Resultados */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-4 bg-gray-50 border-b flex items-center justify-between text-xs font-bold text-gray-700 uppercase tracking-wider">
          <span>Concepto Contable</span>
          <span>Valor (COP)</span>
        </div>

        <div className="divide-y divide-gray-100 text-xs">
          {/* 1. Ingresos */}
          <div className="p-4 space-y-2">
            <div className="flex items-center justify-between font-bold text-gray-900">
              <span className="text-sm">INGRESOS OPERACIONALES</span>
              <span className="font-mono text-sm text-emerald-700">${incomeStatement.totalRevenues.toLocaleString('es-CO')}</span>
            </div>
            <div className="pl-4 space-y-1.5 pt-1 text-gray-600">
              {incomeStatement.operatingRevenues.map((r) => (
                <div key={r.code} className="flex items-center justify-between">
                  <span>{r.code} - {r.name}</span>
                  <span className="font-mono">${r.balance.toLocaleString('es-CO')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Menos Costo de Ventas */}
          <div className="p-4 space-y-2 bg-gray-50/40">
            <div className="flex items-center justify-between font-bold text-gray-900">
              <span className="text-sm">(-) COSTO DE VENTAS</span>
              <span className="font-mono text-sm text-rose-700">(${incomeStatement.totalCosts.toLocaleString('es-CO')})</span>
            </div>
            <div className="pl-4 space-y-1.5 pt-1 text-gray-600">
              {incomeStatement.costOfSales.map((c) => (
                <div key={c.code} className="flex items-center justify-between">
                  <span>{c.code} - {c.name}</span>
                  <span className="font-mono">${c.balance.toLocaleString('es-CO')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Utilidad Bruta */}
          <div className="p-4 bg-blue-50/40 flex items-center justify-between font-bold text-sm text-blue-950">
            <span>(=) UTILIDAD BRUTA EN VENTAS</span>
            <div className="text-right">
              <span className="font-mono">${incomeStatement.grossProfit.toLocaleString('es-CO')}</span>
              <span className="block text-[11px] text-blue-700 font-normal">Margen Bruto: {incomeStatement.grossMarginPercent}%</span>
            </div>
          </div>

          {/* 4. Gastos Operacionales */}
          <div className="p-4 space-y-2">
            <div className="flex items-center justify-between font-bold text-gray-900">
              <span className="text-sm">(-) GASTOS OPERACIONALES</span>
              <span className="font-mono text-sm text-amber-700">(${incomeStatement.totalOperatingExpenses.toLocaleString('es-CO')})</span>
            </div>
            <div className="pl-4 space-y-1.5 pt-1 text-gray-600">
              <div className="font-medium text-gray-700">Gastos de Administración:</div>
              {incomeStatement.administrativeExpenses.map((a) => (
                <div key={a.code} className="flex items-center justify-between pl-3">
                  <span>{a.code} - {a.name}</span>
                  <span className="font-mono">${a.balance.toLocaleString('es-CO')}</span>
                </div>
              ))}
              <div className="font-medium text-gray-700 pt-1">Gastos de Venta y Mercadeo:</div>
              {incomeStatement.sellingExpenses.map((s) => (
                <div key={s.code} className="flex items-center justify-between pl-3">
                  <span>{s.code} - {s.name}</span>
                  <span className="font-mono">${s.balance.toLocaleString('es-CO')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 5. Utilidad Operacional */}
          <div className="p-4 bg-gray-50 flex items-center justify-between font-bold text-xs text-gray-800">
            <span>(=) UTILIDAD OPERACIONAL</span>
            <span className="font-mono">${incomeStatement.operatingProfit.toLocaleString('es-CO')}</span>
          </div>

          {/* 6. No Operacionales */}
          <div className="p-4 flex items-center justify-between text-gray-600">
            <span>(+) Ingresos Financieros y No Operacionales (4210)</span>
            <span className="font-mono text-emerald-700">+${incomeStatement.nonOperatingIncome.toLocaleString('es-CO')}</span>
          </div>

          {/* 7. UTILIDAD NETA FINAL */}
          <div className="p-5 bg-emerald-900 text-white flex items-center justify-between font-bold">
            <div>
              <span className="text-base tracking-wide uppercase">(=) UTILIDAD NETA DEL EJERCICIO</span>
              <span className="block text-xs text-emerald-200 font-normal mt-0.5">
                Resultado final disponible para reservas y distribución de socios
              </span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-mono">${incomeStatement.netProfit.toLocaleString('es-CO')}</span>
              <span className="block text-xs text-emerald-300 font-normal">Margen Neto: {incomeStatement.netMarginPercent}%</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
