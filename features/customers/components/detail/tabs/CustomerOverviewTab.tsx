'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomerDetail } from '../../../types'

interface CustomerOverviewTabProps {
  customer: CustomerDetail
  onAddPaymentClick?: () => void
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(isoString?: string): string {
  if (!isoString) return 'Sin fecha'
  try {
    const d = new Date(isoString)
    return d.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return isoString
  }
}

export function CustomerOverviewTab({ customer, onAddPaymentClick }: CustomerOverviewTabProps) {
  const averageTicket =
    customer.purchasesCount > 0
      ? Math.round(customer.totalPurchased / customer.purchasesCount)
      : 0

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. Metric Highlights Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
        }}
      >
        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: '#ffffff',
            border: '1.5px solid #cbd5e1',
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
            Total Comprado
          </span>
          <strong
            style={{
              display: 'block',
              fontSize: 18,
              color: 'var(--navy)',
              marginTop: 4,
              letterSpacing: '-0.5px',
            }}
          >
            {formatCOP(customer.totalPurchased)}
          </strong>
          <small style={{ fontSize: 10, color: 'var(--muted)' }}>
            {customer.purchasesCount} transacciones
          </small>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: '#ffffff',
            border: '1.5px solid #cbd5e1',
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
            Saldo en Cartera
          </span>
          <strong
            style={{
              display: 'block',
              fontSize: 18,
              color: customer.currentBalance > 0 ? 'var(--red)' : 'var(--green)',
              marginTop: 4,
              letterSpacing: '-0.5px',
            }}
          >
            {formatCOP(customer.currentBalance)}
          </strong>
          <small style={{ fontSize: 10, color: 'var(--muted)' }}>
            Cupo: {formatCOP(customer.creditLimit)}
          </small>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: '#ffffff',
            border: '1.5px solid #cbd5e1',
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
            Ticket Promedio
          </span>
          <strong
            style={{
              display: 'block',
              fontSize: 18,
              color: 'var(--foreground)',
              marginTop: 4,
              letterSpacing: '-0.5px',
            }}
          >
            {formatCOP(averageTicket)}
          </strong>
          <small style={{ fontSize: 10, color: 'var(--muted)' }}>
            Por orden de venta
          </small>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: '#ffffff',
            border: '1.5px solid #cbd5e1',
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
            Última Compra
          </span>
          <strong
            style={{
              display: 'block',
              fontSize: 15,
              color: 'var(--foreground)',
              marginTop: 4,
            }}
          >
            {formatDate(customer.lastPurchaseDate)}
          </strong>
          <small style={{ fontSize: 10, color: 'var(--muted)' }}>
            Cliente desde: {formatDate(customer.firstPurchaseDate || customer.createdAt)}
          </small>
        </div>
      </div>

      {/* 2. Commercial Conditions & Credit Alert */}
      {customer.currentBalance > 0 && (
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 12,
            background: '#fffbeb',
            border: '1.5px solid #fde68a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AppIcon name="wallet" size={20} color="#d97706" />
            <div>
              <strong style={{ fontSize: 13, color: '#92400e', display: 'block' }}>
                Obligaciones pendientes por cobrar: {formatCOP(customer.currentBalance)}
              </strong>
              <span style={{ fontSize: 11, color: '#b45309' }}>
                Plazo de crédito: {customer.creditDays} días calendario • Cupo disponible:{' '}
                {formatCOP(Math.max(0, customer.creditLimit - customer.currentBalance))}
              </span>
            </div>
          </div>
          {onAddPaymentClick && (
            <button
              type="button"
              className="primary-button compact"
              onClick={onAddPaymentClick}
              style={{ background: '#d97706', boxShadow: 'none' }}
            >
              <AppIcon name="plus" size={13} color="#fff" />
              <span>Registrar Pago</span>
            </button>
          )}
        </div>
      )}

      {/* 3. Relación por Bodegas / Puntos de Venta */}
      <div
        style={{
          padding: 18,
          borderRadius: 12,
          background: '#ffffff',
          border: '1.5px solid #cbd5e1',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AppIcon name="warehouse" size={16} color="var(--navy)" />
            <strong style={{ fontSize: 13 }}>Distribución de Compras por Bodega</strong>
          </div>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            Customer → Sales → Location Relation
          </span>
        </div>

        {customer.locationRelations.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
            Este cliente aún no registra transacciones por bodega.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {customer.locationRelations.map((loc) => (
              <div
                key={loc.locationId}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: '#f8fafc',
                  border: '1px solid var(--line)',
                }}
              >
                <strong style={{ fontSize: 12, color: 'var(--navy)', display: 'block' }}>
                  {loc.locationName}
                </strong>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                  Código: {loc.locationCode} • Última: {formatDate(loc.lastPurchaseDate)}
                </span>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11 }}>
                  <span>{loc.salesCount} venta(s)</span>
                  <strong style={{ color: 'var(--foreground)' }}>
                    {formatCOP(loc.totalPurchased)}
                  </strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Frequent Products List */}
      <div
        style={{
          padding: 18,
          borderRadius: 12,
          background: '#ffffff',
          border: '1.5px solid #cbd5e1',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AppIcon name="products" size={16} color="var(--navy)" />
            <strong style={{ fontSize: 13 }}>Productos de Mayor Consumo</strong>
          </div>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            Historial de compras acumulado
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {customer.frequentProducts.map((p) => (
            <div
              key={p.productId}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: 8,
                background: '#f8fafc',
                border: '1px solid #eef2f7',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 6,
                    background: '#e9eef8',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--navy)',
                  }}
                >
                  <AppIcon name="products" size={14} />
                </div>
                <div>
                  <strong style={{ fontSize: 12, display: 'block' }}>{p.productName}</strong>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>SKU: {p.sku}</span>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <strong style={{ fontSize: 12, color: 'var(--navy)' }}>
                  {p.unitsBought} unidades
                </strong>
                <span style={{ fontSize: 10, color: 'var(--muted)', display: 'block' }}>
                  {formatCOP(p.totalSpent)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
