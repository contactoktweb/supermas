'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { Customer, CustomerInvoiceSummary, CustomerPaymentDTO } from '../types'

interface CustomerPaymentModalProps {
  isOpen: boolean
  customer: Customer | null
  invoices?: CustomerInvoiceSummary[]
  selectedInvoice?: CustomerInvoiceSummary | null
  onClose: () => void
  onSubmit: (dto: CustomerPaymentDTO) => Promise<void>
}

const PAYMENT_METHODS: { value: CustomerPaymentDTO['paymentMethod']; label: string }[] = [
  { value: 'TRANSFERENCIA', label: 'Transferencia Bancaria / PSE' },
  { value: 'EFECTIVO', label: 'Efectivo en Caja POS' },
  { value: 'TARJETA', label: 'Tarjeta Débito / Crédito' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'OTRO', label: 'Otro Medio de Pago' },
]

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(val)
}

export function CustomerPaymentModal({
  isOpen,
  customer,
  invoices = [],
  selectedInvoice,
  onClose,
  onSubmit,
}: CustomerPaymentModalProps) {
  const [invoiceId, setInvoiceId] = useState<string>('')
  const [amount, setAmount] = useState<number>(0)
  const [paymentMethod, setPaymentMethod] = useState<CustomerPaymentDTO['paymentMethod']>('TRANSFERENCIA')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
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

  useEffect(() => {
    if (selectedInvoice) {
      setInvoiceId(selectedInvoice.id)
      setAmount(selectedInvoice.pendingBalance)
    } else if (customer) {
      setInvoiceId('')
      setAmount(customer.currentBalance > 0 ? customer.currentBalance : 0)
    }
    setPaymentMethod('TRANSFERENCIA')
    setReference('')
    setNotes('')
    setError(null)
  }, [customer, selectedInvoice, isOpen])

  if (!isOpen || !customer || !mounted) return null

  const pendingInvoices = invoices.filter((i) => i.pendingBalance > 0)
  const invoiceOptions = [
    { value: '', label: 'Abono general a cartera del cliente' },
    ...pendingInvoices.map((inv) => ({
      value: inv.id,
      label: `${inv.invoiceNumber} (Saldo: ${formatCurrency(inv.pendingBalance)})`,
    })),
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (amount <= 0) {
      setError('El valor del pago debe ser mayor a cero.')
      return
    }

    if (!reference.trim()) {
      setError('Debe registrar un número de comprobante o referencia bancaria.')
      return
    }

    try {
      setSubmitting(true)
      await onSubmit({
        customerId: customer.id,
        invoiceId: invoiceId || undefined,
        amount,
        paymentMethod,
        reference: reference.trim(),
        notes: notes.trim() || undefined,
      })
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar el pago'
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
          width: 'min(92vw, 480px)',
          maxWidth: 480,
          padding: 26,
          cursor: 'default',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Registrar Pago de Cliente"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 9,
                background: '#f0fbf6',
                color: 'var(--green)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <AppIcon name="wallet" size={18} />
            </div>
            <div>
              <strong style={{ fontSize: 16, color: 'var(--navy)' }}>
                Registrar Abono a Cartera
              </strong>
              <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>
                {customer.displayName}
              </span>
            </div>
          </div>

          <button type="button" className="icon-button" onClick={onClose}>
            <AppIcon name="close" size={16} />
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              fontSize: 12,
              marginBottom: 14,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Factura a aplicar si hay pendientes */}
          {pendingInvoices.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Factura específica a abonar (Opcional)
              </label>
              <CustomSelect
                value={invoiceId}
                onChange={(val) => {
                  setInvoiceId(val)
                  const targetInv = pendingInvoices.find((i) => i.id === val)
                  if (targetInv) {
                    setAmount(targetInv.pendingBalance)
                  }
                }}
                options={invoiceOptions}
              />
            </div>
          )}

          {/* Valor del Abono */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700 }}>
                Valor del pago ($COP) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              {customer.currentBalance > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(customer.currentBalance)}
                  style={{
                    border: 0,
                    background: 'transparent',
                    color: 'var(--navy)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Pagar saldo total ({formatCurrency(customer.currentBalance)})
                </button>
              )}
            </div>
            <input
              type="number"
              min="100"
              className="filter-date-input"
              style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy)' }}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              required
            />
          </div>

          {/* Método de pago */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              Medio de pago <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <CustomSelect
              value={paymentMethod}
              onChange={(val) => setPaymentMethod(val as CustomerPaymentDTO['paymentMethod'])}
              options={PAYMENT_METHODS}
            />
          </div>

          {/* Referencia */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              Referencia / N° Comprobante <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              className="filter-date-input"
              placeholder="Ej. TRANSF-091428 o Recibo POS-99..."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              required
            />
          </div>

          {/* Observaciones */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              Observaciones de tesorería
            </label>
            <textarea
              className="filter-date-input"
              style={{ minHeight: 60 }}
              placeholder="Cuenta receptora, banco emisor o acuerdos de pago..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              className="outline-button compact"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="primary-button compact"
              disabled={submitting}
            >
              <AppIcon name="check" size={14} color="#fff" />
              <span>{submitting ? 'Registrando...' : 'Confirmar Abono'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
