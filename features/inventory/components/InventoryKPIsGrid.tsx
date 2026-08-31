'use client'

import React, { useEffect, useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { InventoryKPIs, InventoryTabFilter } from '../types'
import { inventoryService } from '../services/inventory.service'

interface InventoryKPIsGridProps {
  kpis: InventoryKPIs
  activeTab?: InventoryTabFilter
  onSelectTab?: (tab: InventoryTabFilter) => void
  isLoading?: boolean
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

export function InventoryKPIsGrid({
  kpis,
  activeTab,
  onSelectTab,
  isLoading = false,
}: InventoryKPIsGridProps) {
  const animatedUnits = useCountUp(kpis.totalUnitsAvailable)
  const animatedWithStock = useCountUp(kpis.productsWithStock)
  const animatedLow = useCountUp(kpis.lowStockCount)
  const animatedCritical = useCountUp(kpis.criticalStockCount)
  const animatedOut = useCountUp(kpis.outOfStockCount)

  const cards = [
    {
      id: 'total-value',
      label: 'Valor total a costo',
      value: kpis.isCostRedacted
        ? '••••••••'
        : inventoryService.formatCOP(kpis.totalValueAtCost, true),
      subtext: kpis.isCostRedacted ? 'Protegido por permisos' : 'Valor consolidado en bodegas',
      iconName: 'wallet' as const,
      tone: 'blue',
      clickable: false,
      tab: 'ALL' as InventoryTabFilter,
    },
    {
      id: 'total-units',
      label: 'Unidades disponibles',
      value: `${animatedUnits.toLocaleString('es-CO')} uds`,
      subtext: 'Existencias físicas totales',
      iconName: 'inventory' as const,
      tone: 'teal',
      clickable: true,
      tab: 'ALL' as InventoryTabFilter,
    },
    {
      id: 'products-stock',
      label: 'Productos con existencia',
      value: `${animatedWithStock} SKUs`,
      subtext: 'Artículos con saldo positivo',
      iconName: 'products' as const,
      tone: 'navy',
      clickable: true,
      tab: 'ALL' as InventoryTabFilter,
    },
    {
      id: 'low-stock',
      label: 'Stock bajo',
      value: `${animatedLow} prods`,
      subtext: 'Por debajo del mínimo',
      iconName: 'warning' as const,
      tone: 'amber',
      clickable: true,
      tab: 'LOW_STOCK' as InventoryTabFilter,
      badgeColor: '#d97706',
    },
    {
      id: 'critical-stock',
      label: 'Stock crítico',
      value: `${animatedCritical} prods`,
      subtext: 'Atención urgente de surtido',
      iconName: 'warning' as const,
      tone: 'red',
      clickable: true,
      tab: 'CRITICAL' as InventoryTabFilter,
      badgeColor: '#dc2626',
    },
    {
      id: 'out-of-stock',
      label: 'Agotados',
      value: `${animatedOut} prods`,
      subtext: 'Existencia en 0 unidades',
      iconName: 'close' as const,
      tone: 'dark-red',
      clickable: true,
      tab: 'OUT_OF_STOCK' as InventoryTabFilter,
      badgeColor: '#991b1b',
    },
  ]

  return (
    <div className="stats-grid inventory-kpis-grid">
      {cards.map((card, idx) => {
        const isSelected = activeTab === card.tab && card.clickable && card.tab !== 'ALL'

        return (
          <div
            key={card.id}
            className={`stat-card inventory-stat-card ${
              card.clickable ? 'clickable' : ''
            } ${isSelected ? 'active-filter-card' : ''}`}
            style={{ animationDelay: `${idx * 0.05}s` }}
            onClick={() => {
              if (card.clickable && onSelectTab) {
                onSelectTab(card.tab)
              }
            }}
            role={card.clickable ? 'button' : undefined}
            tabIndex={card.clickable ? 0 : undefined}
          >
            <div className={`stat-icon ${card.tone}`}>
              <AppIcon name={card.iconName} size={18} />
            </div>

            <div className="stat-text">
              <span>{card.label}</span>
              <strong>{isLoading ? '...' : card.value}</strong>
              <small>{card.subtext}</small>
            </div>
          </div>
        )
      })}
    </div>
  )
}
