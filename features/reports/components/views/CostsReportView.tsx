'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { ReportStatsCard } from '../ReportStatsCard'
import { TrendLineChart, DistributionBarList } from '../ReportCharts'
import { CostsReportData, CostAnalysisReportRow } from '../../types'

interface CostsReportViewProps {
  data: CostsReportData | null
  loading?: boolean
  onViewDetail?: (row: CostAnalysisReportRow) => void
}

export function CostsReportView({
  data,
  loading = false,
  onViewDetail,
}: CostsReportViewProps) {
  const summary = data?.summary

  // Si el usuario no tiene permisos para ver costos
  if (summary && summary.costOfGoodsSold === null) {
    return (
      <div className="p-8 rounded-2xl bg-rose-950/20 border border-rose-800/40 text-center max-w-lg mx-auto my-12">
        <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3">
          <AppIcon name="lock" size={24} />
        </div>
        <h2 className="text-base font-bold text-white mb-1">Acceso Financiero Restringido</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Tu rol de usuario no cuenta con el permiso analítico <code>reports.costs</code> para visualizar
          costos reales de adquisición, costos de mercancía vendida (CMV) ni márgenes de utilidad.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Formula visual: Ventas - CMV = Utilidad Bruta */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">
              Ecuación Económica del Negocio
            </span>
            <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
              Ventas Netas - Costo de Mercancía Vendida (CMV) = Utilidad Bruta
            </h3>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 font-mono text-sm">
            <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-sans font-medium block">Ventas</span>
              <span className="text-emerald-700 font-bold">
                ${(summary?.totalRevenue ?? 0).toLocaleString('es-CO')}
              </span>
            </div>
            <span className="text-slate-400 font-bold">-</span>
            <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-sans font-medium block">CMV</span>
              <span className="text-rose-700 font-bold">
                ${(summary?.costOfGoodsSold ?? 0).toLocaleString('es-CO')}
              </span>
            </div>
            <span className="text-slate-400 font-bold">=</span>
            <div className="px-3.5 py-2 rounded-xl bg-blue-50 border border-blue-200">
              <span className="text-[10px] text-blue-700 font-sans font-bold block">Utilidad</span>
              <span className="text-blue-700 font-bold">
                ${(summary?.grossProfit ?? 0).toLocaleString('es-CO')}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 4 KPIs de Costos y Margen */}
      <section aria-label="Resumen de Costos y Utilidad">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ReportStatsCard
            title="Ingresos Totales (Ventas)"
            value={summary?.totalRevenue ?? 0}
            format="currency"
            subtitle={`${summary?.unitsSoldTotal ?? 0} unidades despachadas`}
            iconName="sales"
            accentColor="#10b981"
            loading={loading}
          />
          <ReportStatsCard
            title="Costo de Mercancía (CMV)"
            value={summary?.costOfGoodsSold ?? 0}
            format="currency"
            subtitle="Costo de adquisición promedio"
            iconName="purchases"
            accentColor="#ef4444"
            loading={loading}
          />
          <ReportStatsCard
            title="Utilidad Bruta"
            value={summary?.grossProfit ?? 0}
            format="currency"
            subtitle="Rendimiento antes de gastos operativos"
            iconName="accounting"
            accentColor="#3b82f6"
            loading={loading}
          />
          <ReportStatsCard
            title="Margen Bruto Porcentual"
            value={summary?.grossMarginPercent ?? 0}
            format="percent"
            subtitle="Utilidad / Ingresos totales"
            iconName="pieChart"
            accentColor="#ec4899"
            loading={loading}
          />
        </div>
      </section>

      {/* Gráfico de Tendencia Mensual */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TrendLineChart
            points={data?.monthlyTrend || []}
            title="Evolución Histórica de Ingresos vs CMV"
            subtitle="Curva mensual de rentabilidad comercial"
            strokeColor="#3b82f6"
            gradientId="costsTrendGradient"
            format="currency"
          />
        </div>
        <div>
          <DistributionBarList
            items={
              data?.byCategory.map((c) => ({
                label: c.category,
                value: c.profit || 0,
                percentage: c.marginPercent || 0,
              })) || []
            }
            title="Utilidad por Categoría"
            subtitle="Aporte a la ganancia bruta y margen"
            format="currency"
          />
        </div>
      </section>

      {/* Desglose por Bodega */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 tracking-wide mb-1">
          Rentabilidad Desglosada por Bodega / Sucursal
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Ingresos, CMV, utilidad bruta y margen porcentual por ubicación
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {data?.byWarehouse.map((w) => (
            <div
              key={w.warehouseName}
              className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between"
            >
              <div className="flex items-center gap-2 mb-2">
                <AppIcon name="warehouse" size={16} className="text-blue-600" />
                <span className="text-xs font-bold text-slate-900 truncate">{w.warehouseName}</span>
              </div>
              <div className="space-y-1.5 font-mono text-xs mt-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans text-[11px]">Ventas:</span>
                  <span className="text-slate-900 font-bold">${w.revenue.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans text-[11px]">CMV:</span>
                  <span className="text-rose-700 font-bold">${(w.cost || 0).toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-500 font-sans text-[11px]">Utilidad:</span>
                  <span className="text-emerald-700 font-bold">
                    ${(w.profit || 0).toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans text-[11px]">Margen:</span>
                  <span className="text-purple-700 font-bold">{w.marginPercent}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tabla Detallada por Producto */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-wide">
              Análisis de Rentabilidad por Producto ({data?.rows?.length || 0})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Costo unitario promedio ponderado, precio de venta, ganancia bruta y margen
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600 uppercase tracking-wider font-bold text-[11px] bg-slate-50">
                <th className="py-2.5 px-3">SKU</th>
                <th className="py-2.5 px-3">Producto</th>
                <th className="py-2.5 px-3">Categoría</th>
                <th className="py-2.5 px-3 text-right">Vendidos</th>
                <th className="py-2.5 px-3 text-right">Precio Venta</th>
                <th className="py-2.5 px-3 text-right">Costo Prom.</th>
                <th className="py-2.5 px-3 text-right">Ingresos</th>
                <th className="py-2.5 px-3 text-right">CMV Total</th>
                <th className="py-2.5 px-3 text-right text-emerald-700">Utilidad</th>
                <th className="py-2.5 px-3 text-right text-purple-700">Margen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {data?.rows?.map((row) => (
                <tr key={row.productId} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-3 text-slate-500 font-medium">{row.sku}</td>
                  <td className="py-3 px-3 font-sans text-slate-900 font-bold">{row.name}</td>
                  <td className="py-3 px-3 font-sans text-slate-700 font-medium">{row.category}</td>
                  <td className="py-3 px-3 text-right text-slate-900 font-bold">{row.unitsSold}</td>
                  <td className="py-3 px-3 text-right text-slate-900 font-semibold">
                    ${row.averageSellingPrice.toLocaleString('es-CO')}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-600">
                    ${(row.averageCost || 0).toLocaleString('es-CO')}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-950">
                    ${row.totalRevenue.toLocaleString('es-CO')}
                  </td>
                  <td className="py-3 px-3 text-right text-rose-700 font-semibold">
                    ${(row.totalCostOfGoodsSold || 0).toLocaleString('es-CO')}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-emerald-700">
                    ${(row.grossProfit || 0).toLocaleString('es-CO')}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-purple-700">
                    {row.grossMarginPercent}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
