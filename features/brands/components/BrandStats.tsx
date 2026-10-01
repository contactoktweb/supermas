'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { BrandStats as BrandStatsType } from '../types'
import { useCountUp } from '@/features/warehouses/hooks/useCountUp'

interface BrandStatsProps {
  stats: BrandStatsType
}

interface BrandKpiCardProps {
  title: string
  value: number
  iconName: LightIconName
  tone: 'blue' | 'teal' | 'amber' | 'red'
  badge: string
  note: string
  subtext?: string
  isPositive?: boolean
  index: number
}

function BrandKpiCard({
  title,
  value,
  iconName,
  tone,
  badge,
  note,
  subtext,
  isPositive = true,
  index,
}: BrandKpiCardProps) {
  const animatedValue = useCountUp(value, { decimals: 0, duration: 800 })

  return (
    <article
      className={`dashboard-kpi-card tone-${tone}`}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="kpi-card-header">
        <div className={`kpi-icon-wrap ${tone}`}>
          <AppIcon name={iconName} size={18} />
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
          <AppIcon name={isPositive ? 'arrowUpRight' : 'arrowDownRight'} size={12} />
          <span>{note}</span>
        </span>
        {subtext && <span className="kpi-subtext">{subtext}</span>}
      </div>
    </article>
  )
}

export function BrandStats({ stats }: BrandStatsProps) {
  const activePercent =
    stats.totalBrands > 0
      ? Math.round((stats.activeBrands / stats.totalBrands) * 100)
      : 0

  return (
    <section className="stats-grid page-enter" aria-label="Resumen estadístico de marcas">
      <BrandKpiCard
        title="Total Marcas"
        value={stats.totalBrands}
        iconName="award"
        tone="blue"
        badge="Catálogo"
        note={`${stats.activeBrands} activas (${activePercent}%)`}
        subtext="Registradas en el ERP"
        isPositive={true}
        index={1}
      />

      <BrandKpiCard
        title="Marcas con Productos"
        value={stats.brandsWithProducts}
        iconName="products"
        tone="teal"
        badge="Activas"
        note="Con catálogo activo"
        subtext="Artículos en stock o venta"
        isPositive={true}
        index={2}
      />

      <BrandKpiCard
        title="Marcas Activas"
        value={stats.activeBrands}
        iconName="check"
        tone="blue"
        badge="Operativas"
        note="Disponibles en compras"
        subtext="Listas para asociar"
        isPositive={true}
        index={3}
      />

      <BrandKpiCard
        title="Inactivas"
        value={stats.inactiveBrands}
        iconName="powerOff"
        tone={stats.inactiveBrands > 0 ? 'amber' : 'teal'}
        badge="Operativo"
        note={stats.inactiveBrands > 0 ? 'Deshabilitadas' : 'Catálogo 100% activo'}
        subtext={stats.inactiveBrands > 0 ? 'Ocultas para nuevos ítems' : 'Sin pendientes'}
        isPositive={stats.inactiveBrands === 0}
        index={4}
      />
    </section>
  )
}
