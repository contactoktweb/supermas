'use client'

import React from 'react'
import Link from 'next/link'
import { AppIcon } from '@/components/ui/Icon'

interface NotificationButtonProps {
  onNavigate?: (view: string) => void
  count?: number
  className?: string
}

export function NotificationButton({
  onNavigate,
  count = 3,
  className = '',
}: NotificationButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (onNavigate) {
      e.preventDefault()
      onNavigate('Alertas')
    }
  }

  return (
    <Link
      href="/alertas"
      onClick={handleClick}
      className={`notification icon-button ${className}`}
      aria-label="Ver alertas y notificaciones del sistema"
      title="Alertas y notificaciones operativas"
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        textDecoration: 'none',
      }}
    >
      <AppIcon name="alerts" size={18} />
      {count > 0 && <i>{count}</i>}
    </Link>
  )
}
