'use client'

import React from 'react'
import Link from 'next/link'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { ReportStatsCard } from '../ReportStatsCard'
import { TrendLineChart, DistributionBarList } from '../ReportCharts'
import { ReportDashboardOverview, ReportCardNavInfo } from '../../types'

interface ReportDashboardViewProps {
  data: ReportDashboardOverview | null
  navCards: ReportCardNavInfo[]
  loading?: boolean
}

export function ReportDashboardView({
  data,
  navCards,
  loading = false,
}: ReportDashboardViewProps) {
  const kpis = data?.kpis

  return (
    <div className="space-y-6">
      {/* 4 Métricas Globales Principales */}
      <section className="stats-grid products-stats" aria-label="Indicadores clave de rendimiento">
        <ReportStatsCard
          title="Ventas Totales"
          value={kpis?.salesTotal ?? 0}
          format="currency"
          subtitle={`${kpis?.salesCount ?? 0} facturas procesadas`}
          trendPercent={kpis?.salesChangePercent ?? 12.4}
          iconName="sales"
          tone="teal"
          loading={loading}
        />
        <ReportStatsCard
          title="Valor del Inventario"
          value={kpis?.inventoryValueAtSale ?? 0}
          format="currency"
          subtitle={`${kpis?.availableProductsCount ?? 0} disponibles · ${
            kpis?.outOfStockProductsCount ?? 0
          } agotados`}
          iconName="inventory"
          tone="blue"
          loading={loading}
        />
        <ReportStatsCard
          title="Compras del Periodo"
          value={kpis?.purchasesTotal ?? 0}
          format="currency"
          subtitle={`${kpis?.activeSuppliersCount ?? 0} proveedores activos`}
          iconName="purchases"
          tone="amber"
          loading={loading}
        />
        <ReportStatsCard
          title="Margen Bruto Global"
          value={kpis?.grossMarginPercent !== null && kpis?.grossMarginPercent !== undefined ? kpis.grossMarginPercent : 'Confidencial'}
          format={typeof kpis?.grossMarginPercent === 'number' ? 'percent' : 'raw'}
          subtitle={
            kpis?.grossProfit !== null && kpis?.grossProfit !== undefined
              ? `Utilidad: $${kpis.grossProfit.toLocaleString('es-CO')}`
              : 'Acceso financiero restringido'
          }
          iconName="accounting"
          tone="red"
          loading={loading}
        />
      </section>

      {/* Gráficos de Tendencia y Distribución */}
      <div className="dashboard-grid analytics-grid">
        <TrendLineChart
          points={data?.salesTrend || []}
          title="Tendencia de Ventas Diarias"
          subtitle="Comportamiento del flujo de facturación en el periodo seleccionado"
          strokeColor="#fe110c"
          gradientId="salesDailyTrend"
          format="currency"
        />
        <DistributionBarList
          items={data?.categoryDistribution || []}
          title="Ventas por Categoría"
          subtitle="Participación sobre el total facturado"
          format="currency"
        />
      </div>

      {/* 12 Tarjetas de Acceso Especializado */}
      <section className="panel" aria-labelledby="reports-categories-heading">
        <div className="panel-heading" style={{ marginBottom: 20 }}>
          <div>
            <h2 id="reports-categories-heading">Módulos de Reportes Analíticos</h2>
            <p>Selecciona una categoría para explorar métricas detalladas, gráficos y tablas de auditoría</p>
          </div>
          <span className="text-xs text-slate-500 font-mono font-semibold">
            {navCards.length} reportes disponibles
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {navCards.map((card, idx) => {
            return (
              <Link
                key={card.id}
                href={card.href}
                className="group relative bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-slate-300 rounded-xl p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-1 flex flex-col justify-between overflow-hidden"
                style={{
                  animationDelay: `${idx * 30}ms`,
                }}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105 duration-200"
                      style={{
                        backgroundColor: `${card.accentColor}14`,
                        border: `1px solid ${card.accentColor}25`,
                      }}
                    >
                      <AppIcon
                        name={card.iconName as LightIconName}
                        size={18}
                        color={card.accentColor}
                      />
                    </div>
                    {card.tag && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {card.tag}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {card.description}
                  </p>
                </div>

                <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium text-[11px]">
                    {card.primaryMetricLabel}
                  </span>
                  <div className="flex items-center gap-1 font-bold text-slate-900 group-hover:translate-x-0.5 transition-transform">
                    <span className="font-mono text-xs text-slate-800 font-bold">{card.primaryMetricValue}</span>
                    <AppIcon name="chevronRight" size={12} className="text-slate-400 group-hover:text-slate-800" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Ranking de Productos Más Vendidos */}
      {data?.topSellingProducts && data.topSellingProducts.length > 0 && (
        <section className="panel table-panel">
          <div className="panel-heading" style={{ marginBottom: 16 }}>
            <div>
              <h2>Top 5 Productos con Mayor Facturación</h2>
              <p>Artículos con mayor volumen de ingresos en el periodo</p>
            </div>
            <Link
              href="/reportes/ventas"
              className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 transition-colors"
            >
              Ver reporte ventas completo <AppIcon name="chevronRight" size={12} />
            </Link>
          </div>

          <div className="table-scroll">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 uppercase tracking-wider font-bold text-[11px] bg-slate-50">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Producto</th>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3 text-right">Unidades Vendidas</th>
                  <th className="py-2.5 px-3 text-right">Ingresos Totales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {data.topSellingProducts.map((prod, idx) => (
                  <tr key={prod.productId} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 text-slate-400 font-sans font-bold">{idx + 1}</td>
                    <td className="py-3 px-3 text-slate-900 font-sans font-bold">{prod.name}</td>
                    <td className="py-3 px-3 text-slate-500 font-medium">{prod.sku}</td>
                    <td className="py-3 px-3 text-right text-slate-700 font-semibold">
                      {prod.quantitySold.toLocaleString('es-CO')}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-700 font-bold">
                      ${prod.revenue.toLocaleString('es-CO')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
