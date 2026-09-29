'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'

interface WarehouseEmptyStateProps {
  type?: 'NO_WAREHOUSES' | 'NO_FILTER_RESULTS' | 'NO_MOVEMENTS' | 'NO_ITEMS'
  customTitle?: string
  customDescription?: string
  actionLabel?: string
  onAction?: () => void
}

export function WarehouseEmptyState({
  type = 'NO_FILTER_RESULTS',
  customTitle,
  customDescription,
}: WarehouseEmptyStateProps) {
  let title = 'No hay bodegas registradas'
  let description =
    'No hay bodegas que coincidan con los filtros o aún no se han configurado ubicaciones en el sistema.'
  let iconName: LightIconName = 'warehouses'

  if (type === 'NO_MOVEMENTS') {
    title = 'No hay movimientos de inventario'
    description =
      'Esta bodega todavía no presenta movimientos registrados en el Kardex.'
    iconName = 'kardex'
  } else if (type === 'NO_ITEMS') {
    title = 'No hay productos registrados'
    description =
      'No hay productos asociados para esta bodega o sección.'
    iconName = 'products'
  }

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
        <AppIcon name={iconName} size={24} />
      </div>
      <strong style={{ fontSize: 15, color: 'var(--navy)' }}>
        {customTitle || title}
      </strong>
      <p style={{ margin: '4px 0 0', fontSize: 13 }}>
        {customDescription || description}
      </p>
    </div>
  )
}
