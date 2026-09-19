'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface SettingsHeaderProps {
  searchQuery: string
  onSearchChange: (q: string) => void
  onRefresh: () => void
  isRefreshing?: boolean
}

export function SettingsHeader({
  searchQuery,
  onSearchChange,
  onRefresh,
  isRefreshing,
}: SettingsHeaderProps) {
  return (
    <div className="page-heading page-enter">
      <div>
        <p className="eyebrow">Parámetros Globales del ERP</p>
        <h1>Configuración</h1>
        <p className="welcome-subtitle">
          Administra parámetros generales y reglas operativas del sistema.
        </p>
      </div>

      <div className="heading-actions flex items-center gap-3">
        {/* Real-time search box */}
        <div className="search-box relative">
          <AppIcon name="search" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar parámetro o módulo..."
            aria-label="Buscar parámetro de configuración"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
              aria-label="Limpiar búsqueda"
            >
              ×
            </button>
          )}
        </div>

        {/* Reload button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="outline-button flex items-center gap-1.5"
          title="Recargar parámetros"
        >
          <AppIcon
            name="kardex"
            size={15}
            className={isRefreshing ? 'animate-spin text-red-400' : ''}
          />
          <span>Recargar</span>
        </button>
      </div>
    </div>
  )
}
