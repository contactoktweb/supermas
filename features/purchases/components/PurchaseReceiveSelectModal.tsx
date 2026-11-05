'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { Purchase } from '../types'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { canReceivePurchase } from '../utils/purchase-status'

interface PurchaseReceiveSelectModalProps {
  isOpen: boolean
  purchases: Purchase[]
  /** El rol no ve costos: se oculta el valor de la orden. */
  isCostRedacted?: boolean
  onClose: () => void
  onSelect: (purchase: Purchase) => void
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)

const formatDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Lista las órdenes pendientes de recepción para elegir cuál se recibe. */
export function PurchaseReceiveSelectModal({ isOpen, purchases, isCostRedacted = false, onClose, onSelect }: PurchaseReceiveSelectModalProps) {
  const [mounted, setMounted] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) setQuery('')
  }, [isOpen])

  useEscapeKey(isOpen, onClose)

  const pending = useMemo(() => purchases.filter((p) => canReceivePurchase(p.status)), [purchases])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return pending
    return pending.filter((p) =>
      [p.purchaseNumber, p.supplierName, p.supplierNit, p.supplierInvoiceNumber, p.destinationLocationName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    )
  }, [pending, query])

  if (!isOpen || !mounted) return null

  return createPortal(
    <div className="drawer-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="receive-select-title">
      <div
        className="product-drawer product-drawer-flush product-detail-drawer page-enter"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560, width: '92vw' }}
      >
        <div className="drawer-header" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              className="stat-icon"
              style={{ width: 40, height: 40, borderRadius: 10, background: '#eff6ff', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <AppIcon name="warehouse" size={20} />
            </div>
            <div>
              <span className="product-category-eyebrow">Recepción de mercancía</span>
              <h3 id="receive-select-title" style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--navy)' }}>
                ¿Qué orden va a recibir?
              </h3>
            </div>
          </div>
          <button type="button" className="drawer-close-btn" onClick={onClose} aria-label="Cerrar">
            <AppIcon name="close" size={16} />
          </button>
        </div>

        <div className="drawer-body" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="search-box" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AppIcon name="search" size={15} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por número, proveedor, NIT o factura"
              aria-label="Buscar orden de compra"
              autoFocus
              style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', minHeight: 40, fontSize: 13 }}
            />
          </label>

          {pending.length === 0 ? (
            <p role="status" style={{ margin: 0, padding: 24, textAlign: 'center', fontSize: 13, color: '#64748b' }}>
              No hay órdenes confirmadas pendientes de recepción.
            </p>
          ) : visible.length === 0 ? (
            <p role="status" style={{ margin: 0, padding: 24, textAlign: 'center', fontSize: 13, color: '#64748b' }}>
              Ninguna orden pendiente coincide con la búsqueda.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '55vh', overflowY: 'auto' }}>
              {visible.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(p)}
                    className="receive-select-option"
                    style={{
                      width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--line)',
                      background: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                      transition: 'transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--navy)' }}>
                        {p.purchaseNumber}
                        <span style={{ fontWeight: 600, color: '#64748b' }}> · {formatDate(p.date)}</span>
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.supplierName}
                        {p.supplierInvoiceNumber ? ` · Factura ${p.supplierInvoiceNumber}` : ''}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>
                        {p.destinationLocationName} · {p.items?.length || p.itemsCount || 0} productos
                      </p>
                    </div>
                    {!isCostRedacted && (
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy)', whiteSpace: 'nowrap' }}>{formatCurrency(p.total)}</span>
                    )}
                    <AppIcon name="chevronRight" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <style>{`
        .receive-select-option:hover, .receive-select-option:focus-visible { border-color: var(--navy) !important; box-shadow: 0 6px 16px rgba(0, 27, 92, 0.10); transform: translateY(-1px); }
        .receive-select-option:active { transform: scale(0.99); }
        @media (prefers-reduced-motion: reduce) { .receive-select-option { transition: none !important; transform: none !important; } }
      `}</style>
    </div>,
    document.body
  )
}
