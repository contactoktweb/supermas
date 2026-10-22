'use client'

import React, { useEffect, useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { RolesConsultationView } from '@/features/settings/components/views/RolesConsultationView'
import { settingsRepository } from '@/features/settings/repositories/settings.repository'
import type { RoleSummary } from '@/features/settings/types'

export function RolesView() {
  const [rolesList, setRolesList] = useState<RoleSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true
    settingsRepository
      .getRoles()
      .then((roles) => {
        if (active) setRolesList(roles)
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const totalPermissions = rolesList.reduce((acc, r) => Math.max(acc, r.permissions.length), 0)

  return (
    <div className="space-y-6">
      {/* Page Heading */}
      <header className="page-heading page-enter">
        <div>
          <p className="eyebrow">Seguridad y Control de Acceso</p>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Roles y Permisos
          </h1>
          <p className="welcome-subtitle">
            Consulta los roles del ERP Super Más y los permisos que cada uno tiene asignados por módulo.
          </p>
        </div>
      </header>

      {/* KPI Stats */}
      <section className="stats-grid products-stats" aria-label="Estadísticas de roles">
        <article className="stat-card">
          <div className="stat-icon blue">
            <AppIcon name="roles" size={18} />
          </div>
          <div className="stat-text">
            <span>Roles del sistema</span>
            <strong>{rolesList.length}</strong>
            <small className="positive">
              <AppIcon name="check" size={12} />
              Asignados en Usuarios
            </small>
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-icon teal">
            <AppIcon name="shield" size={18} />
          </div>
          <div className="stat-text">
            <span>Control de acceso</span>
            <strong>RBAC</strong>
            <small className="positive">
              <AppIcon name="check" size={12} />
              Activo
            </small>
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-icon amber">
            <AppIcon name="lock" size={18} />
          </div>
          <div className="stat-text">
            <span>Permisos granulares</span>
            <strong>{totalPermissions}</strong>
            <small className="positive">
              <AppIcon name="check" size={12} />
              Por perfil
            </small>
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-icon red">
            <AppIcon name="users" size={18} />
          </div>
          <div className="stat-text">
            <span>Asignación</span>
            <strong>Usuarios</strong>
            <small className="positive">
              <AppIcon name="arrowUpRight" size={12} />
              Vinculada
            </small>
          </div>
        </article>
      </section>

      {/* Matrix Panel */}
      <div className="table-panel p-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
        {isLoading ? (
          <p className="text-xs text-slate-500">Cargando roles…</p>
        ) : (
          <RolesConsultationView roles={rolesList} />
        )}
      </div>
    </div>
  )
}
