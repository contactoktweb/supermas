'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { TransferFilterParams, TransferStatus, TransferDirection } from '../types'

interface TransferFiltersProps {
  filters: TransferFilterParams
  onFilterChange: (key: keyof TransferFilterParams, value: any) => void
  onResetFilters: () => void
}

const STATUS_OPTIONS: { value: TransferStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todos los estados' },
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'IN_TRANSIT', label: 'En tránsito' },
  { value: 'RECEIVED', label: 'Recibida' },
  { value: 'REJECTED', label: 'Rechazada' },
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
  { value: 'user-03', label: 'Ana María Orozco (POS Centro)' },
  { value: 'user-04', label: 'Carlos Mario Ruiz (Punto Sur)' },
  { value: 'user-05', label: 'Daniel Restrepo (Auditoría)' },
]

export function TransferFilters({
  filters,
  onFilterChange,
  onResetFilters,
}: TransferFiltersProps) {
  const hasActiveFilters = Boolean(
    filters.query?.trim() ||
      filters.code?.trim() ||
      (filters.originLocationId && filters.originLocationId !== 'ALL') ||
      (filters.destinationLocationId && filters.destinationLocationId !== 'ALL') ||
      (filters.direction && filters.direction !== 'ALL') ||
      (filters.status && filters.status !== 'ALL') ||
      (filters.userId && filters.userId !== 'ALL') ||
      filters.startDate ||
      filters.endDate
  )

  const direction = filters.direction || 'ALL'

  return (
    <div
      className="toolbar inventory-toolbar products-toolbar page-enter"
      role="search"
      aria-label="Filtros de transferencias"
    >
      {/* 1. Main Search (Code, Product, User, Notes) */}
      <div className="search-box wide products-search-box">
        <AppIcon name="search" size={16} />
        <input
          value={filters.query || ''}
          onChange={(e) => onFilterChange('query', e.target.value)}
          placeholder="Buscar por código (TR-...), producto, SKU o responsable..."
          aria-label="Buscar transferencias"
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

      {/* 2. Quick Direction Selector: Todas | Entrantes | Salientes */}
      <div
        className="period-segmented-tabs"
        role="tablist"
        aria-label="Filtro rápido de dirección"
        style={{ flexShrink: 0 }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={direction === 'ALL'}
          className={`period-tab-btn ${direction === 'ALL' ? 'selected' : ''}`}
          onClick={() => onFilterChange('direction', 'ALL')}
        >
          <span>Todas</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={direction === 'INBOUND'}
          className={`period-tab-btn ${direction === 'INBOUND' ? 'selected' : ''}`}
          onClick={() => onFilterChange('direction', 'INBOUND')}
        >
          <AppIcon name="arrowDownLeft" size={12} />
          <span>Entrantes</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={direction === 'OUTBOUND'}
          className={`period-tab-btn ${direction === 'OUTBOUND' ? 'selected' : ''}`}
          onClick={() => onFilterChange('direction', 'OUTBOUND')}
        >
          <AppIcon name="arrowUpRight" size={12} />
          <span>Salientes</span>
        </button>
      </div>

      {/* 3. Dropdowns */}
      <div className="filter-select-group">
        {/* Bodega Origen */}
        <div className="filter-select-item" style={{ minWidth: 175 }}>
          <CustomSelect
            options={LOCATION_OPTIONS}
            value={filters.originLocationId || 'ALL'}
            onChange={(val) => onFilterChange('originLocationId', val)}
            placeholder="Bodega origen"
            size="sm"
            icon={<AppIcon name="warehouse" size={14} color="#64748b" />}
          />
        </div>

        {/* Bodega Destino */}
        <div className="filter-select-item" style={{ minWidth: 175 }}>
          <CustomSelect
            options={LOCATION_OPTIONS}
            value={filters.destinationLocationId || 'ALL'}
            onChange={(val) => onFilterChange('destinationLocationId', val)}
            placeholder="Bodega destino"
            size="sm"
            icon={<AppIcon name="warehouse" size={14} color="var(--navy)" />}
          />
        </div>

        {/* Estado */}
        <div className="filter-select-item" style={{ minWidth: 160 }}>
          <CustomSelect
            options={STATUS_OPTIONS}
            value={filters.status || 'ALL'}
            onChange={(val) => onFilterChange('status', val)}
            placeholder="Estado"
            size="sm"
            icon={<AppIcon name="transfers" size={14} color="var(--red)" />}
          />
        </div>

        {/* Usuario responsable */}
        <div className="filter-select-item" style={{ minWidth: 170 }}>
          <CustomSelect
            options={USER_OPTIONS}
            value={filters.userId || 'ALL'}
            onChange={(val) => onFilterChange('userId', val)}
            placeholder="Responsable"
            size="sm"
            icon={<AppIcon name="users" size={14} color="#64748b" />}
          />
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

      {/* 4. Reset Button */}
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
