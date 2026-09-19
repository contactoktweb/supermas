'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { RolesConsultationView } from '@/features/settings/components/views/RolesConsultationView'
import { SYSTEM_ROLES } from '@/features/users/services/role-permissions'

export function RolesView() {
  const rolesList = Object.values(SYSTEM_ROLES)
  const totalPermissions = rolesList.reduce(
    (acc, r) => Math.max(acc, r.permissions?.length || 0),
    0
  )

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
            Consulta la matriz de los 6 roles base inmutables del ERP Super Más y sus permisos asignados por módulo.
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
            <span>Roles predefinidos</span>
            <strong>{rolesList.length}</strong>
            <small className="positive">
              <AppIcon name="check" size={12} />
              Inmutables
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
        <RolesConsultationView roles={rolesList} />
      </div>
    </div>
  )
}
