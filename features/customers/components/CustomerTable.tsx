'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { Customer, CustomerFilterParams } from '../types'

interface CustomerTableProps {
  customers: Customer[]
  loading: boolean
  total: number
  page: number
  pageSize: number
  totalPages: number
  sortBy: CustomerFilterParams['sortBy']
  sortDirection: CustomerFilterParams['sortDirection']
  onSort: (field: CustomerFilterParams['sortBy']) => void
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  onViewDetail: (customer: Customer) => void
  onEdit: (customer: Customer) => void
  onAddPayment: (customer: Customer) => void
  onDeactivate: (customer: Customer) => void
  onReactivate: (customer: Customer) => void
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(isoString?: string): string {
  if (!isoString) return 'Sin compras'
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

export function CustomerTable({
  customers,
  loading,
  total,
  page,
  pageSize,
  totalPages,
  sortBy,
  sortDirection,
  onSort,
  onPageChange,
  onPageSizeChange,
  onViewDetail,
  onEdit,
  onAddPayment,
  onDeactivate,
  onReactivate,
}: CustomerTableProps) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

  const handleSortClick = (field: CustomerFilterParams['sortBy']) => {
    onSort(field)
  }

  const renderSortIcon = (field: CustomerFilterParams['sortBy']) => {
    if (sortBy !== field) {
      return (
        <span className="sort-icon-inactive" style={{ opacity: 0.3, marginLeft: 4 }}>
          ↕
        </span>
      )
    }
    return (
      <span className="sort-icon-active" style={{ color: 'var(--red)', marginLeft: 4 }}>
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    )
  }

  return (
    <div className="table-panel products-table-panel page-enter">
      <div className="table-scroll">
        <table aria-label="Directorio de clientes">
          <thead>
            <tr>
              {/* Cliente / Razón Social (Sticky) */}
              <th
                className="th-sortable sticky-col"
                onClick={() => handleSortClick('displayName')}
                style={{ cursor: 'pointer', minWidth: 260 }}
              >
                <div className="th-content">
                  <span>Cliente / Razón Social</span>
                  {renderSortIcon('displayName')}
                </div>
              </th>

              {/* Documento */}
              <th style={{ minWidth: 140 }}>Documento</th>

              {/* Contacto */}
              <th style={{ minWidth: 150 }}>Teléfono</th>

              {/* Email */}
              <th style={{ minWidth: 180 }}>Email</th>

              {/* Ubicación */}
              <th style={{ minWidth: 140 }}>Ciudad</th>

              {/* Última Compra */}
              <th
                className="th-sortable"
                onClick={() => handleSortClick('lastPurchaseDate')}
                style={{ cursor: 'pointer', minWidth: 130 }}
              >
                <div className="th-content">
                  <span>Última Compra</span>
                  {renderSortIcon('lastPurchaseDate')}
                </div>
              </th>

              {/* Total Comprado */}
              <th
                className="th-sortable"
                onClick={() => handleSortClick('totalPurchased')}
                style={{ cursor: 'pointer', minWidth: 150, textAlign: 'right' }}
              >
                <div className="th-content" style={{ justifyContent: 'flex-end' }}>
                  <span>Total Comprado</span>
                  {renderSortIcon('totalPurchased')}
                </div>
              </th>

              {/* Saldo en Cartera */}
              <th
                className="th-sortable"
                onClick={() => handleSortClick('currentBalance')}
                style={{ cursor: 'pointer', minWidth: 140, textAlign: 'right' }}
              >
                <div className="th-content" style={{ justifyContent: 'flex-end' }}>
                  <span>Saldo Cartera</span>
                  {renderSortIcon('currentBalance')}
                </div>
              </th>

              {/* Estado */}
              <th style={{ minWidth: 110, textAlign: 'center' }}>Estado</th>

              {/* Acciones */}
              <th style={{ minWidth: 90, textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              // Skeleton Rows
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skel-${i}`}>
                  <td className="sticky-col">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="skeleton-box" style={{ width: 34, height: 34, borderRadius: 8 }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                        <div className="skeleton-box" style={{ width: '80%', height: 14 }} />
                        <div className="skeleton-box" style={{ width: '50%', height: 10 }} />
                      </div>
                    </div>
                  </td>
                  <td><div className="skeleton-box" style={{ width: '75%', height: 12 }} /></td>
                  <td><div className="skeleton-box" style={{ width: '80%', height: 12 }} /></td>
                  <td><div className="skeleton-box" style={{ width: '90%', height: 12 }} /></td>
                  <td><div className="skeleton-box" style={{ width: '60%', height: 12 }} /></td>
                  <td><div className="skeleton-box" style={{ width: '70%', height: 12 }} /></td>
                  <td style={{ textAlign: 'right' }}><div className="skeleton-box" style={{ width: '80%', height: 12, marginLeft: 'auto' }} /></td>
                  <td style={{ textAlign: 'right' }}><div className="skeleton-box" style={{ width: '65%', height: 12, marginLeft: 'auto' }} /></td>
                  <td style={{ textAlign: 'center' }}><div className="skeleton-box" style={{ width: 60, height: 20, margin: '0 auto', borderRadius: 6 }} /></td>
                  <td style={{ textAlign: 'center' }}><div className="skeleton-box" style={{ width: 28, height: 28, margin: '0 auto', borderRadius: 6 }} /></td>
                </tr>
              ))
            ) : customers.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={10}>
                  <div className="table-empty-state" style={{ padding: '48px 20px', textAlign: 'center' }}>
                    <div
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        width: 56,
                        height: 56,
                        borderRadius: 14,
                        background: '#eff4fc',
                        color: 'var(--navy)',
                        margin: '0 auto 14px',
                      }}
                    >
                      <AppIcon name="customers" size={28} />
                    </div>
                    <strong style={{ fontSize: 16, color: 'var(--foreground)' }}>
                      No existen clientes registrados
                    </strong>
                    <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)' }}>
                      No hay clientes que coincidan con los filtros o aún no se han registrado clientes en el sistema.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              // Customer Rows
              customers.map((c) => {
                const isGeneric = c.documentNumber === '222222222222'
                const hasBalance = c.currentBalance > 0
                const isMenuOpen = activeMenuId === c.id

                return (
                  <tr
                    key={c.id}
                    onClick={() => onViewDetail(c)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Cliente / Razón Social (Sticky) */}
                    <td className="sticky-col">
                      <div className="product-cell">
                        <div
                          className="product-thumb"
                          style={{
                            background: c.customerType === 'COMPANY' ? '#e9eef8' : '#f0fbf6',
                            color: c.customerType === 'COMPANY' ? 'var(--navy)' : 'var(--green)',
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          {c.customerType === 'COMPANY' ? (
                            <AppIcon name="warehouse" size={16} />
                          ) : (
                            <AppIcon name="users" size={16} />
                          )}
                        </div>
                        <div>
                          <strong style={{ fontSize: 13, color: 'var(--foreground)' }}>
                            {c.displayName}
                          </strong>
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                            {c.commercialName && c.commercialName !== c.displayName
                              ? `${c.commercialName} • `
                              : ''}
                            {c.category === 'WHOLESALE' && 'Mayorista'}
                            {c.category === 'FREQUENT' && 'Cliente Frecuente'}
                            {c.category === 'COMPANY' && 'Empresa Institucional'}
                            {c.category === 'FINAL_CONSUMER' && 'Consumidor Final'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Documento */}
                    <td>
                      <span className="mono" style={{ fontWeight: 600, color: 'var(--foreground)' }}>
                        {c.documentType} {c.documentNumber}
                      </span>
                    </td>

                    {/* Teléfono */}
                    <td>
                      <span style={{ fontSize: 12 }}>{c.phone || c.mobile || '—'}</span>
                    </td>

                    {/* Email */}
                    <td>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {c.email || '—'}
                      </span>
                    </td>

                    {/* Ciudad */}
                    <td>
                      <span style={{ fontSize: 12 }}>
                        {c.city}
                        {c.department && c.department !== c.city ? `, ${c.department}` : ''}
                      </span>
                    </td>

                    {/* Última Compra */}
                    <td>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {formatDate(c.lastPurchaseDate)}
                      </span>
                    </td>

                    {/* Total Comprado */}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <strong style={{ fontSize: 13, color: 'var(--navy)' }}>
                          {formatCOP(c.totalPurchased)}
                        </strong>
                        <small style={{ fontSize: 10, color: 'var(--muted)' }}>
                          {c.purchasesCount} compra(s)
                        </small>
                      </div>
                    </td>

                    {/* Saldo en Cartera */}
                    <td style={{ textAlign: 'right' }}>
                      {hasBalance ? (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: '#fef3c7',
                            color: '#92400e',
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          {formatCOP(c.currentBalance)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--green)', fontWeight: 600, fontSize: 12 }}>
                          Al día ($0)
                        </span>
                      )}
                    </td>

                    {/* Estado */}
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className={`state ${c.status === 'ACTIVE' ? 'disponible' : 'crítico'}`}
                        style={{ textTransform: 'capitalize' }}
                      >
                        <AppIcon
                          name={c.status === 'ACTIVE' ? 'check' : 'close'}
                          size={11}
                        />
                        <span>{c.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</span>
                      </span>
                    </td>

                    {/* Acciones */}
                    <td
                      style={{ textAlign: 'center', position: 'relative' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <button
                          type="button"
                          className="icon-button"
                          title="Ver expediente comercial"
                          onClick={() => onViewDetail(c)}
                          style={{ width: 28, height: 28, borderRadius: 6 }}
                        >
                          <AppIcon name="eye" size={14} color="var(--navy)" />
                        </button>

                        <button
                          type="button"
                          className="icon-button"
                          title="Editar cliente"
                          onClick={() => onEdit(c)}
                          style={{ width: 28, height: 28, borderRadius: 6 }}
                        >
                          <AppIcon name="edit" size={14} color="#64748b" />
                        </button>

                        {/* Dropdown Menu Toggle */}
                        <div style={{ position: 'relative' }}>
                          <button
                            type="button"
                            className="icon-button"
                            title="Más opciones"
                            onClick={() => setActiveMenuId(isMenuOpen ? null : c.id)}
                            style={{ width: 28, height: 28, borderRadius: 6 }}
                          >
                            <AppIcon name="chevronDown" size={13} color="#64748b" />
                          </button>

                          {isMenuOpen && (
                            <div
                              className="custom-select-dropdown"
                              style={{
                                position: 'absolute',
                                right: 0,
                                top: '100%',
                                minWidth: 175,
                                zIndex: 99999,
                                textAlign: 'left',
                                padding: '6px 0',
                              }}
                            >
                              <button
                                type="button"
                                className="custom-select-option"
                                onClick={() => {
                                  setActiveMenuId(null)
                                  onViewDetail(c)
                                }}
                              >
                                <AppIcon name="fileText" size={13} color="var(--navy)" />
                                <span>Ver Historial / Ventas</span>
                              </button>

                              {hasBalance && (
                                <button
                                  type="button"
                                  className="custom-select-option"
                                  onClick={() => {
                                    setActiveMenuId(null)
                                    onAddPayment(c)
                                  }}
                                >
                                  <AppIcon name="wallet" size={13} color="var(--green)" />
                                  <span>Registrar Abono</span>
                                </button>
                              )}

                              <button
                                type="button"
                                className="custom-select-option"
                                onClick={() => {
                                  setActiveMenuId(null)
                                  onEdit(c)
                                }}
                              >
                                <AppIcon name="edit" size={13} color="#64748b" />
                                <span>Editar Datos</span>
                              </button>

                              {!isGeneric && (
                                <>
                                  <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />
                                  {c.status === 'ACTIVE' ? (
                                    <button
                                      type="button"
                                      className="custom-select-option"
                                      style={{ color: '#dc2626' }}
                                      onClick={() => {
                                        setActiveMenuId(null)
                                        onDeactivate(c)
                                      }}
                                    >
                                      <AppIcon name="close" size={13} color="#dc2626" />
                                      <span>Desactivar Cliente</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="custom-select-option"
                                      style={{ color: 'var(--green)' }}
                                      onClick={() => {
                                        setActiveMenuId(null)
                                        onReactivate(c)
                                      }}
                                    >
                                      <AppIcon name="check" size={13} color="var(--green)" />
                                      <span>Reactivar Cliente</span>
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="table-pagination-footer">
        <div className="pagination-info">
          <span>
            Mostrando <strong>{customers.length > 0 ? (page - 1) * pageSize + 1 : 0}</strong> a{' '}
            <strong>{Math.min(page * pageSize, total)}</strong> de <strong>{total}</strong> clientes
          </span>
        </div>

        <div className="pagination-controls">
          <button
            type="button"
            className="outline-button compact"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
            aria-label="Página anterior"
          >
            Anterior
          </button>

          <div className="page-numbers-cluster">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1]
                const isGap = prev && p - prev > 1
                return (
                  <React.Fragment key={p}>
                    {isGap && <span className="pagination-ellipsis">...</span>}
                    <button
                      type="button"
                      className={`page-num-btn ${page === p ? 'active' : ''}`}
                      onClick={() => onPageChange(p)}
                      disabled={loading}
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
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
            aria-label="Página siguiente"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  )
}
