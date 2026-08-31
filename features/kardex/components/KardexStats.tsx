'use client'

import React, { useEffect, useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { GlobalKardexStats } from '../types'

interface KardexStatsProps {
  stats: GlobalKardexStats
}

// Hook for CountUp animation
function useCountUp(target: number, duration: number = 800) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let startTimestamp: number | null = null
    const startValue = 0

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / duration, 1)
      const easeProgress = 1 - Math.pow(1 - progress, 3) // easeOutCubic
      setCount(Math.floor(startValue + (target - startValue) * easeProgress))

      if (progress < 1) {
        window.requestAnimationFrame(step)
      } else {
        setCount(target)
      }
    }

    window.requestAnimationFrame(step)
  }, [target, duration])

  return count
}

export function KardexStats({ stats }: KardexStatsProps) {
  const movements = useCountUp(stats.totalMovements)
  const entriesCount = useCountUp(stats.totalEntriesCount)
  const exitsCount = useCountUp(stats.totalExitsCount)
  const unitsIn = useCountUp(stats.totalUnitsIn)
  const unitsOut = useCountUp(stats.totalUnitsOut)
  const valueIn = useCountUp(stats.totalValueInAtCost)
  const valueOut = useCountUp(stats.totalValueOutAtCost)

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
    <section className="stats-grid kardex-stats-grid" aria-label="Métricas de Kardex">
      {/* 1. Total Movimientos */}
      <article className="stat-card" style={{ animationDelay: '0.04s' }}>
        <div className="stat-icon blue">
          <AppIcon name="kardex" size={20} />
        </div>
        <div className="stat-text">
          <span>Movimientos del periodo</span>
          <strong>{movements.toLocaleString('es-CO')}</strong>
          <small className="positive">
            <AppIcon name="shield" size={12} />
            <span>Trazabilidad 100%</span>
          </small>
        </div>
      </article>

      {/* 2. Entradas */}
      <article className="stat-card" style={{ animationDelay: '0.08s' }}>
        <div className="stat-icon teal">
          <AppIcon name="arrowDownLeft" size={20} />
        </div>
        <div className="stat-text">
          <span>Entradas</span>
          <strong>{entriesCount.toLocaleString('es-CO')}</strong>
          <small className="positive">
            <span>Compras / Devoluciones</span>
          </small>
        </div>
      </article>

      {/* 3. Salidas */}
      <article className="stat-card" style={{ animationDelay: '0.12s' }}>
        <div className="stat-icon red">
          <AppIcon name="arrowUpRight" size={20} />
        </div>
        <div className="stat-text">
          <span>Salidas</span>
          <strong>{exitsCount.toLocaleString('es-CO')}</strong>
          <small style={{ color: 'var(--red)' }}>
            <span>Ventas / Remisiones</span>
          </small>
        </div>
      </article>

      {/* 4. Unidades Ingresadas */}
      <article className="stat-card" style={{ animationDelay: '0.16s' }}>
        <div className="stat-icon teal">
          <AppIcon name="plus" size={20} />
        </div>
        <div className="stat-text">
          <span>Unidades ingresadas</span>
          <strong style={{ color: 'var(--green)' }}>+{unitsIn.toLocaleString('es-CO')}</strong>
          <small className="positive">
            <span>Abastecimiento</span>
          </small>
        </div>
      </article>

      {/* 5. Unidades Retiradas */}
      <article className="stat-card" style={{ animationDelay: '0.2s' }}>
        <div className="stat-icon amber">
          <AppIcon name="transfers" size={20} />
        </div>
        <div className="stat-text">
          <span>Unidades retiradas</span>
          <strong style={{ color: '#d97706' }}>-{unitsOut.toLocaleString('es-CO')}</strong>
          <small style={{ color: 'var(--muted)' }}>
            <span>Despachos y ventas</span>
          </small>
        </div>
      </article>

      {/* 6. Valor Entradas a Costo (RBAC) */}
      <article className="stat-card" style={{ animationDelay: '0.24s' }}>
        <div className="stat-icon blue">
          <AppIcon name="dollar" size={20} />
        </div>
        <div className="stat-text">
          <span>Valor de entradas</span>
          <strong>{stats.isCostRedacted ? '••••••••' : formatCurrency(valueIn)}</strong>
          <small className="positive">
            <AppIcon name="lock" size={11} />
            <span>{stats.isCostRedacted ? 'Protegido RBAC' : 'A costo promedio'}</span>
          </small>
        </div>
      </article>

      {/* 7. Valor Salidas a Costo (RBAC) */}
      <article className="stat-card" style={{ animationDelay: '0.28s' }}>
        <div className="stat-icon amber">
          <AppIcon name="creditCard" size={20} />
        </div>
        <div className="stat-text">
          <span>Valor de salidas</span>
          <strong>{stats.isCostRedacted ? '••••••••' : formatCurrency(valueOut)}</strong>
          <small style={{ color: 'var(--muted)' }}>
            <AppIcon name="lock" size={11} />
            <span>{stats.isCostRedacted ? 'Protegido RBAC' : 'A costo ponderado'}</span>
          </small>
        </div>
      </article>
    </section>
  )
}
