'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { QuickActionItem } from '../types'

interface DashboardQuickActionsProps {
  actions: QuickActionItem[]
  onSelectAction: (targetView: string) => void
}

const iconMap: Record<string, LightIconName> = {
  Store: 'pos',
  CircleDollarSign: 'sales',
  ShoppingCart: 'purchases',
  Truck: 'transfers',
  Boxes: 'inventory',
  Package: 'products',
  FileText: 'invoices',
  Building2: 'suppliers',
  Users: 'customers',
  Zap: 'webOrders',
  Bell: 'alerts',
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
          <AppIcon name="sparkles" size={16} color="var(--red)" />
          <h2>Accesos rápidos operativos</h2>
        </div>
        <span className="section-subtitle">
          Acciones frecuentes disponibles según tus permisos
        </span>
      </div>

      <div className="quick-actions-grid">
        {actions.map((action) => {
          const iconName = iconMap[action.icon] || 'webOrders'

          return (
            <button
              key={action.id}
              type="button"
              className={`quick-action-card ${action.highlight ? 'is-highlight' : ''}`}
              onClick={() => onSelectAction(action.targetView)}
            >
              <div className="action-card-top">
                <div className="action-icon-wrap">
                  <AppIcon name={iconName} size={18} />
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
                <AppIcon name="chevronRight" size={14} />
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
