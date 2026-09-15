'use client'

import React, { useState, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { TaxFilters as FilterState, TaxType, TaxStatus } from '../types'
import { useDebounce } from '@/features/warehouses/hooks/useDebounce'
import { CustomSelect } from '@/components/ui/CustomSelect'

interface TaxFiltersProps {
  filters: FilterState
  onFilterChange: (filters: FilterState) => void
  onClearFilters: () => void
}

export function TaxFilters({
  filters,
  onFilterChange,
  onClearFilters,
}: TaxFiltersProps) {
  const [localSearch, setLocalSearch] = useState(filters.query || '')
  const debouncedSearch = useDebounce(localSearch, 280)

  useEffect(() => {
    onFilterChange({ ...filters, query: debouncedSearch, page: 1 })
  }, [debouncedSearch])

  const hasActiveFilters = Boolean(
    (filters.query && filters.query.length > 0) ||
      (filters.type && filters.type !== 'ALL') ||
      (filters.status && filters.status !== 'ALL') ||
      (filters.vigencia && filters.vigencia !== 'ALL') ||
      (filters.sortBy && filters.sortBy !== 'RATE_DESC')
  )

  const typeOptions = [
    { value: 'ALL', label: 'Todos los tipos' },
    { value: 'IVA', label: 'IVA' },
    { value: 'EXCLUIDO', label: 'Excluido de IVA' },
    { value: 'NO_GRAVADO', label: 'No Gravado' },
    { value: 'OTRO', label: 'Otros (INC, etc.)' },
  ]

  const statusOptions = [
    { value: 'ALL', label: 'Todos los estados' },
    { value: 'ACTIVE', label: 'Activos' },
    { value: 'INACTIVE', label: 'Inactivos' },
  ]

  const vigenciaOptions = [
    { value: 'ALL', label: 'Todas las vigencias' },
    { value: 'ACTIVE', label: 'Vigentes hoy' },
    { value: 'EXPIRED', label: 'Vencidos / Históricos' },
    { value: 'FUTURE', label: 'Futuras vigencias' },
  ]

  const sortOptions = [
    { value: 'RATE_DESC', label: 'Mayor tarifa (%)' },
    { value: 'RATE_ASC', label: 'Menor tarifa (%)' },
    { value: 'NAME_ASC', label: 'Nombre (A - Z)' },
    { value: 'NAME_DESC', label: 'Nombre (Z - A)' },
    { value: 'CODE_ASC', label: 'Código (A - Z)' },
    { value: 'PRODUCTS_DESC', label: 'Más productos vinculados' },
  ]

  return (
    <div className="warehouse-filters-container">
      <div className="toolbar inventory-toolbar">
        <div className="search-box wide">
          <AppIcon name="search" size={16} />
          <input
            type="search"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Buscar por código, nombre o descripción..."
            aria-label="Buscar configuración de impuesto"
          />
          {localSearch && (
            <button
              type="button"
              className="icon-button clear-search"
              onClick={() => setLocalSearch('')}
              aria-label="Limpiar búsqueda"
            >
              <AppIcon name="close" size={14} />
            </button>
          )}
        </div>

        <div style={{ minWidth: 155 }}>
          <CustomSelect
            size="sm"
            icon={<AppIcon name="taxes" size={13} />}
            value={filters.type || 'ALL'}
            options={typeOptions}
            onChange={(val) =>
              onFilterChange({ ...filters, type: val as 'ALL' | TaxType, page: 1 })
            }
          />
        </div>

        <div style={{ minWidth: 135 }}>
          <CustomSelect
            size="sm"
            icon={<AppIcon name="check" size={13} />}
            value={filters.status || 'ALL'}
            options={statusOptions}
            onChange={(val) =>
              onFilterChange({ ...filters, status: val as 'ALL' | TaxStatus, page: 1 })
            }
          />
        </div>

        <div style={{ minWidth: 150 }}>
          <CustomSelect
            size="sm"
            icon={<AppIcon name="calendar" size={13} />}
            value={filters.vigencia || 'ALL'}
            options={vigenciaOptions}
            onChange={(val) =>
              onFilterChange({
                ...filters,
                vigencia: val as 'ALL' | 'ACTIVE' | 'EXPIRED' | 'FUTURE',
                page: 1,
              })
            }
          />
        </div>

        <div style={{ minWidth: 165 }}>
          <CustomSelect
            size="sm"
            icon={<AppIcon name="sort" size={13} />}
            value={filters.sortBy || 'RATE_DESC'}
            options={sortOptions}
            onChange={(val) =>
              onFilterChange({ ...filters, sortBy: val as any, page: 1 })
            }
          />
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            className="outline-button clear-filters-button"
            onClick={() => {
              setLocalSearch('')
              onClearFilters()
            }}
            title="Restablecer todos los filtros"
          >
            <AppIcon name="refresh" size={14} />
            <span>Limpiar</span>
          </button>
        )}
      </div>
    </div>
  )
}
