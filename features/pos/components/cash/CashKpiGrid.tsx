'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { REDUCED_MOTION_CLASS } from './cashUi'

type KpiTone = 'blue' | 'teal' | 'amber' | 'red'

interface CashKpiCardProps {
  title: string
  value: number
  icon: LightIconName
  tone: KpiTone
  badge: string
  subtext: string
  index: number
}

function CashKpiCard({ title, value, icon, tone, badge, subtext, index }: CashKpiCardProps) {
  return (
    <article
      className={`dashboard-kpi-card tone-${tone} page-enter ${REDUCED_MOTION_CLASS}`}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="kpi-card-header">
        <span className={`kpi-icon-wrap ${tone}`} aria-hidden="true">
          <AppIcon name={icon} size={18} />
        </span>
        <span className="kpi-scope-badge">{badge}</span>
      </div>
      <div className="kpi-card-body">
        <span className="kpi-card-title">{title}</span>
        <strong className="kpi-card-value">{value.toLocaleString('es-CO')}</strong>
      </div>
      <div className="kpi-card-footer">
        <span className="kpi-subtext">{subtext}</span>
      </div>
    </article>
  )
}

interface CashKpiGridProps {
  totalRegisters: number
  openRegisters: number
  closedRegisters: number
  sessionsCount: number
}

export function CashKpiGrid({ totalRegisters, openRegisters, closedRegisters, sessionsCount }: CashKpiGridProps) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Indicadores de cajas y arqueos">
      <CashKpiCard
        title="Cajas registradoras"
        value={totalRegisters}
        icon="cashRegisters"
        tone="blue"
        badge="Inventario"
        subtext="Total registradas en la sede"
        index={0}
      />
      <CashKpiCard
        title="Turnos abiertos"
        value={openRegisters}
        icon="check"
        tone="teal"
        badge="En vivo"
        subtext="Cajas operando ahora"
        index={1}
      />
      <CashKpiCard
        title="Cajas cerradas"
        value={closedRegisters}
        icon="clock"
        tone="amber"
        badge="Disponibles"
        subtext="Listas para apertura"
        index={2}
      />
      <CashKpiCard
        title="Historial de arqueos"
        value={sessionsCount}
        icon="fileText"
        tone="red"
        badge="Auditoría"
        subtext="Turnos registrados"
        index={3}
      />
    </section>
  )
}
