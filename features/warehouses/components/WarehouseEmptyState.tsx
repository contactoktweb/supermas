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
  actionLabel,
  onAction,
}: WarehouseEmptyStateProps) {
  let title = 'No encontramos bodegas con estos filtros'
  let description = 'Intenta modificando los criterios de búsqueda o limpia los filtros para ver todas las ubicaciones.'
  let defaultAction = 'Limpiar filtros'
  let iconName: LightIconName = 'search'

  if (type === 'NO_WAREHOUSES') {
    title = 'Aún no existen bodegas configuradas'
    description = 'Comienza agregando la bodega principal o punto de venta para gestionar el inventario y operaciones de Super Más.'
    defaultAction = 'Crear primera bodega'
    iconName = 'warehouse'
  } else if (type === 'NO_MOVEMENTS') {
    title = 'Esta bodega todavía no tiene movimientos de inventario'
    description = 'Los movimientos de Kardex se registrarán automáticamente cuando se reciban compras, transferencias o ventas.'
    defaultAction = 'Realizar ajuste de inventario'
    iconName = 'kardex'
  } else if (type === 'NO_ITEMS') {
    title = 'No hay registros disponibles'
    description = 'Actualmente no se han encontrado datos asociados para esta sección.'
    defaultAction = 'Actualizar'
    iconName = 'inventory'
  }

  return (
    <div className="drawer-empty warehouse-empty-panel">
      <div className="empty-icon-bubble">
        <AppIcon name={iconName} size={28} />
      </div>
      <h3>{customTitle || title}</h3>
      <p>{customDescription || description}</p>
      {onAction && (
        <button className="primary-button compact" onClick={onAction} style={{ marginTop: 14 }}>
          <AppIcon name={type === 'NO_WAREHOUSES' ? 'plus' : 'refresh'} size={15} />
          {actionLabel || defaultAction}
        </button>
      )}
    </div>
  )
}
