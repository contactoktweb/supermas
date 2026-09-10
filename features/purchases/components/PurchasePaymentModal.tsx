'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { Purchase, PaymentMethod, RegisterPaymentInput } from '../types'

interface PurchasePaymentModalProps {
  purchase: Purchase | null
  isOpen: boolean
  onClose: () => void
  onConfirm: (input: RegisterPaymentInput) => Promise<void>
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'TRANSFERENCIA', label: 'Transferencia bancaria' },
  { value: 'EFECTIVO', label: 'Efectivo de caja' },
  { value: 'CONSIGNACION', label: 'Consignación nacional' },
  { value: 'CHEQUE', label: 'Cheque comercial' },
  { value: 'OTRO', label: 'Otro medio de pago' },
]

export function PurchasePaymentModal({
  purchase,
  isOpen,
  onClose,
  onConfirm,
}: PurchasePaymentModalProps) {
  const [mounted, setMounted] = useState(false)
  const [amount, setAmount] = useState<number>(0)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('TRANSFERENCIA')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (purchase) {
      setAmount(purchase.pendingBalance)
      setReference('')
      setNotes('')
      setError(null)
    }
  }, [purchase])

  if (!isOpen || !purchase || !mounted) return null

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val)
  }

  const handleConfirm = async () => {
    if (amount <= 0) {
      setError('El valor a pagar debe ser mayor a cero.')
      return
    }
    if (amount > purchase.pendingBalance) {
      setError(
        `El valor a pagar (${formatCurrency(amount)}) excede el saldo pendiente (${formatCurrency(
          purchase.pendingBalance
        )}).`
      )
      return
    }
    if (!reference.trim()) {
      setError('Debe ingresar un número de comprobante o referencia bancaria.')
      return
    }

    setError(null)
    setIsSubmitting(true)
    try {
      await onConfirm({
        purchaseId: purchase.id,
        amount,
        paymentMethod,
        reference: reference.trim(),
        notes: notes.trim() || undefined,
      })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al registrar el pago.')
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
      aria-labelledby="payment-modal-title"
    >
      <div
        className="product-drawer product-detail-drawer page-enter"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520, width: '92vw' }}
      >
        {/* Header */}
        <div className="drawer-header" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              className="stat-icon purple"
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: '#f5f3ff',
                color: '#7c3aed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name="wallet" size={20} />
            </div>
            <div>
              <span className="product-category-eyebrow">
                Tesorería & Cuentas por Pagar
              </span>
              <h3
                id="payment-modal-title"
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 800,
                  color: 'var(--navy)',
                }}
              >
                Registrar Pago a Proveedor
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

          {/* Resumen de la Factura */}
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
              <span style={{ color: 'var(--muted)' }}>Proveedor:</span>
              <strong style={{ color: 'var(--navy)' }}>{purchase.supplierName}</strong>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 6,
                fontSize: 12,
              }}
            >
              <span style={{ color: 'var(--muted)' }}>Factura:</span>
              <span>
                {purchase.supplierInvoiceNumber} ({purchase.purchaseNumber})
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
              <span style={{ color: 'var(--muted)' }}>Total factura:</span>
              <span className="font-tabular">{formatCurrency(purchase.total)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 13,
                borderTop: '1px solid var(--border)',
                paddingTop: 6,
                marginTop: 6,
              }}
            >
              <span style={{ color: 'var(--navy)', fontWeight: 700 }}>
                Saldo pendiente actual:
              </span>
              <strong style={{ color: '#b45309' }} className="font-tabular">
                {formatCurrency(purchase.pendingBalance)}
              </strong>
            </div>
          </div>

          {/* Formulario de Pago */}
          <div style={{ display: 'grid', gap: 14 }}>
            {/* Valor a pagar */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                }}
              >
                <label style={{ fontSize: 12, fontWeight: 700 }}>
                  Valor a abonar / pagar ($COP){' '}
                  <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setAmount(purchase.pendingBalance)}
                  style={{
                    background: 'none',
                    border: 0,
                    color: '#7c3aed',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Pagar totalidad
                </button>
              </div>
              <input
                type="number"
                min="100"
                max={purchase.pendingBalance}
                className="filter-date-input"
                style={{
                  width: '100%',
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'var(--navy)',
                }}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
              />
            </div>

            {/* Método de Pago */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                Método de pago <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <CustomSelect
                value={paymentMethod}
                onChange={(val) => setPaymentMethod(val as PaymentMethod)}
                options={PAYMENT_METHODS}
              />
            </div>

            {/* Referencia / Comprobante */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                N° de Referencia / Comprobante{' '}
                <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                className="filter-date-input"
                style={{ width: '100%' }}
                placeholder="Ej. TRANSF-902184, Cheque 4022..."
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>

            {/* Observaciones */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                Observaciones del pago
              </label>
              <textarea
                className="filter-date-input"
                style={{
                  width: '100%',
                  minHeight: 50,
                  fontFamily: 'inherit',
                  fontSize: 12,
                }}
                placeholder="Cuenta de origen, notas del tesorero..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
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
            style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
          >
            <AppIcon name="wallet" size={14} />
            <span>{isSubmitting ? 'Registrando...' : 'Confirmar Pago'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
