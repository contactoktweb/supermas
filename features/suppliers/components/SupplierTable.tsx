'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { Supplier, SupplierStatus } from '../types'

interface SupplierTableProps {
  suppliers: Supplier[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  isCostRedacted: boolean
  sortField?:
    | 'businessName'
    | 'documentNumber'
    | 'totalPurchased'
    | 'currentBalance'
    | 'lastPurchaseDate'
    | 'createdAt'
  sortDirection?: 'asc' | 'desc'
  onSort: (
    field:
      | 'businessName'
      | 'documentNumber'
      | 'totalPurchased'
      | 'currentBalance'
      | 'lastPurchaseDate'
      | 'createdAt'
  ) => void
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

  const renderSortIndicator = (
    field:
      | 'businessName'
      | 'documentNumber'
      | 'totalPurchased'
      | 'currentBalance'
      | 'lastPurchaseDate'
      | 'createdAt'
  ) => {
    if (sortField !== field) return null
    return (
      <span className="sort-icon-indicator" style={{ marginLeft: 4 }}>
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    )
  }

  return (
    <div className="table-responsive page-enter">
      <table className="products-table" aria-label="Tabla de proveedores">
        <thead>
          <tr>
            <th
              scope="col"
              className="sortable-th"
              onClick={() => onSort('businessName')}
              title="Ordenar por razón social"
            >
              <span>Nombre Proveedor</span>
              {renderSortIndicator('businessName')}
            </th>
            <th
              scope="col"
              className="sortable-th"
              onClick={() => onSort('documentNumber')}
              title="Ordenar por documento o NIT"
            >
              <span>Documento / NIT</span>
              {renderSortIndicator('documentNumber')}
            </th>
            <th scope="col">Contacto</th>
            <th scope="col">Teléfono</th>
            <th scope="col">Email</th>
            <th scope="col">Ciudad</th>
            <th scope="col" className="numeric">
              Compras
            </th>
            <th
              scope="col"
              className="sortable-th"
              onClick={() => onSort('lastPurchaseDate')}
              title="Ordenar por fecha de última compra"
            >
              <span>Última Compra</span>
              {renderSortIndicator('lastPurchaseDate')}
            </th>
            <th
              scope="col"
              className="sortable-th numeric"
              onClick={() => onSort('currentBalance')}
              title="Ordenar por saldo pendiente"
            >
              <span>Saldo Pendiente</span>
              {renderSortIndicator('currentBalance')}
            </th>
            <th scope="col">Estado</th>
            <th scope="col" style={{ textAlign: 'right', paddingRight: 16 }}>
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((s) => {
            const hasPendingBalance = (s.currentBalance || 0) > 0

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
                {/* 1. Nombre Proveedor */}
                <td className="product-primary-col">
                  <div className="product-info-cell">
                    <strong className="product-name-text" style={{ fontSize: 13 }}>
                      {s.businessName || s.supplierName}
                    </strong>
                    {s.commercialName && (
                      <span className="sku-meta-text">{s.commercialName}</span>
                    )}
                  </div>
                </td>

                {/* 2. Documento / NIT */}
                <td className="product-code-col">
                  <span className="sku-badge" style={{ fontWeight: 700 }}>
                    {s.documentNumber || s.nit}
                  </span>
                </td>

                {/* 3. Contacto */}
                <td>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>
                    {s.contactName}
                  </span>
                </td>

                {/* 4. Teléfono */}
                <td>
                  <span className="secondary-meta" style={{ fontSize: 12 }}>
                    {s.phone}
                  </span>
                </td>

                {/* 5. Email */}
                <td>
                  <span
                    className="secondary-meta"
                    style={{ fontSize: 12, color: 'var(--navy)' }}
                  >
                    {s.email}
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
                <td className="numeric font-tabular">
                  <strong>{s.deliveriesCount || 0}</strong>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                    pedidos
                  </div>
                </td>

                {/* 8. Última Compra */}
                <td>
                  <span className="product-date-cell">
                    {s.lastPurchaseDate
                      ? formatDate(s.lastPurchaseDate)
                      : s.lastDeliveryDate || '—'}
                  </span>
                </td>

                {/* 9. Saldo Pendiente */}
                <td className="numeric font-tabular">
                  {hasPendingBalance ? (
                    <strong style={{ color: '#b45309', fontSize: 13 }}>
                      {formatCurrency(s.currentBalance)}
                    </strong>
                  ) : (
                    <span style={{ color: '#16a34a', fontSize: 12, fontWeight: 600 }}>
                      Al día ($0)
                    </span>
                  )}
                  {s.creditDays > 0 && (
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                      Plazo: {s.creditDays} días
                    </div>
                  )}
                </td>

                {/* 10. Estado */}
                <td>{getSupplierStatusBadge(s.status)}</td>

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
                      onClick={() => onSelectSupplier(s)}
                      title="Ver ficha completa y compras del proveedor"
                      aria-label="Ver detalle"
                    >
                      <AppIcon name="eye" size={15} />
                    </button>

                    {/* Editar */}
                    {onEditSupplier && (
                      <button
                        type="button"
                        className="icon-button-sm"
                        onClick={() => onEditSupplier(s)}
                        title="Editar datos del proveedor"
                        aria-label="Editar proveedor"
                      >
                        <AppIcon name="edit" size={15} />
                      </button>
                    )}

                    {/* Nueva Compra */}
                    {onNewPurchaseForSupplier && (
                      <button
                        type="button"
                        className="icon-button-sm"
                        onClick={() => onNewPurchaseForSupplier(s)}
                        title="Registrar nueva orden de compra a este proveedor"
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
                        className="icon-button-sm"
                        onClick={() => onViewDocuments(s)}
                        title="Ver facturas y documentos digitales"
                        aria-label="Ver documentos"
                        style={{ color: '#0284c7' }}
                      >
                        <AppIcon name="invoices" size={15} />
                      </button>
                    )}

                    {/* Desactivar / Activar */}
                    {s.status === 'ACTIVE' && onDeactivateSupplier ? (
                      <button
                        type="button"
                        className="icon-button-sm"
                        onClick={() => onDeactivateSupplier(s)}
                        title="Desactivar proveedor"
                        aria-label="Desactivar proveedor"
                        style={{ color: '#dc2626' }}
                      >
                        <AppIcon name="close" size={15} />
                      </button>
                    ) : (
                      s.status === 'INACTIVE' &&
                      onActivateSupplier && (
                        <button
                          type="button"
                          className="icon-button-sm"
                          onClick={() => onActivateSupplier(s)}
                          title="Reactivar proveedor"
                          aria-label="Activar proveedor"
                          style={{ color: '#16a34a' }}
                        >
                          <AppIcon name="check" size={15} />
                        </button>
                      )
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
            Mostrando {suppliers.length} de {total} proveedores registrados
          </span>
          <div className="page-size-selector">
            <label htmlFor="supplier-page-size">Por página:</label>
            <select
              id="supplier-page-size"
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
