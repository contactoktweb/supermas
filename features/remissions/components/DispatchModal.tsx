'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { Remission, DispatchRemissionPayload } from '../types'

interface DispatchModalProps {
  isOpen: boolean
  remission: Remission | null
  onClose: () => void
  onConfirmDispatch: (payload: DispatchRemissionPayload) => Promise<any>
}

export function DispatchModal({
  isOpen,
  remission,
  onClose,
  onConfirmDispatch,
}: DispatchModalProps) {
  const [carrierName, setCarrierName] = useState('Flota Propia Super Más')
  const [vehiclePlate, setVehiclePlate] = useState('SMV-102')
  const [driverName, setDriverName] = useState('Carlos Mario Ruiz')
  const [driverDoc, setDriverDoc] = useState('CC 19.876.543')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen || !remission) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!carrierName.trim()) {
      setError('Debes ingresar la empresa transportadora o tipo de despacho.')
      return
    }
    if (!driverName.trim()) {
      setError('El nombre del conductor o responsable de despacho es obligatorio.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      await onConfirmDispatch({
        remissionId: remission.id,
        carrierName,
        vehiclePlate,
        driverName,
        driverDoc,
        notes,
      })
    } catch (err: any) {
      setError(err.message || 'Error al despachar la remisión.')
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
          maxWidth: 520,
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
                background: 'rgba(37, 99, 235, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb',
              }}
            >
              <AppIcon name="transfers" size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)', margin: 0 }}>
                Despachar Remisión {remission.remissionNumber}
              </h2>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                Salida física de bodega {remission.locationName}
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

          {/* Info Banner */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              fontSize: 12,
              color: '#1e40af',
              lineHeight: 1.4,
            }}
          >
            <strong style={{ display: 'block', marginBottom: 2 }}>Movimiento de Inventario Kardex:</strong>
            Al confirmar el despacho, se generará una salida física automática (<code>REMISSION_OUT</code>) por{' '}
            <strong>{remission.totalUnits} unidades</strong> de la <strong>{remission.locationName}</strong>.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 4 }}>
                Transportador / Empresa *
              </label>
              <input
                type="text"
                value={carrierName}
                onChange={(e) => setCarrierName(e.target.value)}
                placeholder="Ej. Flota Propia Super Más"
                required
                style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 4 }}>
                Placa del Vehículo
              </label>
              <input
                type="text"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                placeholder="Ej. SMV-102"
                style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 4 }}>
                Nombre del Conductor *
              </label>
              <input
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="Ej. Carlos Mario Ruiz"
                required
                style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 4 }}>
                Cédula del Conductor
              </label>
              <input
                type="text"
                value={driverDoc}
                onChange={(e) => setDriverDoc(e.target.value)}
                placeholder="Ej. CC 19.876.543"
                style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 4 }}>
              Notas / Observaciones de Despacho
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Precintos de seguridad, ruta o detalles..."
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
              disabled={submitting || !carrierName || !driverName}
            >
              <AppIcon name="transfers" size={14} />
              {submitting ? 'Despachando...' : 'Confirmar Despacho'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
