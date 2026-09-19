'use client'

import React from 'react'

export function UsersSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Skeleton de estadísticas */}
      <section className="stats-grid products-stats" aria-label="Cargando estadísticas de usuarios">
        {Array.from({ length: 5 }).map((_, i) => (
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
      <div className="table-panel animated-table" aria-label="Cargando directorio de usuarios">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Usuario / Email</th>
                <th>Rol Predefinido</th>
                <th>Sede Asignada</th>
                <th>Estado</th>
                <th>Último Acceso</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="skeleton-box" style={{ width: 34, height: 34, borderRadius: '50%' }} />
                      <div className="skeleton-box" style={{ width: 120, height: 16 }} />
                    </div>
                  </td>
                  <td><div className="skeleton-box" style={{ width: 140, height: 16 }} /></td>
                  <td><div className="skeleton-box" style={{ width: 100, height: 20, borderRadius: 12 }} /></td>
                  <td><div className="skeleton-box" style={{ width: 110, height: 16 }} /></td>
                  <td><div className="skeleton-box" style={{ width: 70, height: 20, borderRadius: 6 }} /></td>
                  <td><div className="skeleton-box" style={{ width: 90, height: 16 }} /></td>
                  <td><div className="skeleton-box" style={{ width: 80, height: 24, borderRadius: 4, marginLeft: 'auto' }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
