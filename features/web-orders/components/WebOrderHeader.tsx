'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface WebOrderHeaderProps {
  onRefresh: () => void
  onExport: () => void
  canExport: boolean
  isRefreshing?: boolean
}

export function WebOrderHeader({
  onRefresh,
  onExport,
  canExport,
  isRefreshing = false,
}: WebOrderHeaderProps) {
  return (
    <header className="page-heading page-enter">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <p className="eyebrow">Ecommerce & Canales Digitales</p>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Bodega Despacho: CEDI Principal (BOD-001)
          </span>
        </div>
        <h1>Pedidos Web</h1>
        <p className="welcome-subtitle">
          Administra los pedidos realizados desde la tienda online.
        </p>
      </div>

      <div className="heading-actions">
        <button
          type="button"
          className="outline-button"
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Actualizar listado de pedidos"
          aria-label="Actualizar datos"
        >
          <AppIcon
            name="refresh"
            size={16}
            className={isRefreshing ? 'animate-spin' : ''}
          />
        </button>

        {canExport && (
          <button
            type="button"
            className="outline-button"
            onClick={onExport}
            title="Exportar pedidos filtrados a formato CSV"
          >
            <AppIcon name="download" size={16} />
            <span>Exportar CSV</span>
          </button>
        )}
      </div>
    </header>
  )
}
