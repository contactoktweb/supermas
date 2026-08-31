'use client'

import React, { useState } from 'react'
import {
  TrendingUp,
  Boxes,
  Truck,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Package,
  Clock,
  CheckCircle2,
} from 'lucide-react'
import { LocationWithMetrics, WarehouseInventoryItem, WarehouseTransfer, WarehouseMovement } from '../../../types'

interface WarehouseOverviewTabProps {
  warehouse: LocationWithMetrics
  inventory: WarehouseInventoryItem[]
  transfers: WarehouseTransfer[]
  movements: WarehouseMovement[]
  canReadCost: boolean
  onNavigateTab: (tabKey: string) => void
}

export function WarehouseOverviewTab({
  warehouse,
  inventory,
  transfers,
  movements,
  canReadCost,
  onNavigateTab,
}: WarehouseOverviewTabProps) {
  const [chartMetric, setChartMetric] = useState<'SALES' | 'PROFIT'>('SALES')

  const lowStockItems = inventory.filter(
    (i) => i.status === 'LOW_STOCK' || i.status === 'CRITICAL' || i.status === 'OUT_OF_STOCK'
  )

  const topSellingMock = [
    { name: 'Arroz Diana 500g', sku: 'SKU-001842', sales: '$4.82M', units: 1420 },
    { name: 'Aceite Premier 900ml', sku: 'SKU-002107', sales: '$2.94M', units: 300 },
    { name: 'Café Sello Rojo 500g', sku: 'SKU-004229', sales: '$2.13M', units: 150 },
    { name: 'Gaseosa Coca-Cola 1.5L', sku: 'SKU-005882', sales: '$1.45M', units: 280 },
  ]

  const categoriesDistribution = [
    { name: 'Granos y Abastos', pct: '38%', value: '$93.4M' },
    { name: 'Despensa y Aceites', pct: '26%', value: '$63.9M' },
    { name: 'Lácteos y Refrigerados', pct: '18%', value: '$44.2M' },
    { name: 'Bebidas y Líquidos', pct: '12%', value: '$29.5M' },
    { name: 'Enlatados y Otros', pct: '6%', value: '$14.7M' },
  ]

  return (
    <div className="overview-tab-grid page-enter">
      {/* Upper Grid: Sales Performance Chart & Inventory Breakdown */}
      <div className="dashboard-grid">
        {/* Sales / Profit Performance Panel */}
        <section className="panel interactive-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Rendimiento comercial</p>
              <h2>Evolución de Ventas y Rendimiento</h2>
            </div>
            <div className="segmented">
              <button
                type="button"
                className={chartMetric === 'SALES' ? 'selected' : ''}
                onClick={() => setChartMetric('SALES')}
              >
                Ventas
              </button>
              {canReadCost && (
                <button
                  type="button"
                  className={chartMetric === 'PROFIT' ? 'selected' : ''}
                  onClick={() => setChartMetric('PROFIT')}
                >
                  Utilidad
                </button>
              )}
            </div>
          </div>

          <div className="chart-wrapper">
            <div className="line-chart">
              {/* Interactive points with tooltips */}
              <div
                className="line-point"
                style={{ left: '12%', top: '65%' }}
                title="Lunes: $6.8M en ventas"
              />
              <div
                className="line-point"
                style={{ left: '28%', top: '45%' }}
                title="Martes: $8.4M en ventas"
              />
              <div
                className="line-point"
                style={{ left: '46%', top: '55%' }}
                title="Miércoles: $7.2M en ventas"
              />
              <div
                className="line-point"
                style={{ left: '64%', top: '25%' }}
                title="Jueves: $10.8M en ventas"
              />
              <div
                className="line-point"
                style={{ left: '82%', top: '35%' }}
                title="Viernes: $9.6M en ventas"
              />
              <div
                className="line-point"
                style={{ left: '96%', top: '15%' }}
                title="Hoy: $8.42M en ventas"
              />
            </div>

            <div className="chart-legend">
              <span>
                <i className="legend-red" /> Ventas emitidas
              </span>
              <span>
                <i className="legend-blue" /> Promedio semanal
              </span>
            </div>
          </div>
        </section>

        {/* Category Distribution Panel */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Distribución de stock</p>
              <h2>Inventario por Categoría</h2>
            </div>
          </div>

          <div className="donut-wrap">
            <div className="donut">
              <strong>{inventory.length}</strong>
              <span>Líneas activas</span>
            </div>

            <div className="legend-list">
              {categoriesDistribution.map((cat, idx) => (
                <div className="distribution" key={idx} style={{ marginBottom: 8 }}>
                  <div>
                    <span>{cat.name}</span>
                    <b>{canReadCost ? `${cat.value} (${cat.pct})` : cat.pct}</b>
                  </div>
                  <div className="distribution-bar">
                    <i style={{ width: cat.pct }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Bottom Grid: Top Selling, Low Stock, Recent Movements & Transfers */}
      <div className="bottom-grid">
        {/* Top Selling Products */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Mayor rotación</p>
              <h2>Productos Más Vendidos</h2>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => onNavigateTab('VENTAS')}
            >
              Ver todas las ventas <ChevronRight size={13} />
            </button>
          </div>

          <div className="admin-list" style={{ padding: '10px 0 0' }}>
            {topSellingMock.map((prod, idx) => (
              <article className="rank-row" key={prod.sku}>
                <span className="rank">0{idx + 1}</span>
                <div className="admin-row-icon">
                  <Package size={15} />
                </div>
                <div>
                  <strong>{prod.name}</strong>
                  <small>{prod.sku} · {prod.units} unidades vendidas</small>
                </div>
                <b>{prod.sales}</b>
              </article>
            ))}
          </div>
        </section>

        {/* Low Stock Alerts */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Atención preventiva</p>
              <h2>Productos con Stock Bajo</h2>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => onNavigateTab('INVENTARIO')}
            >
              Gestionar inventario <ChevronRight size={13} />
            </button>
          </div>

          <div className="admin-list" style={{ padding: '10px 0 0' }}>
            {lowStockItems.length === 0 ? (
              <div className="drawer-empty" style={{ minHeight: 140 }}>
                <CheckCircle2 size={24} color="#159a67" />
                <p>Todos los productos están en niveles óptimos de inventario.</p>
              </div>
            ) : (
              lowStockItems.slice(0, 4).map((item) => (
                <article className="alert-row" key={item.id}>
                  <AlertTriangle size={16} />
                  <div>
                    <strong>{item.productName}</strong>
                    <span>
                      Stock actual: <b>{item.currentStock} {item.unit}</b> (Mínimo: {item.minStock})
                    </span>
                  </div>
                  <span
                    className={`state ${
                      item.status === 'OUT_OF_STOCK'
                        ? 'agotado'
                        : item.status === 'CRITICAL'
                        ? 'crítico'
                        : 'stock-bajo'
                    }`}
                  >
                    {item.status === 'OUT_OF_STOCK'
                      ? 'Agotado'
                      : item.status === 'CRITICAL'
                      ? 'Crítico'
                      : 'Stock bajo'}
                  </span>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Activity & Transfers Ledger Row */}
      <div className="bottom-grid" style={{ marginTop: 16 }}>
        {/* Recent Kardex Activity */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Trazabilidad en tiempo real</p>
              <h2>Actividad Reciente en Kardex</h2>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => onNavigateTab('MOVIMIENTOS')}
            >
              Ver Kardex completo <ChevronRight size={13} />
            </button>
          </div>

          <div className="admin-list" style={{ padding: '10px 0 0' }}>
            {movements.slice(0, 4).map((m) => (
              <article className="activity-row" key={m.id}>
                <div className="activity-icon">
                  {m.type.includes('SALIDA') || m.type === 'VENTA' ? (
                    <ArrowUpRight size={15} color="#fe110c" />
                  ) : (
                    <ArrowDownRight size={15} color="#159a67" />
                  )}
                </div>
                <div>
                  <strong>{m.productName}</strong>
                  <span>
                    {m.type} ({m.documentRef}) · Por {m.userName}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <b className={m.quantityIn > 0 ? 'positive-text' : 'negative-text'}>
                    {m.quantityIn > 0 ? `+${m.quantityIn}` : `-${m.quantityOut}`} uds
                  </b>
                  <small className="time-muted">{m.createdAt}</small>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Recent Transfers */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Logística de transferencias</p>
              <h2>Transferencias Relacionadas</h2>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => onNavigateTab('TRANSFERENCIAS')}
            >
              Ver transferencias <ChevronRight size={13} />
            </button>
          </div>

          <div className="admin-list" style={{ padding: '10px 0 0' }}>
            {transfers.slice(0, 3).map((t) => (
              <article className="flow-card" key={t.id} style={{ marginBottom: 10, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="mono"><b>{t.code}</b></span>
                  <span className={`state ${t.status.toLowerCase().replace('_', '-')}`}>
                    {t.status === 'EN_TRANSITO'
                      ? 'En tránsito'
                      : t.status === 'RECIBIDA'
                      ? 'Recibida'
                      : t.status === 'PENDIENTE'
                      ? 'Pendiente'
                      : 'Rechazada'}
                  </span>
                </div>
                <div className="flow-location" style={{ margin: '12px 0 8px' }}>
                  <strong>{t.originLocationName}</strong>
                  <Truck size={14} />
                  <strong>{t.destinationLocationName}</strong>
                </div>
                <small>{t.totalUnits} unidades · {t.createdAt}</small>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
