'use client'

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { FileUpload } from '@/components/ui/FileUpload'
import { extractErrorMessage } from '@/lib/utils'
import { customerService } from '../../../services/customer.service'
import { CustomerDocumentSummary, CustomerDocumentDTO } from '../../../types'

interface CustomerDocumentsTabProps {
  documents: CustomerDocumentSummary[]
  customerId: string
  onAddDocument: (dto: CustomerDocumentDTO) => Promise<void>
}

type DocumentCategory = CustomerDocumentDTO['category']

const DOC_CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: 'RUT', label: 'RUT' },
  { value: 'CAMARA_COMERCIO', label: 'Cámara de Comercio' },
  { value: 'CEDULA', label: 'Cédula / Identificación' },
  { value: 'ACUERDO_COMERCIAL', label: 'Acuerdo comercial / Pagaré' },
  { value: 'OTRO', label: 'Otro soporte' },
]

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(DOC_CATEGORIES.map((c) => [c.value, c.label]))
const ACCEPTED_TYPES = 'application/pdf,image/jpeg,image/png'

export function CustomerDocumentsTab({ documents, customerId, onAddDocument }: CustomerDocumentsTabProps) {
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [category, setCategory] = useState<DocumentCategory>('RUT')
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState('')
  const [uploading, setUploading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [openError, setOpenError] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)

  const resetForm = () => {
    setCategory('RUT')
    setName('')
    setNotes('')
    setFile(null)
    setFilePreview('')
    setFormError(null)
  }

  const closeModal = () => {
    if (uploading) return
    setShowUploadModal(false)
    resetForm()
  }

  const handleUploadSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!file) {
      setFormError('Selecciona el archivo a adjuntar.')
      return
    }
    try {
      setUploading(true)
      setFormError(null)
      await onAddDocument({ customerId, category, name: name.trim(), notes: notes.trim() || undefined, file })
      setShowUploadModal(false)
      resetForm()
    } catch (err) {
      setFormError(extractErrorMessage(err, 'No se pudo adjuntar el documento.'))
    } finally {
      setUploading(false)
    }
  }

  const handleOpen = async (documentId: string) => {
    try {
      setOpeningId(documentId)
      setOpenError(null)
      await customerService.openDocument(documentId)
    } catch (err) {
      setOpenError(extractErrorMessage(err, 'No se pudo abrir el documento.'))
    } finally {
      setOpeningId(null)
    }
  }

  return (
    <>
      <section className="customer-docs page-enter" aria-labelledby="customer-docs-title">
        <header className="customer-docs-header">
          <div>
            <h3 id="customer-docs-title">Expediente del cliente</h3>
            <p>RUT, Cámara de Comercio, identificación y acuerdos comerciales en un repositorio privado.</p>
          </div>
          <button type="button" className="primary-button compact" onClick={() => setShowUploadModal(true)}>
            <AppIcon name="plus" size={13} color="#fff" />
            <span>Adjuntar documento</span>
          </button>
        </header>

        {openError && (
          <div className="form-error-banner" role="alert">
            <AppIcon name="warning" size={16} />
            <span>{openError}</span>
          </div>
        )}

        {documents.length === 0 ? (
          <div className="customer-docs-empty">
            <span className="customer-docs-empty-icon" aria-hidden="true">
              <AppIcon name="fileText" size={24} />
            </span>
            <strong>No hay documentos adjuntos</strong>
            <p>Adjunta el RUT, el certificado de Cámara de Comercio o los pagarés del cliente.</p>
          </div>
        ) : (
          <ul className="customer-docs-grid">
            {documents.map((doc) => (
              <li key={doc.id} className="customer-doc-card">
                <div className="customer-doc-main">
                  <span className="customer-doc-icon" aria-hidden="true">
                    <AppIcon name={doc.fileType === 'application/pdf' ? 'fileText' : 'eye'} size={18} />
                  </span>
                  <div className="customer-doc-text">
                    <span className="customer-doc-category">{CATEGORY_LABELS[doc.category] || doc.category}</span>
                    <strong title={doc.fileName}>{doc.fileName}</strong>
                    <span className="customer-doc-meta">
                      {doc.fileSize} · {doc.uploadedBy}
                    </span>
                  </div>
                </div>
                {doc.notes && <p className="customer-doc-notes">{doc.notes}</p>}
                <footer className="customer-doc-footer">
                  <time dateTime={doc.uploadedAt}>{new Date(doc.uploadedAt).toLocaleDateString('es-CO')}</time>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => handleOpen(doc.id)}
                    disabled={openingId === doc.id}
                  >
                    <AppIcon name="eye" size={13} />
                    <span>{openingId === doc.id ? 'Abriendo…' : 'Ver documento'}</span>
                  </button>
                </footer>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showUploadModal &&
        createPortal(
          <div className="drawer-backdrop modal-center" onClick={closeModal}>
            <div
              className="deactivate-dialog-card page-enter"
              role="dialog"
              aria-modal="true"
              aria-labelledby="customer-doc-upload-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="dialog-header-warning">
                <div className="warning-icon-badge" style={{ background: '#edf2fa', color: 'var(--navy)' }}>
                  <AppIcon name="upload" size={22} />
                </div>
                <div>
                  <h3 id="customer-doc-upload-title">Adjuntar documento</h3>
                  <span className="field-hint">Se guarda en el expediente privado del cliente.</span>
                </div>
                <button type="button" className="icon-button close-dialog-btn" onClick={closeModal} aria-label="Cerrar">
                  <AppIcon name="close" size={18} />
                </button>
              </div>

              <form onSubmit={handleUploadSubmit} noValidate className="customer-doc-form">
                {formError && (
                  <div className="form-error-banner" role="alert">
                    <AppIcon name="warning" size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                <FileUpload
                  label="Archivo"
                  required
                  accept={ACCEPTED_TYPES}
                  fileType="any"
                  compact
                  value={filePreview}
                  helperText="PDF, JPG o PNG de máximo 5 MB."
                  onChange={(dataUrl, selected) => {
                    setFile(selected)
                    setFilePreview(dataUrl)
                    setFormError(null)
                    if (!name.trim()) setName(selected.name.replace(/\.[^.]+$/, '').slice(0, 150))
                  }}
                  onRemove={() => {
                    setFile(null)
                    setFilePreview('')
                  }}
                />

                <div className="form-field">
                  <label htmlFor="customer-doc-category">
                    Tipo de documento <em>*</em>
                  </label>
                  <CustomSelect
                    id="customer-doc-category"
                    value={category}
                    onChange={(val) => setCategory(val as DocumentCategory)}
                    options={DOC_CATEGORIES}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="customer-doc-name">
                    Nombre <em>*</em>
                  </label>
                  <div className="input-wrap">
                    <input
                      id="customer-doc-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ej: RUT actualizado 2026"
                      maxLength={150}
                      required
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="customer-doc-notes">Observaciones</label>
                  <textarea
                    id="customer-doc-notes"
                    className="custom-form-textarea"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Vigencia, número de folios, detalles de radicación..."
                    maxLength={500}
                  />
                </div>

                <div className="dialog-footer">
                  <button type="button" className="outline-button" onClick={closeModal} disabled={uploading}>
                    Cancelar
                  </button>
                  <button type="submit" className="primary-button" disabled={uploading || !file || name.trim().length < 3}>
                    <AppIcon name={uploading ? 'refresh' : 'upload'} size={15} className={uploading ? 'spin' : ''} />
                    <span>{uploading ? 'Adjuntando…' : 'Adjuntar documento'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
