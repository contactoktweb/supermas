'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { DateRangeFilter } from '@/components/ui/DateRangeFilter'
import { SaleFilterParams, SaleStatus, PaymentMethod, SaleDocumentType } from '../types'

interface SalesFiltersProps {
  filters: SaleFilterParams
  locations: { id: string; name: string }[]
  sellers: string[]
  onFilterChange: (key: keyof SaleFilterParams, value: any) => void
  onResetFilters: () => void
}

const STATUS_TABS: { id: SaleStatus | 'ALL'; label: string }[] = [
  { id: 'ALL', label: 'Todas' },
  { id: 'CONFIRMED', label: 'Confirmadas' },
  { id: 'INVOICED', label: 'Facturadas' },
  { id: 'PENDING', label: 'Pendientes' },
  { id: 'CANCELLED', label: 'Anuladas' },
]

export function SalesFilters({
  filters,
  locations,
  sellers,
  onFilterChange,
  onResetFilters,
}: SalesFiltersProps) {
  const activeCount = [
    Boolean(filters.query),
    filters.locationId && filters.locationId !== 'ALL',
    filters.sellerName && filters.sellerName !== 'ALL',
    filters.paymentMethod && filters.paymentMethod !== 'ALL',
    filters.documentType && filters.documentType !== 'ALL',
    filters.status && filters.status !== 'ALL',
    Boolean(filters.startDate || filters.endDate),
  ].filter(Boolean).length

  return (
    <div className="table-toolbar page-enter" style={{ flexDirection: 'column', gap: 12 }}>
      {/* Top Filter Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          flexWrap: 'wrap',
        }}
      >
        {/* 1. Global Search Box */}
        <div
          className="search-box filter-search-primary"
          style={{ flex: '1 1 240px', minWidth: 200 }}
        >
          <AppIcon name="search" size={16} />
          <input
            value={filters.query || ''}
            onChange={(e) => onFilterChange('query', e.target.value)}
            placeholder="Buscar por venta, cliente, documento o vendedor..."
            aria-label="Buscar ventas"
          />
          {filters.query && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => onFilterChange('query', '')}
              aria-label="Limpiar búsqueda"
            >
              <AppIcon name="closeSimple" size={14} />
            </button>
          )}
        </div>

        {/* 2. Status Segmented Buttons */}
        <div className="segmented" style={{ flexShrink: 0 }}>
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={(filters.status || 'ALL') === tab.id ? 'selected' : ''}
              onClick={() => onFilterChange('status', tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 3. Date Range Filter */}
        <div style={{ flexShrink: 0 }}>
          <DateRangeFilter
            startDate={filters.startDate}
            endDate={filters.endDate}
            onChange={(range) => {
              onFilterChange('startDate', range.startDate)
              onFilterChange('endDate', range.endDate)
            }}
            placeholder="Fecha venta"
          />
        </div>
      </div>

      {/* Bottom Filter Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          flexWrap: 'wrap',
        }}
      >
        {/* Location Select */}
        <div style={{ width: 175, flexShrink: 0 }}>
          <CustomSelect
            value={filters.locationId || 'ALL'}
            onChange={(val) => onFilterChange('locationId', val)}
            options={[
              { value: 'ALL', label: 'Todas las bodegas' },
              ...locations.map((l) => ({ value: l.id, label: l.name })),
            ]}
            placeholder="Filtrar por bodega"
          />
        </div>

        {/* Seller Select */}
        <div style={{ width: 165, flexShrink: 0 }}>
          <CustomSelect
            value={filters.sellerName || 'ALL'}
            onChange={(val) => onFilterChange('sellerName', val)}
            options={[
              { value: 'ALL', label: 'Todos los vendedores' },
              ...sellers.map((s) => ({ value: s, label: s })),
            ]}
            placeholder="Filtrar por vendedor"
          />
        </div>

        {/* Payment Method Select */}
        <div style={{ width: 160, flexShrink: 0 }}>
          <CustomSelect
            value={filters.paymentMethod || 'ALL'}
            onChange={(val) => onFilterChange('paymentMethod', val)}
            options={[
              { value: 'ALL', label: 'Cualquier pago' },
              { value: 'EFECTIVO', label: 'Efectivo' },
              { value: 'TRANSFERENCIA', label: 'Transferencia' },
              { value: 'TARJETA', label: 'Tarjeta Débito/Crédito' },
              { value: 'CREDITO', label: 'Crédito' },
              { value: 'MIXTO', label: 'Pago Mixto' },
            ]}
            placeholder="Método de pago"
          />
        </div>

        {/* Document Type Select */}
        <div style={{ width: 175, flexShrink: 0 }}>
          <CustomSelect
            value={filters.documentType || 'ALL'}
            onChange={(val) => onFilterChange('documentType', val)}
            options={[
              { value: 'ALL', label: 'Todos los documentos' },
              { value: 'FACTURA_ELECTRONICA', label: 'Factura Electrónica' },
              { value: 'FACTURA_POS', label: 'Factura POS' },
              { value: 'REMISION', label: 'Remisión' },
              { value: 'NINGUNO', label: 'Sin documento' },
            ]}
            placeholder="Tipo de documento"
          />
        </div>

        {/* Reset Filters Button */}
        {activeCount > 0 && (
          <button
            type="button"
            className="filter-button"
            onClick={onResetFilters}
            style={{
              color: 'var(--red)',
              borderColor: 'rgba(254, 17, 12, 0.25)',
              marginLeft: 'auto',
            }}
          >
            <AppIcon name="refresh" size={13} />
            <span>Limpiar filtros ({activeCount})</span>
          </button>
        )}
      </div>
    </div>
  )
}
