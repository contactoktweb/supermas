'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { AccountingAccountRef, InventoryLineAccounts, InventoryLineAccountsConfig } from '../../types'
import { InventoryLineAccountsFormData } from '../../schemas/accounting.schema'
import { PostingAccountOption, isCostAccountCodeFor } from '../../utils/posting-accounts'
import { SelectField } from '@/components/ui/SelectField'

interface InventoryLineAccountsSectionProps {
  config: InventoryLineAccountsConfig | null
  state: 'loading' | 'ready' | 'error' | 'stale'
  canManage: boolean
  onSave: (data: InventoryLineAccountsFormData) => Promise<void>
  onReset: (line: InventoryLineAccounts) => Promise<void>
  onRetry: () => void
}

/** Agrupa las auxiliares por su cuenta PUC de 4 dígitos para los <optgroup>. */
function groupAccounts(accounts: PostingAccountOption[]): { label: string; accounts: PostingAccountOption[] }[] {
  const groups = new Map<string, { label: string; accounts: PostingAccountOption[] }>()
  for (const acc of accounts) {
    const group = groups.get(acc.groupCode) || {
      label: acc.groupName ? `${acc.groupCode} — ${acc.groupName}` : acc.groupCode,
      accounts: [],
    }
    group.accounts.push(acc)
    groups.set(acc.groupCode, group)
  }
  return Array.from(groups.values())
}

function AccountCell({
  account,
  fallback,
  tone,
}: {
  account: AccountingAccountRef | null
  fallback: AccountingAccountRef | null
  tone: 'blue' | 'rose' | 'emerald'
}) {
  const toneClass = {
    blue: 'text-blue-900 bg-blue-50',
    rose: 'text-rose-900 bg-rose-50',
    emerald: 'text-emerald-900 bg-emerald-50',
  }[tone]
  const shown = account || fallback

  if (!shown) {
    return <span className="text-[11px] text-rose-700 font-sans">Sin cuenta por defecto configurada</span>
  }
  return (
    <>
      <span className={`font-bold px-2 py-0.5 rounded ${toneClass}`}>{shown.code}</span>
      <span className="text-gray-600 text-[11px] font-sans block mt-0.5">{shown.name}</span>
      {!account && (
        <span className="inline-flex mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold font-sans bg-gray-100 text-gray-600 border border-gray-200">
          Por defecto
        </span>
      )}
    </>
  )
}

