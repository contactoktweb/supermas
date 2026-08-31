'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { Product } from '../types'

interface ProductDeactivateDialogProps {
  product: Product | null
  isOpen: boolean
  onClose: () => void
  onConfirm: (id: string, reason: string) => Promise<void>
}

export function ProductDeactivateDialog({
  product,
  isOpen,
  onClose,
  onConfirm,
}: ProductDeactivateDialogProps) {
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

  if (!isOpen || !product || !mounted) return null

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true)
      setError(null)
      await onConfirm(product.id, reason.trim() || 'Desactivación de producto desde catálogo')
      onClose()
    } catch (err: any) {
      setError(err.message || 'No se pudo desactivar el producto')
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
        className="deactivate-dialog-card page-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header-warning">
          <div className="dialog-header-title">
            <div className="stat-icon red">
              <AppIcon name="warning" size={20} />
            </div>
            <div>
              <p className="eyebrow">Desactivación Lógica</p>
              <h3>Desactivar Producto del Catálogo</h3>
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
            ¿Estás seguro de que deseas desactivar el producto{' '}
            <strong>{product.name}</strong> (SKU: <code>{product.sku}</code>)?
          </p>

          <div className="blocker-warning-box">
            <div className="blocker-head">
              <AppIcon name="audit" size={16} />
              <strong>Protección Histórica (Soft Delete):</strong>
            </div>
            <ul>
              <li>El producto dejará de estar disponible para nuevas ventas y en la web.</li>
              <li>Se preservan íntegros todos los históricos de ventas, compras, Kardex y contabilidad.</li>
              <li>El producto no será eliminado físicamente de la base de datos.</li>
            </ul>
          </div>

          <div className="form-field" style={{ marginTop: 14 }}>
            <label>Motivo de la desactivación (Requerido para auditoría)</label>
            <div className="input-wrap">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej. Producto descontinuado por fabricante / Fin de temporada"
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
            className="danger-button"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            <AppIcon name="warning" size={15} />
            <span>{isSubmitting ? 'Desactivando...' : 'Confirmar desactivación'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
