import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface ReportToastProps {
  message: {
    text: string
    type: 'success' | 'error' | 'info'
  } | null
  onClose: () => void
}

export function ReportToast({ message, onClose }: ReportToastProps) {
  if (!message) return null

  const bgStyles = {
    success: 'bg-emerald-50 border-emerald-300 text-emerald-900',
    error: 'bg-rose-50 border-rose-300 text-rose-900',
    info: 'bg-blue-50 border-blue-300 text-blue-900',
  }[message.type]

  const iconName = {
    success: 'check' as const,
    error: 'close' as const,
    info: 'info' as const,
  }[message.type]

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-200 ${bgStyles}`}
    >
      <div className="p-1 rounded-lg bg-white shadow-xs">
        <AppIcon name={iconName} size={16} />
      </div>
      <span className="text-xs font-semibold tracking-wide">{message.text}</span>
      <button
        onClick={onClose}
        className="ml-2 p-1 rounded-md hover:bg-black/10 text-slate-500 hover:text-slate-800 transition-colors"
        aria-label="Cerrar notificación"
      >
        <AppIcon name="closeSimple" size={12} />
      </button>
    </div>
  )
}
