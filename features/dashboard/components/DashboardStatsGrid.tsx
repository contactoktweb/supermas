'use client'

import React, { useState } from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { DashboardMetrics, UserProfile } from '../types'
import { useCountUp } from '@/features/warehouses/hooks/useCountUp'

interface DashboardStatsGridProps {
  metrics: DashboardMetrics
  user: UserProfile
}

interface StatCardProps {
  title: string
  value: number
  isCurrency?: boolean
  isPercent?: boolean
  decimals?: number
  suffix?: string
  iconName: LightIconName
  tone: 'blue' | 'red' | 'teal' | 'amber' | 'purple'
  note?: string
  isPositive?: boolean
  subtext?: string
  isRedacted?: boolean
  badge?: string
  sparkPoints?: string
  index?: number
}

function StatCard({
  title,
  value,
  isCurrency = false,
  isPercent = false,
  decimals = 0,
  suffix = '',
  iconName,
  tone,
  note,
  isPositive = true,
  subtext,
  isRedacted = false,
  badge,
  sparkPoints = '0,25 15,20 30,22 45,14 60,18 75,8 90,4',
  index = 0,
}: StatCardProps) {
  const animatedValue = useCountUp(isRedacted ? 0 : value, {
    isCurrency,
    isPercent,
    decimals,
  })

  return (
    <article
      className={`stat-card dashboard-kpi-card tone-${tone} ${
        isRedacted ? 'is-redacted' : ''
      }`}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="stat-card-header">
        <div className={`stat-icon ${tone}`}>
          {isRedacted ? (
            <AppIcon name="lock" size={18} />
          ) : (
            <AppIcon name={iconName} size={18} />
          )}
        </div>
        {badge && <span className="stat-card-badge">{badge}</span>}
      </div>

      <div className="stat-text">
        <span className="stat-card-title">{title}</span>
        {isRedacted ? (
          <div className="redacted-value-wrap">
            <strong className="redacted-text">Confidencial</strong>
            <small className="redacted-hint">Acceso restringido por rol</small>
          </div>
        ) : (
          <strong className="stat-card-value">
            {animatedValue}
            {suffix}
          </strong>
        )}

        {note && !isRedacted && (
          <div className="stat-delta-row">
            <small className={isPositive ? 'positive' : 'negative-text'}>
              <AppIcon
                name={isPositive ? 'arrowUpRight' : 'arrowDownRight'}
                size={13}
              />
              {note}
            </small>
            {subtext && <span className="stat-subtext">{subtext}</span>}
          </div>
        )}
      </div>

      {!isRedacted && (
        <svg className="sparkline" viewBox="0 0 90 30" preserveAspectRatio="none">
          <polyline points={sparkPoints} />
        </svg>
      )}
    </article>
  )
}

