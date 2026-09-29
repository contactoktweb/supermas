'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface ProductEmptyStateProps {
  hasFilters?: boolean
  onResetFilters?: () => void
  onNewProduct?: () => void
}

export function ProductEmptyState({
  hasFilters,
  onResetFilters,
  onNewProduct,
}: ProductEmptyStateProps) {
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
        <AppIcon name="products" size={24} />
      </div>
      <strong style={{ fontSize: 15, color: 'var(--navy)' }}>
        No hay productos registrados
      </strong>
      <p style={{ margin: '4px 0 0', fontSize: 13 }}>
        No hay productos que coincidan con los filtros o aún no se han registrado artículos en el catálogo.
      </p>
    </div>
  )
}
