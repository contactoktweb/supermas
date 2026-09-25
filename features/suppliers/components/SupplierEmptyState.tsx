'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface SupplierEmptyStateProps {
  hasFilters: boolean
  onResetFilters: () => void
  onNewSupplier?: () => void
}

export function SupplierEmptyState({
  hasFilters,
  onResetFilters,
  onNewSupplier,
}: SupplierEmptyStateProps) {
  return (
    <div className="table-empty-state page-enter">
      <div className="empty-icon-wrap" style={{ background: '#eff6ff', color: 'var(--navy)' }}>
        <AppIcon name="suppliers" size={28} />
      </div>
      <h3>
        {hasFilters
          ? 'No se encontraron proveedores con los criterios aplicados'
          : 'No existen proveedores registrados'}
      </h3>
      <p>
        {hasFilters
          ? 'Intente modificar los términos de búsqueda, cambiar de bodega o limpiar los filtros activos.'
          : 'Comience registrando un nuevo proveedor comercial para vincular órdenes de compra, productos y cuentas por pagar.'}
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
          onNewSupplier && (
            <button
              type="button"
              className="primary-button"
              onClick={onNewSupplier}
            >
              <AppIcon name="plus" size={14} />
              <span>Nuevo proveedor</span>
            </button>
          )
        )}
      </div>
    </div>
  )
}
