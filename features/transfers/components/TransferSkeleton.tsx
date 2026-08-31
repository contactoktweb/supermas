'use client'

import React from 'react'

export function TransferSkeleton() {
  return (
    <div className="table-panel products-table-panel page-enter" style={{ minHeight: 340 }}>
      <div style={{ padding: 20 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 16,
              alignItems: 'center',
              padding: '14px 0',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <div
              style={{
                width: 90,
                height: 24,
                borderRadius: 6,
                background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                backgroundSize: '200% 100%',
                animation: 'skeleton-shimmer 1.5s infinite',
              }}
            />
            <div
              style={{
                width: 110,
                height: 16,
                borderRadius: 4,
                background: '#f1f5f9',
              }}
            />
            <div
              style={{
                width: 140,
                height: 16,
                borderRadius: 4,
                background: '#f1f5f9',
              }}
            />
            <div
              style={{
                width: 140,
                height: 16,
                borderRadius: 4,
                background: '#f1f5f9',
              }}
            />
            <div
              style={{
                flex: 1,
                height: 16,
                borderRadius: 4,
                background: '#f1f5f9',
              }}
            />
            <div
              style={{
                width: 80,
                height: 22,
                borderRadius: 12,
                background: '#f1f5f9',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
