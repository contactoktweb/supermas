'use client'

import React from 'react'

export function TaxStatsSkeleton() {
  return (
    <section className="stats-grid products-stats" aria-label="Cargando estadísticas tributarias">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="stat-card skeleton-card">
          <div className="skeleton-box skeleton-icon" />
          <div className="stat-text" style={{ width: '100%' }}>
            <div className="skeleton-box skeleton-line-short" style={{ width: '60%' }} />
            <div className="skeleton-box skeleton-line-title" style={{ width: '80%', height: 24, marginTop: 6 }} />
            <div className="skeleton-box skeleton-line-sub" style={{ width: '45%', marginTop: 4 }} />
          </div>
        </div>
      ))}
    </section>
  )
}

export function TaxTableSkeleton() {
  return (
    <div className="table-panel animated-table" aria-label="Cargando tabla de impuestos">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Tarifa (%)</th>
              <th>Vigencia</th>
              <th>Productos Asociados</th>
              <th>Cuentas Contables</th>
              <th>Estado</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <td><div className="skeleton-box" style={{ width: 70, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 160, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 85, height: 20, borderRadius: 6 }} /></td>
                <td><div className="skeleton-box" style={{ width: 45, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 110, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 60, height: 20, borderRadius: 12 }} /></td>
                <td><div className="skeleton-box" style={{ width: 120, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 70, height: 20, borderRadius: 6 }} /></td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <div className="skeleton-box" style={{ width: 28, height: 28, borderRadius: 6 }} />
                    <div className="skeleton-box" style={{ width: 28, height: 28, borderRadius: 6 }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
