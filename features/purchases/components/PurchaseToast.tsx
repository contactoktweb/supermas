'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'

const TOAST_DURATION_MS = 4500

/** Avisos temporales de los módulos de compras. */
export function usePurchaseToasts() {
  const [toasts, setToasts] = React.useState<PurchaseToastMessage[]>([])
  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])
  const addToast = React.useCallback(
    (title: string, message: string, type: PurchaseToastMessage['type'] = 'info') => {
      const id = `toast-${Date.now()}-${Math.random()}`
      setToasts((prev) => [...prev, { id, title, message, type }])
      window.setTimeout(() => dismissToast(id), TOAST_DURATION_MS)
    },
    [dismissToast]
  )
  return { toasts, addToast, dismissToast }
}

export interface PurchaseToastMessage {
  id: string
  title: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
}

interface PurchaseToastContainerProps {
  toasts: PurchaseToastMessage[]
  onDismiss: (id: string) => void
}

export function PurchaseToastContainer({
  toasts,
  onDismiss,
}: PurchaseToastContainerProps) {
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
          className={`toast-banner toast-${t.type === 'warning' ? 'error' : t.type} toast-pop-in`}
          role="alert"
        >
          <div className="toast-icon-side">
            <AppIcon
              name={
                t.type === 'success'
                  ? 'check'
                  : t.type === 'error'
                  ? 'warning'
                  : t.type === 'warning'
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
