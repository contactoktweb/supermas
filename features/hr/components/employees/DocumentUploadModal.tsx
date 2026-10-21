'use client'

import React, { useId } from 'react'
import { HrModal } from '../shared/HrModal'
import { HrFormError, HrFormFooter, HrSelectField, HrTextAreaField, HrTextField } from '../shared/HrFormFields'
import { useHrForm } from '../../hooks/useHrForm'
import { hrDocumentService, type DocumentUploadInput } from '../../services/hr-document.service'
import { documentUploadSchema } from '../../schemas/hr.schema'
import { DOCUMENT_TYPE_LABELS, HR_DOCUMENT_MIME_TYPES, toSelectOptions } from '../../constants'
import { formatFileSize } from '../../utils/hr-format'

interface DocumentUploadModalProps {
  employeeId: string
  employeeName: string
  onClose: () => void
  onSaved: (name: string) => void
}

export function DocumentUploadModal({ employeeId, employeeName, onClose, onSaved }: DocumentUploadModalProps) {
  const fileInputId = useId()
  const form = useHrForm<DocumentUploadInput>({
    documentType: 'CONTRATO',
    name: '',
    description: '',
    issueDate: '',
    expiresAt: '',
    file: null,
  })
  const { values, setField, errors, isSubmitting } = form

  const handleFile = (file: File | null) => {
    setField('file', file)
    if (file && !values.name.trim()) setField('name', file.name.replace(/\.[^.]+$/, '').slice(0, 150))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const ok = await form.submit(documentUploadSchema, (data) => hrDocumentService.upload(employeeId, data))
    if (ok) onSaved(values.name.trim())
  }

  return (
    <HrModal title="Cargar documento" subtitle={employeeName} icon="upload" isBusy={isSubmitting} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="modal-form flex flex-col gap-3 pt-4">
        <HrFormError message={errors.form} />
        <div className="form-field">
          <label htmlFor={fileInputId}>
            Archivo <em>*</em>
          </label>
          <input
            id={fileInputId}
            type="file"
            accept={HR_DOCUMENT_MIME_TYPES.join(',')}
            onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
            aria-invalid={Boolean(errors.file)}
            aria-describedby={`${fileInputId}-hint`}
            className="block w-full rounded-lg border border-dashed border-[var(--line)] bg-[#f8fafc] p-3 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-[var(--navy)] file:px-3 file:py-2 file:text-white"
          />
          {errors.file ? (
            <span className="field-error-text">{errors.file}</span>
          ) : (
            <small id={`${fileInputId}-hint`} className="field-hint">
              {values.file ? `${values.file.name} • ${formatFileSize(values.file.size)}` : 'PDF, JPG o PNG de máximo 5 MB. Se almacena en un repositorio privado.'}
            </small>
          )}
        </div>
        <div className="form-grid-2 max-sm:grid-cols-1!">
          <HrSelectField label="Tipo de documento" required value={values.documentType} onChange={(v) => setField('documentType', v as DocumentUploadInput['documentType'])} options={toSelectOptions(DOCUMENT_TYPE_LABELS)} error={errors.documentType} />
          <HrTextField label="Nombre" required value={values.name} onChange={(v) => setField('name', v)} error={errors.name} maxLength={150} />
        </div>
        <div className="form-grid-2 max-sm:grid-cols-1!">
          <HrTextField label="Fecha de expedición" type="date" value={values.issueDate} onChange={(v) => setField('issueDate', v)} error={errors.issueDate} />
          <HrTextField label="Fecha de vencimiento" type="date" value={values.expiresAt} onChange={(v) => setField('expiresAt', v)} error={errors.expiresAt} min={values.issueDate || undefined} hint="Genera aviso 30 días antes." />
        </div>
        <HrTextAreaField label="Descripción" value={values.description} onChange={(v) => setField('description', v)} error={errors.description} maxLength={500} />
        <HrFormFooter onCancel={onClose} isSubmitting={isSubmitting} submitLabel="Cargar documento" submittingLabel="Cargando..." />
      </form>
    </HrModal>
  )
}
