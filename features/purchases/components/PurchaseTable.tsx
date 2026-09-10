'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { Purchase, PurchaseStatus, PurchasePaymentType } from '../types'

type PurchaseSortField = 'date' | 'total' | 'purchaseNumber' | 'pendingBalance' | 'createdAt'

interface PurchaseTableProps {
  purchases: Purchase[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  isCostRedacted: boolean
  sortField?: PurchaseSortField
  sortDirection?: 'asc' | 'desc'
  onSort: (field: PurchaseSortField) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onSelectPurchase: (purchase: Purchase) => void
  onEditDraft?: (purchase: Purchase) => void
  onReceivePurchase?: (purchase: Purchase) => void
  onRegisterPayment?: (purchase: Purchase) => void
  onViewAttachment?: (purchase: Purchase) => void
  onCancelPurchase?: (purchase: Purchase) => void
}

export function getPurchaseStatusBadge(status: PurchaseStatus) {
  let label = 'Borrador'
  let icon: LightIconName = 'edit'
  let badgeClass = 'type-badge-blue'

  switch (status) {
    case 'DRAFT':
      label = 'Borrador'
      icon = 'edit'
      badgeClass = 'type-badge-blue'
      break
    case 'PENDING_RECEPTION':
      label = 'Por recibir'
      icon = 'clock'
      badgeClass = 'type-badge-amber'
      break
    case 'RECEIVED':
      label = 'Recibida'
      icon = 'check'
      badgeClass = 'type-badge-green'
      break
    case 'PAYMENT_PENDING':
      label = 'Pendiente pago'
      icon = 'wallet'
      badgeClass = 'type-badge-purple'
      break
    case 'PAID':
      label = 'Pagada'
      icon = 'check'
      badgeClass = 'type-badge-green'
      break
    case 'CANCELLED':
      label = 'Anulada'
      icon = 'close'
      badgeClass = 'type-badge-red'
      break
  }

  return (
    <span className={`kardex-type-badge ${badgeClass}`}>
      <AppIcon name={icon} size={13} />
      <span>{label}</span>
    </span>
  )
}

export function getPaymentTypeBadge(type: PurchasePaymentType) {
  if (type === 'CREDITO') {
    return (
      <span className="kardex-type-badge type-badge-purple" title="Compra a crédito">
        <AppIcon name="wallet" size={12} />
        <span>Crédito</span>
      </span>
    )
  }
  return (
    <span className="kardex-type-badge type-badge-teal" title="Compra de contado">
      <AppIcon name="receipt" size={12} />
      <span>Contado</span>
    </span>
  )
}

export function PurchaseTable({
  purchases,
  total,
  page,
  pageSize,
  totalPages,
  isCostRedacted,
  sortField,
  sortDirection,
  onSort,
  onPageChange,
  onPageSizeChange,
  onSelectPurchase,
  onEditDraft,
  onReceivePurchase,
  onRegisterPayment,
  onViewAttachment,
  onCancelPurchase,
}: PurchaseTableProps) {
  const getSortIcon = (field: PurchaseSortField) => {
    if (sortField !== field) {
      return <AppIcon name="sort" size={13} style={{ opacity: 0.35 }} />
    }
    return (
      <AppIcon
        name={sortDirection === 'asc' ? 'chevronUp' : 'chevronDown'}
        size={13}
        style={{ color: 'var(--navy)' }}
      />
    )
  }

  const formatCurrency = (val: number) => {
    if (isCostRedacted) return '••••••'
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val)
  }

