'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface SupplierHeaderProps {
  onNewSupplier: () => void
  onExport: () => void
  onResetFilters: () => void
  hasActiveFilters: boolean
  activeFilterCount: number
}

export function SupplierHeader({
  onNewSupplier,
  onExport,
  onResetFilters,
  hasActiveFilters,
  activeFilterCount,
}: SupplierHeaderProps) {
  return (
    <header className="page-heading products-header-wrap page-enter">
      <div className="title-area">
        <span className="eyebrow">Cadena de Suministro & Terceros</span>
        <h1>Proveedores</h1>
        <p className="welcome-subtitle">
          Administra proveedores, compras asociadas y obligaciones pendientes.
        </p>
      </div>

      <div className="heading-actions products-actions-bar">
        <div className="header-action-buttons">
          {/* Botón limpiar filtros si hay activos */}
          {hasActiveFilters && (
            <button
              type="button"
              className="outline-button"
              onClick={onResetFilters}
              title="Restablecer todos los filtros aplicados"
            >
              <AppIcon name="close" size={14} />
              <span>Limpiar ({activeFilterCount})</span>
            </button>
          )}

          {/* Exportar */}
          <button
            type="button"
            className="outline-button"
            onClick={onExport}
            title="Exportar catálogo de proveedores en CSV"
          >
            <AppIcon name="download" size={16} />
            <span>Exportar</span>
          </button>

          {/* Nuevo proveedor */}
          <button
            type="button"
            className="primary-button"
            onClick={onNewSupplier}
            title="Registrar nuevo proveedor comercial"
          >
            <AppIcon name="plus" size={16} />
            <span>Nuevo proveedor</span>
          </button>
        </div>
      </div>
    </header>
  )
}
