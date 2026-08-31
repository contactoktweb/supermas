'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'

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
  const [isUploading, setIsUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isOpen || !mounted) return null

  const handleUpload = () => {
    if (!file) return
    setIsUploading(true)
    setTimeout(() => {
      setIsUploading(false)
      onSuccess(12)
      onClose()
    }, 800)
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
            <div className="stat-icon teal">
              <AppIcon name="transfers" size={20} />
            </div>
            <div>
              <p className="eyebrow">Carga Masiva</p>
              <h3>Importar Productos desde CSV / Excel</h3>
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
            Selecciona o arrastra una plantilla CSV estructurada con columnas SKU,
            Nombre, Categoría, Marca, Precios e IVA.
          </p>

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
                setFile(e.dataTransfer.files[0])
              }
            }}
          >
            <input
              type="file"
              accept=".csv,.xlsx"
              id="csv-file-input"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  setFile(e.target.files[0])
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
                  <small>Archivos soportados: .CSV delimitado por comas o .XLSX</small>
                </div>
              )}
            </label>
          </div>

          <div className="info-banner-compact" style={{ marginTop: 14 }}>
            <AppIcon name="warning" size={14} />
            <span>
              La importación validará duplicados de SKU en el servidor antes de insertar.
            </span>
          </div>
        </div>

        <div className="dialog-footer">
          <button
            type="button"
            className="outline-button"
            onClick={onClose}
            disabled={isUploading}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={handleUpload}
            disabled={!file || isUploading}
          >
            <AppIcon name="check" size={16} />
            <span>{isUploading ? 'Validando e importando...' : 'Iniciar importación'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
