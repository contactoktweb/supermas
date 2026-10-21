'use client'

import { useCallback, useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { extractErrorMessage } from '@/lib/utils'
import { HrBadge } from '../shared/HrBadge'
import { HrDecisionModal } from '../shared/HrDecisionModal'
import { HrEmptyState, HrErrorBanner, HrTableSkeleton } from '../shared/HrStates'
import { DocumentUploadModal } from '../employees/DocumentUploadModal'
import { useHrQuery } from '../../hooks/useHrQuery'
import { hrDocumentService } from '../../services/hr-document.service'
import { DOCUMENT_TYPE_LABELS, HR_DOCUMENT_EXPIRY_WARNING_DAYS } from '../../constants'
import { diffDaysIso, formatDate, formatFileSize, todayIso } from '../../utils/hr-format'
import type { HrNotify } from '../../hooks/useHrToasts'
import type { Employee, HrDocument } from '../../types'

interface EmployeeDocumentsTabProps {
  employee: Employee
  canDocuments: boolean
  notify: HrNotify
}

function ExpiryBadge({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return <span className="text-[var(--muted)]">Sin vencimiento</span>
  const days = diffDaysIso(todayIso(), expiresAt)
  if (days < 0) return <HrBadge tone="danger">Vencido {formatDate(expiresAt)}</HrBadge>
  if (days <= HR_DOCUMENT_EXPIRY_WARNING_DAYS) return <HrBadge tone="warning">Vence {formatDate(expiresAt)}</HrBadge>
  return <span>{formatDate(expiresAt)}</span>
}

export function EmployeeDocumentsTab({ employee, canDocuments, notify }: EmployeeDocumentsTabProps) {
  const [includeArchived, setIncludeArchived] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [archiving, setArchiving] = useState<HrDocument | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)

  const loader = useCallback(() => hrDocumentService.list(employee.id, includeArchived), [employee.id, includeArchived])
  const { data, isLoading, error, reload } = useHrQuery(loader)
  const documents = data ?? []

  const openDocument = async (doc: HrDocument) => {
    setOpeningId(doc.id)
    try {
      await hrDocumentService.open(doc.id)
    } catch (err) {
      notify('error', 'No se pudo abrir el documento', extractErrorMessage(err))
    } finally {
      setOpeningId(null)
    }
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="hr-documents-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="hr-documents-title" className="m-0 text-[14px] font-bold">
          Documentos del empleado
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
            Mostrar archivados
          </label>
          {canDocuments && (
            <button type="button" className="primary-button compact" onClick={() => setIsUploading(true)}>
              <AppIcon name="upload" size={14} />
              <span>Cargar documento</span>
            </button>
          )}
        </div>
      </div>

      {error && <HrErrorBanner message={error} onRetry={() => void reload()} />}

      <div className="table-panel animated-table">
        <div className="table-scroll">
          <table className="min-w-[820px]!">
            <thead>
              <tr>
                <th scope="col">Documento</th>
                <th scope="col">Tipo</th>
                <th scope="col">Cargado</th>
                <th scope="col">Vencimiento</th>
                <th scope="col">Tamaño</th>
                <th scope="col" className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <HrTableSkeleton columns={6} rows={3} />
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <HrEmptyState icon="folder" title="Sin documentos" description="Cargue el contrato, la hoja de vida, la autorización de datos y demás soportes del empleado." />
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className={doc.isArchived ? 'opacity-60' : ''}>
                    <td>
                      <span className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
                        <AppIcon name={doc.mimeType === 'application/pdf' ? 'fileText' : 'folder'} size={16} />
                        {doc.name}
                      </span>
                      {doc.description && <small className="max-w-[300px] truncate">{doc.description}</small>}
                    </td>
                    <td>{DOCUMENT_TYPE_LABELS[doc.documentType]}</td>
                    <td>{formatDate(doc.createdAt.slice(0, 10))}</td>
                    <td>{doc.isArchived ? <HrBadge tone="neutral">Archivado</HrBadge> : <ExpiryBadge expiresAt={doc.expiresAt} />}</td>
                    <td>{formatFileSize(doc.sizeBytes)}</td>
                    <td>
                      {canDocuments && (
                        <div className="flex justify-end gap-1">
                          <button type="button" className="outline-button compact" onClick={() => void openDocument(doc)} disabled={openingId === doc.id} aria-label={`Abrir ${doc.name}`}>
                            <AppIcon name={openingId === doc.id ? 'refresh' : 'eye'} size={14} className={openingId === doc.id ? 'spin' : ''} />
                            <span>Abrir</span>
                          </button>
                          {!doc.isArchived && (
                            <button type="button" className="outline-button compact" onClick={() => setArchiving(doc)} aria-label={`Archivar ${doc.name}`}>
                              <AppIcon name="archive" size={14} />
                              <span>Archivar</span>
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isUploading && (
        <DocumentUploadModal
          employeeId={employee.id}
          employeeName={employee.fullName}
          onClose={() => setIsUploading(false)}
          onSaved={(name) => {
            setIsUploading(false)
            notify('success', 'Documento cargado', name)
            void reload()
          }}
        />
      )}

      {archiving && (
        <HrDecisionModal
          decision="archive"
          title="Archivar documento"
          subtitle={`${archiving.name} • se conserva en el historial y deja de mostrarse`}
          onClose={() => setArchiving(null)}
          onConfirm={async () => {
            await hrDocumentService.archive(archiving.id)
            setArchiving(null)
            notify('info', 'Documento archivado', archiving.name)
            void reload()
          }}
        />
      )}
    </section>
  )
}
