'use client'

import React from 'react'

export function WarehouseStatsSkeleton() {
  return (
    <section className="stats-grid products-stats" aria-label="Cargando estadísticas">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="stat-card skeleton-card">
          <div className="skeleton-box skeleton-icon" />
          <div className="stat-text" style={{ width: '100%' }}>
            <div className="skeleton-box skeleton-line-short" />
            <div className="skeleton-box skeleton-line-title" />
            <div className="skeleton-box skeleton-line-sub" />
          </div>
        </div>
      ))}
    </section>
  )
}

export function WarehouseGridSkeleton() {
  return (
    <div className="warehouse-grid" aria-label="Cargando bodegas">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="warehouse-card skeleton-card" style={{ minHeight: 320 }}>
          <div className="warehouse-card-top">
            <div className="skeleton-box" style={{ width: 120, height: 20 }} />
            <div className="skeleton-box" style={{ width: 70, height: 20 }} />
          </div>
          <div className="warehouse-title" style={{ margin: '20px 0' }}>
            <div className="skeleton-box skeleton-icon" style={{ width: 45, height: 45 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton-box skeleton-line-title" style={{ width: '60%' }} />
              <div className="skeleton-box skeleton-line-short" style={{ width: '40%', marginTop: 6 }} />
            </div>
          </div>
          <div className="warehouse-value" style={{ padding: '15px 0' }}>
            <div className="skeleton-box skeleton-line-short" style={{ width: 100 }} />
            <div className="skeleton-box" style={{ width: 160, height: 30, marginTop: 4 }} />
          </div>
          <div className="warehouse-metrics" style={{ padding: '15px 0' }}>
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j}>
                <div className="skeleton-box skeleton-line-short" />
                <div className="skeleton-box" style={{ width: '80%', height: 16, marginTop: 4 }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function WarehouseTableSkeleton() {
  return (
    <div className="table-panel animated-table" aria-label="Cargando tabla de bodegas">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Bodega</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Productos</th>
              <th>Inventario a costo</th>
              <th>Ventas hoy</th>
              <th>Utilidad</th>
              <th>Stock bajo</th>
              <th>Transferencias</th>
              <th>Usuarios</th>
              <th>Última actividad</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <td><div className="skeleton-box" style={{ width: 65, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 130, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 80, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 60, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 45, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 90, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 75, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 70, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 35, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 30, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 30, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 80, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 24, height: 24, borderRadius: 6 }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function WarehouseDetailSkeleton() {
  return (
    <div className="warehouse-detail-skeleton" aria-label="Cargando detalle de bodega">
      <div className="panel skeleton-card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="skeleton-box skeleton-line-title" style={{ width: 220, height: 28 }} />
            <div className="skeleton-box skeleton-line-short" style={{ width: 320, marginTop: 8 }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="skeleton-box" style={{ width: 110, height: 40, borderRadius: 8 }} />
            <div className="skeleton-box" style={{ width: 140, height: 40, borderRadius: 8 }} />
          </div>
        </div>
      </div>
      <WarehouseStatsSkeleton />
      <div className="panel skeleton-card" style={{ height: 350, marginTop: 20 }} />
    </div>
  )
}