  const formatDate = (isoString?: string) => {
    if (!isoString) return '—'
    const d = new Date(isoString)
    return d.toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="table-panel products-table-panel page-enter">
      <div className="table-scroll" tabIndex={0} aria-label="Tabla de órdenes de compra">
        <table>
          <thead>
            <tr>
              {/* 1. N° Compra */}
              <th
                onClick={() => onSort('purchaseNumber')}
                className="sortable-th sticky-left-col"
                style={{ minWidth: 140 }}
              >
                <div className="th-content">
                  <span>N° Compra</span>
                  {getSortIcon('purchaseNumber')}
                </div>
              </th>

              {/* 2. Factura Proveedor */}
              <th style={{ minWidth: 140 }}>
                <div className="th-content">
                  <span>Factura Prov.</span>
                </div>
              </th>

              {/* 3. Fecha */}
              <th
                onClick={() => onSort('date')}
                className="sortable-th"
                style={{ minWidth: 130 }}
              >
                <div className="th-content">
                  <span>Fecha</span>
                  {getSortIcon('date')}
                </div>
              </th>

              {/* 4. Proveedor */}
              <th style={{ minWidth: 200 }}>
                <div className="th-content">
                  <span>Proveedor</span>
                </div>
              </th>

              {/* 5. Bodega Destino */}
              <th style={{ minWidth: 160 }}>
                <div className="th-content">
                  <span>Bodega Destino</span>
                </div>
              </th>

              {/* 6. Tipo Pago */}
              <th style={{ minWidth: 120 }}>
                <div className="th-content">
                  <span>Tipo Pago</span>
                </div>
              </th>

              {/* 7. Total */}
              <th
                onClick={() => onSort('total')}
                className="sortable-th"
                style={{ textAlign: 'right', minWidth: 130 }}
              >
                <div className="th-content right">
                  <span>Total</span>
                  {getSortIcon('total')}
                </div>
              </th>

              {/* 8. Saldo Pendiente */}
              <th
                onClick={() => onSort('pendingBalance')}
                className="sortable-th"
                style={{ textAlign: 'right', minWidth: 140 }}
              >
                <div className="th-content right">
                  <span>Saldo Pendiente</span>
                  {getSortIcon('pendingBalance')}
                </div>
              </th>

              {/* 9. Estado */}
              <th style={{ minWidth: 130 }}>
                <div className="th-content">
                  <span>Estado</span>
                </div>
              </th>

              {/* 10. Responsable */}
              <th style={{ minWidth: 130 }}>
                <div className="th-content">
                  <span>Responsable</span>
                </div>
              </th>

              {/* 11. Acciones */}
              <th
                style={{ width: 140, textAlign: 'center' }}
                className="sticky-right-col"
              >
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => {
              const hasAttachment = p.attachments && p.attachments.length > 0
              const canReceive = p.status === 'PENDING_RECEPTION' || p.status === 'DRAFT'
              const canPay = p.pendingBalance > 0 && p.status !== 'CANCELLED'
              const canEdit = p.status === 'DRAFT'
              const canCancel =
                p.status !== 'RECEIVED' && p.status !== 'CANCELLED' && p.status !== 'PAID'

              return (
                <tr
                  key={p.id}
                  className="table-row-clickable"
                  onClick={() => onSelectPurchase(p)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSelectPurchase(p)
                  }}
                >
                  {/* 1. N° Compra */}
                  <td className="product-code-col sticky-left-col">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="sku-badge" style={{ fontWeight: 700 }}>
                        {p.purchaseNumber}
                      </span>
                      {hasAttachment && (
                        <span
                          title="Factura adjunta disponible"
                          style={{ color: 'var(--navy)', opacity: 0.85 }}
                        >
                          <AppIcon name="invoices" size={13} />
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 2. Factura Proveedor */}
                  <td>
                    <span className="secondary-meta" style={{ fontWeight: 600 }}>
                      {p.supplierInvoiceNumber || '—'}
                    </span>
                  </td>

                  {/* 3. Fecha */}
                  <td>
                    <span className="product-date-cell">{formatDate(p.date)}</span>
                  </td>

                  {/* 4. Proveedor */}
                  <td className="product-primary-col">
                    <div className="product-info-cell">
                      <strong className="product-name-text" style={{ fontSize: 13 }}>
                        {p.supplierName}
                      </strong>
                      {p.supplierNit && (
                        <span className="sku-meta-text">NIT: {p.supplierNit}</span>
                      )}
                    </div>
                  </td>

                  {/* 5. Bodega Destino */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AppIcon name="warehouse" size={13} color="#64748b" />
                      <span style={{ fontSize: 12, fontWeight: 500 }}>
                        {p.destinationLocationName}
                      </span>
                    </div>
                  </td>

                  {/* 6. Tipo Pago */}
                  <td>{getPaymentTypeBadge(p.paymentType)}</td>

                  {/* 7. Total */}
                  <td style={{ textAlign: 'right' }}>
                    <strong style={{ color: 'var(--foreground)', fontSize: 13 }}>
                      {formatCurrency(p.total)}
                    </strong>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                      {p.items?.length || 0} {p.items?.length === 1 ? 'item' : 'items'}
                    </div>
                  </td>

                  {/* 8. Saldo Pendiente */}
                  <td style={{ textAlign: 'right' }}>
                    {p.pendingBalance > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ color: '#b45309', fontWeight: 700, fontSize: 13 }}>
                          {formatCurrency(p.pendingBalance)}
                        </span>
                        {p.dueDate && (
                          <span style={{ fontSize: 10, color: '#dc2626' }}>
                            Vence: {formatDate(p.dueDate)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#16a34a', fontSize: 12, fontWeight: 600 }}>
                        Al día ($0)
                      </span>
                    )}
                  </td>

                  {/* 9. Estado */}
                  <td>{getPurchaseStatusBadge(p.status)}</td>

                  {/* 10. Responsable */}
                  <td>
                    <span className="secondary-meta" style={{ fontSize: 12 }}>
                      {p.createdByUserName || 'Sistema'}
                    </span>
                  </td>

                  {/* 11. Acciones */}
                  <td
                    className="sticky-right-col"
                    style={{ textAlign: 'center' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      className="action-buttons-group"
                      style={{ justifyContent: 'center', gap: 4 }}
                    >
                      {/* Editar Borrador */}
                      {canEdit && onEditDraft && (
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => onEditDraft(p)}
                          title="Editar borrador de compra"
                          aria-label="Editar borrador"
                        >
                          <AppIcon name="edit" size={15} />
                        </button>
                      )}

                      {/* Recibir Compra */}
                      {canReceive && onReceivePurchase && (
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => onReceivePurchase(p)}
                          title="Registrar recepción física en bodega"
                          aria-label="Recibir compra"
                          style={{ color: '#16a34a' }}
                        >
                          <AppIcon name="warehouse" size={15} />
                        </button>
                      )}

                      {/* Registrar Pago */}
                      {canPay && onRegisterPayment && (
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => onRegisterPayment(p)}
                          title="Registrar abono o pago a factura pendiente"
                          aria-label="Registrar pago"
                          style={{ color: '#7c3aed' }}
                        >
                          <AppIcon name="wallet" size={15} />
                        </button>
                      )}

                      {/* Ver Documento Adjunto */}
                      {hasAttachment && onViewAttachment && (
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => onViewAttachment(p)}
                          title="Ver soporte o factura adjunta"
                          aria-label="Ver soporte adjunto"
                          style={{ color: 'var(--navy)' }}
                        >
                          <AppIcon name="invoices" size={15} />
                        </button>
                      )}

                      {/* Anular Compra */}
                      {canCancel && onCancelPurchase && (
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => onCancelPurchase(p)}
                          title="Anular orden de compra"
                          aria-label="Anular compra"
                          style={{ color: '#dc2626' }}
                        >
                          <AppIcon name="close" size={15} />
                        </button>
                      )}

                      {/* Inspeccionar */}
                      <button
                        type="button"
                        className="icon-button inspect-row-btn"
                        onClick={() => onSelectPurchase(p)}
                        title="Ver detalle completo de compra"
                        aria-label={`Ver detalle de compra ${p.purchaseNumber}`}
                      >
                        <AppIcon name="chevronRight" size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="table-pagination-footer">
        <div className="pagination-info">
          <span>
            Mostrando <strong>{purchases.length}</strong> de <strong>{total}</strong> compras registradas
          </span>
          <div className="page-size-selector">
            <span>Por página:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Registros por página"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        <div className="pagination-controls">
          <button
            type="button"
            className="outline-button compact"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Página anterior"
          >
            <AppIcon name="chevronLeft" size={14} />
            <span>Anterior</span>
          </button>

          <div className="page-numbers-cluster">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1]
                const hasGap = prev && p - prev > 1
                return (
                  <React.Fragment key={p}>
                    {hasGap && <span className="pagination-ellipsis">...</span>}
                    <button
                      type="button"
                      className={`page-num-btn ${page === p ? 'active' : ''}`}
                      onClick={() => onPageChange(p)}
                      aria-label={`Ir a página ${p}`}
                    >
                      {p}
                    </button>
                  </React.Fragment>
                )
              })}
          </div>

          <button
            type="button"
            className="outline-button compact"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Página siguiente"
          >
            <span>Siguiente</span>
            <AppIcon name="chevronRight" size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
