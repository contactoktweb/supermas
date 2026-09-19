'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { InventoryAccountMapping, ExogenaPrepItem, AccountingAccount } from '../../types'
import { db } from '@/lib/supabase/db'

interface AccountingConfigTabProps {
  categoryMappings: InventoryAccountMapping[]
  exogenaPrep: ExogenaPrepItem[]
  accounts: AccountingAccount[]
  onUpdateMapping: (mapping: InventoryAccountMapping) => Promise<any>
  canManageConfig: boolean
}

export function AccountingConfigTab({
  categoryMappings,
  exogenaPrep,
  accounts,
  onUpdateMapping,
  canManageConfig,
}: AccountingConfigTabProps) {
  const [editingMapping, setEditingMapping] = useState<InventoryAccountMapping | null>(null)
  const taxConfigs = db.taxConfigs || []

  const inventoryAccounts = accounts.filter((a) => a.code.startsWith('14'))
  const costAccounts = accounts.filter((a) => a.code.startsWith('61'))
  const revenueAccounts = accounts.filter((a) => a.code.startsWith('41'))

  const handleSaveEdit = async () => {
    if (!editingMapping) return
    await onUpdateMapping(editingMapping)
    setEditingMapping(null)
  }

  return (
    <div className="space-y-6 page-enter">
      {/* 1. Parametrización Contable de Inventarios y Productos */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Mapeo Contable por Categoría de Inventario</h2>
            <p className="text-xs text-gray-500">
              Asignación dinámica de cuentas PUC para el registro automático de inventarios (14), costos (61) e ingresos (41)
            </p>
          </div>
          <span className="badge badge-teal">Motor Activo</span>
        </div>

        <div className="table-scroll">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-gray-50/50 text-gray-600 text-left">
                <th className="py-2.5 px-4 font-semibold">Categoría de Producto</th>
                <th className="py-2.5 px-4 font-semibold">Cuenta Inventario (Clase 14)</th>
                <th className="py-2.5 px-4 font-semibold">Cuenta Costo Venta (Clase 6)</th>
                <th className="py-2.5 px-4 font-semibold">Cuenta Ingresos (Clase 4)</th>
                <th className="py-2.5 px-4 font-semibold text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categoryMappings.map((map) => (
                <tr key={map.categoryId} className="hover:bg-blue-50/30">
                  <td className="py-3 px-4 font-semibold text-gray-900">{map.categoryName}</td>
                  <td className="py-3 px-4 font-mono">
                    <span className="text-blue-900 font-bold bg-blue-50 px-2 py-0.5 rounded">
                      {map.inventoryAccountCode}
                    </span>{' '}
                    <span className="text-gray-600 text-[11px] font-sans">{map.inventoryAccountName}</span>
                  </td>
                  <td className="py-3 px-4 font-mono">
                    <span className="text-rose-900 font-bold bg-rose-50 px-2 py-0.5 rounded">
                      {map.costAccountCode}
                    </span>{' '}
                    <span className="text-gray-600 text-[11px] font-sans">{map.costAccountName}</span>
                  </td>
                  <td className="py-3 px-4 font-mono">
                    <span className="text-emerald-900 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                      {map.revenueAccountCode}
                    </span>{' '}
                    <span className="text-gray-600 text-[11px] font-sans">{map.revenueAccountName}</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {canManageConfig && (
                      <button
                        type="button"
                        className="outline-button text-xs py-1"
                        onClick={() => setEditingMapping(map)}
                      >
                        <AppIcon name="edit" size={13} />
                        <span>Editar</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal de Edición de Mapeo */}
      {editingMapping && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-gray-900">
                Editar Cuentas Contables: {editingMapping.categoryName}
              </h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setEditingMapping(null)}
              >
                <AppIcon name="close" size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Cuenta de Inventario (Activo):</label>
                <select
                  className="filter-select w-full"
                  value={editingMapping.inventoryAccountId}
                  onChange={(e) => {
                    const acc = inventoryAccounts.find((a) => a.id === e.target.value)
                    if (acc) {
                      setEditingMapping({
                        ...editingMapping,
                        inventoryAccountId: acc.id,
                        inventoryAccountCode: acc.code,
                        inventoryAccountName: acc.name,
                      })
                    }
                  }}
                >
                  {inventoryAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Cuenta de Costo de Ventas:</label>
                <select
                  className="filter-select w-full"
                  value={editingMapping.costAccountId}
                  onChange={(e) => {
                    const acc = costAccounts.find((a) => a.id === e.target.value)
                    if (acc) {
                      setEditingMapping({
                        ...editingMapping,
                        costAccountId: acc.id,
                        costAccountCode: acc.code,
                        costAccountName: acc.name,
                      })
                    }
                  }}
                >
                  {costAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Cuenta de Ingreso Operacional:</label>
                <select
                  className="filter-select w-full"
                  value={editingMapping.revenueAccountId}
                  onChange={(e) => {
                    const acc = revenueAccounts.find((a) => a.id === e.target.value)
                    if (acc) {
                      setEditingMapping({
                        ...editingMapping,
                        revenueAccountId: acc.id,
                        revenueAccountCode: acc.code,
                        revenueAccountName: acc.name,
                      })
                    }
                  }}
                >
                  {revenueAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                className="outline-button text-xs"
                onClick={() => setEditingMapping(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button text-xs"
                onClick={handleSaveEdit}
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Integración con el Módulo de Impuestos (tax_configs.json) */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Integración con Módulo de Impuestos</h2>
            <p className="text-xs text-gray-500">
              Parametrización contable de tarifas DIAN, IVA generado en ventas e IVA descontable en compras
            </p>
          </div>
          <span className="badge badge-blue">tax_configs.json</span>
        </div>

        <div className="table-scroll">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-gray-50/50 text-gray-600 text-left">
                <th className="py-2.5 px-4 font-semibold">Configuración Fiscal</th>
                <th className="py-2.5 px-4 font-semibold">Tarifa (%)</th>
                <th className="py-2.5 px-4 font-semibold">Cuenta IVA Generado (Ventas)</th>
                <th className="py-2.5 px-4 font-semibold">Cuenta IVA Descontable (Compras)</th>
                <th className="py-2.5 px-4 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {taxConfigs.map((tax) => (
                <tr key={tax.id} className="hover:bg-gray-50/60">
                  <td className="py-3 px-4 font-semibold text-gray-900">
                    {tax.name} <span className="font-mono text-gray-400 font-normal">({tax.code})</span>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-blue-900">{tax.ratePercent}%</td>
                  <td className="py-3 px-4 font-mono text-gray-800">
                    {tax.generatedTaxAccountId ? (
                      <span className="bg-amber-50 text-amber-900 px-2 py-0.5 rounded font-bold">
                        {tax.generatedTaxAccountId}
                      </span>
                    ) : (
                      '—'
                    )}{' '}
                    <span className="text-[11px] text-gray-500 font-sans">{tax.generatedTaxAccountName || ''}</span>
                  </td>
                  <td className="py-3 px-4 font-mono text-gray-800">
                    {tax.deductibleTaxAccountId ? (
                      <span className="bg-teal-50 text-teal-900 px-2 py-0.5 rounded font-bold">
                        {tax.deductibleTaxAccountId}
                      </span>
                    ) : (
                      '—'
                    )}{' '}
                    <span className="text-[11px] text-gray-500 font-sans">{tax.deductibleTaxAccountName || ''}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`badge text-[11px] font-medium ${
                        tax.status === 'ACTIVE' ? 'badge-teal' : 'badge-gray'
                      }`}
                    >
                      {tax.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. Preparación de Información para Exógena DIAN */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Alimentador de Información para Medios Magnéticos (Exógena DIAN)</h2>
            <p className="text-xs text-gray-500">
              Datos contables agrupados por concepto, cuenta y tercero para alimentar directamente los formatos de exógena
            </p>
          </div>
          <span className="badge badge-purple">Formatos 1001, 1007, 1008, 1009</span>
        </div>

        <div className="table-scroll">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-gray-50/50 text-gray-600 text-left">
                <th className="py-2.5 px-4 font-semibold w-24">Concepto</th>
                <th className="py-2.5 px-4 font-semibold">Descripción del Concepto Fiscal</th>
                <th className="py-2.5 px-4 font-semibold">Tercero Identificado</th>
                <th className="py-2.5 px-4 font-semibold">Cuenta PUC</th>
                <th className="py-2.5 px-4 font-semibold text-right">Monto Reportable (COP)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {exogenaPrep.slice(0, 8).map((exo, idx) => (
                <tr key={idx} className="hover:bg-gray-50/60">
                  <td className="py-2.5 px-4 font-mono font-bold text-purple-900">{exo.conceptCode}</td>
                  <td className="py-2.5 px-4 text-gray-800">{exo.conceptDescription}</td>
                  <td className="py-2.5 px-4">
                    <strong className="text-gray-900 block">{exo.thirdPartyName}</strong>
                    <span className="text-[11px] font-mono text-gray-500">{exo.thirdPartyDoc}</span>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-blue-900">{exo.accountCode}</td>
                  <td className="py-2.5 px-4 font-mono text-right font-semibold text-gray-900">
                    ${exo.paymentAmount.toLocaleString('es-CO')}
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
