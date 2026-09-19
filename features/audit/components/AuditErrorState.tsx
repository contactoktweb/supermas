'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface AuditErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function AuditErrorState({
  message = 'Ocurrió un error al consultar los eventos de auditoría.',
  onRetry,
}: AuditErrorStateProps) {
  return (
    <div className="warehouse-error-card" role="alert" style={{ marginBottom: 20 }}>
      <div className="error-icon">
        <AppIcon name="warning" size={20} color="var(--red)" />
      </div>
      <div className="error-content">
        <strong>Error de acceso a auditoría</strong>
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
