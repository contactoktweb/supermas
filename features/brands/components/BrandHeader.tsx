'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface BrandHeaderProps {
  totalCount: number
  canCreate: boolean
  onCreateClick: () => void
  onRefreshClick: () => void
  isLoading?: boolean
}

export function BrandHeader({
  totalCount,
  canCreate,
  onCreateClick,
  onRefreshClick,
  isLoading,
}: BrandHeaderProps) {
  return (
    <header className="page-heading page-enter">
      <div>
        <p className="eyebrow">Catálogo Central &bull; {totalCount} marcas registradas</p>
        <h1>Marcas de Productos</h1>
        <p className="welcome-subtitle">
          Administra las marcas comerciales y fabricantes de los artículos del inventario.
        </p>
      </div>

      <div className="heading-actions">
        <button
          type="button"
          className="outline-button"
          onClick={onRefreshClick}
          disabled={isLoading}
          title="Actualizar lista de marcas"
        >
          <AppIcon name="refresh" size={16} className={isLoading ? 'spin' : ''} />
          <span>Actualizar</span>
        </button>

        {canCreate && (
          <button
            type="button"
            className="primary-button"
            onClick={onCreateClick}
            title="Crear nueva marca comercial"
          >
            <AppIcon name="plus" size={16} />
            <span>Nueva marca</span>
          </button>
        )}
      </div>
    </header>
  )
}