export function DashboardStatsGrid({ metrics, user }: DashboardStatsGridProps) {
  const [showSecondary, setShowSecondary] = useState(false)
  const isFinancialRedacted = metrics.isFinancialRedacted

  return (
    <section className="dashboard-stats-section page-enter">
      {/* Primary KPI Grid (6 - 8 cards) */}
      <div className="stats-grid dashboard-primary-grid">
        {/* 1. Ventas de hoy */}
        <StatCard
          title="Ventas de hoy"
          value={metrics.todaySales.value}
          isCurrency
          iconName="sales"
          tone="teal"
          note={`+${metrics.todaySales.deltaYesterdayPct}%`}
          isPositive={metrics.todaySales.deltaYesterdayPct >= 0}
          subtext={`${metrics.todaySales.count} tickets hoy`}
          sparkPoints="0,24 15,19 30,22 45,12 60,15 75,7 90,3"
          index={1}
        />

        {/* 2. Ventas del periodo / mes */}
        <StatCard
          title="Ventas del periodo"
          value={metrics.periodSales.value}
          isCurrency
          iconName="sales"
          tone="blue"
          note={`+${metrics.periodSales.deltaPct}%`}
          isPositive={metrics.periodSales.deltaPct >= 0}
          subtext={`${metrics.periodSales.count} transacciones`}
          sparkPoints="0,26 15,22 30,18 45,19 60,11 75,9 90,2"
          index={2}
        />

        {/* 3. Utilidad bruta (RBAC) */}
        <StatCard
          title="Utilidad bruta"
          value={metrics.grossProfit?.value || 0}
          isCurrency
          iconName="sales"
          tone="teal"
          isRedacted={isFinancialRedacted}
          note={
            metrics.grossProfit ? `${metrics.grossProfit.marginPct}% margen` : undefined
          }
          isPositive={true}
          subtext={
            metrics.grossProfit
              ? `+${metrics.grossProfit.deltaPct}% vs anterior`
              : undefined
          }
          sparkPoints="0,25 15,20 30,16 45,15 60,10 75,6 90,4"
          index={3}
        />

        {/* 4. Inventario a costo (RBAC) */}
        <StatCard
          title="Inventario a costo"
          value={metrics.inventoryAtCost?.value || 0}
          isCurrency
          iconName="inventory"
          tone="blue"
          isRedacted={isFinancialRedacted}
          note={
            metrics.inventoryAtCost
              ? `${metrics.inventoryAtCost.deltaPct}% rotación`
              : undefined
          }
          isPositive={false}
          subtext="Todas las bodegas"
          sparkPoints="0,15 15,18 30,14 45,16 60,19 75,17 90,20"
          index={4}
        />

        {/* 5. Total de productos */}
        <StatCard
          title="Productos en catálogo"
          value={metrics.productsCount.total}
          iconName="products"
          tone="blue"
          note={`${metrics.productsCount.active} activos`}
          isPositive={true}
          subtext={`${metrics.productsCount.outOfStock} agotados`}
          sparkPoints="0,22 15,20 30,18 45,17 60,14 75,10 90,6"
          index={5}
        />

        {/* 6. Stock bajo / Alertas */}
        <StatCard
          title="Stock bajo crítico"
          value={metrics.productsCount.lowStock}
          iconName="warning"
          tone="amber"
          note="Bajo mínimo"
          isPositive={false}
          subtext={`${metrics.productsCount.critical} urgentes`}
          sparkPoints="0,10 15,14 30,16 45,22 60,20 75,25 90,26"
          index={6}
        />

        {/* 7. Transferencias pendientes */}
        <StatCard
          title="Transferencias activas"
          value={metrics.pendingTransfers.total}
          iconName="transfers"
          tone="blue"
          note={`${metrics.pendingTransfers.inTransit} en tránsito`}
          isPositive={true}
          subtext={`${metrics.pendingTransfers.pending} por despachar`}
          sparkPoints="0,20 15,18 30,14 45,19 60,12 75,8 90,4"
          index={7}
        />

        {/* 8. Pedidos Web */}
        <StatCard
          title="Pedidos web hoy"
          value={metrics.webOrders.totalToday}
          iconName="webOrders"
          tone="red"
          note={`${metrics.webOrders.newOrders} nuevos`}
          isPositive={true}
          subtext={`${metrics.webOrders.preparing} alistando`}
          sparkPoints="0,26 15,20 30,17 45,14 60,8 75,5 90,2"
          index={8}
        />
      </div>

      {/* Expand / Collapse Secondary Indicators */}
      <div className="secondary-indicators-control">
        <button
          type="button"
          className="toggle-secondary-btn"
          onClick={() => setShowSecondary(!showSecondary)}
          aria-expanded={showSecondary}
        >
          <span>
            {showSecondary ? 'Ocultar indicadores secundarios' : 'Ver más indicadores operativos y financieros'}
          </span>
          <AppIcon
            name={showSecondary ? 'chevronUp' : 'chevronDown'}
            size={15}
          />
        </button>
      </div>

      {/* Secondary Indicators Grid */}
      {showSecondary && (
        <div className="stats-grid dashboard-secondary-grid page-enter">
          {/* Compras del periodo */}
          <StatCard
            title="Compras del periodo"
            value={metrics.purchases?.value || 0}
            isCurrency
            iconName="purchases"
            tone="teal"
            isRedacted={isFinancialRedacted}
            note={metrics.purchases ? `${metrics.purchases.count} facturas` : undefined}
            isPositive={true}
            subtext="Abastecimiento"
            index={9}
          />

          {/* Cuentas por pagar */}
          <StatCard
            title="Cuentas por pagar"
            value={metrics.accountsPayable?.pendingBalance || 0}
            isCurrency
            iconName="cashRegisters"
            tone="amber"
            isRedacted={isFinancialRedacted}
            note={
              metrics.accountsPayable
                ? `${metrics.accountsPayable.dueSoonCount} por vencer`
                : undefined
            }
            isPositive={false}
            subtext="Saldo a proveedores"
            index={10}
          />

          {/* Productos agotados */}
          <StatCard
            title="Productos sin existencias"
            value={metrics.productsCount.outOfStock}
            iconName="close"
            tone="red"
            note="0 unidades"
            isPositive={false}
            subtext="Requieren compra"
            index={11}
          />

          {/* Alertas del sistema */}
          <StatCard
            title="Alertas activas totales"
            value={metrics.activeAlerts.total}
            iconName="alerts"
            tone="amber"
            note={`${metrics.activeAlerts.inventory} inventario`}
            isPositive={false}
            subtext={`${metrics.activeAlerts.purchases} compras`}
            index={12}
          />
        </div>
      )}
    </section>
  )
}
