'use client'

import React, { useEffect, useRef } from 'react'
import { POSBankAccountOption, POSCustomer, POSPaymentMethod, POSTotals } from '../types'
import { AppIcon } from '@/components/ui/Icon'
import { POS_CARD_PAYMENTS_ENABLED } from '../schemas/pos.schema'
import { SelectField } from '@/components/ui/SelectField'

interface POSPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  customer: POSCustomer | null
  totals: POSTotals
  paymentMethod: POSPaymentMethod
  setPaymentMethod: (method: POSPaymentMethod) => void
  amountPaid: number
  setAmountPaid: (amount: number) => void
  onConfirmPayment: () => Promise<void>
  loading: boolean
  error: string | null
  bankAccounts?: POSBankAccountOption[]
  bankAccountId?: string
  setBankAccountId?: (id: string) => void
  mixedCashAmount?: number
  setMixedCashAmount?: (v: number) => void
  mixedRestMethod?: 'TARJETA' | 'TRANSFERENCIA'
  setMixedRestMethod?: (m: 'TARJETA' | 'TRANSFERENCIA') => void
  /** Sin caja abierta en la sede el servidor rechaza efectivo: se deshabilitan Efectivo y Mixto. */
  canReceiveCash?: boolean
}

const ALL_PAYMENT_METHODS: { id: POSPaymentMethod; label: string; iconName: 'sales' | 'creditCard' | 'webOrders' | 'transfers'; description: string }[] = [
  { id: 'EFECTIVO', label: 'Efectivo', iconName: 'sales', description: 'Pago en caja' },
  { id: 'TARJETA', label: 'Tarjeta Débito/Crédito', iconName: 'creditCard', description: 'Datáfono' },
  { id: 'TRANSFERENCIA', label: 'Transferencia QR', iconName: 'webOrders', description: 'Nequi / Bancolombia' },
  { id: 'MIXTO', label: 'Mixto', iconName: 'transfers', description: POS_CARD_PAYMENTS_ENABLED ? 'Efectivo + otro medio' : 'Efectivo + transferencia' },
]
// Por ahora el POS no recibe tarjeta (decisión de la empresa).
const PAYMENT_METHODS = ALL_PAYMENT_METHODS.filter((m) => POS_CARD_PAYMENTS_ENABLED || m.id !== 'TARJETA')
const MIXED_REST_METHODS = (POS_CARD_PAYMENTS_ENABLED ? ['TRANSFERENCIA', 'TARJETA'] : ['TRANSFERENCIA']) as Array<'TRANSFERENCIA' | 'TARJETA'>

