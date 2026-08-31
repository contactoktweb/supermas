'use client'

import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface DashboardErrorStateProps {
  message?: string
  onRetry: () => void
}

export function DashboardErrorState({
  message = 'Ocurrió un error al procesar las estadísticas del centro de control.',
  onRetry,
}: DashboardErrorStateProps) {
  return (
    <div className="warehouse-error-state page-enter">
      <div className="error-icon-box">
        <AlertTriangle size={32} color="var(--red)" />
      </div>
      <h2>No fue posible cargar el Dashboard</h2>
      <p>{message}</p>
      <button type="button" className="primary-button" onClick={onRetry}>
        <RefreshCw size={15} /> Reintentar sincronización
      </button>
    </div>
  )
}
