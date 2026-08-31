'use client'

import React, { useEffect, useState } from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { InventoryKPIs, InventoryTabFilter } from '../types'
import { inventoryService } from '../services/inventory.service'

interface InventoryKPIsGridProps {
  kpis: InventoryKPIs
  activeTab?: InventoryTabFilter
  onSelectTab?: (tab: InventoryTabFilter) => void
  isLoading?: boolean
}

interface InventoryStatCardProps {
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
  clickable?: boolean
  isSelected?: boolean
  onClick?: () => void
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

function InventoryStatCard({
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
  clickable = false,
  isSelected = false,
  onClick,
}: InventoryStatCardProps) {
  return (
    <article
      className={`dashboard-kpi-card tone-${tone} ${isRedacted ? 'is-redacted' : ''} ${
        clickable ? 'clickable cursor-pointer hover-lift' : ''
      } ${isSelected ? 'active-filter-card' : ''}`}
      style={{
        animationDelay: `${index * 0.05}s`,
        cursor: clickable ? 'pointer' : 'default',
      }}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
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

export function InventoryKPIsGrid({
  kpis,
  activeTab,
  onSelectTab,
}: InventoryKPIsGridProps) {
  const animatedUnits = useCountUp(kpis.totalUnitsAvailable)
  const animatedWithStock = useCountUp(kpis.productsWithStock)
  const animatedLow = useCountUp(kpis.lowStockCount)
  const animatedCritical = useCountUp(kpis.criticalStockCount)
  const animatedOut = useCountUp(kpis.outOfStockCount)

  const formattedCostValue = kpis.isCostRedacted
    ? '••••••••'
    : inventoryService.formatCOP(kpis.totalValueAtCost, true)

  return (
    <section
      className="stats-grid products-stats-grid page-enter"
      aria-label="KPIs de inventario"
    >
      {/* 1. Valor total a costo */}
      <InventoryStatCard
        title="Valor total a costo"
        value={formattedCostValue}
        iconName="wallet"
        tone="blue"
        badge="Valoración"
        note="A costo promedio"
        isPositive={true}
        subtext={kpis.isCostRedacted ? 'Protegido por permisos' : 'Valor consolidado en bodegas'}
        isRedacted={kpis.isCostRedacted}
        index={1}
      />

      {/* 2. Unidades disponibles */}
      <InventoryStatCard
        title="Unidades disponibles"
        value={`${animatedUnits.toLocaleString('es-CO')} uds`}
        iconName="inventory"
        tone="teal"
        badge="Físico"
        note="Todas las sedes"
        isPositive={true}
        subtext="Existencias físicas totales"
        clickable={true}
        isSelected={activeTab === 'ALL'}
        onClick={() => onSelectTab?.('ALL')}
        index={2}
      />

      {/* 3. Productos con existencia */}
      <InventoryStatCard
        title="Productos con existencia"
        value={`${animatedWithStock} SKUs`}
        iconName="products"
        tone="blue"
        badge="Catálogo"
        note="Con saldo positivo"
        isPositive={true}
        subtext="Artículos disponibles"
        clickable={true}
        isSelected={false}
        onClick={() => onSelectTab?.('ALL')}
        index={3}
      />

      {/* 4. Stock bajo */}
      <InventoryStatCard
        title="Stock bajo"
        value={`${animatedLow} prods`}
        iconName="warning"
        tone="amber"
        badge="Alerta"
        note="Por debajo del mín."
        isPositive={false}
        subtext="Umbral de reabastecimiento"
        clickable={true}
        isSelected={activeTab === 'LOW_STOCK'}
        onClick={() => onSelectTab?.('LOW_STOCK')}
        index={4}
      />

      {/* 5. Stock crítico */}
      <InventoryStatCard
        title="Stock crítico"
        value={`${animatedCritical} prods`}
        iconName="warning"
        tone="red"
        badge="Crítico"
        note="Atención urgente"
        isPositive={false}
        subtext="Riesgo de desabastecimiento"
        clickable={true}
        isSelected={activeTab === 'CRITICAL'}
        onClick={() => onSelectTab?.('CRITICAL')}
        index={5}
      />

      {/* 6. Agotados */}
      <InventoryStatCard
        title="Productos agotados"
        value={`${animatedOut} prods`}
        iconName="close"
        tone="red"
        badge="Sin stock"
        note="Saldo cero"
        isPositive={false}
        subtext="Existencia en 0 unidades"
        clickable={true}
        isSelected={activeTab === 'OUT_OF_STOCK'}
        onClick={() => onSelectTab?.('OUT_OF_STOCK')}
        index={6}
      />
    </section>
  )
}
