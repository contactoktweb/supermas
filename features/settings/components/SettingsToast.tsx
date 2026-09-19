'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface SettingsToastProps {
  toast: {
    message: string
    type: 'success' | 'error' | 'info'
  } | null
}

export function SettingsToast({ toast }: SettingsToastProps) {
  if (!toast) return null

  const isSuccess = toast.type === 'success'
  const isError = toast.type === 'error'

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 animate-slide-in-right flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-xl border border-white/10 text-white"
      style={{
        backgroundColor: isSuccess
          ? 'rgba(6, 78, 59, 0.95)'
          : isError
          ? 'rgba(153, 27, 27, 0.95)'
          : 'rgba(30, 41, 59, 0.95)',
      }}
    >
      <div
        className={`w-7 h-7 rounded-xl flex items-center justify-center ${
          isSuccess ? 'bg-emerald-500/20 text-emerald-300' : isError ? 'bg-rose-500/20 text-rose-300' : 'bg-blue-500/20 text-blue-300'
        }`}
      >
        <AppIcon name={isSuccess ? 'check' : isError ? 'warning' : 'alerts'} size={16} />
      </div>
      <span className="text-xs font-medium max-w-sm leading-snug">{toast.message}</span>
    </div>
  )
}
