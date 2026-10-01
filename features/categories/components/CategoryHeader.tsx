'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface CategoryHeaderProps {
  totalCount: number
  canCreate: boolean
  onCreateClick: () => void
  onRefreshClick: () => void
  isLoading?: boolean
}

export function CategoryHeader({
  totalCount,
  canCreate,
  onCreateClick,
  onRefreshClick,
  isLoading,
}: CategoryHeaderProps) {
  return (
    <header className="page-heading page-enter">
      <div>
        <p className="eyebrow">Catálogo Central &bull; {totalCount} categorías registradas</p>
        <h1>Categorías de Productos</h1>
        <p className="welcome-subtitle">
          Organiza el catálogo en categorías jerárquicas y subcategorías para inventario, ventas y ecommerce.
        </p>
      </div>

      <div className="heading-actions">
        <button
          type="button"
          className="outline-button"
          onClick={onRefreshClick}
          disabled={isLoading}
          title="Actualizar lista de categorías"
        >
          <AppIcon name="refresh" size={16} className={isLoading ? 'spin' : ''} />
          <span>Actualizar</span>
        </button>

        {canCreate && (
          <button
            type="button"
            className="primary-button"
            onClick={onCreateClick}
            title="Crear nueva categoría o subcategoría"
          >
            <AppIcon name="plus" size={16} />
            <span>Nueva categoría</span>
          </button>
        )}
      </div>
    </header>
  )
}
