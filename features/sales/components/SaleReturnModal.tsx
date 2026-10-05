'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { Sale, SaleDetail, SaleReturnDTO } from '../types'

interface SaleReturnModalProps {
  isOpen: boolean
  sale: Sale | SaleDetail | null
  onClose: () => void
  onConfirm: (dto: SaleReturnDTO) => Promise<void>
}

export function SaleReturnModal({
  isOpen,
  sale,
  onClose,
  onConfirm,
}: SaleReturnModalProps) {
  const [reason, setReason] = useState('')
  const [returnItems, setReturnItems] = useState<{ [productId: string]: number }>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (sale && sale.items) {
      // Por defecto, inicializar cantidades en 0
      const initial: { [productId: string]: number } = {}
      sale.items.forEach((it) => {
        initial[it.productId] = 0
      })
      setReturnItems(initial)
      setReason('')
      setError(null)
    }
  }, [sale])

  if (!isOpen || !sale || !mounted) return null

  const handleQtyChange = (productId: string, maxQty: number, val: string) => {
    const num = parseInt(val, 10) || 0
    if (num < 0) return
    if (num > maxQty) {
      setError(`La cantidad no puede exceder las unidades vendidas (${maxQty}).`)
      return
    }
    setError(null)
    setReturnItems((prev) => ({
      ...prev,
      [productId]: num,
    }))
  }

  const handleSelectAll = () => {
    const full: { [productId: string]: number } = {}
    sale.items.forEach((it) => {
      full[it.productId] = it.quantity
    })
    setReturnItems(full)
  }

  const handleClearAll = () => {
    const cleared: { [productId: string]: number } = {}
    sale.items.forEach((it) => {
      cleared[it.productId] = 0
    })
    setReturnItems(cleared)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim() || reason.trim().length < 5) {
      setError('El motivo de la devolución debe tener al menos 5 caracteres.')
      return
    }

    const itemsToReturn = Object.entries(returnItems)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, quantity]) => ({
        productId,
        quantity,
        reason: reason.trim(),
      }))

    if (itemsToReturn.length === 0) {
      setError('Debe seleccionar al menos una unidad de algún producto para devolver.')
      return
    }

    try {
      setLoading(true)
      setError(null)
      await onConfirm({
        saleId: sale.id,
        items: itemsToReturn,
        reason: reason.trim(),
      })
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al procesar la devolución'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const totalUnitsToReturn = Object.values(returnItems).reduce((acc, q) => acc + q, 0)

  return createPortal(
    <div
      className="drawer-backdrop modal-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 999999,
        background: 'rgba(10, 24, 48, 0.65)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="modal-card page-enter"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 580,
          background: '#ffffff',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 25px 50px -12px rgba(0, 27, 92, 0.35)',
          zIndex: 1000000,
          border: '1.5px solid #cbd5e1',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#f0fdf4',
              color: '#16a34a',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <AppIcon name="refresh" size={24} color="#16a34a" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--navy)' }}>
              Procesar Devolución - Venta {sale.saleNumber}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
              Las unidades devueltas reingresarán automáticamente a Kardex y se ajustará el saldo.
            </p>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: 12,
              marginBottom: 14,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
              Ítems de la Venta a Devolver:
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="outline-button compact"
                onClick={handleSelectAll}
                style={{ fontSize: 11, padding: '2px 8px' }}
              >
                Devolver Todo
              </button>
              <button
                type="button"
                className="outline-button compact"
                onClick={handleClearAll}
                style={{ fontSize: 11, padding: '2px 8px' }}
              >
                Limpiar
              </button>
            </div>
          </div>

          <div
            style={{
              overflowY: 'auto',
              maxHeight: 220,
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: 8,
              marginBottom: 16,
            }}
          >
            {sale.items.map((item) => {
              const currentQty = returnItems[item.productId] || 0
              return (
                <div
                  key={item.productId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderBottom: '1px solid #f1f5f9',
                    fontSize: 13,
                  }}
                >
                  <div style={{ flex: 1, paddingRight: 12 }}>
                    <div style={{ fontWeight: 600, color: 'var(--navy)' }}>
                      {item.productName || (item as any).name || 'Producto'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      Vendidas: {item.quantity} | P. Unit: ${Number(item.unitPrice).toLocaleString('es-CO')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ fontSize: 11, color: 'var(--muted)' }}>Devolver:</label>
                    <input
                      type="number"
                      min={0}
                      max={item.quantity}
                      value={currentQty}
                      onChange={(e) => handleQtyChange(item.productId, item.quantity, e.target.value)}
                      style={{
                        width: 70,
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        textAlign: 'center',
                        fontWeight: 700,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--navy)',
                display: 'block',
                marginBottom: 6,
              }}
            >
              Motivo de la Devolución *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Producto en mal estado, empaque dañado, cambio de producto..."
              rows={3}
              required
              style={{ width: '100%', resize: 'none' }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 12,
              borderTop: '1px solid #e2e8f0',
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
              Total Unidades a Reingresar: <strong style={{ color: 'var(--navy)' }}>{totalUnitsToReturn}</strong>
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="outline-button"
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={loading || totalUnitsToReturn === 0}
                style={{
                  background: totalUnitsToReturn > 0 ? '#16a34a' : undefined,
                  borderColor: totalUnitsToReturn > 0 ? '#16a34a' : undefined,
                }}
              >
                {loading ? 'Procesando...' : `Confirmar Devolución (${totalUnitsToReturn})`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
