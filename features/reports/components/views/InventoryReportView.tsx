'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { ReportStatsCard } from '../ReportStatsCard'
import { DistributionBarList } from '../ReportCharts'
import { InventoryReportData, InventoryReportRow } from '../../types'

interface InventoryReportViewProps {
  data: InventoryReportData | null
  loading?: boolean
  onViewDetail?: (row: InventoryReportRow) => void
}

export function InventoryReportView({
  data,
  loading = false,
  onViewDetail,
}: InventoryReportViewProps) {
  const summary = data?.summary

  return (
    <div className="space-y-8">
      {/* KPIs de Inventario */}
      <section aria-label="Resumen de Inventario">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3.5">
          <ReportStatsCard
            title="Valor Venta Total"
            value={summary?.inventoryValueAtSale ?? 0}
            format="currency"
            iconName="inventory"
            accentColor="#f59e0b"
            loading={loading}
          />
          <ReportStatsCard
            title="Valor al Costo"
            value={summary?.inventoryValueAtCost ?? 'Confidencial'}
            format={typeof summary?.inventoryValueAtCost === 'number' ? 'currency' : 'raw'}
            subtitle={
              summary?.inventoryValueAtCost !== null ? 'Valuación contable' : 'Acceso restringido'
            }
            iconName="accounting"
            accentColor="#3b82f6"
            loading={loading}
          />
          <ReportStatsCard
            title="Productos Totales"
            value={summary?.totalProductsCount ?? 0}
            format="number"
            iconName="products"
            accentColor="#8b5cf6"
            loading={loading}
          />
          <ReportStatsCard
            title="Disponibles"
            value={summary?.availableCount ?? 0}
            format="number"
            iconName="check"
            accentColor="#10b981"
            loading={loading}
          />
          <ReportStatsCard
            title="Pocas Unidades"
            value={summary?.lowStockCount ?? 0}
            format="number"
            iconName="warning"
            accentColor="#f97316"
            loading={loading}
          />
          <ReportStatsCard
            title="Agotados"
            value={summary?.outOfStockCount ?? 0}
            format="number"
            iconName="close"
            accentColor="#ef4444"
            loading={loading}
          />
        </div>
      </section>

      {/* Gráficos de Distribución de Stock */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <DistributionBarList
          items={data?.byCategory || []}
          title="Valor por Categoría"
          subtitle="Distribución del capital en bodega"
          format="currency"
        />
        <DistributionBarList
          items={data?.byWarehouse || []}
          title="Existencias por Bodega"
          subtitle="Concentración del inventario físico"
          format="currency"
        />
        <DistributionBarList
          items={data?.byBrand || []}
          title="Participación por Marca"
          subtitle="Principales marcas comercializadas"
          format="currency"
        />
      </section>

      {/* Tabla Detallada de Inventario */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-wide">
              Inventario Valorizado y Existencias ({data?.rows?.length || 0})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Existencias agregadas por producto y ubicación con precios oficiales
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
                <th className="py-2.5 px-3">Marca</th>
                <th className="py-2.5 px-3 text-right">Stock</th>
                <th className="py-2.5 px-3 text-right">Precio Venta</th>
                {summary?.inventoryValueAtCost !== null && (
                  <>
                    <th className="py-2.5 px-3 text-right">Costo Prom.</th>
                    <th className="py-2.5 px-3 text-right">Margen</th>
                  </>
                )}
                <th className="py-2.5 px-3 text-right">Valor Stock</th>
                <th className="py-2.5 px-3 text-center">Estado</th>
                <th className="py-2.5 px-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {data?.rows?.map((row) => (
                <tr key={row.productId} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-3 text-slate-500 font-medium">{row.sku}</td>
                  <td className="py-3 px-3 font-sans text-slate-900 font-bold">{row.name}</td>
                  <td className="py-3 px-3 font-sans text-slate-700 font-medium">{row.category}</td>
                  <td className="py-3 px-3 font-sans text-slate-500">{row.brand}</td>
                  <td className="py-3 px-3 text-right font-bold text-slate-900">
                    {row.stockTotal} <span className="text-[10px] text-slate-500 font-normal">{row.unitOfMeasure}</span>
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-900">
                    ${row.normalPrice.toLocaleString('es-CO')}
                  </td>
                  {summary?.inventoryValueAtCost !== null && (
                    <>
                      <td className="py-3 px-3 text-right text-blue-700 font-semibold">
                        {row.unitCost ? `$${row.unitCost.toLocaleString('es-CO')}` : '—'}
                      </td>
                      <td className="py-3 px-3 text-right text-purple-700 font-bold">
                        {row.grossMarginPercent ? `${row.grossMarginPercent}%` : '—'}
                      </td>
                    </>
                  )}
                  <td className="py-3 px-3 text-right font-bold text-slate-950">
                    ${row.inventoryValueAtSale.toLocaleString('es-CO')}
                  </td>
                  <td className="py-3 px-3 text-center font-sans">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        row.availabilityStatus === 'AVAILABLE'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : row.availabilityStatus === 'LOW_STOCK'
                          ? 'bg-amber-50 text-amber-900 border-amber-300'
                          : 'bg-rose-50 text-rose-800 border-rose-300'
                      }`}
                    >
                      {row.availabilityStatus === 'AVAILABLE'
                        ? 'Disponible'
                        : row.availabilityStatus === 'LOW_STOCK'
                        ? 'Pocas unidades'
                        : 'Agotado'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-sans">
                    {onViewDetail && (
                      <button
                        onClick={() => onViewDetail(row)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-600 text-slate-600 hover:text-white transition-colors"
                        title="Ver desglose de stock por bodega"
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
