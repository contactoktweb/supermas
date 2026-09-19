'use client'

import React, { useState } from 'react'
import { ChartDataPoint, DistributionPoint } from '../types'

/**
 * Gráfico interactivo de tendencia con curva Bézier suave y Tooltip flotante
 */
export function TrendLineChart({
  points,
  title,
  subtitle,
  height = 220,
  strokeColor = '#3b82f6',
  gradientId = 'trendGradient',
  format = 'currency',
}: {
  points: ChartDataPoint[]
  title?: string
  subtitle?: string
  height?: number
  strokeColor?: string
  gradientId?: string
  format?: 'currency' | 'number'
}) {
  const [hoveredPoint, setHoveredPoint] = useState<ChartDataPoint | null>(null)
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null)

  if (!points || points.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white rounded-2xl border border-slate-200 text-slate-500 text-sm shadow-xs">
        No hay datos suficientes para graficar la tendencia
      </div>
    )
  }

  const maxVal = Math.max(...points.map((p) => p.value), 1000) * 1.15
  const chartWidth = 600
  const chartHeight = height
  const paddingX = 40
  const paddingY = 30

  const getCoordinates = (index: number, val: number) => {
    const usableWidth = chartWidth - paddingX * 2
    const usableHeight = chartHeight - paddingY * 2
    const x = paddingX + (index / Math.max(1, points.length - 1)) * usableWidth
    const y = chartHeight - paddingY - (val / maxVal) * usableHeight
    return { x, y }
  }

  const coordPoints = points.map((p, i) => getCoordinates(i, p.value))

  const pathString = coordPoints.reduce((acc, pt, i, arr) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`
    const prev = arr[i - 1]
    const cpX = (prev.x + pt.x) / 2
    return `${acc} C ${cpX} ${prev.y}, ${cpX} ${pt.y}, ${pt.x} ${pt.y}`
  }, '')

  const areaString = `${pathString} L ${coordPoints[coordPoints.length - 1].x} ${
    chartHeight - paddingY
  } L ${coordPoints[0].x} ${chartHeight - paddingY} Z`

  const formatFn = (num: number) =>
    format === 'currency'
      ? new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          maximumFractionDigits: 0,
        }).format(num)
      : num.toLocaleString('es-CO')

  return (
    <section className="panel chart-panel">
      {title && (
        <div className="panel-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {hoveredPoint && (
            <div className="bg-slate-900 text-white border border-slate-800 px-3 py-1 rounded-lg text-xs font-mono font-medium shadow-lg animate-in fade-in duration-150">
              <span className="text-slate-300 mr-2">{hoveredPoint.label}:</span>
              <span className="text-emerald-400 font-bold">{formatFn(hoveredPoint.value)}</span>
            </div>
          )}
        </div>
      )}

      <div className="relative w-full" style={{ marginTop: 12 }}>
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.22" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Líneas de guía horizontales */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = paddingY + (chartHeight - paddingY * 2) * ratio
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

          {/* Relleno gradiente */}
          <path d={areaString} fill={`url(#${gradientId})`} />

          {/* Línea principal */}
          <path
            d={pathString}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Nodos interactivos */}
          {coordPoints.map((pt, i) => {
            const isHovered = hoveredPoint === points[i]
            return (
              <g key={i}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 6 : 3.5}
                  fill={isHovered ? '#ffffff' : strokeColor}
                  stroke={strokeColor}
                  strokeWidth={isHovered ? '2.5' : '1.5'}
                  className="transition-all duration-200 cursor-pointer"
                />
                {/* Zona de hover invisible más grande */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="16"
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => {
                    setHoveredPoint(points[i])
                    setHoverPosition(pt)
                  }}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              </g>
            )
          })}

          {/* Etiquetas del eje X */}
          {points.map((p, i) => {
            if (points.length > 10 && i % 2 !== 0) return null
            const pt = coordPoints[i]
            return (
              <text
                key={i}
                x={pt.x}
                y={chartHeight - 8}
                textAnchor="middle"
                fontSize="10"
                fill="#71829e"
                className="font-mono"
              >
                {p.label}
              </text>
            )
          })}
        </svg>
      </div>
    </section>
  )
}

