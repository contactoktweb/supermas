'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { InventoryMovement } from '../types'
import { kardexService } from '../services/kardex.service'

interface KardexExportModalProps {
  isOpen: boolean
  movements: InventoryMovement[]
  isCostRedacted: boolean
  onClose: () => void
}

export function KardexExportModal({
  isOpen,
  movements,
  isCostRedacted,
  onClose,
}: KardexExportModalProps) {
  const [mounted, setMounted] = useState(false)
  const [format, setFormat] = useState<'csv' | 'json'>('csv')
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isOpen || !mounted) return null

  const handleDownload = () => {
    setIsExporting(true)
    setTimeout(() => {
      let content = ''
      let mimeType = 'text/csv;charset=utf-8;'
      const dateStr = new Date().toISOString().slice(0, 10)
      let filename = `kardex_supermas_${dateStr}.csv`

      if (format === 'csv') {
        content = kardexService.exportToCsv(movements, isCostRedacted)
      } else {
        mimeType = 'application/json;charset=utf-8;'
        filename = `kardex_supermas_${dateStr}.json`
        content = JSON.stringify(movements, null, 2)
      }

      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setIsExporting(false)
      onClose()
    }, 400)
  }

  return createPortal(
    <div
      className="drawer-backdrop modal-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="deactivate-dialog-card page-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header-standard">
          <div className="dialog-header-title">
            <div className="stat-icon blue">
              <AppIcon name="download" size={20} />
            </div>
            <div>
              <p className="eyebrow">Exportación de Auditoría</p>
              <h3>Descargar Reporte de Kardex</h3>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        <div className="dialog-body">
          <p className="dialog-text-main">
            Se exportarán los <strong>{movements.length} movimientos</strong> que cumplen con los filtros seleccionados.
          </p>

          <div className="form-field">
            <label>Formato de archivo</label>
            <div className="segmented-toggle-wrap">
              <button
                type="button"
                className={format === 'csv' ? 'selected positive' : ''}
                onClick={() => setFormat('csv')}
              >
                CSV (Excel / Hojas de cálculo)
              </button>
              <button
                type="button"
                className={format === 'json' ? 'selected positive' : ''}
                onClick={() => setFormat('json')}
              >
                JSON (Estructurado)
              </button>
            </div>
          </div>

          {isCostRedacted && (
            <div className="info-banner-compact" style={{ marginTop: 14 }}>
              <AppIcon name="lock" size={14} />
              <span>
                Los costos unitarios y valores monetarios se enmascaran automáticamente por restricción de permisos.
              </span>
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button
            type="button"
            className="outline-button"
            onClick={onClose}
            disabled={isExporting}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={handleDownload}
            disabled={isExporting}
          >
            <AppIcon name="download" size={16} />
            <span>{isExporting ? 'Generando archivo...' : 'Descargar reporte'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
