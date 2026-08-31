'use client'

import React from 'react'

export function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton-container" aria-busy="true" aria-label="Cargando centro de control...">
      {/* Hero Header Skeleton */}
      <div className="skeleton-hero-header">
        <div className="skeleton-line" style={{ width: '40%', height: 36, borderRadius: 8 }} />
        <div className="skeleton-line" style={{ width: '60%', height: 18, borderRadius: 6, marginTop: 10 }} />
      </div>

      {/* 8 Stats KPI Cards Skeleton */}
      <div className="stats-grid dashboard-primary-grid" style={{ marginTop: 24 }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="stat-card skeleton-stat-card">
            <div className="skeleton-circle" style={{ width: 36, height: 36, borderRadius: 9 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="skeleton-line" style={{ width: '60%', height: 14 }} />
              <div className="skeleton-line" style={{ width: '80%', height: 24 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions Skeleton */}
      <div className="quick-actions-grid" style={{ marginTop: 24 }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="quick-action-card skeleton-action-card">
            <div className="skeleton-circle" style={{ width: 32, height: 32, borderRadius: 8 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="skeleton-line" style={{ width: '70%', height: 14 }} />
              <div className="skeleton-line" style={{ width: '90%', height: 11 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Chart Grid Skeleton */}
      <div className="dashboard-grid analytics-grid" style={{ marginTop: 24 }}>
        <div className="panel" style={{ height: 320 }}>
          <div className="skeleton-line" style={{ width: '40%', height: 20, marginBottom: 15 }} />
          <div className="skeleton-block" style={{ height: 220, borderRadius: 10 }} />
        </div>
        <div className="panel" style={{ height: 320 }}>
          <div className="skeleton-line" style={{ width: '50%', height: 20, marginBottom: 15 }} />
          <div className="skeleton-circle" style={{ width: 140, height: 140, margin: '20px auto' }} />
        </div>
      </div>
    </div>
  )
}
