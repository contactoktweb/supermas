'use client'

import React, { useState, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { Invoice, CreditNotePayload } from '../types'

interface CreditNoteModalProps {
  isOpen: boolean
  invoice: Invoice | null
  onClose: () => void
  onCreateCreditNote: (payload: CreditNotePayload) => Promise<any>
}

type CreditReason =
  | 'DEVOLUCION_TOTAL'
  | 'DEVOLUCION_PARCIAL'
  | 'AJUSTE_PRECIO'
  | 'DESCUENTO_POSTERIOR'
  | 'ERROR_FACTURACION'

export function CreditNoteModal({
  isOpen,
  invoice,
  onClose,
  onCreateCreditNote,
}: CreditNoteModalProps) {
  const [reason, setReason] = useState<CreditReason>('DEVOLUCION_TOTAL')
  const [notes, setNotes] = useState('')
  const [adjustInventory, setAdjustInventory] = useState(true)
  const [sendToDianImmediately, setSendToDianImmediately] = useState(true)
  const [itemSelections, setItemSelections] = useState<
    Array<{
      productId: string
      productName: string
      maxQuantity: number
      quantity: number
      unitPrice: number
      taxRatePercent: number
      selected: boolean
    }>
  >([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (invoice && invoice.items) {
      setItemSelections(
        invoice.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          maxQuantity: item.quantity,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRatePercent: item.taxRatePercent || 19,
          selected: true,
        }))
      )
    }
  }, [invoice])

  if (!isOpen || !invoice) return null

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val)
  }

  const handleQuantityChange = (productId: string, qty: number) => {
    setItemSelections((prev) =>
      prev.map((it) => {
        if (it.productId === productId) {
          const clamped = Math.max(0, Math.min(qty, it.maxQuantity))
          return { ...it, quantity: clamped, selected: clamped > 0 }
        }
        return it
      })
    )
  }

  const handleToggleSelect = (productId: string) => {
    setItemSelections((prev) =>
      prev.map((it) => {
        if (it.productId === productId) {
          const nextSelected = !it.selected
          return {
            ...it,
            selected: nextSelected,
            quantity: nextSelected ? (it.quantity === 0 ? it.maxQuantity : it.quantity) : 0,
          }
        }
        return it
      })
    )
  }

  // Calculate Credit Note Total
  const selectedItems = itemSelections.filter((it) => it.selected && it.quantity > 0)
  const totalCredit = selectedItems.reduce((acc, it) => {
    const gross = it.quantity * it.unitPrice
    const tax = gross * (it.taxRatePercent / 100)
    return acc + gross + tax
  }, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedItems.length === 0) {
      setError('Debes incluir al menos un producto con cantidad mayor a 0.')
      return
    }

    if (!notes.trim()) {
      setError('El motivo o justificación de la Nota Crédito es obligatorio.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      await onCreateCreditNote({
        invoiceId: invoice.id,
        reason,
        notes,
        adjustInventory,
        sendToDianImmediately,
        items: selectedItems.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          taxRatePercent: it.taxRatePercent,
        })),
      })
    } catch (err: any) {
      setError(err.message || 'Error al emitir Nota Crédito')
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
          maxWidth: 680,
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
                background: 'rgba(254, 17, 12, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--red)',
              }}
            >
              <AppIcon name="receipt" size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)', margin: 0 }}>
                Emitir Nota Crédito
              </h2>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                Afecta factura {invoice.invoiceNumber} · {invoice.customerName}
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

          {/* 1. Motivo de la Nota Crédito */}
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
              Motivo Tributario / Comercial *
            </label>
            <CustomSelect
              value={reason}
              onChange={(val) => setReason(val as CreditReason)}
              options={[
                { value: 'DEVOLUCION_TOTAL', label: '1. Devolución Total de Mercancía' },
                { value: 'DEVOLUCION_PARCIAL', label: '2. Devolución Parcial de Productos' },
                { value: 'AJUSTE_PRECIO', label: '3. Ajuste de Precio / Corrección' },
                { value: 'DESCUENTO_POSTERIOR', label: '4. Descuento o Bonificación Comercial' },
                { value: 'ERROR_FACTURACION', label: '5. Error en Datos de Facturación' },
              ]}
              placeholder="Seleccionar motivo"
            />
          </div>

          {/* 2. Tabla de Selección de Productos a Acreditar */}
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
              Selección de Productos & Cantidades
            </label>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px', width: 30 }}></th>
                    <th style={{ padding: '8px 10px', color: 'var(--muted)', fontWeight: 600 }}>Producto</th>
                    <th style={{ padding: '8px 10px', color: 'var(--muted)', fontWeight: 600, textAlign: 'center' }}>Facturado</th>
                    <th style={{ padding: '8px 10px', color: 'var(--muted)', fontWeight: 600, textAlign: 'center', width: 90 }}>A Devolver</th>
                    <th style={{ padding: '8px 10px', color: 'var(--muted)', fontWeight: 600, textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {itemSelections.map((it) => {
                    const lineGross = it.quantity * it.unitPrice
                    const lineTotal = lineGross + lineGross * (it.taxRatePercent / 100)
                    return (
                      <tr
                        key={it.productId}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: it.selected ? '#fff' : '#f8fafc',
                          opacity: it.selected ? 1 : 0.6,
                        }}
                      >
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={it.selected}
                            onChange={() => handleToggleSelect(it.productId)}
                            style={{ accentColor: 'var(--navy)' }}
                          />
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <strong style={{ color: 'var(--navy)', display: 'block' }}>{it.productName}</strong>
                          <small style={{ color: 'var(--muted)' }}>{formatCOP(it.unitPrice)} c/u</small>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>
                          {it.maxQuantity}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <input
                            type="number"
                            min="0"
                            max={it.maxQuantity}
                            value={it.quantity}
                            onChange={(e) =>
                              handleQuantityChange(it.productId, parseInt(e.target.value, 10) || 0)
                            }
                            disabled={!it.selected}
                            style={{
                              width: 60,
                              height: 30,
                              textAlign: 'center',
                              borderRadius: 4,
                              border: '1px solid #cbd5e1',
                              fontWeight: 700,
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--red)' }}>
                          {formatCOP(lineTotal)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Total Nota Crédito summary */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                background: '#fef2f2',
                borderRadius: 8,
                marginTop: 8,
                border: '1px solid #fecaca',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: '#991b1b' }}>
                Total de la Nota Crédito ({selectedItems.length} ítems):
              </span>
              <strong style={{ fontSize: 16, color: 'var(--red)', fontWeight: 800 }}>
                -{formatCOP(totalCredit)}
              </strong>
            </div>
          </div>

          {/* 3. Opciones de Inventario y DIAN */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--navy)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={adjustInventory}
                onChange={(e) => setAdjustInventory(e.target.checked)}
                style={{ accentColor: 'var(--navy)', width: 16, height: 16 }}
              />
              Reingresar mercancía a bodega (Movimiento Kardex RETURN_IN)
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--navy)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={sendToDianImmediately}
                onChange={(e) => setSendToDianImmediately(e.target.checked)}
                style={{ accentColor: 'var(--navy)', width: 16, height: 16 }}
              />
              Transmitir Nota Crédito Electrónica a la DIAN inmediatamente
            </label>
          </div>

          {/* 4. Justificación / Observaciones */}
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
              Justificación / Explicación del Ajuste *
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explica detalladamente la causa de la nota crédito..."
              rows={2}
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
              disabled={submitting || selectedItems.length === 0}
              style={{ background: 'var(--red)', borderColor: 'var(--red)' }}
            >
              <AppIcon name="receipt" size={15} />
              {submitting ? 'Emitiendo Nota Crédito...' : 'Confirmar Nota Crédito'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
