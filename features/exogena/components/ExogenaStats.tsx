'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { ExogenaStats as ExogenaStatsData } from '../types'
import { useCountUp } from '@/features/warehouses/hooks/useCountUp'

interface ExogenaStatsProps {
  stats: ExogenaStatsData
  onOpenValidationErrors?: () => void
}

export function ExogenaStats({ stats, onOpenValidationErrors }: ExogenaStatsProps) {
  const getStatusLabel = () => {
    switch (stats.validationStatus) {
      case 'GENERATED':
        return 'Generado / Presentado'
      case 'VALIDATED':
        return 'Validado sin errores'
      case 'HAS_ERRORS':
        return 'Con errores críticos'
      case 'PENDING':
      default:
        return 'Pendiente de validación'
    }
  }

  const getStatusTone = (): 'blue' | 'teal' | 'amber' | 'red' => {
    switch (stats.validationStatus) {
      case 'GENERATED':
      case 'VALIDATED':
        return 'teal'
      case 'HAS_ERRORS':
        return 'red'
      case 'PENDING':
      default:
        return 'amber'
    }
  }

  return (
    <section className="stats-grid products-stats" aria-label="Estadísticas de Exógena Tributaria">
      <StatCard
        title="Registros por reportar"
        value={stats.recordsToReportCount}
        note="Consolidado actual"
        iconName="receipt"
        tone="blue"
        tooltip="Total de transacciones consolidadas y listas para inclusión en formatos DIAN."
      />

      <StatCard
        title="Terceros identificados"
        value={stats.identifiedThirdPartiesCount}
        note="Clientes y proveedores"
        iconName="customers"
        tone="blue"
        tooltip="Personas naturales y jurídicas con movimientos en compras, ventas o cuentas por cobrar/pagar."
      />

      <StatCard
        title="Formatos habilitados"
        value={stats.enabledFormatsCount}
        note="Exigidos por normativa"
        iconName="fileText"
        tone="teal"
        tooltip="Formatos DIAN configurados según el perfil fiscal de Super Más."
      />

      <StatCard
        title="Registros con errores"
        value={stats.recordsWithErrorsCount}
        note={stats.recordsWithErrorsCount > 0 ? 'Bloquea generación' : '0 errores críticos'}
        iconName="warning"
        tone={stats.recordsWithErrorsCount > 0 ? 'red' : 'teal'}
        tooltip="Inconsistencias que impiden la presentación formal del archivo ante la DIAN."
        onClick={stats.recordsWithErrorsCount > 0 ? onOpenValidationErrors : undefined}
      />

      <StatCard
        title="Registros con advertencias"
        value={stats.recordsWithWarningsCount}
        note={stats.recordsWithWarningsCount > 0 ? 'Revisar datos' : 'Sin advertencias'}
        iconName="alerts"
        tone={stats.recordsWithWarningsCount > 0 ? 'amber' : 'teal'}
        tooltip="Advertencias de consistencia sugeridas (direcciones incompletas, duplicados)."
        onClick={stats.recordsWithWarningsCount > 0 ? onOpenValidationErrors : undefined}
      />

      {/* Tarjeta Última Generación */}
      <article className="stat-card" title="Fecha del último paquete DIAN generado">
        <div className="stat-icon blue">
          <AppIcon name="clock" size={18} />
        </div>
        <div className="stat-text">
          <span>Última generación</span>
          <strong style={{ fontSize: 14, marginTop: 4, letterSpacing: -0.2 }}>
            {stats.lastBatchCode || 'Sin generar'}
          </strong>
          <small className="positive">
            <AppIcon name="calendar" size={13} />
            {stats.lastGenerationDate
              ? new Date(stats.lastGenerationDate).toLocaleDateString('es-CO')
              : 'Periodo pendiente'}
          </small>
        </div>
        <svg className="sparkline" viewBox="0 0 90 30" aria-hidden="true">
          <polyline points="0,25 15,20 30,22 45,14 60,18 75,9 90,4" />
        </svg>
      </article>

      {/* Tarjeta Estado de Validación */}
      <article className="stat-card" title="Estado de consistencia de la información">
        <div className={`stat-icon ${getStatusTone()}`}>
          <AppIcon
            name={
              stats.validationStatus === 'HAS_ERRORS'
                ? 'warning'
                : stats.validationStatus === 'VALIDATED' || stats.validationStatus === 'GENERATED'
                ? 'check'
                : 'sparkles'
            }
            size={18}
          />
        </div>
        <div className="stat-text">
          <span>Estado de validación</span>
          <strong
            style={{
              fontSize: 14,
              marginTop: 4,
              color:
                stats.validationStatus === 'HAS_ERRORS'
                  ? 'var(--red)'
                  : stats.validationStatus === 'VALIDATED' || stats.validationStatus === 'GENERATED'
                  ? 'var(--green)'
                  : 'var(--amber)',
            }}
          >
            {getStatusLabel()}
          </strong>
          <small className={stats.validationStatus === 'HAS_ERRORS' ? 'warning-text' : 'positive'}>
            <AppIcon name="checkSimple" size={13} />
            {stats.recordsWithErrorsCount === 0 ? 'Apto para Muisca' : 'Requiere corrección'}
          </small>
        </div>
        <svg className="sparkline" viewBox="0 0 90 30" aria-hidden="true">
          <polyline points="0,25 15,20 30,22 45,14 60,18 75,9 90,4" />
        </svg>
      </article>
    </section>
  )
}

interface StatCardProps {
  title: string
  value: number
  note: string
  iconName: LightIconName
  tone: 'blue' | 'teal' | 'amber' | 'red'
  tooltip: string
  onClick?: () => void
}

function StatCard({
  title,
  value,
  note,
  iconName,
  tone,
  tooltip,
  onClick,
}: StatCardProps) {
  const animatedValue = useCountUp(value, { duration: 800 })

  return (
    <article
      className="stat-card"
      title={tooltip}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className={`stat-icon ${tone}`}>
        <AppIcon name={iconName} size={18} />
      </div>
      <div className="stat-text">
        <span>{title}</span>
        <strong>{animatedValue}</strong>
        <small className={tone === 'red' ? 'warning-text' : tone === 'amber' ? 'warning-text' : 'positive'}>
          <AppIcon
            name={tone === 'red' || tone === 'amber' ? 'warning' : 'arrowUpRight'}
            size={13}
          />
          {note}
        </small>
      </div>
      <svg className="sparkline" viewBox="0 0 90 30" aria-hidden="true">
        <polyline points="0,25 15,20 30,22 45,14 60,18 75,9 90,4" />
      </svg>
    </article>
  )
}
