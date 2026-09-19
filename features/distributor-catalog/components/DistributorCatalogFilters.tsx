'use client'

import React, { useMemo } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect, SelectOption } from '@/components/ui/CustomSelect'
import {
  DistributorCatalogFilters as DistributorCatalogFiltersType,
  StockAvailabilityLevel,
  BulkActionType,
} from '../types'

interface DistributorCatalogFiltersProps {
  filters: DistributorCatalogFiltersType
  categories: string[]
  brands: string[]
  selectedCount: number
  onSearchChange: (val: string) => void
  onFilterChange: (patch: Partial<DistributorCatalogFiltersType>) => void
  onReset: () => void
  onOpenBulkAction: (action: BulkActionType) => void
  onClearSelection: () => void
  canBulkUpdate: boolean
}

export function DistributorCatalogFilters({
  filters,
  categories,
  brands,
  selectedCount,
  onSearchChange,
  onFilterChange,
  onReset,
  onOpenBulkAction,
  onClearSelection,
  canBulkUpdate,
}: DistributorCatalogFiltersProps) {
  const hasActiveFilters =
    (filters.search && filters.search.trim() !== '') ||
    (filters.category && filters.category !== 'ALL') ||
    (filters.brand && filters.brand !== 'ALL') ||
    (filters.availability && filters.availability !== 'ALL') ||
    (filters.distributorStatus && filters.distributorStatus !== 'ALL') ||
    (filters.directPurchase && filters.directPurchase !== 'ALL')

  // Opciones con CustomSelect
  const categoryOptions: SelectOption[] = useMemo(() => [
    { value: 'ALL', label: 'Todas las Categorías' },
    ...categories.map((c) => ({ value: c, label: c })),
  ], [categories])

  const brandOptions: SelectOption[] = useMemo(() => [
    { value: 'ALL', label: 'Todas las Marcas' },
    ...brands.map((b) => ({ value: b, label: b })),
  ], [brands])

  const availabilityOptions: SelectOption[] = [
    { value: 'ALL', label: 'Toda Disponibilidad' },
    { value: 'AVAILABLE', label: 'Disponible' },
    { value: 'LOW_STOCK', label: 'Pocas Unidades' },
    { value: 'OUT_OF_STOCK', label: 'Agotado' },
  ]

  const distributorStatusOptions: SelectOption[] = [
    { value: 'ALL', label: 'Todos los Estados' },
    { value: 'PUBLISHED', label: 'Publicados' },
    { value: 'HIDDEN', label: 'Ocultos' },
  ]

  const directPurchaseOptions: SelectOption[] = [
    { value: 'ALL', label: 'Toda Modalidad' },
    { value: 'ENABLED', label: 'Con Compra Web' },
    { value: 'DISABLED', label: 'Solo Consulta' },
  ]

  return (
    <div className="space-y-3 mb-5">
      {/* Barra de Acciones Masivas cuando hay selección */}
      {selectedCount > 0 && canBulkUpdate && (
        <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 flex flex-wrap items-center justify-between gap-3 shadow-xs animate-scale-up">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse" />
            <span className="text-xs font-bold text-purple-900">
              {selectedCount} {selectedCount === 1 ? 'producto seleccionado' : 'productos seleccionados'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenBulkAction('PUBLISH')}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <AppIcon name="check" size={13} />
              <span>Publicar en Distribuidora</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenBulkAction('HIDE')}
              className="px-3 py-1.5 rounded-lg bg-slate-700 text-white text-xs font-semibold hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <AppIcon name="close" size={13} />
              <span>Ocultar</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenBulkAction('ENABLE_WHATSAPP')}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <AppIcon name="check" size={13} />
              <span>Activar WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenBulkAction('DISABLE_WHATSAPP')}
              className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <AppIcon name="close" size={13} />
              <span>Desactivar WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={onClearSelection}
              className="text-xs text-purple-700 hover:text-purple-900 font-semibold hover:underline px-2 py-1"
            >
              Deseleccionar
            </button>
          </div>
        </div>
      )}

      {/* Barra Principal de Filtros */}
      <div className="toolbar inventory-toolbar products-toolbar page-enter" style={{ marginBottom: 12 }}>
        {/* Input de Búsqueda con debounce */}
        <div className="search-box wide products-search-box">
          <AppIcon name="search" size={16} />
          <input
            type="text"
            placeholder="Buscar por nombre, SKU o código de barras..."
            defaultValue={filters.search || ''}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full text-xs"
            aria-label="Buscar productos en catálogo distribuidora"
          />
          {filters.search && (
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

        {/* Selectores de Filtro con CustomSelect */}
        <div className="filter-select-group">
          {/* Categoría */}
          <div className="filter-select-item" style={{ minWidth: 170 }}>
            <CustomSelect
              options={categoryOptions}
              value={filters.category || 'ALL'}
              onChange={(val) => onFilterChange({ category: val, page: 1 })}
              placeholder="Categoría"
              size="sm"
              icon={<AppIcon name="products" size={14} color="#64748b" />}
            />
          </div>

          {/* Marca */}
          <div className="filter-select-item" style={{ minWidth: 155 }}>
            <CustomSelect
              options={brandOptions}
              value={filters.brand || 'ALL'}
              onChange={(val) => onFilterChange({ brand: val, page: 1 })}
              placeholder="Marca"
              size="sm"
              icon={<AppIcon name="layers" size={14} color="#64748b" />}
            />
          </div>

          {/* Disponibilidad */}
          <div className="filter-select-item" style={{ minWidth: 165 }}>
            <CustomSelect
              options={availabilityOptions}
              value={filters.availability || 'ALL'}
              onChange={(val) =>
                onFilterChange({ availability: val as StockAvailabilityLevel | 'ALL', page: 1 })
              }
              placeholder="Disponibilidad"
              size="sm"
              icon={<AppIcon name="inventory" size={14} color="var(--navy)" />}
            />
          </div>

          {/* Estado Distribuidora */}
          <div className="filter-select-item" style={{ minWidth: 160 }}>
            <CustomSelect
              options={distributorStatusOptions}
              value={filters.distributorStatus || 'ALL'}
              onChange={(val) =>
                onFilterChange({ distributorStatus: val as any, page: 1 })
              }
              placeholder="Estado Distribuidora"
              size="sm"
              icon={<AppIcon name="eye" size={14} color="var(--red)" />}
            />
          </div>

          {/* Modalidad de Venta */}
          <div className="filter-select-item" style={{ minWidth: 165 }}>
            <CustomSelect
              options={directPurchaseOptions}
              value={filters.directPurchase || 'ALL'}
              onChange={(val) =>
                onFilterChange({ directPurchase: val as any, page: 1 })
              }
              placeholder="Modalidad Venta"
              size="sm"
              icon={<AppIcon name="ecommerceDist" size={14} color="#159a67" />}
            />
          </div>
        </div>

        {/* Botón Reset */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="reset-filters-pill"
            title="Limpiar filtros"
          >
            <AppIcon name="close" size={13} />
            <span>Limpiar</span>
          </button>
        )}
      </div>
    </div>
  )
}
