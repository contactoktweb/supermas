'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { ToastMessage } from '../hooks/useSuperCatalog'

interface SuperCatalogToastProps {
  toasts: ToastMessage[]
  onRemove: (id: string) => void
}

export function SuperCatalogToast({ toasts, onRemove }: SuperCatalogToastProps) {
  if (toasts.length === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm pointer-events-none"
    >
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success'
        const isError = toast.type === 'error'

        const bgStyles = isSuccess
          ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
          : isError
          ? 'bg-rose-50 border-rose-300 text-rose-900'
          : 'bg-blue-50 border-blue-300 text-blue-900'

        return (
          <div
            key={toast.id}
            className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border shadow-xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-200 pointer-events-auto ${bgStyles}`}
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1 rounded-lg bg-white shadow-xs">
                <AppIcon
                  name={isSuccess ? 'check' : isError ? 'alerts' : 'info'}
                  size={16}
                />
              </div>
              <span className="text-xs font-semibold tracking-wide">{toast.text}</span>
            </div>
            <button
              onClick={() => onRemove(toast.id)}
              className="p-1 rounded-md hover:bg-black/10 text-slate-500 hover:text-slate-800 transition-colors"
              aria-label="Cerrar notificación"
            >
              <AppIcon name="closeSimple" size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