/**
 * Barras de distribución horizontal con porcentaje y formato de moneda
 */
export function DistributionBarList({
  items,
  title,
  subtitle,
  format = 'currency',
}: {
  items: DistributionPoint[]
  title?: string
  subtitle?: string
  format?: 'currency' | 'number'
}) {
  const formatFn = (num: number) =>
    format === 'currency'
      ? new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          maximumFractionDigits: 0,
        }).format(num)
      : num.toLocaleString('es-CO')

  const defaultColors = ['#001b5c', '#159a67', '#d99117', '#fe110c', '#3b82f6', '#8b5cf6']

  return (
    <section className="panel distribution-panel">
      {title && (
        <div className="panel-heading" style={{ marginBottom: 16 }}>
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>
      )}

      <div className="space-y-3.5">
        {items.map((item, i) => {
          const color = item.color || defaultColors[i % defaultColors.length]
          return (
            <div key={item.label} className="group">
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-slate-800 font-semibold group-hover:text-blue-600 transition-colors truncate max-w-[200px]">
                  {item.label}
                </span>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-slate-500 font-medium">{formatFn(item.value)}</span>
                  <span className="text-slate-900 font-bold w-12 text-right">
                    {item.percentage}%
                  </span>
                </div>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.max(3, item.percentage)}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/**
 * Gráfico comparativo de barras verticales para dos bodegas o series (Bodega A vs Bodega B)
 */
export function ComparisonBarChart({
  categories,
  seriesA,
  seriesB,
  labelA,
  labelB,
  colorA = '#3b82f6',
  colorB = '#10b981',
}: {
  categories: string[]
  seriesA: number[]
  seriesB: number[]
  labelA: string
  labelB: string
  colorA?: string
  colorB?: string
}) {
  const maxVal = Math.max(...seriesA, ...seriesB, 100) * 1.15

  const formatCOP = (val: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val)

  return (
    <section className="panel comparison-panel">
      <div className="panel-heading" style={{ marginBottom: 20 }}>
        <div>
          <h2>Comparativa Directa de Desempeño</h2>
          <p>Análisis cruzado entre sedes y centros de distribución</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: colorA }} />
            <span className="text-slate-700 font-semibold">{labelA}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: colorB }} />
            <span className="text-slate-700 font-semibold">{labelB}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {categories.map((cat, idx) => {
          const valA = seriesA[idx] || 0
          const valB = seriesB[idx] || 0
          const heightA = Math.max(8, (valA / maxVal) * 120)
          const heightB = Math.max(8, (valB / maxVal) * 120)

          return (
            <div
              key={cat}
              className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between"
            >
              <div className="text-xs font-bold text-slate-700 truncate mb-2">{cat}</div>
              <div className="h-32 flex items-end justify-center gap-3 py-2 border-b border-slate-200">
                <div
                  className="w-8 rounded-t-md transition-all duration-300 relative group"
                  style={{ height: `${heightA}px`, backgroundColor: colorA }}
                >
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-[10px] text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-md pointer-events-none z-10 font-mono">
                    {formatCOP(valA)}
                  </div>
                </div>
                <div
                  className="w-8 rounded-t-md transition-all duration-300 relative group"
                  style={{ height: `${heightB}px`, backgroundColor: colorB }}
                >
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-[10px] text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-md pointer-events-none z-10 font-mono">
                    {formatCOP(valB)}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 text-[11px] font-mono mt-2 pt-1 gap-1">
                <div className="text-blue-600 font-bold">{formatCOP(valA)}</div>
                <div className="text-emerald-600 font-bold text-right">{formatCOP(valB)}</div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
