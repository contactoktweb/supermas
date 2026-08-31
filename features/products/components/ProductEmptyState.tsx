'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface ProductEmptyStateProps {
  hasFilters: boolean
  onResetFilters: () => void
  onNewProduct: () => void
}

export function ProductEmptyState({
  hasFilters,
  onResetFilters,
  onNewProduct,
}: ProductEmptyStateProps) {
  return (
    <div className="product-empty-state-panel page-enter">
      <div className="empty-icon-wrap">
        <AppIcon name="products" size={42} color="var(--navy)" />
      </div>

      <h3>
        {hasFilters
          ? 'No se encontraron productos con los filtros seleccionados'
          : 'Aún no hay productos registrados en el catálogo'}
      </h3>

      <p>
        {hasFilters
          ? 'Intenta ajustar tus criterios de búsqueda, categoría, marca o disponibilidad de inventario.'
          : 'Empieza registrando tu primer producto con listas de precios y perfiles de IVA.'}
      </p>

      <div className="empty-actions-row">
        {hasFilters ? (
          <button
            type="button"
            className="outline-button"
            onClick={onResetFilters}
          >
            <AppIcon name="close" size={14} />
            <span>Restablecer filtros</span>
          </button>
        ) : (
          <button
            type="button"
            className="primary-button"
            onClick={onNewProduct}
          >
            <AppIcon name="plus" size={16} />
            <span>Crear primer producto</span>
          </button>
        )}
      </div>
    </div>
  )
}
