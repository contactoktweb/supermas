'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { ConsolidatedProductStock, InventoryStockLevel, InventoryViewMode } from '../types'
import { inventoryService } from '../services/inventory.service'

interface InventoryExportModalProps {
  isOpen: boolean
  viewMode: InventoryViewMode
  data: ConsolidatedProductStock[] | InventoryStockLevel[]
  canSeeCost: boolean
  onClose: () => void
}

export function InventoryExportModal({
  isOpen,
  viewMode,
  data,
  canSeeCost,
  onClose,
}: InventoryExportModalProps) {
  const [mounted, setMounted] = useState(false)
  const [format, setFormat] = useState<'CSV' | 'JSON'>('CSV')
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Escape key support
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (!isOpen) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen])

  if (!isOpen || !mounted) return null

  const handleDownload = () => {
    setIsExporting(true)
    try {
      if (format === 'CSV') {
        const csvContent = inventoryService.generateCSV(data, viewMode, canSeeCost)
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.setAttribute('href', url)
        link.setAttribute(
          'download',
          `inventario_supermas_${viewMode.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`
        )
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        const jsonContent = JSON.stringify(data, null, 2)
        const blob = new Blob([jsonContent], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.setAttribute('href', url)
        link.setAttribute(
          'download',
          `inventario_supermas_${viewMode.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.json`
        )
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
      onClose()
    } catch (err) {
      console.error('Export error:', err)
    } finally {
      setIsExporting(false)
    }
  }

  return createPortal(
    <div
      className="drawer-backdrop modal-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-export-title"
    >
      <div
        className="modal-card inventory-export-modal animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-title" id="modal-export-title">
            <div className="modal-icon-badge">
              <AppIcon name="download" size={18} color="var(--navy)" />
            </div>
            <div>
              <h3>Exportar inventario</h3>
              <p>Descarga los registros filtrados en tu formato de preferencia.</p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <AppIcon name="close" size={16} />
          </button>
        </div>

        <div className="modal-body export-body">
          <div className="export-summary-box">
            <span>Registros listos para exportar:</span>
            <strong>{data.length} elementos ({viewMode === 'CONSOLIDATED' ? 'Consolidado' : 'Por bodega'})</strong>
          </div>

          <div className="input-field-block">
            <label>Formato de archivo:</label>
            <div className="export-format-selector">
              <button
                type="button"
                className={`format-card ${format === 'CSV' ? 'active' : ''}`}
                onClick={() => setFormat('CSV')}
              >
                <AppIcon name="reports" size={20} color="var(--navy)" />
                <strong>CSV / Excel</strong>
                <small>Compatible con hojas de cálculo y Power BI</small>
              </button>

              <button
                type="button"
                className={`format-card ${format === 'JSON' ? 'active' : ''}`}
                onClick={() => setFormat('JSON')}
              >
                <AppIcon name="terminal" size={20} color="var(--navy)" />
                <strong>JSON</strong>
                <small>Estructura cruda para integración de sistemas</small>
              </button>
            </div>
          </div>

          <div className="export-security-note">
            <AppIcon name="shield" size={14} color="#64748b" />
            <span>
              {canSeeCost
                ? 'El archivo incluirá costos unitarios y valoración económica total.'
                : 'Los campos de costos monetarios han sido omitidos por tu nivel de permisos.'}
            </span>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="outline-button compact" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="primary-button compact"
            onClick={handleDownload}
            disabled={isExporting}
          >
            <AppIcon name="download" size={14} />
            <span>{isExporting ? 'Generando...' : 'Descargar archivo'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
