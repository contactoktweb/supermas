'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { ReportStatsCard } from '../ReportStatsCard'
import { DistributionBarList } from '../ReportCharts'
import { BillingReportData, BillingReportRow } from '../../types'

interface BillingReportViewProps {
  data: BillingReportData | null
  loading?: boolean
  onViewDetail?: (row: BillingReportRow) => void
}

export function BillingReportView({
  data,
  loading = false,
  onViewDetail,
}: BillingReportViewProps) {
  const summary = data?.summary

  return (
    <div className="space-y-8">
      {/* KPIs de Facturación Electrónica */}
      <section aria-label="Resumen de Facturación">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3.5">
          <ReportStatsCard
            title="Facturas Emitidas"
            value={summary?.totalInvoicesCount ?? 0}
            format="number"
            iconName="invoices"
            accentColor="#f97316"
            loading={loading}
          />
          <ReportStatsCard
            title="Validadas DIAN"
            value={summary?.dianAcceptedCount ?? 0}
            format="number"
            iconName="check"
            accentColor="#10b981"
            loading={loading}
          />
          <ReportStatsCard
            title="Rechazadas DIAN"
            value={summary?.dianRejectedCount ?? 0}
            format="number"
            iconName="close"
            accentColor="#ef4444"
            loading={loading}
          />
          <ReportStatsCard
            title="Notas Crédito"
            value={summary?.creditNotesCount ?? 0}
            format="number"
            iconName="remisiones"
            accentColor="#8b5cf6"
            loading={loading}
          />
          <ReportStatsCard
            title="Total Facturado"
            value={summary?.totalInvoiced ?? 0}
            format="currency"
            iconName="sales"
            accentColor="#3b82f6"
            loading={loading}
          />
          <ReportStatsCard
            title="IVA Generado"
            value={summary?.totalTaxesCollected ?? 0}
            format="currency"
            iconName="taxes"
            accentColor="#06b6d4"
            loading={loading}
          />
        </div>
      </section>

      {/* Gráficos de Distribución de Facturación */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DistributionBarList
          items={data?.byDianStatus || []}
          title="Estado de Validación Fiscal (DIAN)"
          subtitle="Cumplimiento normativo y validación de CUFE"
          format="number"
        />
        <DistributionBarList
          items={data?.byPaymentMethod || []}
          title="Facturación por Medio de Pago"
          subtitle="Efectivo, transferencias, datáfono y crédito"
          format="currency"
        />
      </section>

      {/* Tabla Detallada de Facturas DIAN */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-wide">
              Documentos Fiscales Emitidos ({data?.rows?.length || 0})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Facturas electrónicas de venta con código CUFE y estado tributario
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600 uppercase tracking-wider font-bold text-[11px] bg-slate-50">
                <th className="py-2.5 px-3">Fecha</th>
                <th className="py-2.5 px-3">Factura</th>
                <th className="py-2.5 px-3">Cliente</th>
                <th className="py-2.5 px-3">Bodega</th>
                <th className="py-2.5 px-3">Método Pago</th>
                <th className="py-2.5 px-3 text-right">Subtotal</th>
                <th className="py-2.5 px-3 text-right">IVA</th>
                <th className="py-2.5 px-3 text-right">Total</th>
                <th className="py-2.5 px-3 text-center">Estado DIAN</th>
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
                      year: 'numeric',
                    })}
                  </td>
                  <td className="py-3 px-3 font-bold text-blue-600">{row.invoiceNumber}</td>
                  <td className="py-3 px-3 font-sans text-slate-900 font-bold">
                    <div>{row.customerName}</div>
                    <div className="text-[10px] text-slate-500 font-mono font-normal">{row.customerDoc}</div>
                  </td>
                  <td className="py-3 px-3 font-sans text-slate-700 font-medium">{row.locationName}</td>
                  <td className="py-3 px-3">
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                      {row.paymentMethod}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right text-slate-700">
                    ${row.subtotal.toLocaleString('es-CO')}
                  </td>
                  <td className="py-3 px-3 text-right text-blue-700 font-semibold">
                    ${row.taxTotal.toLocaleString('es-CO')}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-950">
                    ${row.total.toLocaleString('es-CO')}
                  </td>
                  <td className="py-3 px-3 text-center font-sans">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        row.dianStatus === 'VALIDADA_DIAN'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : row.dianStatus === 'RECHAZADA_DIAN'
                          ? 'bg-rose-50 text-rose-800 border-rose-300'
                          : 'bg-amber-50 text-amber-900 border-amber-300'
                      }`}
                    >
                      {row.dianStatus === 'VALIDADA_DIAN'
                        ? 'Validada DIAN'
                        : row.dianStatus === 'RECHAZADA_DIAN'
                        ? 'Rechazada'
                        : 'En Proceso'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-sans">
                    {onViewDetail && (
                      <button
                        onClick={() => onViewDetail(row)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-600 text-slate-600 hover:text-white transition-colors"
                        title="Ver detalle del comprobante fiscal"
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
