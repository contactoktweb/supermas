'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { Purchase } from '../types'

interface PurchaseReceiveModalProps {
  purchase: Purchase | null
  isOpen: boolean
  onClose: () => void
  onConfirm: (
    purchaseId: string,
    notes?: string,
    remission?: string,
    items?: { itemId: string; quantityReceived: number }[]
  ) => Promise<void>
}

export function PurchaseReceiveModal({
  purchase,
  isOpen,
  onClose,
  onConfirm,
}: PurchaseReceiveModalProps) {
  const [mounted, setMounted] = useState(false)
  const [notes, setNotes] = useState('')
  const [remission, setRemission] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quantitiesToReceive, setQuantitiesToReceive] = useState<Record<string, number>>({})

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (purchase) {
      const initial: Record<string, number> = {}
      purchase.items.forEach((it) => {
        const remaining = Math.max(0, it.quantity - (it.receivedQuantity || 0))
        initial[it.id] = remaining
      })
      setQuantitiesToReceive(initial)
      setNotes('')
      setRemission('')
      setError(null)
    }
  }, [purchase])

  if (!isOpen || !purchase || !mounted) return null

  const handleQtyChange = (itemId: string, maxRemaining: number, val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) {
      setQuantitiesToReceive((prev) => ({ ...prev, [itemId]: 0 }))
      return
    }
    const safeNum = Math.min(Math.max(0, num), maxRemaining)
    setQuantitiesToReceive((prev) => ({ ...prev, [itemId]: safeNum }))
  }

  const handleConfirm = async () => {
    setError(null)

    // Validar que al menos un ítem tenga cantidad > 0
    const itemsToReceive: { itemId: string; quantityReceived: number }[] = []
    let totalQty = 0

    for (const it of purchase.items) {
      const qty = quantitiesToReceive[it.id] || 0
      const remaining = Math.max(0, it.quantity - (it.receivedQuantity || 0))

      if (qty > remaining + 0.001) {
        setError(`La cantidad a recibir de ${it.productName} no puede superar el saldo pendiente (${remaining}).`)
        return
      }

      if (qty > 0) {
        itemsToReceive.push({ itemId: it.id, quantityReceived: qty })
        totalQty += qty
      }
    }

    if (itemsToReceive.length === 0 || totalQty <= 0) {
      setError('Debe indicar al menos una unidad a recibir en esta entrega.')
      return
    }

    setIsSubmitting(true)
    try {
      await onConfirm(
        purchase.id,
        notes.trim() || undefined,
        remission.trim() || undefined,
        itemsToReceive
      )
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al registrar la recepción de inventario.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalUnitsToReceive = Object.values(quantitiesToReceive).reduce((acc, q) => acc + (q || 0), 0)

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
        style={{ maxWidth: 640, width: '94vw' }}
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
                Recepción de Mercancía en Bodega
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
                Acta de Entrada física al Inventario
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
              <span>{purchase.supplierName} ({purchase.supplierNit})</span>
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
              <span style={{ color: 'var(--muted)' }}>Total a recibir en esta acta:</span>
              <strong style={{ color: '#16a34a' }}>
                {totalUnitsToReceive} unidades
              </strong>
            </div>
          </div>

          {/* List of items to receive */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--navy)',
                }}
              >
                Productos y cantidades a recibir (Parcial / Total):
              </span>
              <button
                type="button"
                className="outline-button"
                style={{ fontSize: 11, padding: '2px 8px', height: 26 }}
                onClick={() => {
                  const allMax: Record<string, number> = {}
                  purchase.items.forEach((it) => {
                    allMax[it.id] = Math.max(0, it.quantity - (it.receivedQuantity || 0))
                  })
                  setQuantitiesToReceive(allMax)
                }}
              >
                Recibir todo el saldo pendiente
              </button>
            </div>

            <div
              style={{
                maxHeight: 180,
                overflowY: 'auto',
                border: '1px solid var(--border)',
                borderRadius: 6,
              }}
            >
              {purchase.items.map((it) => {
                const remaining = Math.max(0, it.quantity - (it.receivedQuantity || 0))
                const currentReceiveVal = quantitiesToReceive[it.id] ?? remaining

                return (
                  <div
                    key={it.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderBottom: '1px solid #f1f5f9',
                      fontSize: 12,
                      background: remaining === 0 ? '#f8fafc' : '#fff',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                      <strong style={{ display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {it.productName}
                      </strong>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                        SKU: {it.sku} | Pedido: <b>{it.quantity}</b> | Ya recibido: <b>{it.receivedQuantity || 0}</b> | Pendiente: <b style={{ color: remaining > 0 ? '#ea580c' : '#16a34a' }}>{remaining}</b>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <label style={{ fontSize: 11, color: 'var(--muted)' }}>Recibir:</label>
                      <input
                        type="number"
                        min="0"
                        max={remaining}
                        step="1"
                        disabled={remaining === 0}
                        value={currentReceiveVal}
                        onChange={(e) => handleQtyChange(it.id, remaining, e.target.value)}
                        style={{
                          width: 70,
                          padding: '4px 6px',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          textAlign: 'right',
                          fontWeight: 700,
                          color: '#16a34a',
                          background: remaining === 0 ? '#e2e8f0' : '#fff',
                        }}
                      />
                      <span style={{ fontSize: 11, color: 'var(--muted)', width: 30 }}>{it.unitOfMeasure}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                No. Remisión / Guía Proveedor
              </label>
              <input
                type="text"
                className="filter-date-input"
                style={{ width: '100%', fontSize: 12 }}
                placeholder="Ej. REM-98234"
                value={remission}
                onChange={(e) => setRemission(e.target.value)}
              />
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
                Observaciones de recepción
              </label>
              <input
                type="text"
                className="filter-date-input"
                style={{ width: '100%', fontSize: 12 }}
                placeholder="Estado del empaque, precintos..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 8,
              padding: 10,
              fontSize: 11,
              color: '#1e40af',
            }}
          >
            <strong>Efecto en el sistema:</strong>
            <ul style={{ margin: '2px 0 0', paddingLeft: 18 }}>
              <li>
                Ingreso al Kardex inmutable bajo movimiento <code>PURCHASE_ENTRY</code>.
              </li>
              <li>
                Actualización del inventario y recálculo automático del Costo Promedio Ponderado.
              </li>
              <li>
                Generación del acta fiduciaria de recepción con número consecutivo auditable.
              </li>
            </ul>
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
            disabled={isSubmitting || totalUnitsToReceive <= 0}
            style={{ background: '#16a34a', borderColor: '#16a34a' }}
          >
            <AppIcon name="check" size={14} />
            <span>{isSubmitting ? 'Procesando entrada...' : `Confirmar Ingreso (${totalUnitsToReceive} un)`}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
