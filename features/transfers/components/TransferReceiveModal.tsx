'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { Transfer } from '../types'

interface TransferReceiveModalProps {
  transfer: Transfer | null
  isOpen: boolean
  onClose: () => void
  onConfirm: (
    transferId: string,
    receivedItems: { productId: string; receivedUnits: number; notes?: string }[],
    generalNotes?: string
  ) => Promise<void>
}

export function TransferReceiveModal({
  transfer,
  isOpen,
  onClose,
  onConfirm,
}: TransferReceiveModalProps) {
  const [mounted, setMounted] = useState(false)
  const [itemUnits, setItemUnits] = useState<Record<string, number>>({})
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({})
  const [generalNotes, setGeneralNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (transfer) {
      const initialMap: Record<string, number> = {}
      const notesMap: Record<string, string> = {}
      transfer.items.forEach((item) => {
        initialMap[item.productId] = item.dispatchedUnits
        notesMap[item.productId] = ''
      })
      setItemUnits(initialMap)
      setItemNotes(notesMap)
      setGeneralNotes('')
      setError(null)
    }
  }, [transfer])

  if (!isOpen || !transfer || !mounted) return null

  const handleUnitChange = (productId: string, val: number) => {
    setItemUnits((prev) => ({ ...prev, [productId]: Math.max(0, val) }))
  }

  const handleNoteChange = (productId: string, val: string) => {
    setItemNotes((prev) => ({ ...prev, [productId]: val }))
  }

  const hasAnyDiscrepancy = transfer.items.some((item) => {
    const received = itemUnits[item.productId] ?? item.dispatchedUnits
    return received !== item.dispatchedUnits
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError(null)

      const payload = transfer.items.map((item) => ({
        productId: item.productId,
        receivedUnits: itemUnits[item.productId] ?? item.dispatchedUnits,
        notes: itemNotes[item.productId]?.trim() || undefined,
      }))

      await onConfirm(transfer.id, payload, generalNotes.trim() || undefined)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al registrar recepción')
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
        style={{ maxWidth: 580 }}
      >
        <div className="dialog-header-standard">
          <div className="dialog-header-title">
            <div className="stat-icon teal">
              <AppIcon name="check" size={20} />
            </div>
            <div>
              <p className="eyebrow">Control de Recepción</p>
              <h3>Confirmar Recepción de {transfer.code}</h3>
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
            Verifique las cantidades recibidas físicamente en <strong>{transfer.destinationLocationName}</strong> antes de dar entrada oficial al inventario.
          </p>

          {error && (
            <div className="incident-alert-banner" style={{ background: '#fef2f2', borderColor: '#fca5a5', padding: 8, borderRadius: 6, marginBottom: 10, color: '#dc2626', fontSize: 12 }}>
              <AppIcon name="warning" size={13} /> <span>{error}</span>
            </div>
          )}

          {/* Items Check Table */}
          <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ background: '#f8fafc', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>
              <span>Producto</span>
              <span>Enviadas / Recibidas</span>
            </div>

            {transfer.items.map((item) => {
              const currentReceived = itemUnits[item.productId] ?? item.dispatchedUnits
              const diff = currentReceived - item.dispatchedUnits
              const hasDiff = diff !== 0

              return (
                <div
                  key={item.productId}
                  style={{
                    padding: '10px 12px',
                    borderTop: '1px solid #f1f5f9',
                    background: hasDiff ? '#fffbeb' : '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: 12, display: 'block' }}>{item.productName}</strong>
                      <small style={{ color: 'var(--muted)', fontSize: 11 }}>SKU: {item.sku}</small>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                        Env: <strong>{item.dispatchedUnits}</strong>
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600 }}>Rec:</span>
                        <input
                          type="number"
                          min={0}
                          value={currentReceived}
                          onChange={(e) => handleUnitChange(item.productId, Number(e.target.value))}
                          style={{
                            width: 65,
                            padding: '4px 6px',
                            fontSize: 12,
                            textAlign: 'center',
                            border: `1px solid ${hasDiff ? 'var(--amber)' : 'var(--border-color)'}`,
                            borderRadius: 6,
                            fontWeight: 700,
                          }}
                        />
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{item.unitOfMeasure}</span>
                      </div>
                    </div>
                  </div>

                  {hasDiff && (
                    <div style={{ marginTop: 8 }}>
                      <span style={{ fontSize: 11, color: '#b45309', fontWeight: 600, display: 'block', marginBottom: 2 }}>
                        Diferencia detectada ({diff > 0 ? `+${diff}` : diff} uds):
                      </span>
                      <input
                        type="text"
                        value={itemNotes[item.productId] || ''}
                        onChange={(e) => handleNoteChange(item.productId, e.target.value)}
                        placeholder="Especifique motivo (ej: rotura en transporte, faltante de empaque)..."
                        style={{ width: '100%', padding: '4px 8px', fontSize: 11, border: '1px solid #fde68a', borderRadius: 4 }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {hasAnyDiscrepancy && (
            <div className="incident-alert-banner" style={{ background: '#fffbeb', borderColor: '#fde68a', padding: 10, borderRadius: 6, marginBottom: 12, color: '#b45309', fontSize: 12 }}>
              <AppIcon name="warning" size={14} />
              <span>
                Se registrará una <strong>novedad por diferencias</strong> en el historial de trazabilidad de la transferencia.
              </span>
            </div>
          )}

          <div className="form-field" style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Observaciones generales de recepción (Opcional):
            </label>
            <textarea
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              placeholder="Notas sobre el estado general del paquete, transportista..."
              rows={2}
              style={{ width: '100%', padding: '6px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border-color)', resize: 'none' }}
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
              className="primary-button"
              disabled={loading}
            >
              <AppIcon name="check" size={14} />
              <span>{loading ? 'Confirmando...' : 'Confirmar recepción'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
