'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface ProductErrorStateProps {
  message: string
  onRetry: () => void
}

export function ProductErrorState({ message, onRetry }: ProductErrorStateProps) {
  return (
    <div className="product-error-panel page-enter">
      <div className="error-icon-circle">
        <AppIcon name="warning" size={36} color="var(--red)" />
      </div>
      <h3>Error al cargar el catálogo de productos</h3>
      <p>{message}</p>
      <button
        type="button"
        className="primary-button"
        onClick={onRetry}
      >
        <AppIcon name="check" size={16} />
        <span>Reintentar</span>
      </button>
    </div>
  )
}
