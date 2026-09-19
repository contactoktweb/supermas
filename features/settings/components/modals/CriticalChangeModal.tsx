'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { CriticalModalState } from '../../hooks/useSettings'

interface CriticalChangeModalProps {
  modal: CriticalModalState
  onClose: () => void
  isSubmitting?: boolean
}

export function CriticalChangeModal({
  modal,
  onClose,
  isSubmitting,
}: CriticalChangeModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!modal.isOpen || !mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="relative w-full max-w-md rounded-2xl bg-white border border-rose-200 p-6 shadow-2xl space-y-5 animate-scale-up text-left"
        role="dialog"
        aria-modal="true"
        aria-labelledby="critical-modal-title"
      >
        {/* Header with warning icon */}
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
            <AppIcon name="warning" size={20} />
          </div>
          <div className="space-y-1">
            <h3 id="critical-modal-title" className="text-base font-bold text-[var(--navy)]">
              {modal.title || 'Confirmación de Cambio Crítico'}
            </h3>
            <p className="text-xs text-rose-600 font-medium">
              Este cambio puede afectar operaciones futuras del ERP.
            </p>
          </div>
        </div>

        {/* Descriptive Message */}
        <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          {modal.message}
        </p>

        {/* Diff Details */}
        <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 space-y-2 text-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            {modal.fieldLabel}
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
            <div>
              <span className="text-[10px] text-slate-400 block">Valor Anterior</span>
              <span className="font-mono text-rose-600 font-semibold truncate block">
                {modal.previousValue || '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Nuevo Valor</span>
              <span className="font-mono text-emerald-600 font-semibold truncate block">
                {modal.newValue || '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="outline-button px-4 py-2 text-xs"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={modal.onConfirm}
            disabled={isSubmitting}
            className="primary-button bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-xs font-semibold shadow-md flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Aplicando...</span>
              </>
            ) : (
              <>
                <AppIcon name="check" size={14} />
                <span>Sí, Confirmar y Guardar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
