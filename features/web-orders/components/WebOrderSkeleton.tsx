'use client'

import React from 'react'

export function WebOrderStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="stat-card p-4 rounded-xl border border-slate-200 bg-white animate-pulse"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="h-4 bg-slate-200 rounded w-24" />
            <div className="h-8 w-8 bg-slate-200 rounded-lg" />
          </div>
          <div className="h-7 bg-slate-300 rounded w-28 mb-2" />
          <div className="h-3 bg-slate-100 rounded w-36" />
        </div>
      ))}
    </div>
  )
}

export function WebOrderTableSkeleton() {
  return (
    <div className="table-panel rounded-xl border border-slate-200 bg-white p-6 animate-pulse">
      <div className="h-10 bg-slate-100 rounded-lg mb-6 w-full" />
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-14 bg-slate-50 rounded-lg w-full flex items-center justify-between px-4 border border-slate-100"
          >
            <div className="h-4 bg-slate-200 rounded w-28" />
            <div className="h-4 bg-slate-200 rounded w-36" />
            <div className="h-4 bg-slate-200 rounded w-24" />
            <div className="h-6 bg-slate-200 rounded-full w-20" />
            <div className="h-4 bg-slate-200 rounded w-28" />
            <div className="h-8 bg-slate-200 rounded-lg w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}
