'use client'

import React, { useRef, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { ProductColumnVisibility } from '../types'

interface ProductColumnSelectorProps {
  isOpen: boolean
  onClose: () => void
  visibility: ProductColumnVisibility
  onChange: (key: keyof ProductColumnVisibility) => void
  onReset: () => void
}

const COLUMN_LABELS: { key: keyof ProductColumnVisibility; label: string }[] = [
  { key: 'image', label: 'Imagen de producto' },
  { key: 'sku', label: 'SKU' },
  { key: 'barcode', label: 'Código de barras' },
  { key: 'name', label: 'Nombre del producto' },
  { key: 'category', label: 'Categoría' },
  { key: 'brand', label: 'Marca' },
  { key: 'stock', label: 'Stock total' },
  { key: 'status', label: 'Estado operativo' },
  { key: 'cost', label: 'Costo promedio' },
  { key: 'normalPrice', label: 'Precio normal' },
  { key: 'wholesalePrice', label: 'Precio mayorista' },
  { key: 'margin', label: 'Margen estimado %' },
  { key: 'webSuperMas', label: 'Catálogo Super Más' },
  { key: 'webDistribuidora', label: 'Catálogo Distribuidora' },
  { key: 'actions', label: 'Menú de acciones' },
]

export function ProductColumnSelector({
  isOpen,
  onClose,
  visibility,
  onChange,
  onReset,
}: ProductColumnSelectorProps) {
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const activeCount = Object.values(visibility).filter(Boolean).length

  return (
    <div
      ref={popoverRef}
      className="column-selector-popover page-enter"
      role="dialog"
      aria-label="Configuración de columnas"
    >
      <div className="column-selector-header">
        <div>
          <strong>Columnas visibles</strong>
          <small>{activeCount} de 15 activas</small>
        </div>
        <button
          type="button"
          className="text-button"
          onClick={onReset}
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
                <span className="column-checked-icon">
                  <AppIcon name="check" size={13} />
                </span>
              )}
            </label>
          )
        })}
      </div>

      <div className="column-selector-footer">
        <button
          type="button"
          className="primary-button compact"
          style={{ width: '100%' }}
          onClick={onClose}
        >
          <span>Listo</span>
        </button>
      </div>
    </div>
  )
}
