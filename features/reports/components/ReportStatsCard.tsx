'use client'

import React, { useEffect, useState } from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'

interface ReportStatsCardProps {
  title: string
  value: number | string
  format?: 'currency' | 'number' | 'percent' | 'raw'
  subtitle?: string
  trendPercent?: number
  iconName: LightIconName
  accentColor?: string
  tone?: 'blue' | 'teal' | 'amber' | 'red'
  loading?: boolean
}

export function ReportStatsCard({
  title,
  value,
  format = 'raw',
  subtitle,
  trendPercent,
  iconName,
  accentColor = '#001b5c',
  tone = 'blue',
  loading = false,
}: ReportStatsCardProps) {
  // Count-up animation for numbers
  const [displayValue, setDisplayValue] = useState<string>(typeof value === 'string' ? value : '0')

  useEffect(() => {
    if (typeof value !== 'number' || loading) {
      setDisplayValue(String(value ?? '—'))
      return
    }

    const duration = 600
    const start = 0
    const end = value
    const startTime = performance.now()

    function step(currentTime: number) {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(start + (end - start) * ease)

      if (format === 'currency') {
        setDisplayValue(
          new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            maximumFractionDigits: 0,
          }).format(current)
        )
      } else if (format === 'percent') {
        setDisplayValue(`${(start + (end - start) * ease).toFixed(1)}%`)
      } else if (format === 'number') {
        setDisplayValue(current.toLocaleString('es-CO'))
      } else {
        setDisplayValue(String(current))
      }

      if (progress < 1) {
        requestAnimationFrame(step)
      }
    }

    requestAnimationFrame(step)
  }, [value, format, loading])

  if (loading) {
    return (
      <article className="stat-card" style={{ opacity: 0.6 }}>
        <div className="stat-icon blue">
          <AppIcon name={iconName} size={18} />
        </div>
        <div className="stat-text">
          <span>{title}</span>
          <strong>••••••••</strong>
          <small className="positive">Cargando métricas...</small>
        </div>
      </article>
    )
  }

  return (
    <article className="stat-card" title={subtitle || title}>
      <div className={`stat-icon ${tone}`}>
        <AppIcon name={iconName} size={18} />
      </div>

      <div className="stat-text" style={{ flex: 1 }}>
        <span>{title}</span>
        <strong>{displayValue}</strong>
        {subtitle && (
          <small className={trendPercent !== undefined && trendPercent < 0 ? 'warning-text' : 'positive'}>
            {trendPercent !== undefined && (
              <AppIcon
                name={trendPercent >= 0 ? 'arrowUpRight' : 'arrowDownRight'}
                size={12}
              />
            )}
            {subtitle}
          </small>
        )}
      </div>

      <svg className="sparkline" viewBox="0 0 90 30" aria-hidden="true">
        <polyline points="0,25 12,22 22,24 35,15 48,19 60,10 72,14 90,3" />
      </svg>
    </article>
  )
}
