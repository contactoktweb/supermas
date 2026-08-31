'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface KardexHeaderProps {
  viewMode: 'table' | 'timeline'
  onViewModeChange: (mode: 'table' | 'timeline') => void
  onExport: () => void
  onResetFilters: () => void
  hasActiveFilters: boolean
  activeFilterCount: number
}

export function KardexHeader({
  viewMode,
  onViewModeChange,
  onExport,
  onResetFilters,
  hasActiveFilters,
  activeFilterCount,
}: KardexHeaderProps) {
  return (
    <header className="page-heading products-header-wrap page-enter">
      <div className="title-area">
        <span className="eyebrow">Trazabilidad & Movimientos de Stock</span>
        <h1>Kardex de inventario</h1>
        <p className="welcome-subtitle">
          Consulta la trazabilidad completa de entradas, salidas y movimientos de mercancía.
        </p>
      </div>

      <div className="heading-actions products-actions-bar">
        {/* View Mode Toggle: Tabla | Línea de tiempo */}
        <div
          className="period-segmented-tabs view-switcher"
          role="tablist"
          aria-label="Modo de visualización"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'table'}
            className={`period-tab-btn ${viewMode === 'table' ? 'selected' : ''}`}
            onClick={() => onViewModeChange('table')}
            title="Vista tabular detallada del Kardex"
          >
            <AppIcon name="receipt" size={14} />
            <span>Tabla</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'timeline'}
            className={`period-tab-btn ${viewMode === 'timeline' ? 'selected' : ''}`}
            onClick={() => onViewModeChange('timeline')}
            title="Vista cronológica en línea de tiempo"
          >
            <AppIcon name="reports" size={14} />
            <span>Línea de tiempo</span>
          </button>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            type="button"
            className="outline-button"
            onClick={onResetFilters}
            title="Restablecer todos los filtros aplicados"
          >
            <AppIcon name="close" size={14} />
            <span>Limpiar filtros ({activeFilterCount})</span>
          </button>
        )}

        {/* Export Button */}
        <button
          type="button"
          className="outline-button"
          onClick={onExport}
          title="Exportar movimientos filtrados en formato CSV"
        >
          <AppIcon name="download" size={16} />
          <span>Exportar</span>
        </button>
      </div>
    </header>
  )
}
