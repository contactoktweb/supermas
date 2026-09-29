'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface InventoryEmptyStateProps {
  hasFilters?: boolean
  onResetFilters?: () => void
  onOpenAdjustModal?: () => void
  onOpenTransferModal?: () => void
  activeTab?: string
  query?: string
  locationId?: string
  category?: string
  brand?: string
  onSelectTab?: (tab: any) => void
}

export function InventoryEmptyState({
  hasFilters,
  onResetFilters,
}: InventoryEmptyStateProps) {
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
        <AppIcon name="inventory" size={24} />
      </div>
      <strong style={{ fontSize: 15, color: 'var(--navy)' }}>
        No hay existencias de inventario registradas
      </strong>
      <p style={{ margin: '4px 0 0', fontSize: 13 }}>
        No hay productos que coincidan con los filtros o aún no se han registrado existencias en el sistema.
      </p>
    </div>
  )
}
