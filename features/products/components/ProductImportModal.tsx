'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { productImportService } from '../services/product-import.service'
import { ProductImportPreview, ProductImportRow } from '../types/import.types'

interface ProductImportModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (count: number) => void
}

export function ProductImportModal({
  isOpen,
  onClose,
  onSuccess,
}: ProductImportModalProps) {
  const [mounted, setMounted] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<ProductImportPreview | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isOpen || !mounted) return null

  const handleDownloadTemplate = () => {
    const csvContent = productImportService.generateTemplateCsv()
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'plantilla_productos_supermas.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleFileChange = async (selectedFile: File) => {
    setFile(selectedFile)
    setErrorMessage(null)
    setPreview(null)
    setIsProcessing(true)

    try {
      const text = await selectedFile.text()
      const previewResult = await productImportService.previewCsv(text)
      setPreview(previewResult)
    } catch (err: any) {
      setErrorMessage(`Error al leer el archivo: ${err.message || 'Formato no válido'}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleUpload = async () => {
    if (!preview || preview.validCount === 0) return
    setIsProcessing(true)
    setErrorMessage(null)

    try {
      const validRows: ProductImportRow[] = preview.rows
        .filter((r) => r.isValid)
        .map((r) => r.parsed)

      const result = await productImportService.executeImport(validRows)

      if (result.importedCount > 0) {
        onSuccess(result.importedCount)
        onClose()
      } else if (result.errors.length > 0) {
        setErrorMessage(`No se pudo importar ningún producto: ${result.errors[0].message}`)
      }
    } catch (err: any) {
      setErrorMessage(`Error durante la importación: ${err.message || 'Falla del servidor'}`)
    } finally {
      setIsProcessing(false)
    }
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
        style={{ maxWidth: 640 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header-standard">
          <div className="dialog-header-title">
            <div className="stat-icon teal">
              <AppIcon name="transfers" size={20} />
            </div>
            <div>
              <p className="eyebrow">Carga Masiva de Catálogo</p>
              <h3>Importar Productos desde CSV</h3>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p className="dialog-text-main" style={{ margin: 0 }}>
              Carga tu archivo CSV estructurado con columnas SKU, Nombre, Precios e IVA.
            </p>
            <button
              type="button"
              className="text-button"
              onClick={handleDownloadTemplate}
              style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <AppIcon name="receipt" size={14} />
              <span>Descargar Plantilla CSV</span>
            </button>
          </div>

          <div
            className={`file-dropzone ${dragOver ? 'is-dragover' : ''} ${
              file ? 'has-file' : ''
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              if (e.dataTransfer.files?.[0]) {
                handleFileChange(e.dataTransfer.files[0])
              }
            }}
          >
            <input
              type="file"
              accept=".csv,.txt"
              id="csv-file-input"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleFileChange(e.target.files[0])
                }
              }}
            />
            <label htmlFor="csv-file-input" className="dropzone-label">
              <AppIcon name="receipt" size={32} />
              {file ? (
                <div>
                  <strong>{file.name}</strong>
                  <small>{(file.size / 1024).toFixed(1)} KB listo para procesar</small>
                </div>
              ) : (
                <div>
                  <strong>Haz clic para examinar o arrastra tu archivo aquí</strong>
                  <small>Archivos soportados: .CSV delimitado por comas o punto y coma</small>
                </div>
              )}
            </label>
          </div>

          {preview && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                <span className="badge badge-success">
                  {preview.validCount} {preview.validCount === 1 ? 'fila válida' : 'filas válidas'}
                </span>
                {preview.invalidCount > 0 && (
                  <span className="badge badge-error">
                    {preview.invalidCount} {preview.invalidCount === 1 ? 'fila con error' : 'filas con error'}
                  </span>
                )}
              </div>

              {preview.invalidCount > 0 && (
                <div
                  style={{
                    maxHeight: 120,
                    overflowY: 'auto',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 12,
                    color: '#ef4444',
                  }}
                >
                  {preview.rows
                    .filter((r) => !r.isValid)
                    .map((r, i) => (
                      <div key={i} style={{ marginBottom: 4 }}>
                        <strong>Fila {r.rowNumber} (SKU: {r.parsed.sku || 'N/A'}):</strong> {r.errors.join(' | ')}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {errorMessage && (
            <div className="error-banner" style={{ marginTop: 12 }}>
              <AppIcon name="warning" size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="info-banner-compact" style={{ marginTop: 14 }}>
            <AppIcon name="warning" size={14} />
            <span>
              La importación es transaccional. Todo producto con stock inicial creará movimientos auditables en el Kardex.
            </span>
          </div>
        </div>

        <div className="dialog-footer">
          <button
            type="button"
            className="outline-button"
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={handleUpload}
            disabled={!preview || preview.validCount === 0 || isProcessing}
          >
            <AppIcon name="check" size={16} />
            <span>
              {isProcessing
                ? 'Validando e importando...'
                : preview
                ? `Importar ${preview.validCount} productos`
                : 'Iniciar importación'}
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

