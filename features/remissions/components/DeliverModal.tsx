'use client'

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { Remission, DeliverRemissionPayload } from '../types'

interface DeliverModalProps {
  isOpen: boolean
  remission: Remission | null
  onClose: () => void
  onConfirmDeliver: (payload: DeliverRemissionPayload) => Promise<any>
}

export function DeliverModal({
  isOpen,
  remission,
  onClose,
  onConfirmDeliver,
}: DeliverModalProps) {
  const [receivedBy, setReceivedBy] = useState(remission?.contactPerson || remission?.customerName || '')
  const [receivedDoc, setReceivedDoc] = useState('')
  const [deliveryEvidenceNotes, setDeliveryEvidenceNotes] = useState('Mercancía recibida a conformidad y sin averías.')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen || !remission) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!receivedBy.trim()) {
      setError('Debes ingresar el nombre de la persona que recibe la mercancía.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      await onConfirmDeliver({
        remissionId: remission.id,
        receivedBy,
        receivedDoc,
        deliveryEvidenceNotes,
      })
    } catch (err: any) {
      setError(err.message || 'Error al confirmar la entrega.')
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
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
                background: 'rgba(16, 185, 129, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
              }}
            >
              <AppIcon name="check" size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)', margin: 0 }}>
                Confirmar Entrega de Remisión
              </h2>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {remission.remissionNumber} · {remission.customerName}
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

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 4 }}>
              Nombre de Quien Recibe la Mercancía *
            </label>
            <input
              type="text"
              value={receivedBy}
              onChange={(e) => setReceivedBy(e.target.value)}
              placeholder="Ej. Mauricio Gómez (Jefe Almacén)"
              required
              style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 4 }}>
              Cédula / Documento de Quien Recibe
            </label>
            <input
              type="text"
              value={receivedDoc}
              onChange={(e) => setReceivedDoc(e.target.value)}
              placeholder="Ej. CC 80.123.456"
              style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 4 }}>
              Evidencia de Entrega / Observaciones
            </label>
            <textarea
              value={deliveryEvidenceNotes}
              onChange={(e) => setDeliveryEvidenceNotes(e.target.value)}
              placeholder="Detalles del estado de la mercancía, firma o sello..."
              rows={2}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, resize: 'none' }}
            />
          </div>

          {/* Footer */}
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
              disabled={submitting || !receivedBy.trim()}
              style={{ background: '#16a34a', borderColor: '#16a34a' }}
            >
              <AppIcon name="check" size={14} />
              {submitting ? 'Confirmando...' : 'Marcar Entregada'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
