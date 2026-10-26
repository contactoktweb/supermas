'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'

export type KpiTone = 'blue' | 'red' | 'teal' | 'amber' | 'purple'

interface KpiCardProps {
  title: string
  value: string | number
  iconName: LightIconName
  tone: KpiTone
  badge: string
  note?: string
  isPositive?: boolean
  subtext?: string
  /** Posición en la fila: escalona la animación de entrada */
  index?: number
}

/** Tarjeta de indicador estándar de los módulos (misma presentación que Compras, Recepciones y Transferencias). */
export function KpiCard({ title, value, iconName, tone, badge, note, isPositive = true, subtext, index = 0 }: KpiCardProps) {
  return (
    <article className={`dashboard-kpi-card tone-${tone}`} style={{ animationDelay: `${index * 0.05}s` }}>
      <div className="kpi-card-header">
        <div className={`kpi-icon-wrap ${tone}`}>
          <AppIcon name={iconName} size={18} />
        </div>
        <span className="kpi-scope-badge">{badge}</span>
      </div>

      <div className="kpi-card-body">
        <span className="kpi-card-title">{title}</span>
        <div className="kpi-value-row">
          <strong className="kpi-card-value">{value}</strong>
        </div>
      </div>

      <div className="kpi-card-footer">
        {note && (
          <span className={`kpi-trend-pill ${isPositive ? 'trend-positive' : 'trend-warning'}`}>
            <AppIcon name={isPositive ? 'arrowUpRight' : 'warning'} size={12} />
            <span>{note}</span>
          </span>
        )}
        {subtext && <span className="kpi-subtext">{subtext}</span>}
      </div>
    </article>
  )
}
