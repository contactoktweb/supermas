'use client'

import React, { useState, useRef } from 'react'
import { AppIcon } from '@/components/ui/Icon'

export interface FileUploadProps {
  label?: string
  accept?: string
  maxSizeMB?: number
  value?: string
  onChange: (fileDataUrl: string, file: File) => void
  onRemove?: () => void
  helperText?: string
  required?: boolean
  fileType?: 'image' | 'pdf' | 'any'
  compact?: boolean
  error?: string
}

export function FileUpload({
  label = 'Imagen o archivo',
  accept = 'image/png,image/jpeg,image/webp,image/svg+xml,application/pdf',
  maxSizeMB = 5,
  value,
  onChange,
  onRemove,
  helperText = 'Formatos: PNG, JPG, WEBP, SVG o PDF (Máx. 5MB)',
  required = false,
  fileType = 'image',
  compact = false,
  error,
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileSize, setFileSize] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFile = (file: File) => {
    setLocalError(null)

    // Check size
    const sizeInMB = file.size / (1024 * 1024)
    if (sizeInMB > maxSizeMB) {
      setLocalError(`El archivo supera el tamaño máximo permitido de ${maxSizeMB}MB.`)
      return
    }

    // Format size
    const sizeFormatted =
      file.size < 1024 * 1024
        ? `${(file.size / 1024).toFixed(1)} KB`
        : `${(file.size / (1024 * 1024)).toFixed(2)} MB`

    setFileName(file.name)
    setFileSize(sizeFormatted)

    // Convert to Data URL (Base64) for instant persistence & preview
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      if (dataUrl) {
        onChange(dataUrl, file)
      }
    }
    reader.onerror = () => {
      setLocalError('Error al leer el archivo. Intenta con otro formato.')
    }
    reader.readAsDataURL(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      processFile(files[0])
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    setFileName(null)
    setFileSize(null)
    setLocalError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    if (onRemove) {
      onRemove()
    }
  }

  const isPdf =
    fileName?.toLowerCase().endsWith('.pdf') ||
    value?.startsWith('data:application/pdf') ||
    value?.toLowerCase().endsWith('.pdf')

  const hasValue = Boolean(value && value.trim() !== '')
  const displayError = error || localError

  return (
    <div className={`file-upload-component ${compact ? 'is-compact' : ''}`}>
      {label && (
        <label className="file-upload-label">
          {label} {required && <em>*</em>}
        </label>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        id={`file-upload-${label.replace(/\s+/g, '-').toLowerCase()}`}
      />

      {!hasValue ? (
        <div
          className={`file-upload-dropzone ${isDragOver ? 'is-dragover' : ''} ${
            displayError ? 'has-error' : ''
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
        >
          <div className="dropzone-icon-circle">
            <AppIcon name="upload" size={22} color="var(--navy)" />
          </div>

          <div className="dropzone-text-group">
            <p className="dropzone-main-text">
              <strong>Haz clic para seleccionar</strong> o arrastra y suelta aquí
            </p>
            <span className="dropzone-helper-text">{helperText}</span>
          </div>

          <button
            type="button"
            className="outline-button dropzone-browse-btn"
            onClick={(e) => {
              e.stopPropagation()
              fileInputRef.current?.click()
            }}
          >
            <AppIcon name="search" size={14} />
            <span>Examinar</span>
          </button>
        </div>
      ) : (
        <div className="file-upload-preview-card">
          <div className="preview-media-wrap">
            {isPdf ? (
              <div className="preview-pdf-badge">
                <AppIcon name="fileText" size={26} color="var(--red)" />
                <span>PDF</span>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={value}
                alt="Vista previa de archivo seleccionado"
                className="preview-img-element"
              />
            )}
          </div>

          <div className="preview-info-wrap">
            <strong className="preview-file-name" title={fileName || 'Archivo cargado'}>
              {fileName || (isPdf ? 'Documento adjunto.pdf' : 'Imagen seleccionada')}
            </strong>
            <div className="preview-meta-tags">
              <span className="preview-tag-badge">
                <AppIcon name="check" size={12} color="var(--green)" />
                <span>Listo</span>
              </span>
              {fileSize && <span className="preview-size-text">{fileSize}</span>}
            </div>
          </div>

          <div className="preview-actions-wrap">
            <button
              type="button"
              className="icon-button change-file-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Cambiar archivo"
              aria-label="Cambiar archivo"
            >
              <AppIcon name="edit" size={15} />
            </button>
            <button
              type="button"
              className="icon-button remove-file-btn"
              onClick={handleRemove}
              title="Eliminar archivo"
              aria-label="Eliminar archivo"
            >
              <AppIcon name="trash" size={15} />
            </button>
          </div>
        </div>
      )}

      {displayError && (
        <div className="field-error-text" style={{ marginTop: 6 }}>
          <AppIcon name="warning" size={12} />
          <span>{displayError}</span>
        </div>
      )}
    </div>
  )
}
