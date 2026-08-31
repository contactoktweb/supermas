'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { InventoryMovement } from '../types'

interface KardexRevertModalProps {
  movement: InventoryMovement | null
  isOpen: boolean
  onClose: () => void
  onConfirm: (movementId: string, reason: string) => Promise<void>
}

export function KardexRevertModal({
  movement,
  isOpen,
  onClose,
  onConfirm,
}: KardexRevertModalProps) {
  const [mounted, setMounted] = useState(false)
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setReason('')
      setError(null)
    }
  }, [isOpen])

  if (!isOpen || !movement || !mounted) return null

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError('El motivo de la reversión es obligatorio para auditoría')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)
      await onConfirm(movement.id, reason.trim())
      onClose()
    } catch (err: any) {
      setError(err.message || 'No se pudo generar la reversión del movimiento')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isOriginalEntry = movement.quantityIn > 0
  const qty = isOriginalEntry ? movement.quantityIn : movement.quantityOut

  return createPortal(
    <div
      className="drawer-backdrop modal-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="deactivate-dialog-card page-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header-warning">
          <div className="dialog-header-title">
            <div className="stat-icon amber">
              <AppIcon name="refresh" size={20} />
            </div>
            <div>
              <p className="eyebrow">Auditoría e Inmutabilidad</p>
              <h3>Generar Reversión Compensatoria</h3>
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

        <div className="dialog-body">
          <p className="dialog-text-main">
            Se registrará un movimiento de reversión para anular el impacto del movimiento{' '}
            <strong>{movement.movementNumber}</strong> ({movement.productName}).
          </p>

          <div className="blocker-warning-box">
            <div className="blocker-head">
              <AppIcon name="shield" size={16} />
              <strong>Regla de Inmutabilidad del Kardex:</strong>
            </div>
            <ul>
              <li>El movimiento original <strong>no será eliminado ni modificado</strong>.</li>
              <li>
                Se creará un asiento de reversión tipo <code>REVERSION</code> que ajustará{' '}
                <strong>{isOriginalEntry ? `-${qty}` : `+${qty}`} {movement.unitOfMeasure}s</strong> en{' '}
                {movement.locationName}.
              </li>
              <li>Ambos registros quedarán vinculados permanentemente para auditoría.</li>
            </ul>
          </div>

          <div className="form-field" style={{ marginTop: 14 }}>
            <label>Motivo detallado de la reversión <em>*</em></label>
            <div className="input-wrap">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej. Anulación de venta por error de digitación en caja / Factura cancelada"
                required
              />
            </div>
          </div>

          {error && (
            <div className="form-error-banner" style={{ marginTop: 12 }}>
              <AppIcon name="warning" size={14} />
              <span>{error}</span>
            </div>
          )}
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
            type="button"
            className="primary-button"
            onClick={handleConfirm}
            disabled={isSubmitting || !reason.trim()}
          >
            <AppIcon name="refresh" size={15} />
            <span>{isSubmitting ? 'Registrando reversión...' : 'Confirmar reversión'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
