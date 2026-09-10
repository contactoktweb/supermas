'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { InvoiceStats as InvoiceStatsType } from '../types'

interface InvoiceStatsProps {
  stats: InvoiceStatsType
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

export function InvoiceStats({ stats, loading }: InvoiceStatsProps) {
  const formatCOP = (val: number) => {
    if (val >= 1_000_000_000) {
      return `$${(val / 1_000_000_000).toFixed(1)}B`
    }
    if (val >= 1_000_000) {
      return `$${(val / 1_000_000).toFixed(1)}M`
    }
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val)
  }

  const cards: StatCardConfig[] = [
    {
      title: 'Facturas Generadas',
      value: stats.totalGenerated.toLocaleString('es-CO'),
      subtitle: 'Comprobantes emitidos',
      icon: 'invoices',
      tone: 'blue',
    },
    {
      title: 'Electrónicas DIAN',
      value: stats.electronicSent.toLocaleString('es-CO'),
      subtitle: 'Validadas y aceptadas',
      icon: 'check',
      tone: 'teal',
    },
    {
      title: 'Pendientes DIAN',
      value: stats.pendingDIAN.toLocaleString('es-CO'),
      subtitle: 'En cola de transmisión',
      icon: 'clock',
      tone: 'amber',
    },
    {
      title: 'Rechazadas DIAN',
      value: stats.rejectedDIAN.toLocaleString('es-CO'),
      subtitle: 'Requieren reintento',
      icon: 'warning',
      tone: 'red',
      highlight: stats.rejectedDIAN > 0,
    },
    {
      title: 'Total Facturado',
      value: formatCOP(stats.totalAmountBilled),
      subtitle: 'Monto total del periodo',
      icon: 'sales',
      tone: 'emerald',
    },
    {
      title: 'Notas Crédito',
      value: `${stats.creditNotesCount} (${formatCOP(stats.creditNotesTotal)})`,
      subtitle: 'Ajustes y devoluciones',
      icon: 'receipt',
      tone: 'purple',
    },
    {
      title: 'Facturas Anuladas',
      value: stats.cancelledCount.toLocaleString('es-CO'),
      subtitle: 'Sin validez fiscal',
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
            border: card.highlight ? '1px solid rgba(239, 68, 68, 0.4)' : undefined,
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
                color: card.highlight ? 'var(--red)' : '#64748b',
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
