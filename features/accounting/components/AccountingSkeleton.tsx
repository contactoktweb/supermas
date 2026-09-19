'use client'

import React from 'react'

export function AccountingStatsSkeleton() {
  return (
    <section className="stats-grid products-stats" aria-label="Cargando estadísticas contables">
      {Array.from({ length: 8 }).map((_, i) => (
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

export function AccountingTableSkeleton() {
  return (
    <div className="table-panel animated-table" aria-label="Cargando tabla contable">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Código / Número</th>
              <th>Descripción / Nombre</th>
              <th>Clase / Tipo</th>
              <th>Naturaleza / Origen</th>
              <th>Débito</th>
              <th>Crédito</th>
              <th>Estado</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>
                <td><div className="skeleton-box" style={{ width: 90, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 220, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 85, height: 20, borderRadius: 6 }} /></td>
                <td><div className="skeleton-box" style={{ width: 75, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 95, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 95, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 80, height: 20, borderRadius: 6 }} /></td>
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
