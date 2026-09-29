'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface KardexEmptyStateProps {
  hasFilters?: boolean
  onResetFilters?: () => void
}

export function KardexEmptyState({
  hasFilters,
  onResetFilters,
}: KardexEmptyStateProps) {
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
        <AppIcon name="kardex" size={24} />
      </div>
      <strong style={{ fontSize: 15, color: 'var(--navy)' }}>
        No hay movimientos de kardex registrados
      </strong>
      <p style={{ margin: '4px 0 0', fontSize: 13 }}>
        No hay movimientos que coincidan con los filtros o aún no se han registrado movimientos en el sistema.
      </p>
    </div>
  )
}
