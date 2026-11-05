'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { Purchase } from '../types'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface PurchaseShortageCloseModalProps {
  purchase: Purchase | null
  isOpen: boolean
  isCostRedacted?: boolean
  onClose: () => void
  onConfirm: (purchaseId: string, reason: string) => Promise<void>
  /** Motivo ya escrito al recibir la entrega incompleta. */
  initialReason?: string
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)

/**
 * Cierra una orden recibida parcialmente cuando el proveedor no enviará lo que falta:
 * la orden queda en lo recibido y la cuenta por pagar se recalcula.
 */
export function PurchaseShortageCloseModal({
  purchase,
  isOpen,
  isCostRedacted = false,
  onClose,
  onConfirm,
  initialReason = '',
}: PurchaseShortageCloseModalProps) {
  const [mounted, setMounted] = useState(false)
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (purchase) {
      setReason(initialReason)
      setError(null)
    }
  }, [purchase, initialReason])

  useEscapeKey(isOpen && !isSubmitting, onClose)

  // Mismas reglas de redondeo que la orden: subtotal, descuento e IVA por línea.
  const summary = useMemo(() => {
    const lines = (purchase?.items || []).map((it) => {
      const received = it.receivedQuantity || 0
      const sub = Math.round(received * it.unitCost)
      const disc = Math.round(sub * ((it.discountPercent || 0) / 100))
      const tax = Math.round((sub - disc) * ((it.taxRatePercent || 0) / 100))
      return { ...it, received, missing: Math.max(0, it.quantity - received), newTotal: sub - disc + tax }
    })
    return { lines, newTotal: lines.reduce((acc, l) => acc + l.newTotal, 0) }
  }, [purchase])

  if (!isOpen || !purchase || !mounted) return null

  const handleConfirm = async () => {
    if (reason.trim().length < 5) {
      setError('Escriba el motivo del faltante (mínimo 5 caracteres).')
      return
    }
    setError(null)
    setIsSubmitting(true)
    try {
      await onConfirm(purchase.id, reason.trim())
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo cerrar la orden.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div className="drawer-backdrop" onClick={isSubmitting ? undefined : onClose} role="dialog" aria-modal="true" aria-labelledby="shortage-modal-title">
      <div
        className="product-drawer product-drawer-flush product-detail-drawer page-enter"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560, width: '92vw' }}
      >
        <div className="drawer-header" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              className="stat-icon"
              style={{ width: 40, height: 40, borderRadius: 10, background: '#fffbeb', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <AppIcon name="warning" size={20} />
            </div>
            <div>
              <span className="product-category-eyebrow">Recepción de mercancía</span>
              <h3 id="shortage-modal-title" style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--navy)' }}>
                Cerrar con faltante
              </h3>
            </div>
          </div>
          <button type="button" className="drawer-close-btn" onClick={onClose} disabled={isSubmitting} aria-label="Cerrar">
            <AppIcon name="close" size={16} />
          </button>
        </div>

        <div className="drawer-body" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div
              role="alert"
              className="incident-alert-banner page-enter"
              style={{ background: '#fef2f2', borderColor: '#fca5a5', padding: '10px 14px', borderRadius: 8, color: '#dc2626', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <AppIcon name="warning" size={16} />
              <span>{error}</span>
            </div>
          )}

          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-main)' }}>
            {initialReason ? (
              <>
                La entrega de <strong>{purchase.purchaseNumber}</strong> ({purchase.supplierName}) llegó incompleta. Si el proveedor
                no enviará lo que falta, cierre la orden con lo recibido; si lo enviará después, elija esperar.
              </>
            ) : (
              <>
                La orden <strong>{purchase.purchaseNumber}</strong> de <strong>{purchase.supplierName}</strong> quedará cerrada con lo que
                realmente llegó. Úselo cuando el proveedor no va a enviar lo que falta.
              </>
            )}
          </p>

          <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 0, borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#64748b', textAlign: 'left' }}>
                  <th scope="col" style={{ padding: '8px 10px' }}>Producto</th>
                  <th scope="col" style={{ padding: '8px 10px', textAlign: 'right' }}>Pedido</th>
                  <th scope="col" style={{ padding: '8px 10px', textAlign: 'right' }}>Llegó</th>
                  <th scope="col" style={{ padding: '8px 10px', textAlign: 'right' }}>Faltante</th>
                </tr>
              </thead>
              <tbody>
                {summary.lines.map((l) => (
                  <tr key={l.id} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '8px 10px' }}>
                      <strong>{l.productName}</strong>
                      <span style={{ color: '#64748b' }}> · {l.sku}</span>
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{l.quantity}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{l.received}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: l.missing > 0 ? '#b45309' : '#64748b', fontWeight: 700 }}>{l.missing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!isCostRedacted && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '10px 12px', borderRadius: 10, background: '#f8fafc', border: '1px solid var(--line)' }}>
              <span>
                Valor de la orden: <s style={{ color: '#94a3b8' }}>{formatCurrency(purchase.total)}</s>
              </span>
              <strong style={{ color: 'var(--navy)' }}>Queda en {formatCurrency(summary.newTotal)}</strong>
            </div>
          )}

          <div
            style={{ padding: 12, background: '#fffbeb', borderRadius: 8, border: '1px solid #fef3c7', color: '#b45309', fontSize: 12 }}
          >
            Verifique que la factura del proveedor cobre solo lo recibido. Si le facturó lo pedido, solicite la nota crédito por el
            faltante. Esta acción no se puede deshacer y queda en la auditoría.
          </div>

          <div>
            <label htmlFor="shortage-reason" style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              Motivo del faltante <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              id="shortage-reason"
              className="filter-date-input"
              style={{ width: '100%', minHeight: 70, fontFamily: 'inherit', fontSize: 12 }}
              placeholder="Ej. El proveedor no tenía existencias y no enviará las 20 unidades restantes."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <div
          className="drawer-footer"
          style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#fff' }}
        >
          <button type="button" className="outline-button" onClick={onClose} disabled={isSubmitting}>
            {initialReason ? 'Esperar lo que falta' : 'Cancelar'}
          </button>
          <button type="button" className="primary-button" onClick={handleConfirm} disabled={isSubmitting}>
            <AppIcon name="check" size={14} />
            <span>{isSubmitting ? 'Cerrando...' : 'Cerrar orden con faltante'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
