'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const taxConfigs = db.taxConfigs || []

  const inventoryAccounts = accounts.filter((a) => a.code.startsWith('14'))
  const costAccounts = accounts.filter((a) => a.code.startsWith('61') || a.code.startsWith('71'))
  const revenueAccounts = accounts.filter((a) => a.code.startsWith('41'))

  const filteredMappings = selectedTypeFilter === 'ALL'
    ? categoryMappings
    : categoryMappings.filter((m) => m.inventoryType === selectedTypeFilter)

  const handleSaveEdit = async () => {
    if (!editingMapping) return
    await onUpdateMapping(editingMapping)
    setEditingMapping(null)
  }

  const getInventoryTypeBadge = (type: string) => {
    switch (type) {
      case 'RAW_MATERIAL':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-200">Materia Prima (1405)</span>
      case 'WORK_IN_PROCESS':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-100 text-purple-900 border border-purple-200">En Proceso (1410)</span>
      case 'FINISHED_GOOD':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-900 border border-emerald-200">Prod. Terminado (1430)</span>
      case 'MERCHANDISE':
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-900 border border-blue-200">Mercancía Venta (1435)</span>
    }
  }

  return (
    <div className="space-y-6 page-enter">
      {/* 1. Parametrización Contable de Inventarios y Productos */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-4 bg-gray-50 border-b flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Mapeo Contable por Tipo y Categoría de Inventario</h2>
            <p className="text-xs text-gray-500">
              Relación arquitectónica: <strong className="text-blue-900">Productos</strong> → <strong className="text-blue-900">Categoría Contable Inventario</strong> → <strong className="text-blue-900">Cuenta PUC (14)</strong>. Soporte para Materia Prima, En Proceso, Producto Terminado y Mercancía.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-teal">PUC Dinámico</span>
            <span className="badge badge-blue">4 Clases de Inventario</span>
          </div>
        </div>

        {/* Explicación de relación y flujo */}
        <div className="p-4 bg-blue-50/50 border-b border-blue-100 flex flex-wrap items-center gap-4 text-xs">
          <div className="font-semibold text-blue-950 flex items-center gap-1.5">
            <AppIcon name="layers" size={14} className="text-blue-700" />
            <span>Ejemplos de Vinculación Contable:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-white px-2.5 py-1 rounded-md border border-blue-200 text-gray-700 shadow-2xs">
              🌾 Harina de Trigo → <strong className="text-amber-800">Materia Prima</strong> → <code className="text-blue-800 font-bold">140501</code>
            </span>
            <span className="bg-white px-2.5 py-1 rounded-md border border-blue-200 text-gray-700 shadow-2xs">
              🥣 Masa Preparada → <strong className="text-purple-800">En Proceso</strong> → <code className="text-blue-800 font-bold">141001</code>
            </span>
            <span className="bg-white px-2.5 py-1 rounded-md border border-blue-200 text-gray-700 shadow-2xs">
              🍞 Pan Tajado → <strong className="text-emerald-800">Prod. Terminado</strong> → <code className="text-blue-800 font-bold">143001</code>
            </span>
            <span className="bg-white px-2.5 py-1 rounded-md border border-blue-200 text-gray-700 shadow-2xs">
              🥫 Abarrotes / Granos → <strong className="text-blue-800">Mercancía Venta</strong> → <code className="text-blue-800 font-bold">143501</code>
            </span>
          </div>
        </div>

        {/* Filtro por tipo de inventario */}
        <div className="p-3 bg-white border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                selectedTypeFilter === 'ALL'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              onClick={() => setSelectedTypeFilter('ALL')}
            >
              Todos ({categoryMappings.length})
            </button>
            <button
              type="button"
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                selectedTypeFilter === 'RAW_MATERIAL'
                  ? 'bg-amber-800 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
              }`}
              onClick={() => setSelectedTypeFilter('RAW_MATERIAL')}
            >
              Materias Primas (1405)
            </button>
            <button
              type="button"
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                selectedTypeFilter === 'WORK_IN_PROCESS'
                  ? 'bg-purple-800 text-white shadow-xs'
                  : 'bg-purple-50 text-purple-900 hover:bg-purple-100'
              }`}
              onClick={() => setSelectedTypeFilter('WORK_IN_PROCESS')}
            >
              En Proceso (1410)
            </button>
            <button
              type="button"
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                selectedTypeFilter === 'FINISHED_GOOD'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
              }`}
              onClick={() => setSelectedTypeFilter('FINISHED_GOOD')}
            >
              Prod. Terminados (1430)
            </button>
            <button
              type="button"
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                selectedTypeFilter === 'MERCHANDISE'
                  ? 'bg-blue-800 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-900 hover:bg-blue-100'
              }`}
              onClick={() => setSelectedTypeFilter('MERCHANDISE')}
            >
              Mercancías Venta (1435)
            </button>
          </div>
          <span className="text-xs text-gray-400">
            Mostrando {filteredMappings.length} mapeos
          </span>
        </div>

        <div className="table-scroll">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-gray-50/50 text-gray-600 text-left">
                <th className="py-2.5 px-4 font-semibold">Categoría / Tipo de Inventario</th>
                <th className="py-2.5 px-4 font-semibold">Cuenta Inventario (Clase 14)</th>
                <th className="py-2.5 px-4 font-semibold">Costo / Consumo (Clase 6/7)</th>
                <th className="py-2.5 px-4 font-semibold">Cuenta Ingresos (Clase 4)</th>
                <th className="py-2.5 px-4 font-semibold text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredMappings.map((map) => (
                <tr key={map.categoryId} className="hover:bg-blue-50/30">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-gray-900 flex items-center gap-2">
                      <span>{map.categoryName}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      {getInventoryTypeBadge(map.inventoryType)}
                    </div>
                    {map.description && (
                      <p className="text-[11px] text-gray-500 mt-1 max-w-sm">{map.description}</p>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono">
                    <span className="text-blue-900 font-bold bg-blue-50 px-2 py-0.5 rounded">
                      {map.inventoryAccountCode}
                    </span>{' '}
                    <span className="text-gray-600 text-[11px] font-sans block mt-0.5">{map.inventoryAccountName}</span>
                  </td>
                  <td className="py-3 px-4 font-mono">
                    <span className="text-rose-900 font-bold bg-rose-50 px-2 py-0.5 rounded">
                      {map.costAccountCode}
                    </span>{' '}
                    <span className="text-gray-600 text-[11px] font-sans block mt-0.5">{map.costAccountName}</span>
                  </td>
                  <td className="py-3 px-4 font-mono">
                    <span className="text-emerald-900 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                      {map.revenueAccountCode}
                    </span>{' '}
                    <span className="text-gray-600 text-[11px] font-sans block mt-0.5">{map.revenueAccountName}</span>
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
      {editingMapping && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4 relative">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Editar Cuentas Contables: {editingMapping.categoryName}
                </h3>
                <p className="text-xs text-gray-500">
                  Configuración de cuentas en el catálogo PUC para este grupo de inventario
                </p>
              </div>
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
                <label className="block font-semibold text-gray-700 mb-1">Tipo de Inventario:</label>
                <select
                  className="filter-select w-full"
                  value={editingMapping.inventoryType}
                  onChange={(e) => {
                    const newType = e.target.value as any
                    const typeNames: Record<string, string> = {
                      RAW_MATERIAL: 'Materia Prima (Clase 1405)',
                      WORK_IN_PROCESS: 'Producto en Proceso (Clase 1410)',
                      FINISHED_GOOD: 'Producto Terminado (Clase 1430)',
                      MERCHANDISE: 'Mercancía para la Venta (Clase 1435)',
                    }
                    setEditingMapping({
                      ...editingMapping,
                      inventoryType: newType,
                      inventoryTypeName: typeNames[newType] || 'Mercancía (1435)',
                    })
                  }}
                >
                  <option value="RAW_MATERIAL">Materia Prima (Harinas, insumos, empaques) — 1405</option>
                  <option value="WORK_IN_PROCESS">Producto en Proceso (Masas, lotes semielaborados) — 1410</option>
                  <option value="FINISHED_GOOD">Producto Terminado (Pan tajado, producción propia) — 1430</option>
                  <option value="MERCHANDISE">Mercancías para la Venta (Abarrotes comercializados) — 1435</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Cuenta de Inventario (Activo - Clase 14):</label>
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
                <label className="block font-semibold text-gray-700 mb-1">Cuenta de Costo / Consumo (Clase 6 / 7):</label>
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
        </div>,
        document.body
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
