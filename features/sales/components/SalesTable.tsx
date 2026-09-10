'use client'

import React, { useState, useEffect, useRef } from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { Sale, SaleStatus, SaleDocumentType } from '../types'

interface SalesTableProps {
  sales: Sale[]
  loading: boolean
  total: number
  page: number
  pageSize: number
  totalPages: number
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
  onSort: (field: string) => void
  onPageChange: (newPage: number) => void
  onViewDetail: (sale: Sale) => void
  onGenerateInvoice: (sale: Sale) => void
  onGenerateRemission: (sale: Sale) => void
  onCancelSale: (sale: Sale) => void
  onViewKardex?: (sale: Sale) => void
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string): { date: string; time: string } {
  try {
    const d = new Date(dateStr)
    return {
      date: d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    }
  } catch {
    return { date: dateStr, time: '' }
  }
}

export function SalesTable({
  sales,
  loading,
  total,
  page,
  pageSize,
  totalPages,
  sortBy = 'date',
  sortDirection = 'desc',
  onSort,
  onPageChange,
  onViewDetail,
  onGenerateInvoice,
  onGenerateRemission,
  onCancelSale,
  onViewKardex,
}: SalesTableProps) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const renderSortIndicator = (field: string) => {
    if (sortBy !== field) {
      return <AppIcon name="sort" size={12} color="#94a3b8" />
    }
    return sortDirection === 'asc' ? (
      <AppIcon name="chevronUp" size={12} color="var(--navy)" />
    ) : (
      <AppIcon name="chevronDown" size={12} color="var(--navy)" />
    )
  }

  const getStatusBadge = (status: SaleStatus) => {
    switch (status) {
      case 'CONFIRMED':
        return <span className="custom-badge badge-green">Confirmada</span>
      case 'INVOICED':
        return <span className="custom-badge badge-blue">Facturada</span>
      case 'PENDING':
        return <span className="custom-badge badge-amber">Pendiente</span>
      case 'CANCELLED':
        return <span className="custom-badge badge-red">Anulada</span>
      case 'RETURNED':
        return <span className="custom-badge badge-purple">Devuelta</span>
      default:
        return <span className="custom-badge">{status}</span>
    }
  }

  const getDocumentBadge = (docType: SaleDocumentType, invoiceNumber?: string, remissionNumber?: string) => {
    switch (docType) {
      case 'FACTURA_ELECTRONICA':
        return (
          <span
            className="custom-badge badge-blue"
            title={invoiceNumber || 'Factura Electrónica'}
            style={{ fontSize: 11 }}
          >
            <AppIcon name="fileText" size={11} /> {invoiceNumber || 'FE'}
          </span>
        )
      case 'FACTURA_POS':
        return (
          <span
            className="custom-badge badge-green"
            title={invoiceNumber || 'Factura POS'}
            style={{ fontSize: 11 }}
          >
            <AppIcon name="pos" size={11} /> {invoiceNumber || 'POS'}
          </span>
        )
      case 'REMISION':
        return (
          <span
            className="custom-badge badge-purple"
            title={remissionNumber || 'Remisión de entrega'}
            style={{ fontSize: 11 }}
          >
            <AppIcon name="remisiones" size={11} /> {remissionNumber || 'REM'}
          </span>
        )
      default:
        return <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>
    }
  }

  return (
    <div className="table-panel animated-table page-enter">
      <div className="table-scroll">
        <table style={{ width: '100%', minWidth: 980 }}>
          <thead>
            <tr>
              <th
                onClick={() => onSort('saleNumber')}
                style={{ cursor: 'pointer', width: 140 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>N° Venta</span>
                  {renderSortIndicator('saleNumber')}
                </div>
              </th>
              <th
                onClick={() => onSort('date')}
                style={{ cursor: 'pointer', width: 130 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Fecha</span>
                  {renderSortIndicator('date')}
                </div>
              </th>
              <th
                onClick={() => onSort('customerName')}
                style={{ cursor: 'pointer', width: 220 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Cliente</span>
                  {renderSortIndicator('customerName')}
                </div>
              </th>
              <th style={{ width: 150 }}>Bodega / Punto</th>
              <th style={{ width: 120 }}>Vendedor</th>
              <th style={{ width: 100, textAlign: 'center' }}>Productos</th>
              <th
                onClick={() => onSort('totalAmount')}
                style={{ cursor: 'pointer', textAlign: 'right', width: 130 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                  <span>Total</span>
                  {renderSortIndicator('totalAmount')}
                </div>
              </th>
              <th
                onClick={() => onSort('status')}
                style={{ cursor: 'pointer', width: 110, textAlign: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <span>Estado</span>
                  {renderSortIndicator('status')}
                </div>
              </th>
              <th style={{ width: 130, textAlign: 'center' }}>Documento</th>
              <th style={{ width: 70, textAlign: 'center' }}>Acción</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: pageSize > 6 ? 6 : pageSize }).map((_, i) => (
                <tr key={i} className="skeleton-row">
                  <td colSpan={10}>
                    <div className="skeleton-box" style={{ height: 28, width: '100%' }} />
                  </td>
                </tr>
              ))
            ) : sales.length === 0 ? (
              <tr>
                <td colSpan={10}>
                  <div
                    style={{
                      padding: '48px 24px',
                      textAlign: 'center',
                      color: 'var(--muted)',
                    }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: '#e9eef8',
                        color: 'var(--navy)',
                        display: 'grid',
                        placeItems: 'center',
                        margin: '0 auto 12px',
                      }}
                    >
                      <AppIcon name="sales" size={24} />
                    </div>
                    <strong style={{ fontSize: 15, color: 'var(--navy)' }}>
                      No se encontraron ventas
                    </strong>
                    <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                      Intenta ajustar los filtros de búsqueda o registra una nueva venta en el sistema.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              sales.map((sale) => {
                const { date, time } = formatDate(sale.date)
                const isMenuOpen = activeMenuId === sale.id

                return (
                  <tr
                    key={sale.id}
                    className="clickable-row"
                    onClick={() => onViewDetail(sale)}
                    style={{ opacity: sale.status === 'CANCELLED' ? 0.7 : 1 }}
                  >
                    {/* 1. Número Venta */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 12 }}>
                          {sale.saleNumber}
                        </span>
                      </div>
                    </td>

                    {/* 2. Fecha */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{date}</span>
                        <small style={{ fontSize: 10, color: 'var(--muted)' }}>{time}</small>
                      </div>
                    </td>

                    {/* 3. Cliente */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 210 }}>
                        <strong
                          style={{
                            fontSize: 12,
                            color: 'var(--navy)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={sale.customerName}
                        >
                          {sale.customerName}
                        </strong>
                        <small style={{ fontSize: 11, color: 'var(--muted)' }}>
                          {sale.customerDoc}
                        </small>
                      </div>
                    </td>

                    {/* 4. Bodega */}
                    <td>
                      <span style={{ fontSize: 12, color: '#334155' }}>{sale.locationName}</span>
                    </td>

                    {/* 5. Vendedor */}
                    <td>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{sale.sellerName}</span>
                    </td>

                    {/* 6. Productos */}
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className="custom-badge"
                        style={{ background: '#f1f5f9', color: '#475569', fontSize: 11 }}
                        title={`${sale.itemsCount} productos (${sale.totalUnits} unidades)`}
                      >
                        {sale.itemsCount} prod ({sale.totalUnits}u)
                      </span>
                    </td>

                    {/* 7. Total */}
                    <td style={{ textAlign: 'right' }}>
                      <strong
                        style={{
                          fontSize: 13,
                          color: sale.status === 'CANCELLED' ? 'var(--muted)' : 'var(--navy)',
                        }}
                      >
                        {formatCOP(sale.totalAmount)}
                      </strong>
                    </td>

                    {/* 8. Estado */}
                    <td style={{ textAlign: 'center' }}>{getStatusBadge(sale.status)}</td>

                    {/* 9. Documento */}
                    <td style={{ textAlign: 'center' }}>
                      {getDocumentBadge(sale.documentType, sale.invoiceNumber, sale.remissionNumber)}
                    </td>

                    {/* 10. Acciones Menu */}
                    <td
                      style={{ textAlign: 'center', position: 'relative' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() =>
                          setActiveMenuId(isMenuOpen ? null : sale.id)
                        }
                        aria-label="Opciones de venta"
                        style={{ margin: '0 auto' }}
                      >
                        <AppIcon name="more" size={16} />
                      </button>

                      {isMenuOpen && (
                        <div
                          ref={menuRef}
                          className="custom-select-menu"
                          style={{
                            position: 'absolute',
                            right: 8,
                            top: 36,
                            minWidth: 180,
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
                              onViewDetail(sale)
                            }}
                          >
                            <AppIcon name="eye" size={13} color="var(--navy)" />
                            <span>Ver Detalle</span>
                          </button>

                          {!sale.invoiceId && sale.status !== 'CANCELLED' && (
                            <button
                              type="button"
                              className="custom-select-option"
                              onClick={() => {
                                setActiveMenuId(null)
                                onGenerateInvoice(sale)
                              }}
                            >
                              <AppIcon name="invoices" size={13} color="var(--navy)" />
                              <span>Generar Factura</span>
                            </button>
                          )}

                          {!sale.remissionId && sale.status !== 'CANCELLED' && (
                            <button
                              type="button"
                              className="custom-select-option"
                              onClick={() => {
                                setActiveMenuId(null)
                                onGenerateRemission(sale)
                              }}
                            >
                              <AppIcon name="remisiones" size={13} color="var(--navy)" />
                              <span>Crear Remisión</span>
                            </button>
                          )}

                          {onViewKardex && (
                            <button
                              type="button"
                              className="custom-select-option"
                              onClick={() => {
                                setActiveMenuId(null)
                                onViewKardex(sale)
                              }}
                            >
                              <AppIcon name="kardex" size={13} color="var(--navy)" />
                              <span>Ver en Kardex</span>
                            </button>
                          )}

                          {sale.status !== 'CANCELLED' && (
                            <button
                              type="button"
                              className="custom-select-option"
                              style={{ color: 'var(--red)' }}
                              onClick={() => {
                                setActiveMenuId(null)
                                onCancelSale(sale)
                              }}
                            >
                              <AppIcon name="close" size={13} color="var(--red)" />
                              <span>Anular Venta</span>
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!loading && total > 0 && (
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            fontSize: 12,
            color: 'var(--muted)',
          }}
        >
          <div>
            Mostrando <strong>{(page - 1) * pageSize + 1}</strong> a{' '}
            <strong>{Math.min(page * pageSize, total)}</strong> de{' '}
            <strong>{total}</strong> ventas registradas
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className="icon-button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              aria-label="Página anterior"
              style={{ width: 30, height: 30 }}
            >
              <AppIcon name="chevronLeft" size={14} />
            </button>

            <span style={{ padding: '0 8px', fontWeight: 600, color: 'var(--navy)' }}>
              Página {page} de {totalPages}
            </span>

            <button
              type="button"
              className="icon-button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              aria-label="Página siguiente"
              style={{ width: 30, height: 30 }}
            >
              <AppIcon name="chevronRight" size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