const QUICK_BILLS = [10000, 20000, 50000, 100000]

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function POSPaymentModal({
  isOpen,
  onClose,
  customer,
  totals,
  paymentMethod,
  setPaymentMethod,
  amountPaid,
  setAmountPaid,
  onConfirmPayment,
  loading,
  error,
  bankAccounts = [],
  bankAccountId = '',
  setBankAccountId,
  mixedCashAmount = 0,
  setMixedCashAmount,
  mixedRestMethod = 'TRANSFERENCIA',
  setMixedRestMethod,
  canReceiveCash = true,
}: POSPaymentModalProps) {
  const cashInputRef = useRef<HTMLInputElement>(null)

  const isCash = paymentMethod === 'EFECTIVO'
  const totalAmount = totals.totalAmount || 0
  const change = Math.max(0, amountPaid - totalAmount)
  const isInsufficient = isCash && amountPaid < totalAmount
  const needsBank = paymentMethod === 'TARJETA' || paymentMethod === 'TRANSFERENCIA' || paymentMethod === 'MIXTO'
  const usableAccounts = bankAccounts.filter((a) => a.hasLedger)
  const mixedInvalid = paymentMethod === 'MIXTO' && (mixedCashAmount <= 0 || mixedCashAmount >= totalAmount)
  const bankMissing = needsBank && !bankAccountId
  const accountLabel = (a: POSBankAccountOption) =>
    `${a.bankName} · ${a.accountType === 'CORRIENTE' ? 'Corriente' : a.accountType === 'AHORROS' || a.accountType === 'AHORRO' ? 'Ahorros' : a.accountType} *${a.last4}`

  useEffect(() => {
    if (isOpen && isCash) {
      setTimeout(() => {
        cashInputRef.current?.select()
      }, 100)
    }
  }, [isOpen, isCash])

  if (!isOpen) return null

  const handleBillClick = (bill: number) => {
    setAmountPaid(bill)
  }

  const handleExactClick = () => {
    setAmountPaid(totalAmount)
  }

  const totalUnits = totals.totalUnits || totals.itemCount || 0
  const subtotal = totals.subtotal || 0
  const taxTotal = totals.taxTotal || totals.taxAmount || 0

  return (
    <div className="drawer-backdrop modal-center" onClick={onClose}>
      <div
        className="modal-card animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-modal-title"
        style={{
          width: 'min(100%, 580px)',
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 24px 50px rgba(0, 27, 92, 0.22)',
          padding: 24,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          border: '1px solid var(--line)',
        }}
      >
        {/* 1. Modal Header (Super Más Standard) */}
        <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="modal-header-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              className="modal-icon-badge"
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: '#edf2fa',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <AppIcon name="creditCard" size={20} color="var(--navy)" />
            </div>
            <div>
              <h3 id="payment-modal-title" style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--navy)' }}>
                Finalizar Venta & Cobro
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                Cliente: <strong style={{ color: 'var(--navy)' }}>{customer?.displayName || (customer as any)?.name || 'Consumidor Final'}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={loading}
            aria-label="Cerrar modal"
            style={{ width: 32, height: 32 }}
          >
            <AppIcon name="close" size={16} />
          </button>
        </div>

        {/* 2. Total to Pay Banner (Super Más Signature Card) */}
        <div
          style={{
            background: 'linear-gradient(135deg, var(--navy) 0%, #002370 100%)',
            borderRadius: 14,
            padding: '16px 20px',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 6px 18px rgba(0, 27, 92, 0.18)',
          }}
        >
          <div>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#93c5fd' }}>
              Total a Cobrar
            </span>
            <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 2 }}>
              {formatCOP(totalAmount)}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#cbd5e1' }}>
              {totalUnits} {totalUnits === 1 ? 'producto' : 'productos'} · Subtotal: {formatCOP(subtotal)} · IVA: {formatCOP(taxTotal)}
            </p>
          </div>

          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'rgba(255, 255, 255, 0.12)',
              display: 'grid',
              placeItems: 'center',
              color: '#38bdf8',
            }}
          >
            <AppIcon name="sales" size={24} color="#38bdf8" />
          </div>
        </div>

        {/* 3. Payment Method Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--navy)' }}>
            Método de Pago
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {PAYMENT_METHODS.map((method) => {
              const isSelected = paymentMethod === method.id
              const needsCash = method.id === 'EFECTIVO' || method.id === 'MIXTO'
              const isUnavailable = needsCash && !canReceiveCash
              return (
                <button
                  key={method.id}
                  type="button"
                  disabled={isUnavailable}
                  title={isUnavailable ? 'Requiere caja abierta en esta sede' : undefined}
                  onClick={() => {
                    setPaymentMethod(method.id)
                    if (method.id !== 'EFECTIVO') {
                      setAmountPaid(totalAmount)
                    }
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '12px 8px',
                    borderRadius: 12,
                    border: isSelected ? '2px solid var(--navy)' : '1.5px solid #cbd5e1',
                    background: isSelected ? '#edf2fa' : '#ffffff',
                    cursor: isUnavailable ? 'not-allowed' : 'pointer',
                    opacity: isUnavailable ? 0.45 : 1,
                    transition: 'all 0.15s ease',
                    textAlign: 'center',
                    boxShadow: isSelected ? '0 4px 12px rgba(0, 27, 92, 0.1)' : 'none',
                  }}
                >
                  <div style={{ marginBottom: 6 }}>
                    <AppIcon name={method.iconName} size={20} color={isSelected ? 'var(--navy)' : '#64748b'} />
                  </div>
                  <strong style={{ fontSize: 12, fontWeight: isSelected ? 800 : 700, color: isSelected ? 'var(--navy)' : '#334155' }}>
                    {method.label}
                  </strong>
                </button>
              )
            })}
          </div>
        </div>

        {!canReceiveCash && (
          <p
            role="note"
            style={{ margin: 0, padding: '10px 12px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: 12, lineHeight: 1.45 }}
          >
            No tienes caja abierta en esta sede: puedes cobrar por transferencia o abrir tu caja en el módulo Cajas para recibir efectivo.
          </p>
        )}

        {/* 3b. Cuenta bancaria que recibe el dinero (contabilidad PUC por cuenta exacta) */}
        {needsBank && (
          <div style={{ background: '#f8fafc', border: '1.5px solid var(--line)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {paymentMethod === 'MIXTO' && (
              <>
                <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--navy)' }}>
                  Parte en efectivo
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={mixedCashAmount === 0 ? '' : mixedCashAmount}
                  onChange={(e) => setMixedCashAmount?.(Number(e.target.value) || 0)}
                  placeholder="0"
                  style={{ width: '100%', height: 42, padding: '0 12px', fontSize: 18, fontWeight: 800, borderRadius: 10, border: mixedInvalid ? '2px solid #ef4444' : '2px solid #cbd5e1', color: 'var(--navy)' }}
                />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: '#334155' }}>
                    Resto ({formatCOP(Math.max(0, totalAmount - mixedCashAmount))}) con:
                  </span>
                  {MIXED_REST_METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMixedRestMethod?.(m)}
                      className={mixedRestMethod === m ? 'primary-button compact' : 'outline-button compact'}
                      style={{ height: 28, fontSize: 11, padding: '0 10px' }}
                    >
                      {m === 'TRANSFERENCIA' ? 'Transferencia' : 'Tarjeta'}
                    </button>
                  ))}
                </div>
              </>
            )}
            <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--navy)' }}>
              Cuenta bancaria que recibe el dinero
            </label>
            {usableAccounts.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: '#991b1b' }}>
                No hay cuentas bancarias con subcuenta PUC configurada. Un administrador debe configurarlas en Tesorería.
              </p>
            ) : (
              <SelectField
                value={bankAccountId}
                size="md"
                onChange={(value) => setBankAccountId?.(value)}
              >
                <option value="">Seleccione la cuenta…</option>
                {usableAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{accountLabel(a)}</option>
                ))}
              </SelectField>
            )}
          </div>
        )}

        {/* 4. Cash Amount Section (When Cash is Selected) */}
        {isCash && (
          <div
            style={{
              background: '#f8fafc',
              border: '1.5px solid var(--line)',
              borderRadius: 14,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--navy)' }}>
                Monto Recibido en Efectivo
              </label>
              <button
                type="button"
                onClick={handleExactClick}
                className="outline-button compact"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  height: 26,
                  padding: '0 10px',
                  borderRadius: 6,
                  background: '#eef4fd',
                  color: 'var(--navy)',
                  borderColor: '#93c5fd',
                }}
              >
                Paga Exacto ({formatCOP(totalAmount)})
              </button>
            </div>

            {/* Input with Currency Prefix */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 14,
                  fontSize: 20,
                  fontWeight: 800,
                  color: '#94a3b8',
                  pointerEvents: 'none',
                }}
              >
                $
              </span>
              <input
                ref={cashInputRef}
                type="number"
                min="0"
                step="any"
                value={amountPaid === 0 ? '' : amountPaid}
                onChange={(e) => setAmountPaid(Number(e.target.value) || 0)}
                placeholder="0"
                style={{
                  width: '100%',
                  height: 48,
                  paddingLeft: 34,
                  paddingRight: 14,
                  fontSize: 22,
                  fontWeight: 800,
                  borderRadius: 10,
                  border: isInsufficient ? '2px solid #ef4444' : '2px solid #cbd5e1',
                  background: '#ffffff',
                  color: 'var(--navy)',
                  outline: 'none',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)',
                }}
              />
            </div>

            {/* Quick Bill Preset Chips */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                Billetes sugeridos / agregar
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {QUICK_BILLS.map((bill) => (
                  <button
                    key={bill}
                    type="button"
                    onClick={() => handleBillClick(bill)}
                    className="outline-button"
                    style={{
                      height: 34,
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      background: '#ffffff',
                      borderColor: '#cbd5e1',
                      color: 'var(--navy)',
                      justifyContent: 'center',
                    }}
                  >
                    ${(bill / 1000).toFixed(0)}k
                  </button>
                ))}
              </div>
            </div>

            {/* Change / Vuelto Line */}
            <div
              style={{
                paddingTop: 10,
                borderTop: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#64748b', display: 'block' }}>
                  Cambio / Vuelto
                </span>
                <strong style={{ fontSize: 24, fontWeight: 900, color: isInsufficient ? '#94a3b8' : '#15803d' }}>
                  {formatCOP(change)}
                </strong>
              </div>

              {isInsufficient && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#b91c1c',
                    background: '#fee2e2',
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid #fecaca',
                  }}
                >
                  <AppIcon name="warning" size={16} color="#b91c1c" />
                  <span>Faltan {formatCOP(totalAmount - amountPaid)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Banner if any */}
        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: '#fee2e2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AppIcon name="warning" size={16} color="#991b1b" />
            <span>{error}</span>
          </div>
        )}

        {/* 5. Modal Footer (Super Más Standard Actions) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
            paddingTop: 12,
            borderTop: '1px solid var(--line)',
            marginTop: 'auto',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="outline-button"
            style={{
              height: 42,
              padding: '0 18px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirmPayment}
            disabled={loading || isInsufficient || totalAmount <= 0 || bankMissing || mixedInvalid}
            className="primary-button"
            style={{
              height: 42,
              padding: '0 24px',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 800,
              background: isCash ? 'var(--red)' : 'var(--navy)',
              gap: 8,
              boxShadow: isCash ? '0 4px 12px rgba(254, 17, 12, 0.25)' : '0 4px 12px rgba(0, 27, 92, 0.25)',
              opacity: loading || isInsufficient || totalAmount <= 0 || bankMissing || mixedInvalid ? 0.5 : 1,
              cursor: loading || isInsufficient || totalAmount <= 0 || bankMissing || mixedInvalid ? 'not-allowed' : 'pointer',
            }}
          >
            <AppIcon name="check" size={16} />
            <span>{loading ? 'Procesando Venta...' : `Confirmar & Cobrar (${formatCOP(totalAmount)})`}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
