'use client'

import React, { useState, useRef, useEffect } from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { LocationWithMetrics } from '../types'
import { WarehousePermissions } from '../hooks/useWarehousePermissions'

interface WarehouseCardProps {
  warehouse: LocationWithMetrics
  permissions: WarehousePermissions
  onSelect: (id: string) => void
  onEdit: (warehouse: LocationWithMetrics) => void
  onDeactivate: (warehouse: LocationWithMetrics) => void
  onAdjustStock: (warehouse: LocationWithMetrics) => void
  onTransfer: (warehouse: LocationWithMetrics) => void
  onOpenInventory: (id: string) => void
  onOpenKardex: (id: string) => void
  onOpenUsers: (id: string) => void
}

export function WarehouseCard({
  warehouse,
  permissions,
  onSelect,
  onEdit,
  onDeactivate,
  onTransfer,
  onOpenInventory,
  onOpenKardex,
  onOpenUsers,
}: WarehouseCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen])

  const iconName: LightIconName =
    warehouse.type === 'STORE_POINT'
      ? 'pos'
      : warehouse.type === 'DISTRIBUTION_CENTER'
      ? 'suppliers'
      : 'warehouse'

  const isEcommerce = warehouse.settings.isEcommerceProcessingSource

  return (
    <article
      className={`warehouse-card interactive-card ${
        warehouse.status === 'INACTIVE' ? 'card-inactive' : ''
      }`}
      onClick={() => onSelect(warehouse.id)}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(warehouse.id)
        }
      }}
      aria-label={`Bodega ${warehouse.name}, código ${warehouse.code}. Estado: ${
        warehouse.status === 'ACTIVE' ? 'Activa' : 'Inactiva'
      }`}
    >
      {/* Top badges & contextual menu */}
      <div className="warehouse-card-top">
        <div className="card-top-tags">
          <span className={`location-type-badge ${warehouse.type.toLowerCase()}`}>
            {warehouse.type === 'WAREHOUSE'
              ? 'Bodega'
              : warehouse.type === 'STORE_POINT'
              ? 'Punto de venta'
              : 'Centro de distribución'}
          </span>

          {isEcommerce && (
            <span className="ecommerce-badge" title="Bodega configurada para despacho web">
              <AppIcon name="webOrders" size={11} />
              Ecommerce
            </span>
          )}

          <span
            className={`warehouse-status ${
              warehouse.status === 'ACTIVE' ? 'active' : 'inactive'
            }`}
          >
            <i />
            {warehouse.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}
          </span>
        </div>

        {/* Action Menu (•••) */}
        <div
          className="context-menu-wrap"
          ref={menuRef}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="icon-button card-menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Acciones de bodega"
            aria-expanded={menuOpen}
          >
            <AppIcon name="more" size={16} />
          </button>

          {menuOpen && (
            <div className="dropdown-menu-popover" role="menu">
              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  setMenuOpen(false)
                  onSelect(warehouse.id)
                }}
              >
                <AppIcon name="eye" size={14} />
                <span>Ver detalle</span>
              </button>

              {permissions.canEditWarehouse && (
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => {
                    setMenuOpen(false)
                    onEdit(warehouse)
                  }}
                >
                  <AppIcon name="edit" size={14} />
                  <span>Editar bodega</span>
                </button>
              )}

              {permissions.canReadInventory && (
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => {
                    setMenuOpen(false)
                    onOpenInventory(warehouse.id)
                  }}
                >
                  <AppIcon name="inventory" size={14} />
                  <span>Ver inventario</span>
                </button>
              )}

              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  setMenuOpen(false)
                  onOpenKardex(warehouse.id)
                }}
              >
                <AppIcon name="kardex" size={14} />
                <span>Ver Kardex</span>
              </button>

              {permissions.canTransferStock && warehouse.status === 'ACTIVE' && (
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => {
                    setMenuOpen(false)
                    onTransfer(warehouse)
                  }}
                >
                  <AppIcon name="transfers" size={14} />
                  <span>Nueva transferencia</span>
                </button>
              )}

              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  setMenuOpen(false)
                  onOpenUsers(warehouse.id)
                }}
              >
                <AppIcon name="users" size={14} />
                <span>Usuarios asignados</span>
              </button>

              {permissions.canDeactivateWarehouse && warehouse.status === 'ACTIVE' && (
                <button
                  type="button"
                  className="dropdown-item text-danger"
                  onClick={() => {
                    setMenuOpen(false)
                    onDeactivate(warehouse)
                  }}
                >
                  <AppIcon name="powerOff" size={14} />
                  <span>Desactivar bodega</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Title & Icon */}
      <div className="warehouse-title">
        <div
          className={`warehouse-icon ${
            warehouse.type === 'STORE_POINT'
              ? 'tone-1'
              : warehouse.type === 'DISTRIBUTION_CENTER'
              ? 'tone-2'
              : 'tone-blue'
          }`}
        >
          <AppIcon name={iconName} size={22} />
        </div>
        <div>
          <h2>{warehouse.name}</h2>
          <span>
            <strong>{warehouse.code}</strong> · {warehouse.city}
          </span>
        </div>
      </div>

      {/* Inventory Value Section */}
      <div className="warehouse-value">
        <div className="value-label-row">
          <span>Inventario a costo</span>
          <span className="products-count-tag">
            {warehouse.productsCount.toLocaleString('es-CO')} productos
          </span>
        </div>
        <strong>
          {permissions.canReadCost
            ? `$${warehouse.inventoryValueAtCost.toLocaleString('es-CO')}`
            : '••••••••'}
        </strong>
      </div>

      {/* Metric Highlights Grid */}
      <div className="warehouse-metrics">
        <div>
          <span>Ventas hoy</span>
          <b>${warehouse.todaySalesAmount.toLocaleString('es-CO')}</b>
        </div>
        <div>
          <span>Utilidad est.</span>
          <b className={permissions.canReadCost ? 'positive-text' : ''}>
            {permissions.canReadCost
              ? `$${warehouse.estimatedProfit.toLocaleString('es-CO')}`
              : '••••••'}
          </b>
        </div>
        <div>
          <span>Stock bajo / Agotados</span>
          <b
            className={
              warehouse.lowStockProductsCount > 0 || warehouse.outOfStockProductsCount > 0
                ? 'warning-text'
                : ''
            }
          >
            {warehouse.lowStockProductsCount} / {warehouse.outOfStockProductsCount}
          </b>
        </div>
      </div>

      {/* Card Footer with Quick Action */}
      <div className="warehouse-footer" onClick={(e) => e.stopPropagation()}>
        <div className="footer-chips">
          {warehouse.pendingTransfersCount > 0 && (
            <span className="transfer-indicator" title="Transferencias pendientes">
              <AppIcon name="transfers" size={12} />
              {warehouse.pendingTransfersCount} trans.
            </span>
          )}

          {warehouse.activeAlertsCount > 0 && (
            <span className="alert-count" title="Alertas operativas">
              <AppIcon name="warning" size={11} />
              {warehouse.activeAlertsCount} alertas
            </span>
          )}

          <span className="footer-activity">{warehouse.lastActivityAt}</span>
        </div>

        <button
          type="button"
          className="text-button hover-reveal-btn"
          onClick={() => onSelect(warehouse.id)}
          aria-label={`Ver detalles de ${warehouse.name}`}
        >
          <span>Ver bodega</span>
          <AppIcon name="arrowRight" size={14} />
        </button>
      </div>
    </article>
  )
}
