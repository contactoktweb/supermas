'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { InventoryTabFilter } from '../types'

interface InventoryEmptyStateProps {
  hasFilters: boolean
  activeTab?: InventoryTabFilter
  query?: string
  locationId?: string
  category?: string
  brand?: string
  onResetFilters: () => void
  onSelectTab?: (tab: InventoryTabFilter) => void
  onOpenAdjustModal?: () => void
  onOpenTransferModal?: () => void
}

export function InventoryEmptyState({
  hasFilters,
  activeTab = 'ALL',
  query = '',
  locationId = 'ALL',
  category = 'ALL',
  brand = 'ALL',
  onResetFilters,
  onSelectTab,
  onOpenAdjustModal,
  onOpenTransferModal,
}: InventoryEmptyStateProps) {
  // Determine contextual styling and messaging
  let iconName: LightIconName = 'inventory'
  let tone: 'blue' | 'amber' | 'red' | 'gray' = 'blue'
  let title = 'No se encontraron existencias'
  let description =
    'No hay productos o bodegas que coincidan con los criterios de búsqueda y filtros seleccionados.'
  let badgeLabel = 'Sin resultados'

  if (activeTab === 'CRITICAL') {
    iconName = 'warning'
    tone = 'red'
    badgeLabel = 'Nivel crítico'
    title = 'No hay productos en nivel crítico'
    description =
      '¡Excelente noticia! Actualmente ninguna bodega presenta productos en estado de desabastecimiento crítico o por debajo de su umbral de emergencia.'
  } else if (activeTab === 'LOW_STOCK') {
    iconName = 'warning'
    tone = 'amber'
    badgeLabel = 'Stock bajo'
    title = 'No hay productos con stock bajo'
    description =
      'Todos los artículos consultados cuentan con existencias suficientes por encima del stock mínimo establecido.'
  } else if (activeTab === 'OUT_OF_STOCK') {
    iconName = 'closeSimple'
    tone = 'gray'
    badgeLabel = 'Agotados'
    title = 'No hay productos agotados'
    description =
      'Todas las referencias activas registran saldo positivo en sus respectivas ubicaciones.'
  } else if (query) {
    iconName = 'search'
    tone = 'blue'
    badgeLabel = 'Búsqueda'
    title = `Sin resultados para "${query}"`
    description =
      'Verifica la ortografía, el código SKU o el código de barras ingresado, o prueba restablecer los filtros.'
  }

  const hasSpecificActiveFilter =
    hasFilters ||
    (activeTab && activeTab !== 'ALL') ||
    Boolean(query) ||
    locationId !== 'ALL' ||
    category !== 'ALL' ||
    brand !== 'ALL'

  return (
    <div className="inventory-empty-state-wrapper page-enter">
      <div className={`inventory-empty-card tone-${tone}`}>
        {/* Glowing Decorative Icon Badge */}
        <div className="empty-icon-halo">
          <div className="empty-icon-glow" />
          <div className="empty-icon-circle">
            <AppIcon name={iconName} size={30} />
          </div>
        </div>

        {/* Badge Indicator */}
        <div className="empty-badge-row">
          <span className={`empty-status-tag tag-${tone}`}>
            <span className="status-indicator-dot" />
            {badgeLabel}
          </span>
        </div>

        {/* Text Copy */}
        <div className="empty-text-group">
          <h3 className="empty-title">{title}</h3>
          <p className="empty-description">{description}</p>
        </div>

        {/* Active Filters Pill summary if applicable */}
        {hasSpecificActiveFilter && (
          <div className="empty-applied-filters-wrap">
            <span className="filters-caption">Filtros aplicados actualmente:</span>
            <div className="filters-chips-cluster">
              {activeTab !== 'ALL' && (
                <span className="filter-chip">
                  <AppIcon name="filter" size={11} />
                  <span>Estado: {activeTab === 'CRITICAL' ? 'Crítico' : activeTab === 'LOW_STOCK' ? 'Stock bajo' : 'Agotados'}</span>
                </span>
              )}
              {query && (
                <span className="filter-chip">
                  <AppIcon name="search" size={11} />
                  <span>Texto: &quot;{query}&quot;</span>
                </span>
              )}
              {locationId !== 'ALL' && (
                <span className="filter-chip">
                  <AppIcon name="warehouse" size={11} />
                  <span>Bodega filtrada</span>
                </span>
              )}
              {category !== 'ALL' && (
                <span className="filter-chip">
                  <AppIcon name="products" size={11} />
                  <span>Categoría: {category}</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons Cluster */}
        <div className="empty-actions-row">
          {hasSpecificActiveFilter && (
            <button
              type="button"
              className="primary-button compact empty-action-btn"
              onClick={onResetFilters}
            >
              <AppIcon name="refresh" size={14} />
              <span>Limpiar filtros y ver todo</span>
            </button>
          )}

          {activeTab !== 'ALL' && onSelectTab && (
            <button
              type="button"
              className="outline-button compact empty-action-btn"
              onClick={() => onSelectTab('ALL')}
            >
              <AppIcon name="inventory" size={14} />
              <span>Ver catálogo completo</span>
            </button>
          )}

          {onOpenAdjustModal && (
            <button
              type="button"
              className="outline-button compact empty-action-btn"
              onClick={onOpenAdjustModal}
            >
              <AppIcon name="plus" size={14} />
              <span>Ajustar existencias</span>
            </button>
          )}

          {onOpenTransferModal && (
            <button
              type="button"
              className="outline-button compact empty-action-btn"
              onClick={onOpenTransferModal}
            >
              <AppIcon name="transfers" size={14} />
              <span>Trasladar entre bodegas</span>
            </button>
          )}
        </div>

        {/* Helpful Tip Footer */}
        <div className="empty-footer-hint">
          <AppIcon name="info" size={14} color="#64748b" />
          <span>
            ¿Necesitas registrar inventario inicial? Utiliza el botón <strong>Ajustar existencias</strong> o registra una orden en el módulo de <strong>Compras</strong>.
          </span>
        </div>
      </div>
    </div>
  )
}
