'use client'

import React, { useEffect, useRef } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { KardexColumnVisibility } from '../types'

interface KardexColumnSelectorProps {
  isOpen: boolean
  onClose: () => void
  visibility: KardexColumnVisibility
  onChange: (key: keyof KardexColumnVisibility) => void
  onReset: () => void
}

const COLUMN_LABELS: { key: keyof KardexColumnVisibility; label: string }[] = [
  { key: 'createdAt', label: 'Fecha y Hora' },
  { key: 'product', label: 'Producto' },
  { key: 'sku', label: 'SKU' },
  { key: 'location', label: 'Bodega' },
  { key: 'movementType', label: 'Tipo de Movimiento' },
  { key: 'document', label: 'Documento Origen' },
  { key: 'quantityIn', label: 'Entrada (+)' },
  { key: 'quantityOut', label: 'Salida (-)' },
  { key: 'previousStock', label: 'Saldo Anterior' },
  { key: 'resultingStock', label: 'Saldo Resultante' },
  { key: 'unitCost', label: 'Costo Unitario' },
  { key: 'averageCost', label: 'Costo Promedio' },
  { key: 'totalValue', label: 'Valor Total' },
  { key: 'user', label: 'Responsable' },
  { key: 'actions', label: 'Acciones' },
]

export function KardexColumnSelector({
  isOpen,
  onClose,
  visibility,
  onChange,
  onReset,
}: KardexColumnSelectorProps) {
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="column-selector-popover page-enter" ref={popoverRef}>
      <div className="column-selector-header">
        <div>
          <strong>Columnas del Kardex</strong>
          <small>Personaliza las columnas visibles</small>
        </div>
        <button
          type="button"
          className="text-button"
          onClick={onReset}
          style={{ fontSize: 10, padding: 0 }}
        >
          Restablecer
        </button>
      </div>

      <div className="column-selector-list">
        {COLUMN_LABELS.map(({ key, label }) => {
          const isChecked = visibility[key]
          return (
            <label
              key={key}
              className={`column-checkbox-item ${isChecked ? 'is-active' : ''}`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onChange(key)}
              />
              <span className="column-label-text">{label}</span>
              {isChecked && (
                <AppIcon name="check" size={14} className="column-checked-icon" />
              )}
            </label>
          )
        })}
      </div>
    </div>
  )
}
