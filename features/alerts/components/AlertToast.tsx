'use client'

import React, { useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface AlertToastProps {
  toast: { message: string; type: 'success' | 'error' | 'info' } | null
  onClose: () => void
  duration?: number
}

export function AlertToast({ toast, onClose, duration = 4000 }: AlertToastProps) {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => {
      onClose()
    }, duration)
    return () => clearTimeout(timer)
  }, [toast, duration, onClose])

  if (!toast) return null

  const isSuccess = toast.type === 'success'
  const isError = toast.type === 'error'

  return (
    <div
      role="alert"
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border backdrop-blur-sm transition-all duration-300 animate-in slide-in-from-bottom-5 ${
        isSuccess
          ? 'bg-white border-emerald-200 text-slate-800 ring-1 ring-emerald-500/20'
          : isError
          ? 'bg-white border-rose-200 text-slate-800 ring-1 ring-rose-500/20'
          : 'bg-white border-blue-200 text-slate-800 ring-1 ring-blue-500/20'
      }`}
    >
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
          isSuccess
            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
            : isError
            ? 'bg-rose-50 text-rose-600 border border-rose-200'
            : 'bg-blue-50 text-blue-600 border border-blue-200'
        }`}
      >
        <AppIcon name={isSuccess ? 'check' : isError ? 'warning' : 'alerts'} size={18} />
      </div>

      <p className="text-xs sm:text-sm font-semibold pr-2 max-w-sm text-slate-800">{toast.message}</p>

      <button
        type="button"
        onClick={onClose}
        className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
        aria-label="Cerrar notificación"
      >
        <AppIcon name="close" size={14} />
      </button>
    </div>
  )
}
