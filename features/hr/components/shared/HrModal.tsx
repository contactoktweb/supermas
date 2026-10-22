'use client'

import React, { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon, type LightIconName } from '@/components/ui/Icon'
import { HR_REDUCED_MOTION } from './hr-ui'

type HrModalTone = 'navy' | 'emerald' | 'red' | 'amber'

const ICON_TONE_CLASS: Record<HrModalTone, string> = {
  navy: 'text-[var(--navy)]',
  emerald: 'bg-emerald-50! text-emerald-600',
  red: 'bg-red-50! text-[var(--red)]',
  amber: 'bg-amber-50! text-amber-600',
}

interface HrModalProps {
  title: string
  subtitle?: string
  icon: LightIconName
  tone?: HrModalTone
  size?: 'md' | 'lg'
  isBusy?: boolean
  onClose: () => void
  children: React.ReactNode
}

/** Diálogo estándar (patrón CashModal): portal, cierre con Escape y clic exterior. */
export function HrModal({ title, subtitle, icon, tone = 'navy', size = 'md', isBusy = false, onClose, children }: HrModalProps) {
  const [mounted, setMounted] = useState(false)
  const titleId = useId()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, isBusy])

  if (!mounted) return null

  return createPortal(
    <div className="drawer-backdrop modal-center p-4" onClick={() => !isBusy && onClose()}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`modal-card animate-in fade-in zoom-in-95 duration-200 ${size === 'lg' ? 'modal-lg' : ''} ${HR_REDUCED_MOTION}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header pb-4 border-b border-[var(--line)]">
          <div className="modal-header-title">
            <span className={`modal-icon-badge ${ICON_TONE_CLASS[tone]}`} aria-hidden="true">
              <AppIcon name={icon} size={18} />
            </span>
            <div className="min-w-0">
              <h2 id={titleId} className="m-0 text-base font-bold">
                {title}
              </h2>
              {subtitle && <p className="truncate">{subtitle}</p>}
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} disabled={isBusy} aria-label="Cerrar diálogo">
            <AppIcon name="close" size={16} />
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body
  )
}
