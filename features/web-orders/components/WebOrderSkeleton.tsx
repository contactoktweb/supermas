'use client'

import React from 'react'

export function WebOrderStatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="metric-card p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24" />
            <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          </div>
          <div className="h-7 bg-slate-300 dark:bg-slate-600 rounded w-28 mb-2" />
          <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-36" />
        </div>
      ))}
    </div>
  )
}

export function WebOrderTableSkeleton() {
  return (
    <div className="panel-container rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 animate-pulse">
      <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-lg mb-6 w-full" />
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-14 bg-slate-100 dark:bg-slate-800/60 rounded-lg w-full flex items-center justify-between px-4"
          >
            <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded w-28" />
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-36" />
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24" />
            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-full w-20" />
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-28" />
            <div className="h-8 bg-slate-300 dark:bg-slate-700 rounded-lg w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}
