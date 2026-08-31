'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { Transfer, UserPermissionContext } from '../types'
import { getTransferStatusBadge } from './TransferTable'

interface TransferDetailDrawerProps {
  transfer: Transfer | null
  isOpen: boolean
  isCostRedacted: boolean
  userContext?: UserPermissionContext
  onClose: () => void
  onDispatch?: (transfer: Transfer) => void
  onReceive?: (transfer: Transfer) => void
  onReject?: (transfer: Transfer) => void
  onViewKardex?: (transferCode: string) => void
}

export function TransferDetailDrawer({
  transfer,
  isOpen,
  isCostRedacted,
  userContext,
  onClose,
  onDispatch,
  onReceive,
  onReject,
  onViewKardex,
}: TransferDetailDrawerProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isOpen || !transfer || !mounted) return null

  const formatFullDate = (isoString?: string) => {
    if (!isoString) return '—'
    const d = new Date(isoString)
    return d.toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }

  const isPending = transfer.status === 'PENDING'
  const isInTransit = transfer.status === 'IN_TRANSIT'
  const isReceived = transfer.status === 'RECEIVED'
  const isRejected = transfer.status === 'REJECTED'

  return createPortal(
    <div
      className="drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="product-drawer product-detail-drawer page-enter"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 680 }}
      >
        {/* Drawer Header */}
        <div className="drawer-header product-detail-header-v2">
          <div className="product-detail-hero-layout">
            <div className="stat-icon blue" style={{ width: 44, height: 44, borderRadius: 12 }}>
              <AppIcon name="transfers" size={24} />
            </div>

            <div className="product-detail-header-info">
              <span className="product-category-eyebrow">
                Traslado de Inventario · {transfer.code}
              </span>
              <h2 className="product-title-heading" style={{ fontSize: 18, margin: '2px 0 6px' }}>
                {transfer.originLocationName} → {transfer.destinationLocationName}
              </h2>
              <div className="detail-badges-row">
                <span className="code-badge">{transfer.code}</span>
                {getTransferStatusBadge(transfer.status, transfer.hasIncident)}
                <span className="count-tag-pill">{transfer.totalUnitsRequested} unidades</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar detalle"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="detail-tab-body" style={{ paddingTop: 18 }}>
          {/* 1. Stepper Animado del Ciclo de Vida */}
          <div className="drawer-section" style={{ padding: '0 0 16px' }}>
            <h4 style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--navy)' }}>
              1. Estado y Trazabilidad del Flujo
            </h4>

            {isRejected ? (
              <div className="incident-alert-banner" style={{ background: '#fef2f2', borderColor: '#fca5a5', padding: '12px 14px', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626', marginBottom: 4 }}>
                  <AppIcon name="close" size={16} />
                  <strong>Transferencia Rechazada / Cancelada</strong>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#991b1b' }}>
                  <strong>Motivo:</strong> {transfer.rejectionReason || 'Cancelada antes del despacho.'}
                </p>
                <small style={{ display: 'block', marginTop: 4, color: '#b91c1c' }}>
                  Rechazada por {transfer.rejectedByUserName} el {formatFullDate(transfer.rejectedAt)}
                </small>
              </div>
            ) : (
              <div className="transfer-stepper-track" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '14px 18px', borderRadius: 10 }}>
                {/* Step 1: Creada */}
                <div className={`stepper-node completed`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--green)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                    ✓
                  </div>
                  <div>
                    <strong style={{ display: 'block', fontSize: 12, color: 'var(--text-main)' }}>Creada</strong>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>{formatFullDate(transfer.createdAt)}</span>
                  </div>
                </div>

                <div style={{ flex: 1, height: 2, background: isInTransit || isReceived ? 'var(--green)' : '#cbd5e1', margin: '0 12px' }} />

                {/* Step 2: Despachada / En tránsito */}
                <div className={`stepper-node ${isInTransit || isReceived ? 'completed' : 'pending'}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: isInTransit ? 'var(--blue)' : isReceived ? 'var(--green)' : '#cbd5e1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                    {isReceived ? '✓' : '2'}
                  </div>
                  <div>
                    <strong style={{ display: 'block', fontSize: 12, color: isInTransit ? 'var(--blue)' : 'var(--text-main)' }}>
                      {isInTransit ? 'En tránsito' : 'Despachada'}
                    </strong>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                      {transfer.dispatchedAt ? formatFullDate(transfer.dispatchedAt) : 'Pendiente'}
                    </span>
                  </div>
                </div>

                <div style={{ flex: 1, height: 2, background: isReceived ? 'var(--green)' : '#cbd5e1', margin: '0 12px' }} />

                {/* Step 3: Recibida */}
                <div className={`stepper-node ${isReceived ? 'completed' : 'pending'}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: isReceived ? 'var(--green)' : '#cbd5e1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                    {isReceived ? '✓' : '3'}
                  </div>
                  <div>
                    <strong style={{ display: 'block', fontSize: 12, color: isReceived ? 'var(--green)' : 'var(--text-main)' }}>
                      Recibida
                    </strong>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                      {transfer.receivedAt ? formatFullDate(transfer.receivedAt) : 'Pendiente'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. Productos Transferidos */}
          <div className="drawer-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontSize: 13, color: 'var(--navy)' }}>
                2. Productos y Existencias a Trasladar
              </h4>
              <span className="count-tag-pill">{transfer.items.length} artículos</span>
            </div>

            <div className="table-panel products-table-panel" style={{ margin: 0, border: '1px solid var(--border-color)' }}>
              <div className="table-scroll" style={{ maxHeight: 220 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>SKU</th>
                      <th style={{ textAlign: 'right' }}>Solicitadas</th>
                      <th style={{ textAlign: 'right' }}>Despachadas</th>
                      <th style={{ textAlign: 'right' }}>Recibidas</th>
                      {transfer.hasIncident && <th>Novedad</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {transfer.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="product-cell">
                            <div className="product-thumb">
                              {item.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.imageUrl}
                                  alt={item.productName}
                                  style={{ width: 30, height: 30, borderRadius: 6, objectFit: 'cover' }}
                                />
                              ) : (
                                <AppIcon name="products" size={16} />
                              )}
                            </div>
                            <div>
                              <strong>{item.productName}</strong>
                              <span>{item.category}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="code-badge">{item.sku}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <strong>{item.requestedUnits} {item.unitOfMeasure}</strong>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{ color: 'var(--navy)' }}>
                            {item.dispatchedUnits} {item.unitOfMeasure}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <strong style={{ color: item.hasDiscrepancy ? 'var(--red)' : 'var(--green)' }}>
                            {item.receivedUnits} {item.unitOfMeasure}
                          </strong>
                        </td>
                        {transfer.hasIncident && (
                          <td>
                            {item.hasDiscrepancy ? (
                              <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>
                                {item.discrepancyNote}
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, color: 'var(--green)' }}>Conforme</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 3. Ficha de Responsables y Auditoría */}
          <div className="drawer-section">
            <h4 style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--navy)' }}>
              3. Datos Logísticos y Auditoría
            </h4>

            <div className="info-list-grid">
              <div className="info-kv-item">
                <span>Bodega Origen:</span>
                <strong>{transfer.originLocationName} ({transfer.originLocationCode})</strong>
              </div>

              <div className="info-kv-item">
                <span>Bodega Destino:</span>
                <strong>{transfer.destinationLocationName} ({transfer.destinationLocationCode})</strong>
              </div>

              <div className="info-kv-item">
                <span>Creado por:</span>
                <strong>{transfer.createdByUserName} ({transfer.createdByUserRole})</strong>
              </div>

              {transfer.dispatchedByUserName && (
                <div className="info-kv-item">
                  <span>Despachado por:</span>
                  <strong>{transfer.dispatchedByUserName}</strong>
                </div>
              )}

              {transfer.receivedByUserName && (
                <div className="info-kv-item">
                  <span>Recibido por:</span>
                  <strong>{transfer.receivedByUserName}</strong>
                </div>
              )}

              <div className="info-kv-item">
                <span>Valorización (RBAC):</span>
                <strong>
                  {isCostRedacted ? '••••••••' : `$${transfer.totalValueAtCost.toLocaleString('es-CO')}`}
                </strong>
              </div>
            </div>

            {transfer.notes && (
              <div className="doc-notes-box" style={{ marginTop: 12 }}>
                <strong>Observaciones / Justificación:</strong>
                <p style={{ margin: '4px 0 0', fontSize: 12 }}>{transfer.notes}</p>
              </div>
            )}

            {transfer.incidentNotes && (
              <div className="incident-alert-banner" style={{ background: '#fffbeb', borderColor: '#fde68a', marginTop: 12, padding: 12, borderRadius: 8 }}>
                <strong style={{ color: '#b45309', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AppIcon name="warning" size={14} /> Reporte de Novedad en Traslado:
                </strong>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#92400e', whiteSpace: 'pre-line' }}>
                  {transfer.incidentNotes}
                </p>
              </div>
            )}
          </div>

          {/* 4. Enlace al Kardex */}
          <div className="drawer-section" style={{ borderBottom: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#eff6ff',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #bfdbfe',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AppIcon name="kardex" size={18} color="var(--navy)" />
                <div>
                  <strong style={{ fontSize: 12, color: 'var(--navy)' }}>
                    Trazabilidad de Movimientos en Kardex
                  </strong>
                  <p style={{ margin: 0, fontSize: 11, color: '#1e40af' }}>
                    Consulta los registros inmutables TRANSFER_OUT y TRANSFER_IN generados por este traslado.
                  </p>
                </div>
              </div>

              <a
                href={`/kardex?query=${transfer.code}`}
                className="outline-button compact"
                onClick={(e) => {
                  if (onViewKardex) {
                    e.preventDefault()
                    onViewKardex(transfer.code)
                  }
                }}
                style={{ borderColor: 'var(--navy)', color: 'var(--navy)' }}
              >
                <span>Ver Kardex</span>
                <AppIcon name="arrowUpRight" size={12} />
              </a>
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="detail-drawer-footer" style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
          <button
            type="button"
            className="outline-button"
            onClick={onClose}
          >
            Cerrar
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            {isPending && onReject && (
              <button
                type="button"
                className="danger-button"
                onClick={() => onReject(transfer)}
              >
                <AppIcon name="close" size={14} />
                <span>Rechazar</span>
              </button>
            )}

            {isPending && onDispatch && (
              <button
                type="button"
                className="primary-button"
                onClick={() => onDispatch(transfer)}
              >
                <AppIcon name="transfers" size={14} />
                <span>Despachar orden</span>
              </button>
            )}

            {isInTransit && onReceive && (
              <button
                type="button"
                className="primary-button"
                onClick={() => onReceive(transfer)}
              >
                <AppIcon name="check" size={14} />
                <span>Recibir transferencia</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
