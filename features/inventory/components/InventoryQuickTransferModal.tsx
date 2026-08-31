'use client'

import React, { useState, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect, SelectOption } from '@/components/ui/CustomSelect'
import { ConsolidatedProductStock, QuickTransferInput } from '../types'
import { quickTransferSchema } from '../schemas/inventory.schema'

interface InventoryQuickTransferModalProps {
  isOpen: boolean
  productId?: string
  originLocationId?: string
  consolidatedProducts: ConsolidatedProductStock[]
  onClose: () => void
  onSubmit: (data: QuickTransferInput) => Promise<void>
}

const LOCATION_OPTIONS: SelectOption[] = [
  { value: 'loc-01', label: 'Bodega Principal Cali', badge: 'BOD-PRI-01' },
  { value: 'loc-02', label: 'Punto Centro - Cra 5', badge: 'POS-CEN-01' },
  { value: 'loc-03', label: 'Bodega Norte - Yumbo', badge: 'BOD-NOR-01' },
  { value: 'loc-04', label: 'Punto Sur - Ciudad Jardín', badge: 'POS-SUR-01' },
]

export function InventoryQuickTransferModal({
  isOpen,
  productId,
  originLocationId,
  consolidatedProducts,
  onClose,
  onSubmit,
}: InventoryQuickTransferModalProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>(productId || '')
  const [originId, setOriginId] = useState<string>(originLocationId || 'loc-01')
  const [destinationId, setDestinationId] = useState<string>('loc-02')
  const [quantity, setQuantity] = useState<number>(10)
  const [notes, setNotes] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (productId) setSelectedProductId(productId)
    if (originLocationId) setOriginId(originLocationId)
  }, [productId, originLocationId])

  if (!isOpen) return null

  const selectedProduct = consolidatedProducts.find((p) => p.productId === selectedProductId)

  const originLocationStock =
    selectedProduct?.locationBreakdown.find((l) => l.locationId === originId)?.stock || 0

  const destinationLocationStock =
    selectedProduct?.locationBreakdown.find((l) => l.locationId === destinationId)?.stock || 0

  const productOptions: SelectOption[] = consolidatedProducts.map((p) => ({
    value: p.productId,
    label: `${p.productName} (${p.sku})`,
    description: `Total: ${p.totalStock} ${p.unitOfMeasure}`,
  }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!selectedProduct) {
      setErrorMsg('Debes seleccionar un producto válido')
      return
    }

    const payload: QuickTransferInput = {
      productId: selectedProduct.productId,
      productName: selectedProduct.productName,
      sku: selectedProduct.sku,
      originLocationId: originId,
      destinationLocationId: destinationId,
      quantity,
      notes: notes || undefined,
    }

    const validation = quickTransferSchema.safeParse(payload)
    if (!validation.success) {
      setErrorMsg(validation.error.issues[0]?.message || 'Datos de transferencia inválidos')
      return
    }

    if (quantity > originLocationStock) {
      setErrorMsg(
        `La bodega de origen solo dispone de ${originLocationStock} unidades de este producto.`
      )
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(payload)
      onClose()
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al iniciar la transferencia')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="drawer-backdrop modal-center" onClick={onClose}>
      <div
        className="modal-card quick-transfer-modal animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Nueva transferencia de inventario"
      >
        <div className="modal-header">
          <div className="modal-header-title">
            <div className="modal-icon-badge">
              <AppIcon name="transfers" size={18} color="var(--navy)" />
            </div>
            <div>
              <h3>Nueva transferencia entre bodegas</h3>
              <p>Traslada existencias manteniendo el saldo y la trazabilidad.</p>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">
            <AppIcon name="close" size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {errorMsg && (
            <div className="form-error-banner">
              <AppIcon name="warning" size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Seleccionar Producto */}
          <div className="input-field-block">
            <label>
              Producto a transferir <span className="req">*</span>
            </label>
            <CustomSelect
              value={selectedProductId}
              onChange={(val) => setSelectedProductId(val)}
              options={productOptions}
              placeholder="Seleccionar producto..."
              size="md"
            />
          </div>

          {/* Real Availability Distribution Card */}
          {selectedProduct && (
            <div className="transfer-availability-banner">
              <span className="banner-title">Disponibilidad en bodegas:</span>
              <div className="banner-locations-row">
                {selectedProduct.locationBreakdown.map((l) => (
                  <div
                    key={l.locationId}
                    className={`loc-stock-chip ${
                      l.locationId === originId ? 'selected-origin' : ''
                    }`}
                  >
                    <span>{l.locationName}:</span>
                    <strong>{l.stock} uds</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Origen y Destino */}
          <div className="form-grid-2">
            <div className="input-field-block">
              <label>
                Bodega Origen <span className="req">*</span>
              </label>
              <CustomSelect
                value={originId}
                onChange={(val) => setOriginId(val)}
                options={LOCATION_OPTIONS}
                size="md"
              />
              <span className="field-helper">
                Disponible en origen: <b>{originLocationStock} uds</b>
              </span>
            </div>

            <div className="input-field-block">
              <label>
                Bodega Destino <span className="req">*</span>
              </label>
              <CustomSelect
                value={destinationId}
                onChange={(val) => setDestinationId(val)}
                options={LOCATION_OPTIONS}
                size="md"
              />
              <span className="field-helper">
                Actual en destino: <b>{destinationLocationStock} uds</b>
              </span>
            </div>
          </div>

          {/* 3. Cantidad a transferir */}
          <div className="input-field-block">
            <label>
              Cantidad de unidades a transferir <span className="req">*</span>
            </label>
            <input
              type="number"
              min="1"
              max={originLocationStock}
              className="custom-form-input"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              required
            />
          </div>

          {/* 4. Notas */}
          <div className="input-field-block">
            <label>Instrucciones de traslado / Notas</label>
            <input
              type="text"
              className="custom-form-input"
              placeholder="Ej: Traslado urgente por desabastecimiento en punto de venta..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Modal Footer */}
          <div className="modal-footer">
            <button type="button" className="outline-button compact" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className="primary-button compact"
              disabled={isSubmitting || originLocationStock <= 0 || quantity > originLocationStock}
            >
              <AppIcon name="transfers" size={14} />
              <span>{isSubmitting ? 'Procesando...' : 'Iniciar transferencia'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
