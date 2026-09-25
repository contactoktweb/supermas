'use client'

import React, { useState } from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { DashboardMetrics, UserProfile } from '../types'
import { useCountUp } from '@/features/warehouses/hooks/useCountUp'

interface DashboardStatsGridProps {
  metrics: DashboardMetrics
  user: UserProfile
  onNavigate?: (viewName: string) => void
}

interface StatCardProps {
  title: string
  value: number
  hasData?: boolean
  emptyValueText?: string
  isCurrency?: boolean
  isPercent?: boolean
  decimals?: number
  suffix?: string
  iconName: LightIconName
  tone: 'blue' | 'red' | 'teal' | 'amber' | 'purple'
  note?: string
  isPositive?: boolean
  isNeutralNote?: boolean
  subtext?: string
  isRedacted?: boolean
  badge?: string
  index?: number
  onClick?: () => void
}

function StatCard({
  title,
  value,
  hasData = true,
  emptyValueText,
  isCurrency = false,
  isPercent = false,
  decimals = 0,
  suffix = '',
  iconName,
  tone,
  note,
  isPositive = true,
  isNeutralNote = false,
  subtext,
  isRedacted = false,
  badge,
  index = 0,
  onClick,
}: StatCardProps) {
  const animatedValue = useCountUp(isRedacted || !hasData ? 0 : value, {
    isCurrency,
    isPercent,
    decimals,
  })

  return (
    <article
      className={`dashboard-kpi-card tone-${tone} ${
        isRedacted ? 'is-redacted' : ''
      } ${onClick ? 'cursor-pointer hover-lift' : ''}`}
      style={{ animationDelay: `${index * 0.04}s`, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
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
        ) : !hasData ? (
          <div className="kpi-value-row">
            <strong
              className="kpi-card-value text-muted"
              style={{ fontSize: 15, fontWeight: 600, color: 'var(--muted)', display: 'block', margin: '4px 0' }}
            >
              {emptyValueText || 'Sin información disponible'}
            </strong>
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
                  isNeutralNote
                    ? 'trend-neutral'
                    : isPositive
                    ? 'trend-positive'
                    : 'trend-warning'
                }`}
                style={isNeutralNote ? { background: '#f1f5f9', color: '#64748b', borderColor: '#e2e8f0' } : undefined}
              >
                {!isNeutralNote && (
                  <AppIcon
                    name={isPositive ? 'arrowUpRight' : 'arrowDownRight'}
                    size={12}
                  />
                )}
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

export function DashboardStatsGrid({ metrics, user, onNavigate }: DashboardStatsGridProps) {
  const [showSecondary, setShowSecondary] = useState(false)
  const isFinancialRedacted = metrics.isFinancialRedacted

  const hasTodaySales = (metrics.todaySales?.count || 0) > 0 && (metrics.todaySales?.value || 0) > 0
  const hasPeriodSales = (metrics.periodSales?.count || 0) > 0 && (metrics.periodSales?.value || 0) > 0
  const hasGrossProfit = hasPeriodSales && (metrics.grossProfit?.value || 0) > 0
  const hasInventoryValue = (metrics.inventoryAtCost?.value || 0) > 0
  const hasProducts = (metrics.productsCount?.total || 0) > 0
  const hasPurchases = (metrics.purchases?.count || 0) > 0 && (metrics.purchases?.value || 0) > 0

  return (
    <section className="dashboard-stats-section page-enter">
      {/* Primary KPI Grid (8 cards) */}
      <div className="stats-grid dashboard-primary-grid">
        {/* 1. Ventas de hoy */}
        <StatCard
          title="Ventas de hoy"
          value={metrics.todaySales.value}
          hasData={hasTodaySales}
          emptyValueText="Sin información disponible"
          isCurrency
          iconName="sales"
          tone="teal"
          badge="Hoy"
          note={hasTodaySales ? `+${metrics.todaySales.deltaYesterdayPct}%` : 'Sin datos suficientes'}
          isPositive={metrics.todaySales.deltaYesterdayPct >= 0}
          isNeutralNote={!hasTodaySales}
          subtext={hasTodaySales ? `${metrics.todaySales.count} tickets hoy` : '0 tickets registrados hoy'}
          index={1}
        />

        {/* 2. Ventas del periodo / mes */}
        <StatCard
          title="Ventas del periodo"
          value={metrics.periodSales.value}
          hasData={hasPeriodSales}
          emptyValueText="Sin información disponible"
          isCurrency
          iconName="sales"
          tone="blue"
          badge="Consolidado"
          note={hasPeriodSales ? `+${metrics.periodSales.deltaPct}%` : 'Sin datos suficientes'}
          isPositive={metrics.periodSales.deltaPct >= 0}
          isNeutralNote={!hasPeriodSales}
          subtext={hasPeriodSales ? `${metrics.periodSales.count} transacciones` : '0 transacciones registradas'}
          index={2}
        />

        {/* 3. Utilidad bruta (RBAC) */}
        <StatCard
          title="Utilidad bruta"
          value={metrics.grossProfit?.value || 0}
          hasData={hasGrossProfit}
          emptyValueText="Sin información disponible"
          isCurrency
          iconName="sales"
          tone="teal"
          badge="Rentabilidad"
          isRedacted={isFinancialRedacted}
          note={hasGrossProfit ? `${metrics.grossProfit?.marginPct}% margen` : 'Sin datos suficientes'}
          isPositive={true}
          isNeutralNote={!hasGrossProfit}
          subtext={hasGrossProfit ? `+${metrics.grossProfit?.deltaPct}% vs anterior` : 'Sin ventas para calcular utilidad'}
          index={3}
        />

        {/* 4. Inventario a costo (RBAC) */}
        <StatCard
          title="Inventario a costo"
          value={metrics.inventoryAtCost?.value || 0}
          hasData={hasInventoryValue}
          emptyValueText="Sin información disponible"
          isCurrency
          iconName="inventory"
          tone="blue"
          badge="Valoración"
          isRedacted={isFinancialRedacted}
          note={hasInventoryValue ? `${metrics.inventoryAtCost?.deltaPct}% rotación` : 'Sin existencias'}
          isPositive={false}
          isNeutralNote={!hasInventoryValue}
          subtext={hasInventoryValue ? 'Ver módulo Inventario →' : 'Sin inventario registrado'}
          onClick={() => onNavigate?.('Inventario')}
          index={4}
        />

        {/* 5. Total de productos */}
        <StatCard
          title="Productos en catálogo"
          value={metrics.productsCount.total}
          hasData={hasProducts}
          emptyValueText="0 productos"
          iconName="products"
          tone="blue"
          badge="Catálogo"
          note={hasProducts ? `${metrics.productsCount.active} activos` : 'Sin productos'}
          isPositive={hasProducts}
          isNeutralNote={!hasProducts}
          subtext={hasProducts ? `${metrics.productsCount.outOfStock} agotados` : 'Catálogo vacío'}
          onClick={() => onNavigate?.('Productos')}
          index={5}
        />

        {/* 6. Stock bajo / Alertas */}
        <StatCard
          title="Stock bajo crítico"
          value={metrics.productsCount.lowStock}
          hasData={true}
          iconName="warning"
          tone="amber"
          badge="Alertas"
          note={hasProducts ? (metrics.productsCount.lowStock > 0 ? 'Bajo mínimo' : 'En nivel óptimo') : 'Sin alertas'}
          isPositive={metrics.productsCount.lowStock === 0}
          isNeutralNote={!hasProducts}
          subtext={hasProducts ? `${metrics.productsCount.critical} urgentes · Ver en Inventario →` : 'Sin productos registrados'}
          onClick={() => onNavigate?.('Inventario')}
          index={6}
        />

        {/* 7. Transferencias pendientes */}
        <StatCard
          title="Transferencias activas"
          value={metrics.pendingTransfers.total}
          hasData={true}
          iconName="transfers"
          tone="blue"
          badge="Logística"
          note={metrics.pendingTransfers.total > 0 ? `${metrics.pendingTransfers.inTransit} en tránsito` : 'Sin transferencias'}
          isPositive={true}
          isNeutralNote={metrics.pendingTransfers.total === 0}
          subtext={metrics.pendingTransfers.total > 0 ? `${metrics.pendingTransfers.pending} por despachar` : '0 movimientos en curso'}
          index={7}
        />

        {/* 8. Pedidos Web */}
        <StatCard
          title="Pedidos web hoy"
          value={metrics.webOrders.totalToday}
          hasData={true}
          iconName="webOrders"
          tone="red"
          badge="Ecommerce"
          note={metrics.webOrders.totalToday > 0 ? `${metrics.webOrders.newOrders} nuevos` : 'Sin pedidos web'}
          isPositive={true}
          isNeutralNote={metrics.webOrders.totalToday === 0}
          subtext={metrics.webOrders.totalToday > 0 ? `${metrics.webOrders.preparing} alistando` : '0 pedidos recibidos hoy'}
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
            hasData={hasPurchases}
            emptyValueText="Sin información disponible"
            isCurrency
            iconName="purchases"
            tone="teal"
            badge="Abastecimiento"
            isRedacted={isFinancialRedacted}
            note={hasPurchases ? `${metrics.purchases?.count} facturas` : 'Sin datos suficientes'}
            isPositive={true}
            isNeutralNote={!hasPurchases}
            subtext={hasPurchases ? 'Entradas registradas' : '0 compras a proveedores'}
            index={9}
          />

          {/* Cuentas por pagar */}
          <StatCard
            title="Cuentas por pagar"
            value={metrics.accountsPayable?.pendingBalance || 0}
            hasData={(metrics.accountsPayable?.pendingBalance || 0) > 0}
            emptyValueText="Sin información disponible"
            isCurrency
            iconName="cashRegisters"
            tone="amber"
            badge="Tesorería"
            isRedacted={isFinancialRedacted}
            note={(metrics.accountsPayable?.pendingBalance || 0) > 0 ? `${metrics.accountsPayable?.dueSoonCount} por vencer` : 'Al día'}
            isPositive={(metrics.accountsPayable?.pendingBalance || 0) === 0}
            isNeutralNote={(metrics.accountsPayable?.pendingBalance || 0) === 0}
            subtext={(metrics.accountsPayable?.pendingBalance || 0) > 0 ? 'Saldo a proveedores' : '0 pasivos pendientes'}
            index={10}
          />

          {/* Productos agotados */}
          <StatCard
            title="Productos sin existencias"
            value={metrics.productsCount.outOfStock}
            hasData={true}
            iconName="close"
            tone="red"
            badge="Agotados"
            note={hasProducts ? (metrics.productsCount.outOfStock > 0 ? 'Requieren compra' : 'Stock cubierto') : 'Sin productos'}
            isPositive={metrics.productsCount.outOfStock === 0}
            isNeutralNote={!hasProducts}
            subtext={hasProducts ? `${metrics.productsCount.outOfStock} referencias en 0` : 'Catálogo vacío'}
            index={11}
          />

          {/* Alertas del sistema */}
          <StatCard
            title="Alertas activas totales"
            value={metrics.activeAlerts ? metrics.activeAlerts.total : 0}
            hasData={true}
            iconName="alerts"
            tone="amber"
            badge="Incidencias"
            note={metrics.activeAlerts && metrics.activeAlerts.total > 0 ? `${metrics.activeAlerts.total} por resolver` : 'Todo en orden'}
            isPositive={!metrics.activeAlerts || metrics.activeAlerts.total === 0}
            isNeutralNote={!metrics.activeAlerts || metrics.activeAlerts.total === 0}
            subtext={metrics.activeAlerts && metrics.activeAlerts.total > 0 ? `${metrics.activeAlerts.inventory} inventario` : '0 incidencias reportadas'}
            index={12}
          />
        </div>
      )}
    </section>
  )
}
