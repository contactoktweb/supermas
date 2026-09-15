'use client'

import React from 'react'

export function ExogenaStatsSkeleton() {
  return (
    <section className="stats-grid products-stats" aria-label="Cargando estadísticas de exógena">
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

export function ExogenaTableSkeleton() {
  return (
    <div className="table-panel animated-table" aria-label="Cargando tabla de formatos DIAN">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Formato</th>
              <th>Versión</th>
              <th>Nombre y Descripción</th>
              <th>Categoría</th>
              <th>Registros</th>
              <th>Inconsistencias</th>
              <th>Estado</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <td><div className="skeleton-box" style={{ width: 60, height: 18 }} /></td>
                <td><div className="skeleton-box" style={{ width: 40, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 220, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 90, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 50, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 70, height: 16 }} /></td>
                <td><div className="skeleton-box" style={{ width: 70, height: 20, borderRadius: 6 }} /></td>
                <td style={{ textAlign: 'right' }}>
                  <div className="skeleton-box" style={{ width: 80, height: 28, borderRadius: 6, marginLeft: 'auto' }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function ExogenaSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <ExogenaStatsSkeleton />
      <ExogenaTableSkeleton />
    </div>
  )
}
