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
  { value: 'TRANSFERENCIA_ENTRADA', label: 'Transf. Entrada (+)' },
  { value: 'TRANSFERENCIA_SALIDA', label: 'Transf. Salida (-)' },
  { value: 'AJUSTE_ENTRADA', label: 'Ajustes Entrada (+)' },
  { value: 'AJUSTE_SALIDA', label: 'Ajustes Salida (-)' },
  { value: 'DEVOLUCION', label: 'Devoluciones (+)' },
  { value: 'REVERSION', label: 'Reversiones (Compensación)' },
  { value: 'REMISION', label: 'Remisiones (-)' },
]

const LOCATION_OPTIONS = [
  { value: 'ALL', label: 'Todas las bodegas' },
  { value: 'loc-01', label: 'Bodega Principal Cali' },
  { value: 'loc-02', label: 'Punto Centro - Carrera 5' },
  { value: 'loc-03', label: 'Bodega Norte - Yumbo' },
  { value: 'loc-04', label: 'Punto Sur - Ciudad Jardín' },
]

const USER_OPTIONS = [
  { value: 'ALL', label: 'Todos los usuarios' },
  { value: 'user-01', label: 'Laura Gómez (Compras)' },
  { value: 'user-02', label: 'Mauricio Arango (Logística)' },
  { value: 'user-03', label: 'Ana María Orozco (Cajero POS)' },
  { value: 'user-04', label: 'Carlos Mario Ruiz (Ventas)' },
  { value: 'user-05', label: 'Daniel Restrepo (Auditoría)' },
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
      (filters.userId && filters.userId !== 'ALL') ||
      filters.documentQuery?.trim() ||
      filters.startDate ||
      filters.endDate
  )

  return (
    <div
      className="toolbar inventory-toolbar products-toolbar page-enter"
      role="search"
      aria-label="Filtros del Kardex"
    >
      {/* 1. Main Search: Producto, SKU, Código de barras */}
      <div className="search-box wide products-search-box">
        <AppIcon name="search" size={16} />
        <input
          value={filters.query || ''}
          onChange={(e) => onFilterChange('query', e.target.value)}
          placeholder="Buscar producto, SKU o código de barras..."
          aria-label="Buscar producto o SKU en el Kardex"
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

      {/* 2. Dropdown Filters */}
      <div className="filter-select-group">
        {/* Bodega Select */}
        <div className="filter-select-item" style={{ minWidth: 170 }}>
          <CustomSelect
            options={LOCATION_OPTIONS}
            value={filters.locationId || 'ALL'}
            onChange={(val) => onFilterChange('locationId', val)}
            placeholder="Bodega"
            size="sm"
            icon={<AppIcon name="warehouses" size={14} color="var(--navy)" />}
          />
        </div>

        {/* Movement Type Select */}
        <div className="filter-select-item" style={{ minWidth: 180 }}>
          <CustomSelect
            options={MOVEMENT_TYPE_OPTIONS}
            value={filters.movementType || 'ALL'}
            onChange={(val) => onFilterChange('movementType', val)}
            placeholder="Tipo de movimiento"
            size="sm"
            icon={<AppIcon name="kardex" size={14} color="var(--red)" />}
          />
        </div>

        {/* User Responsable Select */}
        <div className="filter-select-item" style={{ minWidth: 170 }}>
          <CustomSelect
            options={USER_OPTIONS}
            value={filters.userId || 'ALL'}
            onChange={(val) => onFilterChange('userId', val)}
            placeholder="Usuario responsable"
            size="sm"
            icon={<AppIcon name="users" size={14} color="#64748b" />}
          />
        </div>

        {/* Document Search Filter */}
        <div className="search-box" style={{ width: 150, minWidth: 140 }}>
          <AppIcon name="fileText" size={14} />
          <input
            value={filters.documentQuery || ''}
            onChange={(e) => onFilterChange('documentQuery', e.target.value)}
            placeholder="N° Documento"
            aria-label="Filtrar por número de documento"
          />
          {filters.documentQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => onFilterChange('documentQuery', '')}
              aria-label="Limpiar documento"
            >
              <AppIcon name="close" size={12} />
            </button>
          )}
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

      {/* 3. Column Selector & Clear Button */}
      <div className="filter-actions-cluster" style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        {hasActiveFilters && (
          <button
            type="button"
            className="outline-button compact reset-filter-btn"
            onClick={onResetFilters}
            title="Restablecer todos los filtros"
          >
            <AppIcon name="close" size={12} />
            <span>Limpiar</span>
          </button>
        )}

        <button
          type="button"
          className={`outline-button compact ${
            isColumnSelectorOpen ? 'active' : ''
          }`}
          onClick={onToggleColumnSelector}
          title="Configurar columnas visibles"
        >
          <AppIcon name="sliders" size={14} />
          <span>Columnas</span>
        </button>
      </div>
    </div>
  )
}
