'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { DateRangeFilter } from '@/components/ui/DateRangeFilter'
import {
  CustomerFilterParams,
  CustomerStatus,
  CustomerType,
  CustomerCategory,
  CustomerPriceList,
} from '../types'

interface CustomerFiltersProps {
  filters: CustomerFilterParams
  onFilterChange: (key: keyof CustomerFilterParams, value: any) => void
  onResetFilters: () => void
  cities: string[]
}

const TYPE_OPTIONS: { value: CustomerType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todos los tipos' },
  { value: 'NATURAL', label: 'Persona Natural' },
  { value: 'COMPANY', label: 'Empresa / Jurídica' },
]

const CATEGORY_OPTIONS: { value: CustomerCategory | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todas las categorías' },
  { value: 'WHOLESALE', label: 'Mayorista' },
  { value: 'FREQUENT', label: 'Cliente Frecuente' },
  { value: 'COMPANY', label: 'Empresa Institucional' },
  { value: 'FINAL_CONSUMER', label: 'Consumidor Final' },
]

const PRICE_LIST_OPTIONS: { value: CustomerPriceList | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todas las listas' },
  { value: 'DEFAULT', label: 'Precio Normal' },
  { value: 'WHOLESALE', label: 'Precio Mayorista' },
  { value: 'VIP', label: 'Precio Especial VIP' },
]

const ACTIVITY_OPTIONS = [
  { value: 'ALL', label: 'Toda la actividad' },
  { value: 'WITH_PURCHASES', label: 'Con compras' },
  { value: 'WITHOUT_PURCHASES', label: 'Sin compras' },
  { value: 'WITH_BALANCE', label: 'Con saldo en cartera' },
]

