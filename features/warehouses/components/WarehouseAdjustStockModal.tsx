import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { WarehouseInventoryItem } from '../types'
import { stockAdjustmentSchema, StockAdjustmentFormData } from '../schemas/warehouse.schema'
import { CustomSelect } from '@/components/ui/CustomSelect'

interface WarehouseAdjustStockModalProps {
  locationId: string
  locationName: string
  item: WarehouseInventoryItem | null
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: StockAdjustmentFormData) => Promise<void>
}

export function WarehouseAdjustStockModal({
  locationId,
  locationName,
  item,
  isOpen,
  onClose,
  onSubmit,
}: WarehouseAdjustStockModalProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  const [formData, setFormData] = useState<{
    type: 'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO'
    quantity: number | string
    reason: StockAdjustmentFormData['reason']
    documentRef: string
    notes: string
  }>({
    type: 'AJUSTE_POSITIVO',
    quantity: 1,
    reason: 'CONTEO_FISICO',
    documentRef: '',
    notes: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen || !item || !mounted) return null

  const currentStock = item.currentStock
  const qtyNumber = Number(formData.quantity) || 0
  const resultingStock =
    formData.type === 'AJUSTE_POSITIVO'
      ? currentStock + qtyNumber
      : currentStock - qtyNumber

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    try {
      const payload: StockAdjustmentFormData = {
        locationId,
        productId: item.productId,
        type: formData.type,
        quantity: Number(formData.quantity),
        reason: formData.reason,
        documentRef: formData.documentRef || undefined,
        notes: formData.notes.trim(),
      }

      const validated = stockAdjustmentSchema.parse(payload)

      if (validated.type === 'AJUSTE_NEGATIVO' && currentStock - validated.quantity < 0) {
        setErrors({
          quantity: `El saldo resultante no puede ser negativo (Saldo actual: ${currentStock} uds)`,
        })
        return
      }

      setIsSubmitting(true)
      setErrors({})
      await onSubmit(validated)
      onClose()
    } catch (err: any) {
      if (err.errors) {
        const fieldErrors: Record<string, string> = {}
        err.errors.forEach((zErr: any) => {
          fieldErrors[zErr.path.join('.')] = zErr.message
        })
        setErrors(fieldErrors)
      } else {
        setErrors({ general: err.message || 'Error al procesar el ajuste de inventario' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="drawer-backdrop modal-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="deactivate-dialog-card modal-lg page-enter"
        onClick={(e) => e.stopPropagation()}
        aria-labelledby="adjust-modal-title"
      >
        <div className="dialog-header-standard">
          <div className="dialog-header-title">
            <div className="stat-icon teal">
              <AppIcon name="inventory" size={22} />
            </div>
            <div>
              <p className="eyebrow">Control de existencias e inventario</p>
              <h3 id="adjust-modal-title">Ajuste de inventario en {locationName}</h3>
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

        <div className="adjust-product-summary">
          <div>
            <strong>{item.productName}</strong>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <span className="code-badge">{item.sku}</span>
              {item.barcode && <span className="time-muted">{item.barcode}</span>}
              <span className="time-muted">{item.category}</span>
            </div>
          </div>
          <div className="adjust-stock-preview">
            <div>
              <span>Existencia actual</span>
              <b>{currentStock} uds</b>
            </div>
            <div className="arrow-sep">➔</div>
            <div>
              <span>Saldo resultante</span>
              <b
                style={{
                  color:
                    resultingStock < 0
                      ? 'var(--red)'
                      : resultingStock < item.minStock
                      ? 'var(--amber)'
                      : 'var(--green)',
                }}
              >
                {resultingStock} uds
              </b>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {errors.general && (
            <div className="form-error-banner">
              <AppIcon name="warning" size={16} />
              <span>{errors.general}</span>
            </div>
          )}

          <div className="form-grid-2">
            <div className="input-field-block">
              <label>Tipo de movimiento <span className="req">*</span></label>
              <div className="segmented-toggle-wrap">
                <button
                  type="button"
                  className={formData.type === 'AJUSTE_POSITIVO' ? 'selected positive' : ''}
                  onClick={() => setFormData((prev) => ({ ...prev, type: 'AJUSTE_POSITIVO' }))}
                >
                  + Entrada (Sobrante / Ajuste)
                </button>
                <button
                  type="button"
                  className={formData.type === 'AJUSTE_NEGATIVO' ? 'selected negative' : ''}
                  onClick={() => setFormData((prev) => ({ ...prev, type: 'AJUSTE_NEGATIVO' }))}
                >
                  - Salida (Merma / Pérdida)
                </button>
              </div>
            </div>

            <div className="input-field-block">
              <label htmlFor="adjust-qty">
                Cantidad a ajustar ({formData.type === 'AJUSTE_POSITIVO' ? '+' : '-'}) <span className="req">*</span>
              </label>
              <input
                id="adjust-qty"
                type="number"
                min="1"
                step="1"
                className="input-wrap"
                value={formData.quantity}
                onChange={(e) => setFormData((prev) => ({ ...prev, quantity: e.target.value }))}
                required
              />
              {errors.quantity && <span className="field-error">{errors.quantity}</span>}
            </div>
          </div>

          <div className="form-grid-2" style={{ marginTop: 12 }}>
            <div className="input-field-block">
              <label htmlFor="adjust-reason">Motivo / Causa justificada <span className="req">*</span></label>
              <CustomSelect
                id="adjust-reason"
                value={formData.reason}
                onChange={(val) => setFormData((prev) => ({ ...prev, reason: val as any }))}
                options={[
                  {
                    value: 'CONTEO_FISICO',
                    label: 'Conteo físico / Auditoría periódica',
                    description: 'Diferencia constatada en recuento presencial',
                  },
                  {
                    value: 'MERMA_ROTURA',
                    label: 'Merma / Producto averiado o roto',
                    description: 'Deterioro o rotura de empaque',
                  },
                  {
                    value: 'PRODUCTO_VENCIDO',
                    label: 'Producto vencido / Caducado',
                    description: 'Fecha de vencimiento superada',
                  },
                  {
                    value: 'ERROR_REGISTRO',
                    label: 'Corrección por error de digitación previo',
                    description: 'Ajuste contable por error humano',
                  },
                  {
                    value: 'DEVOLUCION_INTERNA',
                    label: 'Devolución interna / Garantía',
                    description: 'Reingreso o salida por garantía de calidad',
                  },
                  {
                    value: 'OTRO',
                    label: 'Otro motivo justificado',
                    description: 'Requiere soporte en observaciones',
                  },
                ]}
              />
              {errors.reason && <span className="field-error">{errors.reason}</span>}
            </div>

            <div className="input-field-block">
              <label htmlFor="adjust-doc">Documento soporte / Acta (Opcional)</label>
              <input
                id="adjust-doc"
                type="text"
                placeholder="Ej. ACTA-2025-084"
                className="input-wrap"
                value={formData.documentRef}
                onChange={(e) => setFormData((prev) => ({ ...prev, documentRef: e.target.value }))}
              />
            </div>
          </div>

          <div className="input-field-block" style={{ marginTop: 12 }}>
            <label htmlFor="adjust-notes">
              Detalle y justificación del movimiento <span className="req">*</span>
            </label>
            <textarea
              id="adjust-notes"
              rows={3}
              className="styled-textarea"
              placeholder="Explica detalladamente la razón de este ajuste. Esta información quedará registrada en el Kardex y en el log de auditoría..."
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              required
            />
            {errors.notes && <span className="field-error">{errors.notes}</span>}
          </div>

          <div className="dialog-footer">
            <button
              type="button"
              className="outline-button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="primary-button"
              disabled={isSubmitting || resultingStock < 0}
            >
              <AppIcon name="check" size={16} />
              <span>{isSubmitting ? 'Registrando...' : 'Confirmar ajuste en Kardex'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
