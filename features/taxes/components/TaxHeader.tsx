'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface TaxHeaderProps {
  onOpenCreate: () => void
  onOpenReports: () => void
  onExport: () => void
  onRefresh: () => void
  canCreate: boolean
  canReport: boolean
  canExport: boolean
  isRefreshing?: boolean
}

export function TaxHeader({
  onOpenCreate,
  onOpenReports,
  onExport,
  onRefresh,
  canCreate,
  canReport,
  canExport,
  isRefreshing = false,
}: TaxHeaderProps) {
  return (
    <header className="page-heading page-enter">
      <div>
        <p className="eyebrow">Gestión Fiscal & Cumplimiento DIAN</p>
        <h1>Impuestos</h1>
        <p className="welcome-subtitle">
          Administra las configuraciones tributarias utilizadas en compras, ventas y facturación.
        </p>
      </div>

      <div className="heading-actions">
        <button
          type="button"
          className="outline-button"
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Actualizar datos tributarios"
          aria-label="Actualizar datos"
        >
          <AppIcon
            name="refresh"
            size={16}
            className={isRefreshing ? 'animate-spin' : ''}
          />
        </button>

        {canReport && (
          <button
            type="button"
            className="outline-button"
            onClick={onOpenReports}
            title="Consultar informe de IVA generado y descontable"
          >
            <AppIcon name="reports" size={16} />
            <span>Reportes tributarios</span>
          </button>
        )}

        {canExport && (
          <button
            type="button"
            className="outline-button"
            onClick={onExport}
            title="Exportar catálogo de configuraciones tributarias a CSV"
          >
            <AppIcon name="download" size={16} />
            <span>Exportar</span>
          </button>
        )}

        {canCreate && (
          <button
            type="button"
            className="primary-button compact"
            onClick={onOpenCreate}
            title="Parametrizar una nueva configuración o tarifa de impuesto"
          >
            <AppIcon name="plus" size={16} />
            <span>Nueva configuración</span>
          </button>
        )}
      </div>
    </header>
  )
}
