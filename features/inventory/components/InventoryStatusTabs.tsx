'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { InventoryTabFilter, InventoryKPIs } from '../types'

interface InventoryStatusTabsProps {
  activeTab: InventoryTabFilter
  onTabChange: (tab: InventoryTabFilter) => void
  kpis: InventoryKPIs
}

export function InventoryStatusTabs({
  activeTab,
  onTabChange,
  kpis,
}: InventoryStatusTabsProps) {
  const tabs: { id: InventoryTabFilter; label: string; count?: number; icon?: string; badgeClass?: string }[] = [
    { id: 'ALL', label: 'Todo el catálogo' },
    {
      id: 'LOW_STOCK',
      label: 'Stock bajo',
      count: kpis.lowStockCount,
      icon: 'warning',
      badgeClass: 'badge-amber',
    },
    {
      id: 'CRITICAL',
      label: 'Nivel crítico',
      count: kpis.criticalStockCount,
      icon: 'warning',
      badgeClass: 'badge-red',
    },
    {
      id: 'OUT_OF_STOCK',
      label: 'Agotados',
      count: kpis.outOfStockCount,
      icon: 'close',
      badgeClass: 'badge-dark-red',
    },
  ]

  return (
    <div className="inventory-status-tabs-container">
      <div className="inventory-status-tabs-list" role="tablist">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`inventory-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.icon && (
                <AppIcon
                  name={tab.icon as any}
                  size={13}
                  color={isActive ? 'var(--navy)' : '#94a3b8'}
                />
              )}
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`tab-counter-pill ${tab.badgeClass || ''} ${
                    tab.count > 0 ? 'has-items' : ''
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
