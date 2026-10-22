'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import type { SettingsStats } from '../types'

interface SettingsStatsProps {
  stats: SettingsStats | null
}

const formatLastModified = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sin cambios registrados'

export function SettingsStatsCards({ stats }: SettingsStatsProps) {
  return (
    <section className="stats-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Resumen de configuración">
      <article className="stat-card">
        <div className="stat-icon blue">
          <AppIcon name="settings" size={18} />
        </div>
        <div className="stat-text">
          <span>Parámetros editables</span>
          <strong>{stats?.editableSettingsCount ?? 0}</strong>
          <small className="positive">
            <AppIcon name="check" size={13} />
            Conectados a sus módulos
          </small>
        </div>
      </article>

      <article className="stat-card">
        <div className="stat-icon teal">
          <AppIcon name="history" size={18} />
        </div>
        <div className="stat-text">
          <span>Último cambio</span>
          <strong className="text-sm leading-snug">{formatLastModified(stats?.lastModifiedAt)}</strong>
          {stats?.lastModifiedBy && <small className="text-slate-400 truncate">por {stats.lastModifiedBy}</small>}
        </div>
      </article>

      <article className="stat-card">
        <div className="stat-icon amber">
          <AppIcon name="warehouse" size={18} />
        </div>
        <div className="stat-text">
          <span>Sedes activas</span>
          <strong>{stats?.activeLocationsCount ?? 0}</strong>
          <small className="text-slate-400">Disponibles para POS y despacho web</small>
        </div>
      </article>

      <article className="stat-card">
        <div className="stat-icon red">
          <AppIcon name="roles" size={18} />
        </div>
        <div className="stat-text">
          <span>Roles del sistema</span>
          <strong>{stats?.rolesCount ?? 0}</strong>
          <small className="text-slate-400">Se asignan desde Usuarios</small>
        </div>
      </article>
    </section>
  )
}
