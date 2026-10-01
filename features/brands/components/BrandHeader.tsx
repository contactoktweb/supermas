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
    <div className="section-header page-header flex-between">
      <div>
        <div className="header-badge-row">
          <span className="badge badge-accent">Catálogo ERP / POS</span>
          <span className="badge badge-muted">{totalCount} marcas</span>
        </div>
        <h1 className="page-title">Marcas de Productos</h1>
        <p className="page-subtitle">
          Administra las marcas comerciales y fabricantes de los artículos del inventario.
        </p>
      </div>

      <div className="header-actions">
        <button
          type="button"
          className="btn btn-secondary icon-button-text"
          onClick={onRefreshClick}
          disabled={isLoading}
          title="Actualizar lista"
        >
          <AppIcon name="refresh" size={16} className={isLoading ? 'spin' : ''} />
          <span>Actualizar</span>
        </button>

        {canCreate && (
          <button
            type="button"
            className="btn btn-primary icon-button-text"
            onClick={onCreateClick}
          >
            <AppIcon name="plus" size={16} />
            <span>Nueva Marca</span>
          </button>
        )}
      </div>
    </div>
  )
}
