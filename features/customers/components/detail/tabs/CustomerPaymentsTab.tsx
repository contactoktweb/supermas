'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomerPaymentSummary } from '../../../types'

interface CustomerPaymentsTabProps {
  payments: CustomerPaymentSummary[]
  currentBalance: number
  onAddPaymentClick?: () => void
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

export function CustomerPaymentsTab({
  payments,
  currentBalance,
  onAddPaymentClick,
}: CustomerPaymentsTabProps) {
  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header with Balance & Action */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderRadius: 12,
          background: currentBalance > 0 ? '#fffbeb' : '#f0fbf6',
          border: `1.5px solid ${currentBalance > 0 ? '#fde68a' : '#a7f3d0'}`,
        }}
      >
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>
            Estado de Cartera Actual
          </span>
          <strong
            style={{
              display: 'block',
              fontSize: 22,
              color: currentBalance > 0 ? '#b45309' : 'var(--green)',
              marginTop: 2,
            }}
          >
            {currentBalance > 0
              ? `Saldo Pendiente: ${formatCOP(currentBalance)}`
              : 'Cliente al día con sus obligaciones ($0)'}
          </strong>
        </div>

        {onAddPaymentClick && (
          <button
            type="button"
            className="primary-button"
            onClick={onAddPaymentClick}
          >
            <AppIcon name="plus" size={15} color="#fff" />
            <span>Registrar Abono / Pago</span>
          </button>
        )}
      </div>

      {/* Payments Table */}
      {payments.length === 0 ? (
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
            <AppIcon name="wallet" size={24} />
          </div>
          <strong style={{ fontSize: 14 }}>No hay recibos de pago</strong>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
            No se han registrado abonos ni comprobantes de ingreso para este cliente.
          </p>
        </div>
      ) : (
        <div className="table-panel products-table-panel" style={{ margin: 0 }}>
          <div className="table-scroll">
            <table aria-label="Historial de pagos de cartera">
              <thead>
                <tr>
                  <th>N° Recibo</th>
                  <th>Fecha / Hora</th>
                  <th>Medio de Pago</th>
                  <th>Referencia / Comprobante</th>
                  <th>Factura Asociada</th>
                  <th>Registrado Por</th>
                  <th style={{ textAlign: 'right' }}>Valor Recibido</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong className="mono" style={{ color: 'var(--navy)' }}>
                        {p.receiptNumber}
                      </strong>
                    </td>
                    <td>
                      <span style={{ fontSize: 12 }}>{formatDate(p.date)}</span>
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: '#f1f5f9',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {p.paymentMethod}
                      </span>
                    </td>
                    <td>
                      <span className="mono" style={{ fontSize: 11 }}>
                        {p.reference}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: 'var(--navy)', fontWeight: 600 }}>
                        {p.invoiceNumber || 'Abono general'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {p.user}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <strong style={{ fontSize: 13, color: 'var(--green)' }}>
                        +{formatCOP(p.amount)}
                      </strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
