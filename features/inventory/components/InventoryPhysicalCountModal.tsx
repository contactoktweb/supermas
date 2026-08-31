'use client'

import React, { useState, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect, SelectOption } from '@/components/ui/CustomSelect'
import { PhysicalCountSession, PhysicalCountItem } from '../types'
import { inventoryService } from '../services/inventory.service'

interface InventoryPhysicalCountModalProps {
  isOpen: boolean
  onClose: () => void
  onApplyDiscrepancies: (session: PhysicalCountSession) => Promise<void>
}

const LOCATION_OPTIONS: SelectOption[] = [
  { value: 'loc-01', label: 'Bodega Principal Cali', badge: 'BOD-PRI-01' },
  { value: 'loc-02', label: 'Punto Centro - Cra 5', badge: 'POS-CEN-01' },
  { value: 'loc-03', label: 'Bodega Norte - Yumbo', badge: 'BOD-NOR-01' },
  { value: 'loc-04', label: 'Punto Sur - Ciudad Jardín', badge: 'POS-SUR-01' },
]

export function InventoryPhysicalCountModal({
  isOpen,
  onClose,
  onApplyDiscrepancies,
}: InventoryPhysicalCountModalProps) {
  const [selectedLocationId, setSelectedLocationId] = useState<string>('loc-01')
  const [session, setSession] = useState<PhysicalCountSession | null>(null)
  const [notes, setNotes] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isApplying, setIsApplying] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Initialize count session when location changes or modal opens
  useEffect(() => {
    if (!isOpen) {
      setSession(null)
      return
    }

    let isMounted = true
    setIsLoading(true)
    setErrorMsg(null)

    const locName =
      LOCATION_OPTIONS.find((l) => l.value === selectedLocationId)?.label || 'Bodega'

    inventoryService
      .startPhysicalCountSession(selectedLocationId, locName)
      .then((sess) => {
        if (isMounted) {
          setSession(sess)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setErrorMsg(err.message || 'Error al iniciar sesión de conteo')
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, selectedLocationId])

  if (!isOpen) return null

  const handlePhysicalStockChange = (productId: string, valStr: string) => {
    if (!session) return
    const numericVal = parseInt(valStr) || 0

    const updatedItems = session.items.map((item) => {
      if (item.productId === productId) {
        const diff = numericVal - item.systemStock
        return {
          ...item,
          physicalStock: numericVal,
          difference: diff,
        }
      }
      return item
    })

    setSession({
      ...session,
      items: updatedItems,
    })
  }

  const discrepanciesCount =
    session?.items.filter((item) => item.difference !== 0).length || 0

  const handleConfirmDiscrepancies = async () => {
    if (!session) return
    setIsApplying(true)
    setErrorMsg(null)

    try {
      await onApplyDiscrepancies({
        ...session,
        notes,
      })
      onClose()
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al aplicar ajustes por conteo')
    } finally {
      setIsApplying(false)
    }
  }

  const filteredItems = session
    ? session.items.filter(
        (i) =>
          i.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          i.sku.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : []

  return (
    <div className="drawer-backdrop modal-center" onClick={onClose}>
      <div
        className="modal-card physical-count-modal animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Sesión de conteo físico de inventario"
      >
        <div className="modal-header">
          <div className="modal-header-title">
            <div className="modal-icon-badge">
              <AppIcon name="audit" size={18} color="var(--navy)" />
            </div>
            <div>
              <h3>Sesión de conteo físico</h3>
              <p>
                Auditoría y comparación de existencias físicas vs registros en sistema.
              </p>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">
            <AppIcon name="close" size={16} />
          </button>
        </div>

        <div className="physical-count-body">
          {errorMsg && (
            <div className="form-error-banner">
              <AppIcon name="warning" size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Location Picker & Quick Info */}
          <div className="count-session-header-row">
            <div className="count-loc-select">
              <label>Bodega a auditar:</label>
              <CustomSelect
                value={selectedLocationId}
                onChange={(val) => setSelectedLocationId(val)}
                options={LOCATION_OPTIONS}
                size="sm"
              />
            </div>

            <div className="count-session-badge">
              <span>Sesión:</span>
              <strong className="mono">{session?.sessionNumber || '---'}</strong>
            </div>

            <div className="count-discrepancy-stat">
              <span>Diferencias detectadas:</span>
              <strong
                style={{
                  color: discrepanciesCount > 0 ? 'var(--red)' : 'var(--green)',
                }}
              >
                {discrepanciesCount} producto(s)
              </strong>
            </div>
          </div>

          {/* Search inside count session */}
          <div className="search-box count-search-box">
            <AppIcon name="search" size={14} color="#94a3b8" />
            <input
              type="text"
              placeholder="Filtrar productos del conteo por nombre o SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Count Comparison Table */}
          <div className="count-items-table-wrap">
            {isLoading ? (
              <div className="count-loading-state">
                <span className="spinner-dot" />
                <span>Cargando productos de la bodega...</span>
              </div>
            ) : (
              <table className="count-comparison-table">
                <thead>
                  <tr>
                    <th>Producto / SKU</th>
                    <th>Categoría</th>
                    <th style={{ textAlign: 'center' }}>Sistema</th>
                    <th style={{ textAlign: 'center', width: '130px' }}>Físico</th>
                    <th style={{ textAlign: 'center' }}>Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                        No se encontraron productos en esta bodega
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const hasDiff = item.difference !== 0
                      const isExcess = item.difference > 0
                      const isShortage = item.difference < 0

                      return (
                        <tr
                          key={item.productId}
                          className={hasDiff ? 'row-with-discrepancy' : ''}
                        >
                          <td>
                            <strong>{item.productName}</strong>
                            <small className="mono text-muted">{item.sku}</small>
                          </td>
                          <td>
                            <span className="category-tag">{item.category}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="system-stock-pill">
                              {item.systemStock} {item.unitOfMeasure}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div className="physical-input-wrap">
                              <input
                                type="number"
                                min="0"
                                className="physical-input-field"
                                value={item.physicalStock}
                                onChange={(e) =>
                                  handlePhysicalStockChange(item.productId, e.target.value)
                                }
                              />
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {hasDiff ? (
                              <span
                                className={`diff-badge ${isExcess ? 'excess' : 'shortage'}`}
                              >
                                {isExcess ? `+${item.difference}` : item.difference} uds
                              </span>
                            ) : (
                              <span className="diff-badge neutral">0 (Exacto)</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Observations */}
          <div className="input-field-block count-notes-field">
            <label>Observaciones de la sesión de conteo</label>
            <input
              type="text"
              className="custom-form-input"
              placeholder="Ej: Conteo físico mensual ordinario, aprobado por supervisor..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button type="button" className="outline-button compact" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="primary-button compact"
            onClick={handleConfirmDiscrepancies}
            disabled={isApplying || discrepanciesCount === 0}
          >
            <AppIcon name="check" size={14} />
            <span>
              {isApplying
                ? 'Aplicando ajustes...'
                : `Ajustar ${discrepanciesCount} discrepancia(s)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
