'use client'

import React, { useId, useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import type { CashRegister } from '../../types'
import { CashFormError, CashModal } from './CashModal'
import { DEFAULT_OPENING_FLOAT, REDUCED_MOTION_CLASS, getErrorMessage } from './cashUi'

export interface OpenCashSessionValues {
  openingFloat: number
  notes?: string
}

interface OpenCashSessionModalProps {
  register: CashRegister
  onClose: () => void
  onSubmit: (values: OpenCashSessionValues) => Promise<void>
}

export function OpenCashSessionModal({ register, onClose, onSubmit }: OpenCashSessionModalProps) {
  const [openingFloat, setOpeningFloat] = useState<number>(DEFAULT_OPENING_FLOAT)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const floatId = useId()
  const notesId = useId()

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      setSubmitting(true)
      setError(null)
      await onSubmit({ openingFloat: Number(openingFloat) || 0, notes: notes || undefined })
    } catch (err) {
      setError(getErrorMessage(err, 'No fue posible abrir la caja.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CashModal
      title="Apertura de caja"
      subtitle={`${register.name} (${register.code})`}
      icon="lock"
      tone="emerald"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="modal-form">
        <CashFormError message={error} />

        <div className="form-field">
          <label htmlFor={floatId}>
            Base inicial de efectivo (COP)<em>*</em>
          </label>
          <div className="input-wrap">
            <span className="input-prefix">$</span>
            <input
              id={floatId}
              type="number"
              min="0"
              step="1000"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(Number(e.target.value))}
              required
              autoFocus
              className="font-mono font-bold"
            />
          </div>
          <span className="field-hint">Efectivo físico entregado al cajero para dar cambio.</span>
        </div>

        <div className="form-field">
          <label htmlFor={notesId}>Notas de apertura (opcional)</label>
          <textarea
            id={notesId}
            className="custom-form-textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: Turno mañana, billetes de baja denominación..."
            rows={2}
          />
        </div>

        <div className="modal-footer">
          <button type="button" className={`outline-button compact ${REDUCED_MOTION_CLASS}`} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" disabled={submitting} className={`primary-button compact disabled:opacity-50 ${REDUCED_MOTION_CLASS}`}>
            <AppIcon name="lock" size={14} />
            <span>{submitting ? 'Abriendo...' : 'Confirmar apertura'}</span>
          </button>
        </div>
      </form>
    </CashModal>
  )
}
