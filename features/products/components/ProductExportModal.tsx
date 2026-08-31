'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { Product } from '../types'
import { productService } from '../services/product.service'

interface ProductExportModalProps {
  isOpen: boolean
  products: Product[]
  isCostRedacted: boolean
  onClose: () => void
}

export function ProductExportModal({
  isOpen,
  products,
  isCostRedacted,
  onClose,
}: ProductExportModalProps) {
  const [mounted, setMounted] = useState(false)
  const [format, setFormat] = useState<'csv' | 'json'>('csv')
  const [includeWebStatus, setIncludeWebStatus] = useState(true)
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
      let filename = `productos_supermas_${new Date().toISOString().slice(0, 10)}.csv`

      if (format === 'csv') {
        content = productService.exportToCsv(products, isCostRedacted)
      } else {
        mimeType = 'application/json;charset=utf-8;'
        filename = `productos_supermas_${new Date().toISOString().slice(0, 10)}.json`
        content = JSON.stringify(products, null, 2)
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
              <AppIcon name="kardex" size={20} />
            </div>
            <div>
              <p className="eyebrow">Exportación de Catálogo</p>
              <h3>Exportar Productos Filtrados</h3>
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
            Se exportarán los <strong>{products.length} productos</strong> actualmente filtrados en la vista.
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

          <div className="form-field" style={{ marginTop: 14 }}>
            <label className="check-label">
              <input
                type="checkbox"
                checked={includeWebStatus}
                onChange={(e) => setIncludeWebStatus(e.target.checked)}
              />
              <span>Incluir indicadores de publicación en canales web</span>
            </label>
          </div>

          {isCostRedacted && (
            <div className="info-banner-compact" style={{ marginTop: 12 }}>
              <AppIcon name="lock" size={15} />
              <span>
                Los costos promedio y márgenes se omiten por restricción de permisos.
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
            <AppIcon name="kardex" size={16} />
            <span>{isExporting ? 'Generando archivo...' : 'Descargar catálogo'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
