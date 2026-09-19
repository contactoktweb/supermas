'use client'

import React from 'react'

export function DistributorCatalogStatsSkeleton() {
  return (
    <div className="stats-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="stat-card p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse"
        >
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20 mb-3" />
          <div className="h-7 bg-slate-300 dark:bg-slate-600 rounded w-16 mb-2" />
          <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-28" />
        </div>
      ))}
    </div>
  )
}

export function DistributorCatalogTableSkeleton() {
  return (
    <div className="panel-container rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 animate-pulse">
      <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-lg mb-6 w-full" />
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-14 bg-slate-100 dark:bg-slate-800/60 rounded-lg w-full flex items-center justify-between px-4"
          >
            <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded w-32" />
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
