'use client'

import React, { useState } from 'react'
import {
  Search,
  Filter,
  Plus,
  Boxes,
  Truck,
  ClipboardList,
  AlertTriangle,
  ArrowUpDown,
  Eye,
  Pencil,
} from 'lucide-react'
import { WarehouseInventoryItem, LocationWithMetrics } from '../../../types'
import { WarehousePermissions } from '../../../hooks/useWarehousePermissions'
import { WarehouseEmptyState } from '../../WarehouseEmptyState'

interface WarehouseInventoryTabProps {
  warehouse: LocationWithMetrics
  inventory: WarehouseInventoryItem[]
  permissions: WarehousePermissions
  canReadCost: boolean
  onAdjustStock: (item: WarehouseInventoryItem) => void
  onTransferStock: (item: WarehouseInventoryItem) => void
  onViewKardex: (productId: string) => void
}

export function WarehouseInventoryTab({
  warehouse,
  inventory,
  permissions,
  canReadCost,
  onAdjustStock,
  onTransferStock,
  onViewKardex,
}: WarehouseInventoryTabProps) {
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const categories = Array.from(new Set(inventory.map((i) => i.category)))

  const filtered = inventory.filter((item) => {
    const matchQuery =
      item.productName.toLowerCase().includes(query.toLowerCase()) ||
      item.sku.toLowerCase().includes(query.toLowerCase()) ||
      item.barcode.includes(query)
    const matchCategory =
      categoryFilter === 'ALL' || item.category.toLowerCase() === categoryFilter.toLowerCase()
    const matchStatus = statusFilter === 'ALL' || item.status === statusFilter

    return matchQuery && matchCategory && matchStatus
  })

  return (
    <div className="warehouse-inventory-tab page-enter">
      {/* Toolbar */}
      <div className="toolbar inventory-toolbar">
        <div className="search-box wide">
          <Search size={16} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por producto, SKU o código de barras..."
            aria-label="Buscar producto en esta bodega"
          />
        </div>

        <div className="filter-select-wrap">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="filter-select"
            aria-label="Filtrar por categoría"
          >
            <option value="ALL">Categoría: Todas</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-select-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
            aria-label="Filtrar por estado de stock"
          >
            <option value="ALL">Estado: Todos</option>
            <option value="NORMAL">Normal</option>
            <option value="LOW_STOCK">Stock bajo</option>
            <option value="CRITICAL">Crítico</option>
            <option value="OUT_OF_STOCK">Agotado</option>
          </select>
        </div>

        {permissions.canAdjustStock && warehouse.status === 'ACTIVE' && (
          <button
            type="button"
            className="primary-button compact export"
            onClick={() => {
              if (inventory.length > 0) onAdjustStock(inventory[0])
            }}
            title="Realizar ajuste de existencias mediante Kardex"
          >
            <Plus size={15} />
            <span>Ajustar inventario</span>
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <WarehouseEmptyState
          type="NO_FILTER_RESULTS"
          onAction={() => {
            setQuery('')
            setCategoryFilter('ALL')
            setStatusFilter('ALL')
          }}
          actionLabel="Limpiar filtros"
        />
      ) : (
        <div className="table-panel animated-table">
          <div className="table-scroll">
            <table aria-label="Inventario por producto en esta bodega">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>SKU</th>
                  <th>Categoría</th>
                  <th>Existencia</th>
                  <th>Estado</th>
                  <th>Stock Mín.</th>
                  <th>Costo promedio</th>
                  <th>Valor total costo</th>
                  <th>Último movimiento</th>
                  <th aria-label="Acciones">Acciones rápidas</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="product-cell">
                        <div className="product-thumb">
                          <Boxes size={18} />
                        </div>
                        <div>
                          <strong>{item.productName}</strong>
                          <small className="mono">{item.barcode}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="mono">{item.sku}</span>
                    </td>
                    <td>{item.category}</td>
                    <td>
                      <strong className="stock-number">
                        {item.currentStock} {item.unit}
                      </strong>
                    </td>
                    <td>
                      <span
                        className={`state ${
                          item.status === 'OUT_OF_STOCK'
                            ? 'agotado'
                            : item.status === 'CRITICAL'
                            ? 'crítico'
                            : item.status === 'LOW_STOCK'
                            ? 'stock-bajo'
                            : 'disponible'
                        }`}
                      >
                        {item.status === 'OUT_OF_STOCK'
                          ? 'Agotado'
                          : item.status === 'CRITICAL'
                          ? 'Crítico'
                          : item.status === 'LOW_STOCK'
                          ? 'Stock bajo'
                          : 'Normal'}
                      </span>
                    </td>
                    <td>{item.minStock} uds</td>
                    <td>
                      {canReadCost
                        ? `$${item.averageCost.toLocaleString('es-CO')}`
                        : '••••••'}
                    </td>
                    <td>
                      <strong>
                        {canReadCost
                          ? `$${item.totalValueAtCost.toLocaleString('es-CO')}`
                          : '••••••••'}
                      </strong>
                    </td>
                    <td>
                      <span className="time-muted">{item.lastMovementAt}</span>
                    </td>
                    <td>
                      <div className="row-actions" style={{ opacity: 1 }}>
                        {permissions.canAdjustStock && warehouse.status === 'ACTIVE' && (
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => onAdjustStock(item)}
                            title="Ajustar existencia (Kardex)"
                            aria-label={`Ajustar stock de ${item.productName}`}
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {permissions.canTransferStock &&
                          warehouse.status === 'ACTIVE' &&
                          item.currentStock > 0 && (
                            <button
                              type="button"
                              className="icon-button"
                              onClick={() => onTransferStock(item)}
                              title="Transferir a otra bodega"
                              aria-label={`Transferir ${item.productName}`}
                            >
                              <Truck size={14} />
                            </button>
                          )}
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => onViewKardex(item.productId)}
                          title="Ver trazabilidad en Kardex"
                          aria-label={`Ver Kardex de ${item.productName}`}
                        >
                          <ClipboardList size={14} />
                        </button>
                      </div>
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
