'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { GlobalProductsStats } from '../types'
import { useCountUp } from '@/features/warehouses/hooks/useCountUp'

interface ProductStatsProps {
  stats: GlobalProductsStats
}

interface ProductStatCardProps {
  title: string
  value: number
  isCurrency?: boolean
  isPercent?: boolean
  iconName: LightIconName
  tone: 'blue' | 'red' | 'teal' | 'amber' | 'purple'
  badge: string
  note?: string
  isPositive?: boolean
  subtext?: string
  isRedacted?: boolean
  index: number
}

function ProductStatCard({
  title,
  value,
  isCurrency = false,
  isPercent = false,
  iconName,
  tone,
  badge,
  note,
  isPositive = true,
  subtext,
  isRedacted = false,
  index,
}: ProductStatCardProps) {
  const animatedValue = useCountUp(isRedacted ? 0 : value, {
    isCurrency,
    isPercent,
    decimals: 0,
  })

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
            <strong className="kpi-card-value">{animatedValue}</strong>
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

export function ProductStats({ stats }: ProductStatsProps) {
  return (
    <section className="stats-grid products-stats-grid page-enter" aria-label="Estadísticas de catálogo">
      {/* 1. Total de productos */}
      <ProductStatCard
        title="Total de productos"
        value={stats.totalProducts}
        iconName="products"
        tone="blue"
        badge="Catálogo"
        note="Total registrado"
        isPositive={true}
        subtext="En base de datos"
        index={1}
      />

      {/* 2. Productos activos */}
      <ProductStatCard
        title="Productos activos"
        value={stats.activeProducts}
        iconName="check"
        tone="teal"
        badge="Operativos"
        note={`${((stats.activeProducts / Math.max(1, stats.totalProducts)) * 100).toFixed(0)}% del total`}
        isPositive={true}
        subtext="Disponibles para venta"
        index={2}
      />

      {/* 3. Productos agotados */}
      <ProductStatCard
        title="Productos agotados"
        value={stats.outOfStockProducts}
        iconName="close"
        tone="red"
        badge="Sin stock"
        note="Requieren compra"
        isPositive={false}
        subtext="0 existencias"
        index={3}
      />

      {/* 4. Stock bajo */}
      <ProductStatCard
        title="Stock bajo"
        value={stats.lowStockProducts}
        iconName="warning"
        tone="amber"
        badge="Bajo mínimo"
        note="Bajo umbral"
        isPositive={false}
        subtext="Reabastecer pronto"
        index={4}
      />

      {/* 5. Valor total inventario (RBAC) */}
      <ProductStatCard
        title="Valor inventario a costo"
        value={stats.totalInventoryValueAtCost}
        isCurrency
        iconName="sales"
        tone="blue"
        badge="Costo"
        isRedacted={stats.isCostRedacted}
        note="Valorización"
        isPositive={true}
        subtext="Todas las bodegas"
        index={5}
      />

      {/* 6. Publicados en web */}
      <ProductStatCard
        title="Publicados en web"
        value={stats.webPublishedProducts}
        iconName="webOrders"
        tone="teal"
        badge="Ecommerce"
        note="Catálogos online"
        isPositive={true}
        subtext="Super Más + Dist."
        index={6}
      />
    </section>
  )
}
