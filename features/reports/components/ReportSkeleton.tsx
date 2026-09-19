import React from 'react'

export function ReportSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white border border-slate-200 rounded-2xl p-5 h-36 flex flex-col justify-between shadow-xs"
          >
            <div className="flex justify-between items-center">
              <div className="h-4 bg-slate-200 rounded w-24" />
              <div className="w-10 h-10 bg-slate-100 rounded-xl" />
            </div>
            <div className="h-8 bg-slate-200 rounded w-36" />
            <div className="h-3 bg-slate-100 rounded w-28" />
          </div>
        ))}
      </div>

      {/* Chart Skeleton */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 h-64 flex flex-col justify-between shadow-xs">
        <div className="h-5 bg-slate-200 rounded w-48" />
        <div className="h-40 bg-slate-100 rounded-xl w-full" />
      </div>

      {/* Table Skeleton */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
        <div className="h-5 bg-slate-200 rounded w-40" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-slate-100 rounded-lg w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
