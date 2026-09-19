'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { ReportStatsCard } from '../ReportStatsCard'
import { DistributionBarList } from '../ReportCharts'
import { PurchasesReportData, PurchasesReportRow } from '../../types'

interface PurchasesReportViewProps {
  data: PurchasesReportData | null
  loading?: boolean
  onViewDetail?: (row: PurchasesReportRow) => void
}

export function PurchasesReportView({
  data,
  loading = false,
  onViewDetail,
}: PurchasesReportViewProps) {
  const summary = data?.summary

  return (
    <div className="space-y-8">
      {/* KPIs de Compras */}
      <section aria-label="Resumen de Compras">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ReportStatsCard
            title="Compras Totales"
            value={summary?.totalPurchases ?? 0}
            format="currency"
            subtitle={`${summary?.purchaseCount ?? 0} órdenes procesadas`}
            iconName="purchases"
            accentColor="#3b82f6"
            loading={loading}
          />
          <ReportStatsCard
            title="Compras de Contado"
            value={summary?.cashPurchasesTotal ?? 0}
            format="currency"
            subtitle="Pagado de inmediato"
            iconName="sales"
            accentColor="#10b981"
            loading={loading}
          />
          <ReportStatsCard
            title="Compras a Crédito"
            value={summary?.creditPurchasesTotal ?? 0}
            format="currency"
            subtitle="Financiamiento comercial"
            iconName="creditCard"
            accentColor="#8b5cf6"
            loading={loading}
          />
          <ReportStatsCard
            title="Saldo por Pagar (CxP)"
            value={summary?.pendingBalanceTotal ?? 0}
            format="currency"
            subtitle={`${summary?.overdueCount ?? 0} facturas vencidas`}
            iconName="warning"
            accentColor="#f59e0b"
            loading={loading}
          />
        </div>
      </section>

      {/* Gráficos de Distribución */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DistributionBarList
          items={data?.byWarehouse || []}
          title="Compras por Bodega Destino"
          subtitle="Distribución del abastecimiento de inventario"
          format="currency"
        />
        <DistributionBarList
          items={data?.paymentTypeShare || []}
          title="Condición de Pago (Contado vs Crédito)"
          subtitle="Proporción sobre el monto total adquirido"
          format="currency"
        />
      </section>

      {/* Tabla Detallada de Compras */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-wide">
              Órdenes de Compra y Facturas de Proveedor ({data?.rows?.length || 0})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Registro histórico de compras y cuentas por pagar asociadas
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600 uppercase tracking-wider font-bold text-[11px] bg-slate-50">
                <th className="py-2.5 px-3">Fecha</th>
                <th className="py-2.5 px-3">Orden Compra</th>
                <th className="py-2.5 px-3">Factura Prov.</th>
                <th className="py-2.5 px-3">Proveedor</th>
                <th className="py-2.5 px-3">Bodega Destino</th>
                <th className="py-2.5 px-3">Condición</th>
                <th className="py-2.5 px-3">Vencimiento</th>
                <th className="py-2.5 px-3 text-right">Total</th>
                <th className="py-2.5 px-3 text-right">Saldo Pend.</th>
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
                  <td className="py-3 px-3 font-bold text-blue-600">{row.purchaseNumber}</td>
                  <td className="py-3 px-3 text-slate-700 font-medium">{row.supplierInvoiceNumber}</td>
                  <td className="py-3 px-3 font-sans text-slate-900 font-bold">
                    <div>{row.supplierName}</div>
                    <div className="text-[10px] text-slate-500 font-mono font-normal">{row.supplierNit}</div>
                  </td>
                  <td className="py-3 px-3 font-sans text-slate-700 font-medium">{row.destinationLocationName}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        row.paymentType.includes('CREDITO')
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {row.paymentType}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-600 font-medium">
                    {new Date(row.dueDate).toLocaleDateString('es-CO', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-950">
                    ${row.total.toLocaleString('es-CO')}
                  </td>
                  <td
                    className={`py-3 px-3 text-right font-bold ${
                      row.pendingBalance > 0 ? 'text-amber-800' : 'text-slate-400'
                    }`}
                  >
                    ${row.pendingBalance.toLocaleString('es-CO')}
                  </td>
                  <td className="py-3 px-3 text-center font-sans">
                    {onViewDetail && (
                      <button
                        onClick={() => onViewDetail(row)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-600 text-slate-600 hover:text-white transition-colors"
                        title="Ver detalle de compra"
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
