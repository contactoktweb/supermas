'use client'

import React, { useEffect, useState } from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { SupplierStats as SupplierStatsType } from '../types'

interface SupplierStatsProps {
  stats: SupplierStatsType
}

interface SupplierStatCardProps {
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

function SupplierStatCard({
  title,
  value,
  iconName,
  tone,
  badge,
  note,
  isPositive = true,
  subtext,
  index,
}: SupplierStatCardProps) {
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

export function SupplierStats({ stats }: SupplierStatsProps) {
  const animatedTotal = useCountUp(stats.totalSuppliers)
  const animatedActive = useCountUp(stats.activeSuppliers)
  const animatedRecent = useCountUp(stats.suppliersWithRecentPurchases)
  const animatedPendingBalance = useCountUp(stats.totalPendingBalance)
  const animatedOverdue = useCountUp(stats.overdueInvoicesCount)
  const animatedPurchasedPeriod = useCountUp(stats.totalPurchasedPeriod)
  const animatedProducts = useCountUp(stats.suppliedProductsCount)

  const formatCurrency = (val: number) => {
    if (stats.isCostRedacted) return 'Confidencial'
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val)
  }

  return (
    <section
      className="stats-grid products-stats-grid page-enter"
      aria-label="Métricas de gestión de proveedores"
    >
      {/* 1. Total proveedores */}
      <SupplierStatCard
        title="Total proveedores"
        value={animatedTotal.toLocaleString('es-CO')}
        iconName="suppliers"
        tone="blue"
        badge="Directorio"
        note="Base comercial"
        isPositive={true}
        subtext="Proveedores registrados"
        index={1}
      />

      {/* 2. Proveedores activos */}
      <SupplierStatCard
        title="Proveedores activos"
        value={animatedActive.toLocaleString('es-CO')}
        iconName="check"
        tone="teal"
        badge="Operativos"
        note="Habilitados"
        isPositive={true}
        subtext="Disponibles para compras"
        index={2}
      />

      {/* 3. Proveedores con compras recientes */}
      <SupplierStatCard
        title="Compras recientes"
        value={animatedRecent.toLocaleString('es-CO')}
        iconName="purchases"
        tone="purple"
        badge="Últimos 30 días"
        note="Abasteciendo"
        isPositive={true}
        subtext="Actividad en el periodo"
        index={3}
      />

      {/* 4. Cuentas pendientes */}
      <SupplierStatCard
        title="Cuentas pendientes"
        value={formatCurrency(animatedPendingBalance)}
        iconName="wallet"
        tone="amber"
        badge="Por pagar"
        note="Pasivo comercial"
        isPositive={false}
        subtext="Saldo total adeudado"
        index={4}
      />

      {/* 5. Facturas vencidas */}
      <SupplierStatCard
        title="Facturas vencidas"
        value={animatedOverdue.toLocaleString('es-CO')}
        iconName="warning"
        tone="red"
        badge="Mora"
        note={animatedOverdue > 0 ? 'Prioridad pago' : 'Al día'}
        isPositive={animatedOverdue === 0}
        subtext="Plazo de crédito superado"
        index={5}
      />

      {/* 6. Compras del periodo */}
      <SupplierStatCard
        title="Compras del periodo"
        value={formatCurrency(animatedPurchasedPeriod)}
        iconName="invoices"
        tone="teal"
        badge="Inversión"
        note="Facturado"
        isPositive={true}
        subtext="Adquisiciones totales"
        index={6}
      />

      {/* 7. Productos suministrados */}
      <SupplierStatCard
        title="Productos suministrados"
        value={`${animatedProducts.toLocaleString('es-CO')} refs`}
        iconName="inventory"
        tone="blue"
        badge="Portafolio"
        note="Referencias únicas"
        isPositive={true}
        subtext="Catálogo abastecido"
        index={7}
      />
    </section>
  )
}
