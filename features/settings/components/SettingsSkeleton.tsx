'use client'

import React from 'react'

export function SettingsSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="space-y-2">
          <div className="h-4 w-28 bg-slate-800 rounded" />
          <div className="h-8 w-64 bg-slate-800 rounded" />
          <div className="h-4 w-96 bg-slate-800/60 rounded" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-44 bg-slate-800 rounded-xl" />
          <div className="h-10 w-28 bg-slate-800 rounded-xl" />
        </div>
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-slate-800 rounded" />
              <div className="w-8 h-8 rounded-lg bg-slate-800" />
            </div>
            <div className="h-7 w-20 bg-slate-800 rounded" />
          </div>
        ))}
      </div>

      {/* Categories Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
          <div key={i} className="h-40 rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800" />
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-28 bg-slate-800 rounded" />
                <div className="h-3 w-16 bg-slate-800/60 rounded" />
              </div>
            </div>
            <div className="h-10 w-full bg-slate-800/40 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}
