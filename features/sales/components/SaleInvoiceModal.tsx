'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { Sale } from '../types'

interface SaleInvoiceModalProps {
  isOpen: boolean
  sale: Sale | null
  onClose: () => void
  onConfirm: (type: 'FACTURA_ELECTRONICA' | 'FACTURA_POS') => Promise<void>
}

export function SaleInvoiceModal({
  isOpen,
  sale,
  onClose,
  onConfirm,
}: SaleInvoiceModalProps) {
  const [invoiceType, setInvoiceType] = useState<'FACTURA_ELECTRONICA' | 'FACTURA_POS'>('FACTURA_ELECTRONICA')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen || !sale) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError(null)
      await onConfirm(invoiceType)
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al generar la factura'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div
        className="modal-card page-enter"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: 480,
          background: '#ffffff',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 20px 40px rgba(0, 27, 92, 0.2)',
          zIndex: 100000,
          border: '1.5px solid #cbd5e1',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#eef4fd',
              color: 'var(--navy)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <AppIcon name="invoices" size={24} color="var(--navy)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--navy)' }}>
              Generar Factura para {sale.saleNumber}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
              Cliente: {sale.customerName} ({sale.customerDoc})
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--navy)',
              }}
            >
              Seleccione el tipo de documento fiscal:
            </label>

            <button
              type="button"
              onClick={() => setInvoiceType('FACTURA_ELECTRONICA')}
              style={{
                padding: 12,
                borderRadius: 10,
                border: invoiceType === 'FACTURA_ELECTRONICA' ? '2px solid var(--navy)' : '1.5px solid #cbd5e1',
                background: invoiceType === 'FACTURA_ELECTRONICA' ? '#f0f5ff' : '#ffffff',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <AppIcon name="fileText" size={20} color="var(--navy)" />
              <div>
                <strong style={{ fontSize: 13, color: 'var(--navy)', display: 'block' }}>
                  Factura Electrónica de Venta
                </strong>
                <small style={{ fontSize: 11, color: 'var(--muted)' }}>
                  Genera CUFE y validación formal ante la DIAN
                </small>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setInvoiceType('FACTURA_POS')}
              style={{
                padding: 12,
                borderRadius: 10,
                border: invoiceType === 'FACTURA_POS' ? '2px solid var(--navy)' : '1.5px solid #cbd5e1',
                background: invoiceType === 'FACTURA_POS' ? '#f0f5ff' : '#ffffff',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <AppIcon name="pos" size={20} color="var(--navy)" />
              <div>
                <strong style={{ fontSize: 13, color: 'var(--navy)', display: 'block' }}>
                  Factura de Venta POS / Tirilla
                </strong>
                <small style={{ fontSize: 11, color: 'var(--muted)' }}>
                  Emisión rápida para puntos de venta directos
                </small>
              </div>
            </button>
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
              disabled={loading}
            >
              {loading ? 'Emitiendo...' : 'Emitir Factura'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
