'use client'

import React, { useState, useEffect } from 'react'
import { ExogenaPrepItem, InventoryLineAccounts, InventoryLineAccountsConfig } from '../../types'
import { InventoryLineAccountsFormData } from '../../schemas/accounting.schema'
import { supabaseClient } from '@/lib/supabase/client'
import { InventoryLineAccountsSection } from './InventoryLineAccountsSection'

interface AccountingConfigTabProps {
  inventoryLineAccounts: InventoryLineAccountsConfig | null
  inventoryLineAccountsState: 'loading' | 'ready' | 'error' | 'stale'
  exogenaPrep: ExogenaPrepItem[]
  onSaveInventoryLine: (data: InventoryLineAccountsFormData) => Promise<void>
  onResetInventoryLine: (line: InventoryLineAccounts) => Promise<void>
  onRetry: () => void
  canManageConfig: boolean
}

export function AccountingConfigTab({
  inventoryLineAccounts,
  inventoryLineAccountsState,
  exogenaPrep,
  onSaveInventoryLine,
  onResetInventoryLine,
  onRetry,
  canManageConfig,
}: AccountingConfigTabProps) {
  const [taxConfigs, setTaxConfigs] = useState<any[]>([])

  useEffect(() => {
    supabaseClient
      .from('tax_rates')
      .select('*')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setTaxConfigs(data.map((t: any) => ({
            id: t.id,
            name: t.name,
            code: t.code,
            ratePercent: Number(t.rate || 0),
            generatedTaxAccountId: '240805',
            generatedTaxAccountName: 'IVA Generado en Ventas (19%)',
            discountableTaxAccountId: '240810',
            discountableTaxAccountName: 'IVA Descontable en Compras (19%)',
            isActive: t.is_active,
          })))
        }
      })
  }, [])

  return (
    <div className="space-y-6 page-enter">
      {/* 1. Cuentas por línea de inventario (la cuenta PUC del producto define su asiento) */}
      <InventoryLineAccountsSection
        config={inventoryLineAccounts}
        state={inventoryLineAccountsState}
        canManage={canManageConfig}
        onSave={onSaveInventoryLine}
        onReset={onResetInventoryLine}
        onRetry={onRetry}
      />

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
