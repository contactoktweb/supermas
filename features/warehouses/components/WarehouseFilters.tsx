'use client'

import React, { useState, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { WarehouseFilters as FilterState, LocationType, LocationStatus, InventoryHealthStatus, WarehouseSortOption } from '../types'
import { useDebounce } from '../hooks/useDebounce'
import { CustomSelect } from '@/components/ui/CustomSelect'

interface WarehouseFiltersProps {
  filters: FilterState
  onFilterChange: (filters: FilterState) => void
  onClearFilters: () => void
}

export function WarehouseFilters({
  filters,
  onFilterChange,
  onClearFilters,
}: WarehouseFiltersProps) {
  const [localSearch, setLocalSearch] = useState(filters.query || '')
  const debouncedSearch = useDebounce(localSearch, 300)

  useEffect(() => {
    onFilterChange({ ...filters, query: debouncedSearch, page: 1 })
  }, [debouncedSearch])

  const hasActiveFilters = Boolean(
    (filters.query && filters.query.length > 0) ||
      (filters.type && filters.type !== 'ALL') ||
      (filters.status && filters.status !== 'ALL') ||
      (filters.inventoryHealth && filters.inventoryHealth !== 'ALL') ||
      (filters.sortBy && filters.sortBy !== 'NAME_ASC')
  )

  const handleTypeChange = (val: string) => {
    onFilterChange({
      ...filters,
      type: val as 'ALL' | LocationType,
      page: 1,
    })
  }

  const handleStatusChange = (val: string) => {
    onFilterChange({
      ...filters,
      status: val as 'ALL' | LocationStatus,
      page: 1,
    })
  }

  const handleHealthChange = (val: string) => {
    onFilterChange({
      ...filters,
      inventoryHealth: val as 'ALL' | InventoryHealthStatus,
      page: 1,
    })
  }

  const handleSortChange = (val: string) => {
    onFilterChange({
      ...filters,
      sortBy: val as WarehouseSortOption,
      page: 1,
    })
  }

  return (
    <div className="warehouse-filters-container">
      <div className="toolbar inventory-toolbar">
        <div className="search-box wide">
          <AppIcon name="search" size={16} />
          <input
            type="search"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Buscar bodega, punto o código..."
            aria-label="Buscar bodega por nombre, código o dirección"
          />
          {localSearch && (
            <button
              type="button"
              className="icon-button"
              onClick={() => setLocalSearch('')}
              aria-label="Borrar búsqueda"
            >
              <AppIcon name="close" size={14} />
            </button>
          )}
        </div>

        <div style={{ minWidth: 160 }}>
          <CustomSelect
            size="sm"
            icon={<AppIcon name="filter" size={13} />}
            value={filters.type || 'ALL'}
            onChange={handleTypeChange}
            options={[
              { value: 'ALL', label: 'Tipo: Todos' },
              { value: 'WAREHOUSE', label: 'Bodega de almacenamiento' },
              { value: 'STORE_POINT', label: 'Punto de venta (POS)' },
              { value: 'DISTRIBUTION_CENTER', label: 'Centro distribución CEDI' },
            ]}
          />
        </div>

        <div style={{ minWidth: 135 }}>
          <CustomSelect
            size="sm"
            value={filters.status || 'ALL'}
            onChange={handleStatusChange}
            options={[
              { value: 'ALL', label: 'Estado: Todos' },
              { value: 'ACTIVE', label: 'Activas' },
              { value: 'INACTIVE', label: 'Inactivas' },
            ]}
          />
        </div>

        <div style={{ minWidth: 160 }}>
          <CustomSelect
            size="sm"
            icon={<AppIcon name="sliders" size={13} />}
            value={filters.inventoryHealth || 'ALL'}
            onChange={handleHealthChange}
            options={[
              { value: 'ALL', label: 'Salud: Todas' },
              { value: 'NORMAL', label: 'Stock óptimo' },
              { value: 'LOW_STOCK', label: 'Stock bajo' },
              { value: 'CRITICAL', label: 'Crítico' },
              { value: 'OUT_OF_STOCK', label: 'Con agotados' },
            ]}
          />
        </div>

        <div style={{ minWidth: 175 }}>
          <CustomSelect
            size="sm"
            icon={<AppIcon name="sort" size={13} />}
            value={filters.sortBy || 'NAME_ASC'}
            onChange={handleSortChange}
            options={[
              { value: 'NAME_ASC', label: 'Nombre (A - Z)' },
              { value: 'NAME_DESC', label: 'Nombre (Z - A)' },
              { value: 'INVENTORY_DESC', label: 'Mayor inventario' },
              { value: 'INVENTORY_ASC', label: 'Menor inventario' },
              { value: 'SALES_DESC', label: 'Mayor venta de hoy' },
              { value: 'ALERTS_DESC', label: 'Más alertas' },
            ]}
          />
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            className="outline-button compact clear-filters-btn"
            onClick={() => {
              setLocalSearch('')
              onClearFilters()
            }}
          >
            <AppIcon name="close" size={14} />
            <span>Limpiar filtros</span>
          </button>
        )}
      </div>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="active-chips-row" aria-label="Filtros aplicados">
          <span className="chips-caption">Filtros activos:</span>

          {filters.query && (
            <span className="filter-chip">
              Búsqueda: &ldquo;{filters.query}&rdquo;
              <button onClick={() => setLocalSearch('')}>
                <AppIcon name="close" size={12} />
              </button>
            </span>
          )}

          {filters.type && filters.type !== 'ALL' && (
            <span className="filter-chip">
              Tipo:{' '}
              {filters.type === 'WAREHOUSE'
                ? 'Bodega'
                : filters.type === 'STORE_POINT'
                ? 'Punto de venta'
                : 'Centro de distribución'}
              <button onClick={() => onFilterChange({ ...filters, type: 'ALL' })}>
                <AppIcon name="close" size={12} />
              </button>
            </span>
          )}

          {filters.status && filters.status !== 'ALL' && (
            <span className="filter-chip">
              Estado: {filters.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}
              <button onClick={() => onFilterChange({ ...filters, status: 'ALL' })}>
                <AppIcon name="close" size={12} />
              </button>
            </span>
          )}

          {filters.inventoryHealth && filters.inventoryHealth !== 'ALL' && (
            <span className="filter-chip">
              Inventario:{' '}
              {filters.inventoryHealth === 'NORMAL'
                ? 'Normal'
                : filters.inventoryHealth === 'LOW_STOCK'
                ? 'Stock bajo'
                : filters.inventoryHealth === 'CRITICAL'
                ? 'Crítico'
                : 'Con agotados'}
              <button
                onClick={() => onFilterChange({ ...filters, inventoryHealth: 'ALL' })}
              >
                <AppIcon name="close" size={12} />
              </button>
            </span>
          )}

          {filters.sortBy && filters.sortBy !== 'NAME_ASC' && (
            <span className="filter-chip">
              Orden:{' '}
              {filters.sortBy === 'INVENTORY_DESC'
                ? 'Mayor inventario'
                : filters.sortBy === 'INVENTORY_ASC'
                ? 'Menor inventario'
                : filters.sortBy === 'SALES_DESC'
                ? 'Mayor venta'
                : 'Más alertas'}
              <button
                onClick={() => onFilterChange({ ...filters, sortBy: 'NAME_ASC' })}
              >
                <AppIcon name="close" size={12} />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
