'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { DateRangeFilter } from '@/components/ui/DateRangeFilter'
import {
  PurchaseFilterParams,
  PurchaseStatus,
  PurchasePaymentType,
  SupplierOption,
} from '../types'
import { LocationOption } from '../services/location.service'

interface PurchaseFiltersProps {
  filters: PurchaseFilterParams
  onFilterChange: (key: keyof PurchaseFilterParams, value: any) => void
  onResetFilters: () => void
  suppliers: SupplierOption[]
  locations: LocationOption[]
}

const STATUS_OPTIONS: { value: PurchaseStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todos los estados' },
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'PENDING_RECEPTION', label: 'Por recibir' },
  { value: 'RECEIVED', label: 'Recibida' },
  { value: 'PAYMENT_PENDING', label: 'Pendiente pago' },
  { value: 'PAID', label: 'Pagada' },
  { value: 'CANCELLED', label: 'Anulada' },
]

export function PurchaseFilters({
  filters,
  onFilterChange,
  onResetFilters,
  suppliers,
  locations,
}: PurchaseFiltersProps) {
  const hasActiveFilters = Boolean(
    filters.query?.trim() ||
      (filters.supplierId && filters.supplierId !== 'ALL') ||
      (filters.locationId && filters.locationId !== 'ALL') ||
      (filters.status && filters.status !== 'ALL') ||
      (filters.paymentType && filters.paymentType !== 'ALL') ||
      filters.startDate ||
      filters.endDate
  )

  const paymentType = filters.paymentType || 'ALL'

  const supplierOptions = [
    { value: 'ALL', label: 'Todos los proveedores' },
    ...suppliers.map((s) => ({
      value: s.id,
      label: s.name,
      description: s.nit ? `NIT: ${s.nit}` : undefined,
    })),
  ]

  const locationOptions = [
    { value: 'ALL', label: 'Todas las bodegas' },
    ...locations.map((l) => ({
      value: l.id,
      label: l.name,
      description: l.code,
    })),
  ]

  return (
    <div
      className="toolbar inventory-toolbar products-toolbar page-enter"
      role="search"
      aria-label="Filtros de compras"
    >
      {/* 1. Main Search (Purchase #, Invoice #, Notes) */}
      <div className="search-box wide products-search-box">
        <AppIcon name="search" size={16} />
        <input
          value={filters.query || ''}
          onChange={(e) => onFilterChange('query', e.target.value)}
          placeholder="Buscar por N° compra (COM-...), factura proveedor o notas..."
          aria-label="Buscar compras"
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

      {/* 2. Quick Payment Type Selector: Todos | Contado | Crédito */}
      <div
        className="period-segmented-tabs"
        role="tablist"
        aria-label="Filtro rápido de tipo de pago"
        style={{ flexShrink: 0 }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={paymentType === 'ALL'}
          className={`period-tab-btn ${paymentType === 'ALL' ? 'selected' : ''}`}
          onClick={() => onFilterChange('paymentType', 'ALL')}
        >
          <span>Todos</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={paymentType === 'CONTADO'}
          className={`period-tab-btn ${paymentType === 'CONTADO' ? 'selected' : ''}`}
          onClick={() => onFilterChange('paymentType', 'CONTADO')}
        >
          <AppIcon name="receipt" size={12} />
          <span>Contado</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={paymentType === 'CREDITO'}
          className={`period-tab-btn ${paymentType === 'CREDITO' ? 'selected' : ''}`}
          onClick={() => onFilterChange('paymentType', 'CREDITO')}
        >
          <AppIcon name="wallet" size={12} />
          <span>Crédito</span>
        </button>
      </div>

      {/* 3. Dropdowns Group */}
      <div className="filter-select-group">
        {/* Proveedor */}
        <div className="filter-select-item" style={{ minWidth: 175 }}>
          <CustomSelect
            options={supplierOptions}
            value={filters.supplierId || 'ALL'}
            onChange={(val) => onFilterChange('supplierId', val)}
            placeholder="Proveedor"
            size="sm"
            icon={<AppIcon name="suppliers" size={14} color="var(--navy)" />}
          />
        </div>

        {/* Bodega Destino */}
        <div className="filter-select-item" style={{ minWidth: 170 }}>
          <CustomSelect
            options={locationOptions}
            value={filters.locationId || 'ALL'}
            onChange={(val) => onFilterChange('locationId', val)}
            placeholder="Bodega destino"
            size="sm"
            icon={<AppIcon name="warehouse" size={14} color="#64748b" />}
          />
        </div>

        {/* Estado */}
        <div className="filter-select-item" style={{ minWidth: 165 }}>
          <CustomSelect
            options={STATUS_OPTIONS}
            value={filters.status || 'ALL'}
            onChange={(val) => onFilterChange('status', val)}
            placeholder="Estado"
            size="sm"
            icon={<AppIcon name="purchases" size={14} color="var(--red)" />}
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
          placeholder="Fecha compra"
          size="sm"
        />
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
