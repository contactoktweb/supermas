'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { Sale } from '../types'

interface SaleRemissionModalProps {
  isOpen: boolean
  sale: Sale | null
  onClose: () => void
  onConfirm: (details: { driverName?: string; deliveredBy?: string; receivedBy?: string; notes?: string }) => Promise<void>
}

export function SaleRemissionModal({
  isOpen,
  sale,
  onClose,
  onConfirm,
}: SaleRemissionModalProps) {
  const [deliveredBy, setDeliveredBy] = useState('Despacho Propio Super Más')
  const [driverName, setDriverName] = useState('')
  const [receivedBy, setReceivedBy] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isOpen || !sale || !mounted) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError(null)
      await onConfirm({
        deliveredBy: deliveredBy.trim(),
        driverName: driverName.trim() || undefined,
        receivedBy: receivedBy.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al generar la remisión'
      setError(msg)
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
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 999999,
        background: 'rgba(10, 24, 48, 0.65)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="modal-card page-enter"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          background: '#ffffff',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 25px 50px -12px rgba(0, 27, 92, 0.35)',
          zIndex: 1000000,
          border: '1.5px solid #cbd5e1',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#f5f3ff',
              color: '#7c3aed',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <AppIcon name="remisiones" size={24} color="#7c3aed" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--navy)' }}>
              Generar Remisión para {sale.saleNumber}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
              Destino: {sale.customerName} ({sale.locationName})
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--navy)',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Empresa de Transporte / Logística *
              </label>
              <input
                type="text"
                value={deliveredBy}
                onChange={(e) => setDeliveredBy(e.target.value)}
                placeholder="Ej. Despacho Propio, Servientrega..."
                required
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--navy)',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Nombre del Conductor / Repartidor
              </label>
              <input
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="Ej. Carlos Mario Ruiz"
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--navy)',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Persona que Recibe en Destino
              </label>
              <input
                type="text"
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
                placeholder={`Ej. ${sale.customerName}`}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--navy)',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Observaciones de Despacho
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Instrucciones de entrega, precintos de seguridad..."
                rows={2}
                style={{ width: '100%', resize: 'none' }}
              />
            </div>
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
              {loading ? 'Generando...' : 'Generar Remisión'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