export function InventoryLineAccountsSection({
  config,
  state,
  canManage,
  onSave,
  onReset,
  onRetry,
}: InventoryLineAccountsSectionProps) {
  const [mounted, setMounted] = useState(false)
  const [editingLine, setEditingLine] = useState<InventoryLineAccounts | null>(null)
  const [costAccountId, setCostAccountId] = useState('')
  const [incomeAccountId, setIncomeAccountId] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!editingLine) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) setEditingLine(null)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [editingLine, isSaving])

  const costGroups = useMemo(() => {
    if (!editingLine || !config) return []
    return groupAccounts(
      config.costAccounts.filter((acc) => isCostAccountCodeFor(editingLine.inventoryAccount.code, acc.code))
    )
  }, [editingLine, config])
  const incomeGroups = useMemo(() => groupAccounts(config?.incomeAccounts || []), [config])

  const configuredCount = config?.lines.filter((line) => line.isActive).length ?? 0

  const openEditor = (line: InventoryLineAccounts) => {
    setEditingLine(line)
    setCostAccountId(line.costAccount?.id || '')
    setIncomeAccountId(line.incomeAccount?.id || '')
    setFormError(null)
  }

  const handleSave = async () => {
    if (!editingLine) return
    if (!costAccountId || !incomeAccountId) {
      setFormError('Selecciona la cuenta de costo de ventas y la cuenta de ingreso.')
      return
    }
    setIsSaving(true)
    setFormError(null)
    try {
      await onSave({
        inventoryAccountId: editingLine.inventoryAccount.id,
        costAccountId,
        incomeAccountId,
      })
      setEditingLine(null)
    } catch (err: any) {
      setFormError(err?.message || 'No se pudieron guardar las cuentas de la línea.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = async () => {
    if (!editingLine) return
    setIsSaving(true)
    setFormError(null)
    try {
      await onReset(editingLine)
      setEditingLine(null)
    } catch (err: any) {
      setFormError(err?.message || 'No se pudo restablecer la línea.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="p-4 bg-gray-50 border-b flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Cuentas por línea de inventario</h2>
          <p className="text-xs text-gray-500">
            Cada producto se enlaza a una cuenta auxiliar de inventario. Al vender, el asiento acredita esa cuenta y usa
            el <strong className="text-blue-900">costo de ventas</strong> y el <strong className="text-blue-900">ingreso</strong> de su línea; sin configuración propia se usan las cuentas por defecto.
          </p>
        </div>
        {config && (
          <div className="flex items-center gap-2">
            <span className="badge badge-blue">{config.lines.length} líneas</span>
            <span className="badge badge-teal">{configuredCount} configuradas</span>
          </div>
        )}
      </div>

      {state === 'error' && !config ? (
        <div className="p-6 flex flex-col items-center gap-3 text-center text-xs text-rose-800">
          <AppIcon name="warning" size={20} />
          <p>No se pudieron cargar las cuentas por línea de inventario.</p>
          <button type="button" className="outline-button text-xs py-1" onClick={onRetry}>
            <AppIcon name="refresh" size={13} />
            <span>Reintentar</span>
          </button>
        </div>
      ) : !config ? (
        <div className="p-4 space-y-2" aria-busy="true" aria-label="Cargando cuentas por línea de inventario">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-10 rounded-lg bg-gray-100 animate-pulse motion-reduce:animate-none" />
          ))}
        </div>
      ) : config.lines.length === 0 ? (
        <div className="p-6 flex flex-col items-center gap-2 text-center text-xs text-gray-500">
          <AppIcon name="layers" size={20} className="text-gray-400" />
          <p>No hay cuentas auxiliares de inventario (grupo 14) activas en el Plan de Cuentas.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-gray-50/50 text-gray-600 text-left">
                <th className="py-2.5 px-4 font-semibold">Línea de inventario (grupo 14)</th>
                <th className="py-2.5 px-4 font-semibold">Costo de ventas (61 / 7)</th>
                <th className="py-2.5 px-4 font-semibold">Ingreso (41)</th>
                <th className="py-2.5 px-4 font-semibold text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {config.lines.map((line) => (
                <tr key={line.inventoryAccount.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="py-3 px-4 font-mono">
                    <span className="text-blue-900 font-bold bg-blue-50 px-2 py-0.5 rounded">{line.inventoryAccount.code}</span>
                    <span className="text-gray-800 text-[11px] font-sans font-semibold block mt-0.5">{line.inventoryAccount.name}</span>
                    {line.inventoryAccount.groupName && (
                      <span className="text-gray-500 text-[11px] font-sans block">
                        {line.inventoryAccount.groupCode} — {line.inventoryAccount.groupName}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono">
                    <AccountCell account={line.costAccount} fallback={config.defaultCostAccount} tone="rose" />
                  </td>
                  <td className="py-3 px-4 font-mono">
                    <AccountCell account={line.incomeAccount} fallback={config.defaultIncomeAccount} tone="emerald" />
                  </td>
                  <td className="py-3 px-4 text-right">
                    {canManage && (
                      <button
                        type="button"
                        className="outline-button text-xs py-1"
                        onClick={() => openEditor(line)}
                        aria-label={`Editar cuentas de la línea ${line.inventoryAccount.code}`}
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
      )}

      {editingLine && config && mounted && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inventory-line-dialog-title"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4 relative page-enter">
            <div className="flex items-center justify-between border-b pb-3 gap-3">
              <div>
                <h3 id="inventory-line-dialog-title" className="text-sm font-bold text-gray-900">
                  Línea {editingLine.inventoryAccount.code} — {editingLine.inventoryAccount.name}
                </h3>
                <p className="text-xs text-gray-500">
                  Cuentas auxiliares de costo e ingreso para los productos de esta línea
                </p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setEditingLine(null)}
                disabled={isSaving}
                aria-label="Cerrar"
              >
                <AppIcon name="close" size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label htmlFor="inventory-line-cost" className="block font-semibold text-gray-700 mb-1">
                  Cuenta de costo de ventas:
                </label>
                <SelectField
                  id="inventory-line-cost"
                  value={costAccountId}
                  disabled={isSaving}
                  className="w-full"
                  size="sm"
                  onChange={(value) => setCostAccountId(value)}
                >
                  <option value="">Selecciona una cuenta auxiliar</option>
                  {costGroups.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.code} — {acc.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </SelectField>
              </div>

              <div>
                <label htmlFor="inventory-line-income" className="block font-semibold text-gray-700 mb-1">
                  Cuenta de ingreso por ventas:
                </label>
                <SelectField
                  id="inventory-line-income"
                  value={incomeAccountId}
                  disabled={isSaving}
                  className="w-full"
                  size="sm"
                  onChange={(value) => setIncomeAccountId(value)}
                >
                  <option value="">Selecciona una cuenta auxiliar</option>
                  {incomeGroups.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.code} — {acc.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </SelectField>
              </div>

              {formError && (
                <p className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800" role="alert">
                  {formError}
                </p>
              )}
            </div>

            <div className="flex flex-wrap justify-between gap-2 pt-3 border-t">
              {editingLine.isActive ? (
                <button type="button" className="outline-button text-xs" onClick={handleReset} disabled={isSaving}>
                  Usar cuentas por defecto
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="outline-button text-xs"
                  onClick={() => setEditingLine(null)}
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button type="button" className="primary-button text-xs" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  )
}
