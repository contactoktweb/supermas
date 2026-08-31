'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { KardexFilterParams, MovementType } from '../types'

interface KardexFiltersProps {
  filters: KardexFilterParams
  onFilterChange: (key: keyof KardexFilterParams, value: any) => void
  onResetFilters: () => void
  onToggleColumnSelector: () => void
  isColumnSelectorOpen: boolean
}

const MOVEMENT_TYPE_OPTIONS: { value: MovementType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todos los movimientos' },
  { value: 'COMPRA', label: 'Compras (+)' },
  { value: 'VENTA', label: 'Ventas (-)' },
  { value: 'TRANSFERENCIA_ENTRADA', label: 'Transferencias entrada (+)' },
  { value: 'TRANSFERENCIA_SALIDA', label: 'Transferencias salida (-)' },
  { value: 'AJUSTE_ENTRADA', label: 'Ajustes de entrada (+)' },
  { value: 'AJUSTE_SALIDA', label: 'Ajustes de salida (-)' },
  { value: 'DEVOLUCION', label: 'Devoluciones (+)' },
  { value: 'REMISION', label: 'Remisiones (-)' },
  { value: 'REVERSION', label: 'Reversiones (Compensación)' },
]

const LOCATION_OPTIONS = [
  { value: 'ALL', label: 'Todas las bodegas' },
  { value: 'loc-01', label: 'Bodega Principal Cali' },
  { value: 'loc-02', label: 'Punto Centro - Carrera 5' },
  { value: 'loc-03', label: 'Bodega Norte - Yumbo' },
  { value: 'loc-04', label: 'Punto Sur - Ciudad Jardín' },
]

export function KardexFilters({
  filters,
  onFilterChange,
  onResetFilters,
  onToggleColumnSelector,
  isColumnSelectorOpen,
}: KardexFiltersProps) {
  const hasActiveFilters = Boolean(
    filters.query?.trim() ||
      (filters.locationId && filters.locationId !== 'ALL') ||
      (filters.movementType && filters.movementType !== 'ALL') ||
      filters.documentQuery?.trim() ||
      filters.startDate ||
      filters.endDate
  )

  return (
    <div className="products-toolbar page-enter" role="search" aria-label="Filtros de Kardex">
      {/* Search by Product, SKU, Barcode, Document */}
      <div className="products-search-box">
        <div className="input-wrap with-action">
          <AppIcon name="search" size={15} />
          <input
            value={filters.query || ''}
            onChange={(e) => onFilterChange('query', e.target.value)}
            placeholder="Buscar por producto, SKU, documento, usuario o notas..."
            aria-label="Buscar en el Kardex"
          />
          {filters.query && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => onFilterChange('query', '')}
              aria-label="Limpiar búsqueda"
            >
              <AppIcon name="close" size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Dropdown Filters */}
      <div className="filter-select-group">
        {/* Location Select */}
        <div className="filter-select-item" style={{ minWidth: 170 }}>
          <CustomSelect
            options={LOCATION_OPTIONS}
            value={filters.locationId || 'ALL'}
            onChange={(val) => onFilterChange('locationId', val)}
            placeholder="Bodega"
          />
        </div>

        {/* Movement Type Select */}
        <div className="filter-select-item" style={{ minWidth: 190 }}>
          <CustomSelect
            options={MOVEMENT_TYPE_OPTIONS}
            value={filters.movementType || 'ALL'}
            onChange={(val) => onFilterChange('movementType', val)}
            placeholder="Tipo de movimiento"
          />
        </div>

        {/* Date Inputs */}
        <div className="date-filter-wrap">
          <div className="date-input-mini">
            <span className="date-mini-label">Desde:</span>
            <input
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => onFilterChange('startDate', e.target.value || undefined)}
              aria-label="Fecha inicial"
            />
          </div>

          <div className="date-input-mini">
            <span className="date-mini-label">Hasta:</span>
            <input
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => onFilterChange('endDate', e.target.value || undefined)}
              aria-label="Fecha final"
            />
          </div>
        </div>
      </div>

      {/* Column Selector Popover Trigger */}
      <button
        type="button"
        className={`filter-button column-selector-trigger ${
          isColumnSelectorOpen ? 'active' : ''
        }`}
        onClick={onToggleColumnSelector}
        aria-label="Configurar columnas visibles"
      >
        <AppIcon name="sliders" size={14} />
        <span>Columnas</span>
      </button>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <button
          type="button"
          className="reset-filters-pill"
          onClick={onResetFilters}
          title="Restablecer todos los filtros"
        >
          <AppIcon name="close" size={12} />
          <span>Limpiar</span>
        </button>
      )}
    </div>
  )
}
