'use client'

import React, { useMemo } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect, SelectOption } from '@/components/ui/CustomSelect'
import { SuperCatalogFilters, StockAvailabilityLevel } from '../types'

interface SuperCatalogFiltersProps {
  filters: SuperCatalogFilters
  setFilters: React.Dispatch<React.SetStateAction<SuperCatalogFilters>>
  searchInput: string
  onSearchChange: (value: string) => void
  categories: string[]
  brands: string[]
}

export function SuperCatalogFiltersBar({
  filters,
  setFilters,
  searchInput,
  onSearchChange,
  categories,
  brands,
}: SuperCatalogFiltersProps) {
  const hasActiveFilters =
    Boolean(filters.search?.trim()) ||
    (filters.category && filters.category !== 'ALL') ||
    (filters.brand && filters.brand !== 'ALL') ||
    (filters.availability && filters.availability !== 'ALL') ||
    (filters.catalogStatus && filters.catalogStatus !== 'ALL') ||
    (filters.purchaseStatus && filters.purchaseStatus !== 'ALL')

  const clearFilters = () => {
    onSearchChange('')
    setFilters({
      search: '',
      category: 'ALL',
      brand: 'ALL',
      availability: 'ALL',
      catalogStatus: 'ALL',
      purchaseStatus: 'ALL',
      sortBy: 'name',
      sortOrder: 'asc',
      page: 1,
      pageSize: 10,
    })
  }

  // Opciones de categorías
  const categoryOptions: SelectOption[] = useMemo(() => [
    { value: 'ALL', label: 'Todas las Categorías' },
    ...categories.map((c) => ({ value: c, label: c })),
  ], [categories])

  // Opciones de marcas
  const brandOptions: SelectOption[] = useMemo(() => [
    { value: 'ALL', label: 'Todas las Marcas' },
    ...brands.map((b) => ({ value: b, label: b })),
  ], [brands])

  // Opciones de disponibilidad
  const availabilityOptions: SelectOption[] = [
    { value: 'ALL', label: 'Toda Disponibilidad' },
    { value: 'AVAILABLE', label: 'Disponible' },
    { value: 'LOW_STOCK', label: 'Pocas Unidades' },
    { value: 'OUT_OF_STOCK', label: 'Agotado' },
  ]

  // Opciones de estado en catálogo web
  const catalogStatusOptions: SelectOption[] = [
    { value: 'ALL', label: 'Todos los Estados Web' },
    { value: 'PUBLISHED', label: 'Publicados' },
    { value: 'HIDDEN', label: 'Ocultos' },
  ]

  // Opciones de compra directa online
  const purchaseStatusOptions: SelectOption[] = [
    { value: 'ALL', label: 'Compra Online (Todos)' },
    { value: 'ENABLED', label: 'Compra Directa Activa' },
    { value: 'DISABLED', label: 'Compra Desactivada' },
  ]

  return (
    <div className="toolbar inventory-toolbar products-toolbar page-enter" style={{ marginBottom: 20 }}>
      {/* Barra de búsqueda con icono y limpiar */}
      <div className="search-box wide products-search-box">
        <AppIcon name="search" size={16} />
        <input
          type="text"
          placeholder="Buscar por nombre, SKU o código..."
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Buscar productos en catálogo"
        />
        {searchInput && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={() => onSearchChange('')}
            aria-label="Limpiar búsqueda"
          >
            <AppIcon name="close" size={14} />
          </button>
        )}
      </div>

      {/* Selectores con estilo global de Super Más */}
      <div className="filter-select-group">
        {/* Filtro por Categoría */}
        <div className="filter-select-item" style={{ minWidth: 170 }}>
          <CustomSelect
            options={categoryOptions}
            value={filters.category || 'ALL'}
            onChange={(val) => setFilters((prev) => ({ ...prev, category: val, page: 1 }))}
            placeholder="Categoría"
            size="sm"
            icon={<AppIcon name="products" size={14} color="#64748b" />}
          />
        </div>

        {/* Filtro por Marca */}
        <div className="filter-select-item" style={{ minWidth: 160 }}>
          <CustomSelect
            options={brandOptions}
            value={filters.brand || 'ALL'}
            onChange={(val) => setFilters((prev) => ({ ...prev, brand: val, page: 1 }))}
            placeholder="Marca"
            size="sm"
            icon={<AppIcon name="layers" size={14} color="#64748b" />}
          />
        </div>

        {/* Filtro por Disponibilidad Comercial */}
        <div className="filter-select-item" style={{ minWidth: 165 }}>
          <CustomSelect
            options={availabilityOptions}
            value={filters.availability || 'ALL'}
            onChange={(val) =>
              setFilters((prev) => ({
                ...prev,
                availability: val as StockAvailabilityLevel | 'ALL',
                page: 1,
              }))
            }
            placeholder="Disponibilidad"
            size="sm"
            icon={<AppIcon name="inventory" size={14} color="var(--navy)" />}
          />
        </div>

        {/* Filtro por Estado en Web */}
        <div className="filter-select-item" style={{ minWidth: 175 }}>
          <CustomSelect
            options={catalogStatusOptions}
            value={filters.catalogStatus || 'ALL'}
            onChange={(val) =>
              setFilters((prev) => ({
                ...prev,
                catalogStatus: val as 'ALL' | 'PUBLISHED' | 'HIDDEN',
                page: 1,
              }))
            }
            placeholder="Estado Web"
            size="sm"
            icon={<AppIcon name="eye" size={14} color="var(--red)" />}
          />
        </div>

        {/* Filtro por Compra Directa */}
        <div className="filter-select-item" style={{ minWidth: 180 }}>
          <CustomSelect
            options={purchaseStatusOptions}
            value={filters.purchaseStatus || 'ALL'}
            onChange={(val) =>
              setFilters((prev) => ({
                ...prev,
                purchaseStatus: val as 'ALL' | 'ENABLED' | 'DISABLED',
                page: 1,
              }))
            }
            placeholder="Compra Online"
            size="sm"
            icon={<AppIcon name="ecommerceSM" size={14} color="#159a67" />}
          />
        </div>
      </div>

      {/* Botón limpiar filtros */}
      {hasActiveFilters && (
        <button
          type="button"
          className="reset-filters-pill"
          onClick={clearFilters}
          title="Restablecer todos los filtros"
        >
          <AppIcon name="close" size={13} />
          <span>Limpiar filtros</span>
        </button>
      )}
    </div>
  )
}
