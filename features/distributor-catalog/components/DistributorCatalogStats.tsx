'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { DistributorCatalogStats as DistributorCatalogStatsType } from '../types'
import { useCountUp } from '@/features/warehouses/hooks/useCountUp'
import { DistributorCatalogStatsSkeleton } from './DistributorCatalogSkeleton'

interface DistributorCatalogStatsProps {
  stats: DistributorCatalogStatsType | null
  loading: boolean
}

export function DistributorCatalogStats({ stats, loading }: DistributorCatalogStatsProps) {
  if (loading || !stats) {
    return <DistributorCatalogStatsSkeleton />
  }

  return (
    <section
      className="stats-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-6"
      aria-label="Indicadores del catálogo distribuidora"
    >
      <StatCard
        title="Publicados"
        value={stats.publishedCount}
        note={`${stats.totalProductsCount} en total`}
        iconName="check"
        tone="blue"
        tooltip="Productos visibles en el catálogo público de distribuidores."
      />

      <StatCard
        title="Ocultos"
        value={stats.hiddenCount}
        note="No visibles al público"
        iconName="close"
        tone="amber"
        tooltip="Productos deshabilitados para la consulta de clientes distribuidores."
      />

      <StatCard
        title="Disponibles"
        value={stats.availableCount}
        note="Existencias óptimas"
        iconName="products"
        tone="teal"
        tooltip="Productos con stock positivo consolidado en las bodegas de la red."
      />

      <StatCard
        title="Pocas Unidades"
        value={stats.lowStockCount}
        note="Bajo umbral mínimo"
        iconName="alerts"
        tone="amber"
        tooltip="Productos con existencias limitadas en bodega."
      />

      <StatCard
        title="Agotados"
        value={stats.outOfStockCount}
        note="Sin stock en bodegas"
        iconName="trash"
        tone="red"
        tooltip="Productos con inventario cero en la totalidad de ubicaciones."
      />

      <StatCard
        title="Compra Web Activa"
        value={stats.directPurchaseActiveCount}
        note="Super Más + Carrito"
        iconName="purchases"
        tone="blue"
        tooltip="Productos con botón de compra directa activo integrados a la tienda online."
      />
    </section>
  )
}

interface StatCardProps {
  title: string
  value: number
  note: string
  iconName: LightIconName
  tone: 'blue' | 'teal' | 'amber' | 'red'
  tooltip: string
}

function StatCard({ title, value, note, iconName, tone, tooltip }: StatCardProps) {
  const animatedValue = useCountUp(value, {
    duration: 650,
  })

  return (
    <article className="stat-card" title={tooltip}>
      <div className={`stat-icon ${tone}`}>
        <AppIcon name={iconName} size={18} />
      </div>
      <div className="stat-text">
        <span>{title}</span>
        <strong>{animatedValue}</strong>
        <small className={tone === 'red' || (tone === 'amber' && value > 0) ? 'warning-text' : 'positive'}>
          {note}
        </small>
      </div>
    </article>
  )
}
