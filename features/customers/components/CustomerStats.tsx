'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { CustomerStats as CustomerStatsType } from '../types'

interface CustomerStatsProps {
  stats: CustomerStatsType | null
  loading: boolean
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function CustomerStats({ stats, loading }: CustomerStatsProps) {
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
    subtext: string
    icon: LightIconName
    tone: 'blue' | 'teal' | 'amber' | 'red' | 'purple'
    scope: string
  }[] = [
    {
      title: 'Total Clientes',
      value: stats.totalCustomers.toString(),
      subtext: `${stats.activeCustomers} activos actualmente`,
      icon: 'customers',
      tone: 'blue',
      scope: 'Directorio',
    },
    {
      title: 'Nuevos del Periodo',
      value: stats.newCustomersInPeriod.toString(),
      subtext: 'Registrados en los últimos 30 días',
      icon: 'plus',
      tone: 'teal',
      scope: 'Crecimiento',
    },
    {
      title: 'Clientes con Compras',
      value: stats.customersWithRecentPurchases.toString(),
      subtext: 'Compras en los últimos 15 días',
      icon: 'sales',
      tone: 'amber',
      scope: 'Actividad',
    },
    {
      title: 'Total Vendido',
      value: formatCOP(stats.totalSalesAmount),
      subtext: stats.totalSalesAmount > 0 ? `Ticket prom: ${formatCOP(stats.averageTicket)}` : 'Sin datos suficientes',
      icon: 'wallet',
      tone: 'purple',
      scope: 'Ventas acumuladas',
    },
  ]

  return (
    <div className="dashboard-stats-section page-enter" aria-label="Indicadores del módulo de clientes">
      <div
        className="stats-grid dashboard-primary-grid"
        style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}
      >
        {statCards.map((card, idx) => (
          <div
            key={card.title}
            className="dashboard-kpi-card stat-card"
            style={{ animationDelay: `${idx * 0.05}s` }}
          >
            <div className="kpi-card-header">
              <div className={`kpi-icon-wrap ${card.tone}`}>
                <AppIcon name={card.icon} size={18} />
              </div>
              <span className="kpi-scope-badge">{card.scope}</span>
            </div>

            <div className="kpi-card-body">
              <span className="kpi-card-title">{card.title}</span>
              <strong className="kpi-card-value" style={{ fontSize: 22, letterSpacing: '-0.8px' }}>
                {card.value}
              </strong>
            </div>

            <div className="kpi-card-footer" style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
              <span>{card.subtext}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
