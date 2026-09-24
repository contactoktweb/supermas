'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CostAnalysisItem } from '../../types'
import { db } from '@/lib/supabase/db'

interface AccountingCostsTabProps {
  costs: CostAnalysisItem[]
  locationId?: string
  onLocationChange: (locId: string) => void
}

export function AccountingCostsTab({
  costs,
  locationId = 'ALL',
  onLocationChange,
}: AccountingCostsTabProps) {
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [costMethod, setCostMethod] = useState<'WEIGHTED_AVERAGE' | 'FIFO'>('WEIGHTED_AVERAGE')

  const categories = db.categories || []
  const locations = db.locations || []

  let filtered = costs
  if (selectedCategory !== 'ALL') {
    filtered = filtered.filter((c) => c.category === selectedCategory)
  }
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim()
    filtered = filtered.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.sku.toLowerCase().includes(q) ||
        c.barcode.toLowerCase().includes(q)
    )
  }

  const totalValuedStock = filtered.reduce((acc, c) => {
    const cost = costMethod === 'FIFO' ? c.lastPurchaseCost : c.averageCost
    return acc + (c.stockQuantity * cost)
  }, 0)

  const averageMargin =
    filtered.length > 0
      ? (
          filtered.reduce((acc, c) => {
            const cost = costMethod === 'FIFO' ? c.lastPurchaseCost : c.averageCost
            const margin = c.normalPrice > 0 ? ((c.normalPrice - cost) / c.normalPrice) * 100 : 100
            return acc + margin
          }, 0) / filtered.length
        ).toFixed(1)
      : '0'

  return (
    <div className="space-y-4 page-enter">
      {/* Selector de Método de Valuación de Costos */}
      <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Sistema de Costeo y Márgenes Comerciales</h2>
          <p className="text-xs text-gray-500">
            Comparativa directa Costo de Adquisición vs. Precios de Venta por producto y bodega
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-lg text-xs font-medium">
            <button
              type="button"
              className={`px-3 py-1 rounded-md transition-all ${
                costMethod === 'WEIGHTED_AVERAGE'
                  ? 'bg-white text-blue-900 shadow-sm font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setCostMethod('WEIGHTED_AVERAGE')}
            >
              Promedio Ponderado (Activo)
            </button>
            <button
              type="button"
              className={`px-3 py-1 rounded-md transition-all ${
                costMethod === 'FIFO'
                  ? 'bg-white text-blue-900 shadow-sm font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setCostMethod('FIFO')}
              title="Primeras en Entrar, Primeras en Salir (PEPS)"
            >
              PEPS / FIFO (Proyectado)
            </button>
          </div>
        </div>
      </div>

      {/* Métricas Globales del Inventario */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100">
          <span className="text-[11px] font-semibold text-blue-700 uppercase block mb-1">
            Valoración Total del Inventario a Costo
          </span>
          <strong className="text-xl font-mono text-blue-950">
            ${totalValuedStock.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
          </strong>
          <span className="text-[11px] text-blue-600 block mt-1">
            {costMethod === 'FIFO' ? 'Valorado según PEPS' : 'Costo medio ponderado en libros'}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-100">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase block mb-1">
            Margen Comercial Promedio
          </span>
          <strong className="text-xl font-mono text-emerald-950">{averageMargin}%</strong>
          <span className="text-[11px] text-emerald-600 block mt-1">Rendimiento sobre precio público</span>
        </div>

        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
          <span className="text-[11px] font-semibold text-gray-600 uppercase block mb-1">
            Productos Monitoreados
          </span>
          <strong className="text-xl font-mono text-gray-900">{filtered.length} SKUs</strong>
          <span className="text-[11px] text-gray-500 block mt-1">Con Kardex contable activo</span>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="filters-bar flex flex-wrap items-center justify-between gap-3">
        <div className="search-box flex-1 max-w-sm">
          <AppIcon name="search" size={16} />
          <input
            placeholder="Buscar por producto, SKU o código de barras..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            className="filter-select text-xs"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="ALL">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            className="filter-select text-xs"
            value={locationId}
            onChange={(e) => onLocationChange(e.target.value)}
          >
            <option value="ALL">Todas las bodegas</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla Comparativa de Costos vs Precios */}
      <div className="table-panel animated-table">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Producto y SKU</th>
                <th style={{ width: 130 }}>Categoría</th>
                <th style={{ width: 110, textAlign: 'right' }}>
                  {costMethod === 'FIFO' ? 'Costo Lote (PEPS)' : 'Costo Promedio'}
                </th>
                <th style={{ width: 110, textAlign: 'right' }}>Última Compra</th>
                <th style={{ width: 110, textAlign: 'right' }}>Precio Normal</th>
                <th style={{ width: 110, textAlign: 'right' }}>Precio Mayorista</th>
                <th style={{ width: 110, textAlign: 'right' }}>Margen (COP)</th>
                <th style={{ width: 100, textAlign: 'right' }}>Margen (%)</th>
                <th style={{ width: 130, textAlign: 'right' }}>Stock Valorizado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-gray-500">
                    No se encontraron productos para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const displayCost = costMethod === 'FIFO' ? item.lastPurchaseCost : item.averageCost
                  const displayMarginCOP = item.normalPrice - displayCost
                  const displayMarginPercent = item.normalPrice > 0 ? (displayMarginCOP / item.normalPrice) * 100 : 0
                  const displayTotalValuedCost = item.stockQuantity * displayCost

                  return (
                    <tr key={item.productId} className="hover:bg-blue-50/40 transition-colors">
                      <td>
                        <div className="flex flex-col">
                          <strong className="text-xs text-gray-900 font-semibold">{item.name}</strong>
                          <span className="font-mono text-[11px] text-gray-500">
                            {item.sku} | Barcode: {item.barcode}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-gray text-[11px]">{item.category}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="font-mono text-xs font-semibold text-rose-900">
                          ${Math.round(displayCost).toLocaleString('es-CO')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="font-mono text-xs text-gray-600">
                          ${Math.round(item.lastPurchaseCost).toLocaleString('es-CO')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="font-mono text-xs font-semibold text-gray-900">
                          ${item.normalPrice.toLocaleString('es-CO')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="font-mono text-xs text-blue-800">
                          ${item.wholesalePrice.toLocaleString('es-CO')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="font-mono text-xs font-semibold text-emerald-700">
                          +${Math.round(displayMarginCOP).toLocaleString('es-CO')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span
                          className={`badge text-[11px] font-bold ${
                            displayMarginPercent >= 25
                              ? 'badge-teal'
                              : displayMarginPercent >= 15
                              ? 'badge-blue'
                              : 'badge-amber'
                          }`}
                        >
                          {displayMarginPercent.toFixed(1)}%
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="flex flex-col items-end">
                          <span className="font-mono text-xs font-bold text-gray-900">
                            ${Math.round(displayTotalValuedCost).toLocaleString('es-CO')}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {item.stockQuantity} {item.unitOfMeasure}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
