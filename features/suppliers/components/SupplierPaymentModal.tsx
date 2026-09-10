'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { Supplier, SupplierInvoiceSummary } from '../types'
import { supplierService } from '../services/supplier.service'
import { purchaseService } from '@/features/purchases/services/purchase.service'

interface SupplierPaymentModalProps {
  supplier: Supplier | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const PAYMENT_METHODS = [
  { value: 'TRANSFERENCIA', label: 'Transferencia bancaria' },
  { value: 'EFECTIVO', label: 'Efectivo de caja' },
  { value: 'CONSIGNACION', label: 'Consignación nacional' },
  { value: 'CHEQUE', label: 'Cheque comercial' },
  { value: 'OTRO', label: 'Otro medio de pago' },
]

export function SupplierPaymentModal({
  supplier,
  isOpen,
  onClose,
  onSuccess,
}: SupplierPaymentModalProps) {
  const [mounted, setMounted] = useState(false)
  const [invoices, setInvoices] = useState<SupplierInvoiceSummary[]>([])
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string>('')
  const [amount, setAmount] = useState<number>(0)
  const [paymentMethod, setPaymentMethod] = useState<string>('TRANSFERENCIA')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    async function loadPendingInvoices() {
      if (!supplier) return
      try {
        const allInvs = await supplierService.getSupplierInvoices(supplier.id)
        const pending = allInvs.filter((i) => i.pendingBalance > 0)
        setInvoices(pending)
        if (pending.length > 0) {
          setSelectedPurchaseId(pending[0].purchaseId)
          setAmount(pending[0].pendingBalance)
        } else {
          setSelectedPurchaseId('')
          setAmount(0)
        }
      } catch (err) {
        console.error('Error cargando facturas pendientes:', err)
      }
    }

    if (isOpen && supplier) {
      loadPendingInvoices()
      setReference('')
      setNotes('')
      setError(null)
    }
  }, [isOpen, supplier])

  const selectedInvoice = invoices.find((i) => i.purchaseId === selectedPurchaseId)

  // Update amount when selected invoice changes
  const handleSelectInvoice = (purId: string) => {
    setSelectedPurchaseId(purId)
    const inv = invoices.find((i) => i.purchaseId === purId)
    if (inv) {
      setAmount(inv.pendingBalance)
    }
  }

  if (!isOpen || !supplier || !mounted) return null

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val)
  }

  const handleConfirm = async () => {
    if (!selectedPurchaseId) {
      setError('Seleccione la factura u orden de compra a la que aplicará el pago.')
      return
    }
    if (amount <= 0) {
      setError('El valor a pagar debe ser mayor a 0.')
      return
    }
    if (selectedInvoice && amount > selectedInvoice.pendingBalance) {
      setError(
        `El valor (${formatCurrency(amount)}) excede el saldo de la factura (${formatCurrency(
          selectedInvoice.pendingBalance
        )}).`
      )
      return
    }
    if (!reference.trim()) {
      setError('Ingrese el número de comprobante o referencia de pago.')
      return
    }

    setError(null)
    setIsSubmitting(true)
    try {
      await purchaseService.registerPayment({
        purchaseId: selectedPurchaseId,
        amount,
        paymentMethod: paymentMethod as any,
        reference: reference.trim(),
        notes: notes.trim() || undefined,
      })

      // Actualizar saldo del proveedor en db.suppliers
      supplier.currentBalance = Math.max(0, (supplier.currentBalance || 0) - amount)

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al registrar el pago al proveedor.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const invoiceOptions = invoices.map((i) => ({
    value: i.purchaseId,
    label: `Factura ${i.invoiceNumber} (${i.purchaseNumber})`,
    description: `Saldo: ${formatCurrency(i.pendingBalance)} • Vence: ${i.dueDate || 'Inmediato'}`,
  }))

  return createPortal(
    <div
      className="drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="supplier-pay-modal-title"
    >
      <div
        className="product-drawer product-detail-drawer page-enter"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 540, width: '92vw' }}
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
                Cuentas por Pagar & Tesorería
              </span>
              <h3
                id="supplier-pay-modal-title"
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

          {/* Tarjeta Resumen */}
          <div
            style={{
              padding: 14,
              background: '#f8fafc',
              borderRadius: 8,
              border: '1px solid var(--border)',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
              <span style={{ color: 'var(--muted)' }}>Proveedor:</span>
              <strong style={{ color: 'var(--navy)' }}>{supplier.businessName || supplier.supplierName}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
              <span style={{ color: 'var(--muted)' }}>NIT / Documento:</span>
              <span>{supplier.documentNumber || supplier.nit}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 6 }}>
              <span style={{ color: 'var(--navy)', fontWeight: 700 }}>Saldo total adeudado:</span>
              <strong style={{ color: '#b45309' }} className="font-tabular">
                {formatCurrency(supplier.currentBalance)}
              </strong>
            </div>
          </div>

          {invoices.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', background: '#f8fafc', borderRadius: 8, border: '1px dashed var(--border)', color: 'var(--muted)', fontSize: 13 }}>
              Este proveedor no tiene facturas con saldo pendiente actualmente.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {/* Selector de Factura */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Factura u orden a abonar <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <CustomSelect
                  value={selectedPurchaseId}
                  onChange={handleSelectInvoice}
                  options={invoiceOptions}
                />
              </div>

              {/* Valor a pagar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700 }}>
                    Valor a pagar ($COP) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  {selectedInvoice && (
                    <button
                      type="button"
                      onClick={() => setAmount(selectedInvoice.pendingBalance)}
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
                      Pagar saldo total ({formatCurrency(selectedInvoice.pendingBalance)})
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min="100"
                  max={selectedInvoice?.pendingBalance}
                  className="filter-date-input"
                  style={{ width: '100%', fontSize: 15, fontWeight: 700, color: 'var(--navy)' }}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value) || 0)}
                />
              </div>

              {/* Método de pago */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Medio de pago <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <CustomSelect
                  value={paymentMethod}
                  onChange={(val) => setPaymentMethod(val)}
                  options={PAYMENT_METHODS}
                />
              </div>

              {/* Referencia bancaria */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Referencia / N° Comprobante <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  className="filter-date-input"
                  style={{ width: '100%' }}
                  placeholder="Ej. TRANSF-091428 o Cheque 2041..."
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  required
                />
              </div>

              {/* Observaciones */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Observaciones del pago
                </label>
                <textarea
                  className="filter-date-input"
                  style={{ width: '100%', minHeight: 50, fontFamily: 'inherit', fontSize: 12 }}
                  placeholder="Cuenta bancaria de origen, observaciones de tesorería..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}
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
            disabled={isSubmitting || invoices.length === 0}
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
