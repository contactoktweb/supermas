'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { WarehousePurchaseRecord } from '../../../types'
import { WarehouseEmptyState } from '../../WarehouseEmptyState'

interface WarehousePurchasesTabProps {
  purchases: WarehousePurchaseRecord[]
  canReadCost: boolean
}

export function WarehousePurchasesTab({ purchases, canReadCost }: WarehousePurchasesTabProps) {
  const [query, setQuery] = useState('')

  const totalPurchases = purchases.reduce((acc, p) => acc + p.totalCost, 0)

  const filtered = purchases.filter(
    (p) =>
      p.invoiceNumber.toLowerCase().includes(query.toLowerCase()) ||
      p.supplierName.toLowerCase().includes(query.toLowerCase()) ||
      p.supplierNit.includes(query)
  )

  return (
    <div className="warehouse-purchases-tab page-enter">
      {/* Upper Metrics */}
      <section className="stats-grid products-stats" aria-label="Métricas de compras">
        <article className="stat-card">
          <div className="stat-icon amber">
            <AppIcon name="purchases" size={18} />
          </div>
          <div className="stat-text">
            <span>Total compras recibidas</span>
            <strong>{canReadCost ? `$${totalPurchases.toLocaleString('es-CO')}` : '••••••••'}</strong>
            <small className="positive"><AppIcon name="arrowDownLeft" size={12} /> {purchases.length} facturas registradas</small>
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-icon blue">
            <AppIcon name="suppliers" size={18} />
          </div>
          <div className="stat-text">
            <span>Proveedores directos</span>
            <strong>{new Set(purchases.map((p) => p.supplierNit)).size}</strong>
            <small className="positive">Aliados comerciales</small>
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
            placeholder="Buscar por factura, proveedor o NIT..."
            aria-label="Buscar compras de esta bodega"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <WarehouseEmptyState
          type="NO_ITEMS"
          customTitle="No hay compras registradas"
          customDescription="Esta bodega no ha registrado entradas directas de facturas de compra."
          onAction={() => setQuery('')}
          actionLabel="Limpiar búsqueda"
        />
      ) : (
        <div className="table-panel animated-table">
          <div className="table-scroll">
            <table aria-label="Historial de compras y entradas de proveedor">
              <thead>
                <tr>
                  <th>Factura / Documento</th>
                  <th>Proveedor</th>
                  <th>NIT</th>
                  <th>Fecha</th>
                  <th>Líneas</th>
                  <th>Total compra</th>
                  <th>Condición pago</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong className="mono">{p.invoiceNumber}</strong>
                    </td>
                    <td>
                      <strong>{p.supplierName}</strong>
                    </td>
                    <td>
                      <span className="mono">{p.supplierNit}</span>
                    </td>
                    <td>
                      <span className="time-muted">{p.date}</span>
                    </td>
                    <td>{p.itemsCount} productos</td>
                    <td>
                      <strong>
                        {canReadCost
                          ? `$${p.totalCost.toLocaleString('es-CO')}`
                          : '••••••••'}
                      </strong>
                    </td>
                    <td>
                      <span className="movement-badge">{p.paymentTerms}</span>
                    </td>
                    <td>
                      <span
                        className={`state ${
                          p.status === 'PAGADA'
                            ? 'disponible'
                            : p.status === 'PENDIENTE'
                            ? 'pendiente'
                            : p.status === 'POR_VENCER'
                            ? 'stock-bajo'
                            : 'agotado'
                        }`}
                      >
                        {p.status}
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
