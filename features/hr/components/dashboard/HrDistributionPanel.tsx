'use client'

import type { HrDistributionItem } from '../../types'

interface HrDistributionPanelProps {
  title: string
  description: string
  items: HrDistributionItem[]
  isLoading: boolean
}

/** Distribución del personal vigente (barras horizontales con transform: scaleX). */
export function HrDistributionPanel({ title, description, items, isLoading }: HrDistributionPanelProps) {
  const max = Math.max(1, ...items.map((item) => item.count))
  return (
    <section className="panel page-enter">
      <div className="panel-heading mb-3">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-7 rounded-md bg-slate-100 motion-safe:animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="m-0 py-6 text-center text-xs text-[var(--muted)]">Sin empleados vigentes.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {items.slice(0, 8).map((item) => (
            <li key={item.id ?? item.name} className="distribution">
              <div>
                <span className="text-xs text-[var(--foreground)]">{item.name}</span>
                <b>{item.count}</b>
              </div>
              <div
                className="distribution-bar"
                role="meter"
                aria-valuemin={0}
                aria-valuemax={max}
                aria-valuenow={item.count}
                aria-label={`${item.name}: ${item.count} empleados`}
              >
                <i
                  className="origin-left transition-transform duration-500 motion-reduce:transition-none"
                  style={{ transform: `scaleX(${item.count / max})` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
