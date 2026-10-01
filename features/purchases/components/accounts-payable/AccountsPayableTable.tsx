'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { AccountPayableItem } from '../../services/accounts-payable.service'

interface AccountsPayableTableProps {
  items: AccountPayableItem[]
  isLoading: boolean
  isCostRedacted: boolean
  onRegisterPayment: (item: AccountPayableItem) => void
  onViewHistory: (item: AccountPayableItem) => void
}

export function AccountsPayableTable({
  items,
  isLoading,
  isCostRedacted,
  onRegisterPayment,
  onViewHistory,
}: AccountsPayableTableProps) {
  const formatCurrency = (val: number) => {
    if (isCostRedacted) return '••••••'
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val)
  }

  const getStatusBadge = (status: AccountPayableItem['status'], isOverdue: boolean) => {
    if (status === 'PAGADA') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 700,
            background: '#ecfdf5',
            color: '#059669',
            border: '1px solid #a7f3d0',
          }}
        >
          <AppIcon name="check" size={12} />
          PAGADA
        </span>
      )
    }

    if (status === 'VENCIDA' || isOverdue) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 700,
            background: '#fef2f2',
            color: '#dc2626',
            border: '1px solid #fecaca',
          }}
        >
          <AppIcon name="warning" size={12} />
          VENCIDA
        </span>
      )
    }

    if (status === 'PARCIAL') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 700,
            background: '#eff6ff',
            color: '#2563eb',
            border: '1px solid #bfdbfe',
          }}
        >
          <AppIcon name="clock" size={12} />
          PARCIAL
        </span>
      )
    }

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 8px',
          borderRadius: 12,
          fontSize: 11,
          fontWeight: 700,
          background: '#fffbeb',
          color: '#d97706',
          border: '1px solid #fde68a',
        }}
      >
        <AppIcon name="clock" size={12} />
        PENDIENTE
      </span>
    )
  }

  if (isLoading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
        <div className="skeleton-line" style={{ height: 24, width: '40%', margin: '0 auto 16px' }} />
        <div className="skeleton-line" style={{ height: 16, width: '60%', margin: '0 auto' }} />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div
        style={{
          padding: 64,
          textAlign: 'center',
          background: 'var(--card-bg, #ffffff)',
          borderRadius: 12,
          border: '1px dashed var(--border)',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--bg-subtle, #f8fafc)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: 'var(--text-muted)',
          }}
        >
          <AppIcon name="wallet" size={28} />
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: 'var(--navy)' }}>
          No hay cuentas por pagar registradas
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          No se encontraron obligaciones pendientes bajo los filtros seleccionados.
        </p>
      </div>
    )
  }

  return (
    <div className="table-responsive" style={{ background: 'var(--card-bg, #ffffff)', borderRadius: 12, border: '1px solid var(--border)' }}>
      <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--bg-subtle, #f8fafc)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
            <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--navy)' }}>Documento</th>
            <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--navy)' }}>Proveedor</th>
            <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--navy)' }}>Bodega</th>
            <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--navy)' }}>Vencimiento</th>
            <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--navy)', textAlign: 'right' }}>Total</th>
            <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--navy)', textAlign: 'right' }}>Abonado</th>
            <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--navy)', textAlign: 'right' }}>Saldo Pendiente</th>
            <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--navy)', textAlign: 'center' }}>Estado</th>
            <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--navy)', textAlign: 'right' }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="table-row-hover"
              style={{
                borderBottom: '1px solid var(--border)',
                transition: 'background 0.15s ease',
              }}
            >
              {/* Documento */}
              <td style={{ padding: '12px 16px' }}>
                <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{item.purchaseNumber}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Factura: <strong>{item.supplierInvoiceNumber || 'Sin número'}</strong>
                </div>
              </td>

              {/* Proveedor */}
              <td style={{ padding: '12px 16px' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{item.supplierName}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>NIT: {item.supplierNit}</div>
              </td>

              {/* Bodega */}
              <td style={{ padding: '12px 16px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <AppIcon name="warehouse" size={13} style={{ color: 'var(--text-muted)' }} />
                  <span>{item.locationName}</span>
                </div>
              </td>

              {/* Vencimiento */}
              <td style={{ padding: '12px 16px' }}>
                <div style={{ fontWeight: item.isOverdue ? 700 : 500, color: item.isOverdue ? '#dc2626' : 'var(--text-main)' }}>
                  {item.dueDate}
                </div>
                <div style={{ fontSize: 11, color: item.isOverdue ? '#dc2626' : 'var(--text-muted)' }}>
                  {item.status === 'PAGADA' ? (
                    'Liquidada'
                  ) : item.daysRemainingOrOverdue < 0 ? (
                    `Vencida hace ${Math.abs(item.daysRemainingOrOverdue)} d`
                  ) : item.daysRemainingOrOverdue === 0 ? (
                    'Vence hoy'
                  ) : (
                    `Vence en ${item.daysRemainingOrOverdue} d`
                  )}
                </div>
              </td>

              {/* Total Original */}
              <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>
                {formatCurrency(item.originalAmount)}
              </td>

              {/* Total Abonado */}
              <td style={{ padding: '12px 16px', textAlign: 'right', color: '#059669', fontWeight: 600 }}>
                {formatCurrency(item.paidAmount)}
              </td>

              {/* Saldo Pendiente */}
              <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    color: item.pendingBalance > 0 ? (item.isOverdue ? '#dc2626' : 'var(--navy)') : '#059669',
                  }}
                >
                  {formatCurrency(item.pendingBalance)}
                </div>
              </td>

              {/* Estado */}
              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                {getStatusBadge(item.status, item.isOverdue)}
              </td>

              {/* Acciones */}
              <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  {item.status !== 'PAGADA' && item.status !== 'ANULADA' && item.pendingBalance > 0 && (
                    <button
                      type="button"
                      className="primary-button-sm"
                      onClick={() => onRegisterPayment(item)}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        background: 'var(--navy, #1e3a8a)',
                        color: '#ffffff',
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <AppIcon name="wallet" size={13} />
                      <span>Abonar</span>
                    </button>
                  )}

                  {item.paymentsCount > 0 && (
                    <button
                      type="button"
                      className="outline-button-sm"
                      onClick={() => onViewHistory(item)}
                      title="Ver historial de abonos"
                      style={{
                        padding: '6px 10px',
                        fontSize: 12,
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        background: '#ffffff',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <AppIcon name="clock" size={13} />
                      <span>({item.paymentsCount})</span>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
