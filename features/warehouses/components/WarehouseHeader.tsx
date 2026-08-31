'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface WarehouseHeaderProps {
  viewMode: 'GRID' | 'TABLE'
  setViewMode: (mode: 'GRID' | 'TABLE') => void
  onOpenCreate: () => void
  onExport: () => void
  canCreate: boolean
}

export function WarehouseHeader({
  viewMode,
  setViewMode,
  onOpenCreate,
  onExport,
  canCreate,
}: WarehouseHeaderProps) {
  return (
    <header className="page-heading page-enter">
      <div>
        <p className="eyebrow">Centros operativos & distribución</p>
        <h1>Bodegas y Puntos de Venta</h1>
        <p className="welcome-subtitle">
          Administra el inventario, operación y rendimiento de cada ubicación de Super Más.
        </p>
      </div>

      <div className="heading-actions">
        <div className="segmented view-toggle-group" role="group" aria-label="Modo de vista">
          <button
            type="button"
            className={viewMode === 'GRID' ? 'selected' : ''}
            onClick={() => setViewMode('GRID')}
            aria-pressed={viewMode === 'GRID'}
          >
            <AppIcon name="grid" size={14} />
            <span>Cards</span>
          </button>
          <button
            type="button"
            className={viewMode === 'TABLE' ? 'selected' : ''}
            onClick={() => setViewMode('TABLE')}
            aria-pressed={viewMode === 'TABLE'}
          >
            <AppIcon name="table" size={14} />
            <span>Tabla</span>
          </button>
        </div>

        <button
          type="button"
          className="outline-button"
          onClick={onExport}
          title="Exportar consolidado de bodegas en formato Excel/CSV"
        >
          <AppIcon name="download" size={16} />
          <span>Exportar</span>
        </button>

        {canCreate && (
          <button
            type="button"
            className="primary-button compact"
            onClick={onOpenCreate}
            title="Crear nueva bodega o punto de venta"
          >
            <AppIcon name="plus" size={16} />
            <span>Nueva bodega</span>
          </button>
        )}
      </div>
    </header>
  )
}
