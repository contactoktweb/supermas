'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { InventoryViewMode } from '../types'

interface InventoryHeaderProps {
  viewMode: InventoryViewMode
  onViewModeChange: (mode: InventoryViewMode) => void
  onOpenAdjustModal: () => void
  onOpenPhysicalCountModal: () => void
  onOpenTransferModal: () => void
  onGoToKardex: () => void
  onOpenExportModal: () => void
}

export function InventoryHeader({
  viewMode,
  onViewModeChange,
  onOpenAdjustModal,
  onOpenPhysicalCountModal,
  onOpenTransferModal,
  onGoToKardex,
  onOpenExportModal,
}: InventoryHeaderProps) {
  return (
    <header className="page-heading products-header-wrap page-enter">
      <div className="title-area">
        <span className="eyebrow">Control de existencias & valoración</span>
        <h1>Inventario</h1>
        <p className="welcome-subtitle">
          Controla existencias, disponibilidad y valoración de productos en todas las bodegas.
        </p>
      </div>

      <div className="heading-actions products-actions-bar">
        {/* View Mode Toggle: Consolidado | Por bodega */}
        <div
          className="period-segmented-tabs view-switcher"
          role="tablist"
          aria-label="Modo de visualización de inventario"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'CONSOLIDATED'}
            className={`period-tab-btn ${viewMode === 'CONSOLIDATED' ? 'selected' : ''}`}
            onClick={() => onViewModeChange('CONSOLIDATED')}
            title="Vista consolidada de existencias sumando todas las bodegas"
          >
            <AppIcon name="receipt" size={14} />
            <span>Consolidado</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'BY_LOCATION'}
            className={`period-tab-btn ${viewMode === 'BY_LOCATION' ? 'selected' : ''}`}
            onClick={() => onViewModeChange('BY_LOCATION')}
            title="Vista detallada de stock por cada bodega física"
          >
            <AppIcon name="warehouse" size={14} />
            <span>Por bodega</span>
          </button>
        </div>

        {/* Export button */}
        <button
          type="button"
          className="outline-button"
          onClick={onOpenExportModal}
          title="Exportar inventario en formato CSV o Excel"
        >
          <AppIcon name="download" size={16} />
          <span>Exportar</span>
        </button>

        {/* Kardex button */}
        <button
          type="button"
          className="outline-button"
          onClick={onGoToKardex}
          title="Consultar historial de movimientos y trazabilidad en el Kardex"
        >
          <AppIcon name="kardex" size={16} />
          <span>Ver Kardex</span>
        </button>

        {/* Transfer button */}
        <button
          type="button"
          className="outline-button"
          onClick={onOpenTransferModal}
          title="Iniciar traslado de mercancía entre bodegas"
        >
          <AppIcon name="transfers" size={16} />
          <span>Transferencia</span>
        </button>

        {/* Physical count button */}
        <button
          type="button"
          className="outline-button"
          onClick={onOpenPhysicalCountModal}
          title="Iniciar sesión de auditoría y conteo físico de inventario"
        >
          <AppIcon name="audit" size={16} />
          <span>Conteo físico</span>
        </button>

        {/* Adjust Stock primary button */}
        <button
          type="button"
          className="primary-button compact"
          onClick={onOpenAdjustModal}
          title="Registrar ajuste manual de entrada o salida de inventario"
        >
          <AppIcon name="sliders" size={16} />
          <span>Ajustar inventario</span>
        </button>
      </div>
    </header>
  )
}
