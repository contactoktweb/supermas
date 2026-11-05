'use client'

import React, { useEffect, useId, useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import type { CashRegister } from '../../types'
import { CashFormError, CashModal } from './CashModal'
import { useRuntimeSettings } from '@/features/settings/hooks/useRuntimeSettings'
import { REDUCED_MOTION_CLASS, formatCOP, getErrorMessage } from './cashUi'

export interface OpenCashSessionValues {
  openingFloat: number
  notes?: string
  openingKey: string
}

const OPENING_KEY_LENGTH = 6

interface OpenCashSessionModalProps {
  register: CashRegister
  onClose: () => void
  onSubmit: (values: OpenCashSessionValues) => Promise<void>
}

export function OpenCashSessionModal({ register, onClose, onSubmit }: OpenCashSessionModalProps) {
  const { settings, isLoaded } = useRuntimeSettings()
  const { recommendedInitialFloat, maxAllowedInitialFloat } = settings.cash
  const [openingFloat, setOpeningFloat] = useState<number>(recommendedInitialFloat)
  const [touched, setTouched] = useState(false)
  const [notes, setNotes] = useState('')
  const [openingKey, setOpeningKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const floatId = useId()
  const notesId = useId()
  const keyId = useId()
  const keyHintId = useId()

  // La base sugerida de Configuración llega después del primer render; no pisa lo que el cajero escribió.
  useEffect(() => {
    if (isLoaded && !touched) setOpeningFloat(recommendedInitialFloat)
  }, [isLoaded, touched, recommendedInitialFloat])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (openingKey.length !== OPENING_KEY_LENGTH) {
      setError(`Escriba la clave de apertura del día (${OPENING_KEY_LENGTH} dígitos).`)
      return
    }
    if (maxAllowedInitialFloat > 0 && openingFloat > maxAllowedInitialFloat) {
      setError(`La base inicial no puede superar ${formatCOP(maxAllowedInitialFloat)}.`)
      return
    }
    try {
      setSubmitting(true)
      setError(null)
      await onSubmit({ openingFloat: Number(openingFloat) || 0, notes: notes || undefined, openingKey })
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
              step="any"
              value={openingFloat}
              max={maxAllowedInitialFloat > 0 ? maxAllowedInitialFloat : undefined}
              onChange={(e) => {
                setTouched(true)
                setOpeningFloat(Number(e.target.value))
              }}
              required
              autoFocus
              className="font-mono font-bold"
            />
          </div>
          <span className="field-hint">
            Efectivo físico entregado al cajero para dar cambio.
            {maxAllowedInitialFloat > 0 && ` Máximo permitido: ${formatCOP(maxAllowedInitialFloat)}.`}
          </span>
        </div>

        <div className="form-field">
          <label htmlFor={keyId}>
            Clave de apertura del día<em>*</em>
          </label>
          <div className="input-wrap">
            <span className="input-prefix" aria-hidden="true">
              <AppIcon name="key" size={14} />
            </span>
            <input
              id={keyId}
              type="text"
              inputMode="numeric"
              maxLength={OPENING_KEY_LENGTH}
              autoComplete="off"
              spellCheck={false}
              value={openingKey}
              onChange={(e) => setOpeningKey(e.target.value.replace(/\D/g, '').slice(0, OPENING_KEY_LENGTH))}
              required
              aria-describedby={keyHintId}
              className="font-mono font-bold tracking-[0.3em]"
            />
          </div>
          <span id={keyHintId} className="field-hint">
            Clave de {OPENING_KEY_LENGTH} dígitos que entrega el administrador. Cambia cada día.
          </span>
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
