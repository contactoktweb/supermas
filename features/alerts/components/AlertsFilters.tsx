'use client'

import React, { useMemo } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect, SelectOption } from '@/components/ui/CustomSelect'
import { AlertFilterCriteria, AlertPriority, AlertStatus, AlertModule } from '../types'
import { db } from '@/lib/supabase/db'

interface AlertsFiltersProps {
  filters: AlertFilterCriteria
  onFilterChange: (key: keyof AlertFilterCriteria, value: any) => void
  onReset: () => void
}

const PRIORITY_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'Todas las prioridades' },
  { value: 'CRITICA', label: '🔴 Crítica' },
  { value: 'ALTA', label: '🟠 Alta' },
  { value: 'MEDIA', label: '🟡 Media' },
  { value: 'BAJA', label: '🟢 Baja' },
]

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'Todos los estados' },
  { value: 'NEW', label: 'Nueva (Sin leer)' },
  { value: 'READ', label: 'Leída' },
  { value: 'IN_PROGRESS', label: 'En atención' },
  { value: 'RESOLVED', label: 'Resuelta' },
  { value: 'CLOSED', label: 'Cerrada' },
]

const MODULE_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'Todos los módulos' },
  { value: 'INVENTORY', label: 'Inventario' },
  { value: 'PURCHASES', label: 'Compras' },
  { value: 'SALES', label: 'Ventas' },
  { value: 'INVOICING', label: 'Facturación DIAN' },
  { value: 'CASH', label: 'Cajas POS' },
  { value: 'WEB_ORDERS', label: 'Pedidos Web' },
  { value: 'TRANSFERS', label: 'Traslados' },
  { value: 'ACCOUNTING', label: 'Contabilidad' },
]

export function AlertsFilters({ filters, onFilterChange, onReset }: AlertsFiltersProps) {
  const locations = db.transferLocations || []

  const locationOptions: SelectOption[] = useMemo(() => {
    return [
      { value: 'ALL', label: 'Todas las sedes' },
      ...locations.map((loc) => ({ value: loc.id, label: loc.name })),
    ]
  }, [locations])

  const hasActiveFilters = Boolean(
    filters.searchQuery ||
    (filters.priority && filters.priority !== 'ALL') ||
    (filters.module && filters.module !== 'ALL') ||
    (filters.status && filters.status !== 'ALL') ||
    (filters.locationId && filters.locationId !== 'ALL') ||
    filters.onlyCritical ||
    filters.onlyUnread
  )

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-3.5 shadow-xs">
      {/* Top search & quick filter switches */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="search-box wide flex-1">
          <AppIcon name="search" size={16} />
          <input
            type="text"
            value={filters.searchQuery || ''}
            onChange={(e) => onFilterChange('searchQuery', e.target.value)}
            placeholder="Buscar por código, título, producto, factura, caja..."
            aria-label="Buscar alertas"
          />
          {filters.searchQuery && (
            <button
              type="button"
              onClick={() => onFilterChange('searchQuery', '')}
              className="search-clear-btn"
              aria-label="Limpiar búsqueda"
            >
              <AppIcon name="close" size={14} />
            </button>
          )}
        </div>

        {/* Quick Toggles */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onFilterChange('onlyCritical', !filters.onlyCritical)}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all duration-150 border ${
              filters.onlyCritical
                ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-2xs'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-2xs'
            }`}
          >
            <AppIcon name="warning" size={14} className={filters.onlyCritical ? 'text-rose-600' : 'text-slate-400'} />
            <span>Solo críticas</span>
          </button>

          <button
            type="button"
            onClick={() => onFilterChange('onlyUnread', !filters.onlyUnread)}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all duration-150 border ${
              filters.onlyUnread
                ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-2xs'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-2xs'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                filters.onlyUnread ? 'bg-blue-600' : 'bg-slate-400'
              }`}
            />
            <span>Solo no leídas</span>
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onReset}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors shadow-2xs"
              title="Restablecer todos los filtros"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Dropdown Filters Grid with global CustomSelect */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Prioridad
          </label>
          <CustomSelect
            options={PRIORITY_OPTIONS}
            value={filters.priority || 'ALL'}
            onChange={(val) => onFilterChange('priority', val as AlertPriority | 'ALL')}
            placeholder="Prioridad"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Estado
          </label>
          <CustomSelect
            options={STATUS_OPTIONS}
            value={filters.status || 'ALL'}
            onChange={(val) => onFilterChange('status', val as AlertStatus | 'ALL')}
            placeholder="Estado"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Sede / Bodega
          </label>
          <CustomSelect
            options={locationOptions}
            value={filters.locationId || 'ALL'}
            onChange={(val) => onFilterChange('locationId', val)}
            placeholder="Sede / Bodega"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Módulo
          </label>
          <CustomSelect
            options={MODULE_OPTIONS}
            value={filters.module || 'ALL'}
            onChange={(val) => onFilterChange('module', val as AlertModule | 'ALL')}
            placeholder="Módulo"
          />
        </div>
      </div>
    </div>
  )
}
