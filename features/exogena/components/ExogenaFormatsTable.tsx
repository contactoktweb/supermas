'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { ExogenaFormatConfig } from '../types'

interface ExogenaFormatsTableProps {
  formats: ExogenaFormatConfig[]
  onDownloadFormat: (formatNumber: string) => void
  onViewErrors: (formatNumber: string) => void
}

export function ExogenaFormatsTable({
  formats,
  onDownloadFormat,
  onViewErrors,
}: ExogenaFormatsTableProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExogenaFormatConfig | null>(null)

  return (
    <div className="table-panel animated-table warehouse-table-panel" style={{ marginBottom: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 16, color: 'var(--foreground)' }}>
            Formatos Parametrizados por la DIAN
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--muted)' }}>
            Estructuras y versiones oficiales aplicables para el periodo fiscal seleccionado.
          </p>
        </div>
      </div>

      <div className="table-scroll">
        <table aria-label="Tabla de formatos de Exógena">
          <thead>
            <tr>
              <th scope="col">Formato</th>
              <th scope="col">Versión</th>
              <th scope="col">Nombre y Base Legal</th>
              <th scope="col">Categoría</th>
              <th scope="col" style={{ textAlign: 'center' }}>Registros</th>
              <th scope="col" style={{ textAlign: 'center' }}>Inconsistencias</th>
              <th scope="col">Estado</th>
              <th scope="col" style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {formats.map((fmt) => {
              const hasErrors = (fmt.errorsCount || 0) > 0
              const hasWarnings = (fmt.warningsCount || 0) > 0

              return (
                <tr
                  key={fmt.formatNumber}
                  style={{ opacity: fmt.isEnabled ? 1 : 0.65 }}
                  onClick={() => setSelectedFormat(selectedFormat?.formatNumber === fmt.formatNumber ? null : fmt)}
                  title="Haz clic para ver conceptos y reglas tributarias"
                >
                  <td>
                    <span className="mono" style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy)' }}>
                      Formato {fmt.formatNumber}
                    </span>
                  </td>

                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 7px',
                        borderRadius: 4,
                        background: '#eef2fa',
                        color: 'var(--navy)',
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      v{fmt.version}
                    </span>
                  </td>

                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <strong style={{ color: 'var(--foreground)', fontSize: 12 }}>
                        {fmt.name}
                      </strong>
                      <small style={{ color: 'var(--muted)', fontSize: 11, maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {fmt.description}
                      </small>
                    </div>
                  </td>

                  <td>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {fmt.category.replace(/_/g, ' ')}
                    </span>
                  </td>

                  <td style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>
                      {fmt.recordsCount !== undefined ? fmt.recordsCount : '—'}
                    </span>
                  </td>

                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      {hasErrors ? (
                        <button
                          type="button"
                          className="state critico"
                          style={{ cursor: 'pointer', fontSize: 10, padding: '2px 6px' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            onViewErrors(fmt.formatNumber)
                          }}
                          title="Ver errores que bloquean la generación"
                        >
                          <AppIcon name="warning" size={11} />
                          <span>{fmt.errorsCount} err</span>
                        </button>
                      ) : hasWarnings ? (
                        <button
                          type="button"
                          className="state stock-bajo"
                          style={{ cursor: 'pointer', fontSize: 10, padding: '2px 6px' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            onViewErrors(fmt.formatNumber)
                          }}
                          title="Ver advertencias"
                        >
                          <AppIcon name="info" size={11} />
                          <span>{fmt.warningsCount} adv</span>
                        </button>
                      ) : (
                        <span className="state disponible" style={{ fontSize: 10, padding: '2px 6px' }}>
                          <AppIcon name="check" size={11} />
                          <span>Correcto</span>
                        </span>
                      )}
                    </div>
                  </td>

                  <td>
                    {fmt.isEnabled ? (
                      <span className="state disponible" style={{ fontSize: 10 }}>
                        Habilitado
                      </span>
                    ) : (
                      <span className="state" style={{ fontSize: 10, background: '#f1f5f9', color: '#64748b', borderColor: '#cbd5e1' }}>
                        No obligado
                      </span>
                    )}
                  </td>

                  <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="outline-button compact"
                        style={{ height: 28, padding: '0 8px', fontSize: 11 }}
                        onClick={() => onDownloadFormat(fmt.formatNumber)}
                        title={`Descargar archivo plano CSV de Formato ${fmt.formatNumber}`}
                      >
                        <AppIcon name="download" size={12} />
                        <span>CSV</span>
                      </button>

                      <button
                        type="button"
                        className="icon-button"
                        style={{ width: 28, height: 28 }}
                        onClick={() => setSelectedFormat(selectedFormat?.formatNumber === fmt.formatNumber ? null : fmt)}
                        title="Ver conceptos DIAN parametrizados"
                      >
                        <AppIcon name={selectedFormat?.formatNumber === fmt.formatNumber ? 'chevronUp' : 'chevronDown'} size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Vista expandida de Conceptos DIAN del formato seleccionado */}
      {selectedFormat && (
        <div
          style={{
            padding: '16px 20px',
            background: '#fafbfc',
            borderTop: '1px solid var(--line)',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', textTransform: 'uppercase' }}>
                Conceptos DIAN y Mapeo PUC — Formato {selectedFormat.formatNumber} v{selectedFormat.version}
              </span>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted)' }}>
                Fundamento Legal: {selectedFormat.legalBasis} · Tope mínimo reporte: ${selectedFormat.minimumThresholdCOP.toLocaleString('es-CO')} COP
              </p>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => setSelectedFormat(null)}
              style={{ fontSize: 11 }}
            >
              Cerrar conceptos
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
            {selectedFormat.concepts.map((c) => (
              <div
                key={c.code}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  background: '#fff',
                  border: '1px solid var(--line)',
                  fontSize: 11,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <strong style={{ color: 'var(--navy)' }}>Concepto {c.code}</strong>
                  {c.requiresWithholding && (
                    <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#fee2e2', color: 'var(--red)', fontWeight: 700 }}>
                      Requiere Retención
                    </span>
                  )}
                </div>
                <p style={{ margin: '0 0 6px', color: 'var(--foreground)', fontSize: 11, lineHeight: 1.4 }}>
                  {c.name}
                </p>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                  Cuentas PUC: <strong>{c.accountPrefixes.join(', ')}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
