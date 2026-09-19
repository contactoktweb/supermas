'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface AuditHeaderProps {
  onRefresh: () => void
  onExport: () => void
  canExport: boolean
  isLoading: boolean
}

export function AuditHeader({
  onRefresh,
  onExport,
  canExport,
  isLoading,
}: AuditHeaderProps) {
  return (
    <header className="page-heading page-enter">
      <div>
        <p className="eyebrow">Seguridad & Registro Inmutable</p>
        <h1>Auditoría</h1>
        <p className="welcome-subtitle">
          Consulta la actividad y trazabilidad de las operaciones realizadas dentro del sistema.
        </p>
      </div>

      <div className="heading-actions">
        <button
          type="button"
          className="outline-button"
          onClick={onRefresh}
          disabled={isLoading}
          title="Actualizar eventos recientes"
          aria-label="Refrescar lista de auditoría"
        >
          <AppIcon name="refresh" size={16} />
          <span>{isLoading ? 'Cargando...' : 'Actualizar'}</span>
        </button>

        {canExport && (
          <button
            type="button"
            className="primary-button"
            onClick={onExport}
            disabled={isLoading}
            title="Exportar registros filtrados a CSV"
          >
            <AppIcon name="download" size={16} />
            <span>Exportar CSV</span>
          </button>
        )}
      </div>
    </header>
  )
}
