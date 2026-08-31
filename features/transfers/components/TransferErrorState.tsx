'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface TransferErrorStateProps {
  message: string
  onRetry: () => void
}

export function TransferErrorState({
  message,
  onRetry,
}: TransferErrorStateProps) {
  return (
    <div className="table-empty-state page-enter error-state">
      <div className="empty-icon-wrap" style={{ background: '#fef2f2', color: 'var(--red)' }}>
        <AppIcon name="warning" size={28} />
      </div>
      <h3>Error al cargar transferencias</h3>
      <p>{message}</p>
      <button
        type="button"
        className="primary-button"
        onClick={onRetry}
      >
        <AppIcon name="refresh" size={14} />
        <span>Reintentar</span>
      </button>
    </div>
  )
}
