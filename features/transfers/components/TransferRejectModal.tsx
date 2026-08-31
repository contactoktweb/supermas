'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { Transfer } from '../types'

interface TransferRejectModalProps {
  transfer: Transfer | null
  isOpen: boolean
  onClose: () => void
  onConfirm: (transferId: string, reason: string) => Promise<void>
}

export function TransferRejectModal({
  transfer,
  isOpen,
  onClose,
  onConfirm,
}: TransferRejectModalProps) {
  const [mounted, setMounted] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (transfer) {
      setReason('')
      setError(null)
    }
  }, [transfer])

  if (!isOpen || !transfer || !mounted) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (reason.trim().length < 5) {
      setError('El motivo del rechazo debe tener al menos 5 caracteres')
      return
    }

    try {
      setLoading(true)
      setError(null)
      await onConfirm(transfer.id, reason.trim())
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al rechazar transferencia')
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div
      className="drawer-backdrop modal-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="deactivate-dialog-card page-enter"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 480 }}
      >
        <div className="dialog-header-standard">
          <div className="dialog-header-title">
            <div className="stat-icon red">
              <AppIcon name="close" size={20} />
            </div>
            <div>
              <p className="eyebrow">Auditoría y Cancelación</p>
              <h3>Rechazar Transferencia {transfer.code}</h3>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="dialog-body">
          <p className="dialog-text-main">
            ¿Está seguro de rechazar esta transferencia antes de su despacho? Esta acción dejará constancia en el historial de trazabilidad.
          </p>

          {error && (
            <div className="incident-alert-banner" style={{ background: '#fef2f2', borderColor: '#fca5a5', padding: 8, borderRadius: 6, marginBottom: 10, color: '#dc2626', fontSize: 12 }}>
              <AppIcon name="warning" size={13} /> <span>{error}</span>
            </div>
          )}

          <div className="form-field" style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Motivo del rechazo (Obligatorio):
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Falta de transporte, reprogramación de pedido, producto sin stock en físico..."
              rows={3}
              required
              style={{ width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border-color)', resize: 'none' }}
            />
          </div>

          <div className="dialog-actions-row">
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
              className="danger-button"
              disabled={loading || reason.trim().length < 5}
            >
              <AppIcon name="close" size={14} />
              <span>{loading ? 'Rechazando...' : 'Confirmar rechazo'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
