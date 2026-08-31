'use client'

import React, { useEffect, useState } from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { GlobalKardexStats } from '../types'

interface KardexStatsProps {
  stats: GlobalKardexStats
}

interface KardexStatCardProps {
  title: string
  value: string | number
  iconName: LightIconName
  tone: 'blue' | 'red' | 'teal' | 'amber' | 'purple'
  badge: string
  note?: string
  isPositive?: boolean
  subtext?: string
  isRedacted?: boolean
  index: number
}

// Hook for smooth CountUp animation
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

function KardexStatCard({
  title,
  value,
  iconName,
  tone,
  badge,
  note,
  isPositive = true,
  subtext,
  isRedacted = false,
  index,
}: KardexStatCardProps) {
  return (
    <article
      className={`dashboard-kpi-card tone-${tone} ${isRedacted ? 'is-redacted' : ''}`}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="kpi-card-header">
        <div className={`kpi-icon-wrap ${tone}`}>
          {isRedacted ? (
            <AppIcon name="lock" size={18} />
          ) : (
            <AppIcon name={iconName} size={18} />
          )}
        </div>
        <span className="kpi-scope-badge">{badge}</span>
      </div>

      <div className="kpi-card-body">
        <span className="kpi-card-title">{title}</span>
        {isRedacted ? (
          <div className="redacted-value-wrap">
            <strong className="redacted-text">Confidencial</strong>
            <small className="redacted-hint">Acceso restringido por rol</small>
          </div>
        ) : (
          <div className="kpi-value-row">
            <strong className="kpi-card-value">{value}</strong>
          </div>
        )}
      </div>

      <div className="kpi-card-footer">
        {isRedacted ? (
          <span className="kpi-subtext">Valoración financiera protegida</span>
        ) : (
          <>
            {note && (
              <span
                className={`kpi-trend-pill ${
                  isPositive ? 'trend-positive' : 'trend-warning'
                }`}
              >
                <AppIcon
                  name={isPositive ? 'arrowUpRight' : 'arrowDownRight'}
                  size={12}
                />
                <span>{note}</span>
              </span>
            )}
            {subtext && <span className="kpi-subtext">{subtext}</span>}
          </>
        )}
      </div>
    </article>
  )
}

export function KardexStats({ stats }: KardexStatsProps) {
  const animatedMovements = useCountUp(stats.totalMovements)
  const animatedUnitsIn = useCountUp(stats.totalUnitsIn)
  const animatedUnitsOut = useCountUp(stats.totalUnitsOut)
  const animatedDistinctProducts = useCountUp(stats.distinctProductsCount || 0)

  const formatCurrency = (val: number) => {
    if (val >= 1000000) {
      return `$${(val / 1000000).toFixed(1)}M`
    }
    if (val >= 1000) {
      return `$${(val / 1000).toFixed(0)}K`
    }
    return `$${val.toLocaleString('es-CO')}`
  }

  return (
    <section
      className="stats-grid products-stats-grid page-enter"
      aria-label="Resumen de movimientos del Kardex"
    >
      {/* 1. Movimientos del periodo */}
      <KardexStatCard
        title="Movimientos del periodo"
        value={animatedMovements.toLocaleString('es-CO')}
        iconName="kardex"
        tone="blue"
        badge="Trazabilidad"
        note="100% Inmutables"
        isPositive={true}
        subtext="Historial auditado"
        index={1}
      />

      {/* 2. Unidades ingresadas */}
      <KardexStatCard
        title="Unidades ingresadas"
        value={`+${animatedUnitsIn.toLocaleString('es-CO')} uds`}
        iconName="arrowDownLeft"
        tone="teal"
        badge="Entradas"
        note="Compras y transferencias"
        isPositive={true}
        subtext="Abastecimiento total"
        index={2}
      />

      {/* 3. Unidades retiradas */}
      <KardexStatCard
        title="Unidades retiradas"
        value={`-${animatedUnitsOut.toLocaleString('es-CO')} uds`}
        iconName="arrowUpRight"
        tone="amber"
        badge="Salidas"
        note="Ventas y remisiones"
        isPositive={false}
        subtext="Despachos del periodo"
        index={3}
      />

      {/* 4. Valor de entradas a costo */}
      <KardexStatCard
        title="Valor de entradas"
        value={
          stats.isCostRedacted
            ? '••••••••'
            : formatCurrency(stats.totalValueInAtCost)
        }
        iconName="dollar"
        tone="blue"
        badge="A Costo"
        note="Compras a costo prom."
        isPositive={true}
        subtext={stats.isCostRedacted ? 'Protegido por permisos' : 'Valoración acumulada'}
        isRedacted={stats.isCostRedacted}
        index={4}
      />

      {/* 5. Valor de salidas a costo */}
      <KardexStatCard
        title="Valor de salidas"
        value={
          stats.isCostRedacted
            ? '••••••••'
            : formatCurrency(stats.totalValueOutAtCost)
        }
        iconName="creditCard"
        tone="purple"
        badge="Costo Ventas"
        note="A costo ponderado"
        isPositive={true}
        subtext={stats.isCostRedacted ? 'Protegido por permisos' : 'Costo de mercancía despachada'}
        isRedacted={stats.isCostRedacted}
        index={5}
      />

      {/* 6. Productos movilizados */}
      <KardexStatCard
        title="Productos movilizados"
        value={`${animatedDistinctProducts} SKUs`}
        iconName="products"
        tone="blue"
        badge="Artículos"
        note="Con rotación"
        isPositive={true}
        subtext="SKUs con actividad en el periodo"
        index={6}
      />
    </section>
  )
}
