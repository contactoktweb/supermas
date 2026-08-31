'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import {
  ProductFilterParams,
  ProductStatus,
  ProductStockHealth,
} from '../types'
import {
  PRODUCT_CATEGORIES_MOCK,
  PRODUCT_BRANDS_MOCK,
} from '../mocks/product.mock'

interface ProductFiltersProps {
  filters: ProductFilterParams
  onFilterChange: (key: keyof ProductFilterParams, value: any) => void
  onResetFilters: () => void
  onToggleColumnSelector: () => void
  isColumnSelectorOpen: boolean
}

export function ProductFilters({
  filters,
  onFilterChange,
  onResetFilters,
  onToggleColumnSelector,
  isColumnSelectorOpen,
}: ProductFiltersProps) {
  // Count active filters (ignoring pagination and defaults)
  const activeFilterCount = [
    Boolean(filters.query?.trim()),
    Boolean(filters.category && filters.category !== 'ALL'),
    Boolean(filters.brand && filters.brand !== 'ALL'),
    Boolean(filters.status && filters.status !== 'ALL'),
    Boolean(filters.stockHealth && filters.stockHealth !== 'ALL'),
    Boolean(filters.webChannel && filters.webChannel !== 'ALL'),
  ].filter(Boolean).length

  // Build category options
  const categoryOptions = [
    { value: 'ALL', label: 'Todas las categorías' },
    ...PRODUCT_CATEGORIES_MOCK.map((cat) => ({ value: cat, label: cat })),
  ]

  // Build brand options
  const brandOptions = [
    { value: 'ALL', label: 'Todas las marcas' },
    ...PRODUCT_BRANDS_MOCK.map((brand) => ({ value: brand, label: brand })),
  ]

  // Build status options
  const statusOptions = [
    { value: 'ALL', label: 'Todos los estados' },
    { value: 'ACTIVE', label: 'Solo Activos' },
    { value: 'INACTIVE', label: 'Solo Inactivos' },
  ]

  // Build stock health options
  const stockHealthOptions = [
    { value: 'ALL', label: 'Todas las existencias' },
    { value: 'AVAILABLE', label: 'Disponible (Óptimo)' },
    { value: 'LOW_STOCK', label: 'Stock bajo' },
    { value: 'CRITICAL', label: 'Stock crítico' },
    { value: 'OUT_OF_STOCK', label: 'Agotados (0 stock)' },
  ]

  // Build web channel options
  const webChannelOptions = [
    { value: 'ALL', label: 'Todos los canales web' },
    { value: 'SUPER_MAS', label: 'Catálogo Super Más (Compra web)' },
    { value: 'DISTRIBUIDORA', label: 'Catálogo Distribuidora (WhatsApp)' },
    { value: 'BOTH', label: 'Ambos canales activos' },
    { value: 'NONE', label: 'Sin publicar en web' },
  ]

  return (
    <div className="toolbar inventory-toolbar products-toolbar page-enter">
      {/* Search Input with Clear Button */}
      <div className="search-box wide products-search-box">
        <AppIcon name="search" size={16} />
        <input
          value={filters.query || ''}
          onChange={(e) => onFilterChange('query', e.target.value)}
          placeholder="Buscar por producto, SKU o código de barras..."
          aria-label="Buscar productos"
        />
        {filters.query && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={() => onFilterChange('query', '')}
            aria-label="Limpiar búsqueda"
          >
            <AppIcon name="close" size={14} />
          </button>
        )}
      </div>

      {/* Dropdown Filters using CustomSelect */}
      <div className="filter-select-group">
        {/* Category Select */}
        <div className="filter-select-item">
          <CustomSelect
            options={categoryOptions}
            value={filters.category || 'ALL'}
            onChange={(val) => onFilterChange('category', val)}
            placeholder="Categoría"
          />
        </div>

        {/* Brand Select */}
        <div className="filter-select-item">
          <CustomSelect
            options={brandOptions}
            value={filters.brand || 'ALL'}
            onChange={(val) => onFilterChange('brand', val)}
            placeholder="Marca"
          />
        </div>

        {/* Status Select */}
        <div className="filter-select-item">
          <CustomSelect
            options={statusOptions}
            value={filters.status || 'ALL'}
            onChange={(val) => onFilterChange('status', val as ProductStatus | 'ALL')}
            placeholder="Estado"
          />
        </div>

        {/* Stock Health Select */}
        <div className="filter-select-item">
          <CustomSelect
            options={stockHealthOptions}
            value={filters.stockHealth || 'ALL'}
            onChange={(val) =>
              onFilterChange('stockHealth', val as ProductStockHealth | 'ALL')
            }
            placeholder="Disponibilidad"
          />
        </div>

        {/* Web Channel Select */}
        <div className="filter-select-item">
          <CustomSelect
            options={webChannelOptions}
            value={filters.webChannel || 'ALL'}
            onChange={(val) => onFilterChange('webChannel', val)}
            placeholder="Canal Web"
          />
        </div>
      </div>

      {/* Column Selector Toggle */}
      <button
        type="button"
        className={`filter-button column-selector-trigger ${
          isColumnSelectorOpen ? 'active' : ''
        }`}
        onClick={onToggleColumnSelector}
        aria-label="Configurar columnas visibles"
      >
        <AppIcon name="dashboard" size={14} />
        <span>Columnas</span>
        <AppIcon name={isColumnSelectorOpen ? 'chevronUp' : 'chevronDown'} size={13} />
      </button>

      {/* Reset Filters Button */}
      {activeFilterCount > 0 && (
        <button
          type="button"
          className="reset-filters-pill"
          onClick={onResetFilters}
          title="Restablecer todos los filtros"
        >
          <AppIcon name="close" size={13} />
          <span>Limpiar filtros</span>
          <span className="active-filter-badge">{activeFilterCount}</span>
        </button>
      )}
    </div>
  )
}
