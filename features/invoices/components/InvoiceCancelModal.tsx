'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { Invoice } from '../types'

interface InvoiceCancelModalProps {
  isOpen: boolean
  invoice: Invoice | null
  onClose: () => void
  onConfirmCancel: (invoiceId: string, reason: string) => Promise<any>
}

export function InvoiceCancelModal({
  isOpen,
  invoice,
  onClose,
  onConfirmCancel,
}: InvoiceCancelModalProps) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen || !invoice) return null

  const isDianAccepted = invoice.dianStatus === 'ACEPTADA'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) {
      setError('Debes ingresar el motivo de anulación.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      await onConfirmCancel(invoice.id, reason)
    } catch (err: any) {
      setError(err.message || 'Error al anular la factura.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="drawer-backdrop modal-center" onClick={onClose}>
      <div
        className="modal-card animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          background: '#ffffff',
          borderRadius: 14,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              className="modal-icon-badge"
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--red)',
              }}
            >
              <AppIcon name="warning" size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)', margin: 0 }}>
                Anular Factura {invoice.invoiceNumber}
              </h2>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                Esta acción queda registrada en auditoría fiscal
              </span>
            </div>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{ width: 32, height: 32 }}
          >
            <AppIcon name="close" size={16} />
          </button>
        </div>

        {/* Body */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {error && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 6,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}

          {/* Warning Banner */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              background: '#fffbeb',
              border: '1px solid #fde68a',
              fontSize: 12,
              color: '#92400e',
              lineHeight: 1.5,
            }}
          >
            <strong style={{ display: 'block', marginBottom: 2, color: '#b45309' }}>
              Aviso Importante:
            </strong>
            {isDianAccepted ? (
              <span>
                Esta factura ya fue <strong>Aceptada por la DIAN</strong>. Al anularla administrativamente en el ERP, se recomienda generar también una <strong>Nota Crédito Electrónica</strong> para mantener la consistencia ante la administración tributaria.
              </span>
            ) : (
              <span>
                La factura cambiará a estado <strong>ANULADA</strong> y no tendrá validez comercial ni fiscal. Los registros históricos no serán eliminados.
              </span>
            )}
          </div>

          {/* Reason Input */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--navy)',
                marginBottom: 6,
              }}
            >
              Motivo de Anulación *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Escribe el motivo detallado de la anulación..."
              rows={3}
              required
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: 12,
                resize: 'none',
              }}
            />
          </div>

          {/* Actions */}
          <div
            style={{
              marginTop: 6,
              paddingTop: 12,
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
            }}
          >
            <button
              type="button"
              className="outline-button"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="primary-button compact"
              disabled={submitting || !reason.trim()}
              style={{ background: 'var(--red)', borderColor: 'var(--red)' }}
            >
              <AppIcon name="trash" size={14} />
              {submitting ? 'Anulando Factura...' : 'Confirmar Anulación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
