'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { DateRangeFilter } from '@/components/ui/DateRangeFilter'
import { RemissionStatus } from '../types'
import { db } from '@/lib/supabase'

interface RemissionFiltersProps {
  searchQuery: string
  onSearchChange: (val: string) => void
  activeTab: string
  onTabChange: (tab: string) => void
  selectedStatus: RemissionStatus | 'ALL'
  onStatusChange: (status: RemissionStatus | 'ALL') => void
  selectedLocation: string
  onLocationChange: (loc: string) => void
  dateFrom: string
  dateTo: string
  onDateRangeChange: (from: string, to: string) => void
  onResetFilters: () => void
}

const TABS = [
  'Todas',
  'Borrador',
  'Creadas',
  'En tránsito',
  'Entregadas',
  'Anuladas',
]

export function RemissionFilters({
  searchQuery,
  onSearchChange,
  activeTab,
  onTabChange,
  selectedStatus,
  onStatusChange,
  selectedLocation,
  onLocationChange,
  dateFrom,
  dateTo,
  onDateRangeChange,
  onResetFilters,
}: RemissionFiltersProps) {
  const locations = db.locations || []

  const activeFiltersCount = [
    Boolean(searchQuery),
    activeTab !== 'Todas',
    selectedStatus !== 'ALL',
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
            placeholder="Buscar por remisión, cliente, NIT, venta o conductor..."
            aria-label="Buscar remisiones"
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
            placeholder="Fecha remisión"
          />
        </div>
      </div>

      {/* Bottom Filter Row: Status + Location + Reset */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          flexWrap: 'wrap',
        }}
      >
        {/* Status Select */}
        <div style={{ width: 180, flexShrink: 0 }}>
          <CustomSelect
            value={selectedStatus}
            onChange={(val) => onStatusChange(val as RemissionStatus | 'ALL')}
            options={[
              { value: 'ALL', label: 'Todos los estados' },
              { value: 'DRAFT', label: 'Borrador' },
              { value: 'CREATED', label: 'Creada / Pendiente' },
              { value: 'DISPATCHED', label: 'En tránsito' },
              { value: 'DELIVERED', label: 'Entregada' },
              { value: 'CANCELLED', label: 'Anulada' },
            ]}
            placeholder="Estado de remisión"
          />
        </div>

        {/* Location Select */}
        <div style={{ width: 190, flexShrink: 0 }}>
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
            placeholder="Bodega de despacho"
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
