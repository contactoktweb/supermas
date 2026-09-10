'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface PurchaseHeaderProps {
  onNewPurchase: () => void
  onQuickReceive: () => void
  onExport: () => void
  onResetFilters: () => void
  hasActiveFilters: boolean
  activeFilterCount: number
}

export function PurchaseHeader({
  onNewPurchase,
  onQuickReceive,
  onExport,
  onResetFilters,
  hasActiveFilters,
  activeFilterCount,
}: PurchaseHeaderProps) {
  return (
    <header className="page-heading products-header-wrap page-enter">
      <div className="title-area">
        <span className="eyebrow">Abastecimiento & Proveedores</span>
        <h1>Compras</h1>
        <p className="welcome-subtitle">
          Gestiona compras a proveedores, recepción de mercancía y obligaciones pendientes.
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

          {/* Exportar CSV */}
          <button
            type="button"
            className="outline-button"
            onClick={onExport}
            title="Exportar órdenes de compra a CSV"
          >
            <AppIcon name="download" size={16} />
            <span>Exportar</span>
          </button>

          {/* Registrar Recepción Rápida */}
          <button
            type="button"
            className="outline-button"
            onClick={onQuickReceive}
            title="Registrar recepción física de mercancía pendiente"
          >
            <AppIcon name="warehouse" size={16} />
            <span>Registrar recepción</span>
          </button>

          {/* Nueva compra (Botón primario destacado) */}
          <button
            type="button"
            className="primary-button"
            onClick={onNewPurchase}
            title="Registrar nueva orden o factura de compra"
          >
            <AppIcon name="plus" size={16} />
            <span>Nueva compra</span>
          </button>
        </div>
      </div>
    </header>
  )
}
