'use client'

import React, { useMemo } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect, SelectOption } from '@/components/ui/CustomSelect'
import { ReportPeriod } from '../types'
import { DatePicker } from '@/components/ui/DatePicker'

interface ReportFilterBarProps {
  searchQuery: string
  setSearchQuery: (q: string) => void
  searchPlaceholder?: string
  categoryId?: string
  setCategoryId?: (c: string) => void
  categories?: { value: string; label: string }[]
  period?: ReportPeriod
  startDate?: string
  setStartDate?: (d: string) => void
  endDate?: string
  setEndDate?: (d: string) => void
  showWarehouseComparison?: boolean
  locationId?: string
  secondLocationId?: string
  setSecondLocationId?: (l: string) => void
  locations?: { value: string; label: string }[]
  onReset?: () => void
}

export function ReportFilterBar({
  searchQuery,
  setSearchQuery,
  searchPlaceholder = 'Buscar en reporte...',
  categoryId,
  setCategoryId,
  categories = [],
  period,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  showWarehouseComparison = false,
  locationId,
  secondLocationId,
  setSecondLocationId,
  locations = [],
  onReset,
}: ReportFilterBarProps) {
  const categoryOptions: SelectOption[] = useMemo(() => {
    return [
      { value: 'ALL', label: 'Todas las Categorías' },
      ...categories.map((c) => ({ value: c.value, label: c.label })),
    ]
  }, [categories])

  const warehouseBOptions: SelectOption[] = useMemo(() => {
    return locations.map((loc) => ({ value: loc.value, label: loc.label }))
  }, [locations])

  return (
    <div className="toolbar inventory-toolbar products-toolbar page-enter" style={{ marginBottom: 20 }}>
      {/* Search input */}
      <div className="search-box wide products-search-box">
        <AppIcon name="search" size={16} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
        />
        {searchQuery && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={() => setSearchQuery('')}
            aria-label="Limpiar búsqueda"
          >
            <AppIcon name="close" size={14} />
          </button>
        )}
      </div>

      <div className="filter-select-group">
        {/* Category filter if applicable */}
        {setCategoryId && categories.length > 0 && (
          <div className="filter-select-item" style={{ minWidth: 175 }}>
            <CustomSelect
              options={categoryOptions}
              value={categoryId || 'ALL'}
              onChange={(val) => setCategoryId(val)}
              placeholder="Categoría"
              size="sm"
              icon={<AppIcon name="layers" size={14} color="#64748b" />}
            />
          </div>
        )}

        {/* Warehouse Comparison: Select Bodega B */}
        {showWarehouseComparison && setSecondLocationId && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">VS</span>
            <div className="filter-select-item" style={{ minWidth: 180 }}>
              <CustomSelect
                options={warehouseBOptions}
                value={secondLocationId || (locations[1]?.value ?? '')}
                onChange={(val) => setSecondLocationId(val)}
                placeholder="Comparar con Bodega"
                size="sm"
                icon={<AppIcon name="warehouse" size={14} color="#64748b" />}
              />
            </div>
          </div>
        )}

        {/* Date pickers if custom range */}
        {period === 'CUSTOM' && setStartDate && setEndDate && (
          <div className="flex items-center gap-2">
            <DatePicker
              value={startDate || ''}
              aria-label="Fecha inicial"
              size="sm"
              onChange={(value) => setStartDate(value)}
            />
            <span className="text-slate-400 text-xs">hasta</span>
            <DatePicker
              value={endDate || ''}
              aria-label="Fecha final"
              size="sm"
              onChange={(value) => setEndDate(value)}
            />
          </div>
        )}
      </div>

      {/* Reset button */}
      {onReset && (searchQuery || (categoryId && categoryId !== 'ALL')) && (
        <button
          type="button"
          onClick={onReset}
          className="reset-filters-pill"
          title="Limpiar filtros del reporte"
        >
          <AppIcon name="close" size={13} />
          <span>Limpiar filtros</span>
        </button>
      )}
    </div>
  )
}
