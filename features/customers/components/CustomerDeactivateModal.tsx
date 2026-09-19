'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { Customer } from '../types'

interface CustomerDeactivateModalProps {
  isOpen: boolean
  customer: Customer | null
  onClose: () => void
  onConfirm: (id: string, reason: string) => Promise<void>
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function CustomerDeactivateModal({
  isOpen,
  customer,
  onClose,
  onConfirm,
}: CustomerDeactivateModalProps) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen || !customer || !mounted) return null

  const hasPendingBalance = customer.currentBalance > 0

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (hasPendingBalance) {
      setError(
        `No es posible desactivar al cliente mientras posea un saldo deudor de ${formatCOP(
          customer.currentBalance
        )}. Debe liquidar la cartera antes de continuar.`
      )
      return
    }

    try {
      setSubmitting(true)
      await onConfirm(customer.id, reason.trim() || 'Desactivación administrativa')
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al desactivar el cliente'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="drawer-backdrop modal-center" onClick={onClose}>
      <div
        className="warehouse-card page-enter"
        style={{
          width: 'min(92vw, 440px)',
          maxWidth: 440,
          padding: 24,
          cursor: 'default',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Desactivar Cliente"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: '#fee2e2',
              color: 'var(--red)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <AppIcon name="warning" size={20} />
          </div>

          <div>
            <strong style={{ fontSize: 16, color: 'var(--navy)', display: 'block' }}>
              ¿Desactivar Cliente?
            </strong>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              {customer.displayName}
            </span>
          </div>
        </div>

        {hasPendingBalance ? (
          <div
            style={{
              padding: 14,
              borderRadius: 10,
              background: '#fef2f2',
              border: '1.5px solid #fecaca',
              color: '#dc2626',
              fontSize: 12,
              marginBottom: 16,
            }}
          >
            <strong>Acción Bloqueada por Seguridad:</strong>
            <p style={{ margin: '4px 0 0', lineHeight: 1.4 }}>
              Este cliente registra un saldo pendiente de{' '}
              <strong>{formatCOP(customer.currentBalance)}</strong>. Por políticas de integridad
              contable y cartera, no puede ser desactivado hasta que se liquiden sus cuentas por cobrar.
            </p>
          </div>
        ) : (
          <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
            El cliente quedará en estado <strong>Inactivo</strong> y no podrá ser seleccionado en
            nuevas ventas ni facturas. Sus registros históricos y comprobantes se conservarán
            intactos en el sistema.
          </p>
        )}

        {error && (
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              fontSize: 11,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleConfirm}>
          {!hasPendingBalance && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Motivo de la desactivación (Opcional)
              </label>
              <textarea
                className="filter-date-input"
                style={{ minHeight: 65 }}
                placeholder="Ej. Traslado de sede, cierre comercial, solicitud del cliente..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              className="outline-button compact"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            {!hasPendingBalance && (
              <button
                type="submit"
                className="primary-button compact"
                disabled={submitting}
                style={{ background: '#dc2626' }}
              >
                <AppIcon name="close" size={13} color="#fff" />
                <span>{submitting ? 'Desactivando...' : 'Desactivar Cliente'}</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
