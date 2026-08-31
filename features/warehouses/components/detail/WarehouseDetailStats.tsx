'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { LocationWithMetrics, PeriodFilter } from '../../types'
import { useCountUp } from '../../hooks/useCountUp'

interface WarehouseDetailStatsProps {
  warehouse: LocationWithMetrics
  period: PeriodFilter
  onPeriodChange: (period: PeriodFilter) => void
  canReadCost: boolean
}

export function WarehouseDetailStats({
  warehouse,
  period,
  onPeriodChange,
  canReadCost,
}: WarehouseDetailStatsProps) {
  const formattedInv = useCountUp(warehouse.inventoryValueAtCost, { isCurrency: true })
  const formattedSales = useCountUp(
    period === 'TODAY' ? warehouse.todaySalesAmount : warehouse.monthSalesAmount,
    { isCurrency: true }
  )
  const formattedPurchases = useCountUp(warehouse.monthPurchasesAmount, { isCurrency: true })
  const formattedProfit = useCountUp(warehouse.estimatedProfit, { isCurrency: true })

  return (
    <section className="detail-stats-section" aria-label="Estadísticas de la bodega">
      {/* Period Selector Bar */}
      <div className="period-row">
        <span className="period-label">Periodo analizado:</span>
        <div className="period-tabs" role="group" aria-label="Selector de periodo">
          {(
            [
              ['TODAY', 'Hoy'],
              ['7_DAYS', '7 días'],
              ['30_DAYS', '30 días'],
              ['MONTH', 'Mes'],
              ['YEAR', 'Año'],
              ['CUSTOM', 'Personalizado'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={period === key ? 'selected' : ''}
              onClick={() => onPeriodChange(key)}
              aria-pressed={period === key}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid inventory-stats">
        {/* Inventario a costo */}
        <article className="stat-card" title="Inventario total valorizado al costo promedio">
          <div className="stat-icon teal">
            <AppIcon name="inventory" size={18} />
          </div>
          <div className="stat-text">
            <span>Inventario a costo</span>
            <strong>{canReadCost ? formattedInv : '••••••••'}</strong>
            <small className="positive">Stock actual real</small>
          </div>
        </article>

        {/* Productos activos */}
        <article className="stat-card">
          <div className="stat-icon blue">
            <AppIcon name="products" size={18} />
          </div>
          <div className="stat-text">
            <span>Productos activos</span>
            <strong>{warehouse.productsCount.toLocaleString('es-CO')}</strong>
            <small className="positive">{warehouse.availableUnits.toLocaleString('es-CO')} unidades</small>
          </div>
        </article>

        {/* Ventas periodo */}
        <article className="stat-card">
          <div className="stat-icon blue">
            <AppIcon name="sales" size={18} />
          </div>
          <div className="stat-text">
            <span>{period === 'TODAY' ? 'Ventas de hoy' : 'Ventas del periodo'}</span>
            <strong>{formattedSales}</strong>
            <small className="positive">+8.4% de efectividad</small>
          </div>
        </article>

        {/* Compras periodo */}
        <article className="stat-card">
          <div className="stat-icon amber">
            <AppIcon name="purchases" size={18} />
          </div>
          <div className="stat-text">
            <span>Compras recibidas</span>
            <strong>{canReadCost ? formattedPurchases : '••••••••'}</strong>
            <small className="positive">Entradas de stock</small>
          </div>
        </article>

        {/* Utilidad y Margen */}
        <article className="stat-card">
          <div className="stat-icon teal">
            <AppIcon name="sales" size={18} />
          </div>
          <div className="stat-text">
            <span>Utilidad estimada</span>
            <strong>{canReadCost ? formattedProfit : '••••••••'}</strong>
            <small className="positive">
              {canReadCost ? `Margen ${warehouse.profitMarginPercent}%` : 'Restringido'}
            </small>
          </div>
        </article>

        {/* Alertas de Stock */}
        <article className="stat-card">
          <div
            className={`stat-icon ${
              warehouse.lowStockProductsCount > 0 || warehouse.outOfStockProductsCount > 0
                ? 'amber'
                : 'teal'
            }`}
          >
            <AppIcon name="warning" size={18} />
          </div>
          <div className="stat-text">
            <span>Stock bajo / Agotados</span>
            <strong
              className={
                warehouse.lowStockProductsCount > 0 ? 'warning-text' : 'positive-text'
              }
            >
              {warehouse.lowStockProductsCount} / {warehouse.outOfStockProductsCount}
            </strong>
            <small
              className={
                warehouse.pendingTransfersCount > 0 ? 'warning-text' : 'positive'
              }
            >
              <AppIcon name="transfers" size={12} />
              {warehouse.pendingTransfersCount} transferencias
            </small>
          </div>
        </article>
      </div>
    </section>
  )
}
