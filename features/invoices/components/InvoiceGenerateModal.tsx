'use client'

import React, { useState, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { GenerateInvoicePayload, InvoiceType, InvoicePaymentMethod } from '../types'

interface InvoiceGenerateModalProps {
  isOpen: boolean
  onClose: () => void
  pendingSales: any[]
  loadingPendingSales: boolean
  onGenerateInvoice: (payload: GenerateInvoicePayload) => Promise<any>
}

export function InvoiceGenerateModal({
  isOpen,
  onClose,
  pendingSales,
  loadingPendingSales,
  onGenerateInvoice,
}: InvoiceGenerateModalProps) {
  const [selectedSaleId, setSelectedSaleId] = useState<string>('')
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('ELECTRONICA')
  const [paymentMethod, setPaymentMethod] = useState<InvoicePaymentMethod>('EFECTIVO')
  const [paymentTerms, setPaymentTerms] = useState<string>('Contado')
  const [sendToDianImmediately, setSendToDianImmediately] = useState<boolean>(true)
  const [notes, setNotes] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-select first pending sale if available
  useEffect(() => {
    if (pendingSales.length > 0 && !selectedSaleId) {
      setSelectedSaleId(pendingSales[0].id)
    }
  }, [pendingSales, selectedSaleId])

  if (!isOpen) return null

  const selectedSale = pendingSales.find((s) => s.id === selectedSaleId)

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val)
  }

  // Customer validation warnings
  const isMissingDoc = !selectedSale?.customerDoc
  const isMissingEmail = !selectedSale?.customerEmail && invoiceType === 'ELECTRONICA'
  const hasFiscalWarning = isMissingDoc || isMissingEmail

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSaleId) {
      setError('Debes seleccionar una venta comercial para facturar.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      await onGenerateInvoice({
        saleId: selectedSaleId,
        type: invoiceType,
        paymentMethod,
        paymentTerms,
        sendToDianImmediately: invoiceType === 'ELECTRONICA' ? sendToDianImmediately : false,
        notes,
      })
    } catch (err: any) {
      setError(err.message || 'Error al emitir la factura.')
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
          maxWidth: 640,
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
              <AppIcon name="invoices" size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)', margin: 0 }}>
                Facturar Venta Comercial
              </h2>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                Genera documento fiscal y comprobante tributario DIAN
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

          {/* 1. Seleccionar Venta Pendiente */}
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
              Seleccionar Venta Pendiente de Facturar *
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
                No hay ventas comerciales pendientes de facturación en este momento.
              </div>
            ) : (
              <CustomSelect
                value={selectedSaleId}
                onChange={(val) => setSelectedSaleId(val)}
                options={pendingSales.map((s) => ({
                  value: s.id,
                  label: `${s.saleNumber} · ${s.customerName} · ${formatCOP(s.totalAmount)} (${s.locationName})`,
                }))}
                placeholder="Selecciona una venta..."
              />
            )}
          </div>

          {/* 2. Resumen de la Venta Seleccionada */}
          {selectedSale && (
            <div
              style={{
                padding: '14px',
                borderRadius: 8,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 13, color: 'var(--navy)' }}>
                  Detalle de Venta: {selectedSale.saleNumber}
                </strong>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: '#eff6ff',
                    color: '#1e40af',
                  }}
                >
                  {selectedSale.locationName}
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 8,
                  fontSize: 12,
                }}
              >
                <div>
                  <span style={{ color: 'var(--muted)', fontSize: 11 }}>Cliente:</span>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>{selectedSale.customerName}</div>
                </div>

                <div>
                  <span style={{ color: 'var(--muted)', fontSize: 11 }}>Documento / NIT:</span>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>
                    {selectedSale.customerDoc || 'No registrado'}
                  </div>
                </div>

                <div>
                  <span style={{ color: 'var(--muted)', fontSize: 11 }}>Fecha Venta:</span>
                  <div style={{ color: '#1e293b' }}>
                    {new Date(selectedSale.date).toLocaleDateString('es-CO')}
                  </div>
                </div>

                <div>
                  <span style={{ color: 'var(--muted)', fontSize: 11 }}>Monto Total Venta:</span>
                  <div style={{ fontWeight: 800, color: 'var(--navy)' }}>
                    {formatCOP(selectedSale.totalAmount)}
                  </div>
                </div>
              </div>

              {/* Line items mini preview */}
              <div style={{ marginTop: 4, borderTop: '1px dashed #cbd5e1', paddingTop: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)' }}>
                  Productos a Facturar ({selectedSale.items?.length || 0} ítems):
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
                      <span>
                        {it.quantity}x {it.productName}
                      </span>
                      <strong>{formatCOP(it.total || it.quantity * it.unitPrice)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fiscal Warning if needed */}
              {hasFiscalWarning && (
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    color: '#b45309',
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <AppIcon name="warning" size={14} color="#f59e0b" />
                  <span>
                    Advertencia: {isMissingDoc ? 'Falta NIT/CC del cliente. ' : ''}
                    {isMissingEmail ? 'Se recomienda registrar el correo para Factura Electrónica.' : ''}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 3. Tipo de Factura & Forma de Pago */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
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
                Tipo de Comprobante *
              </label>
              <CustomSelect
                value={invoiceType}
                onChange={(val) => setInvoiceType(val as InvoiceType)}
                options={[
                  { value: 'ELECTRONICA', label: 'Factura Electrónica de Venta (DIAN)' },
                  { value: 'POS', label: 'Factura POS (Punto de Venta / Caja)' },
                ]}
                placeholder="Seleccionar tipo"
              />
            </div>

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
                Método de Pago
              </label>
              <CustomSelect
                value={paymentMethod}
                onChange={(val) => setPaymentMethod(val as InvoicePaymentMethod)}
                options={[
                  { value: 'EFECTIVO', label: 'Efectivo' },
                  { value: 'TRANSFERENCIA', label: 'Transferencia Bancaria' },
                  { value: 'TARJETA', label: 'Tarjeta Débito / Crédito' },
                  { value: 'CREDITO', label: 'Crédito Comercial' },
                  { value: 'MIXTO', label: 'Pago Mixto' },
                ]}
                placeholder="Método de pago"
              />
            </div>
          </div>

          {/* 4. Términos & Transmisión Inmediata DIAN */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
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
                Condiciones de Pago
              </label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="Ej. Contado, Crédito 15 días"
                style={{
                  width: '100%',
                  height: 38,
                  padding: '0 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 12,
                }}
              />
            </div>

            {invoiceType === 'ELECTRONICA' && (
              <div style={{ display: 'flex', alignItems: 'center', marginTop: 22 }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--navy)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={sendToDianImmediately}
                    onChange={(e) => setSendToDianImmediately(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--navy)' }}
                  />
                  Transmitir a la DIAN inmediatamente
                </label>
              </div>
            )}
          </div>

          {/* 5. Observaciones */}
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
              Notas u Observaciones del Documento
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Añade observaciones visibles en la factura..."
              rows={2}
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
              disabled={submitting || !selectedSaleId || pendingSales.length === 0}
            >
              <AppIcon name="invoices" size={15} />
              {submitting ? 'Generando Factura...' : 'Emitir Factura'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
