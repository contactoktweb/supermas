'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { GlobalWarehousesStats } from '../types'
import { useCountUp } from '../hooks/useCountUp'

interface WarehouseStatsProps {
  stats: GlobalWarehousesStats
  canReadCost: boolean
}

export function WarehouseStats({ stats, canReadCost }: WarehouseStatsProps) {
  return (
    <section className="stats-grid products-stats" aria-label="Estadísticas generales de bodegas">
      <StatCard
        title="Total de bodegas"
        value={stats.activeWarehouses}
        note={`${stats.totalWarehouses} registradas`}
        iconName="warehouse"
        tone="blue"
        tooltip="Cantidad de bodegas y puntos de venta activos en operación."
      />

      <StatCard
        title="Valor total inventario"
        value={stats.totalInventoryValueAtCost}
        isCurrency
        note="Valorizado a costo"
        iconName="sales"
        tone="teal"
        tooltip="Sumatoria del inventario disponible multiplicado por el costo promedio vigente en cada bodega."
        isRestricted={!canReadCost}
      />

      <StatCard
        title="Ventas de hoy"
        value={stats.totalTodaySales}
        isCurrency
        note="+12.4% vs ayer"
        iconName="sales"
        tone="blue"
        tooltip="Ventas emitidas hoy en la totalidad de puntos y despachos de bodegas."
      />

      <StatCard
        title="Stock bajo"
        value={stats.totalLowStockProducts}
        note={stats.totalLowStockProducts > 0 ? 'Requiere revisión' : 'En nivel óptimo'}
        iconName="warning"
        tone={stats.totalLowStockProducts > 0 ? 'amber' : 'teal'}
        tooltip="Productos con inventario menor o igual al stock mínimo configurado."
      />

      <StatCard
        title="Transferencias activas"
        value={stats.totalPendingTransfers}
        note="En tránsito o por recibir"
        iconName="transfers"
        tone="blue"
        tooltip="Transferencias inter-bodegas pendientes de despacho o recepción."
      />

      <StatCard
        title="Alertas operativas"
        value={stats.totalActiveAlerts}
        note={stats.totalActiveAlerts > 0 ? 'Atención urgente' : 'Sin alertas críticas'}
        iconName="alerts"
        tone={stats.totalActiveAlerts > 0 ? 'red' : 'teal'}
        tooltip="Incidencias que requieren acción correctiva o administrativa."
      />
    </section>
  )
}

interface StatCardProps {
  title: string
  value: number
  isCurrency?: boolean
  note: string
  iconName: LightIconName
  tone: 'blue' | 'teal' | 'amber' | 'red'
  tooltip: string
  isRestricted?: boolean
}

function StatCard({
  title,
  value,
  isCurrency = false,
  note,
  iconName,
  tone,
  tooltip,
  isRestricted = false,
}: StatCardProps) {
  const animatedValue = useCountUp(isRestricted ? 0 : value, {
    isCurrency,
    duration: 900,
  })

  return (
    <article className="stat-card" title={tooltip}>
      <div className={`stat-icon ${tone}`}>
        {isRestricted ? (
          <AppIcon name="lock" size={18} />
        ) : (
          <AppIcon name={iconName} size={18} />
        )}
      </div>
      <div className="stat-text">
        <span>{title}</span>
        <strong>
          {isRestricted ? 'Restringido' : animatedValue}
        </strong>
        <small
          className={
            tone === 'red' || (tone === 'amber' && value > 0)
              ? 'warning-text'
              : 'positive'
          }
        >
          <AppIcon
            name={
              tone === 'red' || (tone === 'amber' && value > 0)
                ? 'warning'
                : 'arrowUpRight'
            }
            size={13}
          />
          {note}
        </small>
      </div>
      <svg className="sparkline" viewBox="0 0 90 30" aria-hidden="true">
        <polyline points="0,25 12,22 22,24 35,15 48,19 60,10 72,14 90,3" />
      </svg>
    </article>
  )
}
