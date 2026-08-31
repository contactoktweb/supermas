'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { Transfer } from '../types'
import { getTransferStatusBadge } from './TransferTable'

interface TransferFlowViewProps {
  transfers: Transfer[]
  onSelectTransfer: (transfer: Transfer) => void
  onDispatchTransfer?: (transfer: Transfer) => void
  onReceiveTransfer?: (transfer: Transfer) => void
}

export function TransferFlowView({
  transfers,
  onSelectTransfer,
  onDispatchTransfer,
  onReceiveTransfer,
}: TransferFlowViewProps) {
  const formatDateTime = (isoString: string) => {
    const d = new Date(isoString)
    return d.toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }

  return (
    <div className="transfer-flow-container page-enter" aria-label="Vista de flujo logístico">
      <div className="flow-grid-header" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AppIcon name="transfers" size={18} color="var(--navy)" />
          <strong style={{ fontSize: 15, color: 'var(--navy)' }}>
            Rutas y Flujos de Mercancía Activos
          </strong>
        </div>
        <span className="count-tag-pill">{transfers.length} rutas en visualización</span>
      </div>

      <div className="flow-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 16 }}>
        {transfers.map((t, idx) => {
          const totalUnits =
            t.status === 'RECEIVED'
              ? t.totalUnitsReceived
              : t.totalUnitsDispatched || t.totalUnitsRequested

          return (
            <article
              key={t.id}
              className={`flow-route-card page-enter status-${t.status.toLowerCase()}`}
              style={{
                animationDelay: `${idx * 0.06}s`,
                background: '#fff',
                border: '1px solid var(--border-color)',
                borderRadius: 14,
                padding: '18px 20px',
                boxShadow: '0 2px 8px rgba(0,27,92,0.04)',
                cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
              }}
              onClick={() => onSelectTransfer(t)}
            >
              {/* Top Row: Code & Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="source-doc-badge">
                    <AppIcon name="transfers" size={13} />
                    <strong>{t.code}</strong>
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {formatDateTime(t.createdAt)}
                  </span>
                </div>
                {getTransferStatusBadge(t.status, t.hasIncident)}
              </div>

              {/* Flow Visualization: Origin -> Arrow -> Destination */}
              <div
                className="flow-route-visual"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#f8fafc',
                  padding: '14px 16px',
                  borderRadius: 10,
                  marginBottom: 14,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Origin Box */}
                <div className="flow-location-node" style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700 }}>
                    Origen
                  </span>
                  <strong
                    style={{
                      display: 'block',
                      fontSize: 13,
                      color: 'var(--text-main)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {t.originLocationName}
                  </strong>
                  <small className="location-code-tag">{t.originLocationCode}</small>
                </div>

                {/* Animated Arrow Connector */}
                <div
                  className="flow-arrow-connector"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '0 12px',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--navy)',
                      background: '#e0e7ff',
                      padding: '2px 8px',
                      borderRadius: 12,
                      marginBottom: 4,
                    }}
                  >
                    {totalUnits} uds
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      color: t.status === 'IN_TRANSIT' ? 'var(--blue)' : 'var(--navy)',
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 2,
                        background: 'currentColor',
                        borderRadius: 1,
                      }}
                    />
                    <AppIcon name="arrowRight" size={14} />
                  </div>
                </div>

                {/* Destination Box */}
                <div className="flow-location-node" style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                  <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--navy)', fontWeight: 700 }}>
                    Destino
                  </span>
                  <strong
                    style={{
                      display: 'block',
                      fontSize: 13,
                      color: 'var(--navy)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {t.destinationLocationName}
                  </strong>
                  <small className="location-code-tag">{t.destinationLocationCode}</small>
                </div>
              </div>

              {/* Items Summary & Responsible */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AppIcon name="products" size={14} color="#64748b" />
                  <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>
                    {t.items[0]?.productName}
                    {t.items.length > 1 && ` (+${t.items.length - 1} más)`}
                  </span>
                </div>

                <div
                  style={{ display: 'flex', gap: 8, alignItems: 'center' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {t.status === 'PENDING' && onDispatchTransfer && (
                    <button
                      type="button"
                      className="outline-button compact"
                      onClick={() => onDispatchTransfer(t)}
                      style={{ fontSize: 11, padding: '4px 8px' }}
                    >
                      <AppIcon name="transfers" size={12} />
                      <span>Despachar</span>
                    </button>
                  )}

                  {t.status === 'IN_TRANSIT' && onReceiveTransfer && (
                    <button
                      type="button"
                      className="primary-button compact"
                      onClick={() => onReceiveTransfer(t)}
                      style={{ fontSize: 11, padding: '4px 8px' }}
                    >
                      <AppIcon name="check" size={12} />
                      <span>Recibir</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => onSelectTransfer(t)}
                    title="Ver detalle"
                  >
                    <AppIcon name="chevronRight" size={14} />
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
