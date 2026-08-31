'use client'

import React, { useState, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect, SelectOption } from '@/components/ui/CustomSelect'
import { InventoryFilterParams, StockHealthStatus } from '../types'

interface InventoryFiltersProps {
  filters: InventoryFilterParams
  onFilterChange: (newFilters: Partial<InventoryFilterParams>) => void
  onResetFilters: () => void
  onToggleColumnSelector: () => void
  hasActiveFilters: boolean
}

const LOCATION_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'Todas las bodegas' },
  { value: 'loc-01', label: 'Bodega Principal Cali', badge: 'BOD-PRI-01' },
  { value: 'loc-02', label: 'Punto Centro - Cra 5', badge: 'POS-CEN-01' },
  { value: 'loc-03', label: 'Bodega Norte - Yumbo', badge: 'BOD-NOR-01' },
  { value: 'loc-04', label: 'Punto Sur - Ciudad Jardín', badge: 'POS-SUR-01' },
]

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'Todas las categorías' },
  { value: 'Abarrotes y Despensa', label: 'Abarrotes y Despensa' },
  { value: 'Aceites y Grasas', label: 'Aceites y Grasas' },
  { value: 'Lácteos y Huevos', label: 'Lácteos y Huevos' },
  { value: 'Bebidas y Licores', label: 'Bebidas y Licores' },
  { value: 'Enlatados y Conservas', label: 'Enlatados y Conservas' },
  { value: 'Aseo y Hogar', label: 'Aseo y Hogar' },
  { value: 'Granos y Cereales', label: 'Granos y Cereales' },
]

const BRAND_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'Todas las marcas' },
  { value: 'Diana', label: 'Diana' },
  { value: 'OleoCali', label: 'OleoCali' },
  { value: 'Alquería', label: 'Alquería' },
  { value: 'Sello Rojo', label: 'Sello Rojo' },
  { value: 'Coca-Cola', label: 'Coca-Cola' },
  { value: 'Van Camps', label: 'Van Camps' },
  { value: 'Familia', label: 'Familia' },
  { value: 'Super Más', label: 'Super Más' },
  { value: 'Fab', label: 'Fab' },
]

const HEALTH_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'Todos los estados' },
  { value: 'AVAILABLE', label: 'Disponible' },
  { value: 'LOW_STOCK', label: 'Stock bajo' },
  { value: 'CRITICAL', label: 'Crítico' },
  { value: 'OUT_OF_STOCK', label: 'Agotado' },
]

const PRESENCE_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'Cualquier saldo' },
  { value: 'WITH_STOCK', label: 'Con existencia (>0)' },
  { value: 'ZERO_STOCK', label: 'Sin existencia (=0)' },
]

export function InventoryFilters({
  filters,
  onFilterChange,
  onResetFilters,
  onToggleColumnSelector,
  hasActiveFilters,
}: InventoryFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.query || '')
  const onFilterChangeRef = React.useRef(onFilterChange)
  onFilterChangeRef.current = onFilterChange

  useEffect(() => {
    setSearchInput(filters.query || '')
  }, [filters.query])

  // Debounced search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== (filters.query || '')) {
        onFilterChangeRef.current({ query: searchInput, page: 1 })
      }
    }, 280)
    return () => clearTimeout(timer)
  }, [searchInput, filters.query])

  return (
    <div className="inventory-filters-card">
      <div className="inventory-filters-grid">
        {/* 1. Main Search Bar */}
        <div className="search-box inventory-search-box">
          <AppIcon name="search" size={15} color="#94a3b8" />
          <input
            type="text"
            placeholder="Buscar por producto, SKU o código de barras..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Buscar producto"
          />
          {searchInput && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => {
                setSearchInput('')
                onFilterChange({ query: '', page: 1 })
              }}
              title="Limpiar búsqueda"
            >
              <AppIcon name="close" size={12} />
            </button>
          )}
        </div>

        {/* 2. Bodega / Ubicación (Prominent) */}
        <div className="filter-item prominent-location-filter">
          <CustomSelect
            value={filters.locationId || 'ALL'}
            onChange={(val) => onFilterChange({ locationId: val, page: 1 })}
            options={LOCATION_OPTIONS}
            placeholder="Filtrar por bodega"
            size="sm"
            icon={<AppIcon name="warehouses" size={14} color="var(--navy)" />}
          />
        </div>

        {/* 3. Categoría */}
        <div className="filter-item">
          <CustomSelect
            value={filters.category || 'ALL'}
            onChange={(val) => onFilterChange({ category: val, page: 1 })}
            options={CATEGORY_OPTIONS}
            placeholder="Categoría"
            size="sm"
            icon={<AppIcon name="grid" size={14} color="#64748b" />}
          />
        </div>

        {/* 4. Marca */}
        <div className="filter-item">
          <CustomSelect
            value={filters.brand || 'ALL'}
            onChange={(val) => onFilterChange({ brand: val, page: 1 })}
            options={BRAND_OPTIONS}
            placeholder="Marca"
            size="sm"
          />
        </div>

        {/* 5. Estado de Stock */}
        <div className="filter-item">
          <CustomSelect
            value={filters.stockHealth || 'ALL'}
            onChange={(val) =>
              onFilterChange({
                stockHealth: val as StockHealthStatus | 'ALL',
                page: 1,
              })
            }
            options={HEALTH_OPTIONS}
            placeholder="Estado"
            size="sm"
          />
        </div>

        {/* 6. Presencia de existencia */}
        <div className="filter-item">
          <CustomSelect
            value={filters.hasStock || 'ALL'}
            onChange={(val) =>
              onFilterChange({
                hasStock: val as 'ALL' | 'WITH_STOCK' | 'ZERO_STOCK',
                page: 1,
              })
            }
            options={PRESENCE_OPTIONS}
            placeholder="Existencia"
            size="sm"
          />
        </div>

        {/* Filter Controls: Reset & Column Selector */}
        <div className="filter-actions-cluster">
          {hasActiveFilters && (
            <button
              type="button"
              className="outline-button compact reset-filter-btn"
              onClick={onResetFilters}
              title="Restablecer todos los filtros"
            >
              <AppIcon name="close" size={12} />
              <span>Limpiar filtros</span>
            </button>
          )}

          <button
            type="button"
            className="outline-button compact col-selector-btn"
            onClick={onToggleColumnSelector}
            title="Seleccionar columnas visibles"
          >
            <AppIcon name="sliders" size={14} />
            <span>Columnas</span>
          </button>
        </div>
      </div>
    </div>
  )
}
