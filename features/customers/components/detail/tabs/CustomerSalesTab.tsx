'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomerSaleSummary } from '../../../types'

interface CustomerSalesTabProps {
  sales: CustomerSaleSummary[]
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
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoString
  }
}

export function CustomerSalesTab({ sales }: CustomerSalesTabProps) {
  if (sales.length === 0) {
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
          <AppIcon name="sales" size={24} />
        </div>
        <strong style={{ fontSize: 14 }}>No hay ventas registradas</strong>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
          Este cliente aún no registra órdenes de venta ni facturas POS.
        </p>
      </div>
    )
  }

  return (
    <div className="page-enter">
      <div className="table-panel products-table-panel" style={{ margin: 0 }}>
        <div className="table-scroll">
          <table aria-label="Historial de ventas del cliente">
            <thead>
              <tr>
                <th>Código Venta</th>
                <th>Fecha / Hora</th>
                <th>Bodega</th>
                <th>Vendedor</th>
                <th>Items</th>
                <th>Medio de Pago</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'center' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong className="mono" style={{ color: 'var(--navy)' }}>
                      {s.saleCode}
                    </strong>
                  </td>
                  <td>
                    <span style={{ fontSize: 12 }}>{formatDate(s.date)}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: 12 }}>{s.locationName}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: 12 }}>{s.sellerName}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: 12 }}>{s.itemsCount} productos</span>
                  </td>
                  <td>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>
                      {s.paymentMethod}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <strong style={{ fontSize: 13, color: 'var(--navy)' }}>
                      {formatCOP(s.totalAmount)}
                    </strong>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="state disponible">
                      <AppIcon name="check" size={11} />
                      <span>{s.status}</span>
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
