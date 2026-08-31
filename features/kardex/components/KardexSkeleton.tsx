'use client'

import React from 'react'

export function KardexSkeleton() {
  return (
    <div className="kardex-skeleton-container page-enter" aria-busy="true">
      {/* Stats Skeleton */}
      <div className="stats-grid kardex-stats-grid">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="skeleton-card" style={{ height: 112 }}>
            <div className="skeleton-line" style={{ width: '45%', height: 14, marginBottom: 10 }} />
            <div className="skeleton-line" style={{ width: '75%', height: 26, marginBottom: 8 }} />
            <div className="skeleton-line" style={{ width: '40%', height: 12 }} />
          </div>
        ))}
      </div>

      {/* Toolbar Skeleton */}
      <div className="inventory-toolbar" style={{ height: 58, display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className="skeleton-line" style={{ width: 280, height: 38, borderRadius: 8 }} />
        <div className="skeleton-line" style={{ width: 160, height: 38, borderRadius: 8 }} />
        <div className="skeleton-line" style={{ width: 160, height: 38, borderRadius: 8 }} />
        <div className="skeleton-line" style={{ width: 100, height: 38, borderRadius: 8, marginLeft: 'auto' }} />
      </div>

      {/* Table Skeleton */}
      <div className="table-panel" style={{ padding: 20 }}>
        <div className="skeleton-line" style={{ width: '100%', height: 30, marginBottom: 14 }} />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="skeleton-line"
            style={{ width: '100%', height: 44, marginBottom: 8, borderRadius: 6 }}
          />
        ))}
      </div>
    </div>
  )
}
