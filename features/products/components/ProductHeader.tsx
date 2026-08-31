'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface ProductHeaderProps {
  viewMode: 'table' | 'grid'
  onViewModeChange: (mode: 'table' | 'grid') => void
  onNewProduct: () => void
  onImport: () => void
  onExport: () => void
}

export function ProductHeader({
  viewMode,
  onViewModeChange,
  onNewProduct,
  onImport,
  onExport,
}: ProductHeaderProps) {
  return (
    <header className="page-heading products-header-wrap page-enter">
      <div className="title-area">
        <span className="eyebrow">Catálogo Central</span>
        <h1>Productos</h1>
        <p className="welcome-subtitle">
          Administra el catálogo general de productos de Super Más.
        </p>
      </div>

      <div className="heading-actions products-actions-bar">
        {/* View Mode Toggle */}
        <div className="period-segmented-tabs view-switcher" role="tablist" aria-label="Modo de visualización">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'table'}
            className={`period-tab-btn ${viewMode === 'table' ? 'selected' : ''}`}
            onClick={() => onViewModeChange('table')}
            title="Vista en tabla"
          >
            <AppIcon name="receipt" size={14} />
            <span>Tabla</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'grid'}
            className={`period-tab-btn ${viewMode === 'grid' ? 'selected' : ''}`}
            onClick={() => onViewModeChange('grid')}
            title="Vista en cuadrícula"
          >
            <AppIcon name="products" size={14} />
            <span>Cuadrícula</span>
          </button>
        </div>

        {/* Import button */}
        <button
          type="button"
          className="outline-button"
          onClick={onImport}
        >
          <AppIcon name="transfers" size={16} />
          <span>Importar</span>
        </button>

        {/* Export button */}
        <button
          type="button"
          className="outline-button"
          onClick={onExport}
        >
          <AppIcon name="kardex" size={16} />
          <span>Exportar</span>
        </button>

        {/* New Product primary button */}
        <button
          type="button"
          className="primary-button"
          onClick={onNewProduct}
        >
          <AppIcon name="plus" size={16} />
          <span>Nuevo producto</span>
        </button>
      </div>
    </header>
  )
}
