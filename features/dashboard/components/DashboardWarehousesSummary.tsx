'use client'

import React from 'react'
import {
  Warehouse,
  Store,
  Building2,
  ChevronRight,
  TrendingUp,
  Boxes,
  AlertTriangle,
  Truck,
  ArrowRight,
  Zap,
} from 'lucide-react'
import { WarehouseDashboardCard, UserProfile } from '../types'
import { dashboardService } from '../services/dashboard.service'

interface DashboardWarehousesSummaryProps {
  warehouses: WarehouseDashboardCard[]
  user: UserProfile
  onSelectWarehouse: (locationId: string) => void
  onViewAllWarehouses: () => void
}

export function DashboardWarehousesSummary({
  warehouses,
  user,
  onSelectWarehouse,
  onViewAllWarehouses,
}: DashboardWarehousesSummaryProps) {
  const canSeeCosts = dashboardService.hasFinancialAccess(user.role)

  return (
    <section className="dashboard-warehouses-section page-enter">
      <div className="section-header-compact">
        <div>
          <div className="section-title-row">
            <Warehouse size={16} color="var(--navy)" />
            <h2>Estado de las bodegas</h2>
          </div>
          <span className="section-subtitle">
            Monitoreo operativo y comercial en tiempo real por sede
          </span>
        </div>

        <button
          type="button"
          className="outline-button compact view-all-wh-btn"
          onClick={onViewAllWarehouses}
        >
          Ver todas las bodegas <ChevronRight size={14} />
        </button>
      </div>

      <div className="warehouse-summary-grid">
        {warehouses.map((wh) => {
          const isStorePoint = wh.type === 'STORE_POINT'
          const isCEDI = wh.type === 'DISTRIBUTION_CENTER'

          return (
            <article
              key={wh.id}
              className="warehouse-summary-card interactive-card"
              onClick={() => onSelectWarehouse(wh.id)}
            >
              <div className="wh-card-top-row">
                <div className="wh-type-icon-wrap">
                  {isStorePoint ? (
                    <Store size={18} color="var(--red)" />
                  ) : isCEDI ? (
                    <Building2 size={18} color="var(--amber)" />
                  ) : (
                    <Warehouse size={18} color="var(--navy)" />
                  )}
                </div>

                <div className="wh-badges-group">
                  {wh.isEcommerce && (
                    <span className="ecommerce-badge">
                      <Zap size={11} /> E-commerce
                    </span>
                  )}
                  <span className="code-badge">{wh.code}</span>
                  <span className={`warehouse-status ${wh.status.toLowerCase()}`}>
                    <i /> {wh.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
              </div>

              <div className="wh-card-main-title">
                <h3>{wh.name}</h3>
                <span>{wh.city}</span>
              </div>

              {/* Main Metric: Cost or Units */}
              <div className="wh-card-lead-metric">
                <span className="lead-label">
                  {canSeeCosts ? 'Valor inventario a costo' : 'Inventario disponible'}
                </span>
                <strong className="lead-val">
                  {canSeeCosts && wh.inventoryAtCost
                    ? dashboardService.formatCOP(wh.inventoryAtCost, true)
                    : `${wh.inventoryUnits.toLocaleString('es-CO')} uds`}
                </strong>
              </div>

              {/* 4-Stat Compact Grid */}
              <div className="wh-card-stat-grid">
                <div className="wh-stat-item">
                  <span>Ventas hoy</span>
                  <b>{dashboardService.formatCOP(wh.todaySales, true)}</b>
                </div>

                <div className="wh-stat-item">
                  <span>Productos</span>
                  <b>{wh.totalProducts}</b>
                </div>

                <div className="wh-stat-item">
                  <span>Stock bajo</span>
                  <b className={wh.lowStockCount > 0 ? 'warning-text' : ''}>
                    {wh.lowStockCount}
                  </b>
                </div>

                <div className="wh-stat-item">
                  <span>Agotados</span>
                  <b className={wh.outOfStockCount > 0 ? 'danger-text' : ''}>
                    {wh.outOfStockCount}
                  </b>
                </div>
              </div>

              {/* Footer Row */}
              <div className="wh-card-footer">
                <span className="wh-transfers-info">
                  <Truck size={13} /> {wh.pendingTransfersCount} transferencias
                </span>
                <span className="wh-action-link">
                  Ver sede <ArrowRight size={13} />
                </span>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
