'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface PurchaseEmptyStateProps {
  hasFilters: boolean
  onResetFilters: () => void
  onNewPurchase?: () => void
}

export function PurchaseEmptyState({
  hasFilters,
  onResetFilters,
  onNewPurchase,
}: PurchaseEmptyStateProps) {
  return (
    <div className="table-empty-state page-enter">
      <div className="empty-icon-wrap" style={{ background: '#eff6ff', color: 'var(--navy)' }}>
        <AppIcon name="purchases" size={28} />
      </div>
      <h3>
        {hasFilters
          ? 'No se encontraron compras con los filtros aplicados'
          : 'No hay órdenes de compra registradas'}
      </h3>
      <p>
        {hasFilters
          ? 'Intente modificar los criterios de búsqueda, cambiar de proveedor, estado o limpiar los filtros seleccionados.'
          : 'Comience creando una nueva compra a proveedor para registrar recepciones físicas e ingresar inventario al sistema.'}
      </p>
      <div className="empty-actions-row">
        {hasFilters ? (
          <button
            type="button"
            className="outline-button"
            onClick={onResetFilters}
          >
            <AppIcon name="close" size={14} />
            <span>Limpiar filtros</span>
          </button>
        ) : (
          onNewPurchase && (
            <button
              type="button"
              className="primary-button"
              onClick={onNewPurchase}
            >
              <AppIcon name="plus" size={14} />
              <span>Nueva compra</span>
            </button>
          )
        )}
      </div>
    </div>
  )
}
