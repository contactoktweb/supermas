'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { WebOrderFilters as WebOrderFiltersType, WebOrderStatus, WebOrderChannel } from '../types'

interface WebOrderFiltersProps {
  filters: WebOrderFiltersType
  onSearchChange: (val: string) => void
  onFilterChange: (patch: Partial<WebOrderFiltersType>) => void
  onReset: () => void
}

export function WebOrderFilters({
  filters,
  onSearchChange,
  onFilterChange,
  onReset,
}: WebOrderFiltersProps) {
  const hasActiveFilters =
    (filters.search && filters.search.trim() !== '') ||
    (filters.status && filters.status !== 'ALL') ||
    (filters.channel && filters.channel !== 'ALL') ||
    (filters.paymentMethod && filters.paymentMethod !== 'ALL') ||
    (filters.invoiceStatus && filters.invoiceStatus !== 'ALL') ||
    filters.dateFrom ||
    filters.dateTo

  return (
    <div className="panel-container rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 mb-5 shadow-xs">
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        {/* Input de Búsqueda con debounce */}
        <div className="search-box flex-1 min-w-[280px] max-w-lg">
          <AppIcon name="search" size={16} />
          <input
            type="text"
            placeholder="Buscar por N° pedido, cliente, documento, guía o factura..."
            defaultValue={filters.search || ''}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full text-xs"
          />
        </div>

        {/* Filtros Dropdown */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Estado */}
          <select
            className="filter-select text-xs"
            value={filters.status || 'ALL'}
            onChange={(e) => onFilterChange({ status: e.target.value as WebOrderStatus | 'ALL', page: 1 })}
          >
            <option value="ALL">Todos los Estados</option>
            <option value="PENDING">Pendientes</option>
            <option value="CONFIRMED">Confirmados</option>
            <option value="PREPARING">En Preparación</option>
            <option value="READY_TO_DISPATCH">Listos para Despacho</option>
            <option value="SHIPPED">Enviados</option>
            <option value="DELIVERED">Entregados</option>
            <option value="CANCELLED">Cancelados</option>
          </select>

          {/* Canal Web */}
          <select
            className="filter-select text-xs"
            value={filters.channel || 'ALL'}
            onChange={(e) => onFilterChange({ channel: e.target.value as WebOrderChannel | 'ALL', page: 1 })}
          >
            <option value="ALL">Todos los Canales</option>
            <option value="CATALOGO_SUPERMAS">Catálogo Super Más</option>
            <option value="CATALOGO_DISTRIBUIDORA">Catálogo Distribuidora</option>
          </select>

          {/* Facturación */}
          <select
            className="filter-select text-xs"
            value={filters.invoiceStatus || 'ALL'}
            onChange={(e) => onFilterChange({ invoiceStatus: e.target.value as any, page: 1 })}
          >
            <option value="ALL">Toda Facturación</option>
            <option value="INVOICED">Facturados (DIAN)</option>
            <option value="PENDING">Sin Facturar</option>
          </select>

          {/* Método de pago */}
          <select
            className="filter-select text-xs"
            value={filters.paymentMethod || 'ALL'}
            onChange={(e) => onFilterChange({ paymentMethod: e.target.value, page: 1 })}
          >
            <option value="ALL">Todos los Pagos</option>
            <option value="Wompi">Wompi / Online</option>
            <option value="Bancolombia">Transferencia Bancolombia</option>
            <option value="Contra Entrega">Contra Entrega</option>
          </select>

          {/* Botón Reset */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onReset}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors flex items-center gap-1.5"
              title="Limpiar todos los filtros"
            >
              <AppIcon name="close" size={13} />
              <span>Limpiar</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
