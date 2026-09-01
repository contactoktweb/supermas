'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { transferService } from '../services/transfer.service'
import {
  TransferLocationOption,
  ProductAvailabilityForTransfer,
  UserPermissionContext,
} from '../types'

export interface TransferNewModalProps {
  isOpen: boolean
  initialOriginLocationId?: string
  initialProductId?: string
  userContext?: UserPermissionContext
  onClose: () => void
  onSuccess: (transferCode: string) => void
  onViewTransfer?: (transferCode: string) => void
}

interface SelectedProductRow {
  productId: string
  productName: string
  sku: string
  barcode?: string
  category: string
  unitOfMeasure: string
  imageUrl?: string
  minStock: number
  stockInOrigin: number
  stockInDestination: number
  stocksByLocation: Record<string, number>
  units: number
}

const REASON_OPTIONS = [
  { value: 'Rebalanceo de inventario', label: 'Rebalanceo general de inventario' },
  { value: 'Surtido de punto de venta', label: 'Surtido y abastecimiento de punto de venta' },
  { value: 'Pedido especial de cliente', label: 'Pedido especial / Reserva de cliente' },
  { value: 'Devolución interna', label: 'Devolución o reubicación interna' },
  { value: 'Otro motivo', label: 'Otro motivo logístico' },
]

