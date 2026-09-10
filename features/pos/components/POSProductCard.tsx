'use client'

import React from 'react'
import { POSProduct } from '../types'

interface POSProductCardProps {
  product: POSProduct
  onClick?: () => void
  onSelect?: () => void
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function POSProductCard({ product, onClick, onSelect }: POSProductCardProps) {
  const handleClick = onSelect || onClick || (() => {})
  const isOutOfStock = product.availableStock <= 0
  const isLowStock = product.availableStock > 0 && product.availableStock <= 10

  return (
    <article
      onClick={() => {
        if (!isOutOfStock) {
          handleClick()
        }
      }}
      style={{
        borderRadius: 12,
        background: '#ffffff',
        border: '1.5px solid #cbd5e1',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: isOutOfStock ? 'not-allowed' : 'pointer',
        opacity: isOutOfStock ? 0.6 : 1,
        transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
        userSelect: 'none',
        position: 'relative',
        minHeight: 140,
      }}
      onMouseEnter={(e) => {
        if (!isOutOfStock) {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 27, 92, 0.08)'
          e.currentTarget.style.borderColor = 'var(--navy)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isOutOfStock) {
          e.currentTarget.style.transform = 'none'
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.borderColor = '#cbd5e1'
        }
      }}
    >
      {/* Stock status badge */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            color: 'var(--muted)',
            letterSpacing: '0.04em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '65%',
          }}
        >
          {product.category || 'General'}
        </span>

        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            padding: '2px 6px',
            borderRadius: 6,
            background: isOutOfStock ? '#fee2e2' : isLowStock ? '#fef3c7' : '#dcfce7',
            color: isOutOfStock ? '#b91c1c' : isLowStock ? '#b45309' : '#15803d',
          }}
        >
          {isOutOfStock ? 'Agotado' : `${product.availableStock} un.`}
        </span>
      </div>

      {/* Product Name & SKU */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <strong
          style={{
            fontSize: 13,
            color: 'var(--navy)',
            lineHeight: 1.25,
            marginBottom: 4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {product.name}
        </strong>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted)' }}>
          <span>SKU: {product.sku}</span>
          {product.unitOfMeasure && <span>· {product.unitOfMeasure}</span>}
        </div>
      </div>

      {/* Pricing display */}
      <div
        style={{
          marginTop: 10,
          paddingTop: 8,
          borderTop: '1px dashed var(--line)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {product.wholesalePrice && (
            <span style={{ fontSize: 10, color: 'var(--muted)', textDecoration: 'line-through' }}>
              May: {formatCOP(product.wholesalePrice)}
            </span>
          )}
          <strong style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy)' }}>
            {formatCOP(product.normalPrice)}
          </strong>
        </div>

        <button
          type="button"
          disabled={isOutOfStock}
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: isOutOfStock ? '#cbd5e1' : 'var(--navy)',
            color: '#ffffff',
            border: 'none',
            display: 'grid',
            placeItems: 'center',
            fontSize: 16,
            fontWeight: 700,
            cursor: isOutOfStock ? 'not-allowed' : 'pointer',
          }}
          title="Agregar al carrito"
          aria-label="Agregar al carrito"
        >
          +
        </button>
      </div>
    </article>
  )
}
