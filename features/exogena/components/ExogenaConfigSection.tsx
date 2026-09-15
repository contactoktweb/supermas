'use client'

import React, { useState, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { ExogenaYearNormativa } from '../types'

interface ExogenaConfigSectionProps {
  normativa: ExogenaYearNormativa | null
  isLoading: boolean
  canConfigure: boolean
  onSave: (data: {
    obligadoType?: string
    responsibleName?: string
    dueDate?: string
    enabledFormats?: string[]
    grossRevenueThreshold?: number
  }) => Promise<void>
  showToast: (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

export function ExogenaConfigSection({
  normativa,
  isLoading,
  canConfigure,
  onSave,
  showToast,
}: ExogenaConfigSectionProps) {
  const [obligadoType, setObligadoType] = useState('')
  const [responsibleName, setResponsibleName] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [grossRevenueThreshold, setGrossRevenueThreshold] = useState(0)
  const [enabledFormats, setEnabledFormats] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (normativa) {
      setObligadoType(normativa.obligadoType)
      setResponsibleName(normativa.responsibleName)
      setDueDate(normativa.dueDate)
      setGrossRevenueThreshold(normativa.grossRevenueThreshold)
      setEnabledFormats(normativa.formats.filter((f) => f.isEnabled).map((f) => f.formatNumber))
      setHasChanges(false)
    }
  }, [normativa])

  if (isLoading || !normativa) {
    return (
      <div className="card" style={{ padding: '24px' }}>
        <div className="skeleton" style={{ height: 28, width: '40%', marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 60, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 180 }} />
      </div>
    )
  }

  const handleFormatToggle = (formatNumber: string, currentlyEnabled: boolean) => {
    if (!canConfigure) return
    if (currentlyEnabled) {
      setEnabledFormats((prev) => prev.filter((f) => f !== formatNumber))
    } else {
      setEnabledFormats((prev) => [...prev, formatNumber])
      showToast(
        'Formato activado',
        `Has habilitado el Formato ${formatNumber}. Recuerda que la obligación formal ante la DIAN debe ser avalada por el Revisor Fiscal o Contador.`,
        'warning'
      )
    }
    setHasChanges(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canConfigure) {
      showToast('Permiso Denegado', 'No cuentas con permisos para modificar la configuración de Exógena.', 'error')
      return
    }

    setIsSaving(true)
    try {
      await onSave({
        obligadoType,
        responsibleName,
        dueDate,
        enabledFormats,
        grossRevenueThreshold,
      })
      setHasChanges(false)
      showToast('Configuración Guardada', 'La parametrización normativa para el año gravable fue actualizada.', 'success')
    } catch (err) {
      showToast('Error al guardar', (err as Error).message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
              Configuración de Obligación y Formatos DIAN
            </h2>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 12,
                background: '#e0f2fe',
                color: '#0369a1',
                fontWeight: 600,
              }}
            >
              Año Gravable {normativa.year}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
            Establece los parámetros normativos, topes de reporte y formatos exigidos según la Resolución {normativa.normativaResolution}.
          </p>
        </div>

        {canConfigure && (
          <button
            type="button"
            className="primary-button"
            disabled={!hasChanges || isSaving}
            onClick={handleSave}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <AppIcon name="settings" size={16} />
            <span>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</span>
          </button>
        )}
      </div>

      {/* Alerta normativa obligatoria */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          padding: 16,
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 8,
          marginBottom: 24,
          alignItems: 'flex-start',
        }}
      >
        <div style={{ color: '#d97706', marginTop: 2, flexShrink: 0 }}>
          <AppIcon name="alerts" size={20} />
        </div>
        <div style={{ fontSize: 12.5, color: '#92400e', lineHeight: 1.5 }}>
          <strong>Aviso Normativo Importante:</strong> La obligación formal de presentar medios magnéticos y los formatos aplicables
          dependen exclusivamente de los ingresos brutos, patrimonio y situación tributaria de Super Más S.A.S. bajo la{' '}
          <strong>{normativa.normativaResolution}</strong> de la DIAN. No habilites ni deshabilites formatos sin previa consulta y validación del
          Revisor Fiscal o Contador público certificado.
        </div>
      </div>

      <form onSubmit={handleSave}>
        {/* Datos generales del obligado y responsable */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
            marginBottom: 24,
            padding: 16,
            background: 'var(--table-header-bg, #f8fafc)',
            borderRadius: 8,
            border: '1px solid var(--line, #e2e8f0)',
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>
              Tipo de Persona / Obligado DIAN
            </label>
            <select
              value={obligadoType}
              onChange={(e) => {
                setObligadoType(e.target.value)
                setHasChanges(true)
              }}
              disabled={!canConfigure}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--line, #cbd5e1)',
                background: 'var(--surface, #ffffff)',
                fontSize: 13,
                color: 'var(--text)',
              }}
            >
              <option value="Personas Jurídicas y asimiladas (Superiores a 500M)">Personas Jurídicas y asimiladas (Superiores a 500M)</option>
              <option value="Gran Contribuyente">Gran Contribuyente</option>
              <option value="Persona Natural Responsable de IVA">Persona Natural Responsable de IVA</option>
              <option value="Entidad No Contribuyente">Entidad No Contribuyente</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>
              Representante Legal / Responsable
            </label>
            <input
              type="text"
              value={responsibleName}
              onChange={(e) => {
                setResponsibleName(e.target.value)
                setHasChanges(true)
              }}
              disabled={!canConfigure}
              placeholder="Nombre del responsable"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--line, #cbd5e1)',
                background: 'var(--surface, #ffffff)',
                fontSize: 13,
                color: 'var(--text)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>
              Fecha Límite DIAN
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value)
                setHasChanges(true)
              }}
              disabled={!canConfigure}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--line, #cbd5e1)',
                background: 'var(--surface, #ffffff)',
                fontSize: 13,
                color: 'var(--text)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>
              Umbral Ingresos Brutos (COP)
            </label>
            <input
              type="text"
              value={new Intl.NumberFormat('es-CO').format(grossRevenueThreshold)}
              onChange={(e) => {
                const num = parseFloat(e.target.value.replace(/\D/g, '')) || 0
                setGrossRevenueThreshold(num)
                setHasChanges(true)
              }}
              disabled={!canConfigure}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--line, #cbd5e1)',
                background: 'var(--surface, #ffffff)',
                fontSize: 13,
                color: 'var(--text)',
              }}
            />
          </div>
        </div>

        {/* Formatos configurables */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
              Matriz de Formatos y Cuantías Mínimas
            </h3>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              {enabledFormats.length} de {normativa.formats.length} habilitados
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {normativa.formats.map((fmt) => {
              const isFmtEnabled = enabledFormats.includes(fmt.formatNumber)
              return (
                <div
                  key={fmt.formatNumber}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderRadius: 8,
                    border: isFmtEnabled ? '1px solid #bfdbfe' : '1px solid var(--line, #e2e8f0)',
                    background: isFmtEnabled ? '#f0f9ff' : 'var(--surface, #ffffff)',
                    transition: 'all 0.2s ease',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 260, flex: 1 }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        cursor: canConfigure ? 'pointer' : 'default',
                        userSelect: 'none',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isFmtEnabled}
                        onChange={() => handleFormatToggle(fmt.formatNumber, isFmtEnabled)}
                        disabled={!canConfigure}
                        style={{
                          width: 18,
                          height: 18,
                          cursor: canConfigure ? 'pointer' : 'default',
                          accentColor: 'var(--primary, #00205B)',
                        }}
                      />
                    </label>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 14,
                            color: isFmtEnabled ? 'var(--primary, #00205B)' : 'var(--muted)',
                          }}
                        >
                          Formato {fmt.formatNumber}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: 'var(--line, #e2e8f0)',
                            color: 'var(--muted)',
                            fontWeight: 600,
                          }}
                        >
                          v{fmt.version}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: isFmtEnabled ? '#dcfce7' : '#f1f5f9',
                            color: isFmtEnabled ? '#166534' : '#64748b',
                            fontWeight: 600,
                          }}
                        >
                          {isFmtEnabled ? 'Habilitado' : 'No reporta'}
                        </span>
                      </div>
                      <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text)', fontWeight: 500 }}>
                        {fmt.name}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>
                        {fmt.description} · Base: <em>{fmt.legalBasis}</em>
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>
                        Cuantía mínima
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                        ${new Intl.NumberFormat('es-CO').format(fmt.minimumThresholdCOP)}
                      </span>
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--muted)', width: 80 }}>
                      {fmt.concepts?.length || 0} conceptos
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </form>
    </div>
  )
}