export function CustomerFilters({
  filters,
  onFilterChange,
  onResetFilters,
  cities,
}: CustomerFiltersProps) {
  const hasActiveFilters = Boolean(
    filters.query?.trim() ||
      filters.documentNumber?.trim() ||
      (filters.status && filters.status !== 'ALL') ||
      (filters.customerType && filters.customerType !== 'ALL') ||
      (filters.category && filters.category !== 'ALL') ||
      (filters.priceList && filters.priceList !== 'ALL') ||
      (filters.city && filters.city !== 'ALL') ||
      filters.hasPurchases !== undefined ||
      filters.hasBalance !== undefined ||
      filters.startDate ||
      filters.endDate
  )

  const status = filters.status || 'ALL'

  const cityOptions = [
    { value: 'ALL', label: 'Todas las ciudades' },
    ...cities.map((c) => ({ value: c, label: c })),
  ]

  let currentActivityVal = 'ALL'
  if (filters.hasBalance === true) currentActivityVal = 'WITH_BALANCE'
  else if (filters.hasPurchases === true) currentActivityVal = 'WITH_PURCHASES'
  else if (filters.hasPurchases === false) currentActivityVal = 'WITHOUT_PURCHASES'

  return (
    <div
      className="toolbar inventory-toolbar products-toolbar page-enter"
      role="search"
      aria-label="Filtros de clientes"
    >
      {/* 1. Main Search Bar */}
      <div className="search-box wide products-search-box">
        <AppIcon name="search" size={16} />
        <input
          value={filters.query || ''}
          onChange={(e) => onFilterChange('query', e.target.value)}
          placeholder="Buscar por cliente, NIT, CC, email, teléfono..."
          aria-label="Buscar clientes"
        />
        {filters.query && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={() => onFilterChange('query', '')}
            aria-label="Limpiar búsqueda"
          >
            <AppIcon name="close" size={12} />
          </button>
        )}
      </div>

      {/* 2. Direct Document Search */}
      <div
        className="search-box filter-search-secondary"
        style={{ width: 175, flexShrink: 0 }}
      >
        <AppIcon name="fileText" size={14} color="#64748b" />
        <input
          value={filters.documentNumber || ''}
          onChange={(e) => onFilterChange('documentNumber', e.target.value)}
          placeholder="N° Documento..."
          aria-label="Filtrar por número de documento"
        />
        {filters.documentNumber && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={() => onFilterChange('documentNumber', '')}
            aria-label="Limpiar filtro de documento"
          >
            <AppIcon name="close" size={12} />
          </button>
        )}
      </div>

      {/* 3. Segmented Status Tabs */}
      <div className="period-segmented-tabs" role="tablist" aria-label="Filtrar por estado">
        {(['ALL', 'ACTIVE', 'INACTIVE'] as (CustomerStatus | 'ALL')[]).map((st) => (
          <button
            key={st}
            type="button"
            className={`tab-pill ${status === st ? 'active' : ''}`}
            onClick={() => onFilterChange('status', st)}
          >
            {st === 'ALL' && 'Todos'}
            {st === 'ACTIVE' && 'Activos'}
            {st === 'INACTIVE' && 'Inactivos'}
          </button>
        ))}
      </div>

      {/* 4. Dropdown Selectors Group */}
      <div className="filter-select-group">
        {/* Tipo de cliente */}
        <div className="filter-select-item" style={{ minWidth: 160 }}>
          <CustomSelect
            options={TYPE_OPTIONS}
            value={filters.customerType || 'ALL'}
            onChange={(val) => onFilterChange('customerType', val)}
            placeholder="Tipo cliente"
            size="sm"
            icon={<AppIcon name="customers" size={14} color="var(--navy)" />}
          />
        </div>

        {/* Categoría */}
        <div className="filter-select-item" style={{ minWidth: 170 }}>
          <CustomSelect
            options={CATEGORY_OPTIONS}
            value={filters.category || 'ALL'}
            onChange={(val) => onFilterChange('category', val)}
            placeholder="Categoría"
            size="sm"
            icon={<AppIcon name="products" size={14} color="#64748b" />}
          />
        </div>

        {/* Lista de precios */}
        <div className="filter-select-item" style={{ minWidth: 160 }}>
          <CustomSelect
            options={PRICE_LIST_OPTIONS}
            value={filters.priceList || 'ALL'}
            onChange={(val) => onFilterChange('priceList', val)}
            placeholder="Lista precios"
            size="sm"
            icon={<AppIcon name="wallet" size={14} color="var(--red)" />}
          />
        </div>

        {/* Ciudad */}
        <div className="filter-select-item" style={{ minWidth: 155 }}>
          <CustomSelect
            options={cityOptions}
            value={filters.city || 'ALL'}
            onChange={(val) => onFilterChange('city', val)}
            placeholder="Ciudad"
            size="sm"
            icon={<AppIcon name="warehouse" size={14} color="#64748b" />}
          />
        </div>

        {/* Actividad / Saldo */}
        <div className="filter-select-item" style={{ minWidth: 175 }}>
          <CustomSelect
            options={ACTIVITY_OPTIONS}
            value={currentActivityVal}
            onChange={(val) => {
              if (val === 'WITH_PURCHASES') {
                onFilterChange('hasPurchases', true)
                onFilterChange('hasBalance', undefined)
              } else if (val === 'WITHOUT_PURCHASES') {
                onFilterChange('hasPurchases', false)
                onFilterChange('hasBalance', undefined)
              } else if (val === 'WITH_BALANCE') {
                onFilterChange('hasBalance', true)
                onFilterChange('hasPurchases', undefined)
              } else {
                onFilterChange('hasPurchases', undefined)
                onFilterChange('hasBalance', undefined)
              }
            }}
            placeholder="Actividad"
            size="sm"
            icon={<AppIcon name="cashRegisters" size={14} color="#64748b" />}
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
          title="Limpiar todos los filtros"
          style={{ marginLeft: 'auto' }}
        >
          <AppIcon name="close" size={12} />
          <span>Limpiar</span>
        </button>
      )}
    </div>
  )
}
