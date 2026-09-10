'use client'

import React, { useState, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { CreateFromSalePayload } from '../types'

interface CreateFromSaleModalProps {
  isOpen: boolean
  onClose: () => void
  pendingSales: any[]
  loadingPendingSales: boolean
  onCreateFromSale: (payload: CreateFromSalePayload) => Promise<any>
}

export function CreateFromSaleModal({
  isOpen,
  onClose,
  pendingSales,
  loadingPendingSales,
  onCreateFromSale,
}: CreateFromSaleModalProps) {
  const [selectedSaleId, setSelectedSaleId] = useState<string>('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (pendingSales.length > 0 && !selectedSaleId) {
      const first = pendingSales[0]
      setSelectedSaleId(first.id)
      setDeliveryAddress(first.customerAddress || '')
      setContactPerson(first.customerName || '')
      setContactPhone(first.customerPhone || '')
    }
  }, [pendingSales, selectedSaleId])

  if (!isOpen) return null

  const selectedSale = pendingSales.find((s) => s.id === selectedSaleId)

  const handleSaleChange = (saleId: string) => {
    setSelectedSaleId(saleId)
    const sale = pendingSales.find((s) => s.id === saleId)
    if (sale) {
      setDeliveryAddress(sale.customerAddress || '')
      setContactPerson(sale.customerName || '')
      setContactPhone(sale.customerPhone || '')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSaleId) {
      setError('Debes seleccionar una venta comercial para generar la remisión.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      await onCreateFromSale({
        saleId: selectedSaleId,
        deliveryAddress,
        contactPerson,
        contactPhone,
        notes,
      })
    } catch (err: any) {
      setError(err.message || 'Error al emitir la remisión desde la venta.')
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
          maxWidth: 600,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          borderRadius: 14,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
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
                background: 'rgba(0, 27, 92, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--navy)',
              }}
            >
              <AppIcon name="remisiones" size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)', margin: 0 }}>
                Crear Remisión desde Venta
              </h2>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                Genera orden de entrega y despacho vinculada a una venta comercial
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

        {/* Modal Body */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: '20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AppIcon name="warning" size={16} color="var(--red)" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Select Pending Sale */}
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
              Seleccionar Venta Comercial *
            </label>

            {loadingPendingSales ? (
              <div style={{ padding: '10px', fontSize: 12, color: 'var(--muted)' }}>
                Cargando ventas pendientes...
              </div>
            ) : pendingSales.length === 0 ? (
              <div
                style={{
                  padding: '16px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  textAlign: 'center',
                  fontSize: 13,
                  color: 'var(--muted)',
                }}
              >
                No hay ventas comerciales pendientes de entrega en este momento.
              </div>
            ) : (
              <CustomSelect
                value={selectedSaleId}
                onChange={handleSaleChange}
                options={pendingSales.map((s) => ({
                  value: s.id,
                  label: `${s.saleNumber} · ${s.customerName} (${s.locationName})`,
                }))}
                placeholder="Selecciona una venta..."
              />
            )}
          </div>

          {/* 2. Sale Summary */}
          {selectedSale && (
            <div
              style={{
                padding: '14px',
                borderRadius: 8,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                fontSize: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong style={{ color: 'var(--navy)' }}>Venta: {selectedSale.saleNumber}</strong>
                <span style={{ color: 'var(--muted)' }}>Bodega: {selectedSale.locationName}</span>
              </div>
              <div>
                <span style={{ color: 'var(--muted)' }}>Cliente: </span>
                <strong style={{ color: '#1e293b' }}>{selectedSale.customerName}</strong> (NIT: {selectedSale.customerDoc})
              </div>

              {/* Items preview */}
              <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: 6, marginTop: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)' }}>
                  Productos a entregar ({selectedSale.items?.length || 0} ítems):
                </span>
                <div style={{ maxHeight: 90, overflowY: 'auto', marginTop: 4 }}>
                  {(selectedSale.items || []).map((it: any, i: number) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 11,
                        color: '#475569',
                        padding: '2px 0',
                      }}
                    >
                      <span>{it.quantity}x {it.productName}</span>
                      <small style={{ color: 'var(--muted)' }}>{it.sku}</small>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 3. Destination Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 4 }}>
                Dirección de Entrega
              </label>
              <input
                type="text"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Dirección de descarga"
                style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 4 }}>
                Persona de Contacto / Receptor
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Nombre contacto"
                style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 4 }}>
              Instrucciones / Observaciones de Despacho
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instrucciones para la entrega..."
              rows={2}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, resize: 'none' }}
            />
          </div>

          {/* Modal Footer */}
          <div
            style={{
              marginTop: 10,
              paddingTop: 14,
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
              disabled={submitting || !selectedSaleId || pendingSales.length === 0}
            >
              <AppIcon name="remisiones" size={15} />
              {submitting ? 'Creando Remisión...' : 'Generar Remisión'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
