'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface KardexErrorStateProps {
  message: string
  onRetry: () => void
}

export function KardexErrorState({ message, onRetry }: KardexErrorStateProps) {
  return (
    <div className="product-error-panel page-enter">
      <div className="error-icon-circle">
        <AppIcon name="warning" size={36} color="var(--red)" />
      </div>
      <h3>Error al cargar trazabilidad del Kardex</h3>
      <p>{message}</p>
      <button
        type="button"
        className="primary-button"
        onClick={onRetry}
      >
        <AppIcon name="refresh" size={16} />
        <span>Reintentar consulta</span>
      </button>
    </div>
  )
}
