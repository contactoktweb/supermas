'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

const VARIANT_STYLES = {
  success: { container: 'bg-emerald-50 border-emerald-200 text-emerald-900', icon: 'check' as const, role: 'status' },
  error: { container: 'bg-red-50 border-red-200 text-red-900', icon: 'warning' as const, role: 'alert' },
}

interface CashFeedbackBannerProps {
  variant: keyof typeof VARIANT_STYLES
  message: string
  onDismiss: () => void
}

export function CashFeedbackBanner({ variant, message, onDismiss }: CashFeedbackBannerProps) {
  const styles = VARIANT_STYLES[variant]
  return (
    <div
      role={styles.role}
      className={`p-4 rounded-xl border text-xs flex items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 motion-reduce:animate-none ${styles.container}`}
    >
      <span className="flex items-center gap-2">
        <AppIcon name={styles.icon} size={18} className="shrink-0" />
        <span>{message}</span>
      </span>
      <button
        type="button"
        className="shrink-0 w-8 h-8 grid place-items-center rounded-lg opacity-70 hover:opacity-100 hover:bg-white/60 transition-opacity focus-visible:outline-2 focus-visible:outline-current"
        onClick={onDismiss}
        aria-label="Cerrar aviso"
      >
        <AppIcon name="close" size={14} />
      </button>
    </div>
  )
}
