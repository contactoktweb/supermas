'use client'

import React, { useState, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect, SelectOption } from '@/components/ui/CustomSelect'
import { FileUpload } from '@/components/ui/FileUpload'
import { StockAdjustmentInput, ConsolidatedProductStock, InventoryStockLevel } from '../types'
import { stockAdjustmentSchema } from '../schemas/inventory.schema'

interface InventoryAdjustModalProps {
  isOpen: boolean
  productId?: string
  locationId?: string
  consolidatedProducts: ConsolidatedProductStock[]
  stockLevels: InventoryStockLevel[]
  onClose: () => void
  onSubmit: (data: StockAdjustmentInput) => Promise<void>
}

const LOCATION_OPTIONS: SelectOption[] = [
  { value: 'loc-01', label: 'Bodega Principal Cali', badge: 'BOD-PRI-01' },
  { value: 'loc-02', label: 'Punto Centro - Cra 5', badge: 'POS-CEN-01' },
  { value: 'loc-03', label: 'Bodega Norte - Yumbo', badge: 'BOD-NOR-01' },
  { value: 'loc-04', label: 'Punto Sur - Ciudad Jardín', badge: 'POS-SUR-01' },
]

export function InventoryAdjustModal({
  isOpen,
  productId,
  locationId,
  consolidatedProducts,
  stockLevels,
  onClose,
  onSubmit,
}: InventoryAdjustModalProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>(productId || '')
  const [selectedLocationId, setSelectedLocationId] = useState<string>(locationId || 'loc-01')
  const [adjustmentType, setAdjustmentType] = useState<'IN' | 'OUT'>('IN')
  const [quantity, setQuantity] = useState<number>(1)
  const [reason, setReason] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [evidenceUrl, setEvidenceUrl] = useState<string>('')
  const [responsibleName, setResponsibleName] = useState<string>('Mauricio Andrade (Administrador)')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (productId) setSelectedProductId(productId)
    if (locationId) setSelectedLocationId(locationId)
    else if (!selectedLocationId) setSelectedLocationId('loc-01')
  }, [productId, locationId])

  if (!isOpen) return null

  // Compute current stock for selected product and location
  const currentLevel = stockLevels.find(
    (s) => s.productId === selectedProductId && s.locationId === selectedLocationId
  )
  const currentStock = currentLevel ? currentLevel.currentStock : 0

  // Compute resulting stock
  const resultingStock =
    adjustmentType === 'IN' ? currentStock + (quantity || 0) : currentStock - (quantity || 0)

  const productOptions: SelectOption[] = consolidatedProducts.map((p) => ({
    value: p.productId,
    label: `${p.productName} (${p.sku})`,
    description: `Categoría: ${p.category}`,
  }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    const payload: StockAdjustmentInput = {
      productId: selectedProductId,
      locationId: selectedLocationId,
      type: adjustmentType,
      quantity,
      reason,
      notes: notes || undefined,
      evidenceUrl: evidenceUrl || undefined,
      responsibleUserName: responsibleName,
    }

    const validation = stockAdjustmentSchema.safeParse(payload)
    if (!validation.success) {
      setErrorMsg(validation.error.issues[0]?.message || 'Datos del ajuste inválidos')
      return
    }

    if (adjustmentType === 'OUT' && quantity > currentStock) {
      setErrorMsg(
        `No es posible retirar ${quantity} unidades porque el saldo actual en esta bodega es de ${currentStock} unidades.`
      )
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(payload)
      onClose()
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar el ajuste de inventario')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="drawer-backdrop modal-center" onClick={onClose}>
      <div
        className="modal-card inventory-adjust-modal animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Ajustar inventario"
      >
        <div className="modal-header">
          <div className="modal-header-title">
            <div className="modal-icon-badge">
              <AppIcon name="sliders" size={18} color="var(--navy)" />
            </div>
            <div>
              <h3>Ajustar existencias de inventario</h3>
              <p>Registra un movimiento manual con trazabilidad en el Kardex.</p>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar modal">
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

          {/* 1. Seleccionar Bodega */}
          <div className="input-field-block">
            <label>
              Bodega física de aplicación <span className="req">*</span>
            </label>
            <CustomSelect
              value={selectedLocationId}
              onChange={(val) => setSelectedLocationId(val)}
              options={LOCATION_OPTIONS}
              placeholder="Seleccionar bodega..."
              size="md"
            />
          </div>

          {/* 2. Seleccionar Producto */}
          <div className="input-field-block">
            <label>
              Producto a ajustar <span className="req">*</span>
            </label>
            <CustomSelect
              value={selectedProductId}
              onChange={(val) => setSelectedProductId(val)}
              options={productOptions}
              placeholder="Seleccionar producto del catálogo..."
              size="md"
            />
          </div>

          {/* 3. Tipo de Ajuste & Cantidad */}
          <div className="form-grid-2">
            <div className="input-field-block">
              <label>
                Tipo de ajuste <span className="req">*</span>
              </label>
              <div className="type-toggle-group">
                <button
                  type="button"
                  className={`type-btn in ${adjustmentType === 'IN' ? 'active' : ''}`}
                  onClick={() => setAdjustmentType('IN')}
                >
                  <AppIcon name="plusMinus" size={13} />
                  <span>Entrada (+)</span>
                </button>
                <button
                  type="button"
                  className={`type-btn out ${adjustmentType === 'OUT' ? 'active' : ''}`}
                  onClick={() => setAdjustmentType('OUT')}
                >
                  <AppIcon name="close" size={13} />
                  <span>Salida (-)</span>
                </button>
              </div>
            </div>

            <div className="input-field-block">
              <label>
                Cantidad a ajustar <span className="req">*</span>
              </label>
              <input
                type="number"
                min="1"
                className="custom-form-input"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                required
              />
            </div>
          </div>

          {/* Visual Delta Preview */}
          <div className="stock-delta-preview-box">
            <div className="delta-step">
              <span className="delta-label">Existencia actual</span>
              <strong className="delta-num">{currentStock} uds</strong>
            </div>
            <div className="delta-arrow">
              <AppIcon
                name="arrowRight"
                size={16}
                color={adjustmentType === 'IN' ? 'var(--green)' : 'var(--red)'}
              />
            </div>
            <div className="delta-step">
              <span className="delta-label">Existencia resultante</span>
              <strong
                className="delta-num"
                style={{
                  color: resultingStock < 0 ? 'var(--red)' : 'var(--navy)',
                }}
              >
                {resultingStock} uds
              </strong>
            </div>
          </div>

          {/* 4. Motivo del Ajuste */}
          <div className="input-field-block">
            <label>
              Motivo del ajuste <span className="req">*</span>
            </label>
            <input
              type="text"
              className="custom-form-input"
              placeholder="Ej: Diferencia por conteo físico, avería, muestra comercial..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>

          {/* 5. Observaciones adicionales */}
          <div className="input-field-block">
            <label>Observaciones o justificación</label>
            <textarea
              className="custom-form-textarea"
              rows={2}
              placeholder="Detalles adicionales para auditoría..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* 6. Evidencia / Comprobante (FileUpload) */}
          <div className="input-field-block">
            <label>Comprobante o acta de ajuste (opcional)</label>
            <FileUpload
              label="Foto del producto o acta firmada"
              accept="image/*,.pdf"
              maxSizeMB={5}
              value={evidenceUrl}
              onChange={(val) => setEvidenceUrl(val || '')}
            />
          </div>

          {/* 7. Responsable */}
          <div className="input-field-block">
            <label>Responsable del ajuste</label>
            <input
              type="text"
              className="custom-form-input"
              value={responsibleName}
              onChange={(e) => setResponsibleName(e.target.value)}
            />
          </div>

          {/* Footer Actions */}
          <div className="modal-footer">
            <button type="button" className="outline-button compact" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className="primary-button compact"
              disabled={isSubmitting || resultingStock < 0}
            >
              <AppIcon name="check" size={14} />
              <span>{isSubmitting ? 'Aplicando ajuste...' : 'Confirmar ajuste'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
