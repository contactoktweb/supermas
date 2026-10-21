'use client'

import React, { useState } from 'react'
import { extractErrorMessage } from '@/lib/utils'
import { HrModal } from './HrModal'
import { HrFormError, HrFormFooter, HrTextAreaField } from './HrFormFields'

export type HrDecision = 'approve' | 'reject' | 'cancel' | 'archive'

const DECISION_COPY: Record<HrDecision, { label: string; required: boolean; field: string | null; tone: 'emerald' | 'red' | 'amber' }> = {
  approve: { label: 'Aprobar', required: false, field: 'Observaciones', tone: 'emerald' },
  reject: { label: 'Rechazar', required: true, field: 'Motivo del rechazo', tone: 'red' },
  cancel: { label: 'Anular', required: true, field: 'Motivo', tone: 'amber' },
  archive: { label: 'Archivar', required: false, field: null, tone: 'amber' },
}

const MIN_REASON_LENGTH = 5

interface HrDecisionModalProps {
  decision: HrDecision
  title: string
  subtitle: string
  summary?: React.ReactNode
  onClose: () => void
  onConfirm: (notes: string) => Promise<void>
}

/** Confirmación de aprobación, rechazo o anulación con observaciones. */
export function HrDecisionModal({ decision, title, subtitle, summary, onClose, onConfirm }: HrDecisionModalProps) {
  const copy = DECISION_COPY[decision]
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (copy.required && notes.trim().length < MIN_REASON_LENGTH) {
      setError(`Indique el ${(copy.field ?? 'motivo').toLowerCase()} (mínimo ${MIN_REASON_LENGTH} caracteres).`)
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      await onConfirm(notes.trim())
    } catch (err) {
      setError(extractErrorMessage(err, 'No se pudo completar la operación.'))
      setIsSubmitting(false)
    }
  }

  return (
    <HrModal
      title={title}
      subtitle={subtitle}
      icon={decision === 'approve' ? 'check' : decision === 'archive' ? 'archive' : 'close'}
      tone={copy.tone}
      isBusy={isSubmitting}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} noValidate className="modal-form flex flex-col gap-3 pt-4">
        {summary}
        <HrFormError message={error} />
        {copy.field && <HrTextAreaField label={copy.field} required={copy.required} value={notes} onChange={setNotes} maxLength={500} />}
        <HrFormFooter
          onCancel={onClose}
          isSubmitting={isSubmitting}
          submitLabel={copy.label}
          submittingLabel="Procesando..."
          tone={decision === 'approve' ? 'primary' : 'danger'}
        />
      </form>
    </HrModal>
  )
}
