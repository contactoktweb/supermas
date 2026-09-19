'use client'

import React, { useState, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { User } from '../types'

interface UserDeactivateDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason?: string) => Promise<void>
  user: User | null
}

export function UserDeactivateDialog({
  isOpen,
  onClose,
  onConfirm,
  user,
}: UserDeactivateDialogProps) {
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setReason('')
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !user) return null

  const isDeactivating = user.status === 'ACTIVE'

  const handleAction = async () => {
    try {
      setIsSubmitting(true)
      await onConfirm(reason.trim() || undefined)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-status-title"
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-100 flex flex-col gap-4 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header con icono y títulos */}
        <div className="flex items-start gap-3.5">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
              isDeactivating
                ? 'bg-rose-50 text-rose-600 border border-rose-100'
                : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
            }`}
          >
            <AppIcon name={isDeactivating ? 'warning' : 'check'} size={24} />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h3
              id="dialog-status-title"
              className="text-base font-bold text-slate-900 tracking-tight"
            >
              {isDeactivating ? '¿Desactivar colaborador?' : '¿Habilitar colaborador?'}
            </h3>
            <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
              {user.name}{' '}
              <span className="text-slate-400">(@{user.username})</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Cerrar modal"
          >
            <AppIcon name="close" size={16} />
          </button>
        </div>

        {/* Explicación / Mensaje contextual */}
        <div className="text-xs sm:text-sm text-slate-600 leading-relaxed bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/70">
          {isDeactivating ? (
            <span>
              Al desactivar la cuenta, el usuario{' '}
              <strong className="text-slate-900 font-semibold">no podrá iniciar sesión</strong> ni
              realizar operaciones en el ERP. Todo su historial de ventas, compras y auditoría se mantendrá intacto.
            </span>
          ) : (
            <span>
              Al activar la cuenta, el usuario recuperará acceso inmediato al sistema con los permisos derivados de su rol{' '}
              <strong className="text-slate-900 font-semibold">{user.role}</strong>.
            </span>
          )}
        </div>

        {/* Motivo de desactivación (Opcional) */}
        {isDeactivating && (
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Motivo de la desactivación <span className="text-slate-400 font-normal">(opcional para auditoría)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Fin de contrato temporal, cambio de sucursal o suspensión..."
              rows={3}
              className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition-all resize-none"
            />
          </div>
        )}

        {/* Acciones del Modal */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl transition-colors shadow-2xs"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleAction}
            disabled={isSubmitting}
            className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 disabled:opacity-50 ${
              isDeactivating
                ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800'
                : 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800'
            }`}
          >
            <AppIcon name={isDeactivating ? 'close' : 'check'} size={14} />
            <span>
              {isSubmitting
                ? 'Procesando...'
                : isDeactivating
                ? 'Confirmar Desactivación'
                : 'Confirmar Activación'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
