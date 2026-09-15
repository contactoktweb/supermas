'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface TaxErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function TaxErrorState({
  message = 'Ocurrió un error al cargar la información tributaria.',
  onRetry,
}: TaxErrorStateProps) {
  return (
    <div className="warehouse-error-card" role="alert" style={{ marginBottom: 20 }}>
      <div className="error-icon">
        <AppIcon name="warning" size={20} color="var(--red)" />
      </div>
      <div className="error-content">
        <strong>Error tributario u operativo</strong>
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
