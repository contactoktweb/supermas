'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface TransferHeaderProps {
  viewMode: 'table' | 'flow'
  onViewModeChange: (mode: 'table' | 'flow') => void
  onNewTransfer: () => void
  onExport: () => void
  onResetFilters: () => void
  hasActiveFilters: boolean
  activeFilterCount: number
}

export function TransferHeader({
  viewMode,
  onViewModeChange,
  onNewTransfer,
  onExport,
  onResetFilters,
  hasActiveFilters,
  activeFilterCount,
}: TransferHeaderProps) {
  return (
    <header className="page-heading products-header-wrap page-enter">
      <div className="title-area">
        <span className="eyebrow">Logística & Movimientos Internos</span>
        <h1>Transferencias</h1>
        <p className="welcome-subtitle">
          Gestiona movimientos de inventario entre bodegas y puntos de venta.
        </p>
      </div>

      <div className="heading-actions products-actions-bar">
        {/* Selector Tabla | Flujo */}
        <div
          className="period-segmented-tabs view-switcher"
          role="tablist"
          aria-label="Modo de visualización de transferencias"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'table'}
            className={`period-tab-btn ${viewMode === 'table' ? 'selected' : ''}`}
            onClick={() => onViewModeChange('table')}
            title="Vista tabular de transferencias"
          >
            <AppIcon name="receipt" size={14} />
            <span>Tabla</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'flow'}
            className={`period-tab-btn ${viewMode === 'flow' ? 'selected' : ''}`}
            onClick={() => onViewModeChange('flow')}
            title="Vista gráfica de flujo logístico entre bodegas"
          >
            <AppIcon name="transfers" size={14} />
            <span>Flujo</span>
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

        {/* Export Action */}
        <button
          type="button"
          className="outline-button"
          onClick={onExport}
          title="Exportar transferencias en formato CSV"
        >
          <AppIcon name="download" size={16} />
          <span>Exportar</span>
        </button>

        {/* New Transfer Primary Button */}
        <button
          type="button"
          className="primary-button"
          onClick={onNewTransfer}
          title="Crear un nuevo traslado de inventario"
        >
          <AppIcon name="plus" size={16} />
          <span>Nueva transferencia</span>
        </button>
      </div>
    </header>
  )
}
