'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect, SelectOption } from '@/components/ui/CustomSelect'
import { WebOrderFilters as WebOrderFiltersType, WebOrderStatus, WebOrderChannel } from '../types'

interface WebOrderFiltersProps {
  filters: WebOrderFiltersType
  onSearchChange: (val: string) => void
  onFilterChange: (patch: Partial<WebOrderFiltersType>) => void
  onReset: () => void
}

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'Todos los Estados' },
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'CONFIRMED', label: 'Confirmados' },
  { value: 'PREPARING', label: 'En Preparación' },
  { value: 'READY_TO_DISPATCH', label: 'Listos para Despacho' },
  { value: 'SHIPPED', label: 'Enviados' },
  { value: 'DELIVERED', label: 'Entregados' },
  { value: 'CANCELLED', label: 'Cancelados' },
]

const CHANNEL_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'Todos los Canales' },
  { value: 'CATALOGO_SUPERMAS', label: 'Catálogo Super Más (B2C)' },
  { value: 'CATALOGO_DISTRIBUIDORA', label: 'Catálogo Distribuidora (B2B)' },
]

const INVOICE_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'Toda Facturación' },
  { value: 'INVOICED', label: 'Facturados (DIAN)' },
  { value: 'PENDING', label: 'Sin Facturar' },
]

const PAYMENT_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'Todos los Pagos' },
  { value: 'Wompi', label: 'Wompi / Online' },
  { value: 'Bancolombia', label: 'Transferencia Bancolombia' },
  { value: 'Contra Entrega', label: 'Contra Entrega' },
]

export function WebOrderFilters({
  filters,
  onSearchChange,
  onFilterChange,
  onReset,
}: WebOrderFiltersProps) {
  const hasActiveFilters =
    Boolean(filters.search && filters.search.trim() !== '') ||
    Boolean(filters.status && filters.status !== 'ALL') ||
    Boolean(filters.channel && filters.channel !== 'ALL') ||
    Boolean(filters.paymentMethod && filters.paymentMethod !== 'ALL') ||
    Boolean(filters.invoiceStatus && filters.invoiceStatus !== 'ALL') ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo)

  return (
    <div className="toolbar inventory-toolbar products-toolbar page-enter" style={{ marginBottom: 16 }}>
      {/* Input de Búsqueda con clear button */}
      <div className="search-box wide products-search-box">
        <AppIcon name="search" size={16} />
        <input
          type="text"
          placeholder="Buscar por N° pedido, cliente, documento, guía o factura..."
          defaultValue={filters.search || ''}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full text-xs"
          aria-label="Buscar pedidos web"
        />
        {filters.search && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={() => {
              onSearchChange('')
            }}
            aria-label="Limpiar búsqueda"
          >
            <AppIcon name="close" size={14} />
          </button>
        )}
      </div>

      {/* Selectores Dropdown usando el CustomSelect oficial del ERP */}
      <div className="filter-select-group">
        {/* Estado */}
        <div className="filter-select-item" style={{ minWidth: 175 }}>
          <CustomSelect
            options={STATUS_OPTIONS}
            value={filters.status || 'ALL'}
            onChange={(val) => onFilterChange({ status: val as WebOrderStatus | 'ALL', page: 1 })}
            placeholder="Estado"
          />
        </div>

        {/* Canal Web */}
        <div className="filter-select-item" style={{ minWidth: 190 }}>
          <CustomSelect
            options={CHANNEL_OPTIONS}
            value={filters.channel || 'ALL'}
            onChange={(val) => onFilterChange({ channel: val as WebOrderChannel | 'ALL', page: 1 })}
            placeholder="Canal Web"
          />
        </div>

        {/* Facturación */}
        <div className="filter-select-item" style={{ minWidth: 165 }}>
          <CustomSelect
            options={INVOICE_OPTIONS}
            value={filters.invoiceStatus || 'ALL'}
            onChange={(val) => onFilterChange({ invoiceStatus: val as any, page: 1 })}
            placeholder="Facturación"
          />
        </div>

        {/* Método de pago */}
        <div className="filter-select-item" style={{ minWidth: 175 }}>
          <CustomSelect
            options={PAYMENT_OPTIONS}
            value={filters.paymentMethod || 'ALL'}
            onChange={(val) => onFilterChange({ paymentMethod: val, page: 1 })}
            placeholder="Método de Pago"
          />
        </div>

        {/* Botón Reset */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="outline-button text-xs px-3 py-2 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 font-semibold shadow-2xs transition-colors"
            title="Limpiar todos los filtros"
          >
            <AppIcon name="close" size={13} />
            <span>Limpiar</span>
          </button>
        )}
      </div>
    </div>
  )
}