export function TransferNewModal({
  isOpen,
  initialOriginLocationId = 'loc-01',
  initialProductId,
  userContext,
  onClose,
  onSuccess,
  onViewTransfer,
}: TransferNewModalProps) {
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)

  // Step 1: Locations
  const [locations, setLocations] = useState<TransferLocationOption[]>([])
  const [originId, setOriginId] = useState(initialOriginLocationId)
  const [destinationId, setDestinationId] = useState('loc-02')

  // Step 2: Products & Availability
  const [availableProducts, setAvailableProducts] = useState<ProductAvailabilityForTransfer[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItems, setSelectedItems] = useState<SelectedProductRow[]>([])
  const [expandedAvailabilityProductId, setExpandedAvailabilityProductId] = useState<string | null>(null)

  // Step 3: Logistics Reason & Notes
  const [reason, setReason] = useState('Surtido de punto de venta')
  const [internalRef, setInternalRef] = useState('')
  const [notes, setNotes] = useState('')

  // Step 4: Submission & Success State
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdCode, setCreatedCode] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Load locations
  useEffect(() => {
    if (isOpen) {
      transferService.getTransferLocations(userContext).then((locs) => {
        setLocations(locs)
        if (locs.length >= 2) {
          const defaultOrigin = locs.find((l) => l.id === initialOriginLocationId) ? initialOriginLocationId : locs[0].id
          const defaultDest = locs.find((l) => l.id !== defaultOrigin)?.id || locs[1].id
          setOriginId(defaultOrigin)
          setDestinationId(defaultDest)
        }
      })
    }
  }, [isOpen, initialOriginLocationId, userContext])

  // Load products when origin or destination changes
  useEffect(() => {
    if (originId && isOpen) {
      transferService
        .getAvailableProductsForTransfer(originId, destinationId)
        .then((prods) => {
          setAvailableProducts(prods)

          // Preselect product if passed from inventory or products module
          if (initialProductId && selectedItems.length === 0) {
            const matched = prods.find((p) => p.productId === initialProductId)
            if (matched && matched.stockInOrigin > 0) {
              setSelectedItems([
                {
                  productId: matched.productId,
                  productName: matched.productName,
                  sku: matched.sku,
                  barcode: matched.barcode,
                  category: matched.category,
                  unitOfMeasure: matched.unitOfMeasure,
                  imageUrl: matched.imageUrl,
                  minStock: matched.minStock,
                  stockInOrigin: matched.stockInOrigin,
                  stockInDestination: matched.stockInDestination,
                  stocksByLocation: matched.stocksByLocation,
                  units: 1,
                },
              ])
              setStep(2)
            }
          }
        })
    }
  }, [originId, destinationId, isOpen, initialProductId])

  if (!isOpen || !mounted) return null

  const originLocation = locations.find((l) => l.id === originId)
  const destinationLocation = locations.find((l) => l.id === destinationId)

  const handleOriginChange = (val: string) => {
    setOriginId(val)
    if (val === destinationId) {
      const other = locations.find((l) => l.id !== val)
      if (other) setDestinationId(other.id)
    }
    // Update selected items with new origin stocks
    setSelectedItems([])
  }

  const handleAddProduct = (prod: ProductAvailabilityForTransfer) => {
    if (selectedItems.some((i) => i.productId === prod.productId)) return
    if (prod.stockInOrigin <= 0) return

    setSelectedItems((prev) => [
      ...prev,
      {
        productId: prod.productId,
        productName: prod.productName,
        sku: prod.sku,
        barcode: prod.barcode,
        category: prod.category,
        unitOfMeasure: prod.unitOfMeasure,
        imageUrl: prod.imageUrl,
        minStock: prod.minStock,
        stockInOrigin: prod.stockInOrigin,
        stockInDestination: prod.stockInDestination,
        stocksByLocation: prod.stocksByLocation,
        units: 1,
      },
    ])
  }

  const handleRemoveProduct = (productId: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.productId !== productId))
  }

  const handleUpdateUnits = (productId: string, units: number) => {
    setSelectedItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item
        const safeUnits = Math.max(1, Math.min(item.stockInOrigin, units))
        return { ...item, units: safeUnits }
      })
    )
  }

  const handleResetWizard = () => {
    setStep(1)
    setSelectedItems([])
    setNotes('')
    setInternalRef('')
    setError(null)
    setCreatedCode(null)
  }

  const totalUnits = selectedItems.reduce((acc, i) => acc + i.units, 0)

  const filteredProds = availableProducts.filter((p) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    return (
      p.productName.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.includes(q))
    )
  })

  // Submit transfer creation with server concurrency check
  const handleSubmit = async () => {
    if (loading) return
    try {
      setLoading(true)
      setError(null)

      if (originId === destinationId) {
        throw new Error('La bodega de origen y destino no pueden ser la misma ubicación')
      }
      if (selectedItems.length === 0) {
        throw new Error('Debe agregar al menos un producto a la orden de traslado')
      }

      const created = await transferService.createTransfer(
        {
          originLocationId: originId,
          destinationLocationId: destinationId,
          items: selectedItems.map((i) => ({
            productId: i.productId,
            units: i.units,
          })),
          reason,
          internalReference: internalRef.trim() || undefined,
          notes: notes.trim() || undefined,
          idempotencyKey: `tx-${Date.now()}-${originId}-${destinationId}`,
        },
        userContext
      )

      setCreatedCode(created.code)
      setStep(4)
      onSuccess(created.code)
    } catch (err: any) {
      setError(err.message || 'Error al procesar la transferencia')
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div
      className="transfer-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="transfer-creation-modal page-enter"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="transfer-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="stat-icon blue" style={{ width: 42, height: 42, borderRadius: 10 }}>
              <AppIcon name="transfers" size={22} />
            </div>
            <div>
              <p className="eyebrow" style={{ margin: 0 }}>Logística Interna & Suministro</p>
              <h2 style={{ fontSize: 18, margin: '2px 0 0', fontWeight: 800, color: 'var(--navy)' }}>
                Nueva Transferencia entre Bodegas
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

        {/* 4-Step Progress Indicator */}
        <div className="transfer-modal-stepper">
          <button
            type="button"
            className={`wizard-step-btn ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}
            onClick={() => {
              if (step < 4) setStep(1)
            }}
            style={{
              flex: 1,
              padding: '12px 8px',
              fontSize: 12,
              fontWeight: 700,
              border: 0,
              background: step === 1 ? '#fff' : 'transparent',
              borderBottom: step === 1 ? '2px solid var(--navy)' : 'none',
              color: step === 1 ? 'var(--navy)' : step > 1 ? 'var(--green)' : 'var(--muted)',
              cursor: step < 4 ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span>{step > 1 ? '✓' : '1.'}</span>
            <span>Origen & Destino</span>
          </button>

          <button
            type="button"
            className={`wizard-step-btn ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`}
            onClick={() => {
              if (step < 4 && originId !== destinationId) setStep(2)
            }}
            style={{
              flex: 1,
              padding: '12px 8px',
              fontSize: 12,
              fontWeight: 700,
              border: 0,
              background: step === 2 ? '#fff' : 'transparent',
              borderBottom: step === 2 ? '2px solid var(--navy)' : 'none',
              color: step === 2 ? 'var(--navy)' : step > 2 ? 'var(--green)' : 'var(--muted)',
              cursor: step < 4 && originId !== destinationId ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span>{step > 2 ? '✓' : '2.'}</span>
            <span>Productos ({selectedItems.length})</span>
          </button>

          <button
            type="button"
            className={`wizard-step-btn ${step === 3 ? 'active' : step > 3 ? 'completed' : ''}`}
            onClick={() => {
              if (step < 4 && selectedItems.length > 0) setStep(3)
            }}
            style={{
              flex: 1,
              padding: '12px 8px',
              fontSize: 12,
              fontWeight: 700,
              border: 0,
              background: step === 3 ? '#fff' : 'transparent',
              borderBottom: step === 3 ? '2px solid var(--navy)' : 'none',
              color: step === 3 ? 'var(--navy)' : 'var(--muted)',
              cursor: step < 4 && selectedItems.length > 0 ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span>3.</span>
            <span>Revisión</span>
          </button>

          <button
            type="button"
            className={`wizard-step-btn ${step === 4 ? 'active completed' : ''}`}
            disabled
            style={{
              flex: 1,
              padding: '12px 8px',
              fontSize: 12,
              fontWeight: 700,
              border: 0,
              background: step === 4 ? '#fff' : 'transparent',
              borderBottom: step === 4 ? '2px solid var(--green)' : 'none',
              color: step === 4 ? 'var(--green)' : 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span>4.</span>
            <span>Confirmación</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="transfer-modal-body">
          {error && (
            <div
              className="incident-alert-banner page-enter"
              style={{
                background: '#fef2f2',
                borderColor: '#fca5a5',
                padding: '12px 14px',
                borderRadius: 8,
                marginBottom: 14,
                color: '#dc2626',
                fontSize: 12,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <AppIcon name="warning" size={16} />
              <div>
                <strong>Error al procesar:</strong>
                <p style={{ margin: '2px 0 0' }}>{error}</p>
              </div>
            </div>
          )}

          {/* =========================================================================
              PASO 1: ORIGEN Y DESTINO
             ========================================================================= */}
          {step === 1 && (
            <div className="wizard-step-content page-enter">
              <h4 style={{ margin: '0 0 6px', fontSize: 15, color: 'var(--navy)', fontWeight: 800 }}>
                Paso 1: Selección de Ubicaciones Logísticas
              </h4>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)' }}>
                Defina la bodega emisora donde se preparará la mercancía y la ubicación destino que recibirá el stock.
              </p>

              <div
                className="location-grid-responsive"
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}
              >
                {/* Bodega Origen */}
                <div
                  className="location-select-card"
                  style={{
                    background: '#fff',
                    border: '1px solid var(--border-color)',
                    borderRadius: 12,
                    padding: 16,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                  }}
                >
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
                    Bodega Origen (Salida de stock) *
                  </label>
                  <CustomSelect
                    options={locations.map((l) => ({
                      value: l.id,
                      label: `${l.name} (${l.code})`,
                    }))}
                    value={originId}
                    onChange={handleOriginChange}
                    placeholder="Seleccione bodega origen"
                  />

                  {originLocation && (
                    <div className="location-meta-box" style={{ marginTop: 14, background: '#f8fafc', padding: 12, borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ color: 'var(--muted)' }}>Código:</span>
                        <strong className="code-badge">{originLocation.code}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ color: 'var(--muted)' }}>Ciudad:</span>
                        <strong>{originLocation.city}, {originLocation.department}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>Tipo:</span>
                        <span style={{ color: 'var(--navy)', fontWeight: 600 }}>{originLocation.typeLabel}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bodega Destino */}
                <div
                  className="location-select-card"
                  style={{
                    background: '#fff',
                    border: '1px solid var(--border-color)',
                    borderRadius: 12,
                    padding: 16,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                  }}
                >
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--navy)', marginBottom: 8 }}>
                    Bodega Destino (Ingreso de stock) *
                  </label>
                  <CustomSelect
                    options={locations
                      .filter((l) => l.id !== originId)
                      .map((l) => ({
                        value: l.id,
                        label: `${l.name} (${l.code})`,
                      }))}
                    value={destinationId}
                    onChange={(val) => setDestinationId(val)}
                    placeholder="Seleccione bodega destino"
                  />

                  {destinationLocation && (
                    <div className="location-meta-box" style={{ marginTop: 14, background: '#eff6ff', padding: 12, borderRadius: 8, fontSize: 12, border: '1px solid #bfdbfe' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ color: 'var(--navy)' }}>Código:</span>
                        <strong className="code-badge">{destinationLocation.code}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ color: 'var(--navy)' }}>Ciudad:</span>
                        <strong>{destinationLocation.city}, {destinationLocation.department}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--navy)' }}>Tipo:</span>
                        <span style={{ color: 'var(--navy)', fontWeight: 600 }}>{destinationLocation.typeLabel}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {originId === destinationId && (
                <div className="incident-alert-banner" style={{ background: '#fef2f2', borderColor: '#fca5a5', padding: 10, borderRadius: 8, color: '#dc2626', fontSize: 12, marginBottom: 14 }}>
                  <AppIcon name="warning" size={14} />
                  <span>La bodega de origen y destino no pueden ser la misma ubicación.</span>
                </div>
              )}

              {/* Informative note */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <AppIcon name="shield" size={20} color="var(--navy)" />
                <span style={{ fontSize: 12, color: 'var(--text-main)', lineHeight: 1.4 }}>
                  Al continuar, el sistema consultará el catálogo de existencias reales disponibles en <strong>{originLocation?.name}</strong> para evitar transferir unidades inexistentes.
                </span>
              </div>
            </div>
          )}

          {/* =========================================================================
              PASO 2: AGREGAR PRODUCTOS & PROYECCIÓN DE STOCK
             ========================================================================= */}
          {step === 2 && (
            <div className="wizard-step-content page-enter">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 15, color: 'var(--navy)', fontWeight: 800 }}>
                    Paso 2: Selección y Cantidades de Artículos
                  </h4>
                  <small style={{ color: 'var(--muted)', fontSize: 12 }}>
                    Origen: <strong>{originLocation?.name}</strong> → Destino: <strong>{destinationLocation?.name}</strong>
                  </small>
                </div>
                <span className="count-tag-pill" style={{ fontSize: 12, padding: '4px 10px' }}>
                  {selectedItems.length} producto(s) en orden
                </span>
              </div>

              {/* Product Catalog Search */}
              <div className="search-box wide products-search-box" style={{ marginBottom: 12, width: '100%' }}>
                <AppIcon name="search" size={16} />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar en catálogo por nombre, SKU o código de barras..."
                  aria-label="Buscar producto en bodega origen"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={() => setSearchQuery('')}
                  >
                    <AppIcon name="close" size={12} />
                  </button>
                )}
              </div>

              {/* Available Products Quick Add List */}
              <div
                className="available-products-scroll-box"
                style={{
                  maxHeight: 200,
                  overflowY: 'auto',
                  border: '1px solid var(--border-color)',
                  borderRadius: 10,
                  background: '#fff',
                  marginBottom: 16,
                }}
              >
                {filteredProds.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
                    No se encontraron productos coincidentes en el inventario de la bodega origen.
                  </div>
                ) : (
                  filteredProds.map((prod) => {
                    const isSelected = selectedItems.some((i) => i.productId === prod.productId)
                    const hasStock = prod.stockInOrigin > 0
                    const isExpanded = expandedAvailabilityProductId === prod.productId

                    return (
                      <div
                        key={prod.productId}
                        style={{
                          padding: '10px 14px',
                          borderBottom: '1px solid #f1f5f9',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          background: isSelected ? '#f8fafc' : '#fff',
                          opacity: hasStock ? 1 : 0.6,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 240, flex: 1 }}>
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 8,
                                background: '#f1f5f9',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                                flexShrink: 0,
                              }}
                            >
                              {prod.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={prod.imageUrl}
                                  alt={prod.productName}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              ) : (
                                <AppIcon name="products" size={16} />
                              )}
                            </div>

                            <div>
                              <strong style={{ fontSize: 13, display: 'block', color: 'var(--text-main)' }}>
                                {prod.productName}
                              </strong>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: 'var(--muted)', flexWrap: 'wrap' }}>
                                <span className="code-badge">{prod.sku}</span>
                                <span>·</span>
                                <span>Disp. Origen: <b style={{ color: hasStock ? 'var(--green)' : 'var(--red)' }}>{prod.stockInOrigin} {prod.unitOfMeasure}</b></span>
                                <span>·</span>
                                <span>En Destino: <b>{prod.stockInDestination} {prod.unitOfMeasure}</b></span>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                              type="button"
                              className="outline-button compact"
                              onClick={() =>
                                setExpandedAvailabilityProductId(isExpanded ? null : prod.productId)
                              }
                              style={{ fontSize: 11, padding: '4px 8px', color: '#64748b' }}
                              title="Ver existencias en otras bodegas"
                            >
                              <AppIcon name="warehouse" size={12} />
                              <span>{isExpanded ? 'Ocultar red' : 'Otras sedes'}</span>
                            </button>

                            <button
                              type="button"
                              className={isSelected ? 'outline-button compact' : 'primary-button compact'}
                              disabled={!hasStock || isSelected}
                              onClick={() => handleAddProduct(prod)}
                              style={{ fontSize: 11, padding: '6px 14px' }}
                            >
                              {isSelected ? '✓ Añadido' : hasStock ? '+ Agregar' : 'Sin Stock'}
                            </button>
                          </div>
                        </div>

                        {/* Multi-warehouse availability suggestion */}
                        {isExpanded && (
                          <div
                            className="multi-wh-suggestion page-enter"
                            style={{
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              borderRadius: 6,
                              padding: '8px 12px',
                              fontSize: 11,
                              display: 'flex',
                              gap: 12,
                              alignItems: 'center',
                              flexWrap: 'wrap',
                            }}
                          >
                            <strong style={{ color: 'var(--navy)' }}>Disponibilidad en la red:</strong>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                              {Object.entries(prod.stocksByLocation).map(([locKey, stockVal]) => {
                                const locName = locations.find((l) => l.id === locKey)?.name || locKey
                                return (
                                  <span key={locKey} style={{ color: '#1e3a8a' }}>
                                    {locName}: <strong>{stockVal} uds</strong>
                                  </span>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              {/* Selected Products Table with Live Projections */}
              <h5 style={{ margin: '16px 0 8px', fontSize: 13, color: 'var(--navy)', fontWeight: 700 }}>
                Tabla de proyección de existencias:
              </h5>

              {selectedItems.length === 0 ? (
                <div
                  style={{
                    padding: 28,
                    textAlign: 'center',
                    background: '#f8fafc',
                    borderRadius: 10,
                    border: '1px dashed var(--border-color)',
                    color: 'var(--muted)',
                    fontSize: 13,
                  }}
                >
                  <AppIcon name="products" size={26} style={{ opacity: 0.5, marginBottom: 6 }} />
                  <p style={{ margin: 0 }}>No hay productos añadidos a esta orden. Busque y agregue artículos arriba.</p>
                </div>
              ) : (
                <div className="table-panel products-table-panel" style={{ margin: 0, border: '1px solid var(--border-color)' }}>
                  <div className="table-scroll" style={{ maxHeight: 260 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>SKU</th>
                          <th style={{ textAlign: 'center' }}>Stock Origen</th>
                          <th style={{ textAlign: 'center', width: 120 }}>Cant. a Transferir</th>
                          <th style={{ textAlign: 'center' }}>Stock Destino</th>
                          <th style={{ textAlign: 'center', width: 50 }}>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedItems.map((item) => {
                          const projectedOrigin = item.stockInOrigin - item.units
                          const projectedDest = item.stockInDestination + item.units
                          const isOriginUnderMin = projectedOrigin <= item.minStock && projectedOrigin > 0
                          const isOriginDepleted = projectedOrigin === 0

                          return (
                            <React.Fragment key={item.productId}>
                              <tr>
                                <td>
                                  <strong>{item.productName}</strong>
                                  <span className="category-pill-tag" style={{ display: 'block', width: 'fit-content' }}>
                                    {item.category}
                                  </span>
                                </td>
                                <td>
                                  <span className="code-badge">{item.sku}</span>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                                      Actual: {item.stockInOrigin}
                                    </span>
                                    <strong style={{ color: isOriginDepleted ? 'var(--red)' : isOriginUnderMin ? '#d97706' : 'var(--navy)', fontSize: 12 }}>
                                      Proy: {projectedOrigin} {item.unitOfMeasure}
                                    </strong>
                                  </div>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                    <button
                                      type="button"
                                      className="icon-button"
                                      onClick={() => handleUpdateUnits(item.productId, item.units - 1)}
                                      disabled={item.units <= 1}
                                      style={{ width: 24, height: 24 }}
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      min={1}
                                      max={item.stockInOrigin}
                                      value={item.units}
                                      onChange={(e) => handleUpdateUnits(item.productId, Number(e.target.value))}
                                      style={{
                                        width: 56,
                                        padding: '4px',
                                        fontSize: 12,
                                        textAlign: 'center',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 6,
                                        fontWeight: 700,
                                      }}
                                    />
                                    <button
                                      type="button"
                                      className="icon-button"
                                      onClick={() => handleUpdateUnits(item.productId, item.units + 1)}
                                      disabled={item.units >= item.stockInOrigin}
                                      style={{ width: 24, height: 24 }}
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                                      Actual: {item.stockInDestination}
                                    </span>
                                    <strong style={{ color: 'var(--green)', fontSize: 12 }}>
                                      Proy: {projectedDest} {item.unitOfMeasure}
                                    </strong>
                                  </div>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    className="icon-button"
                                    onClick={() => handleRemoveProduct(item.productId)}
                                    title="Quitar producto de la orden"
                                  >
                                    <AppIcon name="close" size={14} color="var(--red)" />
                                  </button>
                                </td>
                              </tr>

                              {/* Smart Alerts for Origin Low/Zero Stock */}
                              {(isOriginUnderMin || isOriginDepleted) && (
                                <tr>
                                  <td colSpan={6} style={{ padding: '6px 12px', background: isOriginDepleted ? '#fef2f2' : '#fffbeb' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: isOriginDepleted ? '#dc2626' : '#b45309' }}>
                                      <AppIcon name="warning" size={12} />
                                      <span>
                                        {isOriginDepleted
                                          ? `⚠️ Esta transferencia AGOTARÁ completamente las existencias de ${item.productName} en ${originLocation?.name}.`
                                          : `⚠️ Advertencia: Esta transferencia dejará este producto por debajo del stock mínimo (${item.minStock} uds) en ${originLocation?.name}.`}
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              PASO 3: REVISIÓN LOGÍSTICA & CONFIRMACIÓN
             ========================================================================= */}
          {step === 3 && (
            <div className="wizard-step-content page-enter">
              <h4 style={{ margin: '0 0 6px', fontSize: 15, color: 'var(--navy)', fontWeight: 800 }}>
                Paso 3: Revisión y Formalización de la Orden
              </h4>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)' }}>
                Verifique los datos de traslado antes de generar la orden en estado <strong>PENDIENTE</strong>.
              </p>

              {/* Summary Cards */}
              <div
                className="summary-grid-responsive"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}
              >
                <div className="stat-card" style={{ padding: 12 }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Bodega Origen</span>
                  <strong style={{ fontSize: 13, display: 'block', color: 'var(--text-main)', marginTop: 2 }}>
                    {originLocation?.name}
                  </strong>
                  <small className="location-code-tag">{originLocation?.code}</small>
                </div>

                <div className="stat-card" style={{ padding: 12, borderColor: 'var(--navy)' }}>
                  <span style={{ fontSize: 11, color: 'var(--navy)', fontWeight: 700 }}>Bodega Destino</span>
                  <strong style={{ fontSize: 13, display: 'block', color: 'var(--navy)', marginTop: 2 }}>
                    {destinationLocation?.name}
                  </strong>
                  <small className="location-code-tag">{destinationLocation?.code}</small>
                </div>

                <div className="stat-card" style={{ padding: 12 }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Total Artículos</span>
                  <strong style={{ fontSize: 18, color: 'var(--navy)', marginTop: 2 }}>{selectedItems.length} SKUs</strong>
                </div>

                <div className="stat-card" style={{ padding: 12 }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Total Unidades</span>
                  <strong style={{ fontSize: 18, color: 'var(--green)', marginTop: 2 }}>{totalUnits} uds</strong>
                </div>
              </div>

              {/* Form details */}
              <div
                className="form-row-responsive"
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}
              >
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Motivo logístico de la transferencia *
                  </label>
                  <CustomSelect
                    options={REASON_OPTIONS}
                    value={reason}
                    onChange={(val) => setReason(val)}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Referencia interna / N° Solicitud (Opcional):
                  </label>
                  <input
                    type="text"
                    value={internalRef}
                    onChange={(e) => setInternalRef(e.target.value)}
                    placeholder="Ej: SOL-2025-089, REQ-SedeCentro..."
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: 12,
                      border: '1px solid var(--border-color)',
                      borderRadius: 8,
                    }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  Observaciones / Instrucciones de transporte (Opcional):
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Instrucciones para embalaje, chofer, transportadora o novedades especiales..."
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    resize: 'none',
                  }}
                />
              </div>

              {/* Stock Policy Alert */}
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: 10,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <AppIcon name="shield" size={20} color="var(--green)" />
                <span style={{ fontSize: 12, color: '#166534', lineHeight: 1.4 }}>
                  <strong>Regla de Stock:</strong> Al crear la transferencia quedará en estado <strong>PENDIENTE</strong>. El stock saldrá de <strong>{originLocation?.name}</strong> únicamente cuando el despachador confirme la salida con el movimiento <strong>TRANSFER_OUT</strong>.
                </span>
              </div>
            </div>
          )}

          {/* =========================================================================
              PASO 4: ÉXITO Y CONFIRMACIÓN ANIMADA
             ========================================================================= */}
          {step === 4 && (
            <div className="wizard-success-view page-enter" style={{ textAlign: 'center', padding: '36px 20px' }}>
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: '50%',
                  background: '#dcfce7',
                  color: 'var(--green)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <AppIcon name="check" size={38} />
              </div>

              <span className="count-tag-pill" style={{ background: '#eff6ff', color: 'var(--navy)', marginBottom: 8, fontSize: 12 }}>
                Orden Generada
              </span>
              <h3 style={{ fontSize: 22, color: 'var(--navy)', margin: '8px 0', fontWeight: 800 }}>
                Transferencia {createdCode} Creada Exitosamente
              </h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 480, margin: '0 auto 24px', lineHeight: 1.5 }}>
                Se ha registrado la orden de traslado entre <strong>{originLocation?.name}</strong> y <strong>{destinationLocation?.name}</strong> con <strong>{totalUnits} unidades</strong> en estado <strong>PENDIENTE</strong>.
              </p>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                {onViewTransfer && createdCode && (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => {
                      onViewTransfer(createdCode)
                      onClose()
                    }}
                  >
                    <AppIcon name="eye" size={14} />
                    <span>Ver transferencia {createdCode}</span>
                  </button>
                )}

                <button
                  type="button"
                  className="outline-button"
                  onClick={handleResetWizard}
                >
                  <AppIcon name="plus" size={14} />
                  <span>Crear otra transferencia</span>
                </button>

                <button
                  type="button"
                  className="outline-button"
                  onClick={onClose}
                >
                  <span>Cerrar</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Navigation */}
        {step < 4 && (
          <div className="transfer-modal-footer">
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
                <AppIcon name={loading ? 'refresh' : 'check'} size={14} />
                <span>{loading ? 'Creando...' : 'Crear transferencia'}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
