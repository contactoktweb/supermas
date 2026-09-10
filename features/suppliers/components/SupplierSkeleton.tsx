'use client'

import React from 'react'

export function SupplierStatsSkeleton() {
  return (
    <div className="stats-grid products-stats-grid page-enter" aria-busy="true">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="dashboard-kpi-card tone-blue skeleton-pulse" style={{ minHeight: 128 }}>
          <div className="kpi-card-header">
            <div className="skeleton-line" style={{ width: 36, height: 36, borderRadius: 10 }} />
            <div className="skeleton-line" style={{ width: 64, height: 18, borderRadius: 6 }} />
          </div>
          <div className="kpi-card-body" style={{ marginTop: 12 }}>
            <div className="skeleton-line" style={{ width: '60%', height: 14, marginBottom: 8 }} />
            <div className="skeleton-line" style={{ width: '85%', height: 26 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SupplierTableSkeleton() {
  return (
    <div className="table-responsive page-enter" aria-busy="true">
      <table className="products-table">
        <thead>
          <tr>
            <th>Nombre Proveedor</th>
            <th>Documento / NIT</th>
            <th>Contacto</th>
            <th>Teléfono</th>
            <th>Email</th>
            <th>Ciudad</th>
            <th>Compras</th>
            <th>Última Compra</th>
            <th>Saldo Pendiente</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4, 5].map((row) => (
            <tr key={row} className="skeleton-pulse">
              <td><div className="skeleton-line" style={{ width: 140, height: 16 }} /></td>
              <td><div className="skeleton-line" style={{ width: 100, height: 16 }} /></td>
              <td><div className="skeleton-line" style={{ width: 110, height: 16 }} /></td>
              <td><div className="skeleton-line" style={{ width: 95, height: 16 }} /></td>
              <td><div className="skeleton-line" style={{ width: 130, height: 16 }} /></td>
              <td><div className="skeleton-line" style={{ width: 80, height: 16 }} /></td>
              <td><div className="skeleton-line" style={{ width: 50, height: 16 }} /></td>
              <td><div className="skeleton-line" style={{ width: 85, height: 16 }} /></td>
              <td><div className="skeleton-line" style={{ width: 80, height: 16 }} /></td>
              <td><div className="skeleton-line" style={{ width: 70, height: 22, borderRadius: 12 }} /></td>
              <td><div className="skeleton-line" style={{ width: 60, height: 28, borderRadius: 6 }} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
