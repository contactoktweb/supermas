'use client'

import React from 'react'
import { POSTicketReceipt } from '../types'
import { AppIcon } from '@/components/ui/Icon'
import { Heart } from 'lucide-react'

interface POSTicketReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  receipt: POSTicketReceipt | null
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount)
}

export const POSTicketReceiptModal: React.FC<POSTicketReceiptModalProps> = ({
  isOpen,
  onClose,
  receipt,
}) => {
  if (!isOpen || !receipt) return null

  const handlePrint = () => {
    window.print()
  }

  const changeAmount = receipt.changeAmount ?? receipt.change ?? 0
  const discountAmount = receipt.discountTotal || receipt.discountAmount || 0
  const taxAmount = receipt.taxTotal || receipt.taxAmount || 0

  return (
    <div className="drawer-backdrop modal-center" onClick={onClose}>
      <div
        className="modal-card animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-modal-title"
        style={{
          width: 'min(100%, 460px)',
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 24px 50px rgba(0, 27, 92, 0.22)',
          padding: 24,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          border: '1px solid var(--line)',
        }}
      >
        {/* Header */}
        <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="modal-header-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              className="modal-icon-badge"
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: '#dcfce7',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <AppIcon name="check" size={20} color="#15803d" />
            </div>
            <div>
              <h3 id="receipt-modal-title" style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--navy)' }}>
                ¡Venta Exitosa!
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#15803d', fontWeight: 600 }}>
                Comprobante generado correctamente
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar recibo"
            style={{ width: 32, height: 32 }}
          >
            <AppIcon name="close" size={16} />
          </button>
        </div>

        {/* Printable Thermal Receipt Container */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', padding: 12, borderRadius: 12, border: '1px solid var(--line)' }}>
          <div
            id="thermal-receipt"
            style={{
              background: '#ffffff',
              padding: 16,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              border: '1px dashed #cbd5e1',
              borderRadius: 8,
              fontFamily: 'monospace',
              fontSize: 11,
              lineHeight: 1.45,
              color: '#1e293b',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {/* Store Header */}
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #94a3b8', paddingBottom: 8 }}>
              <strong style={{ fontSize: 13, fontWeight: 900, color: 'var(--navy)', display: 'block', fontFamily: 'sans-serif' }}>
                DISTRIBUIDORA SUPER MÁS S.A.S.
              </strong>
              <div style={{ fontWeight: 700, color: '#475569' }}>NIT: 901.458.789-2</div>
              <div style={{ color: '#64748b' }}>{receipt.locationName}</div>
              <div style={{ color: '#64748b' }}>Calle 45 # 12-34 · Tel: (601) 321 0000</div>
              <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', marginTop: 2 }}>Responsable de IVA - Régimen Común</div>
              <div style={{ fontSize: 9, color: '#94a3b8' }}>Res. DIAN POS 18764000001 (2026-01-01)</div>
            </div>

            {/* Metadata */}
            <div style={{ borderBottom: '1px dashed #94a3b8', paddingBottom: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: 'var(--navy)' }}>
                <span>FACTURA POS:</span>
                <span>{receipt.invoiceNumber}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Venta No:</span>
                <span>{receipt.saleNumber}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Fecha / Hora:</span>
                <span>{receipt.issuedAtBogota || new Date(receipt.date).toLocaleString('es-CO')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Cajero / Caja:</span>
                <span>{receipt.cashierName} / {receipt.cashRegisterNumber || 'CAJA-01'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4, borderTop: '1px dashed #e2e8f0' }}>
                <span>Cliente:</span>
                <strong style={{ maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {receipt.customerName}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Doc / NIT:</span>
                <span>{receipt.customerDoc}</span>
              </div>
            </div>

            {/* Items Table */}
            <div style={{ borderBottom: '1px dashed #94a3b8', paddingBottom: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '6fr 2fr 4fr', fontWeight: 800, borderBottom: '1px solid #e2e8f0', paddingBottom: 4, marginBottom: 4 }}>
                <span>Desc</span>
                <span style={{ textAlign: 'center' }}>Cant</span>
                <span style={{ textAlign: 'right' }}>Total</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {receipt.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '6fr 2fr 4fr' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                    </div>
                    <div style={{ textAlign: 'center', fontWeight: 700 }}>{item.quantity}</div>
                    <div style={{ textAlign: 'right', fontWeight: 800 }}>{formatCOP(item.total)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div style={{ borderBottom: '1px dashed #94a3b8', paddingBottom: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal:</span>
                <span>{formatCOP(receipt.subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803d', fontWeight: 700 }}>
                  <span>Descuento:</span>
                  <span>-{formatCOP(discountAmount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>IVA (19% / Exento):</span>
                <span>{formatCOP(taxAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 13, color: 'var(--navy)', paddingTop: 4, borderTop: '1px solid #e2e8f0' }}>
                <span>TOTAL A PAGAR:</span>
                <span>{formatCOP(receipt.totalAmount)}</span>
              </div>
            </div>

            {/* Payment Details */}
            <div style={{ borderBottom: '1px dashed #94a3b8', paddingBottom: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Método de Pago:</span>
                <strong style={{ color: 'var(--navy)' }}>{receipt.paymentMethod}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Monto Recibido:</span>
                <span>{formatCOP(receipt.amountPaid)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                <span>Cambio / Vuelto:</span>
                <strong style={{ color: '#15803d' }}>{formatCOP(changeAmount)}</strong>
              </div>
            </div>

            {/* Footer Notes & K&T Attribution */}
            <div style={{ textAlign: 'center', paddingTop: 4, fontFamily: 'sans-serif', color: '#64748b' }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 11, color: 'var(--navy)' }}>
                ¡Gracias por su compra en Super Más!
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 10 }}>Conserve este comprobante.</p>

              {/* Dynamic Branding & Attribution */}
              <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #e2e8f0', fontSize: 10, color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <span>© {new Date().getFullYear()} Super Más.</span>
                <a
                  href="https://www.kytcode.lat"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontWeight: 700, color: '#334155', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                >
                  Desarrollado por K&T <Heart style={{ width: 10, height: 10, fill: '#0f172a', color: '#0f172a' }} />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
          <button
            type="button"
            onClick={handlePrint}
            className="outline-button"
            style={{ flex: 1, height: 42, fontSize: 13, fontWeight: 700, gap: 6 }}
          >
            <AppIcon name="print" size={16} />
            <span>Imprimir Ticket</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="primary-button"
            style={{ flex: 1, height: 42, fontSize: 13, fontWeight: 800, background: 'var(--navy)', gap: 6 }}
          >
            <span>Nueva Venta</span>
            <AppIcon name="chevronRight" size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
