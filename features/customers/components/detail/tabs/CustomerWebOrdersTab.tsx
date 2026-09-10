'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomerWebOrderSummary } from '../../../types'

interface CustomerWebOrdersTabProps {
  orders: CustomerWebOrderSummary[]
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(isoString: string): string {
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

export function CustomerWebOrdersTab({ orders }: CustomerWebOrdersTabProps) {
  if (orders.length === 0) {
    return (
      <div className="table-empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 48,
            height: 48,
            borderRadius: 12,
            background: '#e9eef8',
            color: 'var(--navy)',
            margin: '0 auto 12px',
          }}
        >
          <AppIcon name="webOrders" size={24} />
        </div>
        <strong style={{ fontSize: 14 }}>No hay pedidos web</strong>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
          Este cliente aún no ha realizado pedidos a través de los catálogos digitales o tienda web.
        </p>
      </div>
    )
  }

  return (
    <div className="page-enter">
      <div className="table-panel products-table-panel" style={{ margin: 0 }}>
        <div className="table-scroll">
          <table aria-label="Pedidos web del cliente">
            <thead>
              <tr>
                <th>N° Pedido Web</th>
                <th>Fecha</th>
                <th>Canal Online</th>
                <th>Dirección Envío</th>
                <th>Método de Pago</th>
                <th>Items</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'center' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((ord) => (
                <tr key={ord.id}>
                  <td>
                    <strong className="mono" style={{ color: 'var(--navy)' }}>
                      {ord.orderNumber}
                    </strong>
                  </td>
                  <td>
                    <span style={{ fontSize: 12 }}>{formatDate(ord.date)}</span>
                  </td>
                  <td>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        color:
                          ord.channel === 'CATALOGO_DISTRIBUIDORA'
                            ? 'var(--navy)'
                            : 'var(--red)',
                      }}
                    >
                      <AppIcon
                        name={
                          ord.channel === 'CATALOGO_DISTRIBUIDORA'
                            ? 'ecommerceDist'
                            : 'ecommerceSM'
                        }
                        size={13}
                      />
                      <span>
                        {ord.channel === 'CATALOGO_DISTRIBUIDORA'
                          ? 'Catálogo Mayorista'
                          : 'Catálogo Super Más'}
                      </span>
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: 12, color: '#334155' }}>
                      {ord.shippingAddress}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {ord.paymentMethod}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: 12 }}>{ord.itemsCount} productos</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <strong style={{ fontSize: 13, color: 'var(--navy)' }}>
                      {formatCOP(ord.totalAmount)}
                    </strong>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span
                      className={`state ${
                        ord.status === 'DELIVERED'
                          ? 'disponible'
                          : ord.status === 'IN_TRANSIT'
                          ? 'publicado'
                          : 'pendiente'
                      }`}
                    >
                      <span>
                        {ord.status === 'DELIVERED'
                          ? 'Entregado'
                          : ord.status === 'IN_TRANSIT'
                          ? 'En camino'
                          : 'Procesando'}
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
