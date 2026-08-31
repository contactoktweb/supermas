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
    <div className="page-heading">
      <div className="heading-copy">
        <div className="heading-with-badge">
          <h1>Inventario</h1>
          <span className="live-status-pill">
            <span className="live-status-dot" />
            En vivo
          </span>
        </div>
        <p className="welcome-subtitle">
          Controla existencias, disponibilidad y valoración de productos en todas las bodegas.
        </p>
      </div>

      <div className="heading-actions">
        {/* Segmented View Mode Toggle: Consolidado | Por bodega */}
        <div className="segmented-view-toggle">
          <button
            type="button"
            className={`segmented-btn ${viewMode === 'CONSOLIDATED' ? 'active' : ''}`}
            onClick={() => onViewModeChange('CONSOLIDATED')}
            title="Vista consolidada de productos sumando todas las bodegas"
          >
            <AppIcon name="layers" size={14} />
            <span>Consolidado</span>
          </button>
          <button
            type="button"
            className={`segmented-btn ${viewMode === 'BY_LOCATION' ? 'active' : ''}`}
            onClick={() => onViewModeChange('BY_LOCATION')}
            title="Vista detallada de stock por cada bodega física"
          >
            <AppIcon name="warehouses" size={14} />
            <span>Por bodega</span>
          </button>
        </div>

        {/* Operational Primary & Secondary Actions */}
        <button
          type="button"
          className="outline-button compact action-btn-hover"
          onClick={onOpenExportModal}
          title="Exportar inventario filtrado en formato CSV o Excel"
        >
          <AppIcon name="download" size={14} />
          <span>Exportar</span>
        </button>

        <button
          type="button"
          className="outline-button compact action-btn-hover"
          onClick={onGoToKardex}
          title="Consultar historial de movimientos y trazabilidad en el Kardex"
        >
          <AppIcon name="kardex" size={14} />
          <span>Ver Kardex</span>
        </button>

        <button
          type="button"
          className="outline-button compact action-btn-hover"
          onClick={onOpenTransferModal}
          title="Iniciar traslado de mercancía entre bodegas"
        >
          <AppIcon name="transfers" size={14} />
          <span>Nueva transferencia</span>
        </button>

        <button
          type="button"
          className="outline-button compact action-btn-hover"
          onClick={onOpenPhysicalCountModal}
          title="Iniciar sesión de auditoría y conteo físico de inventario"
        >
          <AppIcon name="audit" size={14} />
          <span>Conteo físico</span>
        </button>

        <button
          type="button"
          className="primary-button compact shadow-glow"
          onClick={onOpenAdjustModal}
          title="Registrar ajuste manual de entrada o salida de inventario"
        >
          <AppIcon name="sliders" size={14} />
          <span>Ajustar inventario</span>
        </button>
      </div>
    </div>
  )
}
