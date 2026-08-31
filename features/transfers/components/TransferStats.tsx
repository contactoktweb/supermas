'use client'

import React, { useEffect, useState } from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { GlobalTransferStats } from '../types'

interface TransferStatsProps {
  stats: GlobalTransferStats
}

interface TransferStatCardProps {
  title: string
  value: string | number
  iconName: LightIconName
  tone: 'blue' | 'red' | 'teal' | 'amber' | 'purple'
  badge: string
  note?: string
  isPositive?: boolean
  subtext?: string
  index: number
}

function useCountUp(target: number, duration: number = 600) {
  const [count, setCount] = useState(target)

  useEffect(() => {
    let startTimestamp: number | null = null
    const startVal = 0
    const endVal = target
    if (endVal === 0) {
      setCount(0)
      return
    }

    let animationFrameId: number

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / duration, 1)
      setCount(Math.floor(progress * (endVal - startVal) + startVal))
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step)
      } else {
        setCount(endVal)
      }
    }

    animationFrameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animationFrameId)
  }, [target, duration])

  return count
}

function TransferStatCard({
  title,
  value,
  iconName,
  tone,
  badge,
  note,
  isPositive = true,
  subtext,
  index,
}: TransferStatCardProps) {
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
          <strong className="kpi-card-value">{value}</strong>
        </div>
      </div>

      <div className="kpi-card-footer">
        {note && (
          <span
            className={`kpi-trend-pill ${
              isPositive ? 'trend-positive' : 'trend-warning'
            }`}
          >
            <AppIcon
              name={isPositive ? 'arrowUpRight' : 'warning'}
              size={12}
            />
            <span>{note}</span>
          </span>
        )}
        {subtext && <span className="kpi-subtext">{subtext}</span>}
      </div>
    </article>
  )
}

export function TransferStats({ stats }: TransferStatsProps) {
  const animatedPending = useCountUp(stats.pendingCount)
  const animatedInTransit = useCountUp(stats.inTransitCount)
  const animatedReceived = useCountUp(stats.receivedCount)
  const animatedRejected = useCountUp(stats.rejectedCount)
  const animatedUnits = useCountUp(stats.totalUnitsTransferred)
  const animatedIncidents = useCountUp(stats.incidentCount)

  return (
    <section
      className="stats-grid products-stats-grid page-enter"
      aria-label="Métricas de transferencias entre bodegas"
    >
      {/* 1. Pendientes */}
      <TransferStatCard
        title="Pendientes"
        value={animatedPending.toLocaleString('es-CO')}
        iconName="clock"
        tone="amber"
        badge="Por despachar"
        note="En preparación"
        isPositive={false}
        subtext="Listas para emitir orden"
        index={1}
      />

      {/* 2. En tránsito */}
      <TransferStatCard
        title="En tránsito"
        value={animatedInTransit.toLocaleString('es-CO')}
        iconName="transfers"
        tone="blue"
        badge="En ruta"
        note="Despachadas"
        isPositive={true}
        subtext="Mercancía en traslado"
        index={2}
      />

      {/* 3. Recibidas del periodo */}
      <TransferStatCard
        title="Recibidas del periodo"
        value={animatedReceived.toLocaleString('es-CO')}
        iconName="check"
        tone="teal"
        badge="Completadas"
        note="Inventario ingresado"
        isPositive={true}
        subtext="Confirmadas en destino"
        index={3}
      />

      {/* 4. Rechazadas */}
      <TransferStatCard
        title="Rechazadas"
        value={animatedRejected.toLocaleString('es-CO')}
        iconName="close"
        tone="red"
        badge="Canceladas"
        note="Sin movimiento"
        isPositive={false}
        subtext="Rechazadas antes de despacho"
        index={4}
      />

      {/* 5. Unidades transferidas */}
      <TransferStatCard
        title="Unidades transferidas"
        value={`${animatedUnits.toLocaleString('es-CO')} uds`}
        iconName="inventory"
        tone="purple"
        badge="Volumen"
        note="Total movilizado"
        isPositive={true}
        subtext="Items recibidos/en tránsito"
        index={5}
      />

      {/* 6. Con novedad */}
      <TransferStatCard
        title="Con novedad"
        value={animatedIncidents.toLocaleString('es-CO')}
        iconName="warning"
        tone="amber"
        badge="Auditoría"
        note="Con diferencias"
        isPositive={false}
        subtext="Diferencias o averías reportadas"
        index={6}
      />
    </section>
  )
}
