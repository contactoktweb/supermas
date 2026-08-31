'use client'

import React from 'react'
import {
  ChevronRight,
  Pencil,
  Truck,
  ClipboardList,
  ArrowLeft,
  Warehouse,
  Store,
  Building,
  PowerOff,
  Globe,
  MapPin,
  User,
  Clock,
} from 'lucide-react'
import { LocationWithMetrics } from '../../types'
import { WarehousePermissions } from '../../hooks/useWarehousePermissions'

interface WarehouseDetailHeaderProps {
  warehouse: LocationWithMetrics
  permissions: WarehousePermissions
  onBack: () => void
  onEdit: () => void
  onTransfer: () => void
  onOpenKardexTab: () => void
  onDeactivate: () => void
}

export function WarehouseDetailHeader({
  warehouse,
  permissions,
  onBack,
  onEdit,
  onTransfer,
  onOpenKardexTab,
  onDeactivate,
}: WarehouseDetailHeaderProps) {
  const Icon =
    warehouse.type === 'STORE_POINT'
      ? Store
      : warehouse.type === 'DISTRIBUTION_CENTER'
      ? Building
      : Warehouse

  const isEcommerce = warehouse.settings.isEcommerceProcessingSource

  return (
    <div className="warehouse-detail-header-card page-enter">
      <div className="detail-top-nav">
        <button type="button" className="back-button" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Volver al listado de bodegas</span>
        </button>

        <div className="breadcrumbs">
          <span>Bodegas</span>
          <ChevronRight size={14} />
          <strong>{warehouse.name}</strong>
        </div>
      </div>

      <div className="detail-main-row">
        <div className="detail-title-section">
          <div
            className={`warehouse-icon large ${
              warehouse.type === 'STORE_POINT'
                ? 'tone-1'
                : warehouse.type === 'DISTRIBUTION_CENTER'
                ? 'tone-2'
                : 'tone-blue'
            }`}
          >
            <Icon size={28} />
          </div>

          <div className="detail-title-copy">
            <div className="detail-badges-row">
              <span className="mono code-badge-large">{warehouse.code}</span>

              <span className={`location-type-badge ${warehouse.type.toLowerCase()}`}>
                {warehouse.type === 'WAREHOUSE'
                  ? 'Bodega de almacenamiento'
                  : warehouse.type === 'STORE_POINT'
                  ? 'Punto de venta'
                  : 'Centro de distribución'}
              </span>

              {isEcommerce && (
                <span className="ecommerce-badge">
                  <Globe size={12} />
                  Despacho Ecommerce
                </span>
              )}

              <span
                className={`warehouse-status ${
                  warehouse.status === 'ACTIVE' ? 'active' : 'inactive'
                }`}
              >
                <i />
                {warehouse.status === 'ACTIVE' ? 'En operación' : 'Inactiva'}
              </span>
            </div>

            <h1>{warehouse.name}</h1>

            <div className="detail-meta-list">
              <span>
                <MapPin size={13} />
                {warehouse.address}, {warehouse.city}
              </span>
              {warehouse.managerName && (
                <span>
                  <User size={13} />
                  Responsable: {warehouse.managerName}
                </span>
              )}
              <span>
                <Clock size={13} />
                Última actividad: {warehouse.lastActivityAt}
              </span>
            </div>
          </div>
        </div>

        <div className="detail-actions-section">
          {permissions.canEditWarehouse && (
            <button
              type="button"
              className="outline-button compact"
              onClick={onEdit}
              title="Editar datos y configuración"
            >
              <Pencil size={15} />
              <span>Editar</span>
            </button>
          )}

          {permissions.canTransferStock && warehouse.status === 'ACTIVE' && (
            <button
              type="button"
              className="outline-button compact"
              onClick={onTransfer}
              title="Despachar o recibir transferencia"
            >
              <Truck size={15} />
              <span>Transferencia</span>
            </button>
          )}

          <button
            type="button"
            className="primary-button compact"
            onClick={onOpenKardexTab}
            title="Ir al Kardex de esta bodega"
          >
            <ClipboardList size={15} />
            <span>Ver Kardex</span>
          </button>

          {permissions.canDeactivateWarehouse && warehouse.status === 'ACTIVE' && (
            <button
              type="button"
              className="icon-button detail-danger-btn"
              onClick={onDeactivate}
              title="Desactivar bodega de forma segura"
              aria-label="Desactivar bodega"
            >
              <PowerOff size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
