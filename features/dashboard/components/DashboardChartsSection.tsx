'use client'

import React, { useState } from 'react'
import {
  TrendingUp,
  CircleDollarSign,
  PieChart,
  ShoppingBag,
  Info,
  Calendar,
  Layers,
} from 'lucide-react'
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
    (acc, curr, i) => (i === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`),
    ''
  )
  const salesAreaPath =
    salesPoints.length > 0
      ? `${salesPath} L ${salesPoints[salesPoints.length - 1].x} ${
          chartHeight - paddingY
        } L ${salesPoints[0].x} ${chartHeight - paddingY} Z`
      : ''

  // Generate SVG Path for Purchases
  const purchasesPoints = chartPoints.map((p, i) => getCoordinates(i, p.purchases || 0))
  const purchasesPath = purchasesPoints.reduce(
    (acc, curr, i) => (i === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`),
    ''
  )

  // Total sales & purchases for the chart period
  const totalPeriodSales = chartPoints.reduce((acc, p) => acc + p.sales, 0)
  const totalPeriodPurchases = chartPoints.reduce((acc, p) => acc + (p.purchases || 0), 0)

  return (
    <div className="dashboard-grid analytics-grid page-enter">
      {/* 1. Main Temporal Chart Panel */}
      <section className="panel chart-panel">
        <div className="panel-heading">
          <div>
            <div className="panel-title-row">
              <TrendingUp size={16} color="var(--navy)" />
              <h2>Evolución de ventas y abastecimiento</h2>
            </div>
            <p>
              Comportamiento financiero y volumen de transacciones del periodo seleccionado
            </p>
          </div>

          <div className="chart-mode-toggles">
            {canSeeFinancials && (
              <div className="segmented">
                <button
                  className={activeChartMode === 'SALES_PURCHASES' ? 'selected' : ''}
                  onClick={() => setActiveChartMode('SALES_PURCHASES')}
                >
                  Ventas vs Compras
                </button>
                <button
                  className={activeChartMode === 'PROFIT' ? 'selected' : ''}
                  onClick={() => setActiveChartMode('PROFIT')}
                >
                  Utilidad bruta
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Metric Bar */}
        <div className="chart-quick-metrics">
          <div className="metric-chip">
            <span className="metric-chip-label">Total vendido:</span>
            <strong className="metric-chip-val sales-color">
              {dashboardService.formatCOP(totalPeriodSales, true)}
            </strong>
          </div>
          {canSeeFinancials && activeChartMode === 'SALES_PURCHASES' && (
            <div className="metric-chip">
              <span className="metric-chip-label">Total comprado:</span>
              <strong className="metric-chip-val purchases-color">
                {dashboardService.formatCOP(totalPeriodPurchases, true)}
              </strong>
            </div>
          )}
        </div>

        {/* Interactive SVG Chart Container */}
        <div
          className="interactive-svg-chart-wrap"
          onMouseLeave={() => {
            setHoveredPoint(null)
            setHoverPosition(null)
          }}
        >
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="main-svg-chart"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#001b5c" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#001b5c" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#159a67" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#159a67" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {[0.25, 0.5, 0.75].map((ratio) => {
              const y = chartHeight - paddingY - ratio * (chartHeight - paddingY * 2)
              return (
                <line
                  key={ratio}
                  x1={paddingX}
                  y1={y}
                  x2={chartWidth - paddingX}
                  y2={y}
                  stroke="var(--line)"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
              )
            })}

            {/* Sales Area Fill */}
            <path d={salesAreaPath} fill="url(#salesGradient)" />

            {/* Purchases Line (if permitted) */}
            {canSeeFinancials && activeChartMode === 'SALES_PURCHASES' && (
              <path
                d={purchasesPath}
                fill="none"
                stroke="#fe110c"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                className="animated-chart-path purchases-line"
              />
            )}

            {/* Sales Line */}
            <path
              d={salesPath}
              fill="none"
              stroke="#001b5c"
              strokeWidth="3"
              className="animated-chart-path sales-line"
            />

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
                    onMouseEnter={(e) => {
                      setHoveredPoint(pt)
                      const rect = e.currentTarget.getBoundingClientRect()
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
              <PieChart size={16} color="var(--navy)" />
              <h2>Distribución del inventario</h2>
            </div>
            <p>Participación por bodega y sede de venta</p>
          </div>
        </div>

        <div className="donut-distribution-body">
          <div className="donut-wrap">
            <div className="custom-donut-circle">
              <div className="donut-inner-content">
                <strong>{distribution.reduce((a, b) => a + b.percentage, 0).toFixed(0)}%</strong>
                <span>Operativo</span>
              </div>
            </div>

            <div className="distribution-legend-list">
              {distribution.map((dist) => (
                <div className="dist-item-row" key={dist.locationId}>
                  <div className="dist-item-head">
                    <span
                      className="dist-color-dot"
                      style={{ backgroundColor: dist.color }}
                    />
                    <span className="dist-name">{dist.locationName}</span>
                    <b className="dist-pct">{dist.percentage}%</b>
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
                    {dist.value && (
                      <small className="dist-val">
                        {dashboardService.formatCOP(dist.value, true)}
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
