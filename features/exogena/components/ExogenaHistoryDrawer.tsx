'use client'

import React, { useState, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { ExogenaGenerationRecord } from '../types'
import { exogenaService } from '../services/exogena.service'

interface ExogenaHistoryDrawerProps {
  isOpen: boolean
  onClose: () => void
  history: ExogenaGenerationRecord[]
  showToast: (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

export function ExogenaHistoryDrawer({
  isOpen,
  onClose,
  history,
  showToast,
}: ExogenaHistoryDrawerProps) {
  const [selectedBatch, setSelectedBatch] = useState<ExogenaGenerationRecord | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (selectedBatch) {
          setSelectedBatch(null)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedBatch, onClose])

  if (!isOpen) return null

  const filteredHistory = history.filter((h) => {
    if (!searchTerm.trim()) return true
    const q = searchTerm.toLowerCase()
    return (
      h.year.toString().includes(q) ||
      h.batchCode.toLowerCase().includes(q) ||
      h.userName.toLowerCase().includes(q) ||
      h.status.toLowerCase().includes(q) ||
      h.formatsIncluded.some((f) => f.includes(q))
    )
  })

  const getStatusBadge = (status: ExogenaGenerationRecord['status']) => {
    switch (status) {
      case 'GENERATED':
        return { label: 'Generado', bg: '#dcfce7', text: '#166534' }
      case 'VALIDATED':
        return { label: 'Validado', bg: '#e0f2fe', text: '#0369a1' }
      case 'HAS_ERRORS':
        return { label: 'Con Errores', bg: '#fee2e2', text: '#991b1b' }
      case 'VALIDATING':
        return { label: 'En Validación', bg: '#fef3c7', text: '#92400e' }
      case 'DRAFT':
      default:
        return { label: 'Borrador', bg: '#f1f5f9', text: '#475569' }
    }
  }

  const handleDownloadFile = async (record: ExogenaGenerationRecord) => {
    try {
      const res = await exogenaService.exportFormatCSV(record.year, record.formatsIncluded[0] || '1001')
      const blob = new Blob([res.content], { type: record.fileFormat === 'XML' ? 'application/xml' : 'text/csv' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', record.fileName || `exogena_${record.year}_${record.batchCode}.${record.fileFormat.toLowerCase()}`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      showToast('Descarga iniciada', `Descargando archivo ${record.fileName}`, 'info')
    } catch {
      showToast('Descarga', `Descargando archivo ${record.fileName}`, 'info')
    }
  }

  return (
    <div
      className="drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-drawer-title"
    >
      <div
        className="product-drawer"
        style={{
          width: 'min(100%, 780px)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          maxHeight: '100vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
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
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>
              Trazabilidad & Auditoría
            </span>
            <h2 id="history-drawer-title" style={{ margin: '2px 0 0', fontSize: 19, fontWeight: 700, color: 'var(--text)' }}>
              Historial de Generaciones Exógena
            </h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar historial">
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Buscador */}
        {!selectedBatch && (
          <div style={{ padding: '14px 0', borderBottom: '1px solid var(--line, #e2e8f0)' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Buscar por año, lote, usuario, formato o estado..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  borderRadius: 6,
                  border: '1px solid var(--line, #cbd5e1)',
                  fontSize: 13,
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
          </div>
        )}

        {/* Vista Detalle de un lote específico */}
        {selectedBatch ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
            <button
              type="button"
              className="outline-button compact"
              onClick={() => setSelectedBatch(null)}
              style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <AppIcon name="chevronLeft" size={14} />
              <span>Volver a la lista de lotes</span>
            </button>

            <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
                      Lote {selectedBatch.batchCode}
                    </span>
                    <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 12, fontWeight: 600, background: '#e0f2fe', color: '#0369a1' }}>
                      Año Gravable {selectedBatch.year}
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--muted)' }}>
                    Generado el {new Date(selectedBatch.date).toLocaleString('es-CO', { timeZone: 'America/Bogota' })} por <strong>{selectedBatch.userName}</strong> ({selectedBatch.userRole})
                  </p>
                </div>

                {(() => {
                  const badge = getStatusBadge(selectedBatch.status)
                  return (
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, fontWeight: 700, background: badge.bg, color: badge.text }}>
                      {badge.label}
                    </span>
                  )
                })()}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 16, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>Formatos Reportados</span>
                  <strong style={{ fontSize: 13, color: 'var(--text)' }}>{selectedBatch.formatsIncluded.join(', ')}</strong>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>Total Registros</span>
                  <strong style={{ fontSize: 13, color: 'var(--text)' }}>{selectedBatch.totalRecords.toLocaleString('es-CO')}</strong>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>Errores</span>
                  <strong style={{ fontSize: 13, color: selectedBatch.totalErrors > 0 ? '#b91c1c' : '#166534' }}>
                    {selectedBatch.totalErrors}
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>Advertencias</span>
                  <strong style={{ fontSize: 13, color: selectedBatch.totalWarnings > 0 ? '#b45309' : '#166534' }}>
                    {selectedBatch.totalWarnings}
                  </strong>
                </div>
              </div>

              {selectedBatch.checksum && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed #cbd5e1', fontSize: 11, color: 'var(--muted)', wordBreak: 'break-all' }}>
                  Checksum SHA-256: <code style={{ color: '#0f172a' }}>{selectedBatch.checksum}</code>
                </div>
              )}
            </div>

            <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: 'var(--text)' }}>
              Archivo del Paquete
            </h3>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderRadius: 8,
                border: '1px solid var(--line, #e2e8f0)',
                background: 'var(--surface, #ffffff)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  style={{
                    fontSize: 11,
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: selectedBatch.fileFormat === 'XML' ? '#e0f2fe' : '#fef3c7',
                    color: selectedBatch.fileFormat === 'XML' ? '#0369a1' : '#92400e',
                    fontWeight: 700,
                  }}
                >
                  {selectedBatch.fileFormat}
                </span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{selectedBatch.fileName}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                    Formatos {selectedBatch.formatsIncluded.join(', ')} · {selectedBatch.totalRecords} registros reportados
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="outline-button compact"
                onClick={() => handleDownloadFile(selectedBatch)}
                style={{ fontSize: 11, padding: '4px 10px' }}
              >
                <AppIcon name="download" size={13} />
                <span>Descargar</span>
              </button>
            </div>
          </div>
        ) : (
          /* Lista de Lotes */
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--muted)' }}>
                <AppIcon name="audit" size={36} />
                <p style={{ marginTop: 8, fontSize: 13 }}>No hay lotes de generación registrados.</p>
              </div>
            ) : (
              filteredHistory.map((batch) => {
                const badge = getStatusBadge(batch.status)
                return (
                  <div
                    key={batch.id}
                    onClick={() => setSelectedBatch(batch)}
                    style={{
                      padding: '14px 18px',
                      borderRadius: 8,
                      border: '1px solid var(--line, #e2e8f0)',
                      background: 'var(--surface, #ffffff)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                          Año {batch.year} · Lote {batch.batchCode}
                        </span>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, fontWeight: 700, background: badge.bg, color: badge.text }}>
                          {badge.label}
                        </span>
                      </div>
                      <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                        {new Date(batch.date).toLocaleDateString('es-CO')}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 12, color: 'var(--muted)' }}>
                      <div>
                        Formatos: <strong style={{ color: 'var(--text)' }}>{batch.formatsIncluded.join(', ')}</strong> · Registros: <strong style={{ color: 'var(--text)' }}>{batch.totalRecords}</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--primary, #00205B)', fontWeight: 600 }}>
                        <span>Ver detalles</span>
                        <AppIcon name="chevronRight" size={12} />
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ paddingTop: 16, borderTop: '1px solid var(--line, #e2e8f0)', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="outline-button compact" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
