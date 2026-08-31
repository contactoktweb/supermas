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
      label = 'Reversión'
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

  const formatDateTime = (isoString: string) => {
    const d = new Date(isoString)
    return d.toLocaleString('es-CO', {
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

              {visibility.sku && (
                <th onClick={() => onSort('sku')} className="sortable-th">
                  <div className="th-content">
                    <span>SKU</span>
                    {getSortIcon('sku')}
                  </div>
                </th>
              )}

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

              {visibility.movementType && (
                <th onClick={() => onSort('type')} className="sortable-th">
                  <div className="th-content">
                    <span>Tipo de Movimiento</span>
                    {getSortIcon('type')}
                  </div>
                </th>
              )}

              {visibility.document && (
                <th style={{ minWidth: 120 }}>
                  <div className="th-content">
                    <span>Documento</span>
                  </div>
                </th>
              )}

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

              {visibility.previousStock && (
                <th style={{ textAlign: 'right' }}>
                  <div className="th-content right">
                    <span>Saldo Ant.</span>
                  </div>
                </th>
              )}

              {visibility.resultingStock && (
                <th
                  onClick={() => onSort('resultingStock')}
                  className="sortable-th"
                  style={{ textAlign: 'right' }}
                >
                  <div className="th-content right">
                    <span>Saldo Final</span>
                    {getSortIcon('resultingStock')}
                  </div>
                </th>
              )}

              {visibility.unitCost && (
                <th style={{ textAlign: 'right' }}>
                  <div className="th-content right">
                    <span>Costo Unit.</span>
                  </div>
                </th>
              )}

              {visibility.averageCost && (
                <th style={{ textAlign: 'right' }}>
                  <div className="th-content right">
                    <span>Costo Prom.</span>
                  </div>
                </th>
              )}

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

              {visibility.user && (
                <th>
                  <div className="th-content">
                    <span>Responsable</span>
                  </div>
                </th>
              )}

              {visibility.actions && (
                <th style={{ textAlign: 'center', width: 60 }}>
                  <span>Acciones</span>
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {movements.map((m) => (
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
                    <div className="product-name-block">
                      <strong>{m.productName}</strong>
                      <span className="category-pill-tag" style={{ width: 'fit-content' }}>
                        {m.category}
                      </span>
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

                {/* 5. Tipo de Movimiento */}
                {visibility.movementType && (
                  <td>{getMovementTypeBadge(m.type)}</td>
                )}

                {/* 6. Documento Origen */}
                {visibility.document && (
                  <td>
                    <span className="source-doc-badge">
                      <AppIcon name="fileText" size={12} />
                      <strong>{m.sourceDocumentNumber}</strong>
                    </span>
                  </td>
                )}

                {/* 7. Entrada */}
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

                {/* 8. Salida */}
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

                {/* 9. Saldo Anterior */}
                {visibility.previousStock && (
                  <td style={{ textAlign: 'right' }}>
                    <span className="stock-prev-text">
                      {m.previousStock} {m.unitOfMeasure}
                    </span>
                  </td>
                )}

                {/* 10. Saldo Resultante */}
                {visibility.resultingStock && (
                  <td style={{ textAlign: 'right' }}>
                    <strong className="stock-result-text">
                      {m.resultingStock} {m.unitOfMeasure}
                    </strong>
                  </td>
                )}

                {/* 11. Costo Unitario */}
                {visibility.unitCost && (
                  <td style={{ textAlign: 'right' }}>
                    {isCostRedacted ? (
                      <span className="redacted-pill">••••••••</span>
                    ) : (
                      <span className="cost-text">${m.unitCost.toLocaleString('es-CO')}</span>
                    )}
                  </td>
                )}

                {/* 12. Costo Promedio */}
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

                {/* 13. Valor Total Movimiento */}
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

                {/* 14. Responsable */}
                {visibility.user && (
                  <td>
                    <div className="user-author-block">
                      <strong>{m.userName}</strong>
                      <small>{m.userRole}</small>
                    </div>
                  </td>
                )}

                {/* 15. Acciones */}
                {visibility.actions && (
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectMovement(m)
                      }}
                      title="Ver trazabilidad completa del movimiento"
                      aria-label="Ver detalle del movimiento"
                    >
                      <AppIcon name="eye" size={15} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
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
              aria-label="Movimientos por página"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div className="pagination-controls">
          <button
            type="button"
            className="pagination-btn"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Página anterior"
          >
            <AppIcon name="chevronLeft" size={14} />
            <span>Anterior</span>
          </button>

          <div className="pagination-pages">
            {Array.from({ length: totalPages }).map((_, i) => {
              const pNum = i + 1
              return (
                <button
                  key={pNum}
                  type="button"
                  className={`pagination-number-btn ${page === pNum ? 'active' : ''}`}
                  onClick={() => onPageChange(pNum)}
                  aria-label={`Página ${pNum}`}
                >
                  {pNum}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            className="pagination-btn"
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
