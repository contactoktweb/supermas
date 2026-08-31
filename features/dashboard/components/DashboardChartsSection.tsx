'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import {
  SalesChartPoint,
  InventoryDistributionItem,
  PeriodType,
  UserProfile,
} from '../types'
import { dashboardService } from '../services/dashboard.service'

interface DashboardChartsSectionProps {
  chartPoints: SalesChartPoint[]
  distribution: InventoryDistributionItem[]
  period: PeriodType
  user: UserProfile
}

export function DashboardChartsSection({
  chartPoints,
  distribution,
  period,
  user,
}: DashboardChartsSectionProps) {
  const [activeChartMode, setActiveChartMode] = useState<'SALES_PURCHASES' | 'PROFIT'>('SALES_PURCHASES')
  const [hoveredPoint, setHoveredPoint] = useState<SalesChartPoint | null>(null)
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null)

  const canSeeFinancials = dashboardService.hasFinancialAccess(user.role)

  // Calculations for SVG scaling
  const maxSales = Math.max(...chartPoints.map((p) => p.sales), 1000)
  const maxPurchases = Math.max(...chartPoints.map((p) => p.purchases || 0), 1000)
  const maxVal = Math.max(maxSales, maxPurchases) * 1.15

  const chartWidth = 640
  const chartHeight = 220
  const paddingX = 40
  const paddingY = 30

  const getCoordinates = (index: number, value: number) => {
    const usableWidth = chartWidth - paddingX * 2
    const usableHeight = chartHeight - paddingY * 2
    const x = paddingX + (index / Math.max(1, chartPoints.length - 1)) * usableWidth
    const y = chartHeight - paddingY - (value / maxVal) * usableHeight
    return { x, y }
  }

  // Generate SVG Path for Sales
  const salesPoints = chartPoints.map((p, i) => getCoordinates(i, p.sales))
  const salesPath = salesPoints.reduce(
    (acc, pt, i, arr) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`
      const prev = arr[i - 1]
      const cpX = (prev.x + pt.x) / 2
      return `${acc} C ${cpX} ${prev.y}, ${cpX} ${pt.y}, ${pt.x} ${pt.y}`
    },
    ''
  )
  const salesAreaPath = `${salesPath} L ${salesPoints[salesPoints.length - 1].x} ${chartHeight - paddingY} L ${salesPoints[0].x} ${chartHeight - paddingY} Z`

  // Generate SVG Path for Purchases (if allowed)
  const purchasesPoints = chartPoints.map((p, i) =>
    getCoordinates(i, p.purchases || 0)
  )
  const purchasesPath = purchasesPoints.reduce((acc, pt, i, arr) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`
    const prev = arr[i - 1]
    const cpX = (prev.x + pt.x) / 2
    return `${acc} C ${cpX} ${prev.y}, ${cpX} ${pt.y}, ${pt.x} ${pt.y}`
  }, '')

  // Generate SVG Path for Profit
  const profitPoints = chartPoints.map((p, i) =>
    getCoordinates(i, p.profit || 0)
  )
  const profitPath = profitPoints.reduce((acc, pt, i, arr) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`
    const prev = arr[i - 1]
    const cpX = (prev.x + pt.x) / 2
    return `${acc} C ${cpX} ${prev.y}, ${cpX} ${pt.y}, ${pt.x} ${pt.y}`
  }, '')

  const totalSalesInView = chartPoints.reduce((a, b) => a + b.sales, 0)
  const totalPurchasesInView = chartPoints.reduce((a, b) => a + (b.purchases || 0), 0)

  return (
    <div className="dashboard-grid analytics-grid page-enter">
      {/* 1. Main Interactive Sales & Purchases Chart */}
      <section className="panel chart-panel">
        <div className="panel-heading">
          <div>
            <div className="panel-title-row">
              <AppIcon name="sales" size={16} color="var(--navy)" />
              <h2>Evolución de ventas y transacciones</h2>
            </div>
            <p>Comportamiento comercial y abastecimiento a lo largo del periodo</p>
          </div>

          {canSeeFinancials && (
            <div className="segmented">
              <button
                type="button"
                className={activeChartMode === 'SALES_PURCHASES' ? 'selected' : ''}
                onClick={() => setActiveChartMode('SALES_PURCHASES')}
              >
                Ventas vs Compras
              </button>
              <button
                type="button"
                className={activeChartMode === 'PROFIT' ? 'selected' : ''}
                onClick={() => setActiveChartMode('PROFIT')}
              >
                Utilidad bruta
              </button>
            </div>
          )}
        </div>

        {/* Quick summary chips above chart */}
        <div className="chart-quick-metrics">
          <div className="metric-chip">
            <span className="metric-chip-label">Total ventas periodo:</span>
            <strong className="metric-chip-val sales-color">
              {dashboardService.formatCOP(totalSalesInView, true)}
            </strong>
          </div>
          {canSeeFinancials && activeChartMode === 'SALES_PURCHASES' && (
            <div className="metric-chip">
              <span className="metric-chip-label">Total compras:</span>
              <strong className="metric-chip-val purchases-color">
                {dashboardService.formatCOP(totalPurchasesInView, true)}
              </strong>
            </div>
          )}
        </div>

        {/* SVG Interactive Chart */}
        <div className="interactive-svg-chart-wrap">
          <svg
            className="main-svg-chart"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            preserveAspectRatio="none"
            onMouseLeave={() => {
              setHoveredPoint(null)
              setHoverPosition(null)
            }}
          >
            <defs>
              <linearGradient id="salesGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#001b5c" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#001b5c" stopOpacity="0.00" />
              </linearGradient>
              <linearGradient id="profitGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0284c7" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.00" />
              </linearGradient>
            </defs>

            {/* Grid horizontal lines */}
            {[0.2, 0.5, 0.8].map((ratio) => {
              const y = chartHeight - paddingY - ratio * (chartHeight - paddingY * 2)
              return (
                <line
                  key={ratio}
                  x1={paddingX}
                  y1={y}
                  x2={chartWidth - paddingX}
                  y2={y}
                  stroke="#e8edf5"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
              )
            })}

            {/* Sales Area Fill */}
            {activeChartMode === 'SALES_PURCHASES' && (
              <path d={salesAreaPath} fill="url(#salesGrad)" />
            )}

            {/* Purchases Curve (Red) */}
            {canSeeFinancials &&
              activeChartMode === 'SALES_PURCHASES' &&
              totalPurchasesInView > 0 && (
                <path
                  d={purchasesPath}
                  fill="none"
                  stroke="#fe110c"
                  strokeWidth="2"
                  strokeDasharray="5 4"
                  className="animated-chart-path"
                />
              )}

            {/* Profit Curve (Teal/Sky) */}
            {canSeeFinancials && activeChartMode === 'PROFIT' && (
              <path
                d={profitPath}
                fill="url(#profitGrad)"
                stroke="#0284c7"
                strokeWidth="2.5"
                className="animated-chart-path"
              />
            )}

            {/* Sales Curve (Navy) */}
            {activeChartMode === 'SALES_PURCHASES' && (
              <path
                d={salesPath}
                fill="none"
                stroke="#001b5c"
                strokeWidth="2.5"
                className="animated-chart-path"
              />
            )}

            {/* X-Axis Labels */}
            {chartPoints.map((pt, idx) => {
              const coords = getCoordinates(idx, 0)
              const showLabel =
                chartPoints.length <= 8 || idx % Math.ceil(chartPoints.length / 7) === 0
              if (!showLabel) return null

              return (
                <text
                  key={pt.label}
                  x={coords.x}
                  y={chartHeight - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#71829e"
                >
                  {pt.label}
                </text>
              )
            })}

            {/* Points and Hover Areas */}
            {chartPoints.map((pt, idx) => {
              const coords = getCoordinates(idx, pt.sales)
              const isHovered = hoveredPoint?.label === pt.label

              return (
                <g key={pt.label}>
                  <circle
                    cx={coords.x}
                    cy={coords.y}
                    r={isHovered ? 6 : 4}
                    className={`chart-point-circle ${isHovered ? 'is-active' : ''}`}
                    fill="#fff"
                    stroke="#001b5c"
                    strokeWidth={isHovered ? 3 : 2}
                  />

                  {/* Invisible Hitbox for touch/mouse */}
                  <rect
                    x={coords.x - 25}
                    y={0}
                    width={50}
                    height={chartHeight}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => {
                      setHoveredPoint(pt)
                      setHoverPosition({ x: coords.x, y: coords.y })
                    }}
                  />
                </g>
              )
            })}
          </svg>

          {/* Floating Tooltip */}
          {hoveredPoint && hoverPosition && (
            <div
              className="chart-floating-tooltip"
              style={{
                left: `${(hoverPosition.x / chartWidth) * 100}%`,
                top: `${(hoverPosition.y / chartHeight) * 100 - 15}%`,
              }}
            >
              <div className="tooltip-header">
                <strong>{hoveredPoint.label}</strong>
                <span>{hoveredPoint.transactions} ventas</span>
              </div>
              <div className="tooltip-body">
                <div className="tooltip-row">
                  <span className="dot blue-bg" />
                  <span>Ventas:</span>
                  <b>{dashboardService.formatCOP(hoveredPoint.sales)}</b>
                </div>
                {canSeeFinancials && hoveredPoint.purchases > 0 && (
                  <div className="tooltip-row">
                    <span className="dot red-bg" />
                    <span>Compras:</span>
                    <b>{dashboardService.formatCOP(hoveredPoint.purchases)}</b>
                  </div>
                )}
                {canSeeFinancials && hoveredPoint.profit && (
                  <div className="tooltip-row">
                    <span className="dot teal-bg" />
                    <span>Utilidad:</span>
                    <b className="positive-text">
                      {dashboardService.formatCOP(hoveredPoint.profit)}
                    </b>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Chart Legend */}
        <div className="chart-legend">
          <span>
            <i className="legend-blue" /> Ventas facturadas
          </span>
          {canSeeFinancials && activeChartMode === 'SALES_PURCHASES' && (
            <span>
              <i className="legend-red" /> Compras / Abastecimiento
            </span>
          )}
          {canSeeFinancials && activeChartMode === 'PROFIT' && (
            <span>
              <i className="teal-bg" /> Utilidad neta estimada
            </span>
          )}
        </div>
      </section>

      {/* 2. Inventory Distribution Donut Panel */}
      <section className="panel distribution-panel">
        <div className="panel-heading">
          <div>
            <div className="panel-title-row">
              <AppIcon name="pieChart" size={16} color="var(--navy)" />
              <h2>Distribución del inventario</h2>
            </div>
            <p>Participación por valor del inventario a costo</p>
          </div>
        </div>

        <div className="donut-distribution-body">
          <div className="donut-wrap">
            {/* Dynamic SVG Donut Chart */}
            <div className="donut-chart-container">
              {(() => {
                const donutRadius = 60
                const donutCircumference = 2 * Math.PI * donutRadius
                const totalCostValue = distribution.reduce(
                  (sum, item) => sum + (item.value || 0),
                  0
                )
                const totalUnits = distribution.reduce(
                  (sum, item) => sum + (item.units || 0),
                  0
                )

                let accumulatedPercent = 0

                return (
                  <>
                    <svg
                      viewBox="0 0 160 160"
                      width="160"
                      height="160"
                      className="donut-svg-chart"
                      aria-label="Distribución gráfica del inventario por bodega"
                    >
                      {/* Base Track */}
                      <circle
                        cx="80"
                        cy="80"
                        r={donutRadius}
                        fill="transparent"
                        stroke="#f1f5f9"
                        strokeWidth="18"
                      />

                      {/* Dynamic Slices */}
                      {distribution.map((dist) => {
                        const strokeLength =
                          (dist.percentage / 100) * donutCircumference
                        const strokeOffset =
                          -(accumulatedPercent / 100) * donutCircumference
                        accumulatedPercent += dist.percentage

                        return (
                          <circle
                            key={dist.locationId}
                            cx="80"
                            cy="80"
                            r={donutRadius}
                            fill="transparent"
                            stroke={dist.color}
                            strokeWidth="18"
                            strokeDasharray={`${strokeLength} ${donutCircumference}`}
                            strokeDashoffset={strokeOffset}
                            transform="rotate(-90 80 80)"
                            className="donut-slice-circle"
                          >
                            <title>
                              {dist.locationName}: {dist.percentage}% (
                              {dist.units.toLocaleString('es-CO')} uds
                              {dist.value
                                ? ` · ${dashboardService.formatCOP(dist.value, true)}`
                                : ''}
                              )
                            </title>
                          </circle>
                        )
                      })}
                    </svg>

                    {/* Donut Center Overlay */}
                    <div className="donut-center-overlay">
                      <span className="donut-center-label">Inventario total</span>
                      <strong className="donut-center-value">
                        {canSeeFinancials && totalCostValue > 0
                          ? dashboardService.formatCOP(totalCostValue, true)
                          : `${totalUnits.toLocaleString('es-CO')} uds`}
                      </strong>
                    </div>
                  </>
                )
              })()}
            </div>

            {/* Warehouse Distribution Legend List */}
            <div className="distribution-legend-list">
              {distribution.map((dist) => (
                <div className="dist-item-row" key={dist.locationId}>
                  <div className="dist-item-head">
                    <span
                      className="dist-color-dot"
                      style={{ backgroundColor: dist.color }}
                    />
                    <span className="dist-name">{dist.locationName}</span>
                    <b className="dist-pct">{dist.percentage.toFixed(1)}%</b>
                  </div>

                  <div className="dist-bar-track">
                    <i
                      className="dist-bar-fill"
                      style={{
                        width: `${dist.percentage}%`,
                        backgroundColor: dist.color,
                      }}
                    />
                  </div>

                  <div className="dist-metrics-sub">
                    <small>{dist.units.toLocaleString('es-CO')} uds</small>
                    {canSeeFinancials && typeof dist.value === 'number' ? (
                      <small className="dist-val">
                        {dashboardService.formatCOP(dist.value, true)}
                      </small>
                    ) : (
                      <small className="dist-val" style={{ color: 'var(--muted)' }}>
                        ••••••••
                      </small>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
