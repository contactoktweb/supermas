'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface PurchaseErrorStateProps {
  message?: string
  onRetry: () => void
}

export function PurchaseErrorState({
  message = 'Ocurrió un error al cargar las compras.',
  onRetry,
}: PurchaseErrorStateProps) {
  return (
    <div className="table-empty-state page-enter">
      <div className="empty-icon-wrap" style={{ background: '#fef2f2', color: '#dc2626' }}>
        <AppIcon name="warning" size={28} />
      </div>
      <h3 style={{ color: '#991b1b' }}>Error de conexión con la base de datos</h3>
      <p>{message}</p>
      <div className="empty-actions-row">
        <button type="button" className="outline-button" onClick={onRetry}>
          <AppIcon name="refresh" size={14} />
          <span>Reintentar</span>
        </button>
      </div>
    </div>
  )
}
