'use client'

import React, { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon, type LightIconName } from '@/components/ui/Icon'
import { HR_REDUCED_MOTION } from './hr-ui'

interface HrDrawerProps {
  eyebrow: string
  title: string
  icon: LightIconName
  isBusy?: boolean
  onClose: () => void
  children: React.ReactNode
}

/** Panel lateral estándar (patrón ProductFormDrawer / CategoryFormDrawer, clase product-drawer). */
export function HrDrawer({ eyebrow, title, icon, isBusy = false, onClose, children }: HrDrawerProps) {
  const [mounted, setMounted] = useState(false)
  const titleId = useId()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isBusy, onClose])

  if (!mounted) return null

  return createPortal(
    <div className="drawer-backdrop" onClick={() => !isBusy && onClose()}>
      <aside
        className={`product-drawer product-form-drawer catalog-form-drawer page-enter w-full! sm:w-[min(100%,640px)]! ${HR_REDUCED_MOTION}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="drawer-header catalog-form-header">
          <div className="catalog-form-title">
            <span className="stat-icon blue" aria-hidden="true">
              <AppIcon name={icon} size={20} />
            </span>
            <div className="min-w-0">
              <span className="product-category-eyebrow">{eyebrow}</span>
              <h2 id={titleId}>{title}</h2>
            </div>
          </div>
          <button
            type="button"
            className="icon-button catalog-form-close"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Cerrar panel"
          >
            <AppIcon name="close" size={20} />
          </button>
        </header>
        {children}
      </aside>
    </div>,
    document.body
  )
}
