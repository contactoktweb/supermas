'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { DateRangeFilter } from '@/components/ui/DateRangeFilter'
import { InvoiceType, DIANStatus } from '../types'
import { db } from '@/lib/supabase'

interface InvoiceFiltersProps {
  searchQuery: string
  onSearchChange: (val: string) => void
  activeTab: string
  onTabChange: (tab: string) => void
  selectedType: InvoiceType | 'ALL'
  onTypeChange: (type: InvoiceType | 'ALL') => void
  selectedDianStatus: DIANStatus | 'ALL'
  onDianStatusChange: (status: DIANStatus | 'ALL') => void
  selectedLocation: string
  onLocationChange: (loc: string) => void
  dateFrom: string
  dateTo: string
  onDateRangeChange: (from: string, to: string) => void
  onResetFilters: () => void
}

const TABS = [
  'Todas',
  'Electrónicas',
  'Facturas POS',
  'Pendientes DIAN',
  'Aceptadas DIAN',
  'Rechazadas DIAN',
  'Notas Crédito',
  'Anuladas',
]

export function InvoiceFilters({
  searchQuery,
  onSearchChange,
  activeTab,
  onTabChange,
  selectedType,
  onTypeChange,
  selectedDianStatus,
  onDianStatusChange,
  selectedLocation,
  onLocationChange,
  dateFrom,
  dateTo,
  onDateRangeChange,
  onResetFilters,
}: InvoiceFiltersProps) {
  const locations = db.locations || []

  const activeFiltersCount = [
    Boolean(searchQuery),
    activeTab !== 'Todas',
    selectedType !== 'ALL',
    selectedDianStatus !== 'ALL',
    selectedLocation !== 'ALL',
    Boolean(dateFrom || dateTo),
  ].filter(Boolean).length

  return (
    <div className="table-toolbar page-enter" style={{ flexDirection: 'column', gap: 12 }}>
      {/* Top Filter Row: Search + Status Segmented + Date Range */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          flexWrap: 'wrap',
        }}
      >
        {/* Search input */}
        <div
          className="search-box filter-search-primary"
          style={{ flex: '1 1 250px', minWidth: 200 }}
        >
          <AppIcon name="search" size={16} />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por factura, cliente, NIT, CUFE o venta..."
            aria-label="Buscar facturas"
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => onSearchChange('')}
              aria-label="Limpiar búsqueda"
            >
              <AppIcon name="closeSimple" size={14} />
            </button>
          )}
        </div>

        {/* Segmented Tab Buttons */}
        <div
          className="segmented"
          style={{
            flexShrink: 0,
            overflowX: 'auto',
            maxWidth: '100%',
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? 'selected' : ''}
              onClick={() => onTabChange(tab)}
              style={{ whiteSpace: 'nowrap' }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Date Range Picker */}
        <div style={{ flexShrink: 0 }}>
          <DateRangeFilter
            startDate={dateFrom}
            endDate={dateTo}
            onChange={(range) => onDateRangeChange(range.startDate || '', range.endDate || '')}
            placeholder="Fecha emisión"
          />
        </div>
      </div>

      {/* Bottom Filter Row: Type + DIAN Status + Warehouse + Reset */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          flexWrap: 'wrap',
        }}
      >
        {/* Document Type Select */}
        <div style={{ width: 190, flexShrink: 0 }}>
          <CustomSelect
            value={selectedType}
            onChange={(val) => onTypeChange(val as InvoiceType | 'ALL')}
            options={[
              { value: 'ALL', label: 'Todos los tipos' },
              { value: 'ELECTRONICA', label: 'Factura Electrónica' },
              { value: 'POS', label: 'Factura POS' },
              { value: 'NOTA_CREDITO', label: 'Nota Crédito' },
              { value: 'NOTA_DEBITO', label: 'Nota Débito' },
              { value: 'DOCUMENTO_EQUIVALENTE', label: 'Doc. Equivalente' },
            ]}
            placeholder="Tipo de comprobante"
          />
        </div>

        {/* DIAN Status Select */}
        <div style={{ width: 180, flexShrink: 0 }}>
          <CustomSelect
            value={selectedDianStatus}
            onChange={(val) => onDianStatusChange(val as DIANStatus | 'ALL')}
            options={[
              { value: 'ALL', label: 'Todos estados DIAN' },
              { value: 'ACEPTADA', label: 'Aceptada DIAN' },
              { value: 'PENDIENTE', label: 'Pendiente DIAN' },
              { value: 'RECHAZADA', label: 'Rechazada DIAN' },
              { value: 'NO_APLICA', label: 'No aplica' },
            ]}
            placeholder="Estado DIAN"
          />
        </div>

        {/* Location Select */}
        <div style={{ width: 185, flexShrink: 0 }}>
          <CustomSelect
            value={selectedLocation}
            onChange={onLocationChange}
            options={[
              { value: 'ALL', label: 'Todas las bodegas' },
              ...locations.map((loc) => ({
                value: loc.id,
                label: loc.name,
              })),
            ]}
            placeholder="Filtrar por bodega"
          />
        </div>

        {/* Reset Filters button */}
        {activeFiltersCount > 0 && (
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
            <span>Limpiar filtros ({activeFiltersCount})</span>
          </button>
        )}
      </div>
    </div>
  )
}
