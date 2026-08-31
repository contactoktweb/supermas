'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface TransferEmptyStateProps {
  hasFilters: boolean
  onResetFilters: () => void
  onNewTransfer?: () => void
}

export function TransferEmptyState({
  hasFilters,
  onResetFilters,
  onNewTransfer,
}: TransferEmptyStateProps) {
  return (
    <div className="table-empty-state page-enter">
      <div className="empty-icon-wrap" style={{ background: '#eff6ff', color: 'var(--navy)' }}>
        <AppIcon name="transfers" size={28} />
      </div>
      <h3>
        {hasFilters
          ? 'No se encontraron transferencias con los filtros aplicados'
          : 'No hay transferencias registradas'}
      </h3>
      <p>
        {hasFilters
          ? 'Intente modificar los criterios de búsqueda, cambiar de bodega o limpiar los filtros seleccionados.'
          : 'Inicie un nuevo traslado de mercancía entre bodegas para registrar movimientos en el sistema.'}
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
          onNewTransfer && (
            <button
              type="button"
              className="primary-button"
              onClick={onNewTransfer}
            >
              <AppIcon name="plus" size={14} />
              <span>Nueva transferencia</span>
            </button>
          )
        )}
      </div>
    </div>
  )
}
