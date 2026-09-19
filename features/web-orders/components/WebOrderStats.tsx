'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { WebOrderStats as WebOrderStatsType } from '../types'
import { useCountUp } from '@/features/warehouses/hooks/useCountUp'
import { WebOrderStatsSkeleton } from './WebOrderSkeleton'

interface WebOrderStatsProps {
  stats: WebOrderStatsType | null
  loading: boolean
}

export function WebOrderStats({ stats, loading }: WebOrderStatsProps) {
  if (loading || !stats) {
    return <WebOrderStatsSkeleton />
  }

  return (
    <section
      className="stats-grid grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6"
      aria-label="Indicadores de pedidos web"
    >
      <StatCard
        title="Ventas Web"
        value={stats.totalWebSalesAmount}
        isCurrency
        note="Total ventas despachadas"
        iconName="sales"
        tone="blue"
        tooltip="Monto total de pedidos web entregados y facturados en el ERP."
      />

      <StatCard
        title="Pendientes"
        value={stats.pendingCount}
        note={stats.pendingCount > 0 ? 'Por confirmar' : 'Al día'}
        iconName="alerts"
        tone="amber"
        tooltip="Pedidos recién ingresados desde la web que requieren validación administrativa."
      />

      <StatCard
        title="Confirmados"
        value={stats.confirmedCount}
        note="Reserva de stock activa"
        iconName="check"
        tone="blue"
        tooltip="Pedidos aprobados con inventario reservado en Bodega CEDI."
      />

      <StatCard
        title="En Preparación"
        value={stats.preparingCount}
        note="En picking / alistamiento"
        iconName="package"
        tone="blue"
        tooltip="Pedidos con productos siendo verificados y alistados físicamente."
      />

      <StatCard
        title="Listos para Despacho"
        value={stats.readyToDispatchCount}
        note="Checklist completado"
        iconName="package"
        tone="teal"
        tooltip="Pedidos con embalaje sellado listos para entregar al transportador."
      />

      <StatCard
        title="Enviados"
        value={stats.shippedCount}
        note="En ruta de entrega"
        iconName="transfers"
        tone="blue"
        tooltip="Pedidos entregados a transportadora externa o ruta propia."
      />

      <StatCard
        title="Entregados"
        value={stats.deliveredCount}
        note="A satisfacción"
        iconName="check"
        tone="teal"
        tooltip="Pedidos recibidos exitosamente por el cliente final."
      />

      <StatCard
        title="Cancelados"
        value={stats.cancelledCount}
        note="Reserva liberada"
        iconName="close"
        tone="red"
        tooltip="Pedidos cancelados con registro de motivo y reversión de reservas."
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
}

function StatCard({
  title,
  value,
  isCurrency = false,
  note,
  iconName,
  tone,
  tooltip,
}: StatCardProps) {
  const animatedValue = useCountUp(value, {
    isCurrency,
    duration: 700,
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
