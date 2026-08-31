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
  index = 0,
}: StatCardProps) {
  const animatedValue = useCountUp(isRedacted ? 0 : value, {
    isCurrency,
    isPercent,
    decimals,
  })

  return (
    <article
      className={`dashboard-kpi-card tone-${tone} ${
        isRedacted ? 'is-redacted' : ''
      }`}
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      <div className="kpi-card-header">
        <div className={`kpi-icon-wrap ${tone}`}>
          {isRedacted ? (
            <AppIcon name="lock" size={18} />
          ) : (
            <AppIcon name={iconName} size={18} />
          )}
        </div>
        {badge && <span className="kpi-scope-badge">{badge}</span>}
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
            <strong className="kpi-card-value">
              {animatedValue}
              {suffix}
            </strong>
          </div>
        )}
      </div>

      <div className="kpi-card-footer">
        {isRedacted ? (
          <span className="kpi-subtext">Información financiera protegida</span>
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

export function DashboardStatsGrid({ metrics }: DashboardStatsGridProps) {
  const [showSecondary, setShowSecondary] = useState(false)
  const isFinancialRedacted = metrics.isFinancialRedacted

  return (
    <section className="dashboard-stats-section page-enter">
      {/* Primary KPI Grid (8 cards) */}
      <div className="stats-grid dashboard-primary-grid">
        {/* 1. Ventas de hoy */}
        <StatCard
          title="Ventas de hoy"
          value={metrics.todaySales.value}
          isCurrency
          iconName="sales"
          tone="teal"
          badge="Hoy"
          note={`+${metrics.todaySales.deltaYesterdayPct}%`}
          isPositive={metrics.todaySales.deltaYesterdayPct >= 0}
          subtext={`${metrics.todaySales.count} tickets hoy`}
          index={1}
        />

        {/* 2. Ventas del periodo / mes */}
        <StatCard
          title="Ventas del periodo"
          value={metrics.periodSales.value}
          isCurrency
          iconName="sales"
          tone="blue"
          badge="Consolidado"
          note={`+${metrics.periodSales.deltaPct}%`}
          isPositive={metrics.periodSales.deltaPct >= 0}
          subtext={`${metrics.periodSales.count} transacciones`}
          index={2}
        />

        {/* 3. Utilidad bruta (RBAC) */}
        <StatCard
          title="Utilidad bruta"
          value={metrics.grossProfit?.value || 0}
          isCurrency
          iconName="sales"
          tone="teal"
          badge="Rentabilidad"
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
          index={3}
        />

        {/* 4. Inventario a costo (RBAC) */}
        <StatCard
          title="Inventario a costo"
          value={metrics.inventoryAtCost?.value || 0}
          isCurrency
          iconName="inventory"
          tone="blue"
          badge="Valoración"
          isRedacted={isFinancialRedacted}
          note={
            metrics.inventoryAtCost
              ? `${metrics.inventoryAtCost.deltaPct}% rotación`
              : undefined
          }
          isPositive={false}
          subtext="Todas las bodegas"
          index={4}
        />

        {/* 5. Total de productos */}
        <StatCard
          title="Productos en catálogo"
          value={metrics.productsCount.total}
          iconName="products"
          tone="blue"
          badge="Catálogo"
          note={`${metrics.productsCount.active} activos`}
          isPositive={true}
          subtext={`${metrics.productsCount.outOfStock} agotados`}
          index={5}
        />

        {/* 6. Stock bajo / Alertas */}
        <StatCard
          title="Stock bajo crítico"
          value={metrics.productsCount.lowStock}
          iconName="warning"
          tone="amber"
          badge="Alertas"
          note="Bajo mínimo"
          isPositive={false}
          subtext={`${metrics.productsCount.critical} urgentes`}
          index={6}
        />

        {/* 7. Transferencias pendientes */}
        <StatCard
          title="Transferencias activas"
          value={metrics.pendingTransfers.total}
          iconName="transfers"
          tone="blue"
          badge="Logística"
          note={`${metrics.pendingTransfers.inTransit} en tránsito`}
          isPositive={true}
          subtext={`${metrics.pendingTransfers.pending} por despachar`}
          index={7}
        />

        {/* 8. Pedidos Web */}
        <StatCard
          title="Pedidos web hoy"
          value={metrics.webOrders.totalToday}
          iconName="webOrders"
          tone="red"
          badge="Ecommerce"
          note={`${metrics.webOrders.newOrders} nuevos`}
          isPositive={true}
          subtext={`${metrics.webOrders.preparing} alistando`}
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
            badge="Abastecimiento"
            isRedacted={isFinancialRedacted}
            note={metrics.purchases ? `${metrics.purchases.count} facturas` : undefined}
            isPositive={true}
            subtext="Entradas registradas"
            index={9}
          />

          {/* Cuentas por pagar */}
          <StatCard
            title="Cuentas por pagar"
            value={metrics.accountsPayable?.pendingBalance || 0}
            isCurrency
            iconName="cashRegisters"
            tone="amber"
            badge="Tesorería"
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
            badge="Agotados"
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
            badge="Incidencias"
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
