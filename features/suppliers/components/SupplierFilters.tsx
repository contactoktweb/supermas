'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { SupplierFilterParams, SupplierStatus } from '../types'

interface SupplierFiltersProps {
  filters: SupplierFilterParams
  onFilterChange: (key: keyof SupplierFilterParams, value: any) => void
  onResetFilters: () => void
  locations: { id: string; name: string; code: string }[]
}

const STATUS_OPTIONS: { value: SupplierStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todos los estados' },
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'INACTIVE', label: 'Inactivo' },
]

export function SupplierFilters({
  filters,
  onFilterChange,
  onResetFilters,
  locations,
}: SupplierFiltersProps) {
  const hasActiveFilters = Boolean(
    filters.query?.trim() ||
      filters.documentNumber?.trim() ||
      (filters.status && filters.status !== 'ALL') ||
      (filters.locationId && filters.locationId !== 'ALL') ||
      filters.hasPendingBalance !== undefined ||
      filters.startDate ||
      filters.endDate
  )

  const locationOptions = [
    { value: 'ALL', label: 'Todas las bodegas' },
    ...locations.map((l) => ({
      value: l.id,
      label: l.name,
      description: l.code,
    })),
  ]

  const balanceOptions = [
    { value: 'ALL', label: 'Todos los saldos' },
    { value: 'WITH_BALANCE', label: 'Con saldo pendiente' },
    { value: 'WITHOUT_BALANCE', label: 'Al día ($0)' },
  ]

  const currentBalanceVal =
    filters.hasPendingBalance === true
      ? 'WITH_BALANCE'
      : filters.hasPendingBalance === false
      ? 'WITHOUT_BALANCE'
      : 'ALL'

  return (
    <div
      className="toolbar inventory-toolbar products-toolbar page-enter"
      role="search"
      aria-label="Filtros de proveedores"
    >
      {/* 1. Main Search (Name, Commercial Name, Contact, Email, City) */}
      <div className="search-box wide products-search-box">
        <AppIcon name="search" size={16} />
        <input
          value={filters.query || ''}
          onChange={(e) => onFilterChange('query', e.target.value)}
          placeholder="Buscar por razón social, nombre comercial, contacto o ciudad..."
          aria-label="Buscar proveedores"
        />
        {filters.query && (
          <button
            type="button"
            className="clear-search-btn"
            onClick={() => onFilterChange('query', '')}
            aria-label="Borrar búsqueda"
          >
            <AppIcon name="close" size={14} />
          </button>
        )}
      </div>

      {/* 2. Filtro NIT / Documento */}
      <div className="search-box" style={{ maxWidth: 170 }}>
        <input
          value={filters.documentNumber || ''}
          onChange={(e) => onFilterChange('documentNumber', e.target.value)}
          placeholder="Filtrar por NIT..."
          aria-label="Filtrar por NIT"
          style={{ paddingLeft: 12 }}
        />
        {filters.documentNumber && (
          <button
            type="button"
            className="clear-search-btn"
            onClick={() => onFilterChange('documentNumber', '')}
            aria-label="Borrar filtro NIT"
          >
            <AppIcon name="close" size={14} />
          </button>
        )}
      </div>

      {/* 3. Filtro Estado (Activo / Inactivo) */}
      <div className="filter-select-wrap">
        <CustomSelect
          value={filters.status || 'ALL'}
          onChange={(val) => onFilterChange('status', val)}
          options={STATUS_OPTIONS}
          size="sm"
          placeholder="Estado"
        />
      </div>

      {/* 4. Filtro Bodega Relacionada */}
      <div className="filter-select-wrap">
        <CustomSelect
          value={filters.locationId || 'ALL'}
          onChange={(val) => onFilterChange('locationId', val)}
          options={locationOptions}
          size="sm"
          placeholder="Bodega destino"
        />
      </div>

      {/* 5. Filtro Con Saldo Pendiente */}
      <div className="filter-select-wrap">
        <CustomSelect
          value={currentBalanceVal}
          onChange={(val) => {
            if (val === 'WITH_BALANCE') onFilterChange('hasPendingBalance', true)
            else if (val === 'WITHOUT_BALANCE') onFilterChange('hasPendingBalance', false)
            else onFilterChange('hasPendingBalance', undefined)
          }}
          options={balanceOptions}
          size="sm"
          placeholder="Obligaciones"
        />
      </div>

      {/* 6. Rango de Fechas */}
      <div className="filter-date-group">
        <input
          type="date"
          className="filter-date-input"
          value={filters.startDate || ''}
          onChange={(e) => onFilterChange('startDate', e.target.value)}
          aria-label="Fecha inicial"
          title="Fecha inicial de compra"
        />
        <span className="filter-date-sep">a</span>
        <input
          type="date"
          className="filter-date-input"
          value={filters.endDate || ''}
          onChange={(e) => onFilterChange('endDate', e.target.value)}
          aria-label="Fecha final"
          title="Fecha final de compra"
        />
      </div>

      {/* 7. Limpiar Filtros */}
      {hasActiveFilters && (
        <button
          type="button"
          className="outline-button icon-only-btn"
          onClick={onResetFilters}
          title="Limpiar todos los filtros"
        >
          <AppIcon name="close" size={14} />
          <span>Limpiar</span>
        </button>
      )}
    </div>
  )
}
