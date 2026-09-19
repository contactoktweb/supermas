'use client'

import React from 'react'

export function AuditSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Skeleton de estadísticas */}
      <section className="stats-grid products-stats" aria-label="Cargando estadísticas de auditoría">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="stat-card skeleton-card">
            <div className="skeleton-box skeleton-icon" />
            <div className="stat-text" style={{ width: '100%' }}>
              <div className="skeleton-box skeleton-line-short" style={{ width: '50%' }} />
              <div className="skeleton-box skeleton-line-title" style={{ width: '70%', height: 24, marginTop: 6 }} />
              <div className="skeleton-box skeleton-line-sub" style={{ width: '40%', marginTop: 4 }} />
            </div>
          </div>
        ))}
      </section>

      {/* Skeleton de filtros */}
      <div className="card" style={{ padding: 18 }}>
        <div className="skeleton-box" style={{ height: 38, width: '100%', borderRadius: 6 }} />
      </div>

      {/* Skeleton de tabla */}
      <div className="table-panel animated-table" aria-label="Cargando registros de auditoría">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Usuario</th>
                <th>Módulo</th>
                <th>Acción</th>
                <th>Registro</th>
                <th>Bodega</th>
                <th>Nivel</th>
                <th>Resultado</th>
                <th style={{ textAlign: 'center' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 7 }).map((_, i) => (
                <tr key={i}>
                  <td><div className="skeleton-box" style={{ width: 130, height: 16 }} /></td>
                  <td><div className="skeleton-box" style={{ width: 110, height: 16 }} /></td>
                  <td><div className="skeleton-box" style={{ width: 70, height: 16 }} /></td>
                  <td><div className="skeleton-box" style={{ width: 120, height: 16 }} /></td>
                  <td><div className="skeleton-box" style={{ width: 100, height: 16 }} /></td>
                  <td><div className="skeleton-box" style={{ width: 90, height: 16 }} /></td>
                  <td><div className="skeleton-box" style={{ width: 50, height: 18, borderRadius: 10 }} /></td>
                  <td><div className="skeleton-box" style={{ width: 60, height: 18, borderRadius: 10 }} /></td>
                  <td><div className="skeleton-box" style={{ width: 45, height: 24, borderRadius: 4, margin: '0 auto' }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
