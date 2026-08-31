'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface KardexEmptyStateProps {
  hasFilters: boolean
  onResetFilters: () => void
}

export function KardexEmptyState({
  hasFilters,
  onResetFilters,
}: KardexEmptyStateProps) {
  return (
    <div className="product-empty-state-panel page-enter">
      <div className="empty-icon-wrap">
        <AppIcon name="kardex" size={42} color="var(--navy)" />
      </div>

      <h3>
        {hasFilters
          ? 'No se encontraron movimientos con los filtros aplicados'
          : 'Aún no se han registrado movimientos en el Kardex'}
      </h3>

      <p>
        {hasFilters
          ? 'Intenta ajustar tus criterios de búsqueda, bodega, tipo de movimiento o rango de fechas.'
          : 'Cada entrada de compras, venta, ajuste o transferencia generará trazabilidad inmutable aquí.'}
      </p>

      {hasFilters && (
        <div className="empty-actions-row">
          <button
            type="button"
            className="outline-button"
            onClick={onResetFilters}
          >
            <AppIcon name="close" size={14} />
            <span>Restablecer filtros de búsqueda</span>
          </button>
        </div>
      )}
    </div>
  )
}
