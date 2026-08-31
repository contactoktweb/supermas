'use client'

import React from 'react'
import { Package, Award, ArrowUpRight, CheckCircle2, XCircle } from 'lucide-react'
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
            <Award size={16} color="var(--red)" />
            <h2>Productos más vendidos</h2>
          </div>
          <p>Top de rotación comercial y generación de ingresos</p>
        </div>

        <button
          type="button"
          className="text-button"
          onClick={onViewAllProducts}
        >
          Ver catálogo <ArrowUpRight size={13} />
        </button>
      </div>

      <div className="top-products-list">
        {products.map((p, idx) => (
          <article className="top-product-row" key={p.productId}>
            <span className="rank-number">0{idx + 1}</span>

            <div className="top-product-thumb">
              <Package size={16} />
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
    </section>
  )
}
