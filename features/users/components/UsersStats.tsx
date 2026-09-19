'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { UserStats } from '../types'
import { useCountUp } from '@/features/warehouses/hooks/useCountUp'

interface UsersStatsProps {
  stats: UserStats
  isLoading?: boolean
  onFilterActive?: () => void
  onFilterInactive?: () => void
}

export function UsersStats({
  stats,
  isLoading,
  onFilterActive,
  onFilterInactive,
}: UsersStatsProps) {
  return (
    <section className="stats-grid products-stats" aria-label="Estadísticas de Usuarios y Roles">
      <StatCard
        title="Total colaboradores"
        value={stats.totalUsersCount}
        note="Registrados en el sistema"
        iconName="users"
        tone="blue"
        tooltip="Número total de usuarios registrados en el ERP."
      />

      <StatCard
        title="Usuarios activos"
        value={stats.activeUsersCount}
        note="Con acceso habilitado"
        iconName="check"
        tone="default"
        tooltip="Usuarios activos que pueden iniciar sesión y operar."
        onClick={onFilterActive}
        clickable
      />

      <StatCard
        title="Usuarios inactivos"
        value={stats.inactiveUsersCount}
        note="Accesos bloqueados"
        iconName="warning"
        tone={stats.inactiveUsersCount > 0 ? 'amber' : 'default'}
        tooltip="Usuarios desactivados sin acceso activo al sistema."
        onClick={onFilterInactive}
        clickable
      />

      <StatCard
        title="Conexión reciente"
        value={stats.recentlyConnectedCount}
        note="Últimos 7 días"
        iconName="calendar"
        tone="default"
        tooltip="Colaboradores que han iniciado sesión durante los últimos 7 días."
      />

      <div className="stat-card" style={{ cursor: 'default' }}>
        <div className="stat-icon" style={{ background: '#f3e8ff', color: '#7e22ce' }}>
          <AppIcon name="lock" size={20} />
        </div>
        <div className="stat-text">
          <span className="stat-title">Roles predefinidos</span>
          <strong style={{ fontSize: 18, color: 'var(--text)', display: 'block', marginTop: 2 }}>
            6 roles base
          </strong>
          <span className="stat-note">Matriz inmutable por código</span>
        </div>
      </div>
    </section>
  )
}

function StatCard({
  title,
  value,
  note,
  iconName,
  tone = 'default',
  tooltip,
  onClick,
  clickable = false,
}: {
  title: string
  value: number
  note: string
  iconName: LightIconName
  tone?: 'default' | 'blue' | 'amber' | 'red'
  tooltip?: string
  onClick?: () => void
  clickable?: boolean
}) {
  const animatedValue = useCountUp(value, { duration: 600 })

  const getToneStyle = () => {
    switch (tone) {
      case 'blue':
        return { bg: '#eff6ff', color: '#1d4ed8' }
      case 'amber':
        return { bg: '#fffbeb', color: '#b45309' }
      case 'red':
        return { bg: '#fef2f2', color: '#b91c1c' }
      case 'default':
      default:
        return { bg: '#f1f5f9', color: '#475569' }
    }
  }

  const toneStyle = getToneStyle()

  return (
    <div
      className="stat-card"
      title={tooltip}
      onClick={onClick}
      style={{
        cursor: clickable ? 'pointer' : 'default',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      <div className="stat-icon" style={{ background: toneStyle.bg, color: toneStyle.color }}>
        <AppIcon name={iconName} size={20} />
      </div>
      <div className="stat-text">
        <span className="stat-title">{title}</span>
        <strong className="stat-value">{animatedValue}</strong>
        <span className="stat-note">{note}</span>
      </div>
    </div>
  )
}
