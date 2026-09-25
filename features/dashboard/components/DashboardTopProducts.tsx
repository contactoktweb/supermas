'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { TopProductItem } from '../types'
import { dashboardService } from '../services/dashboard.service'

interface DashboardTopProductsProps {
  products: TopProductItem[]
  onViewAllProducts: () => void
}

export function DashboardTopProducts({
  products,
  onViewAllProducts,
}: DashboardTopProductsProps) {
  return (
    <section className="panel top-products-panel page-enter">
      <div className="panel-heading">
        <div>
          <div className="panel-title-row">
            <AppIcon name="award" size={18} color="var(--red)" />
            <h2>Productos más vendidos</h2>
          </div>
          <p>Top de rotación comercial y generación de ingresos</p>
        </div>

        <button
          type="button"
          className="text-button"
          onClick={onViewAllProducts}
        >
          Ver catálogo <AppIcon name="arrowUpRight" size={13} />
        </button>
      </div>

      {products.length === 0 ? (
        <div
          className="empty-state-card"
          style={{
            minHeight: 200,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '2.5rem 1rem',
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
            <AppIcon name="award" size={20} color="var(--muted, #64748b)" />
          </div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--foreground)', margin: '0 0 4px 0' }}>
            Sin rotación comercial
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--muted, #64748b)', margin: '0 0 14px 0', maxWidth: 280 }}>
            Aún no se registran ventas para determinar los productos con mayor demanda.
          </p>
          <button
            type="button"
            className="secondary-btn"
            style={{ fontSize: '0.8rem', padding: '6px 14px' }}
            onClick={onViewAllProducts}
          >
            Ir al catálogo de productos
          </button>
        </div>
      ) : (
        <div className="top-products-list">
          {products.map((p, idx) => (
            <article className="top-product-row" key={p.productId}>
              <span className="rank-number">0{idx + 1}</span>

              <div className="top-product-thumb">
                <AppIcon name="products" size={16} />
              </div>

              <div className="top-product-info">
                <div className="top-product-title-row">
                  <strong>{p.name}</strong>
                  <span className="top-product-sku">{p.sku}</span>
                </div>
                <span className="top-product-cat">{p.category}</span>

                {/* Progress bar */}
                <div className="top-product-progress-track">
                  <i
                    className="top-product-progress-fill"
                    style={{ width: `${p.percentage}%` }}
                  />
                </div>
              </div>

              <div className="top-product-stats">
                <b>{p.unitsSold.toLocaleString('es-CO')} uds</b>
                <small>{dashboardService.formatCOP(p.revenue, true)}</small>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
