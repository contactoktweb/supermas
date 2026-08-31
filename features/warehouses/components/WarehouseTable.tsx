'use client'

import React, { useState } from 'react'
import {
  ArrowUpDown,
  MoreHorizontal,
  Eye,
  Pencil,
  PowerOff,
  ChevronLeft,
  ChevronRight,
  Boxes,
  Truck,
  Users,
} from 'lucide-react'
import { LocationWithMetrics, WarehouseSortOption } from '../types'
import { WarehousePermissions } from '../hooks/useWarehousePermissions'
import { WarehouseEmptyState } from './WarehouseEmptyState'

interface WarehouseTableProps {
  warehouses: LocationWithMetrics[]
  permissions: WarehousePermissions
  total: number
  page: number
  pageSize: number
  sortBy?: WarehouseSortOption
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onSortChange: (sortBy: WarehouseSortOption) => void
  onSelect: (id: string) => void
  onEdit: (warehouse: LocationWithMetrics) => void
  onDeactivate: (warehouse: LocationWithMetrics) => void
  onClearFilters: () => void
}

export function WarehouseTable({
  warehouses,
  permissions,
  total,
  page,
  pageSize,
  sortBy,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  onSelect,
  onEdit,
  onDeactivate,
  onClearFilters,
}: WarehouseTableProps) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const totalPages = Math.ceil(total / pageSize) || 1

  if (warehouses.length === 0) {
    return (
      <WarehouseEmptyState
        type="NO_FILTER_RESULTS"
        onAction={onClearFilters}
        actionLabel="Limpiar filtros"
      />
    )
  }

  const handleSort = (option: WarehouseSortOption) => {
    onSortChange(option)
  }

  return (
    <div className="table-panel animated-table warehouse-table-panel">
      <div className="table-scroll">
        <table aria-label="Tabla de bodegas y ubicaciones">
          <thead>
            <tr>
              <th scope="col">Código</th>
              <th scope="col">
                <button
                  type="button"
                  className="table-sort-btn"
                  onClick={() =>
                    handleSort(sortBy === 'NAME_ASC' ? 'NAME_DESC' : 'NAME_ASC')
                  }
                >
                  <span>Bodega</span>
                  <ArrowUpDown size={11} />
                </button>
              </th>
              <th scope="col">Tipo</th>
              <th scope="col">Estado</th>
              <th scope="col">Productos</th>
              <th scope="col">
                <button
                  type="button"
                  className="table-sort-btn"
                  onClick={() =>
                    handleSort(
                      sortBy === 'INVENTORY_DESC' ? 'INVENTORY_ASC' : 'INVENTORY_DESC'
                    )
                  }
                >
                  <span>Inventario costo</span>
                  <ArrowUpDown size={11} />
                </button>
              </th>
              <th scope="col">
                <button
                  type="button"
                  className="table-sort-btn"
                  onClick={() => handleSort('SALES_DESC')}
                >
                  <span>Ventas hoy</span>
                  <ArrowUpDown size={11} />
                </button>
              </th>
              <th scope="col">Utilidad</th>
              <th scope="col">Stock bajo</th>
              <th scope="col">Transf.</th>
              <th scope="col">Usuarios</th>
              <th scope="col">Última actividad</th>
              <th scope="col" aria-label="Acciones">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {warehouses.map((wh) => (
              <tr
                key={wh.id}
                onClick={() => onSelect(wh.id)}
                tabIndex={0}
                role="row"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSelect(wh.id)
                }}
              >
                <td>
                  <strong className="mono code-badge">{wh.code}</strong>
                </td>
                <td>
                  <div className="warehouse-name-cell">
                    <strong>{wh.name}</strong>
                    <small>{wh.city} · {wh.address}</small>
                  </div>
                </td>
                <td>
                  <span className={`location-type-badge ${wh.type.toLowerCase()}`}>
                    {wh.type === 'WAREHOUSE'
                      ? 'Bodega'
                      : wh.type === 'STORE_POINT'
                      ? 'Punto de venta'
                      : 'CEDI'}
                  </span>
                </td>
                <td>
                  <span
                    className={`state ${
                      wh.status === 'ACTIVE' ? 'disponible' : 'agotado'
                    }`}
                  >
                    {wh.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td>
                  <b>{wh.productsCount.toLocaleString('es-CO')}</b>
                </td>
                <td>
                  <strong>
                    {permissions.canReadCost
                      ? `$${wh.inventoryValueAtCost.toLocaleString('es-CO')}`
                      : '••••••••'}
                  </strong>
                </td>
                <td>
                  <b>${wh.todaySalesAmount.toLocaleString('es-CO')}</b>
                </td>
                <td>
                  <span className={permissions.canReadCost ? 'positive-text' : ''}>
                    {permissions.canReadCost
                      ? `$${wh.estimatedProfit.toLocaleString('es-CO')}`
                      : '••••••'}
                  </span>
                </td>
                <td>
                  {wh.lowStockProductsCount > 0 ? (
                    <span className="state stock-bajo" title="Productos con stock bajo">
                      {wh.lowStockProductsCount}
                    </span>
                  ) : (
                    <span className="positive-text">0</span>
                  )}
                </td>
                <td>
                  <b>{wh.pendingTransfersCount}</b>
                </td>
                <td>
                  <span className="user-count-chip">
                    <Users size={11} />
                    {wh.assignedUsersCount}
                  </span>
                </td>
                <td>
                  <span className="time-muted">{wh.lastActivityAt}</span>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="table-actions-cell">
                    <button
                      type="button"
                      className="icon-button row-btn"
                      onClick={() => onSelect(wh.id)}
                      title="Ver detalle"
                      aria-label={`Ver detalles de ${wh.name}`}
                    >
                      <Eye size={14} />
                    </button>
                    {permissions.canEditWarehouse && (
                      <button
                        type="button"
                        className="icon-button row-btn"
                        onClick={() => onEdit(wh)}
                        title="Editar bodega"
                        aria-label={`Editar ${wh.name}`}
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    {permissions.canDeactivateWarehouse && wh.status === 'ACTIVE' && (
                      <button
                        type="button"
                        className="icon-button row-btn text-danger"
                        onClick={() => onDeactivate(wh)}
                        title="Desactivar bodega"
                        aria-label={`Desactivar ${wh.name}`}
                      >
                        <PowerOff size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="table-pagination-footer">
        <div className="pagination-info">
          <span>
            Mostrando <b>{warehouses.length}</b> de <b>{total}</b> bodegas
          </span>
          <div className="page-size-selector">
            <span>Mostrar:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Registros por página"
            >
              <option value={5}>5 por pág.</option>
              <option value={10}>10 por pág.</option>
              <option value={20}>20 por pág.</option>
            </select>
          </div>
        </div>

        <div className="pagination-controls">
          <button
            type="button"
            className="icon-button pagination-btn"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Página anterior"
          >
            <ChevronLeft size={16} />
          </button>

          <span className="pagination-page-indicator">
            Página <b>{page}</b> de <b>{totalPages}</b>
          </span>

          <button
            type="button"
            className="icon-button pagination-btn"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Página siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
