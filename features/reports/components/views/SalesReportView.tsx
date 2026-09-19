'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { ReportStatsCard } from '../ReportStatsCard'
import { TrendLineChart, DistributionBarList } from '../ReportCharts'
import { SalesReportData, SalesReportRow } from '../../types'

interface SalesReportViewProps {
  data: SalesReportData | null
  loading?: boolean
  onViewDetail?: (row: SalesReportRow) => void
}

export function SalesReportView({
  data,
  loading = false,
  onViewDetail,
}: SalesReportViewProps) {
  const summary = data?.summary

  return (
    <div className="space-y-8">
      {/* 6 KPIs de Ventas */}
      <section aria-label="Resumen de Ventas">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
          <ReportStatsCard
            title="Ventas Totales"
            value={summary?.totalSales ?? 0}
            format="currency"
            iconName="sales"
            accentColor="#10b981"
            loading={loading}
          />
          <ReportStatsCard
            title="Documentos"
            value={summary?.documentCount ?? 0}
            format="number"
            iconName="invoices"
            accentColor="#3b82f6"
            loading={loading}
          />
          <ReportStatsCard
            title="Ticket Promedio"
            value={summary?.averageTicket ?? 0}
            format="currency"
            iconName="receipt"
            accentColor="#8b5cf6"
            loading={loading}
          />
          <ReportStatsCard
            title="Unidades Vendidas"
            value={summary?.totalItemsSold ?? 0}
            format="number"
            iconName="products"
            accentColor="#f59e0b"
            loading={loading}
          />
          <ReportStatsCard
            title="Descuentos Otorgados"
            value={summary?.totalDiscounts ?? 0}
            format="currency"
            iconName="sparkles"
            accentColor="#ec4899"
            loading={loading}
          />
          <ReportStatsCard
            title="IVA / Impuestos"
            value={summary?.totalTaxes ?? 0}
            format="currency"
            iconName="taxes"
            accentColor="#06b6d4"
            loading={loading}
          />
        </div>
      </section>

      {/* Gráficos de Análisis */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TrendLineChart
            points={data?.byDay || []}
            title="Evolución Diaria de Ventas"
            subtitle="Ingresos brutos facturados por jornada comercial"
            strokeColor="#10b981"
            gradientId="salesDayTrend"
            format="currency"
          />
        </div>
        <div>
          <DistributionBarList
            items={data?.byWarehouse || []}
            title="Ventas por Bodega / Sucursal"
            subtitle="Participación sobre el total facturado"
            format="currency"
          />
        </div>
      </section>

      {/* Distribución por Categoría y Desempeño por Vendedor */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DistributionBarList
          items={data?.byCategory || []}
          title="Ventas por Línea y Categoría"
          subtitle="Distribución porcentual por familias de producto"
          format="currency"
        />

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 tracking-wide mb-1">
            Desempeño Comercial por Vendedor
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Volumen acumulado y cantidad de facturas emitidas
          </p>
          <div className="space-y-3">
            {data?.bySeller?.map((seller) => (
              <div
                key={seller.sellerName}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                    <AppIcon name="users" size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">{seller.sellerName}</span>
                    <span className="text-[11px] text-slate-500 font-medium">{seller.documentCount} transacciones</span>
                  </div>
                </div>
                <div className="text-right font-mono">
                  <span className="text-xs font-bold text-emerald-700 block">
                    ${seller.totalSales.toLocaleString('es-CO')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tabla Detallada de Documentos de Venta */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-wide">
              Documentos de Venta ({data?.rows?.length || 0})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Registro auditado de transacciones comerciales emitidas
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600 uppercase tracking-wider font-bold text-[11px] bg-slate-50">
                <th className="py-2.5 px-3">Fecha</th>
                <th className="py-2.5 px-3">Doc / Factura</th>
                <th className="py-2.5 px-3">Cliente</th>
                <th className="py-2.5 px-3">Vendedor</th>
                <th className="py-2.5 px-3">Bodega</th>
                <th className="py-2.5 px-3">Método Pago</th>
                <th className="py-2.5 px-3 text-right">Items</th>
                <th className="py-2.5 px-3 text-right">Total Venta</th>
                <th className="py-2.5 px-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {data?.rows?.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-3 text-slate-600 font-sans">
                    {new Date(row.date).toLocaleDateString('es-CO', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-3 px-3 font-bold text-blue-600">{row.invoiceNumber}</td>
                  <td className="py-3 px-3 font-sans text-slate-900 font-bold">
                    <div>{row.customerName}</div>
                    <div className="text-[10px] text-slate-500 font-mono font-normal">{row.customerDoc}</div>
                  </td>
                  <td className="py-3 px-3 font-sans text-slate-600 font-medium">{row.sellerName}</td>
                  <td className="py-3 px-3 font-sans text-slate-700 font-semibold">{row.locationName}</td>
                  <td className="py-3 px-3">
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                      {row.paymentMethod}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right text-slate-600 font-semibold">{row.itemsCount}</td>
                  <td className="py-3 px-3 text-right font-bold text-slate-950">
                    ${row.total.toLocaleString('es-CO')}
                  </td>
                  <td className="py-3 px-3 text-center font-sans">
                    {onViewDetail && (
                      <button
                        onClick={() => onViewDetail(row)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-600 text-slate-600 hover:text-white transition-colors"
                        title="Ver detalle de transacción"
                      >
                        <AppIcon name="eye" size={14} />
                      </button>
                    )}
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
