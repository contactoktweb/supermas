'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { ReportStatsCard } from '../ReportStatsCard'
import { CashRegistersReportData, CashRegisterReportRow } from '../../types'

interface CashRegistersReportViewProps {
  data: CashRegistersReportData | null
  loading?: boolean
  onViewDetail?: (row: CashRegisterReportRow) => void
}

export function CashRegistersReportView({
  data,
  loading = false,
  onViewDetail,
}: CashRegistersReportViewProps) {
  const summary = data?.summary

  return (
    <div className="space-y-8">
      {/* KPIs de Cajas */}
      <section aria-label="Resumen de Cajas">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ReportStatsCard
            title="Cajas Abiertas"
            value={`${summary?.openRegistersCount ?? 0} / ${summary?.totalRegisters ?? 0}`}
            format="raw"
            subtitle="Turnos actualmente en operación"
            iconName="cashRegisters"
            accentColor="#14b8a6"
            loading={loading}
          />
          <ReportStatsCard
            title="Efectivo Esperado"
            value={summary?.totalExpectedCash ?? 0}
            format="currency"
            subtitle="Base inicial + Ventas efectivo"
            iconName="sales"
            accentColor="#3b82f6"
            loading={loading}
          />
          <ReportStatsCard
            title="Efectivo Real en Caja"
            value={summary?.totalActualCash ?? 0}
            format="currency"
            subtitle="Conteo físico verificado"
            iconName="wallet"
            accentColor="#10b981"
            loading={loading}
          />
          <ReportStatsCard
            title="Diferencias Netas"
            value={summary?.totalDifferences ?? 0}
            format="currency"
            subtitle={
              (summary?.totalDifferences ?? 0) === 0
                ? 'Arqueos totalmente cuadrados'
                : 'Faltantes / Sobrantes detectados'
            }
            iconName="warning"
            accentColor={(summary?.totalDifferences ?? 0) === 0 ? '#10b981' : '#ef4444'}
            loading={loading}
          />
        </div>
      </section>

      {/* Grid de Cajas Registradoras */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-wide">
              Estado de Cajas Registradoras ({data?.registers?.length || 0})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Control de turnos, cajeros asignados y balance de efectivo
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {data?.registers?.map((reg) => (
            <div
              key={reg.id}
              className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    {reg.code}
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      reg.status === 'OPEN'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {reg.status === 'OPEN' ? 'ABIERTA' : 'CERRADA'}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-slate-900 mb-1 truncate">{reg.name}</h4>
                <p className="text-xs text-slate-500 font-sans mb-3">{reg.locationName}</p>

                <div className="space-y-1.5 font-mono text-xs border-t border-slate-100 pt-2.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans text-[11px]">Cajero:</span>
                    <span className="text-slate-700 font-sans font-medium">{reg.cashierName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans text-[11px]">Base Inicial:</span>
                    <span className="text-slate-700 font-semibold">${reg.openingBalance.toLocaleString('es-CO')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans text-[11px]">Ventas Efectivo:</span>
                    <span className="text-emerald-700 font-bold">${reg.cashSales.toLocaleString('es-CO')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans text-[11px]">Otros Pagos:</span>
                    <span className="text-blue-700 font-bold">${reg.otherSales.toLocaleString('es-CO')}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-100">
                    <span className="text-slate-600 font-sans text-[11px] font-medium">Efectivo Real:</span>
                    <span className="text-slate-950 font-extrabold">${reg.actualCash.toLocaleString('es-CO')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 font-sans text-[11px] font-medium">Diferencia:</span>
                    <span
                      className={`font-bold ${
                        reg.difference === 0
                          ? 'text-emerald-700'
                          : reg.difference > 0
                          ? 'text-blue-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {reg.difference > 0 ? '+' : ''}${reg.difference.toLocaleString('es-CO')}
                    </span>
                  </div>
                </div>
              </div>

              {reg.notes && (
                <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-sans italic truncate">
                  &ldquo;{reg.notes}&rdquo;
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Tabla de Movimientos Recientes de Caja */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-wide">
              Movimientos de Caja y Arqueo ({data?.recentMovements?.length || 0})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Registro auditado de aperturas, ingresos, egresos y retiros de efectivo
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600 uppercase tracking-wider font-bold text-[11px] bg-slate-50">
                <th className="py-2.5 px-3">Hora / Fecha</th>
                <th className="py-2.5 px-3">Caja</th>
                <th className="py-2.5 px-3">Ubicación</th>
                <th className="py-2.5 px-3">Tipo Operación</th>
                <th className="py-2.5 px-3">Referencia</th>
                <th className="py-2.5 px-3">Descripción</th>
                <th className="py-2.5 px-3">Cajero</th>
                <th className="py-2.5 px-3 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {data?.recentMovements?.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-3 text-slate-600">
                    {new Date(m.timestamp).toLocaleDateString('es-CO', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-3 px-3 font-bold text-blue-700">{m.cashRegisterCode}</td>
                  <td className="py-3 px-3 font-sans text-slate-700 font-medium">{m.locationName}</td>
                  <td className="py-3 px-3 font-sans">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                        m.type === 'SALE' || m.type === 'INFLOW'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : m.type === 'OUTFLOW'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                    >
                      {m.type}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-500">{m.reference}</td>
                  <td className="py-3 px-3 font-sans text-slate-700">{m.description}</td>
                  <td className="py-3 px-3 font-sans text-slate-500">{m.cashierName}</td>
                  <td
                    className={`py-3 px-3 text-right font-bold ${
                      m.type === 'OUTFLOW' ? 'text-rose-600' : 'text-emerald-700'
                    }`}
                  >
                    {m.type === 'OUTFLOW' ? '-' : '+'}${m.amount.toLocaleString('es-CO')}
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
