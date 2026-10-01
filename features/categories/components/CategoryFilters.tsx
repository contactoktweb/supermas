'use client'

import React, { useState, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect, SelectOption } from '@/components/ui/CustomSelect'
import { CategoryFilters as CategoryFiltersType, CategorySortOption } from '../types'

interface CategoryFiltersProps {
  filters: CategoryFiltersType
  onFilterChange: (newFilters: Partial<CategoryFiltersType>) => void
  onResetFilters: () => void
  hasActiveFilters: boolean
}

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'Todos los estados' },
  { value: 'ACTIVE', label: 'Solo activas' },
  { value: 'INACTIVE', label: 'Solo inactivas' },
]

const LEVEL_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'Toda la jerarquía' },
  { value: 'ROOT', label: 'Solo categorías raíz' },
]

const SORT_OPTIONS: SelectOption[] = [
  { value: 'SORT_ORDER_ASC', label: 'Orden configurado' },
  { value: 'NAME_ASC', label: 'Nombre (A - Z)' },
  { value: 'NAME_DESC', label: 'Nombre (Z - A)' },
  { value: 'CODE_ASC', label: 'Código' },
  { value: 'CREATED_DESC', label: 'Más recientes' },
]

export function CategoryFilters({
  filters,
  onFilterChange,
  onResetFilters,
  hasActiveFilters,
}: CategoryFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.query || '')

  useEffect(() => {
    setSearchInput(filters.query || '')
  }, [filters.query])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== (filters.query || '')) {
        onFilterChange({ query: searchInput, page: 1 })
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [searchInput, filters.query, onFilterChange])

  return (
    <div className="toolbar inventory-toolbar page-enter">
      <div className="inventory-filters-grid" style={{ width: '100%' }}>
        {/* Búsqueda */}
        <div className="search-box inventory-search-box">
          <AppIcon name="search" size={15} color="#94a3b8" />
          <input
            type="text"
            placeholder="Buscar por nombre, código o slug..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Buscar categoría"
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

        {/* Nivel / Jerarquía */}
        <div className="filter-item">
          <CustomSelect
            value={filters.parentId || 'ALL'}
            onChange={(val) => onFilterChange({ parentId: val, page: 1 })}
            options={LEVEL_OPTIONS}
            placeholder="Filtrar nivel"
            size="sm"
          />
        </div>

        {/* Estado */}
        <div className="filter-item">
          <CustomSelect
            value={filters.status || 'ALL'}
            onChange={(val) =>
              onFilterChange({ status: val as 'ALL' | 'ACTIVE' | 'INACTIVE', page: 1 })
            }
            options={STATUS_OPTIONS}
            placeholder="Estado"
            size="sm"
          />
        </div>

        {/* Orden */}
        <div className="filter-item">
          <CustomSelect
            value={filters.sortBy || 'SORT_ORDER_ASC'}
            onChange={(val) =>
              onFilterChange({ sortBy: val as CategorySortOption, page: 1 })
            }
            options={SORT_OPTIONS}
            placeholder="Ordenar por"
            size="sm"
          />
        </div>

        {/* Botón de reset */}
        {hasActiveFilters && (
          <button
            type="button"
            className="btn btn-ghost btn-sm reset-filters-btn"
            onClick={onResetFilters}
            title="Restablecer filtros"
          >
            <AppIcon name="refresh" size={14} />
            <span>Restablecer</span>
          </button>
        )}
      </div>
    </div>
  )
}
