'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { ExogenaValidationError } from '../types'

interface ExogenaValidationDrawerProps {
  isOpen: boolean
  onClose: () => void
  errors: ExogenaValidationError[]
  year: number
}

export function ExogenaValidationDrawer({
  isOpen,
  onClose,
  errors,
  year,
}: ExogenaValidationDrawerProps) {
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'ERROR' | 'ADVERTENCIA' | 'INFORMATIVO'>('ALL')
  const [formatFilter, setFormatFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const totalErrors = useMemo(() => errors.filter((e) => e.severity === 'ERROR').length, [errors])
  const totalWarnings = useMemo(() => errors.filter((e) => e.severity === 'ADVERTENCIA').length, [errors])
  const totalInfo = useMemo(() => errors.filter((e) => e.severity === 'INFORMATIVO').length, [errors])

  const availableFormats = useMemo(() => {
    const set = new Set<string>()
    errors.forEach((e) => {
      if (e.formatNumber) set.add(e.formatNumber)
    })
    return Array.from(set).sort()
  }, [errors])

  const filteredErrors = useMemo(() => {
    return errors.filter((err) => {
      if (severityFilter !== 'ALL' && err.severity !== severityFilter) return false
      if (formatFilter !== 'ALL' && err.formatNumber !== formatFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesThirdParty = err.thirdPartyName?.toLowerCase().includes(q)
        const matchesDoc = err.thirdPartyDoc?.toLowerCase().includes(q)
        const matchesMessage = err.issueDescription?.toLowerCase().includes(q)
        const matchesField = err.field?.toLowerCase().includes(q)
        if (!matchesThirdParty && !matchesDoc && !matchesMessage && !matchesField) {
          return false
        }
      }
      return true
    })
  }, [errors, severityFilter, formatFilter, searchQuery])

  if (!isOpen) return null

  const handleCopy = (err: ExogenaValidationError) => {
    const text = `[${err.severity}] Formato ${err.formatNumber}\nTercero: ${err.thirdPartyName} (Doc: ${err.thirdPartyDoc})\nCampo: ${err.field} | Valor Actual: "${err.currentValue}"\nProblema: ${err.issueDescription}\nOrigen: ${err.sourceOrigin}`
    navigator.clipboard.writeText(text)
    setCopiedId(err.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const getSeverityBadge = (sev: 'ERROR' | 'ADVERTENCIA' | 'INFORMATIVO') => {
    switch (sev) {
      case 'ERROR':
        return {
          bg: '#fee2e2',
          text: '#991b1b',
          border: '#fecaca',
          label: 'CRÍTICO',
        }
      case 'ADVERTENCIA':
        return {
          bg: '#fef3c7',
          text: '#92400e',
          border: '#fde68a',
          label: 'ADVERTENCIA',
        }
      case 'INFORMATIVO':
        return {
          bg: '#e0f2fe',
          text: '#0369a1',
          border: '#bae6fd',
          label: 'INFO',
        }
    }
  }

  return (
    <div
      className="drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="validation-drawer-title"
    >
      <div
        className="product-drawer"
        style={{
          width: 'min(100%, 820px)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          maxHeight: '100vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Drawer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            paddingBottom: 16,
            borderBottom: '1px solid var(--line, #e2e8f0)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: totalErrors > 0 ? '#fee2e2' : '#dcfce7',
                  color: totalErrors > 0 ? '#991b1b' : '#166534',
                  fontWeight: 700,
                }}
              >
                {totalErrors > 0 ? `${totalErrors} Errores Críticos Bloqueantes` : 'Sin Errores Críticos'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Año Gravable {year}</span>
            </div>
            <h2 id="validation-drawer-title" style={{ margin: 0, fontSize: 19, fontWeight: 700, color: 'var(--text)' }}>
              Auditoría y Validación Tributaria DIAN
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar panel de validación"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Resumen rápido y filtros */}
        <div
          style={{
            padding: '16px 0',
            borderBottom: '1px solid var(--line, #e2e8f0)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setSeverityFilter('ALL')}
              className={`compact ${severityFilter === 'ALL' ? 'primary-button' : 'outline-button'}`}
              style={{ fontSize: 12 }}
            >
              Todos ({errors.length})
            </button>
            <button
              type="button"
              onClick={() => setSeverityFilter('ERROR')}
              className={`compact ${severityFilter === 'ERROR' ? 'primary-button' : 'outline-button'}`}
              style={{ fontSize: 12, color: severityFilter === 'ERROR' ? '#fff' : '#b91c1c' }}
            >
              Errores Críticos ({totalErrors})
            </button>
            <button
              type="button"
              onClick={() => setSeverityFilter('ADVERTENCIA')}
              className={`compact ${severityFilter === 'ADVERTENCIA' ? 'primary-button' : 'outline-button'}`}
              style={{ fontSize: 12, color: severityFilter === 'ADVERTENCIA' ? '#fff' : '#b45309' }}
            >
              Advertencias ({totalWarnings})
            </button>
            <button
              type="button"
              onClick={() => setSeverityFilter('INFORMATIVO')}
              className={`compact ${severityFilter === 'INFORMATIVO' ? 'primary-button' : 'outline-button'}`}
              style={{ fontSize: 12 }}
            >
              Informativos ({totalInfo})
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <input
                type="text"
                placeholder="Buscar por tercero, NIT, campo o problema..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 12px 7px 32px',
                  borderRadius: 6,
                  border: '1px solid var(--line, #cbd5e1)',
                  fontSize: 12.5,
                  background: 'var(--surface, #ffffff)',
                  color: 'var(--text)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--muted)',
                  pointerEvents: 'none',
                }}
              >
                <AppIcon name="search" size={14} />
              </div>
            </div>

            {availableFormats.length > 0 && (
              <select
                value={formatFilter}
                onChange={(e) => setFormatFilter(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--line, #cbd5e1)',
                  fontSize: 12.5,
                  background: 'var(--surface, #ffffff)',
                  color: 'var(--text)',
                }}
              >
                <option value="ALL">Todos los formatos ({availableFormats.length})</option>
                {availableFormats.map((f) => (
                  <option key={f} value={f}>
                    Formato {f}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Lista con scroll de hallazgos */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredErrors.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px' }}>
              <div style={{ color: '#16a34a', marginBottom: 8 }}>
                <AppIcon name="check" size={40} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: 'var(--text)' }}>
                No se encontraron inconsistencias
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                Los registros analizados cumplen con las especificaciones técnicas del prevalidador DIAN.
              </p>
            </div>
          ) : (
            filteredErrors.map((err) => {
              const badge = getSeverityBadge(err.severity)
              return (
                <div
                  key={err.id}
                  style={{
                    padding: 16,
                    borderRadius: 8,
                    border: `1px solid ${badge.border}`,
                    background: 'var(--surface, #ffffff)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: badge.bg,
                          color: badge.text,
                        }}
                      >
                        {badge.label}
                      </span>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: '#eff6ff',
                          color: '#1d4ed8',
                        }}
                      >
                        Formato {err.formatNumber}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="outline-button compact"
                      onClick={() => handleCopy(err)}
                      style={{ fontSize: 11, padding: '2px 8px' }}
                    >
                      <AppIcon name="fileText" size={12} />
                      <span>{copiedId === err.id ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>

                  {/* Mensaje principal de la inconsistencia */}
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                    {err.issueDescription}
                  </div>

                  {/* Detalle del tercero e insumos */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: 8,
                      padding: 10,
                      background: '#f8fafc',
                      borderRadius: 6,
                      fontSize: 12,
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--muted)', display: 'block', fontSize: 11 }}>Tercero / Razón Social:</span>
                      <strong>{err.thirdPartyName || 'No identificado'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--muted)', display: 'block', fontSize: 11 }}>Documento / NIT:</span>
                      <strong>{err.thirdPartyDoc || 'Sin número'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--muted)', display: 'block', fontSize: 11 }}>Campo afectado:</span>
                      <code style={{ background: '#e2e8f0', padding: '1px 4px', borderRadius: 3, fontSize: 11 }}>
                        {err.field}
                      </code>
                    </div>
                    <div>
                      <span style={{ color: 'var(--muted)', display: 'block', fontSize: 11 }}>Valor actual en BD:</span>
                      <span style={{ color: '#b91c1c', fontWeight: 600 }}>
                        {err.currentValue !== undefined && err.currentValue !== ''
                          ? String(err.currentValue)
                          : '<Vacío / Nulo>'}
                      </span>
                    </div>
                  </div>

                  {/* Trazabilidad y enlace a origen */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: 'var(--muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AppIcon name="clock" size={13} />
                      <span>
                        Origen: <strong>{err.sourceOrigin}</strong>
                      </span>
                    </div>
                    {err.sourceLink && (
                      <span style={{ fontSize: 11, color: 'var(--primary, #00205B)', fontWeight: 600 }}>
                        {err.sourceLink}
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer del Drawer */}
        <div
          style={{
            paddingTop: 16,
            borderTop: '1px solid var(--line, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            Mostrando {filteredErrors.length} de {errors.length} hallazgos
          </span>
          <button type="button" className="outline-button compact" onClick={onClose}>
            Cerrar Inspector
          </button>
        </div>
      </div>
    </div>
  )
}
