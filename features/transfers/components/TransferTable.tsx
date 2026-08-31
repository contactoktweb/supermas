'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { Transfer, TransferSortField, TransferStatus } from '../types'

interface TransferTableProps {
  transfers: Transfer[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  isCostRedacted: boolean
  sortField?: TransferSortField
  sortDirection?: 'asc' | 'desc'
  onSort: (field: TransferSortField) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onSelectTransfer: (transfer: Transfer) => void
  onDispatchTransfer?: (transfer: Transfer) => void
  onReceiveTransfer?: (transfer: Transfer) => void
}

export function getTransferStatusBadge(status: TransferStatus, hasIncident?: boolean) {
  let label = 'Pendiente'
  let icon: LightIconName = 'clock'
  let badgeClass = 'type-badge-amber'

  switch (status) {
    case 'PENDING':
      label = 'Pendiente'
      icon = 'clock'
      badgeClass = 'type-badge-amber'
      break
    case 'IN_TRANSIT':
      label = 'En tránsito'
      icon = 'transfers'
      badgeClass = 'type-badge-blue'
      break
    case 'RECEIVED':
      label = 'Recibida'
      icon = 'check'
      badgeClass = 'type-badge-green'
      break
    case 'REJECTED':
      label = 'Rechazada'
      icon = 'close'
      badgeClass = 'type-badge-red'
      break
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className={`kardex-type-badge ${badgeClass}`}>
        <AppIcon name={icon} size={13} />
        <span>{label}</span>
      </span>
      {hasIncident && (
        <span
          style={{
            fontSize: 9,
            color: '#d97706',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          <AppIcon name="warning" size={10} /> Con Novedad
        </span>
      )}
    </div>
  )
}

export function TransferTable({
  transfers,
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
  onSelectTransfer,
  onDispatchTransfer,
  onReceiveTransfer,
}: TransferTableProps) {
  const getSortIcon = (field: TransferSortField) => {
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

  const formatDateTime = (isoString: string) => {
    const d = new Date(isoString)
    return d.toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }

  return (
    <div className="table-panel products-table-panel page-enter">
      <div className="table-scroll" tabIndex={0} aria-label="Tabla de transferencias entre bodegas">
        <table>
          <thead>
            <tr>
              {/* 1. Código */}
              <th
                onClick={() => onSort('code')}
                className="sortable-th sticky-left-col"
                style={{ minWidth: 130 }}
              >
                <div className="th-content">
                  <span>Código</span>
                  {getSortIcon('code')}
                </div>
              </th>

              {/* 2. Fecha */}
              <th
                onClick={() => onSort('createdAt')}
                className="sortable-th"
                style={{ minWidth: 145 }}
              >
                <div className="th-content">
                  <span>Fecha</span>
                  {getSortIcon('createdAt')}
                </div>
              </th>

              {/* 3. Origen */}
              <th
                onClick={() => onSort('origin')}
                className="sortable-th"
                style={{ minWidth: 160 }}
              >
                <div className="th-content">
                  <span>Bodega Origen</span>
                  {getSortIcon('origin')}
                </div>
              </th>

              {/* 4. Destino */}
              <th
                onClick={() => onSort('destination')}
                className="sortable-th"
                style={{ minWidth: 160 }}
              >
                <div className="th-content">
                  <span>Bodega Destino</span>
                  {getSortIcon('destination')}
                </div>
              </th>

              {/* 5. Productos */}
              <th style={{ minWidth: 200 }}>
                <div className="th-content">
                  <span>Productos</span>
                </div>
              </th>

              {/* 6. Unidades */}
              <th
                onClick={() => onSort('units')}
                className="sortable-th"
                style={{ textAlign: 'right', minWidth: 110 }}
              >
                <div className="th-content right">
                  <span>Unidades</span>
                  {getSortIcon('units')}
                </div>
              </th>

              {/* 7. Responsable */}
              <th style={{ minWidth: 150 }}>
                <div className="th-content">
                  <span>Responsable</span>
                </div>
              </th>

              {/* 8. Estado */}
              <th
                onClick={() => onSort('status')}
                className="sortable-th"
                style={{ minWidth: 130 }}
              >
                <div className="th-content">
                  <span>Estado</span>
                  {getSortIcon('status')}
                </div>
              </th>

              {/* 9. Última Actualización */}
              <th
                onClick={() => onSort('updatedAt')}
                className="sortable-th"
                style={{ minWidth: 145 }}
              >
                <div className="th-content">
                  <span>Actualización</span>
                  {getSortIcon('updatedAt')}
                </div>
              </th>

              {/* 10. Acciones */}
              <th style={{ textAlign: 'center', minWidth: 120 }}>
                <span>Acciones</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {transfers.map((t) => {
              const primaryItem = t.items[0]
              const otherCount = t.items.length - 1
              const unitsLabel = `${t.status === 'RECEIVED' ? t.totalUnitsReceived : t.totalUnitsDispatched || t.totalUnitsRequested} uds`

              return (
                <tr
                  key={t.id}
                  onClick={() => onSelectTransfer(t)}
                  className="clickable-row"
                >
                  {/* 1. Código */}
                  <td className="sticky-left-col">
                    <span className="source-doc-badge">
                      <AppIcon name="transfers" size={13} />
                      <strong>{t.code}</strong>
                    </span>
                  </td>

                  {/* 2. Fecha */}
                  <td>
                    <div className="kardex-time-cell">
                      <AppIcon name="clock" size={13} color="#94a3b8" />
                      <strong className="kardex-time-text">{formatDateTime(t.createdAt)}</strong>
                    </div>
                  </td>

                  {/* 3. Origen */}
                  <td>
                    <div className="location-cell-block">
                      <strong className="location-name-text">{t.originLocationName}</strong>
                      <small className="location-code-tag">{t.originLocationCode}</small>
                    </div>
                  </td>

                  {/* 4. Destino */}
                  <td>
                    <div className="location-cell-block">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <AppIcon name="arrowRight" size={12} color="#001b5c" />
                        <strong className="location-name-text" style={{ color: 'var(--navy)' }}>
                          {t.destinationLocationName}
                        </strong>
                      </div>
                      <small className="location-code-tag" style={{ marginLeft: 16 }}>
                        {t.destinationLocationCode}
                      </small>
                    </div>
                  </td>

                  {/* 5. Productos */}
                  <td>
                    <div className="product-name-block">
                      <strong>{primaryItem?.productName || 'Sin productos'}</strong>
                      {otherCount > 0 && (
                        <span className="category-pill-tag" style={{ width: 'fit-content' }}>
                          +{otherCount} artículo{otherCount > 1 ? 's' : ''} más
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 6. Unidades */}
                  <td style={{ textAlign: 'right' }}>
                    <strong className="stock-result-text" style={{ color: 'var(--navy)' }}>
                      {unitsLabel}
                    </strong>
                  </td>

                  {/* 7. Responsable */}
                  <td>
                    <div className="user-author-block">
                      <strong>{t.dispatchedByUserName || t.createdByUserName}</strong>
                      <small>{t.dispatchedByUserName ? 'Despachador' : t.createdByUserRole}</small>
                    </div>
                  </td>

                  {/* 8. Estado */}
                  <td>{getTransferStatusBadge(t.status, t.hasIncident)}</td>

                  {/* 9. Última Actualización */}
                  <td>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {formatDateTime(t.updatedAt)}
                    </span>
                  </td>

                  {/* 10. Acciones */}
                  <td style={{ textAlign: 'center' }}>
                    <div
                      style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Contextual Action: Despachar if Pending */}
                      {t.status === 'PENDING' && onDispatchTransfer && (
                        <button
                          type="button"
                          className="outline-button compact"
                          onClick={() => onDispatchTransfer(t)}
                          title="Despachar transferencia"
                          style={{ borderColor: 'var(--navy)', color: 'var(--navy)', fontSize: 11, padding: '4px 8px' }}
                        >
                          <AppIcon name="transfers" size={12} />
                          <span>Despachar</span>
                        </button>
                      )}

                      {/* Contextual Action: Recibir if In Transit */}
                      {t.status === 'IN_TRANSIT' && onReceiveTransfer && (
                        <button
                          type="button"
                          className="primary-button compact"
                          onClick={() => onReceiveTransfer(t)}
                          title="Confirmar recepción de mercancía"
                          style={{ fontSize: 11, padding: '4px 8px' }}
                        >
                          <AppIcon name="check" size={12} />
                          <span>Recibir</span>
                        </button>
                      )}

                      {/* Inspect button */}
                      <button
                        type="button"
                        className="icon-button inspect-row-btn"
                        onClick={() => onSelectTransfer(t)}
                        title="Ver detalle completo de transferencia"
                        aria-label={`Ver detalle de transferencia ${t.code}`}
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
            Mostrando <strong>{transfers.length}</strong> de <strong>{total}</strong> transferencias
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
