'use client'

import { useEffect } from 'react'
import { AppIcon, type LightIconName } from '@/components/ui/Icon'
import type { HrToastMessage } from '../../types'

const TOAST_DURATION_MS = 5000

interface HrToastContainerProps {
  toasts: HrToastMessage[]
  onDismiss: (id: string) => void
}

export function HrToastContainer({ toasts, onDismiss }: HrToastContainerProps) {
  if (toasts.length === 0) return null
  return (
    <div className="warehouse-toast-container left-4! right-4! sm:left-auto! sm:right-6!" aria-live="polite">
      {toasts.map((toast) => (
        <HrToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function HrToastItem({ toast, onDismiss }: { toast: HrToastMessage; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  const icon: LightIconName = toast.type === 'success' ? 'check' : toast.type === 'error' ? 'warning' : 'info'

  return (
    <div className={`warehouse-toast toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
      <div className="toast-icon">
        <AppIcon name={icon} size={18} />
      </div>
      <div className="toast-body">
        <strong>{toast.title}</strong>
        {toast.description && <p>{toast.description}</p>}
      </div>
      <button type="button" className="icon-button toast-close" onClick={() => onDismiss(toast.id)} aria-label="Cerrar aviso">
        <AppIcon name="close" size={14} />
      </button>
    </div>
  )
}
