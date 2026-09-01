'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || toasts.length === 0) return null

  return createPortal(
    <div className="toast-notifications-root" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-banner toast-${t.type} toast-pop-in`}
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
              size={18}
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
            <AppIcon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>,
    document.body
  )
}
