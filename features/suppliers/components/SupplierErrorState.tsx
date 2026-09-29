'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface SupplierErrorStateProps {
  message?: string
  onRetry: () => void
}

export function SupplierErrorState({
  message = 'Ocurrió un error al cargar los datos de los proveedores.',
  onRetry,
}: SupplierErrorStateProps) {
  return (
    <div className="inventory-empty-state-wrapper page-enter">
      <div className="inventory-empty-card tone-red">
        {/* Glowing Decorative Icon Halo */}
        <div className="empty-icon-halo">
          <div className="empty-icon-glow" />
          <div className="empty-icon-circle">
            <AppIcon name="warning" size={30} />
          </div>
        </div>

        {/* Badge Indicator */}
        <div className="empty-badge-row">
          <span className="empty-status-tag tag-red">
            <span className="status-indicator-dot" />
            Error de consulta
          </span>
        </div>

        {/* Text Group */}
        <div className="empty-text-group">
          <h3 className="empty-title" style={{ color: '#991b1b' }}>
            Error al consultar proveedores
          </h3>
          <p className="empty-description">{message}</p>
        </div>

        {/* Action Button */}
        <div className="empty-actions-row">
          <button
            type="button"
            className="primary-button compact empty-action-btn"
            onClick={onRetry}
          >
            <AppIcon name="refresh" size={14} />
            <span>Reintentar</span>
          </button>
        </div>
      </div>
    </div>
  )
}
