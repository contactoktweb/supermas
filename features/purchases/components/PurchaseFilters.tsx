'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
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
  { value: 'PENDING_RECEPTION', label: 'Pendiente recepción' },
  { value: 'RECEIVED', label: 'Recibida' },
  { value: 'PAYMENT_PENDING', label: 'Pendiente pago' },
  { value: 'PAID', label: 'Pagada' },
  { value: 'CANCELLED', label: 'Anulada' },
]

const PAYMENT_TYPE_OPTIONS: { value: PurchasePaymentType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todo tipo de pago' },
  { value: 'CONTADO', label: 'Contado' },
  { value: 'CREDITO', label: 'Crédito' },
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
      {/* 1. Main Search (Purchase #, Invoice #) */}
      <div className="search-box wide products-search-box">
        <AppIcon name="search" size={16} />
        <input
          value={filters.query || ''}
          onChange={(e) => onFilterChange('query', e.target.value)}
          placeholder="Buscar por N° compra, factura proveedor o notas..."
          aria-label="Buscar compras"
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

      {/* 2. Filtro Proveedor */}
      <div className="filter-select-wrap">
        <CustomSelect
          value={filters.supplierId || 'ALL'}
          onChange={(val) => onFilterChange('supplierId', val)}
          options={supplierOptions}
          size="sm"
          placeholder="Proveedor"
        />
      </div>

      {/* 3. Filtro Bodega Destino */}
      <div className="filter-select-wrap">
        <CustomSelect
          value={filters.locationId || 'ALL'}
          onChange={(val) => onFilterChange('locationId', val)}
          options={locationOptions}
          size="sm"
          placeholder="Bodega destino"
        />
      </div>

      {/* 4. Filtro Estado */}
      <div className="filter-select-wrap">
        <CustomSelect
          value={filters.status || 'ALL'}
          onChange={(val) => onFilterChange('status', val)}
          options={STATUS_OPTIONS}
          size="sm"
          placeholder="Estado"
        />
      </div>

      {/* 5. Filtro Tipo de Pago (Contado / Crédito) */}
      <div className="filter-select-wrap">
        <CustomSelect
          value={filters.paymentType || 'ALL'}
          onChange={(val) => onFilterChange('paymentType', val)}
          options={PAYMENT_TYPE_OPTIONS}
          size="sm"
          placeholder="Tipo de pago"
        />
      </div>

      {/* 6. Fecha Desde */}
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

      {/* 7. Reset filters button */}
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
