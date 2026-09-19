'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface WebOrderToastProps {
  feedback: {
    type: 'success' | 'error'
    message: string
  } | null
  onClose: () => void
}

export function WebOrderToast({ feedback, onClose }: WebOrderToastProps) {
  if (!feedback) return null

  const isSuccess = feedback.type === 'success'

  return (
    <div
      role="alert"
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl transition-all duration-300 transform translate-y-0 border ${
        isSuccess
          ? 'bg-emerald-900/90 text-emerald-100 border-emerald-700/60 backdrop-blur-md'
          : 'bg-rose-900/90 text-rose-100 border-rose-700/60 backdrop-blur-md'
      }`}
    >
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center ${
          isSuccess ? 'bg-emerald-700 text-white' : 'bg-rose-700 text-white'
        }`}
      >
        <AppIcon name={isSuccess ? 'check' : 'close'} size={16} />
      </div>

      <div className="text-sm font-medium tracking-wide max-w-sm">{feedback.message}</div>

      <button
        type="button"
        onClick={onClose}
        className="ml-2 text-white/60 hover:text-white transition-colors"
        aria-label="Cerrar notificación"
      >
        <AppIcon name="close" size={14} />
      </button>
    </div>
  )
}
