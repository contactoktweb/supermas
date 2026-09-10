'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { POSCartItem as POSCartItemType, POSCustomer, POSTotals } from '../types'
import { POSCartItem } from './POSCartItem'

interface POSCartProps {
  cart?: POSCartItemType[]
  items?: POSCartItemType[]
  customer: POSCustomer | null
  totals: POSTotals
  onOpenCustomerModal: () => void
  onUpdateQuantity: (productId: string, newQty: number) => void
  onOpenDiscount?: (item: POSCartItemType) => void
  onOpenDiscountModal?: (item: POSCartItemType) => void
  onRemoveItem: (productId: string) => void
  onClearCart: () => void
  onOpenPaymentModal?: () => void
  onCheckout?: () => void
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function POSCart({
  cart,
  items,
  customer,
  totals,
  onOpenCustomerModal,
  onUpdateQuantity,
  onOpenDiscount,
  onOpenDiscountModal,
  onRemoveItem,
  onClearCart,
  onOpenPaymentModal,
  onCheckout,
}: POSCartProps) {
  const activeCart = cart || items || []
  const handleDiscountOpen = onOpenDiscountModal || onOpenDiscount || (() => {})
  const handleCheckoutOpen = onCheckout || onOpenPaymentModal || (() => {})

  const subtotal = totals.subtotal || 0
  const discountTotal = totals.discountTotal || totals.discountAmount || 0
  const taxTotal = totals.taxTotal || totals.taxAmount || 0
  const totalAmount = totals.totalAmount || 0
  const totalUnits = totals.totalUnits || totals.itemCount || activeCart.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <aside
      style={{
        flex: '1 1 40%',
        minWidth: 320,
        maxWidth: 460,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#ffffff',
      }}
    >
      {/* 1. Customer Selector Topbar */}
      <div
        style={{
          padding: '12px 14px',
          background: '#f8fafc',
          borderBottom: '1.5px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: '#eef4fd',
              color: 'var(--navy)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <AppIcon name="users" size={16} />
          </div>

          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Cliente
            </span>
            <strong
              style={{
                fontSize: 12,
                color: 'var(--navy)',
                display: 'block',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {customer?.displayName || customer?.name || 'Consumidor Final'}
            </strong>
          </div>
        </div>

        <button
          type="button"
          className="outline-button compact"
          onClick={onOpenCustomerModal}
          style={{ height: 28, fontSize: 11, padding: '0 8px', flexShrink: 0 }}
        >
          Cambiar (F4)
        </button>
      </div>

      {/* 2. Cart Items List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {activeCart.length === 0 ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--muted)',
              textAlign: 'center',
              padding: 16,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: '#f1f5f9',
                display: 'grid',
                placeItems: 'center',
                marginBottom: 8,
              }}
            >
              <AppIcon name="sales" size={24} color="#94a3b8" />
            </div>
            <strong style={{ fontSize: 14, color: 'var(--navy)', marginBottom: 2 }}>
              Carrito vacío
            </strong>
            <span style={{ fontSize: 12 }}>
              Haz clic en un producto o escanea su código de barras.
            </span>
          </div>
        ) : (
          activeCart.map((item) => (
            <POSCartItem
              key={item.id}
              item={item}
              onUpdateQuantity={onUpdateQuantity}
              onOpenDiscount={handleDiscountOpen}
              onRemove={onRemoveItem}
            />
          ))
        )}
      </div>

      {/* 3. Financial Totals & Action Section */}
      <div
        style={{
          borderTop: '1.5px solid var(--line)',
          background: '#f8fafc',
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          flexShrink: 0,
        }}
      >
        {/* Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}>
            <span>Subtotal ({totalUnits} {totalUnits === 1 ? 'unidad' : 'unidades'})</span>
            <strong style={{ color: 'var(--navy)' }}>{formatCOP(subtotal)}</strong>
          </div>

          {discountTotal > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803d' }}>
              <span>Descuento aplicado</span>
              <strong>-{formatCOP(discountTotal)}</strong>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}>
            <span>IVA (19% / Exento)</span>
            <strong style={{ color: 'var(--navy)' }}>{formatCOP(taxTotal)}</strong>
          </div>
        </div>

        {/* Big Total */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 8,
            borderTop: '1px solid var(--line)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>
              Total a Pagar
            </span>
            <strong style={{ fontSize: 22, fontWeight: 900, color: 'var(--navy)', lineHeight: 1.1 }}>
              {formatCOP(totalAmount)}
            </strong>
          </div>

          {activeCart.length > 0 && (
            <button
              type="button"
              onClick={onClearCart}
              className="text-link"
              style={{ fontSize: 11, color: 'var(--red)' }}
            >
              Vaciar carrito
            </button>
          )}
        </div>

        {/* Big Checkout Button */}
        <button
          type="button"
          disabled={activeCart.length === 0}
          onClick={handleCheckoutOpen}
          className="primary-button"
          style={{
            height: 48,
            fontSize: 15,
            fontWeight: 800,
            borderRadius: 10,
            background: 'var(--red)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: '0 4px 12px rgba(254, 17, 12, 0.25)',
            cursor: activeCart.length === 0 ? 'not-allowed' : 'pointer',
            opacity: activeCart.length === 0 ? 0.5 : 1,
            transition: 'all 0.15s ease',
          }}
        >
          <AppIcon name="creditCard" size={18} />
          <span>COBRAR / FINALIZAR (F8)</span>
        </button>
      </div>
    </aside>
  )
}
