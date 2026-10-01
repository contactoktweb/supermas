'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { CategoryStats as CategoryStatsType } from '../types'

interface CategoryStatsProps {
  stats: CategoryStatsType
}

export function CategoryStats({ stats }: CategoryStatsProps) {
  return (
    <section className="stats-grid" aria-label="Resumen de categorías">
      <StatCard
        title="Total Categorías"
        value={stats.totalCategories}
        note={`${stats.activeCategories} activas`}
        iconName="layers"
        tone="blue"
      />
      <StatCard
        title="Categorías Raíz"
        value={stats.rootCategories}
        note="Nivel principal"
        iconName="grid"
        tone="teal"
      />
      <StatCard
        title="Subcategorías"
        value={stats.subcategories}
        note="Niveles anidados"
        iconName="table"
        tone="blue"
      />
      <StatCard
        title="Inactivas"
        value={stats.inactiveCategories}
        note={stats.inactiveCategories > 0 ? 'Deshabilitadas' : 'Catálogo 100% activo'}
        iconName="powerOff"
        tone={stats.inactiveCategories > 0 ? 'amber' : 'teal'}
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
