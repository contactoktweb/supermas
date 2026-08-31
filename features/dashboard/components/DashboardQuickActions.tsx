'use client'

import React from 'react'
import {
  Store,
  CircleDollarSign,
  ShoppingCart,
  Truck,
  Boxes,
  Package,
  FileText,
  Building2,
  Users,
  Zap,
  Bell,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { QuickActionItem } from '../types'

interface DashboardQuickActionsProps {
  actions: QuickActionItem[]
  onSelectAction: (targetView: string) => void
}

const iconMap: Record<string, React.ElementType> = {
  Store,
  CircleDollarSign,
  ShoppingCart,
  Truck,
  Boxes,
  Package,
  FileText,
  Building2,
  Users,
  Zap,
  Bell,
}

export function DashboardQuickActions({
  actions,
  onSelectAction,
}: DashboardQuickActionsProps) {
  if (actions.length === 0) return null

  return (
    <section className="quick-actions-section page-enter">
      <div className="section-header-compact">
        <div className="section-title-wrap">
          <Sparkles size={14} color="var(--red)" />
          <h2>Accesos rápidos operativos</h2>
        </div>
        <span className="section-subtitle">
          Acciones frecuentes disponibles según tus permisos
        </span>
      </div>

      <div className="quick-actions-grid">
        {actions.map((action) => {
          const Icon = iconMap[action.icon] || Zap

          return (
            <button
              key={action.id}
              type="button"
              className={`quick-action-card ${action.highlight ? 'is-highlight' : ''}`}
              onClick={() => onSelectAction(action.targetView)}
            >
              <div className="action-card-top">
                <div className="action-icon-wrap">
                  <Icon size={18} />
                </div>
                {action.badge && (
                  <span className="action-badge">{action.badge}</span>
                )}
              </div>

              <div className="action-card-text">
                <strong className="action-title">{action.title}</strong>
                <span className="action-subtitle">{action.subtitle}</span>
              </div>

              <div className="action-card-arrow">
                <ArrowRight size={13} />
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
