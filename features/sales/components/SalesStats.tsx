'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { SaleStats as SaleStatsType } from '../types'

interface SalesStatsProps {
  stats: SaleStatsType | null
  loading: boolean
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function SalesStats({ stats, loading }: SalesStatsProps) {
  if (loading || !stats) {
    return (
      <div className="dashboard-stats-section page-enter">
        <div className="stats-grid dashboard-primary-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="stat-card skeleton-card">
              <div className="skeleton-box skeleton-icon" />
              <div className="stat-text" style={{ width: '100%' }}>
                <div className="skeleton-box skeleton-line-short" />
                <div className="skeleton-box skeleton-line-title" />
                <div className="skeleton-box skeleton-line-sub" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const statCards: {
    title: string
    value: string
    icon: LightIconName
    tone: string
    note: string
    isPositive?: boolean
    isWarning?: boolean
  }[] = [
    {
      title: 'Ventas del periodo',
      value: formatCOP(stats.periodTotalSales),
      icon: 'dollar',
      tone: 'teal',
      note: `${stats.periodSalesCount} ventas registradas`,
      isPositive: true,
    },
    {
      title: 'Ticket promedio',
      value: formatCOP(stats.averageTicket),
      icon: 'sales',
      tone: 'blue',
      note: 'Promedio por transacción',
      isPositive: true,
    },
    {
      title: 'Productos vendidos',
      value: stats.totalUnitsSold.toLocaleString('es-CO') + ' unds',
      icon: 'products',
      tone: 'blue',
      note: `${stats.uniqueCustomersServed} clientes atendidos`,
      isPositive: true,
    },
    {
      title: 'Pendientes de facturar',
      value: stats.pendingToInvoiceCount.toString(),
      icon: 'invoices',
      tone: stats.pendingToInvoiceCount > 0 ? 'amber' : 'teal',
      note: stats.pendingToInvoiceCount > 0 ? 'Requieren emisión DIAN' : 'Al día',
      isWarning: stats.pendingToInvoiceCount > 0,
      isPositive: stats.pendingToInvoiceCount === 0,
    },
  ]

  return (
    <div className="dashboard-stats-section page-enter">
      <div className="stats-grid dashboard-primary-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {statCards.map((c, i) => (
          <article
            className="stat-card"
            key={c.title}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className={`stat-icon ${c.tone}`}>
              <AppIcon name={c.icon} size={18} />
            </div>
            <div className="stat-text">
              <span>{c.title}</span>
              <strong>{c.value}</strong>
              <small className={c.isWarning ? 'warning-text' : c.isPositive ? 'positive' : ''}>
                <AppIcon
                  name={c.isWarning ? 'warning' : 'arrowUpRight'}
                  size={13}
                />
                {c.note}
              </small>
            </div>
            <svg className="sparkline" viewBox="0 0 90 30" aria-hidden="true">
              <polyline points="0,25 12,22 22,24 35,15 48,19 60,10 72,14 90,3" />
            </svg>
          </article>
        ))}
      </div>
    </div>
  )
}
