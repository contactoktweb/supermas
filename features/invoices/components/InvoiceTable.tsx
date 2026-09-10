'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { DIANStatusBadge, InvoiceTypeBadge, InvoiceStatusBadge } from './DIANStatusBadge'
import { Invoice } from '../types'

interface InvoiceTableProps {
  invoices: Invoice[]
  loading: boolean
  error: string | null
  total: number
  page: number
  pageSize: number
  onPageChange: (p: number) => void
  onPageSizeChange?: (s: number) => void
  onViewDetail: (inv: Invoice) => void
  onSendToDIAN: (invoiceId: string) => Promise<any>
  onOpenCreditNote: (inv: Invoice) => void
  onOpenCancel: (inv: Invoice) => void
  onOpenXml: (inv: Invoice) => void
  onRetryFetch?: () => void
}

export function InvoiceTable({
  invoices,
  loading,
  error,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onViewDetail,
  onSendToDIAN,
  onOpenCreditNote,
  onOpenCancel,
  onOpenXml,
  onRetryFetch,
}: InvoiceTableProps) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const [transmittingId, setTransmittingId] = useState<string | null>(null)

  const totalPages = Math.ceil(total / pageSize) || 1

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val)
  }

  const handleDownloadPDF = (inv: Invoice) => {
    // Generar representación impresa rápida
    window.print()
  }

  const handleDIANAction = async (inv: Invoice) => {
    try {
      setTransmittingId(inv.id)
      await onSendToDIAN(inv.id)
      setActiveMenuId(null)
    } catch (err: any) {
      alert(err.message || 'Error al transmitir a la DIAN')
    } finally {
      setTransmittingId(null)
    }
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
            Cargando facturas y comprobantes...
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
            No se pudieron cargar las facturas
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
      {!loading && !error && invoices.length === 0 && (
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
            <AppIcon name="invoices" size={28} color="#94a3b8" />
          </div>
          <p style={{ color: 'var(--navy)', fontWeight: 700, fontSize: 16 }}>
            No se encontraron facturas
          </p>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4, maxWidth: 360, margin: '4px auto 0' }}>
            No hay comprobantes que coincidan con los filtros seleccionados o no se han emitido facturas aún.
          </p>
        </div>
      )}

      {/* Data Table */}
      {!loading && !error && invoices.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 140 }}>N° Factura</th>
                <th style={{ minWidth: 130 }}>Fecha Emisión</th>
                <th style={{ minWidth: 190 }}>Cliente</th>
                <th style={{ minWidth: 120 }}>Tipo</th>
                <th style={{ minWidth: 110 }}>Venta Ref.</th>
                <th style={{ minWidth: 120, textAlign: 'right' }}>Total</th>
                <th style={{ minWidth: 110, textAlign: 'center' }}>Estado</th>
                <th style={{ minWidth: 140, textAlign: 'center' }}>Estado DIAN</th>
                <th style={{ minWidth: 120 }}>Usuario / Caja</th>
                <th style={{ minWidth: 90, textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const isTransmitting = transmittingId === inv.id
                return (
                  <tr
                    key={inv.id}
                    onClick={() => onViewDetail(inv)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Número Factura */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span
                          style={{
                            fontWeight: 700,
                            color: 'var(--navy)',
                            fontSize: 13,
                          }}
                        >
                          {inv.invoiceNumber}
                        </span>
                        {inv.resolutionNumber && (
                          <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                            Res. {inv.resolutionNumber}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Fecha */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#1e293b' }}>
                          {new Date(inv.date).toLocaleDateString('es-CO', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                          {inv.issuedAtBogota ||
                            new Date(inv.date).toLocaleTimeString('es-CO', {
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
                            maxWidth: 180,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {inv.customerName}
                        </strong>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                          {inv.customerDocType || 'NIT/CC'}: {inv.customerDoc}
                        </span>
                      </div>
                    </td>

                    {/* Tipo Documento */}
                    <td>
                      <InvoiceTypeBadge type={inv.type} size="sm" />
                    </td>

                    {/* Venta Relacionada */}
                    <td>
                      {inv.saleNumber ? (
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
                          {inv.saleNumber}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>—</span>
                      )}
                    </td>

                    {/* Total */}
                    <td style={{ textAlign: 'right' }}>
                      <strong
                        style={{
                          fontSize: 13,
                          color: inv.type === 'NOTA_CREDITO' ? 'var(--red)' : 'var(--navy)',
                        }}
                      >
                        {inv.type === 'NOTA_CREDITO' ? `-${formatCOP(inv.total)}` : formatCOP(inv.total)}
                      </strong>
                    </td>

                    {/* Estado Comercial */}
                    <td style={{ textAlign: 'center' }}>
                      <InvoiceStatusBadge status={inv.status} size="sm" />
                    </td>

                    {/* Estado DIAN */}
                    <td style={{ textAlign: 'center' }}>
                      <DIANStatusBadge status={inv.dianStatus} size="sm" />
                    </td>

                    {/* Usuario */}
                    <td>
                      <span
                        style={{
                          fontSize: 11,
                          color: '#475569',
                          maxWidth: 110,
                          display: 'inline-block',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {inv.sellerName || 'Sistema'}
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
                          title="Ver detalle de factura"
                          onClick={() => onViewDetail(inv)}
                          style={{ width: 30, height: 30 }}
                        >
                          <AppIcon name="eye" size={15} />
                        </button>

                        {/* DIAN Quick Action */}
                        {inv.type === 'ELECTRONICA' && inv.dianStatus !== 'ACEPTADA' && inv.status !== 'CANCELLED' && (
                          <button
                            type="button"
                            className="icon-button"
                            title="Transmitir a la DIAN"
                            onClick={() => handleDIANAction(inv)}
                            disabled={isTransmitting}
                            style={{
                              width: 30,
                              height: 30,
                              color: '#d97706',
                              borderColor: 'rgba(245, 158, 11, 0.3)',
                            }}
                          >
                            <AppIcon
                              name="refresh"
                              size={14}
                              className={isTransmitting ? 'spin' : ''}
                            />
                          </button>
                        )}

                        {/* More Menu Trigger */}
                        <button
                          type="button"
                          className="icon-button"
                          title="Más opciones"
                          onClick={() => setActiveMenuId(activeMenuId === inv.id ? null : inv.id)}
                          style={{ width: 30, height: 30 }}
                        >
                          <AppIcon name="more" size={15} />
                        </button>

                        {/* Dropdown Menu */}
                        {activeMenuId === inv.id && (
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
                                  onViewDetail(inv)
                                }}
                              >
                                <AppIcon name="eye" size={14} /> Ver comprobante
                              </button>

                              {/* Descargar PDF */}
                              <button
                                type="button"
                                style={dropdownItemStyle}
                                onClick={() => {
                                  setActiveMenuId(null)
                                  handleDownloadPDF(inv)
                                }}
                              >
                                <AppIcon name="print" size={14} /> Imprimir / PDF
                              </button>

                              {/* Ver / Descargar XML */}
                              {inv.type === 'ELECTRONICA' && (
                                <button
                                  type="button"
                                  style={dropdownItemStyle}
                                  onClick={() => {
                                    setActiveMenuId(null)
                                    onOpenXml(inv)
                                  }}
                                >
                                  <AppIcon name="terminal" size={14} /> Estructura XML DIAN
                                </button>
                              )}

                              {/* Enviar DIAN / Reintentar */}
                              {inv.type === 'ELECTRONICA' && inv.dianStatus !== 'ACEPTADA' && inv.status !== 'CANCELLED' && (
                                <button
                                  type="button"
                                  style={{ ...dropdownItemStyle, color: '#d97706' }}
                                  onClick={() => handleDIANAction(inv)}
                                >
                                  <AppIcon name="refresh" size={14} /> Reintentar DIAN
                                </button>
                              )}

                              {/* Separator */}
                              <div style={{ height: 1, background: '#f1f5f9', margin: '4px 0' }} />

                              {/* Emitir Nota Crédito */}
                              {inv.status !== 'CANCELLED' && inv.type !== 'NOTA_CREDITO' && (
                                <button
                                  type="button"
                                  style={dropdownItemStyle}
                                  onClick={() => {
                                    setActiveMenuId(null)
                                    onOpenCreditNote(inv)
                                  }}
                                >
                                  <AppIcon name="receipt" size={14} color="var(--navy)" />
                                  Emitir Nota Crédito
                                </button>
                              )}

                              {/* Anular Factura */}
                              {inv.status !== 'CANCELLED' && (
                                <button
                                  type="button"
                                  style={{ ...dropdownItemStyle, color: 'var(--red)' }}
                                  onClick={() => {
                                    setActiveMenuId(null)
                                    onOpenCancel(inv)
                                  }}
                                >
                                  <AppIcon name="trash" size={14} color="var(--red)" />
                                  Anular Factura
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
      {!loading && !error && invoices.length > 0 && (
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
            <strong>{total}</strong> facturas
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
