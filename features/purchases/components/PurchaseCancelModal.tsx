'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { Purchase } from '../types'

interface PurchaseCancelModalProps {
  purchase: Purchase | null
  isOpen: boolean
  onClose: () => void
  onConfirm: (purchaseId: string, reason: string) => Promise<void>
}

export function PurchaseCancelModal({
  purchase,
  isOpen,
  onClose,
  onConfirm,
}: PurchaseCancelModalProps) {
  const [mounted, setMounted] = useState(false)
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (purchase) {
      setReason('')
      setError(null)
    }
  }, [purchase])

  if (!isOpen || !purchase || !mounted) return null

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError('Debe especificar el motivo de anulación.')
      return
    }

    setError(null)
    setIsSubmitting(true)
    try {
      await onConfirm(purchase.id, reason.trim())
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al anular la compra.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-modal-title"
    >
      <div
        className="product-drawer product-detail-drawer page-enter"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 480, width: '92vw' }}
      >
        {/* Header */}
        <div className="drawer-header" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              className="stat-icon red"
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: '#fef2f2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name="close" size={20} />
            </div>
            <div>
              <span className="product-category-eyebrow">
                Operaciones Comerciales
              </span>
              <h3
                id="cancel-modal-title"
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 800,
                  color: 'var(--navy)',
                }}
              >
                Anular Orden de Compra
              </h3>
            </div>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <AppIcon name="close" size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="drawer-body" style={{ padding: 20 }}>
          {error && (
            <div
              className="incident-alert-banner page-enter"
              style={{
                background: '#fef2f2',
                borderColor: '#fca5a5',
                padding: '10px 14px',
                borderRadius: 8,
                marginBottom: 14,
                color: '#dc2626',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AppIcon name="warning" size={16} />
              <span>{error}</span>
            </div>
          )}

          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-main)' }}>
            ¿Está seguro de anular la orden de compra{' '}
            <strong>{purchase.purchaseNumber}</strong> del proveedor{' '}
            <strong>{purchase.supplierName}</strong>?
          </p>

          <div
            style={{
              padding: 12,
              background: '#fffbeb',
              borderRadius: 8,
              border: '1px solid #fef3c7',
              color: '#b45309',
              fontSize: 12,
              marginBottom: 16,
            }}
          >
            <strong>Advertencia:</strong> Esta acción no se puede deshacer y quedará
            registrada en la bitácora de auditoría del sistema.
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 6,
              }}
            >
              Motivo de la anulación <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              className="filter-date-input"
              style={{
                width: '100%',
                minHeight: 70,
                fontFamily: 'inherit',
                fontSize: 12,
              }}
              placeholder="Ej. Factura cancelada por el proveedor por error en precios, pedido duplicado..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="drawer-footer"
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            background: '#fff',
          }}
        >
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
            disabled={isSubmitting}
            style={{ background: '#dc2626', borderColor: '#dc2626' }}
          >
            <AppIcon name="close" size={14} />
            <span>{isSubmitting ? 'Anulando...' : 'Confirmar Anulación'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
