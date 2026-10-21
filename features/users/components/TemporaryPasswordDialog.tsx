'use client'

import React, { useEffect, useRef, useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface TemporaryPasswordDialogProps {
  /** Contraseña temporal generada por el servidor; `null` mantiene el diálogo cerrado. */
  password: string | null
  userName: string
  onClose: () => void
}

type CopyState = 'idle' | 'copied' | 'error'

const COPY_FEEDBACK_MS = 2500

/**
 * Muestra UNA sola vez la contraseña temporal generada por el servidor. No se guarda en ningún
 * almacenamiento: al cerrar el diálogo el valor se descarta de la memoria del componente padre.
 */
export function TemporaryPasswordDialog({ password, userName, onClose }: TemporaryPasswordDialogProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const isOpen = Boolean(password)

  useEffect(() => {
    if (!isOpen) return
    setCopyState('idle')
    closeButtonRef.current?.focus()
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (copyState === 'idle') return
    const timer = window.setTimeout(() => setCopyState('idle'), COPY_FEEDBACK_MS)
    return () => window.clearTimeout(timer)
  }, [copyState])

  if (!password) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password)
      setCopyState('copied')
    } catch {
      setCopyState('error')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="temporary-password-title"
      aria-describedby="temporary-password-description"
    >
      <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-100 flex flex-col gap-4 animate-in zoom-in-95 duration-200 motion-reduce:animate-none">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs bg-emerald-50 text-emerald-600 border border-emerald-100">
            <AppIcon name="lock" size={24} aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h2 id="temporary-password-title" className="text-base font-bold text-slate-900 tracking-tight">
              Contraseña temporal asignada
            </h2>
            <p className="text-xs text-slate-500 font-medium truncate mt-0.5">{userName}</p>
          </div>
        </div>

        <p
          id="temporary-password-description"
          className="text-xs sm:text-sm text-slate-600 leading-relaxed bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/70 m-0"
        >
          Entréguela al colaborador por un canal seguro. <strong className="text-slate-900">Solo se muestra esta vez</strong>{' '}
          y el sistema le pedirá cambiarla en su primer ingreso.
        </p>

        <div className="flex items-stretch gap-2">
          <code
            className="flex-1 min-w-0 break-all select-all rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-mono text-sm text-slate-900"
            aria-label="Contraseña temporal"
          >
            {password}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--navy)] active:scale-[0.98] motion-reduce:transition-none"
          >
            <AppIcon name={copyState === 'copied' ? 'checkSimple' : 'fileText'} size={14} aria-hidden="true" />
            {copyState === 'copied' ? 'Copiada' : 'Copiar'}
          </button>
        </div>

        <p role="status" aria-live="polite" className="m-0 min-h-4 text-[11px] font-medium text-rose-700">
          {copyState === 'error' ? 'No se pudo copiar automáticamente. Selecciónela y cópiela manualmente.' : ''}
        </p>

        <div className="flex justify-end">
          <button ref={closeButtonRef} type="button" onClick={onClose} className="primary-button">
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
