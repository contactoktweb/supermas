'use client'

import React, { useEffect, useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { User } from '../types'
import { roleDisplayName } from '../services/role-permissions'

interface UserDeleteDialogProps {
  user: User | null
  onClose: () => void
  onConfirm: () => Promise<void>
}

export function UserDeleteDialog({ user, onClose, onConfirm }: UserDeleteDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!user) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [user, isSubmitting, onClose])

  if (!user) return null

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true)
      await onConfirm()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={isSubmitting ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-delete-user-title"
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-100 flex flex-col gap-4 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs bg-rose-50 text-rose-600 border border-rose-100">
            <AppIcon name="trash" size={24} />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 id="dialog-delete-user-title" className="text-base font-bold text-slate-900 tracking-tight">
              ¿Borrar este usuario?
            </h3>
            <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
              {user.name} <span className="text-slate-400">· {user.email} · {roleDisplayName(user.role)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Cerrar"
          >
            <AppIcon name="close" size={16} />
          </button>
        </div>

        <div className="text-xs sm:text-sm text-slate-600 leading-relaxed bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/70">
          La cuenta se borra <strong className="text-slate-900 font-semibold">definitivamente</strong> y la persona
          no podrá volver a entrar. Esta acción no se puede deshacer. Si el usuario ya tiene ventas, cajas,
          movimientos o auditoría, el sistema no lo borrará para conservar ese historial: en ese caso desactívelo.
        </div>

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
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 disabled:opacity-50 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
          >
            <AppIcon name="trash" size={14} />
            <span>{isSubmitting ? 'Borrando...' : 'Borrar definitivamente'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
