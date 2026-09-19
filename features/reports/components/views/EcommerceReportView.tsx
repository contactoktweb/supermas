'use client'

import React from 'react'
import Link from 'next/link'
import { AppIcon } from '@/components/ui/Icon'
import { ReportStatsCard } from '../ReportStatsCard'
import { DistributionBarList } from '../ReportCharts'
import { EcommerceReportData } from '../../types'

interface EcommerceReportViewProps {
  data: EcommerceReportData | null
  loading?: boolean
}

export function EcommerceReportView({
  data,
  loading = false,
}: EcommerceReportViewProps) {
  const summary = data?.summary
  const comp = data?.comparisonWebVsPos

  return (
    <div className="space-y-8">
      {/* KPIs de Ecommerce B2C */}
      <section aria-label="Resumen de Ecommerce">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
          <ReportStatsCard
            title="Pedidos Web Totales"
            value={summary?.webOrdersTotalCount ?? 0}
            format="number"
            iconName="webOrders"
            accentColor="#ef4444"
            loading={loading}
          />
          <ReportStatsCard
            title="Ventas Web (COP)"
            value={summary?.webSalesTotalRevenue ?? 0}
            format="currency"
            iconName="sales"
            accentColor="#10b981"
            loading={loading}
          />
          <ReportStatsCard
            title="Ticket Promedio Web"
            value={summary?.averageWebOrderValue ?? 0}
            format="currency"
            iconName="receipt"
            accentColor="#3b82f6"
            loading={loading}
          />
          <ReportStatsCard
            title="Pedidos Despachados"
            value={summary?.completedOrdersCount ?? 0}
            format="number"
            iconName="check"
            accentColor="#8b5cf6"
            loading={loading}
          />
          <ReportStatsCard
            title="Tasa de Cancelación"
            value={summary?.cancellationRatePercent ?? 0}
            format="percent"
            subtitle={`${summary?.cancelledOrdersCount ?? 0} cancelados`}
            iconName="close"
            accentColor="#f59e0b"
            loading={loading}
          />
          <ReportStatsCard
            title="Tiempo Prep. Logística"
            value={`${summary?.averagePrepMinutes ?? 0} min`}
            format="raw"
            subtitle="CEDI a transportadora"
            iconName="clock"
            accentColor="#06b6d4"
            loading={loading}
          />
        </div>
      </section>

      {/* Benchmark: Ventas Web vs Ventas POS */}
      {comp && (
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="flex justify-between items-center mb-6">
            <div>
              <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider block">
                Análisis Multicanal
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                Comparativa de Canales: Tienda Online vs Punto de Venta Físico (POS)
              </h3>
            </div>
            <Link
              href="/pedidos-web"
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 transition-colors"
            >
              Ir a Pedidos Web <AppIcon name="chevronRight" size={12} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Canal Web */}
            <div className="p-5 rounded-xl bg-red-50/30 border border-red-200/80">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-red-100 text-red-600 border border-red-200">
                    <AppIcon name="webOrders" size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Canal Ecommerce Super Más</h4>
                    <span className="text-[11px] text-slate-500">Venta online y catálogo web B2C</span>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                  {comp.webSharePercent}% share
                </span>
              </div>
              <div className="space-y-2 font-mono text-xs mt-4">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans text-[11px]">Facturación Canal:</span>
                  <span className="text-slate-950 font-extrabold text-sm">
                    ${comp.webRevenue.toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans text-[11px]">Ticket Promedio:</span>
                  <span className="text-red-700 font-bold">
                    ${comp.webTicket.toLocaleString('es-CO')}
                  </span>
                </div>
              </div>
            </div>

            {/* Canal Físico POS */}
            <div className="p-5 rounded-xl bg-blue-50/30 border border-blue-200/80">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-600 border border-blue-200">
                    <AppIcon name="pos" size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Puntos de Venta Físicos (POS)</h4>
                    <span className="text-[11px] text-slate-500">Ventas directas en mostrador</span>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">
                  {comp.posSharePercent}% share
                </span>
              </div>
              <div className="space-y-2 font-mono text-xs mt-4">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans text-[11px]">Facturación Canal:</span>
                  <span className="text-slate-950 font-extrabold text-sm">
                    ${comp.posRevenue.toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans text-[11px]">Ticket Promedio:</span>
                  <span className="text-blue-700 font-bold">
                    ${comp.posTicket.toLocaleString('es-CO')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Distribución por Estado y Top Productos Web */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DistributionBarList
          items={data?.ordersByStatus || []}
          title="Distribución de Pedidos por Estado"
          subtitle="Pendientes, confirmados, en ruta y entregados"
          format="number"
        />

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 tracking-wide mb-1">
            Top Artículos Vendidos por la Tienda Online
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Productos con mayor demanda en el carrito de compras
          </p>

          <div className="space-y-3">
            {data?.topWebProducts.map((p, idx) => (
              <div
                key={p.productId}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-red-100 text-red-700 font-mono text-xs font-bold flex items-center justify-center border border-red-200">
                    {idx + 1}
                  </span>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">{p.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{p.sku}</span>
                  </div>
                </div>
                <div className="text-right font-mono">
                  <span className="text-xs font-bold text-emerald-700 block">
                    ${p.revenue.toLocaleString('es-CO')}
                  </span>
                  <span className="text-[10px] text-slate-500">{p.quantity} unidades</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
