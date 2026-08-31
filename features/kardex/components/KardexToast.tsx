'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

export interface KardexToastMessage {
  id: string
  title: string
  message: string
  type: 'success' | 'error' | 'info'
}

interface KardexToastProps {
  toasts: KardexToastMessage[]
  onDismiss: (id: string) => void
}

export function KardexToastContainer({ toasts, onDismiss }: KardexToastProps) {
  if (toasts.length === 0) return null

  return (
    <div className="toast-container" role="region" aria-label="Notificaciones del Kardex">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-card toast-${toast.type} page-enter`}>
          <div className="toast-icon">
            <AppIcon
              name={
                toast.type === 'success'
                  ? 'check'
                  : toast.type === 'error'
                  ? 'warning'
                  : 'kardex'
              }
              size={18}
            />
          </div>
          <div className="toast-body">
            <strong>{toast.title}</strong>
            <p>{toast.message}</p>
          </div>
          <button
            type="button"
            className="toast-close-btn"
            onClick={() => onDismiss(toast.id)}
            aria-label="Cerrar notificación"
          >
            <AppIcon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
