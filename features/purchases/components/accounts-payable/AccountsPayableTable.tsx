'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { AccountPayableItem } from '../../services/accounts-payable.service'

interface AccountsPayableTableProps {
  items: AccountPayableItem[]
  isLoading: boolean
  isCostRedacted: boolean
  page?: number
  pageSize?: number
  totalPages?: number
  totalCount?: number
  sortField?: string
  sortDirection?: 'asc' | 'desc'
  onSort?: (field: string) => void
  onPageChange?: (page: number) => void
  onPageSizeChange?: (size: number) => void
  onRegisterPayment: (item: AccountPayableItem) => void
  onViewHistory: (item: AccountPayableItem) => void
}

export function AccountsPayableTable({
  items,
  isLoading,
  isCostRedacted,
  page = 1,
  pageSize = 15,
  totalPages = 1,
  totalCount = 0,
  sortField = 'dueDate',
  sortDirection = 'asc',
  onSort,
  onPageChange,
  onPageSizeChange,
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
        <span className="kardex-type-badge type-badge-green">
          <AppIcon name="check" size={12} />
          <span>Pagada</span>
        </span>
      )
    }

    if (status === 'VENCIDA' || isOverdue) {
      return (
        <span className="kardex-type-badge type-badge-red">
          <AppIcon name="warning" size={12} />
          <span>Vencida</span>
        </span>
      )
    }

    if (status === 'PARCIAL') {
      return (
        <span className="kardex-type-badge type-badge-blue">
          <AppIcon name="clock" size={12} />
          <span>Abonada</span>
        </span>
      )
    }

    return (
      <span className="kardex-type-badge type-badge-amber">
        <AppIcon name="clock" size={12} />
        <span>Pendiente</span>
      </span>
    )
  }

  if (isLoading) {
    return (
      <div className="table-panel products-table-panel" style={{ padding: 60, textAlign: 'center' }}>
        <div className="skeleton-line" style={{ height: 28, width: '40%', margin: '0 auto 16px', borderRadius: 8 }} />
        <div className="skeleton-line" style={{ height: 18, width: '60%', margin: '0 auto 12px', borderRadius: 8 }} />
        <div className="skeleton-line" style={{ height: 18, width: '50%', margin: '0 auto', borderRadius: 8 }} />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div
        className="table-panel products-table-panel"
        style={{
          padding: 64,
          textAlign: 'center',
          background: '#ffffff',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: 'var(--bg-subtle, #f8fafc)',
            display: 'grid',
            placeItems: 'center',
            margin: '0 auto 16px',
            color: 'var(--navy)',
            border: '1px solid var(--border)',
          }}
        >
          <AppIcon name="wallet" size={28} />
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: 'var(--navy)' }}>
          No hay cuentas por pagar registradas
        </h3>
        <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 460, margin: '0 auto' }}>
          No se encontraron obligaciones pendientes bajo los filtros o criterios de búsqueda seleccionados.
        </p>
      </div>
    )
  }

  return (
    <div className="table-panel products-table-panel page-enter">
      <div className="table-scroll" tabIndex={0} aria-label="Tabla de Cuentas por Pagar">
        <table className="products-table">
          <thead>
            <tr>
              <th
                className={onSort ? 'sortable-th' : ''}
                onClick={() => onSort && onSort('purchaseNumber')}
                style={{ minWidth: 160 }}
              >
                <div className="th-content">
                  <span>Documento</span>
                  {onSort && sortField === 'purchaseNumber' && (
                    <AppIcon
                      name={sortDirection === 'asc' ? 'chevronUp' : 'chevronDown'}
                      size={12}
                    />
                  )}
                </div>
              </th>

              <th
                className={onSort ? 'sortable-th' : ''}
                onClick={() => onSort && onSort('supplierName')}
                style={{ minWidth: 200 }}
              >
                <div className="th-content">
                  <span>Proveedor</span>
                  {onSort && sortField === 'supplierName' && (
                    <AppIcon
                      name={sortDirection === 'asc' ? 'chevronUp' : 'chevronDown'}
                      size={12}
                    />
                  )}
                </div>
              </th>

              <th style={{ minWidth: 150 }}>Bodega</th>

              <th
                className={onSort ? 'sortable-th' : ''}
                onClick={() => onSort && onSort('dueDate')}
                style={{ minWidth: 150 }}
              >
                <div className="th-content">
                  <span>Vencimiento</span>
                  {onSort && sortField === 'dueDate' && (
                    <AppIcon
                      name={sortDirection === 'asc' ? 'chevronUp' : 'chevronDown'}
                      size={12}
                    />
                  )}
                </div>
              </th>

              <th
                className={onSort ? 'sortable-th right' : ''}
                onClick={() => onSort && onSort('originalAmount')}
                style={{ minWidth: 130, textAlign: 'right' }}
              >
                <div className="th-content right">
                  <span>Total Factura</span>
                  {onSort && sortField === 'originalAmount' && (
                    <AppIcon
                      name={sortDirection === 'asc' ? 'chevronUp' : 'chevronDown'}
                      size={12}
                    />
                  )}
                </div>
              </th>

              <th style={{ minWidth: 120, textAlign: 'right' }}>Abonado</th>

              <th
                className={onSort ? 'sortable-th right' : ''}
                onClick={() => onSort && onSort('pendingBalance')}
                style={{ minWidth: 140, textAlign: 'right' }}
              >
                <div className="th-content right">
                  <span>Saldo Pendiente</span>
                  {onSort && sortField === 'pendingBalance' && (
                    <AppIcon
                      name={sortDirection === 'asc' ? 'chevronUp' : 'chevronDown'}
                      size={12}
                    />
                  )}
                </div>
              </th>

              <th style={{ minWidth: 120, textAlign: 'center' }}>Estado</th>

              <th style={{ width: 140, textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="table-row-hover">
                {/* Documento */}
                <td className="product-code-col">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="sku-badge" style={{ fontWeight: 700 }}>
                      {item.purchaseNumber}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      Factura:{' '}
                      <strong style={{ color: 'var(--navy)' }}>
                        {item.supplierInvoiceNumber || 'Sin número'}
                      </strong>
                    </span>
                  </div>
                </td>

                {/* Proveedor */}
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <strong style={{ color: 'var(--foreground)', fontSize: 13 }}>
                      {item.supplierName}
                    </strong>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      NIT: {item.supplierNit || 'Sin NIT'}
                    </span>
                  </div>
                </td>

                {/* Bodega */}
                <td>
                  <span className="kardex-type-badge type-badge-purple" style={{ fontSize: 11 }}>
                    <AppIcon name="warehouse" size={12} />
                    <span>{item.locationName}</span>
                  </span>
                </td>

                {/* Vencimiento */}
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: item.isOverdue ? 700 : 500,
                        color: item.isOverdue ? '#dc2626' : 'var(--foreground)',
                      }}
                    >
                      {item.dueDate}
                    </span>
                    <div>
                      {item.status === 'PAGADA' ? (
                        <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 600 }}>
                          Liquidada
                        </span>
                      ) : item.daysRemainingOrOverdue < 0 ? (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: '#dc2626',
                            background: '#fef2f2',
                            padding: '1px 5px',
                            borderRadius: 4,
                          }}
                        >
                          Vencida hace {Math.abs(item.daysRemainingOrOverdue)} d
                        </span>
                      ) : item.daysRemainingOrOverdue === 0 ? (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: '#d97706',
                            background: '#fffbeb',
                            padding: '1px 5px',
                            borderRadius: 4,
                          }}
                        >
                          Vence hoy
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                          Vence en {item.daysRemainingOrOverdue} d
                        </span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Total Factura */}
                <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 13 }}>
                  {formatCurrency(item.originalAmount)}
                </td>

                {/* Total Abonado */}
                <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 600, fontSize: 13 }}>
                  {formatCurrency(item.paidAmount)}
                </td>

                {/* Saldo Pendiente */}
                <td style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      fontWeight: 800,
                      fontSize: 14,
                      color:
                        item.pendingBalance > 0
                          ? item.isOverdue
                            ? '#dc2626'
                            : 'var(--navy)'
                          : '#16a34a',
                    }}
                  >
                    {formatCurrency(item.pendingBalance)}
                  </span>
                </td>

                {/* Estado */}
                <td style={{ textAlign: 'center' }}>
                  {getStatusBadge(item.status, item.isOverdue)}
                </td>

                {/* Acciones */}
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
                    {item.status !== 'PAGADA' &&
                      item.status !== 'ANULADA' &&
                      item.pendingBalance > 0 && (
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => onRegisterPayment(item)}
                          style={{
                            padding: '5px 10px',
                            fontSize: 11,
                            gap: 4,
                          }}
                          title="Registrar abono o liquidar saldo"
                        >
                          <AppIcon name="wallet" size={13} />
                          <span>Abonar</span>
                        </button>
                      )}

                    {item.paymentsCount > 0 && (
                      <button
                        type="button"
                        className="outline-button"
                        onClick={() => onViewHistory(item)}
                        style={{
                          padding: '5px 8px',
                          fontSize: 11,
                          gap: 4,
                        }}
                        title={`Ver ${item.paymentsCount} pagos realizados`}
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

      {/* Pagination Footer */}
      {onPageChange && (
        <div className="table-pagination-footer">
          <div className="pagination-info">
            <span>
              Mostrando{' '}
              <strong>
                {totalCount === 0 ? 0 : (page - 1) * pageSize + 1}
              </strong>{' '}
              -{' '}
              <strong>
                {Math.min(page * pageSize, totalCount)}
              </strong>{' '}
              de <strong>{totalCount}</strong> obligaciones
            </span>

            {onPageSizeChange && (
              <div className="page-size-selector">
                <span>Filas por página:</span>
                <select
                  value={pageSize}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  aria-label="Filas por página"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            )}
          </div>

          <div className="pagination-controls">
            <button
              type="button"
              className="pagination-btn"
              onClick={() => onPageChange(1)}
              disabled={page <= 1}
              title="Primera página"
            >
              «
            </button>
            <button
              type="button"
              className="pagination-btn"
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page <= 1}
              title="Página anterior"
            >
              ‹ Anterior
            </button>

            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--navy)',
                padding: '0 8px',
              }}
            >
              Página {page} de {totalPages}
            </span>

            <button
              type="button"
              className="pagination-btn"
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              title="Página siguiente"
            >
              Siguiente ›
            </button>
            <button
              type="button"
              className="pagination-btn"
              onClick={() => onPageChange(totalPages)}
              disabled={page >= totalPages}
              title="Última página"
            >
              »
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
