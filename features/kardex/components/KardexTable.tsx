'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import {
  InventoryMovement,
  KardexColumnVisibility,
  KardexSortField,
  MovementType,
} from '../types'

interface KardexTableProps {
  movements: InventoryMovement[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  isCostRedacted: boolean
  sortField?: KardexSortField
  sortDirection?: 'asc' | 'desc'
  visibility: KardexColumnVisibility
  onSort: (field: KardexSortField) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onSelectMovement: (movement: InventoryMovement) => void
  onViewDocument?: (movement: InventoryMovement) => void
}

export function getMovementTypeBadge(type: MovementType) {
  let label = 'Movimiento'
  let icon: LightIconName = 'kardex'
  let badgeClass = 'type-badge-blue'

  switch (type) {
    case 'COMPRA':
      label = 'Compra (+)'
      icon = 'purchases'
      badgeClass = 'type-badge-green'
      break
    case 'VENTA':
      label = 'Venta (-)'
      icon = 'sales'
      badgeClass = 'type-badge-blue'
      break
    case 'TRANSFERENCIA_ENTRADA':
      label = 'Transf. Entrada (+)'
      icon = 'transfers'
      badgeClass = 'type-badge-teal'
      break
    case 'TRANSFERENCIA_SALIDA':
      label = 'Transf. Salida (-)'
      icon = 'transfers'
      badgeClass = 'type-badge-amber'
      break
    case 'AJUSTE_ENTRADA':
      label = 'Ajuste Entrada (+)'
      icon = 'plus'
      badgeClass = 'type-badge-teal'
      break
    case 'AJUSTE_SALIDA':
      label = 'Ajuste Salida (-)'
      icon = 'warning'
      badgeClass = 'type-badge-red'
      break
    case 'DEVOLUCION':
      label = 'Devolución (+)'
      icon = 'arrowLeftRight'
      badgeClass = 'type-badge-purple'
      break
    case 'REMISION':
      label = 'Remisión (-)'
      icon = 'fileText'
      badgeClass = 'type-badge-amber'
      break
    case 'REVERSION':
      label = 'Reversión (Comp.)'
      icon = 'refresh'
      badgeClass = 'type-badge-indigo'
      break
  }

  return (
    <span className={`kardex-type-badge ${badgeClass}`}>
      <AppIcon name={icon} size={13} />
      <span>{label}</span>
    </span>
  )
}

export function KardexTable({
  movements,
  total,
  page,
  pageSize,
  totalPages,
  isCostRedacted,
  sortField,
  sortDirection,
  visibility,
  onSort,
  onPageChange,
  onPageSizeChange,
  onSelectMovement,
  onViewDocument,
}: KardexTableProps) {
  const getSortIcon = (field: KardexSortField) => {
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

  // Format date & time strictly in America/Bogota
  const formatDateTime = (isoString: string) => {
    const d = new Date(isoString)
    return d.toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  }

  return (
    <div className="table-panel products-table-panel kardex-table-panel page-enter">
      <div className="table-scroll" tabIndex={0} aria-label="Tabla de movimientos de Kardex">
        <table>
          <thead>
            <tr>
              {/* 1. Fecha y hora */}
              {visibility.createdAt && (
                <th
                  onClick={() => onSort('createdAt')}
                  className="sortable-th sticky-left-col"
                  style={{ minWidth: 165 }}
                >
                  <div className="th-content">
                    <span>Fecha y hora</span>
                    {getSortIcon('createdAt')}
                  </div>
                </th>
              )}

              {/* 2. Producto */}
              {visibility.product && (
                <th
                  onClick={() => onSort('productName')}
                  className="sortable-th"
                  style={{ minWidth: 220 }}
                >
                  <div className="th-content">
                    <span>Producto</span>
                    {getSortIcon('productName')}
                  </div>
                </th>
              )}

              {/* 3. SKU */}
              {visibility.sku && (
                <th onClick={() => onSort('sku')} className="sortable-th">
                  <div className="th-content">
                    <span>SKU</span>
                    {getSortIcon('sku')}
                  </div>
                </th>
              )}

              {/* 4. Bodega */}
              {visibility.location && (
                <th
                  onClick={() => onSort('locationName')}
                  className="sortable-th"
                  style={{ minWidth: 160 }}
                >
                  <div className="th-content">
                    <span>Bodega</span>
                    {getSortIcon('locationName')}
                  </div>
                </th>
              )}

              {/* 5. Tipo */}
              {visibility.movementType && (
                <th onClick={() => onSort('type')} className="sortable-th">
                  <div className="th-content">
                    <span>Tipo</span>
                    {getSortIcon('type')}
                  </div>
                </th>
              )}

              {/* 6. Documento */}
              {visibility.document && (
                <th style={{ minWidth: 120 }}>
                  <div className="th-content">
                    <span>Documento</span>
                  </div>
                </th>
              )}

              {/* 7. Saldo anterior */}
              {visibility.previousStock && (
                <th style={{ textAlign: 'right' }}>
                  <div className="th-content right">
                    <span>Saldo Ant.</span>
                  </div>
                </th>
              )}

              {/* 8. Entrada */}
              {visibility.quantityIn && (
                <th
                  onClick={() => onSort('quantityIn')}
                  className="sortable-th"
                  style={{ textAlign: 'right' }}
                >
                  <div className="th-content right">
                    <span>Entrada</span>
                    {getSortIcon('quantityIn')}
                  </div>
                </th>
              )}

              {/* 9. Salida */}
              {visibility.quantityOut && (
                <th
                  onClick={() => onSort('quantityOut')}
                  className="sortable-th"
                  style={{ textAlign: 'right' }}
                >
                  <div className="th-content right">
                    <span>Salida</span>
                    {getSortIcon('quantityOut')}
                  </div>
                </th>
              )}

              {/* 10. Saldo resultante */}
              {visibility.resultingStock && (
                <th
                  onClick={() => onSort('resultingStock')}
                  className="sortable-th"
                  style={{ textAlign: 'right' }}
                >
                  <div className="th-content right">
                    <span>Saldo Resultante</span>
                    {getSortIcon('resultingStock')}
                  </div>
                </th>
              )}

              {/* 11. Costo unitario */}
              {visibility.unitCost && (
                <th style={{ textAlign: 'right' }}>
                  <div className="th-content right">
                    <span>Costo Unit.</span>
                  </div>
                </th>
              )}

              {/* 12. Costo promedio */}
              {visibility.averageCost && (
                <th style={{ textAlign: 'right' }}>
                  <div className="th-content right">
                    <span>Costo Prom.</span>
                  </div>
                </th>
              )}

              {/* 13. Valor del movimiento */}
              {visibility.totalValue && (
                <th
                  onClick={() => onSort('totalValue')}
                  className="sortable-th"
                  style={{ textAlign: 'right' }}
                >
                  <div className="th-content right">
                    <span>Valor Movimiento</span>
                    {getSortIcon('totalValue')}
                  </div>
                </th>
              )}

              {/* 14. Usuario responsable */}
              {visibility.user && (
                <th>
                  <div className="th-content">
                    <span>Usuario</span>
                  </div>
                </th>
              )}

              {/* 15. Acción */}
              {visibility.actions && (
                <th style={{ textAlign: 'center', width: 60 }}>
                  <span>Acción</span>
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {movements.map((m) => {
              const delta = m.quantityIn > 0 ? `+${m.quantityIn}` : `-${m.quantityOut}`
              const flowHint = `${m.previousStock} → ${delta} → ${m.resultingStock}`

              return (
                <tr
                  key={m.id}
                  onClick={() => onSelectMovement(m)}
                  className="clickable-row"
                >
                  {/* 1. Fecha y hora */}
                  {visibility.createdAt && (
                    <td className="sticky-left-col">
                      <div className="kardex-time-cell">
                        <AppIcon name="clock" size={13} color="#94a3b8" />
                        <strong className="kardex-time-text">{formatDateTime(m.createdAt)}</strong>
                      </div>
                    </td>
                  )}

                  {/* 2. Producto */}
                  {visibility.product && (
                    <td>
                      <div className="product-cell">
                        <div className="product-thumb">
                          {m.imageUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={m.imageUrl}
                              alt={m.productName}
                              style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover' }}
                            />
                          ) : (
                            <AppIcon name="products" size={18} />
                          )}
                        </div>
                        <div>
                          <strong>{m.productName}</strong>
                          <span>{m.category}</span>
                        </div>
                      </div>
                    </td>
                  )}

                  {/* 3. SKU */}
                  {visibility.sku && (
                    <td>
                      <span className="code-badge product-sku-badge">{m.sku}</span>
                    </td>
                  )}

                  {/* 4. Bodega */}
                  {visibility.location && (
                    <td>
                      <div className="location-cell-block">
                        <strong className="location-name-text">{m.locationName}</strong>
                        <small className="location-code-tag">{m.locationCode}</small>
                      </div>
                    </td>
                  )}

                  {/* 5. Tipo */}
                  {visibility.movementType && (
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {getMovementTypeBadge(m.type)}
                        {m.isReversion && (
                          <span
                            style={{
                              fontSize: 9,
                              color: '#6366f1',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <AppIcon name="refresh" size={10} /> Revertido
                          </span>
                        )}
                      </div>
                    </td>
                  )}

                  {/* 6. Documento */}
                  {visibility.document && (
                    <td>
                      <button
                        type="button"
                        className="source-doc-badge"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (onViewDocument) {
                            onViewDocument(m)
                          } else {
                            onSelectMovement(m)
                          }
                        }}
                        title={`Ver documento origen ${m.sourceDocumentNumber}`}
                      >
                        <AppIcon name="fileText" size={12} />
                        <strong>{m.sourceDocumentNumber}</strong>
                      </button>
                    </td>
                  )}

                  {/* 7. Saldo anterior */}
                  {visibility.previousStock && (
                    <td style={{ textAlign: 'right' }}>
                      <span className="stock-prev-text">
                        {m.previousStock} {m.unitOfMeasure}
                      </span>
                    </td>
                  )}

                  {/* 8. Entrada */}
                  {visibility.quantityIn && (
                    <td style={{ textAlign: 'right' }}>
                      {m.quantityIn > 0 ? (
                        <strong className="qty-in-pill">
                          +{m.quantityIn} {m.unitOfMeasure}
                        </strong>
                      ) : (
                        <span className="qty-dash">—</span>
                      )}
                    </td>
                  )}

                  {/* 9. Salida */}
                  {visibility.quantityOut && (
                    <td style={{ textAlign: 'right' }}>
                      {m.quantityOut > 0 ? (
                        <strong className="qty-out-pill">
                          -{m.quantityOut} {m.unitOfMeasure}
                        </strong>
                      ) : (
                        <span className="qty-dash">—</span>
                      )}
                    </td>
                  )}

                  {/* 10. Saldo resultante (con visualización de flujo claro) */}
                  {visibility.resultingStock && (
                    <td style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-end',
                          gap: 2,
                        }}
                        title={`Flujo: ${flowHint}`}
                      >
                        <strong className="stock-result-text">
                          {m.resultingStock} {m.unitOfMeasure}
                        </strong>
                        <small style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'monospace' }}>
                          {flowHint}
                        </small>
                      </div>
                    </td>
                  )}

                  {/* 11. Costo unitario */}
                  {visibility.unitCost && (
                    <td style={{ textAlign: 'right' }}>
                      {isCostRedacted ? (
                        <span className="redacted-pill">••••••••</span>
                      ) : (
                        <span className="cost-text">${m.unitCost.toLocaleString('es-CO')}</span>
                      )}
                    </td>
                  )}

                  {/* 12. Costo promedio */}
                  {visibility.averageCost && (
                    <td style={{ textAlign: 'right' }}>
                      {isCostRedacted ? (
                        <span className="redacted-pill">••••••••</span>
                      ) : (
                        <span className="cost-text">
                          ${m.averageCostAfter.toLocaleString('es-CO')}
                        </span>
                      )}
                    </td>
                  )}

                  {/* 13. Valor del movimiento */}
                  {visibility.totalValue && (
                    <td style={{ textAlign: 'right' }}>
                      {isCostRedacted ? (
                        <span className="redacted-pill">••••••••</span>
                      ) : (
                        <strong className="price-primary">
                          ${m.totalValue.toLocaleString('es-CO')}
                        </strong>
                      )}
                    </td>
                  )}

                  {/* 14. Usuario responsable */}
                  {visibility.user && (
                    <td>
                      <div className="user-author-block">
                        <strong>{m.userName}</strong>
                        <small>{m.userRole}</small>
                      </div>
                    </td>
                  )}

                  {/* 15. Acción */}
                  {visibility.actions && (
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="icon-button inspect-row-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectMovement(m)
                        }}
                        title="Ver detalle del movimiento"
                        aria-label={`Ver detalle del movimiento ${m.movementNumber}`}
                      >
                        <AppIcon name="chevronRight" size={15} />
                      </button>
                    </td>
                  )}
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
            Mostrando <strong>{movements.length}</strong> de <strong>{total}</strong> movimientos
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
