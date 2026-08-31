'use client'

import React from 'react'

export function ProductSkeleton() {
  return (
    <div className="product-skeleton-container page-enter" aria-busy="true">
      {/* Stats Skeleton */}
      <div className="stats-grid products-stats-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-card" style={{ height: 136 }}>
            <div className="skeleton-line" style={{ width: '40%', height: 16, marginBottom: 12 }} />
            <div className="skeleton-line" style={{ width: '70%', height: 28, marginBottom: 10 }} />
            <div className="skeleton-line" style={{ width: '50%', height: 14 }} />
          </div>
        ))}
      </div>

      {/* Toolbar Skeleton */}
      <div className="inventory-toolbar" style={{ height: 58, display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className="skeleton-line" style={{ width: 280, height: 38, borderRadius: 8 }} />
        <div className="skeleton-line" style={{ width: 140, height: 38, borderRadius: 8 }} />
        <div className="skeleton-line" style={{ width: 140, height: 38, borderRadius: 8 }} />
        <div className="skeleton-line" style={{ width: 100, height: 38, borderRadius: 8, marginLeft: 'auto' }} />
      </div>

      {/* Table Skeleton */}
      <div className="table-panel" style={{ padding: 20 }}>
        <div className="skeleton-line" style={{ width: '100%', height: 30, marginBottom: 14 }} />
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="skeleton-line"
            style={{ width: '100%', height: 48, marginBottom: 8, borderRadius: 6 }}
          />
        ))}
      </div>
    </div>
  )
}
