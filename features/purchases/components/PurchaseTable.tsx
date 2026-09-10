'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { Purchase, PurchaseStatus, PurchasePaymentType } from '../types'

interface PurchaseTableProps {
  purchases: Purchase[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  isCostRedacted: boolean
  sortField?: 'date' | 'total' | 'purchaseNumber' | 'pendingBalance' | 'createdAt'
  sortDirection?: 'asc' | 'desc'
  onSort: (field: 'date' | 'total' | 'purchaseNumber' | 'pendingBalance' | 'createdAt') => void
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

  const renderSortIndicator = (field: 'date' | 'total' | 'purchaseNumber' | 'pendingBalance' | 'createdAt') => {
    if (sortField !== field) return null
    return (
      <span className="sort-icon-indicator" style={{ marginLeft: 4 }}>
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    )
  }

  return (
    <div className="table-responsive page-enter">
      <table className="products-table" aria-label="Tabla de órdenes de compra">
        <thead>
          <tr>
            <th
              scope="col"
              className="sortable-th"
              onClick={() => onSort('purchaseNumber')}
              title="Ordenar por número de compra"
            >
              <span>N° Compra</span>
              {renderSortIndicator('purchaseNumber')}
            </th>
            <th scope="col">Factura Proveedor</th>
            <th
              scope="col"
              className="sortable-th"
              onClick={() => onSort('date')}
              title="Ordenar por fecha de compra"
            >
              <span>Fecha</span>
              {renderSortIndicator('date')}
            </th>
            <th scope="col">Proveedor</th>
            <th scope="col">Bodega Destino</th>
            <th scope="col">Tipo Pago</th>
            <th
              scope="col"
              className="sortable-th numeric"
              onClick={() => onSort('total')}
              title="Ordenar por total"
            >
              <span>Total</span>
              {renderSortIndicator('total')}
            </th>
            <th
              scope="col"
              className="sortable-th numeric"
              onClick={() => onSort('pendingBalance')}
              title="Ordenar por saldo pendiente"
            >
              <span>Saldo Pendiente</span>
              {renderSortIndicator('pendingBalance')}
            </th>
            <th scope="col">Estado</th>
            <th scope="col">Usuario</th>
            <th scope="col" style={{ textAlign: 'right', paddingRight: 16 }}>
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
            const canCancel = p.status !== 'RECEIVED' && p.status !== 'CANCELLED' && p.status !== 'PAID'

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
                <td className="product-code-col">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="sku-badge" style={{ fontWeight: 700 }}>
                      {p.purchaseNumber}
                    </span>
                    {hasAttachment && (
                      <span
                        title="Factura adjunta disponible"
                        style={{ color: 'var(--navy)', opacity: 0.8 }}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AppIcon name="warehouse" size={13} />
                    <span style={{ fontSize: 12, fontWeight: 500 }}>
                      {p.destinationLocationName}
                    </span>
                  </div>
                </td>

                {/* 6. Tipo Pago */}
                <td>{getPaymentTypeBadge(p.paymentType)}</td>

                {/* 7. Total */}
                <td className="numeric font-tabular">
                  <strong style={{ color: 'var(--text-main)', fontSize: 13 }}>
                    {formatCurrency(p.total)}
                  </strong>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                    {p.items?.length || 0} {p.items?.length === 1 ? 'item' : 'items'}
                  </div>
                </td>

                {/* 8. Saldo Pendiente */}
                <td className="numeric font-tabular">
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

                {/* 10. Usuario */}
                <td>
                  <span className="secondary-meta" style={{ fontSize: 12 }}>
                    {p.createdByUserName || 'Sistema'}
                  </span>
                </td>

                {/* 11. Acciones */}
                <td
                  style={{ textAlign: 'right', paddingRight: 16 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="table-actions-cluster" style={{ justifyContent: 'flex-end', gap: 4 }}>
                    {/* Ver Detalle */}
                    <button
                      type="button"
                      className="icon-button-sm"
                      onClick={() => onSelectPurchase(p)}
                      title="Ver detalle completo de la compra"
                      aria-label="Ver detalle"
                    >
                      <AppIcon name="eye" size={15} />
                    </button>

                    {/* Editar Borrador */}
                    {canEdit && onEditDraft && (
                      <button
                        type="button"
                        className="icon-button-sm"
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
                        className="icon-button-sm"
                        onClick={() => onReceivePurchase(p)}
                        title="Registrar recepción física en bodega e ingresar a Kardex"
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
                        className="icon-button-sm"
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
                        className="icon-button-sm"
                        onClick={() => onViewAttachment(p)}
                        title="Previsualizar factura adjunta"
                        aria-label="Ver documento"
                      >
                        <AppIcon name="download" size={15} />
                      </button>
                    )}

                    {/* Anular */}
                    {canCancel && onCancelPurchase && (
                      <button
                        type="button"
                        className="icon-button-sm"
                        onClick={() => onCancelPurchase(p)}
                        title="Anular compra"
                        aria-label="Anular compra"
                        style={{ color: '#dc2626' }}
                      >
                        <AppIcon name="close" size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Paginador */}
      <div className="table-pagination-bar">
        <div className="pagination-info">
          <span>
            Mostrando {purchases.length} de {total} compras registradas
          </span>
          <div className="page-size-selector">
            <label htmlFor="purchase-page-size">Por página:</label>
            <select
              id="purchase-page-size"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="page-size-select"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        <div className="pagination-controls">
          <button
            type="button"
            className="outline-button pagination-btn"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Página anterior"
          >
            ← Anterior
          </button>
          <span className="pagination-current-page">
            Página <strong>{page}</strong> de <strong>{Math.max(totalPages, 1)}</strong>
          </span>
          <button
            type="button"
            className="outline-button pagination-btn"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Página siguiente"
          >
            Siguiente →
          </button>
        </div>
      </div>
    </div>
  )
}
