'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface UsersHeaderProps {
  onRefresh: () => void
  onExport: () => void
  onCreateUser: () => void
  canExport: boolean
  canCreate: boolean
  isLoading: boolean
}

export function UsersHeader({
  onRefresh,
  onExport,
  onCreateUser,
  canExport,
  canCreate,
  isLoading,
}: UsersHeaderProps) {
  return (
    <header className="page-heading page-enter">
      <div>
        <p className="eyebrow">Seguridad & Control de Acceso</p>
        <h1>Usuarios</h1>
        <p className="welcome-subtitle">
          Administra usuarios, roles, accesos y asignaciones dentro del sistema.
        </p>
      </div>

      <div className="heading-actions">
        <button
          type="button"
          className="outline-button"
          onClick={onRefresh}
          disabled={isLoading}
          title="Actualizar directorio de colaboradores"
          aria-label="Refrescar usuarios"
        >
          <AppIcon name="refresh" size={16} />
          <span>{isLoading ? 'Cargando...' : 'Actualizar'}</span>
        </button>

        {canExport && (
          <button
            type="button"
            className="outline-button"
            onClick={onExport}
            disabled={isLoading}
            title="Descargar lista de usuarios en formato CSV"
          >
            <AppIcon name="download" size={16} />
            <span>Exportar CSV</span>
          </button>
        )}

        {canCreate && (
          <button
            type="button"
            className="primary-button"
            onClick={onCreateUser}
            disabled={isLoading}
            title="Crear un nuevo colaborador en el ERP"
          >
            <AppIcon name="plus" size={16} />
            <span>Nuevo usuario</span>
          </button>
        )}
      </div>
    </header>
  )
}
