'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { BrandStats as BrandStatsType } from '../types'

interface BrandStatsProps {
  stats: BrandStatsType
}

export function BrandStats({ stats }: BrandStatsProps) {
  return (
    <section className="stats-grid" aria-label="Resumen de marcas">
      <StatCard
        title="Total Marcas"
        value={stats.totalBrands}
        note={`${stats.activeBrands} activas`}
        iconName="award"
        tone="blue"
      />
      <StatCard
        title="Marcas con Productos"
        value={stats.brandsWithProducts}
        note="Con catálogo activo"
        iconName="products"
        tone="teal"
      />
      <StatCard
        title="Marcas Activas"
        value={stats.activeBrands}
        note="Operativas"
        iconName="check"
        tone="blue"
      />
      <StatCard
        title="Inactivas"
        value={stats.inactiveBrands}
        note={stats.inactiveBrands > 0 ? 'Deshabilitadas' : 'Catálogo 100% activo'}
        iconName="powerOff"
        tone={stats.inactiveBrands > 0 ? 'amber' : 'teal'}
      />
    </section>
  )
}

function StatCard({
  title,
  value,
  note,
  iconName,
  tone,
}: {
  title: string
  value: number
  note: string
  iconName: LightIconName
  tone: 'blue' | 'teal' | 'amber' | 'red'
}) {
  return (
    <article className={`stat-card card-tone-${tone}`}>
      <div className="stat-card-header">
        <span className="stat-card-title">{title}</span>
        <div className="stat-icon-wrapper">
          <AppIcon name={iconName} size={18} />
        </div>
      </div>
      <div className="stat-card-body">
        <div className="stat-value">{value}</div>
        <p className="stat-card-note">{note}</p>
      </div>
    </article>
  )
}
