'use client'

import React from 'react'

export interface HrInfoItem {
  label: string
  value: React.ReactNode
}

interface HrInfoGridProps {
  title: string
  items: HrInfoItem[]
  action?: React.ReactNode
}

/** Panel de datos en lista de definición (H3 dentro de la ficha). */
export function HrInfoGrid({ title, items, action }: HrInfoGridProps) {
  return (
    <section className="panel page-enter">
      <div className="panel-heading mb-3">
        <h3 className="m-0 text-[14px] font-bold">{title}</h3>
        {action}
      </div>
      <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">{item.label}</dt>
            <dd className="m-0 mt-1 break-words text-[13px] text-[var(--foreground)]">
              {item.value === null || item.value === undefined || item.value === '' ? '—' : item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
