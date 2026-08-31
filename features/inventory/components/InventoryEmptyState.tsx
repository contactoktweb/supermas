'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface InventoryEmptyStateProps {
  hasFilters: boolean
  onResetFilters: () => void
}

export function InventoryEmptyState({
  hasFilters,
  onResetFilters,
}: InventoryEmptyStateProps) {
  return (
    <div className="table-empty-state-panel animate-fade-in">
      <div className="empty-state-icon-wrap">
        <AppIcon name="inventory" size={32} color="#94a3b8" />
      </div>
      <h3>No se encontraron existencias</h3>
      <p>
        {hasFilters
          ? 'No hay productos o bodegas que coincidan con los criterios de búsqueda y filtros seleccionados.'
          : 'No se encontraron registros de inventario disponibles.'}
      </p>
      {hasFilters && (
        <button
          type="button"
          className="outline-button compact reset-empty-btn"
          onClick={onResetFilters}
        >
          <AppIcon name="close" size={12} />
          <span>Limpiar filtros de búsqueda</span>
        </button>
      )}
    </div>
  )
}
