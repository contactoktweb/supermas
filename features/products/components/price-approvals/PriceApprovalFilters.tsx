'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { PriceChangeStatus } from '../../types'

export type PriceStatusFilter = PriceChangeStatus | 'ALL'

interface PriceApprovalFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  status: PriceStatusFilter
  onStatusChange: (value: PriceStatusFilter) => void
  showStatus: boolean
  priceList: string
  onPriceListChange: (value: string) => void
  priceListOptions: { code: string; name: string }[]
}

const STATUS_OPTIONS: { value: PriceStatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Todos los estados' },
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'APPROVED', label: 'Aprobadas' },
  { value: 'REJECTED', label: 'Rechazadas' },
]

export function PriceApprovalFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  showStatus,
  priceList,
  onPriceListChange,
  priceListOptions,
}: PriceApprovalFiltersProps) {
  return (
    <div className="price-approval-filters" role="search">
      <label className="search-box wide">
        <AppIcon name="search" size={15} aria-hidden="true" />
        <span className="visually-hidden">Buscar solicitudes</span>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por producto, SKU o solicitante"
        />
      </label>

      {showStatus && (
        <label className="price-approval-select">
          <span className="visually-hidden">Estado</span>
          <select value={status} onChange={(e) => onStatusChange(e.target.value as PriceStatusFilter)}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="price-approval-select">
        <span className="visually-hidden">Lista de precios</span>
        <select value={priceList} onChange={(e) => onPriceListChange(e.target.value)}>
          <option value="ALL">Todas las listas</option>
          {priceListOptions.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
