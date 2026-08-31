'use client'

import React from 'react'
import {
  Warehouse,
  CircleDollarSign,
  TrendingUp,
  AlertTriangle,
  Truck,
  Bell,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react'
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
        icon={Warehouse}
        tone="blue"
        tooltip="Cantidad de bodegas y puntos de venta activos en operación."
      />

      <StatCard
        title="Valor total inventario"
        value={stats.totalInventoryValueAtCost}
        isCurrency
        note="Valorizado a costo"
        icon={CircleDollarSign}
        tone="teal"
        tooltip="Sumatoria del inventario disponible multiplicado por el costo promedio vigente en cada bodega."
        isRestricted={!canReadCost}
      />

      <StatCard
        title="Ventas de hoy"
        value={stats.totalTodaySales}
        isCurrency
        note="+12.4% vs ayer"
        icon={TrendingUp}
        tone="blue"
        tooltip="Ventas emitidas hoy en la totalidad de puntos y despachos de bodegas."
      />

      <StatCard
        title="Stock bajo"
        value={stats.totalLowStockProducts}
        note={stats.totalLowStockProducts > 0 ? 'Requiere revisión' : 'En nivel óptimo'}
        icon={AlertTriangle}
        tone={stats.totalLowStockProducts > 0 ? 'amber' : 'teal'}
        tooltip="Productos cuyo stock actual está en o por debajo del umbral mínimo de seguridad."
        isWarning={stats.totalLowStockProducts > 0}
      />

      <StatCard
        title="Transferencias pendientes"
        value={stats.totalPendingTransfers}
        note="En tránsito o espera"
        icon={Truck}
        tone="blue"
        tooltip="Transferencias entre bodegas aún no despachadas o pendientes de recepción en destino."
      />

      <StatCard
        title="Alertas activas"
        value={stats.totalActiveAlerts}
        note={stats.totalActiveAlerts > 0 ? 'Atención urgente' : 'Sin novedades'}
        icon={Bell}
        tone={stats.totalActiveAlerts > 0 ? 'red' : 'teal'}
        tooltip="Eventos operativos, agotados y discrepancias que requieren gestión administrativa."
        isWarning={stats.totalActiveAlerts > 0}
      />
    </section>
  )
}

interface StatCardProps {
  title: string
  value: number
  note: string
  icon: React.ComponentType<{ size?: number }>
  tone?: string
  isCurrency?: boolean
  tooltip: string
  isWarning?: boolean
  isRestricted?: boolean
}

function StatCard({
  title,
  value,
  note,
  icon: Icon,
  tone = 'blue',
  isCurrency = false,
  tooltip,
  isWarning = false,
  isRestricted = false,
}: StatCardProps) {
  const formattedValue = useCountUp(value, { isCurrency })

  return (
    <article
      className="stat-card warehouse-stat-card"
      tabIndex={0}
      title={tooltip}
      aria-label={`${title}: ${isRestricted ? 'Restringido' : formattedValue}. ${note}`}
    >
      <div className={`stat-icon ${tone}`}>
        <Icon size={18} />
      </div>

      <div className="stat-text">
        <span>{title}</span>
        <strong>{isRestricted ? '••••••••' : formattedValue}</strong>
        <small className={isWarning ? 'warning-text' : isRestricted ? 'muted-text' : 'positive'}>
          {isWarning ? <AlertTriangle size={11} /> : isRestricted ? <ShieldAlert size={11} /> : <ArrowUpRight size={11} />}
          {isRestricted ? 'Requiere permiso de costos' : note}
        </small>
      </div>

      <svg className="sparkline" viewBox="0 0 90 30" aria-hidden="true">
        <polyline points="0,25 12,22 22,24 35,15 48,19 60,10 72,14 90,3" />
      </svg>
    </article>
  )
}
