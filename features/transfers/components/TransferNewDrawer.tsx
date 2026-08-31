'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { transferService } from '../services/transfer.service'
import { UserPermissionContext } from '../types'

interface TransferNewDrawerProps {
  isOpen: boolean
  initialOriginLocationId?: string
  initialProductId?: string
  userContext?: UserPermissionContext
  onClose: () => void
  onSuccess: (transferCode: string) => void
}

const LOCATION_OPTIONS = [
  { value: 'loc-01', label: 'Bodega Principal Cali (BOD-PRI-01)' },
  { value: 'loc-02', label: 'Punto Centro - Carrera 5 (POS-CEN-01)' },
  { value: 'loc-03', label: 'Bodega Norte - Yumbo (BOD-NOR-01)' },
  { value: 'loc-04', label: 'Punto Sur - Ciudad Jardín (POS-SUR-01)' },
]

interface SelectedTransferItem {
  productId: string
  productName: string
  sku: string
  unitOfMeasure: string
  imageUrl?: string
  availableStock: number
  units: number
}

export function TransferNewDrawer({
  isOpen,
  initialOriginLocationId = 'loc-01',
  initialProductId,
  userContext,
  onClose,
  onSuccess,
}: TransferNewDrawerProps) {
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 1 Form state
  const [originId, setOriginId] = useState(initialOriginLocationId)
  const [destinationId, setDestinationId] = useState(
    initialOriginLocationId === 'loc-02' ? 'loc-01' : 'loc-02'
  )

  // Step 2 Products state
  const [availableProducts, setAvailableProducts] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItems, setSelectedItems] = useState<SelectedTransferItem[]>([])

  // Step 3 Notes state
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Load available products for origin
  useEffect(() => {
    if (originId) {
      transferService.getAvailableProductsForTransfer(originId).then((prods) => {
        setAvailableProducts(prods)
        if (initialProductId && selectedItems.length === 0) {
          const matched = prods.find((p) => p.productId === initialProductId)
          if (matched && matched.availableStock > 0) {
            setSelectedItems([
              {
                productId: matched.productId,
                productName: matched.productName,
                sku: matched.sku,
                unitOfMeasure: matched.unitOfMeasure,
                imageUrl: matched.imageUrl,
                availableStock: matched.availableStock,
                units: 1,
              },
            ])
            setStep(2)
          }
        }
      })
    }
  }, [originId, initialProductId])

  if (!isOpen || !mounted) return null

  const handleOriginChange = (val: string) => {
    setOriginId(val)
    if (val === destinationId) {
      const other = LOCATION_OPTIONS.find((l) => l.value !== val)
      if (other) setDestinationId(other.value)
    }
    setSelectedItems([])
  }

  const handleAddItem = (prod: any) => {
    if (selectedItems.some((i) => i.productId === prod.productId)) return
    if (prod.availableStock <= 0) return

    setSelectedItems((prev) => [
      ...prev,
      {
        productId: prod.productId,
        productName: prod.productName,
        sku: prod.sku,
        unitOfMeasure: prod.unitOfMeasure,
        imageUrl: prod.imageUrl,
        availableStock: prod.availableStock,
        units: 1,
      },
    ])
  }

  const handleRemoveItem = (productId: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.productId !== productId))
  }

  const handleUpdateUnits = (productId: string, units: number) => {
    setSelectedItems((prev) =>
      prev.map((i) => {
        if (i.productId !== productId) return i
        const safeUnits = Math.max(1, Math.min(i.availableStock, units))
        return { ...i, units: safeUnits }
      })
    )
  }

  const totalUnits = selectedItems.reduce((acc, i) => acc + i.units, 0)
  const originObj = LOCATION_OPTIONS.find((l) => l.value === originId)
  const destObj = LOCATION_OPTIONS.find((l) => l.value === destinationId)

  const filteredProds = availableProducts.filter((p) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    return (
      p.productName.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.includes(q))
    )
  })

  const handleSubmit = async () => {
    try {
      setLoading(true)
      setError(null)
      if (originId === destinationId) {
        throw new Error('La bodega de origen y destino no pueden ser iguales')
      }
      if (selectedItems.length === 0) {
        throw new Error('Debe agregar al menos un producto')
      }

      const created = await transferService.createTransfer(
        {
          originLocationId: originId,
          destinationLocationId: destinationId,
          items: selectedItems.map((i) => ({
            productId: i.productId,
            units: i.units,
          })),
          notes: notes.trim() || undefined,
        },
        userContext
      )

      onSuccess(created.code)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al crear transferencia')
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div
      className="drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="product-drawer product-detail-drawer page-enter"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 620 }}
      >
        {/* Header */}
        <div className="drawer-header product-detail-header-v2">
          <div className="product-detail-hero-layout">
            <div className="stat-icon blue" style={{ width: 42, height: 42, borderRadius: 10 }}>
              <AppIcon name="plus" size={20} />
            </div>
            <div>
              <span className="product-category-eyebrow">Nueva Orden de Traslado</span>
              <h2 className="product-title-heading" style={{ fontSize: 17, margin: '2px 0 0' }}>
                Crear Transferencia entre Bodegas
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Stepper Wizard Indicator */}
        <div className="wizard-step-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: '#f8fafc' }}>
          <button
            type="button"
            className={`wizard-step-btn ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}
            onClick={() => setStep(1)}
            style={{ flex: 1, padding: '10px', fontSize: 12, fontWeight: 600, border: 0, background: step === 1 ? '#fff' : 'transparent', borderBottom: step === 1 ? '2px solid var(--navy)' : 'none', color: step === 1 ? 'var(--navy)' : 'var(--muted)', cursor: 'pointer' }}
          >
            1. Origen y Destino
          </button>
          <button
            type="button"
            className={`wizard-step-btn ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`}
            onClick={() => {
              if (originId !== destinationId) setStep(2)
            }}
            style={{ flex: 1, padding: '10px', fontSize: 12, fontWeight: 600, border: 0, background: step === 2 ? '#fff' : 'transparent', borderBottom: step === 2 ? '2px solid var(--navy)' : 'none', color: step === 2 ? 'var(--navy)' : 'var(--muted)', cursor: 'pointer' }}
          >
            2. Productos ({selectedItems.length})
          </button>
          <button
            type="button"
            className={`wizard-step-btn ${step === 3 ? 'active' : ''}`}
            onClick={() => {
              if (selectedItems.length > 0) setStep(3)
            }}
            style={{ flex: 1, padding: '10px', fontSize: 12, fontWeight: 600, border: 0, background: step === 3 ? '#fff' : 'transparent', borderBottom: step === 3 ? '2px solid var(--navy)' : 'none', color: step === 3 ? 'var(--navy)' : 'var(--muted)', cursor: 'pointer' }}
          >
            3. Resumen y Emisión
          </button>
        </div>

        {/* Body Content */}
        <div className="detail-tab-body" style={{ paddingTop: 16 }}>
          {error && (
            <div className="incident-alert-banner" style={{ background: '#fef2f2', borderColor: '#fca5a5', padding: 10, borderRadius: 8, marginBottom: 14, color: '#dc2626', fontSize: 12 }}>
              <AppIcon name="warning" size={14} /> <span>{error}</span>
            </div>
          )}

          {/* PASO 1: ORIGEN Y DESTINO */}
          {step === 1 && (
            <div className="wizard-step-content page-enter">
              <h4 style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--navy)' }}>
                Seleccione las ubicaciones de la transferencia
              </h4>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                  Bodega Origen (Desde donde sale el stock):
                </label>
                <CustomSelect
                  options={LOCATION_OPTIONS}
                  value={originId}
                  onChange={handleOriginChange}
                  placeholder="Seleccione origen"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                  Bodega Destino (A donde ingresará el stock):
                </label>
                <CustomSelect
                  options={LOCATION_OPTIONS.filter((l) => l.value !== originId)}
                  value={destinationId}
                  onChange={(val) => setDestinationId(val)}
                  placeholder="Seleccione destino"
                />
              </div>

              {originId === destinationId && (
                <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>
                  ⚠️ La bodega de origen y destino no pueden ser la misma.
                </div>
              )}

              <div className="info-banner-compact" style={{ marginTop: 20, background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <AppIcon name="info" size={14} color="var(--navy)" />
                <span style={{ fontSize: 12, color: 'var(--text-main)' }}>
                  Al crear la transferencia quedará en estado <strong>PENDIENTE</strong> sin afectar el inventario hasta que la bodega origen emita el <strong>DESPACHO</strong>.
                </span>
              </div>
            </div>
          )}

          {/* PASO 2: PRODUCTOS Y CANTIDADES */}
          {step === 2 && (
            <div className="wizard-step-content page-enter">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h4 style={{ margin: 0, fontSize: 13, color: 'var(--navy)' }}>
                  Agregar productos desde {originObj?.label.split('(')[0]}
                </h4>
                <span className="count-tag-pill">{selectedItems.length} seleccionados</span>
              </div>

              {/* Product search bar */}
              <div className="search-box wide" style={{ marginBottom: 12 }}>
                <AppIcon name="search" size={14} />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar producto por nombre o SKU..."
                  aria-label="Buscar producto para transferir"
                />
              </div>

              {/* Product selection list */}
              <div className="available-prods-list" style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8, padding: 4, marginBottom: 14 }}>
                {filteredProds.map((prod) => {
                  const isSelected = selectedItems.some((i) => i.productId === prod.productId)
                  const hasStock = prod.availableStock > 0

                  return (
                    <div
                      key={prod.productId}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 10px',
                        borderBottom: '1px solid #f1f5f9',
                        opacity: hasStock ? 1 : 0.5,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <AppIcon name="products" size={14} />
                        </div>
                        <div>
                          <strong style={{ fontSize: 12, display: 'block' }}>{prod.productName}</strong>
                          <small style={{ color: 'var(--muted)', fontSize: 11 }}>
                            SKU: {prod.sku} · Stock en origen: <strong>{prod.availableStock} {prod.unitOfMeasure}</strong>
                          </small>
                        </div>
                      </div>

                      <button
                        type="button"
                        className={isSelected ? 'outline-button compact' : 'primary-button compact'}
                        disabled={!hasStock || isSelected}
                        onClick={() => handleAddItem(prod)}
                        style={{ fontSize: 11, padding: '4px 10px' }}
                      >
                        {isSelected ? 'Agregado' : hasStock ? '+ Agregar' : 'Sin Stock'}
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Selected items table */}
              <h5 style={{ margin: '12px 0 6px', fontSize: 12, color: 'var(--navy)' }}>
                Productos en la orden de traslado:
              </h5>

              {selectedItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, background: '#f8fafc', borderRadius: 8, color: 'var(--muted)', fontSize: 12 }}>
                  Seleccione al menos un producto del listado superior.
                </div>
              ) : (
                <div className="selected-items-table" style={{ border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
                  {selectedItems.map((item) => (
                    <div
                      key={item.productId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderBottom: '1px solid #f1f5f9',
                        background: '#fff',
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: 12, display: 'block' }}>{item.productName}</strong>
                        <small style={{ color: 'var(--muted)', fontSize: 11 }}>
                          Máx disponible: {item.availableStock} {item.unitOfMeasure}
                        </small>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 11 }}>Cant:</span>
                          <input
                            type="number"
                            min={1}
                            max={item.availableStock}
                            value={item.units}
                            onChange={(e) => handleUpdateUnits(item.productId, Number(e.target.value))}
                            style={{ width: 60, padding: '4px 6px', fontSize: 12, textAlign: 'center', border: '1px solid var(--border-color)', borderRadius: 6 }}
                          />
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{item.unitOfMeasure}</span>
                        </div>

                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => handleRemoveItem(item.productId)}
                          title="Eliminar de la lista"
                        >
                          <AppIcon name="close" size={14} color="var(--red)" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PASO 3: RESUMEN Y OBSERVACIONES */}
          {step === 3 && (
            <div className="wizard-step-content page-enter">
              <h4 style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--navy)' }}>
                3. Resumen y Confirmación de la Transferencia
              </h4>

              <div className="info-list-grid" style={{ marginBottom: 14 }}>
                <div className="info-kv-item">
                  <span>Bodega Origen:</span>
                  <strong>{originObj?.label}</strong>
                </div>
                <div className="info-kv-item">
                  <span>Bodega Destino:</span>
                  <strong style={{ color: 'var(--navy)' }}>{destObj?.label}</strong>
                </div>
                <div className="info-kv-item">
                  <span>Total Artículos:</span>
                  <strong>{selectedItems.length} producto(s)</strong>
                </div>
                <div className="info-kv-item">
                  <span>Total Unidades:</span>
                  <strong style={{ color: 'var(--navy)', fontSize: 14 }}>{totalUnits} unidades</strong>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Observaciones / Justificación de logística (Opcional):
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: Rebalanceo por alta demanda fin de semana, surtido de góndolas..."
                  rows={3}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border-color)', resize: 'none' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="detail-drawer-footer" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <button
            type="button"
            className="outline-button"
            onClick={() => {
              if (step > 1) setStep((s) => (s - 1) as any)
              else onClose()
            }}
          >
            {step === 1 ? 'Cancelar' : '← Anterior'}
          </button>

          {step < 3 ? (
            <button
              type="button"
              className="primary-button"
              disabled={step === 1 ? originId === destinationId : selectedItems.length === 0}
              onClick={() => setStep((s) => (s + 1) as any)}
            >
              <span>Continuar →</span>
            </button>
          ) : (
            <button
              type="button"
              className="primary-button"
              disabled={loading || selectedItems.length === 0}
              onClick={handleSubmit}
            >
              <AppIcon name="check" size={14} />
              <span>{loading ? 'Creando...' : 'Crear transferencia'}</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
