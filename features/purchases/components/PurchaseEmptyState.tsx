'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface PurchaseEmptyStateProps {
  hasFilters?: boolean
  onResetFilters?: () => void
  onNewPurchase?: () => void
}

export function PurchaseEmptyState({
  hasFilters,
  onResetFilters,
  onNewPurchase,
}: PurchaseEmptyStateProps) {
  return (
    <div
      style={{
        padding: '48px 24px',
        textAlign: 'center',
        color: 'var(--muted)',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: '#e9eef8',
          color: 'var(--navy)',
          display: 'grid',
          placeItems: 'center',
          margin: '0 auto 12px',
        }}
      >
        <AppIcon name="purchases" size={24} />
      </div>
      <strong style={{ fontSize: 15, color: 'var(--navy)' }}>
        No hay compras registradas
      </strong>
      <p style={{ margin: '4px 0 0', fontSize: 13 }}>
        No hay compras que coincidan con los filtros o aún no se han registrado compras en el sistema.
      </p>
    </div>
  )
}
