'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
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
            <AppIcon name="warehouse" size={18} color="var(--navy)" />
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
          Ver todas las bodegas <AppIcon name="chevronRight" size={14} />
        </button>
      </div>

      {warehouses.length === 0 ? (
        <div
          className="empty-state-card"
          style={{
            minHeight: 180,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '2.5rem 1rem',
            background: 'var(--card-bg, #ffffff)',
            borderRadius: '12px',
            border: '1px dashed var(--border, #e2e8f0)',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'var(--blue-50, #eff6ff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <AppIcon name="warehouse" size={22} color="var(--navy, #001b5c)" />
          </div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--foreground)', margin: '0 0 4px 0' }}>
            No hay bodegas configuradas
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--muted, #64748b)', margin: '0 0 14px 0', maxWidth: 300 }}>
            Configura la sede principal o centros de distribución para comenzar a gestionar inventario y puntos de venta.
          </p>
          <button
            type="button"
            className="primary-btn"
            style={{ fontSize: '0.82rem', padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={onViewAllWarehouses}
          >
            <AppIcon name="plus" size={14} /> Crear nueva bodega
          </button>
        </div>
      ) : (
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
                      <AppIcon name="pos" size={18} color="var(--red)" />
                    ) : isCEDI ? (
                      <AppIcon name="suppliers" size={18} color="var(--amber)" />
                    ) : (
                      <AppIcon name="warehouse" size={18} color="var(--navy)" />
                    )}
                  </div>

                  <div className="wh-badges-group">
                    {wh.isEcommerce && (
                      <span className="ecommerce-badge">
                        <AppIcon name="webOrders" size={11} /> E-commerce
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
                    <AppIcon name="transfers" size={13} /> {wh.pendingTransfersCount} transferencias
                  </span>
                  <span className="wh-action-link">
                    Ver sede <AppIcon name="arrowRight" size={13} />
                  </span>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
