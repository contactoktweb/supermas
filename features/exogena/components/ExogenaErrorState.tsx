'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface ExogenaErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function ExogenaErrorState({
  message = 'Ocurrió un error al procesar la información de Exógena.',
  onRetry,
}: ExogenaErrorStateProps) {
  return (
    <div className="warehouse-error-card" role="alert" style={{ marginBottom: 20 }}>
      <div className="error-icon">
        <AppIcon name="warning" size={20} color="var(--red)" />
      </div>
      <div className="error-content">
        <strong>Error en validación o parametrización de Exógena</strong>
        <p>{message}</p>
      </div>
      {onRetry && (
        <button className="outline-button compact" onClick={onRetry}>
          <AppIcon name="refresh" size={14} /> Reintentar
        </button>
      )}
    </div>
  )
}
