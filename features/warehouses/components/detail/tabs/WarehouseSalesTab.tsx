'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { WarehouseSaleRecord } from '../../../types'
import { WarehouseEmptyState } from '../../WarehouseEmptyState'

interface WarehouseSalesTabProps {
  sales: WarehouseSaleRecord[]
  canReadCost: boolean
}

export function WarehouseSalesTab({ sales, canReadCost }: WarehouseSalesTabProps) {
  const [query, setQuery] = useState('')

  const totalSales = sales.reduce((acc, s) => acc + s.totalAmount, 0)
  const totalProfit = sales.reduce((acc, s) => acc + s.profitAmount, 0)
  const ticketsCount = sales.length
  const avgTicket = ticketsCount > 0 ? Math.round(totalSales / ticketsCount) : 0

  const filtered = sales.filter(
    (s) =>
      s.saleCode.toLowerCase().includes(query.toLowerCase()) ||
      s.customerName.toLowerCase().includes(query.toLowerCase()) ||
      s.sellerName.toLowerCase().includes(query.toLowerCase()) ||
      s.customerDoc.includes(query)
  )

  return (
    <div className="warehouse-sales-tab page-enter">
      {/* Sales Summary Metrics */}
      <section className="stats-grid products-stats" aria-label="Métricas de ventas de esta ubicación">
        <article className="stat-card">
          <div className="stat-icon blue">
            <AppIcon name="sales" size={18} />
          </div>
          <div className="stat-text">
            <span>Total ventas registradas</span>
            <strong>${totalSales.toLocaleString('es-CO')}</strong>
            <small className="positive"><AppIcon name="arrowUpRight" size={12} /> {ticketsCount} comprobantes</small>
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-icon teal">
            <AppIcon name="invoices" size={18} />
          </div>
          <div className="stat-text">
            <span>Ticket promedio</span>
            <strong>${avgTicket.toLocaleString('es-CO')}</strong>
            <small className="positive">Por transacción</small>
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-icon teal">
            <AppIcon name="sales" size={18} />
          </div>
          <div className="stat-text">
            <span>Utilidad comercial</span>
            <strong>{canReadCost ? `$${totalProfit.toLocaleString('es-CO')}` : '••••••••'}</strong>
            <small className="positive">Margen estimado</small>
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-icon blue">
            <AppIcon name="users" size={18} />
          </div>
          <div className="stat-text">
            <span>Vendedor destacado</span>
            <strong>Laura Gómez</strong>
            <small className="positive">Mayor facturación</small>
          </div>
        </article>
      </section>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-box wide">
          <AppIcon name="search" size={16} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por código de venta, cliente o vendedor..."
            aria-label="Buscar ventas de esta bodega"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <WarehouseEmptyState
          type="NO_ITEMS"
          customTitle="No hay ventas registradas"
          customDescription="No se encontraron ventas para esta bodega con los criterios actuales."
          onAction={() => setQuery('')}
          actionLabel="Limpiar búsqueda"
        />
      ) : (
        <div className="table-panel animated-table">
          <div className="table-scroll">
            <table aria-label="Historial de ventas de esta ubicación">
              <thead>
                <tr>
                  <th>Venta / Comprobante</th>
                  <th>Fecha y hora</th>
                  <th>Cliente</th>
                  <th>Documento</th>
                  <th>Vendedor</th>
                  <th>Productos</th>
                  <th>Total venta</th>
                  <th>Método de pago</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong className="mono">{s.saleCode}</strong>
                    </td>
                    <td>
                      <span className="time-muted">{s.date}</span>
                    </td>
                    <td>
                      <strong>{s.customerName}</strong>
                    </td>
                    <td>
                      <span className="mono">{s.customerDoc}</span>
                    </td>
                    <td>{s.sellerName}</td>
                    <td>{s.itemsCount} productos</td>
                    <td>
                      <strong>${s.totalAmount.toLocaleString('es-CO')}</strong>
                    </td>
                    <td>
                      <span className="movement-badge">{s.paymentMethod}</span>
                    </td>
                    <td>
                      <span
                        className={`state ${
                          s.status === 'EMITIDA'
                            ? 'disponible'
                            : s.status === 'PENDIENTE'
                            ? 'pendiente'
                            : 'agotado'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
