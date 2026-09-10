'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomerRemissionSummary } from '../../../types'

interface CustomerRemissionsTabProps {
  remissions: CustomerRemissionSummary[]
}

function formatDate(isoString: string): string {
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

export function CustomerRemissionsTab({ remissions }: CustomerRemissionsTabProps) {
  if (remissions.length === 0) {
    return (
      <div className="table-empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 48,
            height: 48,
            borderRadius: 12,
            background: '#e9eef8',
            color: 'var(--navy)',
            margin: '0 auto 12px',
          }}
        >
          <AppIcon name="remisiones" size={24} />
        </div>
        <strong style={{ fontSize: 14 }}>No hay remisiones de entrega</strong>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
          Este cliente no cuenta con remisiones de despacho registradas.
        </p>
      </div>
    )
  }

  return (
    <div className="page-enter">
      <div className="table-panel products-table-panel" style={{ margin: 0 }}>
        <div className="table-scroll">
          <table aria-label="Remisiones del cliente">
            <thead>
              <tr>
                <th>N° Remisión</th>
                <th>Fecha Despacho</th>
                <th>Bodega Origen</th>
                <th>Transportador / Conductor</th>
                <th>Items / Unidades</th>
                <th>Recibido Por</th>
                <th style={{ textAlign: 'center' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {remissions.map((rem) => (
                <tr key={rem.id}>
                  <td>
                    <strong className="mono" style={{ color: 'var(--navy)' }}>
                      {rem.remissionNumber}
                    </strong>
                  </td>
                  <td>
                    <span style={{ fontSize: 12 }}>{formatDate(rem.date)}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: 12 }}>{rem.locationName}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{rem.driverName || 'Conductor asignado'}</span>
                      <small style={{ fontSize: 10, color: 'var(--muted)' }}>{rem.deliveredBy}</small>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: 12 }}>
                      {rem.itemsCount} productos ({rem.totalUnits} uds)
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: 12, color: '#334155' }}>
                      {rem.receivedBy || 'Firma de entrega'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="state disponible">
                      <AppIcon name="check" size={11} />
                      <span>{rem.status === 'DELIVERED' ? 'Entregado' : 'En tránsito'}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
