'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { DateRangeFilter } from '@/components/ui/DateRangeFilter'
import { SupplierFilterParams, SupplierStatus } from '../types'

interface SupplierFiltersProps {
  filters: SupplierFilterParams
  onFilterChange: (key: keyof SupplierFilterParams, value: any) => void
  onResetFilters: () => void
  locations: { id: string; name: string; code: string }[]
}

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

  const status = filters.status || 'ALL'

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
      {/* 1. Main Search (Business Name, Commercial Name, Contact, Email, City) */}
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
            className="search-clear-btn"
            onClick={() => onFilterChange('query', '')}
            aria-label="Limpiar búsqueda"
          >
            <AppIcon name="close" size={14} />
          </button>
        )}
      </div>

      {/* 2. Quick Status Selector: Todos | Activos | Inactivos */}
      <div
        className="period-segmented-tabs"
        role="tablist"
        aria-label="Filtro rápido de estado"
        style={{ flexShrink: 0 }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={status === 'ALL'}
          className={`period-tab-btn ${status === 'ALL' ? 'selected' : ''}`}
          onClick={() => onFilterChange('status', 'ALL')}
        >
          <span>Todos</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={status === 'ACTIVE'}
          className={`period-tab-btn ${status === 'ACTIVE' ? 'selected' : ''}`}
          onClick={() => onFilterChange('status', 'ACTIVE')}
        >
          <AppIcon name="check" size={12} />
          <span>Activos</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={status === 'INACTIVE'}
          className={`period-tab-btn ${status === 'INACTIVE' ? 'selected' : ''}`}
          onClick={() => onFilterChange('status', 'INACTIVE')}
        >
          <AppIcon name="close" size={12} />
          <span>Inactivos</span>
        </button>
      </div>

      {/* 3. Filtro NIT / Documento */}
      <div className="search-box" style={{ width: 175, flexShrink: 0 }}>
        <AppIcon name="fileText" size={14} color="#64748b" />
        <input
          value={filters.documentNumber || ''}
          onChange={(e) => onFilterChange('documentNumber', e.target.value)}
          placeholder="Filtrar NIT..."
          aria-label="Filtrar por NIT"
        />
        {filters.documentNumber && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={() => onFilterChange('documentNumber', '')}
            aria-label="Borrar filtro NIT"
          >
            <AppIcon name="close" size={14} />
          </button>
        )}
      </div>

      {/* 4. Dropdowns Group */}
      <div className="filter-select-group">
        {/* Bodega Relacionada */}
        <div className="filter-select-item" style={{ minWidth: 175 }}>
          <CustomSelect
            options={locationOptions}
            value={filters.locationId || 'ALL'}
            onChange={(val) => onFilterChange('locationId', val)}
            placeholder="Bodega destino"
            size="sm"
            icon={<AppIcon name="warehouse" size={14} color="#64748b" />}
          />
        </div>

        {/* Obligaciones / Saldos */}
        <div className="filter-select-item" style={{ minWidth: 175 }}>
          <CustomSelect
            options={balanceOptions}
            value={currentBalanceVal}
            onChange={(val) => {
              if (val === 'WITH_BALANCE') onFilterChange('hasPendingBalance', true)
              else if (val === 'WITHOUT_BALANCE') onFilterChange('hasPendingBalance', false)
              else onFilterChange('hasPendingBalance', undefined)
            }}
            placeholder="Obligaciones"
            size="sm"
            icon={<AppIcon name="wallet" size={14} color="var(--red)" />}
          />
        </div>

        {/* Date Range Filter */}
        <DateRangeFilter
          startDate={filters.startDate}
          endDate={filters.endDate}
          onChange={({ startDate, endDate }) => {
            onFilterChange('startDate', startDate)
            onFilterChange('endDate', endDate)
          }}
          placeholder="Fecha registro"
          size="sm"
        />
      </div>

      {/* 5. Reset Button */}
      {hasActiveFilters && (
        <button
          type="button"
          className="outline-button compact reset-filter-btn"
          onClick={onResetFilters}
          title="Limpiar filtros"
          style={{ marginLeft: 'auto' }}
        >
          <AppIcon name="close" size={12} />
          <span>Limpiar</span>
        </button>
      )}
    </div>
  )
}
