'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

export interface TransferToastMessage {
  id: string
  title: string
  message: string
  type: 'success' | 'error' | 'info'
}

interface TransferToastContainerProps {
  toasts: TransferToastMessage[]
  onDismiss: (id: string) => void
}

export function TransferToastContainer({
  toasts,
  onDismiss,
}: TransferToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div className="toast-notifications-root" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-banner toast-${t.type} page-enter`}
          role="alert"
        >
          <div className="toast-icon-side">
            <AppIcon
              name={
                t.type === 'success'
                  ? 'check'
                  : t.type === 'error'
                  ? 'warning'
                  : 'info'
              }
              size={16}
            />
          </div>
          <div className="toast-body-side">
            <strong>{t.title}</strong>
            <p>{t.message}</p>
          </div>
          <button
            type="button"
            className="toast-close-side"
            onClick={() => onDismiss(t.id)}
            aria-label="Cerrar notificación"
          >
            <AppIcon name="close" size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}
