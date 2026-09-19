'use client'

import React from 'react'

export function AlertSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-label="Cargando alertas...">
      {/* Stats Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-white border border-slate-200 p-4 shadow-xs" />
        ))}
      </div>

      {/* Module pills skeleton */}
      <div className="h-12 rounded-2xl bg-white border border-slate-200 p-2 flex gap-2 overflow-hidden shadow-xs">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-8 w-24 rounded-xl bg-slate-100" />
        ))}
      </div>

      {/* Filter Bar Skeleton */}
      <div className="h-24 rounded-2xl bg-white border border-slate-200 shadow-xs" />

      {/* Table Skeleton */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden p-4 space-y-3 shadow-xs">
        <div className="h-10 rounded-xl bg-slate-100" />
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-slate-50" />
        ))}
      </div>
    </div>
  )
}
