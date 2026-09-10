'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomerInvoiceSummary } from '../../../types'

interface CustomerInvoicesTabProps {
  invoices: CustomerInvoiceSummary[]
  onAddPaymentClick?: (invoice: CustomerInvoiceSummary) => void
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

export function CustomerInvoicesTab({ invoices, onAddPaymentClick }: CustomerInvoicesTabProps) {
  if (invoices.length === 0) {
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
          <AppIcon name="invoices" size={24} />
        </div>
        <strong style={{ fontSize: 14 }}>No hay facturas emitidas</strong>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
          Este cliente no posee facturas electrónicas de venta registradas.
        </p>
      </div>
    )
  }

  return (
    <div className="page-enter">
      <div className="table-panel products-table-panel" style={{ margin: 0 }}>
        <div className="table-scroll">
          <table aria-label="Facturas de venta del cliente">
            <thead>
              <tr>
                <th>N° Factura</th>
                <th>Fecha Emisión</th>
                <th>Vencimiento</th>
                <th>Estado DIAN</th>
                <th style={{ textAlign: 'right' }}>Total Factura</th>
                <th style={{ textAlign: 'right' }}>Saldo Pendiente</th>
                <th style={{ textAlign: 'center' }}>Estado Pago</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <strong className="mono" style={{ color: 'var(--navy)' }}>
                        {inv.invoiceNumber}
                      </strong>
                      {inv.dianCufe && (
                        <small style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'monospace' }}>
                          CUFE: {inv.dianCufe.substring(0, 16)}...
                        </small>
                      )}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: 12 }}>{formatDate(inv.date)}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: 12, color: inv.pendingBalance > 0 ? '#b45309' : 'inherit' }}>
                      {formatDate(inv.dueDate)}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        color: inv.dianStatus === 'VALIDADA_DIAN' ? 'var(--green)' : '#d97706',
                      }}
                    >
                      <AppIcon
                        name={inv.dianStatus === 'VALIDADA_DIAN' ? 'check' : 'warning'}
                        size={12}
                      />
                      <span>{inv.dianStatus === 'VALIDADA_DIAN' ? 'Validada DIAN' : 'Pendiente DIAN'}</span>
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <strong style={{ fontSize: 13 }}>{formatCOP(inv.total)}</strong>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {inv.pendingBalance > 0 ? (
                      <strong style={{ color: '#dc2626', fontSize: 13 }}>
                        {formatCOP(inv.pendingBalance)}
                      </strong>
                    ) : (
                      <span style={{ color: 'var(--green)', fontWeight: 600, fontSize: 12 }}>
                        Pagada ($0)
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span
                      className={`state ${
                        inv.status === 'PAID'
                          ? 'disponible'
                          : inv.status === 'PARTIALLY_PAID'
                          ? 'pendiente'
                          : 'crítico'
                      }`}
                    >
                      <span>
                        {inv.status === 'PAID'
                          ? 'Pagada'
                          : inv.status === 'PARTIALLY_PAID'
                          ? 'Parcial'
                          : 'Pendiente'}
                      </span>
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {inv.pendingBalance > 0 && onAddPaymentClick ? (
                      <button
                        type="button"
                        className="outline-button compact"
                        onClick={() => onAddPaymentClick(inv)}
                        title="Registrar abono a esta factura"
                        style={{ fontSize: 11, padding: '0 8px', height: 28 }}
                      >
                        Abonar
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>—</span>
                    )}
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
