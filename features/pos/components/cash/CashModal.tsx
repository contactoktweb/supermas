'use client'

import React, { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { REDUCED_MOTION_CLASS } from './cashUi'

type CashModalTone = 'navy' | 'emerald' | 'red'

const ICON_TONE_CLASS: Record<CashModalTone, string> = {
  navy: 'text-[var(--navy)]',
  emerald: 'bg-emerald-50! text-emerald-600',
  red: 'bg-red-50! text-[var(--red)]',
}

interface CashModalProps {
  title: string
  subtitle?: string
  icon: LightIconName
  tone?: CashModalTone
  size?: 'md' | 'lg'
  onClose: () => void
  children: React.ReactNode
}

/** Contenedor de diálogo estándar del módulo de cajas (portal, cierre con Escape y clic exterior). */
export function CashModal({
  title,
  subtitle,
  icon,
  tone = 'navy',
  size = 'md',
  onClose,
  children,
}: CashModalProps) {
  const [mounted, setMounted] = useState(false)
  const titleId = useId()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!mounted) return null

  return createPortal(
    <div
      className="drawer-backdrop modal-center p-4"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`modal-card animate-in fade-in zoom-in-95 duration-200 ${size === 'lg' ? 'modal-lg' : ''} ${REDUCED_MOTION_CLASS}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header pb-4 border-b border-[var(--line)]">
          <div className="modal-header-title">
            <span className={`modal-icon-badge ${ICON_TONE_CLASS[tone]}`} aria-hidden="true">
              <AppIcon name={icon} size={18} />
            </span>
            <div className="min-w-0">
              <h3 id={titleId}>{title}</h3>
              {subtitle && <p className="truncate">{subtitle}</p>}
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Cerrar diálogo">
            <AppIcon name="close" size={16} />
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body
  )
}

interface CashFormErrorProps {
  message: string | null
}

export function CashFormError({ message }: CashFormErrorProps) {
  if (!message) return null
  return (
    <p
      role="alert"
      className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs animate-in fade-in duration-200"
    >
      <AppIcon name="warning" size={14} className="mt-px shrink-0" />
      <span>{message}</span>
    </p>
  )
}
