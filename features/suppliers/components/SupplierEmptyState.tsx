'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface SupplierEmptyStateProps {
  hasFilters?: boolean
  onResetFilters?: () => void
  onNewSupplier?: () => void
}

export function SupplierEmptyState({
  hasFilters,
  onResetFilters,
  onNewSupplier,
}: SupplierEmptyStateProps) {
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
        <AppIcon name="suppliers" size={24} />
      </div>
      <strong style={{ fontSize: 15, color: 'var(--navy)' }}>
        No hay proveedores registrados
      </strong>
      <p style={{ margin: '4px 0 0', fontSize: 13 }}>
        No hay proveedores que coincidan con los filtros o aún no se han registrado proveedores en el sistema.
      </p>
    </div>
  )
}
