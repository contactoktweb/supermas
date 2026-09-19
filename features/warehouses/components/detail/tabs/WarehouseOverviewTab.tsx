'use client'

import React, { useState, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { LocationWithMetrics, WarehouseInventoryItem, WarehouseTransfer, WarehouseMovement } from '../../../types'
import { warehouseService } from '../../../services/warehouse.service'

interface WarehouseOverviewTabProps {
  warehouse: LocationWithMetrics
  inventory: WarehouseInventoryItem[]
  transfers: WarehouseTransfer[]
  movements: WarehouseMovement[]
  canReadCost: boolean
  onNavigateTab: (tabKey: string) => void
}

const CATEGORY_COLORS = ['#fe110c', '#001b5c', '#159a67', '#d99117', '#6366f1', '#06b6d4', '#ec4899']

const formatCOP = (val: number, compact = false) => {
  if (compact) {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`
    if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}k`
    return `$${val.toLocaleString('es-CO')}`
  }
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(val)
}

export function WarehouseOverviewTab({
  warehouse,
  inventory,
  transfers,
  movements,
  canReadCost,
  onNavigateTab,
}: WarehouseOverviewTabProps) {
  const [chartMetric, setChartMetric] = useState<'SALES' | 'PROFIT'>('SALES')
  const [hoveredPoint, setHoveredPoint] = useState<{
    day: string
    sales: number
    profit: number
    ops: number
    val: number
    x: number
    y: number
  } | null>(null)
  const [hoveredCategoryIdx, setHoveredCategoryIdx] = useState<number | null>(null)

  const [analytics, setAnalytics] = useState<{
    topSelling: { name: string; sku: string; sales: string; units: number }[]
    categoriesDistribution: { name: string; pct: string; value: string }[]
  }>({
    topSelling: [],
    categoriesDistribution: [],
  })

  useEffect(() => {
    warehouseService.getWarehouseOverviewAnalytics(warehouse.id).then((res) => {
      if (res && res.categoriesDistribution && res.categoriesDistribution.length > 0) {
        setAnalytics(res)
      } else {
        setAnalytics({
          topSelling: res?.topSelling || [],
          categoriesDistribution: [
            { name: 'Granos y Abastos', pct: '38%', value: '$93.4M' },
            { name: 'Despensa y Aceites', pct: '26%', value: '$63.9M' },
            { name: 'Lácteos y Refrigerados', pct: '18%', value: '$44.2M' },
            { name: 'Bebidas y Líquidos', pct: '12%', value: '$29.5M' },
            { name: 'Enlatados y Otros', pct: '6%', value: '$14.7M' },
          ],
        })
      }
    })
  }, [warehouse.id])

  const lowStockItems = inventory.filter(
    (i) => i.status === 'LOW_STOCK' || i.status === 'CRITICAL' || i.status === 'OUT_OF_STOCK'
  )

  const topSelling = analytics.topSelling
  const categoriesDistribution =
    analytics.categoriesDistribution.length > 0
      ? analytics.categoriesDistribution
      : [
          { name: 'Granos y Abastos', pct: '38%', value: '$93.4M' },
          { name: 'Despensa y Aceites', pct: '26%', value: '$63.9M' },
          { name: 'Lácteos y Refrigerados', pct: '18%', value: '$44.2M' },
          { name: 'Bebidas y Líquidos', pct: '12%', value: '$29.5M' },
          { name: 'Enlatados y Otros', pct: '6%', value: '$14.7M' },
        ]

  // Data for the 7-day sales and performance chart
  const todaySales = warehouse.todaySalesAmount || 8420000
  const todayProfit = warehouse.estimatedProfit || Math.round(todaySales * 0.258)

  const weeklyData = [
    { day: 'Lun', sales: Math.round(todaySales * 0.81), profit: Math.round(todayProfit * 0.78), ops: 112 },
    { day: 'Mar', sales: Math.round(todaySales * 1.02), profit: Math.round(todayProfit * 1.05), ops: 138 },
    { day: 'Mié', sales: Math.round(todaySales * 0.86), profit: Math.round(todayProfit * 0.84), ops: 119 },
    { day: 'Jue', sales: Math.round(todaySales * 1.28), profit: Math.round(todayProfit * 1.32), ops: 164 },
    { day: 'Vie', sales: Math.round(todaySales * 1.14), profit: Math.round(todayProfit * 1.18), ops: 152 },
    { day: 'Sáb', sales: Math.round(todaySales * 1.36), profit: Math.round(todayProfit * 1.41), ops: 185 },
    { day: 'Hoy', sales: todaySales, profit: todayProfit, ops: 146 },
  ]

  const totalWeeklySales = weeklyData.reduce((acc, d) => acc + d.sales, 0)
  const totalWeeklyProfit = weeklyData.reduce((acc, d) => acc + d.profit, 0)
  const avgSales = Math.round(totalWeeklySales / weeklyData.length)
  const avgProfit = Math.round(totalWeeklyProfit / weeklyData.length)

  const activeValues = weeklyData.map((d) => (chartMetric === 'SALES' ? d.sales : d.profit))
  const activeAvg = chartMetric === 'SALES' ? avgSales : avgProfit
  const maxVal = Math.max(...activeValues, activeAvg) * 1.2 || 1000

  // SVG Chart Dimensions
  const chartW = 620
  const chartH = 210
  const padLeft = 52
  const padRight = 20
  const padTop = 24
  const padBottom = 32
  const usableW = chartW - padLeft - padRight
  const usableH = chartH - padTop - padBottom

  const chartPoints = weeklyData.map((d, i) => {
    const val = chartMetric === 'SALES' ? d.sales : d.profit
    const x = padLeft + (i / (weeklyData.length - 1)) * usableW
    const y = chartH - padBottom - (val / maxVal) * usableH
    return { ...d, val, x, y }
  })

  // SVG Bezier Curve
  const linePath = chartPoints.reduce((acc, pt, i, arr) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`
    const prev = arr[i - 1]
    const cpX = (prev.x + pt.x) / 2
    return `${acc} C ${cpX} ${prev.y}, ${cpX} ${pt.y}, ${pt.x} ${pt.y}`
  }, '')

  const areaPath = `${linePath} L ${chartPoints[chartPoints.length - 1].x} ${chartH - padBottom} L ${chartPoints[0].x} ${chartH - padBottom} Z`
  const avgY = chartH - padBottom - (activeAvg / maxVal) * usableH
  const activeColor = chartMetric === 'SALES' ? '#fe110c' : '#159a67'

  // Donut Chart Calculations
  const donutRadius = 58
  const donutCircumference = 2 * Math.PI * donutRadius
  let accumulatedPercent = 0

  const totalActiveLines =
    inventory.length > 0 ? inventory.length : warehouse.productsCount || 42

  return (
    <div className="overview-tab-grid page-enter">
      {/* Upper Grid: Sales Performance Chart & Inventory Breakdown */}
      <div className="dashboard-grid">
        {/* Sales / Profit Performance Panel */}
        <section className="panel interactive-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Rendimiento comercial</p>
              <h2>Evolución de Ventas y Rendimiento</h2>
            </div>
            <div className="segmented">
              <button
                type="button"
                className={chartMetric === 'SALES' ? 'selected' : ''}
                onClick={() => setChartMetric('SALES')}
              >
                Ventas
              </button>
              {canReadCost && (
                <button
                  type="button"
                  className={chartMetric === 'PROFIT' ? 'selected' : ''}
                  onClick={() => setChartMetric('PROFIT')}
                >
                  Utilidad
                </button>
              )}
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div style={{ display: 'flex', gap: 16, marginTop: 8, marginBottom: 4, fontSize: 11, color: 'var(--muted)' }}>
            <div>
              <span>Semana acumulada: </span>
              <strong style={{ color: 'var(--foreground)' }}>
                {formatCOP(chartMetric === 'SALES' ? totalWeeklySales : totalWeeklyProfit, true)}
              </strong>
            </div>
            <div>
              <span>Promedio diario: </span>
              <strong style={{ color: 'var(--foreground)' }}>
                {formatCOP(activeAvg, true)}
              </strong>
            </div>
          </div>

          <div className="interactive-svg-chart-wrap" style={{ position: 'relative', height: 210 }}>
            <svg
              className="main-svg-chart"
              viewBox={`0 0 ${chartW} ${chartH}`}
              style={{ width: '100%', height: '100%', overflow: 'visible' }}
              onMouseLeave={() => setHoveredPoint(null)}
            >
              <defs>
                <linearGradient id="whSalesGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#fe110c" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#fe110c" stopOpacity="0.00" />
                </linearGradient>
                <linearGradient id="whProfitGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#159a67" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#159a67" stopOpacity="0.00" />
                </linearGradient>
              </defs>

              {/* Horizontal Gridlines & Y-Axis Labels */}
              {[0.25, 0.5, 0.75, 1.0].map((ratio) => {
                const yVal = ratio * maxVal
                const lineY = chartH - padBottom - ratio * usableH
                return (
                  <g key={ratio}>
                    <line
                      x1={padLeft}
                      y1={lineY}
                      x2={chartW - padRight}
                      y2={lineY}
                      stroke="#eef2f8"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                    <text
                      x={padLeft - 8}
                      y={lineY + 3.5}
                      textAnchor="end"
                      fill="#94a3b8"
                      fontSize="9.5"
                      fontFamily="monospace"
                    >
                      {formatCOP(yVal, true)}
                    </text>
                  </g>
                )
              })}

              {/* Baseline */}
              <line
                x1={padLeft}
                y1={chartH - padBottom}
                x2={chartW - padRight}
                y2={chartH - padBottom}
                stroke="#e2e8f0"
                strokeWidth="1"
              />

              {/* Weekly Average Reference Line (Dashed Navy) */}
              <line
                x1={padLeft}
                y1={avgY}
                x2={chartW - padRight}
                y2={avgY}
                stroke="#001b5c"
                strokeDasharray="6 4"
                strokeWidth="1.5"
                opacity="0.55"
              />

              {/* Area Gradient Fill */}
              <path
                d={areaPath}
                fill={chartMetric === 'SALES' ? 'url(#whSalesGrad)' : 'url(#whProfitGrad)'}
              />

              {/* Main Line Stroke */}
              <path
                d={linePath}
                fill="none"
                stroke={activeColor}
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* X-Axis Labels */}
              {chartPoints.map((pt) => (
                <text
                  key={pt.day}
                  x={pt.x}
                  y={chartH - 12}
                  textAnchor="middle"
                  fill={pt.day === 'Hoy' ? activeColor : '#64748b'}
                  fontSize="10"
                  fontWeight={pt.day === 'Hoy' ? '700' : '500'}
                >
                  {pt.day}
                </text>
              ))}

              {/* Points & Interactive Hitboxes */}
              {chartPoints.map((pt) => {
                const isHovered = hoveredPoint?.day === pt.day
                return (
                  <g key={`point-${pt.day}`}>
                    {/* Outer Halo */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 7.5 : 5}
                      fill="#fff"
                      stroke={activeColor}
                      strokeWidth={isHovered ? 3 : 2}
                      style={{ transition: 'all 0.18s ease' }}
                    />
                    {/* Inner Core */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 3.5 : 2}
                      fill={activeColor}
                    />
                    {/* Hitbox */}
                    <rect
                      x={pt.x - 22}
                      y={padTop}
                      width={44}
                      height={usableH + padBottom}
                      fill="transparent"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredPoint(pt)}
                    />
                  </g>
                )
              })}
            </svg>

            {/* Floating Tooltip */}
            {hoveredPoint && (
              <div
                className="chart-floating-tooltip"
                style={{
                  left: `${(hoveredPoint.x / chartW) * 100}%`,
                  top: `${Math.max(5, (hoveredPoint.y / chartH) * 100 - 18)}%`,
                  pointerEvents: 'none',
                }}
              >
                <div className="tooltip-header">
                  <strong>{hoveredPoint.day === 'Hoy' ? 'Hoy (Día en curso)' : hoveredPoint.day}</strong>
                  <span>{hoveredPoint.ops} operaciones</span>
                </div>
                <div className="tooltip-body">
                  <div className="tooltip-row">
                    <span className="dot" style={{ background: activeColor }} />
                    <span>{chartMetric === 'SALES' ? 'Ventas:' : 'Utilidad:'}</span>
                    <b>{formatCOP(hoveredPoint.val)}</b>
                  </div>
                  <div className="tooltip-row">
                    <span className="dot" style={{ background: '#001b5c' }} />
                    <span>Vs promedio:</span>
                    <b
                      style={{
                        color: hoveredPoint.val >= activeAvg ? '#159a67' : '#fe110c',
                      }}
                    >
                      {hoveredPoint.val >= activeAvg ? '+' : ''}
                      {(((hoveredPoint.val - activeAvg) / activeAvg) * 100).toFixed(1)}%
                    </b>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="chart-legend" style={{ marginTop: 10 }}>
            <span>
              <i style={{ backgroundColor: activeColor }} />{' '}
              {chartMetric === 'SALES' ? 'Ventas emitidas' : 'Utilidad neta'}
            </span>
            <span>
              <i className="legend-blue" style={{ backgroundColor: '#001b5c' }} /> Promedio semanal (
              {formatCOP(activeAvg, true)})
            </span>
          </div>
        </section>

        {/* Category Distribution Panel - SVG Donut */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Distribución de stock</p>
              <h2>Inventario por Categoría</h2>
            </div>
          </div>

          <div className="donut-wrap" style={{ padding: '16px 0 10px', alignItems: 'center' }}>
            {/* SVG Donut Chart */}
            <div className="donut-chart-container" style={{ width: 160, height: 160, position: 'relative', margin: '0 auto' }}>
              <svg
                viewBox="0 0 160 160"
                width="160"
                height="160"
                className="donut-svg-chart"
                aria-label="Distribución gráfica del inventario por categoría"
              >
                {/* Background Track */}
                <circle
                  cx="80"
                  cy="80"
                  r={donutRadius}
                  fill="transparent"
                  stroke="#f1f5f9"
                  strokeWidth="16"
                />

                {/* Slices */}
                {categoriesDistribution.map((cat, idx) => {
                  const pctVal = parseFloat(cat.pct.replace('%', '')) || 0
                  const strokeLength = (pctVal / 100) * donutCircumference
                  const strokeOffset = -(accumulatedPercent / 100) * donutCircumference
                  accumulatedPercent += pctVal

                  const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length]
                  const isHovered = hoveredCategoryIdx === idx

                  return (
                    <circle
                      key={cat.name}
                      cx="80"
                      cy="80"
                      r={donutRadius}
                      fill="transparent"
                      stroke={color}
                      strokeWidth={isHovered ? 20 : 16}
                      strokeDasharray={`${strokeLength} ${donutCircumference}`}
                      strokeDashoffset={strokeOffset}
                      transform="rotate(-90 80 80)"
                      className="donut-slice-circle"
                      style={{
                        transition: 'stroke-width 0.2s ease, opacity 0.2s ease',
                        cursor: 'pointer',
                        opacity: hoveredCategoryIdx === null || isHovered ? 1 : 0.65,
                      }}
                      onMouseEnter={() => setHoveredCategoryIdx(idx)}
                      onMouseLeave={() => setHoveredCategoryIdx(null)}
                    >
                      <title>{`${cat.name}: ${cat.pct} (${cat.value})`}</title>
                    </circle>
                  )
                })}
              </svg>

              {/* Donut Center Label Overlay */}
              <div className="donut-center-overlay" style={{ pointerEvents: 'none' }}>
                {hoveredCategoryIdx !== null ? (
                  <>
                    <span
                      className="donut-center-label"
                      style={{
                        color: CATEGORY_COLORS[hoveredCategoryIdx % CATEGORY_COLORS.length],
                        fontWeight: 800,
                        fontSize: 14,
                      }}
                    >
                      {categoriesDistribution[hoveredCategoryIdx].pct}
                    </span>
                    <strong
                      className="donut-center-value"
                      style={{
                        fontSize: 11,
                        lineHeight: 1.2,
                        marginTop: 2,
                        maxWidth: 100,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {categoriesDistribution[hoveredCategoryIdx].name}
                    </strong>
                    {canReadCost && (
                      <small style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>
                        {categoriesDistribution[hoveredCategoryIdx].value}
                      </small>
                    )}
                  </>
                ) : (
                  <>
                    <strong className="donut-center-value" style={{ fontSize: 24, fontWeight: 800, color: 'var(--foreground)' }}>
                      {totalActiveLines}
                    </strong>
                    <span className="donut-center-label" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                      Líneas activas
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Interactive Categories Legend List */}
            <div className="legend-list" style={{ flex: 1, paddingLeft: 10 }}>
              {categoriesDistribution.map((cat, idx) => {
                const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length]
                const isHovered = hoveredCategoryIdx === idx

                return (
                  <div
                    className="distribution"
                    key={idx}
                    style={{
                      marginBottom: 8,
                      padding: '4px 8px',
                      borderRadius: 7,
                      cursor: 'pointer',
                      background: isHovered ? '#f1f5f9' : 'transparent',
                      transition: 'background 0.18s ease',
                    }}
                    onMouseEnter={() => setHoveredCategoryIdx(idx)}
                    onMouseLeave={() => setHoveredCategoryIdx(null)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: isHovered ? 700 : 500 }}>
                        <i
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            backgroundColor: color,
                            display: 'inline-block',
                            flexShrink: 0,
                            transform: isHovered ? 'scale(1.3)' : 'scale(1)',
                            transition: 'transform 0.18s ease',
                          }}
                        />
                        {cat.name}
                      </span>
                      <b style={{ fontSize: 11, color: 'var(--foreground)' }}>
                        {canReadCost ? `${cat.value} (${cat.pct})` : cat.pct}
                      </b>
                    </div>
                    <div className="distribution-bar" style={{ height: 6, borderRadius: 4, background: '#edf0f5', overflow: 'hidden' }}>
                      <i
                        style={{
                          display: 'block',
                          height: '100%',
                          width: cat.pct,
                          borderRadius: 4,
                          backgroundColor: color,
                          transition: 'width 0.6s ease',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      </div>

      {/* Bottom Grid: Top Selling, Low Stock, Recent Movements & Transfers */}
      <div className="bottom-grid">
        {/* Top Selling Products */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Mayor rotación</p>
              <h2>Productos Más Vendidos</h2>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => onNavigateTab('VENTAS')}
            >
              Ver todas las ventas <AppIcon name="chevronRight" size={13} />
            </button>
          </div>

          <div className="admin-list" style={{ padding: '10px 0 0' }}>
            {topSelling.map((prod, idx) => (
              <article className="rank-row" key={prod.sku}>
                <span className="rank">0{idx + 1}</span>
                <div className="admin-row-icon">
                  <AppIcon name="products" size={15} />
                </div>
                <div>
                  <strong>{prod.name}</strong>
                  <small>{prod.sku} · {prod.units} unidades vendidas</small>
                </div>
                <b>{prod.sales}</b>
              </article>
            ))}
          </div>
        </section>

        {/* Low Stock Alerts */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Atención preventiva</p>
              <h2>Productos con Stock Bajo</h2>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => onNavigateTab('INVENTARIO')}
            >
              Gestionar inventario <AppIcon name="chevronRight" size={13} />
            </button>
          </div>

          <div className="admin-list" style={{ padding: '10px 0 0' }}>
            {lowStockItems.length === 0 ? (
              <div className="drawer-empty" style={{ minHeight: 140 }}>
                <AppIcon name="check" size={24} color="#159a67" />
                <p>Todos los productos están en niveles óptimos de inventario.</p>
              </div>
            ) : (
              lowStockItems.slice(0, 4).map((item) => (
                <article className="alert-row" key={item.id}>
                  <AppIcon name="warning" size={16} />
                  <div>
                    <strong>{item.productName}</strong>
                    <span>
                      Stock actual: <b>{item.currentStock} {item.unit}</b> (Mínimo: {item.minStock})
                    </span>
                  </div>
                  <span
                    className={`state ${
                      item.status === 'OUT_OF_STOCK'
                        ? 'agotado'
                        : item.status === 'CRITICAL'
                        ? 'crítico'
                        : 'stock-bajo'
                    }`}
                  >
                    {item.status === 'OUT_OF_STOCK'
                      ? 'Agotado'
                      : item.status === 'CRITICAL'
                      ? 'Crítico'
                      : 'Stock bajo'}
                  </span>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Activity & Transfers Ledger Row */}
      <div className="bottom-grid" style={{ marginTop: 16 }}>
        {/* Recent Kardex Activity */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Trazabilidad en tiempo real</p>
              <h2>Actividad Reciente en Kardex</h2>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => onNavigateTab('MOVIMIENTOS')}
            >
              Ver Kardex completo <AppIcon name="chevronRight" size={13} />
            </button>
          </div>

          <div className="admin-list" style={{ padding: '10px 0 0' }}>
            {movements.slice(0, 4).map((m) => (
              <article className="activity-row" key={m.id}>
                <div className="activity-icon">
                  {m.type.includes('SALIDA') || m.type === 'VENTA' ? (
                    <AppIcon name="arrowUpRight" size={15} color="#fe110c" />
                  ) : (
                    <AppIcon name="arrowDownLeft" size={15} color="#159a67" />
                  )}
                </div>
                <div>
                  <strong>{m.productName}</strong>
                  <span>
                    {m.type} ({m.documentRef}) · Por {m.userName}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <b className={m.quantityIn > 0 ? 'positive-text' : 'negative-text'}>
                    {m.quantityIn > 0 ? `+${m.quantityIn}` : `-${m.quantityOut}`} uds
                  </b>
                  <small className="time-muted">{m.createdAt}</small>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Recent Transfers */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Logística de transferencias</p>
              <h2>Transferencias Relacionadas</h2>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => onNavigateTab('TRANSFERENCIAS')}
            >
              Ver transferencias <AppIcon name="chevronRight" size={13} />
            </button>
          </div>

          <div className="admin-list" style={{ padding: '10px 0 0' }}>
            {transfers.slice(0, 3).map((t) => (
              <article className="flow-card" key={t.id} style={{ marginBottom: 10, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="mono"><b>{t.code}</b></span>
                  <span className={`state ${t.status.toLowerCase().replace('_', '-')}`}>
                    {t.status === 'EN_TRANSITO'
                      ? 'En tránsito'
                      : t.status === 'RECIBIDA'
                      ? 'Recibida'
                      : t.status === 'PENDIENTE'
                      ? 'Pendiente'
                      : 'Rechazada'}
                  </span>
                </div>
                <div className="flow-location" style={{ margin: '12px 0 8px' }}>
                  <strong>{t.originLocationName}</strong>
                  <AppIcon name="transfers" size={14} />
                  <strong>{t.destinationLocationName}</strong>
                </div>
                <small>{t.totalUnits} unidades · {t.createdAt}</small>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
