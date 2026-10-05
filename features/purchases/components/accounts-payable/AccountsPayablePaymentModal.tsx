'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { AccountPayableItem, accountsPayableService } from '../../services/accounts-payable.service'
import { PaymentMethod } from '../../types'

interface AccountsPayablePaymentModalProps {
  item: AccountPayableItem | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'TRANSFERENCIA', label: 'Transferencia Bancaria' },
  { value: 'EFECTIVO', label: 'Efectivo de Caja' },
  { value: 'CONSIGNACION', label: 'Consignación Nacional' },
  { value: 'CHEQUE', label: 'Cheque Comercial' },
  { value: 'OTRO', label: 'Otro Medio' },
]

import { treasuryRepository } from '@/features/treasury/repositories/treasury.repository'
import { BankAccount } from '@/features/treasury/types'

export function AccountsPayablePaymentModal({
  item,
  isOpen,
  onClose,
  onSuccess,
}: AccountsPayablePaymentModalProps) {
  const [mounted, setMounted] = useState(false)
  const [amount, setAmount] = useState<number>(0)
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('TRANSFERENCIA')
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [bankAccountId, setBankAccountId] = useState<string>('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    treasuryRepository.getBankAccounts().then((accounts) => {
      const active = accounts.filter((a) => a.status === 'ACTIVE')
      setBankAccounts(active)
      if (active.length > 0) {
        setBankAccountId(active[0].id)
      }
    })
  }, [])

  useEffect(() => {
    if (isOpen && item) {
      setAmount(item.pendingBalance)
      setPaymentDate(new Date().toISOString().split('T')[0])
      setPaymentMethod('TRANSFERENCIA')
      setReference('')
      setNotes('')
      setError(null)
    }
  }, [isOpen, item])

  if (!isOpen || !item || !mounted) return null

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val)
  }

  const handleQuickPercent = (pct: number) => {
    const val = Math.round((item.pendingBalance * pct) / 100)
    setAmount(val)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (amount <= 0) {
      setError('El valor del pago debe ser mayor a 0.')
      return
    }

    if (amount > item.pendingBalance + 0.01) {
      setError(
        `El valor a pagar (${formatCurrency(amount)}) excede el saldo pendiente (${formatCurrency(
          item.pendingBalance
        )}).`
      )
      return
    }

    if ((paymentMethod === 'TRANSFERENCIA' || paymentMethod === 'CONSIGNACION') && !bankAccountId) {
      setError('Debe seleccionar una cuenta bancaria de origen para la transferencia.')
      return
    }

    try {
      setIsSubmitting(true)
      await accountsPayableService.registerPayment({
        purchaseId: item.purchaseId,
        amount,
        paymentMethod,
        bankAccountId: paymentMethod !== 'EFECTIVO' ? bankAccountId : undefined,
        date: paymentDate,
        reference: reference.trim() || 'N/A',
        notes: notes.trim() || undefined,
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Error registrando pago en Cuenta por Pagar:', err)
      setError(err?.message || 'Error al procesar el pago a proveedor')
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="modal-backdrop page-enter"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="modal-content"
        style={{
          background: 'var(--card-bg, #ffffff)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 520,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--navy, #1e3a8a)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name="wallet" size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Registrar Abono a Proveedor</h2>
              <p style={{ fontSize: 12, margin: 0, opacity: 0.85 }}>
                {item.purchaseNumber} — {item.supplierName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6,
              opacity: 0.85,
            }}
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 16,
              }}
            >
              <AppIcon name="warning" size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Resumen Deuda */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              padding: 14,
              background: 'var(--bg-subtle, #f8fafc)',
              borderRadius: 10,
              border: '1px solid var(--border)',
              marginBottom: 20,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>VALOR FACTURA</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>
                {formatCurrency(item.originalAmount)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>SALDO PENDIENTE</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#dc2626' }}>
                {formatCurrency(item.pendingBalance)}
              </div>
            </div>
          </div>

          {/* Quick buttons */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
              Monto a abonar <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button
                type="button"
                className="outline-button-sm"
                onClick={() => handleQuickPercent(100)}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: amount === item.pendingBalance ? 'var(--navy, #1e3a8a)' : '#ffffff',
                  color: amount === item.pendingBalance ? '#ffffff' : 'var(--text-main)',
                  cursor: 'pointer',
                }}
              >
                100% (Total)
              </button>
              <button
                type="button"
                className="outline-button-sm"
                onClick={() => handleQuickPercent(50)}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                50%
              </button>
              <button
                type="button"
                className="outline-button-sm"
                onClick={() => handleQuickPercent(25)}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                25%
              </button>
            </div>
            <input
              type="number"
              min={1}
              max={item.pendingBalance}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: 16,
                fontWeight: 700,
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: '#ffffff',
              }}
              required
            />
          </div>

          {/* Fecha de Pago y Medio de Pago */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Fecha del pago <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: 13,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: '#ffffff',
                }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Medio de pago <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <CustomSelect
                value={paymentMethod}
                onChange={(val) => setPaymentMethod(val as PaymentMethod)}
                options={PAYMENT_METHODS}
              />
            </div>
          </div>

          {/* Selector de Banco si es Transferencia/Consignación/Cheque */}
          {paymentMethod !== 'EFECTIVO' && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Cuenta Bancaria de Origen <span style={{ color: '#dc2626' }}>*</span>
              </label>
              {bankAccounts.length > 0 ? (
                <CustomSelect
                  value={bankAccountId}
                  onChange={(val) => setBankAccountId(val)}
                  options={bankAccounts.map((b) => ({
                    value: b.id,
                    label: `${b.bankName} - ${b.accountNumber} (Disp: ${formatCurrency(b.currentBalance)})`,
                  }))}
                />
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: 8, background: '#f8fafc', borderRadius: 6, border: '1px solid var(--border)' }}>
                  No hay cuentas bancarias activas registradas. Se procesará sin afectación directa de cuenta.
                </div>
              )}
            </div>
          )}

          {/* Notificación de Caja si es Efectivo */}
          {paymentMethod === 'EFECTIVO' && (
            <div
              style={{
                marginBottom: 16,
                padding: '10px 14px',
                borderRadius: 8,
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1e40af',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AppIcon name="info" size={16} />
              <span>El dinero en efectivo se debitará automáticamente de la sesión de caja abierta en la sede.</span>
            </div>
          )}

          {/* Referencia */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              Referencia / Comprobante de pago (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej. Transferencia Bancolombia #88219"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 13,
                borderRadius: 8,
                border: '1px solid var(--border)',
              }}
            />
          </div>

          {/* Observaciones */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              Notas / Observaciones
            </label>
            <textarea
              rows={2}
              placeholder="Detalles sobre el pago..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 13,
                borderRadius: 8,
                border: '1px solid var(--border)',
                resize: 'none',
              }}
            />
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: '#ffffff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || amount <= 0}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--navy, #1e3a8a)',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 700,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              <AppIcon name="check" size={16} />
              <span>{isSubmitting ? 'Procesando pago...' : 'Confirmar Abono'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
