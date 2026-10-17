'use client'

import React from 'react'

export function PurchaseStatsSkeleton() {
  return (
    <div className="stats-grid products-stats-grid page-enter" aria-busy="true">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="dashboard-kpi-card tone-blue skeleton-card" style={{ minHeight: 128 }}>
          <div className="kpi-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="skeleton-box" style={{ width: 36, height: 36, borderRadius: 10 }} />
            <div className="skeleton-box" style={{ width: 64, height: 18, borderRadius: 6 }} />
          </div>
          <div className="kpi-card-body" style={{ marginTop: 14 }}>
            <div className="skeleton-box" style={{ width: '55%', height: 14, marginBottom: 8 }} />
            <div className="skeleton-box" style={{ width: '80%', height: 26 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function PurchaseTableSkeleton() {
  return (
    <div className="table-panel products-table-panel page-enter" aria-busy="true">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th style={{ minWidth: 140 }}>N° Compra</th>
              <th style={{ minWidth: 140 }}>Factura Prov.</th>
              <th style={{ minWidth: 130 }}>Fecha</th>
              <th style={{ minWidth: 200 }}>Proveedor</th>
              <th style={{ minWidth: 160 }}>Bodega Destino</th>
              <th style={{ minWidth: 120 }}>Tipo Pago</th>
              <th style={{ textAlign: 'right', minWidth: 130 }}>Total</th>
              <th style={{ textAlign: 'right', minWidth: 140 }}>Saldo Pendiente</th>
              <th style={{ minWidth: 130 }}>Estado</th>
              <th style={{ minWidth: 130 }}>Responsable</th>
              <th style={{ width: 140, textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((row) => (
              <tr key={row}>
                <td><div className="skeleton-box" style={{ width: 90, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 80, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 75, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 140, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 110, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 70, height: 22, borderRadius: 12 }} /></td>
                <td><div className="skeleton-box" style={{ width: 85, height: 16, marginLeft: 'auto' }} /></td>
                <td><div className="skeleton-box" style={{ width: 80, height: 16, marginLeft: 'auto' }} /></td>
                <td><div className="skeleton-box" style={{ width: 90, height: 22, borderRadius: 12 }} /></td>
                <td><div className="skeleton-box" style={{ width: 80, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 60, height: 28, borderRadius: 6, margin: '0 auto' }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
