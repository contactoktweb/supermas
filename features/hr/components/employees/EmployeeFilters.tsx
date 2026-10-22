'use client'

import { useEffect, useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect, type SelectOption } from '@/components/ui/CustomSelect'
import { CONTRACT_TYPE_LABELS, EMPLOYEE_STATUS_LABELS, toSelectOptions } from '../../constants'
import type { EmployeeFilters as EmployeeFiltersType } from '../../types'

const SEARCH_DEBOUNCE_MS = 300

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'VIGENTES', label: 'Empleados vigentes' },
  { value: 'ALL', label: 'Todos (incluye retirados)' },
  ...toSelectOptions(EMPLOYEE_STATUS_LABELS),
]

const CONTRACT_OPTIONS: SelectOption[] = [{ value: 'ALL', label: 'Todos los contratos' }, ...toSelectOptions(CONTRACT_TYPE_LABELS)]

interface EmployeeFiltersProps {
  filters: EmployeeFiltersType
  areaOptions: SelectOption[]
  positionOptions: SelectOption[]
  locationOptions: SelectOption[]
  onChange: (patch: Partial<EmployeeFiltersType>) => void
  onReset: () => void
}

export function EmployeeFilters({ filters, areaOptions, positionOptions, locationOptions, onChange, onReset }: EmployeeFiltersProps) {
  const [search, setSearch] = useState(filters.query)

  useEffect(() => {
    setSearch(filters.query)
  }, [filters.query])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== filters.query) onChange({ query: search })
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search, filters.query, onChange])

  const hasFilters =
    Boolean(filters.query || filters.areaId || filters.positionId || filters.locationId) ||
    filters.status !== 'VIGENTES' ||
    filters.contractType !== 'ALL'

  return (
    <div className="toolbar inventory-toolbar page-enter" role="search" aria-label="Filtros de empleados">
      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(220px,2fr)_repeat(5,minmax(0,1fr))_auto]">
        <div className="search-box inventory-search-box w-full!">
          <AppIcon name="search" size={15} color="#94a3b8" />
          <input
            type="search"
            placeholder="Nombre, documento o código"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Buscar empleado"
          />
        </div>
        <CustomSelect size="sm" value={filters.status} onChange={(v) => onChange({ status: v as EmployeeFiltersType['status'] })} options={STATUS_OPTIONS} />
        <CustomSelect size="sm" value={filters.areaId} onChange={(v) => onChange({ areaId: v })} options={[{ value: '', label: 'Todas las áreas' }, ...areaOptions]} />
        <CustomSelect size="sm" value={filters.positionId} onChange={(v) => onChange({ positionId: v })} options={[{ value: '', label: 'Todos los cargos' }, ...positionOptions]} />
        <CustomSelect size="sm" value={filters.locationId} onChange={(v) => onChange({ locationId: v })} options={[{ value: '', label: 'Todas las sedes' }, ...locationOptions]} />
        <CustomSelect size="sm" value={filters.contractType} onChange={(v) => onChange({ contractType: v as EmployeeFiltersType['contractType'] })} options={CONTRACT_OPTIONS} />
        {hasFilters && (
          <button type="button" className="outline-button compact" onClick={onReset}>
            <AppIcon name="refresh" size={14} />
            <span>Restablecer</span>
          </button>
        )}
      </div>
    </div>
  )
}
