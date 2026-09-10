'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { RemissionStats as RemissionStatsType } from '../types'

interface RemissionStatsProps {
  stats: RemissionStatsType
  loading: boolean
}

interface StatCardConfig {
  title: string
  value: string
  subtitle: string
  icon: LightIconName
  tone: 'blue' | 'teal' | 'amber' | 'red' | 'purple' | 'emerald'
  highlight?: boolean
}

export function RemissionStats({ stats, loading }: RemissionStatsProps) {
  const cards: StatCardConfig[] = [
    {
      title: 'Total Remisiones',
      value: stats.totalRemissions.toLocaleString('es-CO'),
      subtitle: 'Comprobantes de entrega',
      icon: 'remisiones',
      tone: 'blue',
    },
    {
      title: 'Pendientes Despacho',
      value: stats.pendingDispatch.toLocaleString('es-CO'),
      subtitle: 'Listas para alistamiento',
      icon: 'clock',
      tone: 'amber',
      highlight: stats.pendingDispatch > 0,
    },
    {
      title: 'En Tránsito',
      value: stats.inTransit.toLocaleString('es-CO'),
      subtitle: 'Ruta de distribución',
      icon: 'transfers',
      tone: 'purple',
    },
    {
      title: 'Entregadas al Cliente',
      value: stats.delivered.toLocaleString('es-CO'),
      subtitle: 'Completadas y firmadas',
      icon: 'check',
      tone: 'teal',
    },
    {
      title: 'Unidades Entregadas',
      value: stats.deliveredUnits.toLocaleString('es-CO'),
      subtitle: 'Mercancía despachada',
      icon: 'products',
      tone: 'emerald',
    },
    {
      title: 'Clientes Atendidos',
      value: stats.uniqueCustomers.toLocaleString('es-CO'),
      subtitle: 'Puntos de destino',
      icon: 'customers',
      tone: 'blue',
    },
    {
      title: 'Remisiones Anuladas',
      value: stats.cancelled.toLocaleString('es-CO'),
      subtitle: 'Stock revertido a CEDI',
      icon: 'close',
      tone: 'red',
    },
  ]

  return (
    <section
      className="stats-grid page-enter"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 14,
      }}
    >
      {cards.map((card, idx) => (
        <article
          key={card.title}
          className="stat-card"
          style={{
            animationDelay: `${idx * 40}ms`,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div className={`stat-icon ${card.tone}`}>
            <AppIcon name={card.icon} size={18} />
          </div>

          <div className="stat-text" style={{ flex: 1 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>
              {card.title}
            </span>

            {loading ? (
              <div
                style={{
                  height: 24,
                  width: 80,
                  background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                  backgroundSize: '200% 100%',
                  borderRadius: 4,
                  margin: '4px 0',
                  animation: 'shimmer 1.5s infinite',
                }}
              />
            ) : (
              <strong style={{ fontSize: 18, color: 'var(--navy)' }}>{card.value}</strong>
            )}

            <small
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                color: card.highlight ? '#d97706' : '#64748b',
                fontWeight: 500,
                fontSize: 10,
              }}
            >
              {card.subtitle}
            </small>
          </div>

          <svg className="sparkline" viewBox="0 0 90 30" style={{ opacity: 0.25 }}>
            <polyline points="0,25 12,22 22,24 35,15 48,19 60,10 72,14 90,3" />
          </svg>
        </article>
      ))}
    </section>
  )
}
