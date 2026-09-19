'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface DistributorCatalogHeaderProps {
  onRefresh: () => void
  onExport: () => void
  canExport: boolean
  isRefreshing?: boolean
}

export function DistributorCatalogHeader({
  onRefresh,
  onExport,
  canExport,
  isRefreshing = false,
}: DistributorCatalogHeaderProps) {
  return (
    <header className="page-heading page-enter">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <p className="eyebrow">Canal B2B & Distribuidores</p>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
            Catálogo Informativo + WhatsApp
          </span>
        </div>
        <h1>Catálogo Distribuidora</h1>
        <p className="welcome-subtitle">
          Administra los productos disponibles para consulta de clientes distribuidores.
        </p>
      </div>

      <div className="heading-actions">
        <button
          type="button"
          className="outline-button"
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Actualizar listado de productos"
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
            title="Exportar catálogo a formato CSV"
          >
            <AppIcon name="download" size={16} />
            <span>Exportar</span>
          </button>
        )}
      </div>
    </header>
  )
}
