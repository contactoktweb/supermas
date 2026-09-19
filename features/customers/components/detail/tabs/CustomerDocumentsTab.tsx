'use client'

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { CustomerDocumentSummary, CustomerDocumentDTO } from '../../../types'

interface CustomerDocumentsTabProps {
  documents: CustomerDocumentSummary[]
  customerId: string
  onAddDocument: (dto: CustomerDocumentDTO) => Promise<void>
}

const CATEGORY_LABELS: Record<string, string> = {
  RUT: 'RUT Tributario',
  CAMARA_COMERCIO: 'Cámara de Comercio',
  CEDULA: 'Cédula / Identificación',
  ACUERDO_COMERCIAL: 'Acuerdo Comercial / Pagaré',
  OTRO: 'Otro Documento',
}

const DOC_CATEGORIES: { value: CustomerDocumentDTO['category']; label: string }[] = [
  { value: 'RUT', label: 'RUT Tributario' },
  { value: 'CAMARA_COMERCIO', label: 'Cámara de Comercio' },
  { value: 'CEDULA', label: 'Cédula / Identificación' },
  { value: 'ACUERDO_COMERCIAL', label: 'Acuerdo Comercial / Pagaré' },
  { value: 'OTRO', label: 'Otro Soporte' },
]

function minW(val: number): string {
  return `min(90vw, ${val}px)`
}

export function CustomerDocumentsTab({
  documents,
  customerId,
  onAddDocument,
}: CustomerDocumentsTabProps) {
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [fileName, setFileName] = useState('')
  const [category, setCategory] = useState<CustomerDocumentDTO['category']>('RUT')
  const [notes, setNotes] = useState('')
  const [uploading, setUploading] = useState(false)

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fileName.trim()) return

    try {
      setUploading(true)
      await onAddDocument({
        customerId,
        fileName: fileName.trim().endsWith('.pdf') ? fileName.trim() : `${fileName.trim()}.pdf`,
        fileSize: '1.2 MB',
        fileType: 'application/pdf',
        category,
        notes: notes.trim() || undefined,
      })
      setShowUploadModal(false)
      setFileName('')
      setNotes('')
    } catch (err) {
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Top action row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <strong style={{ fontSize: 13, color: 'var(--foreground)' }}>
              Expediente Digital del Cliente
            </strong>
            <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>
              Almacenamiento seguro en Supabase Storage
            </span>
          </div>

          <button
            type="button"
            className="primary-button compact"
            onClick={() => setShowUploadModal(true)}
          >
            <AppIcon name="plus" size={13} color="#fff" />
            <span>Adjuntar Documento</span>
          </button>
        </div>

        {/* Documents Grid */}
        {documents.length === 0 ? (
          <div className="table-empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 48,
                height: 48,
                borderRadius: 12,
                background: '#e9eef8',
                color: 'var(--navy)',
                margin: '0 auto 12px',
              }}
            >
              <AppIcon name="fileText" size={24} />
            </div>
            <strong style={{ fontSize: 14 }}>No hay documentos adjuntos</strong>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
              Puedes adjuntar el RUT, certificado de Cámara de Comercio o pagarés del cliente.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 14,
            }}
          >
            {documents.map((doc) => (
              <div
                key={doc.id}
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: '#fef2f2',
                      color: 'var(--red)',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <AppIcon name="fileText" size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: 'var(--muted)',
                      }}
                    >
                      {CATEGORY_LABELS[doc.category] || doc.category}
                    </span>
                    <strong
                      style={{
                        display: 'block',
                        fontSize: 12,
                        color: 'var(--foreground)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginTop: 2,
                      }}
                      title={doc.fileName}
                    >
                      {doc.fileName}
                    </strong>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                      {doc.fileSize} • Subido por {doc.uploadedBy}
                    </span>
                  </div>
                </div>

                {doc.notes && (
                  <p style={{ margin: 0, fontSize: 11, color: '#475569', fontStyle: 'italic' }}>
                    {doc.notes}
                  </p>
                )}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: 10,
                    borderTop: '1px solid var(--line)',
                    fontSize: 11,
                  }}
                >
                  <span style={{ color: 'var(--muted)', fontSize: 10 }}>
                    {new Date(doc.uploadedAt).toLocaleDateString('es-CO')}
                  </span>
                  <a
                    href={`#download-${doc.id}`}
                    onClick={(e) => {
                      e.preventDefault()
                      alert(`Descargando archivo: ${doc.fileName} desde Supabase Storage`)
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      color: 'var(--navy)',
                      fontWeight: 700,
                    }}
                  >
                    <AppIcon name="eye" size={12} />
                    <span>Ver / Descargar</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal — mounted via portal at document root */}
      {showUploadModal && createPortal(
        <div className="drawer-backdrop modal-center" onClick={() => setShowUploadModal(false)}>
          <div
            className="warehouse-card page-enter"
            style={{ width: minW(440), maxWidth: 440, padding: 24, cursor: 'default' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <strong style={{ fontSize: 16, color: 'var(--navy)' }}>Adjuntar Soporte al Cliente</strong>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowUploadModal(false)}
              >
                <AppIcon name="close" size={16} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Categoría de Documento <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <CustomSelect
                  value={category}
                  onChange={(val) => setCategory(val as CustomerDocumentDTO['category'])}
                  options={DOC_CATEGORIES}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Nombre del archivo o descripción <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  className="filter-date-input"
                  placeholder="Ej. RUT_Actualizado_2026.pdf"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Notas u observaciones del soporte
                </label>
                <textarea
                  className="filter-date-input"
                  style={{ minHeight: 60 }}
                  placeholder="Vigencia, número de folios, detalles de radicación..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="outline-button compact"
                  onClick={() => setShowUploadModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="primary-button compact"
                  disabled={uploading}
                >
                  <AppIcon name="check" size={14} color="#fff" />
                  <span>{uploading ? 'Subiendo...' : 'Adjuntar Documento'}</span>
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
