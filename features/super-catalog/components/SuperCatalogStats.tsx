'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { SuperCatalogStats } from '../types'
import { useCountUp } from '@/features/warehouses/hooks/useCountUp'
import { SuperCatalogStatsSkeleton } from './SuperCatalogSkeleton'

interface SuperCatalogStatsProps {
  stats: SuperCatalogStats | null
  loading: boolean
}

interface StatCardProps {
  label: string
  value: number
  isCurrency?: boolean
  icon: LightIconName
  tone: 'blue' | 'teal' | 'amber' | 'red' | 'purple' | 'slate'
  subtext?: string
}

function StatCard({ label, value, isCurrency = false, icon, tone, subtext }: StatCardProps) {
  const animatedValue = useCountUp(value, {
    duration: 650,
    isCurrency,
  })

  return (
    <article className="stat-card" title={label}>
      <div className={`stat-icon ${tone}`}>
        <AppIcon name={icon} size={18} />
      </div>
      <div className="stat-text">
        <span>{label}</span>
        <strong>{animatedValue}</strong>
        {subtext && (
          <small className={tone === 'red' || (tone === 'amber' && value > 0) ? 'warning-text' : 'positive'}>
            {subtext}
          </small>
        )}
      </div>
    </article>
  )
}

export function SuperCatalogStatsSection({ stats, loading }: SuperCatalogStatsProps) {
  if (loading || !stats) {
    return <SuperCatalogStatsSkeleton />
  }

  return (
    <div className="mb-6 space-y-4">
      {/* Grid principal de 6 tarjetas con clases globales */}
      <section
        className="stats-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5"
        aria-label="Indicadores del catálogo Super Más"
      >
        <StatCard
          label="Publicados"
          value={stats.publishedCount}
          icon="eye"
          tone="blue"
          subtext="Visibles en tienda web"
        />

        <StatCard
          label="Ocultos"
          value={stats.hiddenCount}
          icon="close"
          tone="slate"
          subtext="No visibles en público"
        />

        <StatCard
          label="Disponibles"
          value={stats.availableCount}
          icon="check"
          tone="teal"
          subtext="Con stock suficiente"
        />

        <StatCard
          label="Pocas Unidades"
          value={stats.lowStockCount}
          icon="alerts"
          tone="amber"
          subtext="Bajo umbral de alerta"
        />

        <StatCard
          label="Agotados"
          value={stats.outOfStockCount}
          icon="trash"
          tone="red"
          subtext="0 existencias en bodegas"
        />

        <StatCard
          label="Ventas Web"
          value={stats.totalSalesFromWeb}
          isCurrency={true}
          icon="sales"
          tone="purple"
          subtext="Desde Catálogo Super Más"
        />
      </section>

      {/* Franja de insights: Top vendidos y más vistos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
            <AppIcon name="sparkles" size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
              Producto Más Vendido Online
            </span>
            <div className="text-sm font-bold text-slate-900 truncate">
              {stats.topSellingProduct ? stats.topSellingProduct.name : 'Sin ventas registradas'}
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {stats.topSellingProduct ? `${stats.topSellingProduct.soldUnits} unidades despachadas` : '—'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
            <AppIcon name="eye" size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 block">
              Mayor Visualización en Web
            </span>
            <div className="text-sm font-bold text-slate-900 truncate">
              {stats.mostViewedProduct ? stats.mostViewedProduct.name : 'Sin visitas registradas'}
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {stats.mostViewedProduct ? `${stats.mostViewedProduct.views.toLocaleString()} visualizaciones únicas` : '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
