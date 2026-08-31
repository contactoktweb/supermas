'use client'

import React, { useEffect } from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'info'
  title: string
  description?: string
}

interface WarehouseToastProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

export function WarehouseToastContainer({ toasts, onDismiss }: WarehouseToastProps) {
  if (toasts.length === 0) return null

  return (
    <div className="warehouse-toast-container" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss()
    }, 4500)
    return () => clearTimeout(timer)
  }, [onDismiss])

  const iconName: LightIconName =
    toast.type === 'success' ? 'check' : toast.type === 'error' ? 'warning' : 'info'

  return (
    <div className={`warehouse-toast toast-${toast.type}`}>
      <div className="toast-icon">
        <AppIcon name={iconName} size={18} />
      </div>
      <div className="toast-body">
        <strong>{toast.title}</strong>
        {toast.description && <p>{toast.description}</p>}
      </div>
      <button className="icon-button toast-close" onClick={onDismiss} aria-label="Cerrar notificación">
        <AppIcon name="close" size={14} />
      </button>
    </div>
  )
}
