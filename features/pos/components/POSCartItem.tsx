'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { POSCartItem as POSCartItemType } from '../types'

interface POSCartItemProps {
  item: POSCartItemType
  onUpdateQuantity: (productId: string, newQty: number) => void
  onOpenDiscount: (item: POSCartItemType) => void
  onRemove: (productId: string) => void
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function POSCartItem({
  item,
  onUpdateQuantity,
  onOpenDiscount,
  onRemove,
}: POSCartItemProps) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 10,
        background: '#ffffff',
        border: '1.5px solid #cbd5e1',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        transition: 'all 0.15s ease',
      }}
    >
      {/* Top Row: Name and Delete */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong
            style={{
              fontSize: 13,
              color: 'var(--navy)',
              display: 'block',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.2,
            }}
            title={item.productName}
          >
            {item.productName}
          </strong>
          <small style={{ fontSize: 11, color: '#64748b' }}>
            {formatCOP(item.unitPrice)} c/u • {item.unitOfMeasure}
          </small>
        </div>

        <button
          type="button"
          className="icon-button"
          onClick={() => onRemove(item.productId)}
          style={{ color: 'var(--red)', width: 24, height: 24, flexShrink: 0 }}
          aria-label="Eliminar producto"
        >
          <AppIcon name="trash" size={13} />
        </button>
      </div>

      {/* Bottom Row: Quantity Stepper, Discount Tag, Line Total */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
        }}
      >
        {/* Quantity Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#f1f5f9',
            borderRadius: 8,
            padding: '2px 4px',
            gap: 2,
          }}
        >
          <button
            type="button"
            className="icon-button"
            onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
            style={{ width: 26, height: 26, background: '#ffffff', border: '1px solid #cbd5e1' }}
            aria-label="Restar una unidad"
          >
            -
          </button>

          <input
            type="number"
            min="1"
            max={item.availableStock}
            value={item.quantity}
            onChange={(e) =>
              onUpdateQuantity(item.productId, parseInt(e.target.value) || 0)
            }
            style={{
              width: 38,
              height: 26,
              textAlign: 'center',
              fontWeight: 800,
              fontSize: 12,
              border: 'none',
              background: 'transparent',
              color: 'var(--navy)',
            }}
          />

          <button
            type="button"
            className="icon-button"
            onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
            disabled={item.quantity >= item.availableStock}
            style={{ width: 26, height: 26, background: '#ffffff', border: '1px solid #cbd5e1' }}
            aria-label="Sumar una unidad"
          >
            +
          </button>
        </div>

        {/* Discount Tag / Button */}
        <button
          type="button"
          onClick={() => onOpenDiscount(item)}
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: 6,
            border: item.discountPercent > 0 ? '1px solid #10b981' : '1px solid #cbd5e1',
            background: item.discountPercent > 0 ? '#ecfdf5' : '#ffffff',
            color: item.discountPercent > 0 ? '#047857' : '#64748b',
            cursor: 'pointer',
          }}
        >
          {item.discountPercent > 0 ? `-${item.discountPercent}% Dcto` : '% Dcto'}
        </button>

        {/* Line Total */}
        <div style={{ textAlign: 'right' }}>
          <strong style={{ fontSize: 14, color: 'var(--navy)', fontWeight: 800 }}>
            {formatCOP(item.total)}
          </strong>
        </div>
      </div>
    </div>
  )
}
