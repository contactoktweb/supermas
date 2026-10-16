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
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 12,
        padding: '14px 18px',
        marginBottom: 16,
      }}
    >
      {/* 1. Fila Principal: Buscador + Búsqueda por Documento + Selector de Estado Elegante */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          width: '100%',
        }}
      >
        {/* Buscador General */}
        <div className="search-box wide products-search-box" style={{ flex: '1 1 280px', minWidth: 260 }}>
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

        {/* Búsqueda Directa por Documento */}
        <div
          className="search-box filter-search-secondary"
          style={{ width: 180, flexShrink: 0 }}
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

        {/* Selector Segmentado de Estado (Estilo SaaS estándar Super Más: gris suave y azul marino seleccionado) */}
        <div
          className="period-segmented-tabs"
          role="tablist"
          aria-label="Filtrar por estado"
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

        {/* Botón Limpiar Filtros cuando hay filtros activos */}
        {hasActiveFilters && (
          <button
            type="button"
            className="outline-button compact reset-filter-btn"
            onClick={onResetFilters}
            title="Limpiar todos los filtros aplicados"
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--red)',
              borderColor: '#fca5a5',
              background: '#fef2f2',
            }}
          >
            <AppIcon name="close" size={12} color="var(--red)" />
            <span>Limpiar</span>
          </button>
        )}
      </div>

      {/* 2. Fila Secundaria: Filtros Avanzados (Tipo, Categoría, Lista, Ciudad, Actividad, Fechas) */}
      <div
        className="filter-select-group"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          width: '100%',
          paddingTop: 10,
          borderTop: '1px solid #f1f5f9',
        }}
      >
        {/* Tipo de cliente */}
        <div className="filter-select-item" style={{ minWidth: 155, flex: '1 1 155px' }}>
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
        <div className="filter-select-item" style={{ minWidth: 165, flex: '1 1 165px' }}>
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
        <div className="filter-select-item" style={{ minWidth: 155, flex: '1 1 155px' }}>
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
        <div className="filter-select-item" style={{ minWidth: 150, flex: '1 1 150px' }}>
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
        <div className="filter-select-item" style={{ minWidth: 170, flex: '1 1 170px' }}>
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
        <div style={{ flex: '1 1 200px', minWidth: 180 }}>
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
      </div>
    </div>
  )
}
