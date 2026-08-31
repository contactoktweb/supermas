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
    <div className="products-header-wrap page-enter">
      <div className="page-title-group">
        <p className="eyebrow">Trazabilidad de Inventario</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ margin: 0 }}>Kardex</h1>
          <span className="count-tag-pill">Movimientos Inmutables</span>
        </div>
        <p className="welcome-subtitle">
          Consulta y rastrea todos los movimientos del inventario de Super Más en tiempo real.
        </p>
      </div>

      <div className="products-actions-bar">
        {/* Table / Timeline View Toggle */}
        <div className="segmented-view-toggle">
          <button
            type="button"
            className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => onViewModeChange('table')}
            aria-label="Vista en tabla"
          >
            <AppIcon name="table" size={15} />
            <span>Tabla</span>
          </button>

          <button
            type="button"
            className={`view-toggle-btn ${viewMode === 'timeline' ? 'active' : ''}`}
            onClick={() => onViewModeChange('timeline')}
            aria-label="Vista en línea de tiempo"
          >
            <AppIcon name="reports" size={15} />
            <span>Línea de tiempo</span>
          </button>
        </div>

        {/* Reset filters button if active */}
        {hasActiveFilters && (
          <button
            type="button"
            className="reset-filters-pill"
            onClick={onResetFilters}
          >
            <AppIcon name="close" size={12} />
            <span>Limpiar filtros</span>
            <span className="active-filter-badge">{activeFilterCount}</span>
          </button>
        )}

        {/* Export Action */}
        <button
          type="button"
          className="outline-button"
          onClick={onExport}
          aria-label="Exportar Kardex"
        >
          <AppIcon name="download" size={16} />
          <span>Exportar</span>
        </button>
      </div>
    </div>
  )
}
