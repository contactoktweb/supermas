'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { Purchase } from '../types'
import { purchaseService } from '../services/purchase.service'

interface PurchaseExportModalProps {
  isOpen: boolean
  purchases: Purchase[]
  isCostRedacted: boolean
  onClose: () => void
}

export function PurchaseExportModal({
  isOpen,
  purchases,
  isCostRedacted,
  onClose,
}: PurchaseExportModalProps) {
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
      let filename = `compras_supermas_${dateStr}.csv`

      if (format === 'csv') {
        content = purchaseService.exportToCsv(purchases, isCostRedacted)
      } else {
        mimeType = 'application/json;charset=utf-8;'
        filename = `compras_supermas_${dateStr}.json`
        content = JSON.stringify(purchases, null, 2)
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
    }, 300)
  }

  return createPortal(
    <div
      className="drawer-backdrop modal-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <div
        className="deactivate-dialog-card page-enter"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440, width: '92vw' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div
            className="stat-icon blue"
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: '#eff6ff',
              color: 'var(--navy)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppIcon name="download" size={20} />
          </div>
          <div>
            <h3
              id="export-modal-title"
              style={{ margin: 0, fontSize: 16, color: 'var(--navy)', fontWeight: 800 }}
            >
              Exportar Compras
            </h3>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              {purchases.length} registros seleccionados
            </span>
          </div>
        </div>

        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-main)' }}>
          Descargue la información de las órdenes de compra para análisis en Excel, auditoría tributaria o integración contable.
        </p>

        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <button
            type="button"
            className={`period-tab-btn ${format === 'csv' ? 'selected' : ''}`}
            onClick={() => setFormat('csv')}
            style={{ flex: 1, justifyContent: 'center', padding: '10px 0' }}
          >
            <AppIcon name="invoices" size={16} />
            <span>Formato CSV (Excel)</span>
          </button>
          <button
            type="button"
            className={`period-tab-btn ${format === 'json' ? 'selected' : ''}`}
            onClick={() => setFormat('json')}
            style={{ flex: 1, justifyContent: 'center', padding: '10px 0' }}
          >
            <AppIcon name="terminal" size={16} />
            <span>Formato JSON</span>
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
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
            <span>{isExporting ? 'Generando...' : 'Descargar Archivo'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
