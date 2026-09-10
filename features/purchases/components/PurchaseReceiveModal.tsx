'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { Purchase } from '../types'

interface PurchaseReceiveModalProps {
  purchase: Purchase | null
  isOpen: boolean
  onClose: () => void
  onConfirm: (purchaseId: string, notes?: string) => Promise<void>
}

export function PurchaseReceiveModal({
  purchase,
  isOpen,
  onClose,
  onConfirm,
}: PurchaseReceiveModalProps) {
  const [mounted, setMounted] = useState(false)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isOpen || !purchase || !mounted) return null

  const handleConfirm = async () => {
    setError(null)
    setIsSubmitting(true)
    try {
      await onConfirm(purchase.id, notes.trim() || undefined)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al registrar la recepción de inventario.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalUnits = purchase.items.reduce((acc, it) => acc + it.quantity, 0)

  return createPortal(
    <div
      className="drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="receive-modal-title"
    >
      <div
        className="product-drawer product-detail-drawer page-enter"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 540, width: '92vw' }}
      >
        {/* Header */}
        <div className="drawer-header" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              className="stat-icon green"
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: '#f0fdf4',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name="warehouse" size={20} />
            </div>
            <div>
              <span className="product-category-eyebrow">
                Recepción Física en Bodega
              </span>
              <h3
                id="receive-modal-title"
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 800,
                  color: 'var(--navy)',
                }}
              >
                Ingresar Mercancía al Inventario
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

          <div
            style={{
              padding: 14,
              background: '#f8fafc',
              borderRadius: 8,
              border: '1px solid var(--border)',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 6,
                fontSize: 12,
              }}
            >
              <span style={{ color: 'var(--muted)' }}>Orden de compra:</span>
              <strong style={{ color: 'var(--navy)' }}>
                {purchase.purchaseNumber}
              </strong>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 6,
                fontSize: 12,
              }}
            >
              <span style={{ color: 'var(--muted)' }}>Factura proveedor:</span>
              <span style={{ fontWeight: 600 }}>
                {purchase.supplierInvoiceNumber}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 6,
                fontSize: 12,
              }}
            >
              <span style={{ color: 'var(--muted)' }}>Proveedor:</span>
              <span>{purchase.supplierName}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 6,
                fontSize: 12,
              }}
            >
              <span style={{ color: 'var(--muted)' }}>Bodega de ingreso:</span>
              <strong style={{ color: 'var(--navy)' }}>
                {purchase.destinationLocationName} ({purchase.destinationLocationCode})
              </strong>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                borderTop: '1px solid var(--border)',
                paddingTop: 6,
                marginTop: 6,
              }}
            >
              <span style={{ color: 'var(--muted)' }}>Total a ingresar:</span>
              <strong style={{ color: '#16a34a' }}>
                {totalUnits} unidades ({purchase.items.length} referencias)
              </strong>
            </div>
          </div>

          {/* List of items to receive */}
          <div style={{ marginBottom: 16 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--navy)',
                display: 'block',
                marginBottom: 8,
              }}
            >
              Detalle de productos a ingresar:
            </span>
            <div
              style={{
                maxHeight: 140,
                overflowY: 'auto',
                border: '1px solid var(--border)',
                borderRadius: 6,
              }}
            >
              {purchase.items.map((it) => (
                <div
                  key={it.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderBottom: '1px solid #f1f5f9',
                    fontSize: 12,
                  }}
                >
                  <div>
                    <strong>{it.productName}</strong>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                      SKU: {it.sku}
                    </div>
                  </div>
                  <strong style={{ color: '#16a34a' }}>
                    +{it.quantity} {it.unitOfMeasure}
                  </strong>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 8,
              padding: 12,
              fontSize: 12,
              color: '#1e40af',
              marginBottom: 16,
            }}
          >
            <strong>Efecto en el sistema:</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              <li>
                Aumenta el stock en <code>stock_levels</code> para la bodega destino.
              </li>
              <li>
                Genera registros inmutables en Kardex (<code>inventory_movements</code>).
              </li>
              <li>
                Recalcula el Costo Promedio Ponderado de cada producto.
              </li>
            </ul>
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
              Observaciones de recepción (opcional)
            </label>
            <textarea
              className="filter-date-input"
              style={{
                width: '100%',
                minHeight: 50,
                fontFamily: 'inherit',
                fontSize: 12,
              }}
              placeholder="Estado del empaque, lote recibido, precinto de seguridad..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
            style={{ background: '#16a34a', borderColor: '#16a34a' }}
          >
            <AppIcon name="check" size={14} />
            <span>{isSubmitting ? 'Ingresando...' : 'Confirmar Recepción'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
