'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { AccountPayableItem, accountsPayableService } from '../../services/accounts-payable.service'

interface AccountsPayableHistoryModalProps {
  item: AccountPayableItem | null
  isOpen: boolean
  onClose: () => void
}

export function AccountsPayableHistoryModal({
  item,
  isOpen,
  onClose,
}: AccountsPayableHistoryModalProps) {
  const [mounted, setMounted] = useState(false)
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    async function loadHistory() {
      if (!item) return
      setLoading(true)
      try {
        const history = await accountsPayableService.getPaymentHistory(item.purchaseId)
        setPayments(history)
      } catch (err) {
        console.error('Error cargando historial de pagos:', err)
      } finally {
        setLoading(false)
      }
    }

    if (isOpen && item) {
      loadHistory()
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
          maxWidth: 600,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85vh',
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
              <AppIcon name="clock" size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Historial de Abonos y Pagos</h2>
              <p style={{ fontSize: 12, margin: 0, opacity: 0.85 }}>
                {item.purchaseNumber} — Factura: {item.supplierInvoiceNumber}
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

        {/* Resumen */}
        <div
          style={{
            padding: '16px 24px',
            background: 'var(--bg-subtle, #f8fafc)',
            borderBottom: '1px solid var(--border)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 12,
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>VALOR TOTAL</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>
              {formatCurrency(item.originalAmount)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#059669' }}>TOTAL ABONADO</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#059669' }}>
              {formatCurrency(item.paidAmount)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#dc2626' }}>SALDO PENDIENTE</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#dc2626' }}>
              {formatCurrency(item.pendingBalance)}
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
              Cargando comprobantes...
            </div>
          ) : payments.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
              No se han registrado abonos para este documento.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {payments.map((p, idx) => (
                <div
                  key={p.id || idx}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy)' }}>
                      {p.paymentNumber || `Comprobante #${idx + 1}`}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Fecha: {p.date} • Medio: <strong>{p.paymentMethod}</strong>
                    </div>
                    {p.reference && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Ref: {p.reference}
                      </div>
                    )}
                    {p.notes && (
                      <div style={{ fontSize: 11, fontStyle: 'italic', marginTop: 4 }}>
                        &ldquo;{p.notes}&rdquo;
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#059669' }}>
                      {formatCurrency(p.amount)}
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 10,
                        background: '#ecfdf5',
                        color: '#059669',
                      }}
                    >
                      APLICADO
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-subtle, #f8fafc)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: '#ffffff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
