'use client'

import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface WarehouseErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function WarehouseErrorState({
  message = 'Ocurrió un error al cargar la información de bodegas.',
  onRetry,
}: WarehouseErrorStateProps) {
  return (
    <div className="warehouse-error-card" role="alert">
      <div className="error-icon">
        <AlertTriangle size={20} />
      </div>
      <div className="error-content">
        <strong>Error de conexión u operación</strong>
        <p>{message}</p>
      </div>
      {onRetry && (
        <button className="outline-button compact" onClick={onRetry}>
          <RefreshCw size={14} /> Reintentar
        </button>
      )}
    </div>
  )
}
