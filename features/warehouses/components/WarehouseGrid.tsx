'use client'

import React from 'react'
import { LocationWithMetrics } from '../types'
import { WarehouseCard } from './WarehouseCard'
import { WarehousePermissions } from '../hooks/useWarehousePermissions'
import { WarehouseEmptyState } from './WarehouseEmptyState'

interface WarehouseGridProps {
  warehouses: LocationWithMetrics[]
  permissions: WarehousePermissions
  onSelect: (id: string) => void
  onEdit: (warehouse: LocationWithMetrics) => void
  onDeactivate: (warehouse: LocationWithMetrics) => void
  onAdjustStock: (warehouse: LocationWithMetrics) => void
  onTransfer: (warehouse: LocationWithMetrics) => void
  onOpenInventory: (id: string) => void
  onOpenKardex: (id: string) => void
  onOpenUsers: (id: string) => void
  onClearFilters: () => void
}

export function WarehouseGrid({
  warehouses,
  permissions,
  onSelect,
  onEdit,
  onDeactivate,
  onAdjustStock,
  onTransfer,
  onOpenInventory,
  onOpenKardex,
  onOpenUsers,
  onClearFilters,
}: WarehouseGridProps) {
  if (warehouses.length === 0) {
    return (
      <WarehouseEmptyState
        type="NO_FILTER_RESULTS"
        onAction={onClearFilters}
        actionLabel="Limpiar filtros"
      />
    )
  }

  return (
    <div className="warehouse-grid" role="region" aria-label="Listado de bodegas en tarjetas">
      {warehouses.map((wh) => (
        <WarehouseCard
          key={wh.id}
          warehouse={wh}
          permissions={permissions}
          onSelect={onSelect}
          onEdit={onEdit}
          onDeactivate={onDeactivate}
          onAdjustStock={onAdjustStock}
          onTransfer={onTransfer}
          onOpenInventory={onOpenInventory}
          onOpenKardex={onOpenKardex}
          onOpenUsers={onOpenUsers}
        />
      ))}
    </div>
  )
}
