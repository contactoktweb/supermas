'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { DIANStatusBadge, InvoiceTypeBadge, InvoiceStatusBadge } from './DIANStatusBadge'
import { Invoice } from '../types'

interface InvoiceDetailDrawerProps {
  isOpen: boolean
  invoice: Invoice | null
  onClose: () => void
  onSendToDIAN: (invoiceId: string) => Promise<any>
  onOpenCreditNote: (invoice: Invoice) => void
  onOpenCancel: (invoice: Invoice) => void
  onOpenXml: (invoice: Invoice) => void
}

export function InvoiceDetailDrawer({
  isOpen,
  invoice,
  onClose,
  onSendToDIAN,
  onOpenCreditNote,
  onOpenCancel,
  onOpenXml,
}: InvoiceDetailDrawerProps) {
  const [copiedCufe, setCopiedCufe] = useState(false)
  const [sendingDIAN, setSendingDIAN] = useState(false)

  if (!isOpen || !invoice) return null

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val)
  }

  const handleCopyCufe = () => {
    if (!invoice.dianCufe) return
    navigator.clipboard.writeText(invoice.dianCufe)
    setCopiedCufe(true)
    setTimeout(() => setCopiedCufe(false), 2000)
  }

  const handleSendDIAN = async () => {
    try {
      setSendingDIAN(true)
      await onSendToDIAN(invoice.id)
    } catch (err: any) {
      alert(err.message || 'Error al transmitir a la DIAN')
    } finally {
      setSendingDIAN(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="product-drawer page-enter"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 680,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflowY: 'auto',
          background: '#ffffff',
        }}
      >
        {/* Drawer Header */}
        <div className="drawer-header" style={{ borderBottom: '1px solid #e2e8f0', padding: '18px 24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="eyebrow" style={{ margin: 0 }}>Comprobante Fiscal</span>
              <InvoiceTypeBadge type={invoice.type} size="sm" />
              <DIANStatusBadge status={invoice.dianStatus} size="sm" />
            </div>
            <h2 style={{ fontSize: 20, color: 'var(--navy)', margin: 0, fontWeight: 800 }}>
              {invoice.invoiceNumber}
            </h2>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar detalle"
            style={{ width: 34, height: 34 }}
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Drawer Content Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Quick Header Metric Banner */}
          <div
            style={{
              padding: '14px 18px',
              borderRadius: 10,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Total Facturado</span>
              <div style={{ fontSize: 22, fontWeight: 800, color: invoice.type === 'NOTA_CREDITO' ? 'var(--red)' : 'var(--navy)' }}>
                {invoice.type === 'NOTA_CREDITO' ? `-${formatCOP(invoice.total)}` : formatCOP(invoice.total)}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <InvoiceStatusBadge status={invoice.status} />
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                {invoice.paymentTerms || invoice.paymentMethod}
              </span>
            </div>
          </div>

          {/* Section 1: Customer & Operation Info */}
          <div className="drawer-section" style={{ padding: 0 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>
              Información del Cliente & Expedición
            </h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 10,
                background: '#f8fafc',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
              }}
            >
              <div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Razón Social / Nombre:</span>
                <p style={{ margin: '2px 0 0', fontWeight: 700, fontSize: 13, color: 'var(--navy)' }}>
                  {invoice.customerName}
                </p>
              </div>

              <div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Identificación Fiscal:</span>
                <p style={{ margin: '2px 0 0', fontWeight: 600, fontSize: 13, color: '#334155' }}>
                  {invoice.customerDocType || 'NIT'}: {invoice.customerDoc}
                </p>
              </div>

              <div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Correo Facturación:</span>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#334155' }}>
                  {invoice.customerEmail || 'No registrado'}
                </p>
              </div>

              <div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Teléfono / Celular:</span>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#334155' }}>
                  {invoice.customerPhone || 'No registrado'}
                </p>
              </div>

              <div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Dirección & Ciudad:</span>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#334155' }}>
                  {invoice.customerAddress || 'Bogotá'}, {invoice.customerCity || 'D.C.'}
                </p>
              </div>

              <div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Bodega de Despacho:</span>
                <p style={{ margin: '2px 0 0', fontWeight: 600, fontSize: 12, color: 'var(--navy)' }}>
                  {invoice.locationName}
                </p>
              </div>

              <div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Fecha & Hora (Bogotá):</span>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#334155' }}>
                  {new Date(invoice.date).toLocaleDateString('es-CO')} {invoice.issuedAtBogota || ''}
                </p>
              </div>

              <div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Vendedor / Expedidor:</span>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#334155' }}>
                  {invoice.sellerName || 'Administrador'}
                </p>
              </div>

              {invoice.saleNumber && (
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Venta Comercial Origen:</span>
                  <p style={{ margin: '2px 0 0', fontWeight: 700, fontSize: 12, color: 'var(--navy)' }}>
                    {invoice.saleNumber}
                  </p>
                </div>
              )}

              {invoice.originalInvoiceNumber && (
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Factura Afectada:</span>
                  <p style={{ margin: '2px 0 0', fontWeight: 700, fontSize: 12, color: 'var(--red)' }}>
                    {invoice.originalInvoiceNumber}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: DIAN Electronic Details */}
          {invoice.type === 'ELECTRONICA' && (
            <div className="drawer-section" style={{ padding: 0 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>
                Datos Fiscales DIAN & Firma Digital
              </h3>

              <div
                style={{
                  background: '#f8fafc',
                  padding: '14px 16px',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)' }}>
                      Código Único de Factura Electrónica (CUFE):
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCufe}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: copiedCufe ? '#10b981' : 'var(--navy)',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <AppIcon name={copiedCufe ? 'check' : 'edit'} size={12} />
                      {copiedCufe ? 'Copiado' : 'Copiar CUFE'}
                    </button>
                  </div>
                  <div
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 10,
                      background: '#ffffff',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      wordBreak: 'break-all',
                      color: '#334155',
                    }}
                  >
                    {invoice.dianCufe || 'Pendiente de generación de firma digital'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="outline-button"
                    onClick={() => onOpenXml(invoice)}
                    style={{ height: 32, fontSize: 11, padding: '0 10px' }}
                  >
                    <AppIcon name="terminal" size={13} /> Ver XML UBL 2.1
                  </button>

                  <button
                    type="button"
                    className="outline-button"
                    onClick={handlePrint}
                    style={{ height: 32, fontSize: 11, padding: '0 10px' }}
                  >
                    <AppIcon name="print" size={13} /> Representación Gráfica PDF
                  </button>

                  {invoice.dianStatus !== 'ACEPTADA' && invoice.status !== 'CANCELLED' && (
                    <button
                      type="button"
                      className="primary-button compact"
                      onClick={handleSendDIAN}
                      disabled={sendingDIAN}
                      style={{ height: 32, fontSize: 11, padding: '0 12px' }}
                    >
                      <AppIcon name="refresh" size={13} className={sendingDIAN ? 'spin' : ''} />
                      {sendingDIAN ? 'Transmitiendo...' : 'Transmitir a la DIAN'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Line Items Table */}
          <div className="drawer-section" style={{ padding: 0 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>
              Detalle de Productos Facturados ({invoice.itemsCount} ítems · {invoice.totalUnits} unidades)
            </h3>

            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px', color: 'var(--muted)', fontWeight: 600 }}>Producto</th>
                    <th style={{ padding: '8px 10px', color: 'var(--muted)', fontWeight: 600, textAlign: 'center' }}>Cant.</th>
                    <th style={{ padding: '8px 10px', color: 'var(--muted)', fontWeight: 600, textAlign: 'right' }}>P. Unit</th>
                    <th style={{ padding: '8px 10px', color: 'var(--muted)', fontWeight: 600, textAlign: 'right' }}>Desc.</th>
                    <th style={{ padding: '8px 10px', color: 'var(--muted)', fontWeight: 600, textAlign: 'center' }}>Tarifa IVA</th>
                    <th style={{ padding: '8px 10px', color: 'var(--muted)', fontWeight: 600, textAlign: 'right' }}>Subtotal</th>
                    <th style={{ padding: '8px 10px', color: 'var(--muted)', fontWeight: 600, textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, idx) => (
                    <tr
                      key={item.id || idx}
                      style={{
                        borderBottom: idx === invoice.items.length - 1 ? 'none' : '1px solid #f1f5f9',
                      }}
                    >
                      <td style={{ padding: '8px 10px' }}>
                        <strong style={{ color: 'var(--navy)', display: 'block' }}>{item.productName}</strong>
                        <small style={{ color: 'var(--muted)' }}>{item.sku}</small>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>
                        {item.quantity} {item.unitOfMeasure}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#334155' }}>
                        {formatCOP(item.unitPrice)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#64748b' }}>
                        {item.discountAmount > 0 ? formatCOP(item.discountAmount) : '—'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            background: '#f1f5f9',
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 700,
                            color: '#475569',
                          }}
                        >
                          {item.taxRatePercent}% ({item.taxCode})
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 500, color: '#334155' }}>
                        {formatCOP(item.subtotal)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--navy)' }}>
                        {formatCOP(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Taxes & Totals Breakdown */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 14,
            }}
          >
            {/* Taxes Breakdown */}
            <div
              style={{
                background: '#f8fafc',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
              }}
            >
              <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', margin: '0 0 8px' }}>
                Liquidación de Impuestos DIAN
              </h4>
              {invoice.taxesBreakdown && invoice.taxesBreakdown.length > 0 ? (
                invoice.taxesBreakdown.map((tb, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      color: '#475569',
                      padding: '3px 0',
                      borderBottom: idx === invoice.taxesBreakdown.length - 1 ? 'none' : '1px dashed #e2e8f0',
                    }}
                  >
                    <span>
                      {tb.taxName} ({tb.ratePercent}%) · Base {formatCOP(tb.taxableBase)}:
                    </span>
                    <strong style={{ color: 'var(--navy)' }}>{formatCOP(tb.taxAmount)}</strong>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Exento de IVA / Sin impuestos</div>
              )}
            </div>

            {/* Financial Totals */}
            <div
              style={{
                background: '#f8fafc',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569' }}>
                <span>Subtotal Bruto:</span>
                <span>{formatCOP(invoice.subtotal + invoice.discountTotal)}</span>
              </div>
              {invoice.discountTotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--red)' }}>
                  <span>Descuentos Aplicados:</span>
                  <span>-{formatCOP(invoice.discountTotal)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569' }}>
                <span>Total Impuestos:</span>
                <span>+{formatCOP(invoice.taxTotal)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 14,
                  fontWeight: 800,
                  color: invoice.type === 'NOTA_CREDITO' ? 'var(--red)' : 'var(--navy)',
                  borderTop: '1px solid #cbd5e1',
                  paddingTop: 6,
                  marginTop: 2,
                }}
              >
                <span>Total Documento:</span>
                <span>
                  {invoice.type === 'NOTA_CREDITO' ? `-${formatCOP(invoice.total)}` : formatCOP(invoice.total)}
                </span>
              </div>
            </div>
          </div>

          {/* Section 5: DIAN Transmission & Audit Timeline */}
          {invoice.transmissionHistory && invoice.transmissionHistory.length > 0 && (
            <div className="drawer-section" style={{ padding: 0 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>
                Historial de Transmisiones DIAN & Trazabilidad
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {invoice.transmissionHistory.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 6,
                      background: log.status === 'EXITOSO' ? '#f0fdf4' : '#fef2f2',
                      border: `1px solid ${log.status === 'EXITOSO' ? '#bbf7d0' : '#fecaca'}`,
                      fontSize: 11,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontWeight: 700, color: log.status === 'EXITOSO' ? '#166534' : '#991b1b' }}>
                        {log.action} · {log.status}
                      </span>
                      <span style={{ color: 'var(--muted)' }}>
                        {new Date(log.timestamp).toLocaleDateString('es-CO')} {new Date(log.timestamp).toLocaleTimeString('es-CO')}
                      </span>
                    </div>
                    <p style={{ margin: 0, color: '#334155' }}>{log.message}</p>
                    <small style={{ color: 'var(--muted)', display: 'block', marginTop: 3 }}>
                      Usuario: {log.user} {log.responseTimeMs ? `· Tiempo respuesta: ${log.responseTimeMs}ms` : ''}
                    </small>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cancellation Notice if Cancelled */}
          {invoice.status === 'CANCELLED' && (
            <div
              style={{
                padding: '12px 16px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 8,
                color: '#991b1b',
                fontSize: 12,
              }}
            >
              <strong style={{ display: 'block', marginBottom: 2 }}>Factura Anulada</strong>
              <p style={{ margin: 0 }}>Motivo: {invoice.cancelReason || 'Anulación administrativa'}</p>
              {invoice.cancelledBy && (
                <small style={{ display: 'block', marginTop: 4, color: '#b91c1c' }}>
                  Anulada por: {invoice.cancelledBy} el{' '}
                  {invoice.cancelledAt ? new Date(invoice.cancelledAt).toLocaleString('es-CO') : ''}
                </small>
              )}
            </div>
          )}
        </div>

        {/* Drawer Action Footer */}
        <div
          style={{
            marginTop: 'auto',
            padding: '16px 24px',
            borderTop: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {invoice.status !== 'CANCELLED' && invoice.type !== 'NOTA_CREDITO' && (
              <button
                type="button"
                className="outline-button"
                onClick={() => onOpenCreditNote(invoice)}
                style={{ fontSize: 12 }}
              >
                <AppIcon name="receipt" size={14} color="var(--navy)" />
                Emitir Nota Crédito
              </button>
            )}

            {invoice.status !== 'CANCELLED' && (
              <button
                type="button"
                className="outline-button"
                onClick={() => onOpenCancel(invoice)}
                style={{ fontSize: 12, color: 'var(--red)', borderColor: 'rgba(254, 17, 12, 0.25)' }}
              >
                <AppIcon name="trash" size={14} color="var(--red)" />
                Anular Factura
              </button>
            )}
          </div>

          <button
            type="button"
            className="primary-button compact"
            onClick={handlePrint}
            style={{ fontSize: 12 }}
          >
            <AppIcon name="print" size={14} /> Imprimir Comprobante
          </button>
        </div>
      </aside>
    </div>
  )
}
