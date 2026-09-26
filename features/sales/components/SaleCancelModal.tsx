'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { Sale } from '../types'

interface SaleCancelModalProps {
  isOpen: boolean
  sale: Sale | null
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}

export function SaleCancelModal({
  isOpen,
  sale,
  onClose,
  onConfirm,
}: SaleCancelModalProps) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isOpen || !sale || !mounted) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim() || reason.trim().length < 5) {
      setError('El motivo de anulación debe tener al menos 5 caracteres.')
      return
    }

    try {
      setLoading(true)
      setError(null)
      await onConfirm(reason.trim())
      setReason('')
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al anular la venta'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

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
          maxWidth: 480,
          background: '#ffffff',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 25px 50px -12px rgba(0, 27, 92, 0.35)',
          zIndex: 1000000,
          border: '1.5px solid #cbd5e1',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#fef2f2',
              color: 'var(--red)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <AppIcon name="warning" size={24} color="var(--red)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--navy)' }}>
              Anular Venta {sale.saleNumber}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
              Esta acción revertirá automáticamente el stock en Kardex.
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

        <form onSubmit={handleSubmit}>
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
              Motivo de Anulación *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Error en digitación de cantidades, desistimiento del cliente..."
              rows={3}
              required
              style={{ width: '100%', resize: 'none' }}
              autoFocus
            />
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: '#fffbeb',
              border: '1px solid #fde68a',
              color: '#92400e',
              fontSize: 11,
              marginBottom: 20,
            }}
          >
            <strong>Nota de seguridad:</strong> Se generarán movimientos de reversión tipo{' '}
            <code>SALE_RETURN</code> en Kardex por las {sale.totalUnits} unidades de los {sale.itemsCount} productos.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
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
              style={{ background: 'var(--red)', borderColor: 'var(--red)' }}
              disabled={loading}
            >
              {loading ? 'Anulando...' : 'Confirmar Anulación'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
