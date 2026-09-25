'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { BalanceSheetReport } from '../../types'
import { db } from '@/lib/supabase/db'

interface AccountingBalanceSheetTabProps {
  balanceSheet: BalanceSheetReport | null
  locationId?: string
  onLocationChange: (locId: string) => void
}

export function AccountingBalanceSheetTab({
  balanceSheet,
  locationId = 'ALL',
  onLocationChange,
}: AccountingBalanceSheetTabProps) {
  if (!balanceSheet) return null

  const locations = db.locations || []

  return (
    <div className="space-y-6 page-enter">
      {/* Barra de Filtros del Balance */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Estado de Situación Financiera (Balance General)</h2>
          <p className="text-xs text-gray-500">
            Corte contable: {balanceSheet.period} {balanceSheet.locationName ? `— Bodega: ${balanceSheet.locationName}` : '— Consolidado Corporativo'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-gray-600">Filtrar por Bodega:</label>
          <select
            className="filter-select text-xs"
            value={locationId}
            onChange={(e) => onLocationChange(e.target.value)}
          >
            <option value="ALL">Todas las bodegas (Consolidado)</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Estado vacío si no hay movimientos */}
      {balanceSheet.totalAssets === 0 && balanceSheet.totalLiabilities === 0 && balanceSheet.totalEquity === 0 && (
        <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-center">
          <p className="text-sm font-semibold text-blue-950 mb-1">
            No existen movimientos contables para este periodo
          </p>
          <p className="text-xs text-blue-700">
            Los saldos de activos, pasivos y patrimonio se calcularán automáticamente a medida que se asienten comprobantes de diario.
          </p>
        </div>
      )}

      {/* Comprobación de la Ecuación Contable */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
          <span className="text-xs font-semibold text-blue-700 uppercase block mb-1">Total Activos</span>
          <strong className="text-xl font-mono text-blue-950">${balanceSheet.totalAssets.toLocaleString('es-CO')}</strong>
          <span className="text-[11px] text-blue-600 block mt-1">Recursos económicos y derechos de Super Más</span>
        </div>

        <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
          <span className="text-xs font-semibold text-amber-700 uppercase block mb-1">Total Pasivos</span>
          <strong className="text-xl font-mono text-amber-950">${balanceSheet.totalLiabilities.toLocaleString('es-CO')}</strong>
          <span className="text-[11px] text-amber-600 block mt-1">Obligaciones con terceros y proveedores</span>
        </div>

        <div className="p-4 rounded-xl bg-teal-50 border border-teal-100">
          <span className="text-xs font-semibold text-teal-700 uppercase block mb-1">Total Patrimonio</span>
          <strong className="text-xl font-mono text-teal-950">${balanceSheet.totalEquity.toLocaleString('es-CO')}</strong>
          <span className="text-[11px] text-teal-600 block mt-1">Capital aportado y beneficios acumulados</span>
        </div>
      </div>

      {/* Verificación de Ecuación Contable */}
      <div
        className={`p-3 rounded-lg border flex items-center justify-between text-xs font-medium ${
          balanceSheet.isBalanced
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}
      >
        <div className="flex items-center gap-2">
          <AppIcon name={balanceSheet.isBalanced ? 'check' : 'warning'} size={18} />
          <span>
            <strong>Ecuación Patrimonial:</strong> Activo (${balanceSheet.totalAssets.toLocaleString('es-CO')}) =
            Pasivo (${balanceSheet.totalLiabilities.toLocaleString('es-CO')}) + Patrimonio (${balanceSheet.totalEquity.toLocaleString('es-CO')})
          </span>
        </div>
        <span className="font-mono text-xs">
          {balanceSheet.isBalanced ? 'Partida Cuadrada (Diferencia $0)' : `Descuadre: $${balanceSheet.difference.toLocaleString('es-CO')}`}
        </span>
      </div>

      {/* Tablas Comparativas de Activos vs Pasivos y Patrimonio */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lado Izquierdo: ACTIVOS */}
        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-3.5 bg-blue-900 text-white font-semibold text-xs flex items-center justify-between">
            <span className="uppercase tracking-wider">1. ACTIVOS</span>
            <span className="font-mono">${balanceSheet.totalAssets.toLocaleString('es-CO')}</span>
          </div>

          <div className="p-4 space-y-4">
            {/* Activo Corriente */}
            <div>
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 border-b pb-1">
                Activo Corriente
              </h3>
              <table className="w-full text-xs">
                <tbody>
                  {balanceSheet.currentAssets.map((item) => (
                    <tr key={item.code} className="border-b border-gray-50 hover:bg-gray-50/80">
                      <td className="py-2 font-mono text-blue-800 font-semibold w-20">{item.code}</td>
                      <td className="py-2 text-gray-800">{item.name}</td>
                      <td className="py-2 font-mono text-right font-semibold text-gray-900">
                        ${item.balance.toLocaleString('es-CO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Activo No Corriente */}
            <div>
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 border-b pb-1">
                Activo No Corriente (Propiedad, Planta y Equipo)
              </h3>
              <table className="w-full text-xs">
                <tbody>
                  {balanceSheet.nonCurrentAssets.map((item) => (
                    <tr key={item.code} className="border-b border-gray-50 hover:bg-gray-50/80">
                      <td className="py-2 font-mono text-blue-800 font-semibold w-20">{item.code}</td>
                      <td className="py-2 text-gray-800">{item.name}</td>
                      <td className="py-2 font-mono text-right font-semibold text-gray-900">
                        ${item.balance.toLocaleString('es-CO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Lado Derecho: PASIVOS Y PATRIMONIO */}
        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-3.5 bg-gray-900 text-white font-semibold text-xs flex items-center justify-between">
            <span className="uppercase tracking-wider">2. PASIVOS + 3. PATRIMONIO</span>
            <span className="font-mono">${balanceSheet.totalLiabilitiesAndEquity.toLocaleString('es-CO')}</span>
          </div>

          <div className="p-4 space-y-4">
            {/* Pasivo Corriente */}
            <div>
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 border-b pb-1">
                Pasivo Corriente (Obligaciones a Corto Plazo)
              </h3>
              <table className="w-full text-xs">
                <tbody>
                  {balanceSheet.currentLiabilities.map((item) => (
                    <tr key={item.code} className="border-b border-gray-50 hover:bg-gray-50/80">
                      <td className="py-2 font-mono text-amber-800 font-semibold w-20">{item.code}</td>
                      <td className="py-2 text-gray-800">{item.name}</td>
                      <td className="py-2 font-mono text-right font-semibold text-gray-900">
                        ${item.balance.toLocaleString('es-CO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Patrimonio */}
            <div>
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 border-b pb-1">
                Patrimonio de los Accionistas
              </h3>
              <table className="w-full text-xs">
                <tbody>
                  {balanceSheet.equityItems.map((item) => (
                    <tr key={item.code} className="border-b border-gray-50 hover:bg-gray-50/80">
                      <td className="py-2 font-mono text-teal-800 font-semibold w-20">{item.code}</td>
                      <td className="py-2 text-gray-800">{item.name}</td>
                      <td className="py-2 font-mono text-right font-semibold text-gray-900">
                        ${item.balance.toLocaleString('es-CO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
