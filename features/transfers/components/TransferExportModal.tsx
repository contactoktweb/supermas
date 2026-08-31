'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { Transfer } from '../types'
import { transferService } from '../services/transfer.service'

interface TransferExportModalProps {
  isOpen: boolean
  transfers: Transfer[]
  isCostRedacted: boolean
  onClose: () => void
}

export function TransferExportModal({
  isOpen,
  transfers,
  isCostRedacted,
  onClose,
}: TransferExportModalProps) {
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
      let filename = `transferencias_supermas_${dateStr}.csv`

      if (format === 'csv') {
        content = transferService.exportToCsv(transfers, isCostRedacted)
      } else {
        mimeType = 'application/json;charset=utf-8;'
        filename = `transferencias_supermas_${dateStr}.json`
        content = JSON.stringify(transfers, null, 2)
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
              <p className="eyebrow">Exportación de Datos</p>
              <h3>Descargar Reporte de Transferencias</h3>
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
            Se exportarán las <strong>{transfers.length} transferencias</strong> que cumplen con los filtros seleccionados.
          </p>

          <div className="form-field">
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
              Formato de archivo
            </label>
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
                Los valores financieros y costos están ocultos por no contar con el permiso <code>cost.read</code>.
              </span>
            </div>
          )}

          <div className="dialog-actions-row" style={{ marginTop: 20 }}>
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
              <AppIcon name="download" size={14} />
              <span>{isExporting ? 'Generando...' : 'Descargar reporte'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
