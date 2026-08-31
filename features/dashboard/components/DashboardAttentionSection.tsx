'use client'

import React from 'react'
import {
  AlertTriangle,
  AlertCircle,
  Clock,
  ChevronRight,
  ShieldAlert,
  Boxes,
  ShoppingCart,
  Truck,
  Zap,
} from 'lucide-react'
import { PendingAttentionItem } from '../types'

interface DashboardAttentionSectionProps {
  items: PendingAttentionItem[]
  onSelectAction: (targetView: string) => void
}

const moduleIconMap: Record<string, React.ElementType> = {
  Inventario: Boxes,
  Compras: ShoppingCart,
  Logística: Truck,
  Ecommerce: Zap,
}

export function DashboardAttentionSection({
  items,
  onSelectAction,
}: DashboardAttentionSectionProps) {
  if (items.length === 0) return null

  return (
    <section className="panel attention-panel page-enter">
      <div className="panel-heading">
        <div>
          <div className="panel-title-row">
            <ShieldAlert size={16} color="var(--red)" />
            <h2>Requiere atención y pendientes</h2>
          </div>
          <p>Eventos clasificados por prioridad que demandan acción inmediata</p>
        </div>
        <span className="alert-count-pill">{items.length} pendientes</span>
      </div>

      <div className="attention-list">
        {items.map((item) => {
          const Icon = moduleIconMap[item.module] || AlertTriangle
          const isCritical = item.severity === 'CRITICAL'
          const isWarning = item.severity === 'WARNING'

          return (
            <article
              key={item.id}
              className={`attention-item-row severity-${item.severity.toLowerCase()}`}
              onClick={() => onSelectAction(item.targetView)}
            >
              <div
                className={`attention-icon-wrap ${
                  isCritical ? 'critical' : isWarning ? 'warning' : 'info'
                }`}
              >
                <Icon size={16} />
              </div>

              <div className="attention-item-copy">
                <div className="attention-item-header">
                  <strong>{item.title}</strong>
                  <span className={`severity-tag ${item.severity.toLowerCase()}`}>
                    {item.badgeLabel}
                  </span>
                </div>
                <p>{item.description}</p>
              </div>

              <button
                type="button"
                className="attention-action-btn"
                aria-label={`Gestionar ${item.title}`}
              >
                <span>Resolver</span>
                <ChevronRight size={14} />
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
