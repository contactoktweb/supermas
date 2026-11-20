'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { productImportService } from '../services/product-import.service'
import { ProductImportExecutionResult, ProductImportPreview, ProductImportRow } from '../types/import.types'
import { useAuth } from '@/features/auth'
import { decodeCsvBytes } from '@/lib/csv-parser'
import { ProductImportFormatGuide } from './ProductImportFormatGuide'
import { ProductImportPreviewTable } from './ProductImportPreviewTable'

interface ProductImportModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (result: ProductImportExecutionResult) => void
}

export function ProductImportModal({
  isOpen,
  onClose,
  onSuccess,
}: ProductImportModalProps) {
  const { user } = useAuth()
  // Permisos de quien importa: definen si ve el costo actual y si puede cambiarlo (cost.read / costs.manage).
  const importContext = user
    ? {
        userId: user.id,
        userName: user.fullName,
        userRole: user.roleCode === 'SUPERADMIN' ? 'ADMIN' : user.roleCode,
        permissions: user.permissions,
      }
    : { permissions: [] as string[] }
  const [mounted, setMounted] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<ProductImportPreview | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [templateDownloaded, setTemplateDownloaded] = useState(false)
  const [rowErrors, setRowErrors] = useState<ProductImportExecutionResult['errors']>([])

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
    URL.revokeObjectURL(url)
    setTemplateDownloaded(true)
  }

  const handleFileChange = async (selectedFile: File) => {
    setFile(selectedFile)
    setErrorMessage(null)
    setPreview(null)
    setRowErrors([])

    if (!/\.(csv|txt)$/i.test(selectedFile.name)) {
      setErrorMessage('Ese archivo no es CSV. En Excel use Guardar como > CSV y vuelva a cargarlo.')
      return
    }

    setIsProcessing(true)
    try {
      const text = decodeCsvBytes(await selectedFile.arrayBuffer())
      const previewResult = await productImportService.previewCsv(text, undefined, importContext)
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
    setRowErrors([])

    try {
      const validRows: ProductImportRow[] = preview.rows
        .filter((r) => r.isValid)
        .map((r) => r.parsed)

      const result = await productImportService.executeImport(validRows, importContext)

      if (result.importedCount > 0) onSuccess(result)
      if (result.errors.length === 0) {
        onClose()
      } else {
        // Lo aplicado ya quedó guardado: se bloquea un segundo envío del mismo archivo.
        setPreview(null)
        setFile(null)
        setRowErrors(result.errors)
        setErrorMessage(`Se aplicaron ${result.importedCount} productos y ${result.errors.length} no se pudieron guardar.`)
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
        style={{ width: 'min(94vw, 980px)', maxWidth: 980, maxHeight: '92vh', overflowY: 'auto' }}
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
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <p className="dialog-text-main" style={{ margin: 0 }}>
              Sube la plantilla en CSV. Antes de guardar verás qué productos se crean y cuáles se actualizan.
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

          {!preview && <ProductImportFormatGuide justDownloaded={templateDownloaded} />}

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
                e.target.value = ''
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
            <div className="page-enter" style={{ marginTop: 14 }}>
              <h4 style={{ margin: '0 0 4px', fontSize: 14 }}>Vista previa: todavía no se ha guardado nada</h4>
              <p style={{ margin: '0 0 8px', fontSize: 12 }}>
                Compare las cifras con su archivo; los decimales se leen con coma. {preview.createCount} nuevos, {preview.updateCount} por
                actualizar, {preview.unchangedCount} sin cambios y {preview.invalidCount} con error (estos no se importan).
              </p>
              <ProductImportPreviewTable rows={preview.rows} />
            </div>
          )}

          {errorMessage && (
            <div className="error-banner" style={{ marginTop: 12 }}>
              <AppIcon name="warning" size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {rowErrors.length > 0 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12, color: '#dc2626', maxHeight: 120, overflowY: 'auto' }}>
              {rowErrors.map((e, i) => (
                <li key={i}>
                  Fila {e.rowNumber} ({e.sku || 'sin SKU'}): {e.message}
                </li>
              ))}
            </ul>
          )}

          <div className="info-banner-compact" style={{ marginTop: 14 }}>
            <AppIcon name="warning" size={14} />
            <span>
              Cada producto se guarda por separado: si una fila falla, las demás sí quedan. El stock inicial crea su movimiento en el
              Kardex y los cambios de precio siguen la aprobación de precios.
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
                ? 'Procesando...'
                : preview
                ? `Confirmar: ${preview.createCount} nuevos, ${preview.updateCount} actualizados`
                : 'Cargue un archivo'}
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

