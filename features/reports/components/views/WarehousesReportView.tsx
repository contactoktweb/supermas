'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { ComparisonBarChart } from '../ReportCharts'
import { WarehousesReportData, WarehousePerformanceMetrics } from '../../types'
import { displayLabel, LOCATION_TYPE_LABELS } from '@/lib/labels/display-labels'

interface WarehousesReportViewProps {
  data: WarehousesReportData | null
  loading?: boolean
  selectedLocationId?: string
  secondLocationId?: string
  onSelectWarehouse?: (id: string) => void
  onSelectSecondWarehouse?: (id: string) => void
}

export function WarehousesReportView({
  data,
  loading = false,
  selectedLocationId,
  secondLocationId,
  onSelectWarehouse,
  onSelectSecondWarehouse,
}: WarehousesReportViewProps) {
  const warehouses = data?.warehouses || []
  const comparison = data?.comparison

  return (
    <div className="space-y-8">
      {/* Panel Comparativo Bodega A vs Bodega B */}
      {comparison && (
        <section className="bg-white border border-blue-200 rounded-2xl p-6 shadow-xs relative overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">
                Herramienta de Benchmark Multi-Sede
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                Comparativa: {comparison.warehouseA.name} vs {comparison.warehouseB.name}
              </h3>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                Bodega A: {comparison.warehouseA.code}
              </span>
              <span className="text-slate-400 font-bold">VS</span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                Bodega B: {comparison.warehouseB.code}
              </span>
            </div>
          </div>

          <ComparisonBarChart
            categories={['Ventas Totales', 'Compras', 'Valor Inventario', 'Utilidad']}
            seriesA={[
              comparison.warehouseA.salesTotal,
              comparison.warehouseA.purchasesTotal,
              comparison.warehouseA.inventoryValueAtSale,
              comparison.warehouseA.grossProfit || 0,
            ]}
            seriesB={[
              comparison.warehouseB.salesTotal,
              comparison.warehouseB.purchasesTotal,
              comparison.warehouseB.inventoryValueAtSale,
              comparison.warehouseB.grossProfit || 0,
            ]}
            labelA={comparison.warehouseA.name}
            labelB={comparison.warehouseB.name}
          />

          {/* Resumen de Diferenciales */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-4 border-t border-slate-100">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] text-slate-500 block mb-0.5 font-medium">Diferencia en Ventas</span>
              <span
                className={`text-sm font-bold font-mono ${
                  comparison.differences.salesDiff >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {comparison.differences.salesDiff >= 0 ? '+' : ''}$
                {comparison.differences.salesDiff.toLocaleString('es-CO')} (
                {comparison.differences.salesPercentDiff}%)
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] text-slate-500 block mb-0.5 font-medium">Diferencia en Existencias</span>
              <span className="text-sm font-bold font-mono text-slate-900">
                {comparison.differences.inventoryUnitsDiff >= 0 ? '+' : ''}
                {comparison.differences.inventoryUnitsDiff.toLocaleString('es-CO')} unidades
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] text-slate-500 block mb-0.5 font-medium">Diferencia Ticket Promedio</span>
              <span
                className={`text-sm font-bold font-mono ${
                  comparison.differences.ticketDiff >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {comparison.differences.ticketDiff >= 0 ? '+' : ''}$
                {comparison.differences.ticketDiff.toLocaleString('es-CO')}
              </span>
            </div>
          </div>
        </section>
      )}

      {warehouses.some((wh) => wh.grossProfit !== null && wh.grossProfit !== undefined) && (
        <WarehouseProfitabilityTable warehouses={warehouses} />
      )}

      {/* Grid de Rendimiento de Todas las Bodegas */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-wide">
              Rendimiento Operativo y Financiero por Bodega ({warehouses.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Consolidado de ventas, compras, inventario valorizado y clientes por ubicación física
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {warehouses.map((wh) => {
            const isA = wh.locationId === selectedLocationId
            const isB = wh.locationId === secondLocationId

            return (
              <div
                key={wh.locationId}
                className={`p-5 rounded-2xl bg-white border transition-all duration-200 flex flex-col justify-between shadow-xs hover:shadow-md ${
                  isA
                    ? 'border-blue-500 ring-2 ring-blue-500/20'
                    : isB
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {wh.code}
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">
                      {displayLabel(LOCATION_TYPE_LABELS, wh.type)}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mb-3 truncate">{wh.name}</h4>

                  <div className="space-y-2 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans text-[11px]">Ventas:</span>
                      <span className="text-emerald-700 font-bold">
                        ${wh.salesTotal.toLocaleString('es-CO')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans text-[11px]">Facturas:</span>
                      <span className="text-slate-800 font-medium">{wh.salesCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans text-[11px]">Ticket Prom.:</span>
                      <span className="text-blue-700 font-semibold">${wh.averageTicket.toLocaleString('es-CO')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans text-[11px]">Compras:</span>
                      <span className="text-slate-700">${wh.purchasesTotal.toLocaleString('es-CO')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans text-[11px]">Existencias:</span>
                      <span className="text-slate-800 font-medium">{wh.inventoryUnits.toLocaleString('es-CO')} u.</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans text-[11px]">Valor Venta:</span>
                      <span className="text-amber-700 font-bold">
                        ${wh.inventoryValueAtSale.toLocaleString('es-CO')}
                      </span>
                    </div>
                    {wh.grossProfit !== null && wh.grossProfit !== undefined && (
                      <div className="flex justify-between pt-1.5 border-t border-slate-100">
                        <span className="text-slate-600 font-sans text-[11px] font-medium">Utilidad sin IVA:</span>
                        <span className="text-emerald-700 font-bold">
                          ${wh.grossProfit.toLocaleString('es-CO')} ({wh.grossMarginPercent}%)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-sans">
                  <span>{wh.activeCustomersCount} clientes</span>
                  <span>{wh.movementsCount} movs.</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

const formatMoney = (value: number) => `$${Math.round(value).toLocaleString('es-CO')}`

/** Utilidad sin impuestos y rentabilidad de cada punto, de mayor a menor utilidad. */
function WarehouseProfitabilityTable({ warehouses }: { warehouses: WarehousePerformanceMetrics[] }) {
  const rows = [...warehouses].sort((a, b) => (b.grossProfit || 0) - (a.grossProfit || 0))
  const totals = rows.reduce(
    (acc, wh) => ({
      net: acc.net + wh.netSalesTotal,
      tax: acc.tax + wh.taxTotal,
      cost: acc.cost + (wh.costOfSales || 0),
      profit: acc.profit + (wh.grossProfit || 0),
    }),
    { net: 0, tax: 0, cost: 0, profit: 0 }
  )
  const totalMargin = totals.net > 0 ? ((totals.profit / totals.net) * 100).toFixed(1) : '0.0'
  const totalReturn = totals.cost > 0 ? ((totals.profit / totals.cost) * 100).toFixed(1) : '0.0'

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs" aria-labelledby="warehouse-profitability-title">
      <h3 id="warehouse-profitability-title" className="text-sm font-bold text-slate-900 tracking-wide">
        Rentabilidad por punto (utilidad sin impuestos)
      </h3>
      <p className="text-xs text-slate-500 mt-0.5 mb-4">
        Ventas sin IVA menos el costo de lo vendido en cada bodega. Excluye ventas anuladas.
      </p>
      <div className="table-scroll">
        <table className="products-table">
          <thead>
            <tr>
              <th>Bodega</th>
              <th className="text-right">Ventas sin IVA</th>
              <th className="text-right">IVA</th>
              <th className="text-right">Costo de ventas</th>
              <th className="text-right">Utilidad</th>
              <th className="text-right">Margen</th>
              <th className="text-right">Rentab. s/costo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((wh) => (
              <tr key={wh.locationId}>
                <td>
                  <strong className="text-slate-900">{wh.name}</strong>
                  <span className="block text-[11px] text-slate-500 font-mono">{wh.code}</span>
                </td>
                <td className="text-right font-mono">{formatMoney(wh.netSalesTotal)}</td>
                <td className="text-right font-mono text-slate-500">{formatMoney(wh.taxTotal)}</td>
                <td className="text-right font-mono">{formatMoney(wh.costOfSales || 0)}</td>
                <td className={`text-right font-mono font-bold ${(wh.grossProfit || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {formatMoney(wh.grossProfit || 0)}
                </td>
                <td className="text-right font-mono">{wh.grossMarginPercent ?? 0}%</td>
                <td className="text-right font-mono">{wh.returnOnCostPercent ?? 0}%</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td className="text-right font-mono font-bold">{formatMoney(totals.net)}</td>
              <td className="text-right font-mono text-slate-500">{formatMoney(totals.tax)}</td>
              <td className="text-right font-mono font-bold">{formatMoney(totals.cost)}</td>
              <td className="text-right font-mono font-bold text-emerald-700">{formatMoney(totals.profit)}</td>
              <td className="text-right font-mono font-bold">{totalMargin}%</td>
              <td className="text-right font-mono font-bold">{totalReturn}%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
