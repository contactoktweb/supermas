'use client'

import React, { useState } from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { AlertRule, AlertPriority, AlertModule } from '../../types'
import { AlertRuleConfigInput } from '../../schemas/alert.schema'

interface AlertRulesModalProps {
  rules: AlertRule[]
  isOpen: boolean
  onClose: () => void
  onUpdateRule: (input: AlertRuleConfigInput) => Promise<void>
}

const MODULE_ICONS: Record<AlertModule, LightIconName> = {
  INVENTORY: 'inventory',
  PURCHASES: 'purchases',
  SALES: 'sales',
  INVOICING: 'invoices',
  CASH: 'cashRegisters',
  WEB_ORDERS: 'webOrders',
  TRANSFERS: 'transfers',
  ACCOUNTING: 'accounting',
}

const PRIORITY_SELECT_OPTIONS = [
  { value: 'CRITICA', label: '🔴 Crítica' },
  { value: 'ALTA', label: '🟠 Alta' },
  { value: 'MEDIA', label: '🟡 Media' },
  { value: 'BAJA', label: '🟢 Baja' },
]

export function AlertRulesModal({
  rules,
  isOpen,
  onClose,
  onUpdateRule,
}: AlertRulesModalProps) {
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null)
  const [enabled, setEnabled] = useState(true)
  const [priority, setPriority] = useState<AlertPriority>('ALTA')
  const [thresholds, setThresholds] = useState<Record<string, any>>({})
  const [isSaving, setIsSaving] = useState(false)

  if (!isOpen) return null

  const handleStartEdit = (rule: AlertRule) => {
    setEditingRule(rule)
    setEnabled(rule.enabled)
    setPriority(rule.defaultPriority)
    setThresholds(rule.thresholds ? { ...rule.thresholds } : {})
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingRule) return

    try {
      setIsSaving(true)
      await onUpdateRule({
        ruleId: editingRule.id,
        enabled,
        priority,
        thresholds,
      })
      setEditingRule(null)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-modal-title"
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="space-y-1">
            <h2 id="rules-modal-title" className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shadow-2xs">
                <AppIcon name="settings" size={18} />
              </div>
              <span>Configuración de Reglas de Monitoreo</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Activa o desactiva reglas automáticas y ajusta umbrales numéricos de alerta.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            aria-label="Cerrar modal de reglas"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {editingRule ? (
            /* Editing single rule form */
            <form onSubmit={handleSave} className="space-y-4 rounded-2xl border border-red-200 bg-red-50/30 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs text-red-700 font-bold">{editingRule.code}</span>
                  <h3 className="text-sm font-bold text-slate-900">{editingRule.name}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 hover:underline"
                >
                  Volver al listado
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">{editingRule.description}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Switch Activado */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center justify-between shadow-2xs">
                  <div>
                    <p className="text-xs font-bold text-slate-800">Estado de la Regla</p>
                    <p className="text-[11px] text-slate-500">{enabled ? 'Regla activa y evaluada' : 'Regla pausada'}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="w-5 h-5 accent-red-600 rounded cursor-pointer"
                  />
                </div>

                {/* Prioridad por defecto */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5 shadow-2xs">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Prioridad por Defecto
                  </label>
                  <CustomSelect
                    options={PRIORITY_SELECT_OPTIONS}
                    value={priority}
                    onChange={(val) => setPriority(val as AlertPriority)}
                    placeholder="Prioridad"
                  />
                </div>
              </div>

              {/* Dynamic Thresholds inputs */}
              {editingRule.thresholds && Object.keys(editingRule.thresholds).length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Umbrales de Activación
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(thresholds).map(([key, val]) => (
                      <div key={key} className="space-y-1">
                        <label className="block text-xs font-mono font-semibold text-slate-700 capitalize">{key}</label>
                        <input
                          type="number"
                          value={val ?? 0}
                          onChange={(e) =>
                            setThresholds((prev) => ({
                              ...prev,
                              [key]: Number(e.target.value),
                            }))
                          }
                          className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-xs transition-all disabled:opacity-50"
                >
                  {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          ) : (
            /* Rules list */
            <div className="space-y-2.5">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-4 hover:border-slate-300 hover:shadow-2xs transition-all"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 text-slate-700 mt-0.5 border border-slate-200 shadow-2xs">
                      <AppIcon name={MODULE_ICONS[rule.module] || 'alerts'} size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded">
                          {rule.code}
                        </span>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">{rule.name}</h4>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            rule.enabled
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {rule.enabled ? 'Activa' : 'Pausada'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1 mt-1 font-normal">{rule.description}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleStartEdit(rule)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 shrink-0 transition-all hover:scale-105 active:scale-95 shadow-2xs"
                  >
                    Ajustar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-xs"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
