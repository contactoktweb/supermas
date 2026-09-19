'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { AuditStats as AuditStatsData } from '../types'
import { useCountUp } from '@/features/warehouses/hooks/useCountUp'

interface AuditStatsProps {
  stats: AuditStatsData
  isLoading?: boolean
  onFilterCritical?: () => void
}

export function AuditStats({ stats, isLoading, onFilterCritical }: AuditStatsProps) {
  return (
    <section className="stats-grid products-stats" aria-label="Estadísticas de Auditoría">
      <StatCard
        title="Eventos de hoy"
        value={stats.todayEventsCount}
        note="Jornada actual (Bogotá)"
        iconName="calendar"
        tone="blue"
        tooltip="Número de operaciones registradas durante el día de hoy."
      />

      <StatCard
        title="Eventos del periodo"
        value={stats.periodEventsCount}
        note="Filtro seleccionado"
        iconName="audit"
        tone="default"
        tooltip="Total de eventos y transacciones en el rango de búsqueda activo."
      />

      <StatCard
        title="Usuarios activos"
        value={stats.activeUsersCount}
        note="Operando en el sistema"
        iconName="users"
        tone="default"
        tooltip="Colaboradores con actividad o sesiones registradas."
      />

      <StatCard
        title="Acciones críticas"
        value={stats.criticalActionsCount}
        note="Precios, anulaciones, ajustes"
        iconName="warning"
        tone={stats.criticalActionsCount > 0 ? 'red' : 'default'}
        tooltip="Operaciones de alto impacto que requieren supervisión administrativa."
        onClick={onFilterCritical}
        clickable
      />

      <div className="stat-card" style={{ cursor: 'default' }}>
        <div className="stat-icon" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
          <AppIcon name="layers" size={20} />
        </div>
        <div className="stat-text">
          <span className="stat-title">Módulo principal</span>
          <strong style={{ fontSize: 18, color: 'var(--text)', display: 'block', marginTop: 2 }}>
            {stats.topActiveModule !== 'N/A' ? stats.topActiveModule : 'Consolidado'}
          </strong>
          <span className="stat-note">Mayor volumen de registros</span>
        </div>
      </div>

      <StatCard
        title="Pendientes de revisión"
        value={stats.pendingReviewsCount}
        note="Fallidos o críticos"
        iconName="alerts"
        tone={stats.pendingReviewsCount > 0 ? 'amber' : 'default'}
        tooltip="Incidentes con fallos o de severidad crítica que aconsejan validación."
      />
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
