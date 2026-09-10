'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { Supplier, SupplierStatus } from '../types'

type SupplierSortField =
  | 'businessName'
  | 'documentNumber'
  | 'totalPurchased'
  | 'currentBalance'
  | 'lastPurchaseDate'
  | 'createdAt'

interface SupplierTableProps {
  suppliers: Supplier[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  isCostRedacted: boolean
  sortField?: SupplierSortField
  sortDirection?: 'asc' | 'desc'
  onSort: (field: SupplierSortField) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onSelectSupplier: (supplier: Supplier) => void
  onEditSupplier?: (supplier: Supplier) => void
  onNewPurchaseForSupplier?: (supplier: Supplier) => void
  onViewDocuments?: (supplier: Supplier) => void
  onDeactivateSupplier?: (supplier: Supplier) => void
  onActivateSupplier?: (supplier: Supplier) => void
}

export function getSupplierStatusBadge(status: SupplierStatus) {
  if (status === 'ACTIVE') {
    return (
      <span className="kardex-type-badge type-badge-green" title="Proveedor activo">
        <AppIcon name="check" size={12} />
        <span>Activo</span>
      </span>
    )
  }
  return (
    <span className="kardex-type-badge type-badge-gray" title="Proveedor inactivo">
      <AppIcon name="close" size={12} />
      <span>Inactivo</span>
    </span>
  )
}

export function SupplierTable({
  suppliers,
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
  onSelectSupplier,
  onEditSupplier,
  onNewPurchaseForSupplier,
  onViewDocuments,
  onDeactivateSupplier,
  onActivateSupplier,
}: SupplierTableProps) {
  const getSortIcon = (field: SupplierSortField) => {
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
      <div className="table-scroll" tabIndex={0} aria-label="Tabla de proveedores">
        <table>
          <thead>
            <tr>
              {/* 1. Razón Social */}
              <th
                onClick={() => onSort('businessName')}
                className="sortable-th sticky-left-col"
                style={{ minWidth: 220 }}
              >
                <div className="th-content">
                  <span>Nombre Proveedor</span>
                  {getSortIcon('businessName')}
                </div>
              </th>

              {/* 2. Documento / NIT */}
              <th
                onClick={() => onSort('documentNumber')}
                className="sortable-th"
                style={{ minWidth: 140 }}
              >
                <div className="th-content">
                  <span>Documento / NIT</span>
                  {getSortIcon('documentNumber')}
                </div>
              </th>

              {/* 3. Contacto */}
              <th style={{ minWidth: 150 }}>
                <div className="th-content">
                  <span>Contacto</span>
                </div>
              </th>

              {/* 4. Teléfono */}
              <th style={{ minWidth: 130 }}>
                <div className="th-content">
                  <span>Teléfono</span>
                </div>
              </th>

              {/* 5. Email */}
              <th style={{ minWidth: 180 }}>
                <div className="th-content">
                  <span>Email</span>
                </div>
              </th>

              {/* 6. Ciudad */}
              <th style={{ minWidth: 120 }}>
                <div className="th-content">
                  <span>Ciudad</span>
                </div>
              </th>

              {/* 7. Compras */}
              <th style={{ textAlign: 'center', minWidth: 100 }}>
                <div className="th-content" style={{ justifyContent: 'center' }}>
                  <span>Compras</span>
                </div>
              </th>

              {/* 8. Última Compra */}
              <th
                onClick={() => onSort('lastPurchaseDate')}
                className="sortable-th"
                style={{ minWidth: 130 }}
              >
                <div className="th-content">
                  <span>Última Compra</span>
                  {getSortIcon('lastPurchaseDate')}
                </div>
              </th>

              {/* 9. Saldo Pendiente */}
              <th
                onClick={() => onSort('currentBalance')}
                className="sortable-th"
                style={{ textAlign: 'right', minWidth: 140 }}
              >
                <div className="th-content right">
                  <span>Saldo Pendiente</span>
                  {getSortIcon('currentBalance')}
                </div>
              </th>

              {/* 10. Estado */}
              <th style={{ minWidth: 110 }}>
                <div className="th-content">
                  <span>Estado</span>
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
            {suppliers.map((s) => {
              const hasPendingBalance = s.currentBalance > 0
              const isActive = s.status === 'ACTIVE'

              return (
                <tr
                  key={s.id}
                  className="table-row-clickable"
                  onClick={() => onSelectSupplier(s)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSelectSupplier(s)
                  }}
                >
                  {/* 1. Nombre / Razón Social */}
                  <td className="product-primary-col sticky-left-col">
                    <div className="product-info-cell">
                      <strong className="product-name-text" style={{ fontSize: 13 }}>
                        {s.businessName}
                      </strong>
                      {s.commercialName && (
                        <span className="sku-meta-text">{s.commercialName}</span>
                      )}
                    </div>
                  </td>

                  {/* 2. Documento / NIT */}
                  <td>
                    <span className="sku-badge" style={{ fontWeight: 700 }}>
                      {s.documentNumber || s.nit}
                    </span>
                  </td>

                  {/* 3. Contacto */}
                  <td>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>
                      {s.contactName || '—'}
                    </span>
                  </td>

                  {/* 4. Teléfono */}
                  <td>
                    <span className="secondary-meta" style={{ fontSize: 12 }}>
                      {s.phone || '—'}
                    </span>
                  </td>

                  {/* 5. Email */}
                  <td>
                    <span className="secondary-meta" style={{ fontSize: 12 }}>
                      {s.email || '—'}
                    </span>
                  </td>

                  {/* 6. Ciudad */}
                  <td>
                    <span style={{ fontSize: 12 }}>
                      {s.city}
                      {s.department ? `, ${s.department}` : ''}
                    </span>
                  </td>

                  {/* 7. Compras Realizadas */}
                  <td style={{ textAlign: 'center' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        background: '#f1f5f9',
                        borderRadius: 6,
                        fontWeight: 700,
                        fontSize: 12,
                        color: 'var(--navy)',
                      }}
                    >
                      {s.deliveriesCount || 0}
                    </span>
                  </td>

                  {/* 8. Última Compra */}
                  <td>
                    <span className="product-date-cell">
                      {formatDate(s.lastPurchaseDate || s.lastDeliveryDate)}
                    </span>
                  </td>

                  {/* 9. Saldo Pendiente */}
                  <td style={{ textAlign: 'right' }}>
                    {hasPendingBalance ? (
                      <strong style={{ color: '#b45309', fontSize: 13 }}>
                        {formatCurrency(s.currentBalance)}
                      </strong>
                    ) : (
                      <span style={{ color: '#16a34a', fontSize: 12, fontWeight: 600 }}>
                        Al día ($0)
                      </span>
                    )}
                  </td>

                  {/* 10. Estado */}
                  <td>{getSupplierStatusBadge(s.status)}</td>

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
                      {/* Editar */}
                      {onEditSupplier && (
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => onEditSupplier(s)}
                          title="Editar información de proveedor"
                          aria-label={`Editar proveedor ${s.businessName}`}
                        >
                          <AppIcon name="edit" size={15} />
                        </button>
                      )}

                      {/* Nueva Compra */}
                      {isActive && onNewPurchaseForSupplier && (
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => onNewPurchaseForSupplier(s)}
                          title="Crear nueva orden de compra para este proveedor"
                          aria-label="Nueva compra"
                          style={{ color: 'var(--navy)' }}
                        >
                          <AppIcon name="purchases" size={15} />
                        </button>
                      )}

                      {/* Ver Documentos */}
                      {onViewDocuments && (
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => onViewDocuments(s)}
                          title="Ver documentos fiscales y soportes"
                          aria-label="Ver documentos"
                        >
                          <AppIcon name="invoices" size={15} />
                        </button>
                      )}

                      {/* Desactivar / Reactivar */}
                      {isActive && onDeactivateSupplier ? (
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => onDeactivateSupplier(s)}
                          title="Desactivar proveedor"
                          aria-label="Desactivar proveedor"
                          style={{ color: '#dc2626' }}
                        >
                          <AppIcon name="close" size={15} />
                        </button>
                      ) : (
                        !isActive &&
                        onActivateSupplier && (
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => onActivateSupplier(s)}
                            title="Reactivar proveedor"
                            aria-label="Reactivar proveedor"
                            style={{ color: '#16a34a' }}
                          >
                            <AppIcon name="check" size={15} />
                          </button>
                        )
                      )}

                      {/* Inspeccionar */}
                      <button
                        type="button"
                        className="icon-button inspect-row-btn"
                        onClick={() => onSelectSupplier(s)}
                        title="Ver detalle completo de proveedor"
                        aria-label={`Ver detalle de ${s.businessName}`}
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
            Mostrando <strong>{suppliers.length}</strong> de <strong>{total}</strong> proveedores registrados
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
