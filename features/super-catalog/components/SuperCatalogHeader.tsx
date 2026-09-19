'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface SuperCatalogHeaderProps {
  onRefresh: () => void
  onExport: () => void
  onOpenGeneralPreview: () => void
  canExport: boolean
}

export function SuperCatalogHeader({
  onRefresh,
  onExport,
  onOpenGeneralPreview,
  canExport,
}: SuperCatalogHeaderProps) {
  return (
    <header className="page-heading page-enter">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <p className="eyebrow">Canal B2C & Tienda Online</p>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            Catálogo Oficial Super Más
          </span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Catálogo Super Más</h1>
        <p className="welcome-subtitle text-xs text-slate-500 mt-1">
          Administra los productos disponibles para venta directa desde la tienda online.
        </p>
      </div>

      <div className="heading-actions flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onRefresh}
          className="outline-button text-xs py-2 px-3.5 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold shadow-xs transition-colors"
          title="Recargar catálogo"
          aria-label="Recargar catálogo"
        >
          <AppIcon name="refresh" size={15} />
          <span>Recargar</span>
        </button>

        {canExport && (
          <button
            type="button"
            onClick={onExport}
            className="outline-button text-xs py-2 px-3.5 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold shadow-xs transition-colors"
            title="Exportar catálogo filtrado a CSV"
            aria-label="Exportar CSV"
          >
            <AppIcon name="download" size={15} />
            <span>Exportar CSV</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenGeneralPreview}
          className="primary-button text-xs py-2 px-3.5 flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold shadow-xs transition-colors"
          title="Vista previa de la tienda online"
        >
          <AppIcon name="eye" size={15} />
          <span>Vista Previa Tienda</span>
        </button>
      </div>
    </header>
  )
}
