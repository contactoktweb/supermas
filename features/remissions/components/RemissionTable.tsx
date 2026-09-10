'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { RemissionStatusBadge } from './RemissionStatusBadge'
import { Remission } from '../types'

interface RemissionTableProps {
  remissions: Remission[]
  loading: boolean
  error: string | null
  total: number
  page: number
  pageSize: number
  onPageChange: (p: number) => void
  onViewDetail: (rem: Remission) => void
  onOpenDispatch: (rem: Remission) => void
  onOpenDeliver: (rem: Remission) => void
  onOpenCancel: (rem: Remission) => void
  onGenerateInvoice?: (rem: Remission) => void
  onRetryFetch?: () => void
}

export function RemissionTable({
  remissions,
  loading,
  error,
  total,
  page,
  pageSize,
  onPageChange,
  onViewDetail,
  onOpenDispatch,
  onOpenDeliver,
  onOpenCancel,
  onGenerateInvoice,
  onRetryFetch,
}: RemissionTableProps) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

  const totalPages = Math.ceil(total / pageSize) || 1

  const handleDownloadPDF = (rem: Remission) => {
    window.print()
  }

  return (
    <div className="table-panel animated-table page-enter">
      {/* Loading state */}
      {loading && (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-block',
              width: 32,
              height: 32,
              border: '3px solid rgba(0, 27, 92, 0.1)',
              borderTopColor: 'var(--navy)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <p style={{ marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>
            Cargando remisiones de entrega...
          </p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: '#fef2f2',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <AppIcon name="warning" size={24} color="var(--red)" />
          </div>
          <p style={{ color: 'var(--navy)', fontWeight: 700, fontSize: 15 }}>
            No se pudieron cargar las remisiones
          </p>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{error}</p>
          {onRetryFetch && (
            <button
              type="button"
              className="primary-button compact"
              onClick={onRetryFetch}
              style={{ marginTop: 14 }}
            >
              <AppIcon name="refresh" size={14} /> Reintentar
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && remissions.length === 0 && (
        <div style={{ padding: '50px 20px', textAlign: 'center' }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: '#f1f5f9',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
            }}
          >
            <AppIcon name="remisiones" size={28} color="#94a3b8" />
          </div>
          <p style={{ color: 'var(--navy)', fontWeight: 700, fontSize: 16 }}>
            No se encontraron remisiones
          </p>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4, maxWidth: 360, margin: '4px auto 0' }}>
            No hay remisiones que coincidan con los filtros seleccionados o no se han emitido órdenes de entrega aún.
          </p>
        </div>
      )}

      {/* Data Table */}
      {!loading && !error && remissions.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 140 }}>N° Remisión</th>
                <th style={{ minWidth: 120 }}>Fecha</th>
                <th style={{ minWidth: 180 }}>Cliente</th>
                <th style={{ minWidth: 110 }}>Venta Ref.</th>
                <th style={{ minWidth: 150 }}>Bodega Origen</th>
                <th style={{ minWidth: 110, textAlign: 'center' }}>Productos</th>
                <th style={{ minWidth: 130, textAlign: 'center' }}>Estado</th>
                <th style={{ minWidth: 150 }}>Conductor / Placa</th>
                <th style={{ minWidth: 110 }}>Usuario</th>
                <th style={{ minWidth: 90, textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {remissions.map((rem) => {
                return (
                  <tr
                    key={rem.id}
                    onClick={() => onViewDetail(rem)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* N° Remisión */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <strong
                          style={{
                            fontWeight: 700,
                            color: 'var(--navy)',
                            fontSize: 13,
                          }}
                        >
                          {rem.remissionNumber}
                        </strong>
                        {rem.invoiceNumber && (
                          <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 600 }}>
                            Factura: {rem.invoiceNumber}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Fecha */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#1e293b' }}>
                          {new Date(rem.date).toLocaleDateString('es-CO', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                          {new Date(rem.date).toLocaleTimeString('es-CO', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </td>

                    {/* Cliente */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <strong
                          style={{
                            fontSize: 12,
                            color: 'var(--navy)',
                            maxWidth: 170,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {rem.customerName}
                        </strong>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                          {rem.customerDoc}
                        </span>
                      </div>
                    </td>

                    {/* Venta Relacionada */}
                    <td>
                      {rem.saleNumber ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '2px 6px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            color: 'var(--navy)',
                          }}
                        >
                          {rem.saleNumber}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>—</span>
                      )}
                    </td>

                    {/* Bodega Origen */}
                    <td>
                      <span
                        style={{
                          fontSize: 12,
                          color: '#334155',
                          fontWeight: 500,
                          maxWidth: 140,
                          display: 'inline-block',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {rem.locationName}
                      </span>
                    </td>

                    {/* Productos / Cantidades */}
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: 'var(--navy)',
                        }}
                      >
                        {rem.itemsCount} ítems
                      </span>
                      <small style={{ display: 'block', color: 'var(--muted)', fontSize: 10 }}>
                        {rem.totalUnits} unids
                      </small>
                    </td>

                    {/* Estado */}
                    <td style={{ textAlign: 'center' }}>
                      <RemissionStatusBadge status={rem.status} size="sm" />
                    </td>

                    {/* Conductor / Logística */}
                    <td>
                      {rem.driverName ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: '#1e293b',
                              maxWidth: 140,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {rem.driverName}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                            {rem.vehiclePlate ? `Placa: ${rem.vehiclePlate}` : rem.carrierName}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>Por asignar</span>
                      )}
                    </td>

                    {/* Usuario */}
                    <td>
                      <span
                        style={{
                          fontSize: 11,
                          color: '#475569',
                          maxWidth: 100,
                          display: 'inline-block',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {rem.createdBy || 'Sistema'}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: 4,
                          position: 'relative',
                        }}
                      >
                        {/* Eye Detail */}
                        <button
                          type="button"
                          className="icon-button"
                          title="Ver detalle de remisión"
                          onClick={() => onViewDetail(rem)}
                          style={{ width: 30, height: 30 }}
                        >
                          <AppIcon name="eye" size={15} />
                        </button>

                        {/* Quick Dispatch Action if CREATED or DRAFT */}
                        {(rem.status === 'CREATED' || rem.status === 'DRAFT') && (
                          <button
                            type="button"
                            className="icon-button"
                            title="Despachar remisión"
                            onClick={() => onOpenDispatch(rem)}
                            style={{
                              width: 30,
                              height: 30,
                              color: '#2563eb',
                              borderColor: 'rgba(37, 99, 235, 0.3)',
                            }}
                          >
                            <AppIcon name="transfers" size={14} />
                          </button>
                        )}

                        {/* Quick Deliver Action if DISPATCHED */}
                        {rem.status === 'DISPATCHED' && (
                          <button
                            type="button"
                            className="icon-button"
                            title="Marcar como entregada"
                            onClick={() => onOpenDeliver(rem)}
                            style={{
                              width: 30,
                              height: 30,
                              color: '#16a34a',
                              borderColor: 'rgba(22, 163, 74, 0.3)',
                            }}
                          >
                            <AppIcon name="check" size={14} />
                          </button>
                        )}

                        {/* More Menu Trigger */}
                        <button
                          type="button"
                          className="icon-button"
                          title="Más opciones"
                          onClick={() => setActiveMenuId(activeMenuId === rem.id ? null : rem.id)}
                          style={{ width: 30, height: 30 }}
                        >
                          <AppIcon name="more" size={15} />
                        </button>

                        {/* Dropdown Menu */}
                        {activeMenuId === rem.id && (
                          <>
                            <div
                              style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 100,
                              }}
                              onClick={() => setActiveMenuId(null)}
                            />
                            <div
                              style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                zIndex: 101,
                                background: '#fff',
                                borderRadius: 8,
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                border: '1px solid #cbd5e1',
                                minWidth: 190,
                                padding: '6px 0',
                                marginTop: 4,
                                textAlign: 'left',
                              }}
                            >
                              {/* Ver detalle */}
                              <button
                                type="button"
                                style={dropdownItemStyle}
                                onClick={() => {
                                  setActiveMenuId(null)
                                  onViewDetail(rem)
                                }}
                              >
                                <AppIcon name="eye" size={14} /> Ver documento
                              </button>

                              {/* Despachar */}
                              {(rem.status === 'CREATED' || rem.status === 'DRAFT') && (
                                <button
                                  type="button"
                                  style={{ ...dropdownItemStyle, color: '#2563eb' }}
                                  onClick={() => {
                                    setActiveMenuId(null)
                                    onOpenDispatch(rem)
                                  }}
                                >
                                  <AppIcon name="transfers" size={14} /> Despachar mercancía
                                </button>
                              )}

                              {/* Marcar entregada */}
                              {rem.status === 'DISPATCHED' && (
                                <button
                                  type="button"
                                  style={{ ...dropdownItemStyle, color: '#16a34a' }}
                                  onClick={() => {
                                    setActiveMenuId(null)
                                    onOpenDeliver(rem)
                                  }}
                                >
                                  <AppIcon name="check" size={14} /> Confirmar entrega
                                </button>
                              )}

                              {/* Generar Factura */}
                              {!rem.invoiceNumber && rem.status !== 'CANCELLED' && onGenerateInvoice && (
                                <button
                                  type="button"
                                  style={{ ...dropdownItemStyle, color: 'var(--navy)' }}
                                  onClick={() => {
                                    setActiveMenuId(null)
                                    onGenerateInvoice(rem)
                                  }}
                                >
                                  <AppIcon name="invoices" size={14} color="var(--navy)" /> Generar Factura
                                </button>
                              )}

                              {/* Descargar PDF */}
                              <button
                                type="button"
                                style={dropdownItemStyle}
                                onClick={() => {
                                  setActiveMenuId(null)
                                  handleDownloadPDF(rem)
                                }}
                              >
                                <AppIcon name="print" size={14} /> Imprimir / PDF
                              </button>

                              {/* Separator */}
                              <div style={{ height: 1, background: '#f1f5f9', margin: '4px 0' }} />

                              {/* Anular Remisión */}
                              {rem.status !== 'CANCELLED' && (
                                <button
                                  type="button"
                                  style={{ ...dropdownItemStyle, color: 'var(--red)' }}
                                  onClick={() => {
                                    setActiveMenuId(null)
                                    onOpenCancel(rem)
                                  }}
                                >
                                  <AppIcon name="trash" size={14} color="var(--red)" />
                                  Anular Remisión
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      {!loading && !error && remissions.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderTop: '1px solid #f1f5f9',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Mostrando <strong>{(page - 1) * pageSize + 1}</strong> -{' '}
            <strong>{Math.min(page * pageSize, total)}</strong> de{' '}
            <strong>{total}</strong> remisiones
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className="icon-button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              style={{ width: 32, height: 32 }}
              aria-label="Página anterior"
            >
              <AppIcon name="chevronLeft" size={14} />
            </button>

            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', margin: '0 6px' }}>
              {page} / {totalPages}
            </span>

            <button
              type="button"
              className="icon-button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              style={{ width: 32, height: 32 }}
              aria-label="Página siguiente"
            >
              <AppIcon name="chevronRight" size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const dropdownItemStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 14px',
  background: 'none',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12,
  fontWeight: 600,
  color: '#334155',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'background 0.15s ease',
}
