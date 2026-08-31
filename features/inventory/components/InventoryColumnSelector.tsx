'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { InventoryColumnVisibility } from '../types'

interface InventoryColumnSelectorProps {
  visibility: InventoryColumnVisibility
  onChange: (updated: InventoryColumnVisibility) => void
  onClose: () => void
  viewMode: 'CONSOLIDATED' | 'BY_LOCATION'
}

export function InventoryColumnSelector({
  visibility,
  onChange,
  onClose,
  viewMode,
}: InventoryColumnSelectorProps) {
  const toggleColumn = (key: keyof InventoryColumnVisibility) => {
    onChange({
      ...visibility,
      [key]: !visibility[key],
    })
  }

  const columns: { key: keyof InventoryColumnVisibility; label: string; onlyMode?: string }[] = [
    { key: 'product', label: 'Producto (Nombre e imagen)' },
    { key: 'sku', label: 'SKU' },
    { key: 'barcode', label: 'Código de barras' },
    { key: 'category', label: 'Categoría' },
    { key: 'location', label: 'Bodega física', onlyMode: 'BY_LOCATION' },
    { key: 'currentStock', label: 'Existencia actual' },
    { key: 'minStock', label: 'Stock mínimo' },
    { key: 'criticalStock', label: 'Stock crítico' },
    { key: 'status', label: 'Estado de stock' },
    { key: 'averageCost', label: 'Costo promedio' },
    { key: 'totalValue', label: 'Valor a costo' },
    { key: 'lastMovement', label: 'Último movimiento' },
  ]

  const filteredCols = columns.filter(
    (col) => !col.onlyMode || col.onlyMode === viewMode
  )

  return (
    <div className="column-selector-popover animate-fade-in" role="dialog">
      <div className="popover-header">
        <span className="popover-title">
          <AppIcon name="sliders" size={13} />
          Columnas visibles
        </span>
        <button
          type="button"
          className="icon-button close-popover-btn"
          onClick={onClose}
          aria-label="Cerrar selector de columnas"
        >
          <AppIcon name="close" size={12} />
        </button>
      </div>

      <div className="popover-body">
        {filteredCols.map((col) => (
          <label key={col.key} className="col-checkbox-label">
            <input
              type="checkbox"
              checked={visibility[col.key]}
              onChange={() => toggleColumn(col.key)}
            />
            <span>{col.label}</span>
          </label>
        ))}
      </div>

      <div className="popover-footer">
        <button
          type="button"
          className="text-button btn-reset-cols"
          onClick={() =>
            onChange({
              product: true,
              sku: true,
              barcode: true,
              category: true,
              location: true,
              currentStock: true,
              minStock: true,
              criticalStock: true,
              status: true,
              averageCost: true,
              totalValue: true,
              lastMovement: true,
              actions: true,
            })
          }
        >
          Mostrar todas
        </button>
      </div>
    </div>
  )
}
