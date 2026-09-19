'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { ReportStatsCard } from '../ReportStatsCard'
import { SuppliersReportData, SupplierReportRow } from '../../types'

interface SuppliersReportViewProps {
  data: SuppliersReportData | null
  loading?: boolean
  onViewDetail?: (row: SupplierReportRow) => void
}

export function SuppliersReportView({
  data,
  loading = false,
  onViewDetail,
}: SuppliersReportViewProps) {
  const summary = data?.summary

  return (
    <div className="space-y-8">
      {/* KPIs de Proveedores */}
      <section aria-label="Resumen de Proveedores">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ReportStatsCard
            title="Proveedores Activos"
            value={summary?.activeSuppliersCount ?? 0}
            format="number"
            subtitle={`${summary?.totalSuppliersCount ?? 0} proveedores registrados`}
            iconName="suppliers"
            accentColor="#0ea5e9"
            loading={loading}
          />
          <ReportStatsCard
            title="Compras Acumuladas"
            value={summary?.totalPurchasesAmount ?? 0}
            format="currency"
            subtitle="Volumen de abastecimiento"
            iconName="purchases"
            accentColor="#3b82f6"
            loading={loading}
          />
          <ReportStatsCard
            title="Cuentas por Pagar (CxP)"
            value={summary?.totalPendingPayables ?? 0}
            format="currency"
            subtitle="Saldos corrientes y a crédito"
            iconName="wallet"
            accentColor="#f59e0b"
            loading={loading}
          />
          <ReportStatsCard
            title="Facturas Vencidas"
            value={summary?.overdueInvoicesTotal ?? 0}
            format="number"
            subtitle="Requiere gestión de tesorería"
            iconName="warning"
            accentColor="#ef4444"
            loading={loading}
          />
        </div>
      </section>

      {/* Top Proveedores */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 tracking-wide mb-1">
          Top Aliados de Abastecimiento
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Proveedores con mayor volumen de compras y condiciones de pago
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.topSuppliers.map((sup, idx) => (
            <div
              key={sup.supplierId}
              className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className="text-xs font-bold text-slate-900 block truncate max-w-[180px]">
                    {sup.name}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">{sup.nit}</span>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">
                  #{idx + 1}
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-200/80 space-y-1 text-xs font-mono">
                <div className="flex justify-between text-slate-800">
                  <span className="font-sans text-[11px] text-slate-500">Total Comprado:</span>
                  <span className="font-bold">${sup.totalPurchasedAmount.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between text-amber-700 font-semibold">
                  <span className="font-sans text-[11px] text-slate-500">Saldo Pendiente:</span>
                  <span>${sup.pendingPayablesBalance.toLocaleString('es-CO')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tabla Detallada de Proveedores */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-wide">
              Catálogo de Proveedores y Cuentas por Pagar ({data?.rows?.length || 0})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Compras realizadas, saldos por pagar y control de vencimientos
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600 uppercase tracking-wider font-bold text-[11px] bg-slate-50">
                <th className="py-2.5 px-3">Proveedor</th>
                <th className="py-2.5 px-3">NIT</th>
                <th className="py-2.5 px-3 text-right">Órdenes</th>
                <th className="py-2.5 px-3 text-right">Total Comprado</th>
                <th className="py-2.5 px-3 text-right">Saldo Pendiente</th>
                <th className="py-2.5 px-3 text-right text-rose-700">Vencido</th>
                <th className="py-2.5 px-3">Última Compra</th>
                <th className="py-2.5 px-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {data?.rows?.map((row) => (
                <tr key={row.supplierId} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-3 font-sans font-semibold text-slate-900">{row.name}</td>
                  <td className="py-3 px-3 text-slate-500">{row.nit}</td>
                  <td className="py-3 px-3 text-right text-slate-800">{row.purchasesCount}</td>
                  <td className="py-3 px-3 text-right font-bold text-slate-900">
                    ${row.totalPurchasedAmount.toLocaleString('es-CO')}
                  </td>
                  <td
                    className={`py-3 px-3 text-right font-bold ${
                      row.pendingPayablesBalance > 0 ? 'text-amber-700' : 'text-slate-400'
                    }`}
                  >
                    ${row.pendingPayablesBalance.toLocaleString('es-CO')}
                  </td>
                  <td
                    className={`py-3 px-3 text-right ${
                      row.overdueAmount > 0 ? 'text-rose-700 font-bold' : 'text-slate-400'
                    }`}
                  >
                    {row.overdueAmount > 0 ? `$${row.overdueAmount.toLocaleString('es-CO')}` : '—'}
                  </td>
                  <td className="py-3 px-3 text-slate-600">
                    {new Date(row.lastPurchaseDate).toLocaleDateString('es-CO', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="py-3 px-3 text-center font-sans">
                    {onViewDetail && (
                      <button
                        onClick={() => onViewDetail(row)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-600 text-slate-600 hover:text-white transition-colors border border-slate-200 hover:border-blue-600"
                        title="Ver historial de compras del proveedor"
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
