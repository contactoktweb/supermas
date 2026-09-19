'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface AccountingHeaderProps {
  onOpenNewEntry: () => void
  onOpenNewAccount: () => void
  onExport: () => void
  onRefresh: () => void
  canCreateEntry: boolean
  canManageAccounts: boolean
  isRefreshing?: boolean
}

export function AccountingHeader({
  onOpenNewEntry,
  onOpenNewAccount,
  onExport,
  onRefresh,
  canCreateEntry,
  canManageAccounts,
  isRefreshing = false,
}: AccountingHeaderProps) {
  return (
    <header className="page-heading page-enter">
      <div>
        <p className="eyebrow">Núcleo Financiero & Partida Doble</p>
        <h1>Contabilidad</h1>
        <p className="welcome-subtitle">
          Gestiona movimientos contables, cuentas, costos y reportes financieros.
        </p>
      </div>

      <div className="heading-actions">
        <button
          type="button"
          className="outline-button"
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Actualizar datos contables"
          aria-label="Actualizar datos"
        >
          <AppIcon
            name="refresh"
            size={16}
            className={isRefreshing ? 'animate-spin' : ''}
          />
        </button>

        <button
          type="button"
          className="outline-button"
          onClick={onExport}
          title="Exportar información a CSV"
        >
          <AppIcon name="download" size={16} />
          <span>Exportar</span>
        </button>

        {canManageAccounts && (
          <button
            type="button"
            className="outline-button"
            onClick={onOpenNewAccount}
            title="Crear nueva cuenta en el PUC"
          >
            <AppIcon name="plus" size={16} />
            <span>Nueva Cuenta</span>
          </button>
        )}

        {canCreateEntry && (
          <button
            type="button"
            className="primary-button"
            onClick={onOpenNewEntry}
            title="Registrar comprobante contable manual"
          >
            <AppIcon name="plus" size={16} />
            <span>Nuevo Asiento</span>
          </button>
        )}
      </div>
    </header>
  )
}
