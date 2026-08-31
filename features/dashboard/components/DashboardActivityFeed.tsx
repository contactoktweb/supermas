'use client'

import React from 'react'
import {
  Activity,
  ShoppingCart,
  CircleDollarSign,
  Truck,
  Boxes,
  FileText,
  Zap,
  UserCheck,
  Clock,
  ArrowRight,
} from 'lucide-react'
import { ActivityFeedItem } from '../types'
import { dashboardService } from '../services/dashboard.service'

interface DashboardActivityFeedProps {
  items: ActivityFeedItem[]
}

const typeIconMap: Record<string, React.ElementType> = {
  SALE: CircleDollarSign,
  PURCHASE: ShoppingCart,
  TRANSFER: Truck,
  ADJUSTMENT: Boxes,
  INVOICE: FileText,
  WEB_ORDER: Zap,
  AUTH: UserCheck,
}

const typeToneMap: Record<string, string> = {
  SALE: 'teal',
  PURCHASE: 'blue',
  TRANSFER: 'purple',
  ADJUSTMENT: 'amber',
  INVOICE: 'blue',
  WEB_ORDER: 'red',
  AUTH: 'teal',
}

export function DashboardActivityFeed({ items }: DashboardActivityFeedProps) {
  return (
    <section className="panel activity-feed-panel page-enter">
      <div className="panel-heading">
        <div>
          <div className="panel-title-row">
            <Activity size={16} color="var(--navy)" />
            <h2>Actividad reciente de la operación</h2>
          </div>
          <p>Registro cronológico en vivo de transacciones y movimientos</p>
        </div>
        <span className="live-pill">
          <i /> En vivo
        </span>
      </div>

      <div className="activity-feed-list">
        {items.map((item, index) => {
          const Icon = typeIconMap[item.type] || Activity
          const tone = typeToneMap[item.type] || 'blue'
          const timeFormatted = dashboardService.formatDateTime(item.timestamp)

          return (
            <article
              key={item.id}
              className="activity-feed-row"
              style={{ animationDelay: `${index * 0.04}s` }}
            >
              <div className={`activity-feed-icon ${tone}`}>
                <Icon size={15} />
              </div>

              <div className="activity-feed-content">
                <div className="activity-feed-main-line">
                  <strong className="activity-user">{item.userName}</strong>
                  <span className="activity-action">{item.action}</span>
                </div>

                <div className="activity-feed-meta">
                  <span className="activity-location">{item.locationName}</span>
                  <span className="meta-dot">·</span>
                  <span className="activity-module">{item.module}</span>
                  <span className="meta-dot">·</span>
                  <time className="activity-time">{timeFormatted}</time>
                </div>

                <p className="activity-detail">{item.detail}</p>
              </div>

              {item.amount && (
                <div className="activity-amount">
                  <b>{dashboardService.formatCOP(item.amount, true)}</b>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
