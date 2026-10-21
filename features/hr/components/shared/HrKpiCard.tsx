'use client'

import Link from 'next/link'
import { AppIcon, type LightIconName } from '@/components/ui/Icon'
import { useCountUp } from '@/features/warehouses/hooks/useCountUp'

export type HrKpiTone = 'blue' | 'teal' | 'amber' | 'red' | 'purple'

interface HrKpiCardProps {
  title: string
  value: number
  icon: LightIconName
  tone: HrKpiTone
  badge: string
  note: string
  isPositive?: boolean
  index: number
  href?: string
}

/** Tarjeta KPI estándar (dashboard-kpi-card) con contador animado y enlace opcional. */
export function HrKpiCard({ title, value, icon, tone, badge, note, isPositive = true, index, href }: HrKpiCardProps) {
  const animatedValue = useCountUp(value, { decimals: 0, duration: 800 })

  const content = (
    <>
      <div className="kpi-card-header">
        <div className={`kpi-icon-wrap ${tone}`} aria-hidden="true">
          <AppIcon name={icon} size={18} />
        </div>
        <span className="kpi-scope-badge">{badge}</span>
      </div>
      <div className="kpi-card-body">
        <span className="kpi-card-title">{title}</span>
        <div className="kpi-value-row">
          <strong className="kpi-card-value">{animatedValue}</strong>
        </div>
      </div>
      <div className="kpi-card-footer">
        <span className={`kpi-trend-pill ${isPositive ? 'trend-positive' : 'trend-warning'}`}>
          <AppIcon name={isPositive ? 'check' : 'warning'} size={12} />
          <span>{note}</span>
        </span>
      </div>
    </>
  )

  const className = `dashboard-kpi-card tone-${tone}`
  const style = { animationDelay: `${index * 0.05}s` }

  return href ? (
    <Link
      href={href}
      className={`${className} no-underline text-inherit focus-visible:outline-2 focus-visible:outline-[var(--navy)] focus-visible:outline-offset-2`}
      style={style}
      aria-label={`${title}: ${value}. ${note}`}
    >
      {content}
    </Link>
  ) : (
    <article className={className} style={style}>
      {content}
    </article>
  )
}
