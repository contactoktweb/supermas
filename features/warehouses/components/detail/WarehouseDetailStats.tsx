'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { LocationWithMetrics, PeriodFilter } from '../../types'
import { useCountUp } from '../../hooks/useCountUp'
import { DateRangePicker, DateRangeValue } from '@/components/ui/DateRangePicker'

interface WarehouseDetailStatsProps {
  warehouse: LocationWithMetrics
  period: PeriodFilter
  onPeriodChange: (period: PeriodFilter) => void
  canReadCost: boolean
  customRange?: { startDate: string; endDate: string }
  onCustomRangeChange?: (range: { startDate: string; endDate: string }) => void
}

export function WarehouseDetailStats({
  warehouse,
  period,
  onPeriodChange,
  canReadCost,
  customRange = { startDate: '2026-08-01', endDate: '2026-08-31' },
  onCustomRangeChange,
}: WarehouseDetailStatsProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false)

  const formattedInv = useCountUp(warehouse.inventoryValueAtCost, { isCurrency: true })
  const formattedSales = useCountUp(
    period === 'TODAY' ? warehouse.todaySalesAmount : warehouse.monthSalesAmount,
    { isCurrency: true }
  )
  const formattedPurchases = useCountUp(warehouse.monthPurchasesAmount, { isCurrency: true })
  const formattedProfit = useCountUp(warehouse.estimatedProfit, { isCurrency: true })

  const handlePeriodClick = (key: PeriodFilter) => {
    if (key === 'CUSTOM') {
      onPeriodChange('CUSTOM')
      setIsPickerOpen((prev) => (period === 'CUSTOM' ? !prev : true))
    } else {
      setIsPickerOpen(false)
      onPeriodChange(key)
    }
  }

  const handleRangeApply = (range: DateRangeValue) => {
    if (onCustomRangeChange) {
      onCustomRangeChange(range)
    }
    onPeriodChange('CUSTOM')
  }

  return (
    <section className="detail-stats-section" aria-label="Estadísticas de la bodega">
      {/* Period Selector Bar */}
      <div className="period-row">
        <span className="period-label">Periodo analizado:</span>
        <div className="period-tabs-wrapper" style={{ position: 'relative' }}>
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
            ).map(([key, label]) => {
              const isCustom = key === 'CUSTOM'
              const isSelected = period === key

              return (
                <button
                  key={key}
                  type="button"
                  className={`${isSelected ? 'selected' : ''} ${
                    isCustom ? 'custom-period-btn' : ''
                  }`}
                  onClick={() => handlePeriodClick(key)}
                  aria-pressed={isSelected}
                >
                  {isCustom && isSelected ? (
                    <span className="custom-tab-content">
                      <AppIcon name="calendar" size={12} />
                      <span>{label}</span>
                      <small className="custom-dates-pill">
                        {customRange.startDate.substring(5).replace('-', '/')} -{' '}
                        {customRange.endDate.substring(5).replace('-', '/')}
                      </small>
                    </span>
                  ) : (
                    label
                  )}
                </button>
              )
            })}
          </div>

          <DateRangePicker
            isOpen={isPickerOpen}
            value={customRange}
            onChange={handleRangeApply}
            onClose={() => setIsPickerOpen(false)}
            align="right"
          />
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
