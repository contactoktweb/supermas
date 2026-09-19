'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { ReportStatsCard } from '../ReportStatsCard'
import { DistributionBarList } from '../ReportCharts'
import { KardexReportData, KardexReportRow } from '../../types'

interface KardexReportViewProps {
  data: KardexReportData | null
  loading?: boolean
  onViewDetail?: (row: KardexReportRow) => void
}

export function KardexReportView({
  data,
  loading = false,
  onViewDetail,
}: KardexReportViewProps) {
  const summary = data?.summary

  return (
    <div className="space-y-8">
      {/* KPIs de Kardex */}
      <section aria-label="Resumen de Kardex">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ReportStatsCard
            title="Saldo Inicial"
            value={summary?.initialStockQuantity ?? 0}
            format="number"
            subtitle="Existencias al inicio del periodo"
            iconName="kardex"
            accentColor="#8b5cf6"
            loading={loading}
          />
          <ReportStatsCard
            title="Entradas (Compras/Ajustes)"
            value={summary?.totalInflowsUnits ?? 0}
            format="number"
            subtitle={
              summary?.totalInflowsValue !== null
                ? `Valor: $${(summary?.totalInflowsValue ?? 0).toLocaleString('es-CO')}`
                : 'Ingresos al inventario'
            }
            iconName="arrowUpRight"
            accentColor="#10b981"
            loading={loading}
          />
          <ReportStatsCard
            title="Salidas (Ventas/Mermas)"
            value={summary?.totalOutflowsUnits ?? 0}
            format="number"
            subtitle={
              summary?.totalOutflowsValue !== null
                ? `Valor: $${(summary?.totalOutflowsValue ?? 0).toLocaleString('es-CO')}`
                : 'Deducciones del inventario'
            }
            iconName="arrowDownRight"
            accentColor="#ef4444"
            loading={loading}
          />
          <ReportStatsCard
            title="Saldo Final Resultante"
            value={summary?.finalStockQuantity ?? 0}
            format="number"
            subtitle="Inventario físico proyectado"
            iconName="inventory"
            accentColor="#3b82f6"
            loading={loading}
          />
        </div>
      </section>

      {/* Gráfico de Distribución por Tipo de Movimiento */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 tracking-wide mb-1">
            Principio Maestro del Kardex en Super Más
          </h3>
          <p className="text-xs text-slate-600 mb-4 leading-relaxed">
            El stock jamás se edita directamente; cada unidad que ingresa o egresa está
            estrictamente respaldada por un comprobante transaccional inmutable (Compra, Venta,
            Transferencia, Ajuste de Inventario o Despacho Ecommerce).
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium block mb-1">Ventas Mostrador</span>
              <span className="text-xs font-bold text-rose-700 font-mono">Salida Automática</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium block mb-1">Compras CEDI</span>
              <span className="text-xs font-bold text-emerald-700 font-mono">Entrada Valorizada</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium block mb-1">Transferencias</span>
              <span className="text-xs font-bold text-blue-700 font-mono">Doble Partida</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium block mb-1">Ajustes Físicos</span>
              <span className="text-xs font-bold text-amber-800 font-mono">Auditado DIAN</span>
            </div>
          </div>
        </div>

        <div>
          <DistributionBarList
            items={data?.byMovementType || []}
            title="Movimientos por Tipo"
            subtitle="Frecuencia operativa"
            format="number"
          />
        </div>
      </section>

      {/* Tabla Detallada de Movimientos */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-wide">
              Movimientos del Libro Kardex ({data?.rows?.length || 0})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Registro cronológico inmutable de fluctuaciones de inventario
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600 uppercase tracking-wider font-bold text-[11px] bg-slate-50">
                <th className="py-2.5 px-3">Fecha</th>
                <th className="py-2.5 px-3">Tipo</th>
                <th className="py-2.5 px-3">Referencia</th>
                <th className="py-2.5 px-3">Producto / SKU</th>
                <th className="py-2.5 px-3">Bodega</th>
                <th className="py-2.5 px-3 text-right text-emerald-700">Entrada</th>
                <th className="py-2.5 px-3 text-right text-rose-700">Salida</th>
                <th className="py-2.5 px-3 text-right text-blue-700">Saldo</th>
                {summary?.totalInflowsValue !== null && (
                  <th className="py-2.5 px-3 text-right">Costo Unit.</th>
                )}
                <th className="py-2.5 px-3 text-right">Usuario</th>
                <th className="py-2.5 px-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {data?.rows?.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-3 text-slate-600 font-sans">
                    {new Date(row.timestamp).toLocaleDateString('es-CO', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-3 px-3 font-sans">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        row.movementType === 'PURCHASE' || row.movementType === 'TRANSFER_IN' || row.movementType === 'RETURN_IN'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : row.movementType === 'SALE' || row.movementType === 'TRANSFER_OUT'
                          ? 'bg-blue-50 text-blue-800 border-blue-300'
                          : 'bg-amber-50 text-amber-900 border-amber-300'
                      }`}
                    >
                      {row.movementType}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-semibold text-blue-600">{row.reference}</td>
                  <td className="py-3 px-3 font-sans text-slate-900 font-bold">
                    <div>{row.productName}</div>
                    <div className="text-[10px] text-slate-500 font-mono font-normal">SKU: {row.sku}</div>
                  </td>
                  <td className="py-3 px-3 font-sans text-slate-700 font-medium">{row.locationName}</td>
                  <td className="py-3 px-3 text-right font-bold text-emerald-700">
                    {row.quantityIn > 0 ? `+${row.quantityIn}` : '—'}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-rose-700">
                    {row.quantityOut > 0 ? `-${row.quantityOut}` : '—'}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-950">
                    {row.resultingStock}
                  </td>
                  {summary?.totalInflowsValue !== null && (
                    <td className="py-3 px-3 text-right text-slate-700 font-semibold">
                      {row.unitCost ? `$${row.unitCost.toLocaleString('es-CO')}` : '—'}
                    </td>
                  )}
                  <td className="py-3 px-3 text-right font-sans text-slate-500 font-medium">
                    {row.user || 'Sistema'}
                  </td>
                  <td className="py-3 px-3 text-center font-sans">
                    {onViewDetail && (
                      <button
                        onClick={() => onViewDetail(row)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-600 text-slate-600 hover:text-white transition-colors border border-slate-200"
                        title="Ver detalle del movimiento"
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
