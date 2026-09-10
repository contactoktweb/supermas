'use client'

import React, { useState, useEffect } from 'react'
import { POSCartItem } from '../types'
import { AppIcon } from '@/components/ui/Icon'

interface POSDiscountModalProps {
  isOpen: boolean
  onClose: () => void
  item: POSCartItem | null
  onApplyDiscount: (productId: string, percent: number, reason?: string) => void
}

const PRESET_DISCOUNTS = [5, 10, 15, 20]

const REASON_OPTIONS = [
  'Autorización de Supervisor',
  'Fidelización Cliente Frecuente',
  'Promoción especial de temporada',
  'Convenio corporativo',
  'Avería o detalle menor en empaque',
]

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount)
}

export const POSDiscountModal: React.FC<POSDiscountModalProps> = ({
  isOpen,
  onClose,
  item,
  onApplyDiscount,
}) => {
  const [percent, setPercent] = useState<number>(0)
  const [reason, setReason] = useState<string>(REASON_OPTIONS[0])
  const [customReason, setCustomReason] = useState<string>('')

  useEffect(() => {
    if (isOpen && item) {
      setPercent(item.discountPercent || 0)
      setReason(item.discountReason || REASON_OPTIONS[0])
      setCustomReason('')
    }
  }, [isOpen, item])

  if (!isOpen || !item) return null

  const handleApply = () => {
    const finalReason = reason === 'OTRO' ? customReason : reason
    onApplyDiscount(item.productId, percent, finalReason)
    onClose()
  }

  const handleRemove = () => {
    onApplyDiscount(item.productId, 0, undefined)
    onClose()
  }

  const grossTotal = item.quantity * item.unitPrice
  const discountAmount = Math.round(grossTotal * (percent / 100))
  const newSubtotal = grossTotal - discountAmount

  return (
    <div className="drawer-backdrop modal-center" onClick={onClose}>
      <div
        className="modal-card animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="discount-modal-title"
        style={{
          width: 'min(100%, 480px)',
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 24px 50px rgba(0, 27, 92, 0.22)',
          padding: 24,
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
                background: '#edf2fa',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <AppIcon name="receipt" size={20} color="var(--navy)" />
            </div>
            <div>
              <h3 id="discount-modal-title" style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--navy)' }}>
                Aplicar Descuento
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b', maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.productName}
              </p>
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

        {/* Form Body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Percentage */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--navy)' }}>
              Porcentaje de Descuento (%)
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="number"
                min="0"
                max="100"
                value={percent === 0 ? '' : percent}
                onChange={(e) => setPercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                placeholder="0"
                style={{
                  width: '100%',
                  height: 44,
                  padding: '0 36px 0 14px',
                  fontSize: 18,
                  fontWeight: 800,
                  borderRadius: 10,
                  border: '2px solid #cbd5e1',
                  color: 'var(--navy)',
                  outline: 'none',
                }}
              />
              <span style={{ position: 'absolute', right: 14, fontSize: 16, fontWeight: 800, color: '#94a3b8' }}>
                %
              </span>
            </div>

            {/* Presets */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 4 }}>
              {PRESET_DISCOUNTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPercent(preset)}
                  style={{
                    height: 32,
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: percent === preset ? 800 : 600,
                    border: percent === preset ? '1.5px solid var(--navy)' : '1px solid #cbd5e1',
                    background: percent === preset ? 'var(--navy)' : '#ffffff',
                    color: percent === preset ? '#ffffff' : 'var(--navy)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {preset}%
                </button>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--navy)' }}>
              Motivo del Descuento
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{
                height: 42,
                padding: '0 12px',
                borderRadius: 9,
                border: '1px solid #cbd5e1',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--navy)',
                background: '#ffffff',
                outline: 'none',
              }}
            >
              {REASON_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
              <option value="OTRO">Otro motivo personalizado...</option>
            </select>

            {reason === 'OTRO' && (
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Describe el motivo del descuento..."
                style={{
                  height: 38,
                  padding: '0 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 12,
                  marginTop: 6,
                  color: 'var(--navy)',
                  outline: 'none',
                }}
              />
            )}
          </div>

          {/* Calculation Card */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid var(--line)',
              borderRadius: 12,
              padding: '12px 14px',
              fontSize: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              color: '#64748b',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Precio Original ({item.quantity} un.):</span>
              <strong style={{ color: 'var(--navy)' }}>{formatCOP(grossTotal)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803d', fontWeight: 700 }}>
              <span>Descuento ({percent}%):</span>
              <span>-{formatCOP(discountAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: 6, fontSize: 13, fontWeight: 900, color: 'var(--navy)' }}>
              <span>Nuevo Subtotal:</span>
              <span>{formatCOP(newSubtotal)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingTop: 12,
            borderTop: '1px solid var(--line)',
          }}
        >
          {item.discountPercent > 0 ? (
            <button
              type="button"
              onClick={handleRemove}
              className="text-link"
              style={{ fontSize: 12, color: 'var(--red)', fontWeight: 700 }}
            >
              Quitar descuento
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="outline-button"
              style={{ height: 38, padding: '0 16px', fontSize: 12, fontWeight: 700 }}
            >
              Cancelar
            </button>
          )}

          <button
            type="button"
            onClick={handleApply}
            className="primary-button"
            style={{
              height: 38,
              padding: '0 20px',
              fontSize: 13,
              fontWeight: 800,
              gap: 6,
              background: 'var(--navy)',
            }}
          >
            <AppIcon name="check" size={14} />
            <span>Aplicar Descuento</span>
          </button>
        </div>
      </div>
    </div>
  )
}
