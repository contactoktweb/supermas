'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { ReportStatsCard } from '../ReportStatsCard'
import { DistributionBarList } from '../ReportCharts'
import { CustomersReportData, CustomerReportRow } from '../../types'

interface CustomersReportViewProps {
  data: CustomersReportData | null
  loading?: boolean
  onViewDetail?: (row: CustomerReportRow) => void
}

export function CustomersReportView({
  data,
  loading = false,
  onViewDetail,
}: CustomersReportViewProps) {
  const summary = data?.summary

  return (
    <div className="space-y-8">
      {/* KPIs de Clientes */}
      <section aria-label="Resumen de Clientes">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ReportStatsCard
            title="Clientes Registrados"
            value={summary?.totalCustomersCount ?? 0}
            format="number"
            subtitle={`${summary?.activeCustomersCount ?? 0} compradores activos`}
            iconName="customers"
            accentColor="#06b6d4"
            loading={loading}
          />
          <ReportStatsCard
            title="Nuevos este Mes"
            value={summary?.newCustomersThisMonth ?? 0}
            format="number"
            subtitle="Adquisición de clientes"
            iconName="plus"
            accentColor="#10b981"
            loading={loading}
          />
          <ReportStatsCard
            title="Gasto Promedio"
            value={summary?.averageSpendPerCustomer ?? 0}
            format="currency"
            subtitle="Ticket global acumulado"
            iconName="sales"
            accentColor="#3b82f6"
            loading={loading}
          />
          <ReportStatsCard
            title="Cartera por Cobrar (CxC)"
            value={summary?.totalReceivables ?? 0}
            format="currency"
            subtitle="Saldos pendientes de clientes"
            iconName="wallet"
            accentColor="#f59e0b"
            loading={loading}
          />
        </div>
      </section>

      {/* Gráfico de Segmentación de Clientes */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DistributionBarList
          items={data?.byCategory || []}
          title="Ventas por Tipo de Cliente"
          subtitle="Distribución entre empresas, mayoristas y consumidor final"
          format="currency"
        />

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 tracking-wide mb-1">
            Top 5 Clientes con Mayor Volumen
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Clientes estratégicos con mayor facturación histórica
          </p>
          <div className="space-y-2.5">
            {data?.topCustomers.map((c, i) => (
              <div
                key={c.customerId}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 font-mono text-[11px] font-bold flex items-center justify-center border border-blue-200">
                    {i + 1}
                  </span>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">{c.name}</span>
                    <span className="text-[10px] text-slate-500 font-medium">{c.purchasesCount} compras</span>
                  </div>
                </div>
                <div className="text-right font-mono">
                  <span className="text-xs font-bold text-emerald-700">
                    ${c.totalPurchased.toLocaleString('es-CO')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tabla Detallada de Clientes */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-wide">
              Historial y Comportamiento de Clientes ({data?.rows?.length || 0})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Compras realizadas, ticket promedio, cartera y estado de cuenta
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600 uppercase tracking-wider font-bold text-[11px] bg-slate-50">
                <th className="py-2.5 px-3">Cliente</th>
                <th className="py-2.5 px-3">Documento / NIT</th>
                <th className="py-2.5 px-3">Tipo</th>
                <th className="py-2.5 px-3 text-right">Compras</th>
                <th className="py-2.5 px-3 text-right">Total Facturado</th>
                <th className="py-2.5 px-3 text-right">Ticket Prom.</th>
                <th className="py-2.5 px-3 text-right">Saldo Cartera</th>
                <th className="py-2.5 px-3 text-center">Estado</th>
                <th className="py-2.5 px-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {data?.rows?.map((row) => (
                <tr key={row.customerId} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-3 font-sans font-bold text-slate-900">{row.name}</td>
                  <td className="py-3 px-3 text-slate-500 font-medium">{row.documentNumber}</td>
                  <td className="py-3 px-3 font-sans">
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                      {row.customerType}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right text-slate-700 font-semibold">{row.purchasesCount}</td>
                  <td className="py-3 px-3 text-right font-bold text-slate-950">
                    ${row.totalPurchased.toLocaleString('es-CO')}
                  </td>
                  <td className="py-3 px-3 text-right text-blue-700 font-semibold">
                    ${row.averageTicket.toLocaleString('es-CO')}
                  </td>
                  <td
                    className={`py-3 px-3 text-right font-bold ${
                      row.currentReceivableBalance > 0 ? 'text-amber-800' : 'text-slate-400'
                    }`}
                  >
                    ${row.currentReceivableBalance.toLocaleString('es-CO')}
                  </td>
                  <td className="py-3 px-3 text-center font-sans">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        row.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {row.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-sans">
                    {onViewDetail && (
                      <button
                        onClick={() => onViewDetail(row)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-600 text-slate-600 hover:text-white transition-colors"
                        title="Ver detalle del cliente"
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
