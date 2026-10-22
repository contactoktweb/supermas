'use client'

import React, { useId, useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CashFormError, CashModal } from './CashModal'
import { CashLocationOption, REDUCED_MOTION_CLASS, getErrorMessage } from './cashUi'
import { SelectField } from '@/components/ui/SelectField'

export interface NewCashRegisterValues {
  locationId: string
  code: string
  name: string
}

interface NewCashRegisterModalProps {
  locations: CashLocationOption[]
  defaultLocationId: string
  onClose: () => void
  onSubmit: (values: NewCashRegisterValues) => Promise<void>
}

export function NewCashRegisterModal({ locations, defaultLocationId, onClose, onSubmit }: NewCashRegisterModalProps) {
  const [locationId, setLocationId] = useState(defaultLocationId)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const locationFieldId = useId()
  const codeId = useId()
  const nameId = useId()

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!code.trim() || !name.trim() || !locationId) {
      setError('Todos los campos son requeridos.')
      return
    }
    try {
      setSubmitting(true)
      setError(null)
      await onSubmit({ locationId, code: code.trim(), name: name.trim() })
    } catch (err) {
      setError(getErrorMessage(err, 'No fue posible crear la caja.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CashModal
      title="Nueva caja registradora"
      subtitle="Registra un punto de cobro asociado a una sede."
      icon="cashRegisters"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="modal-form">
        <CashFormError message={error} />

        <div className="form-field">
          <label htmlFor={locationFieldId}>
            Bodega / sede<em>*</em>
          </label>
          <SelectField
            id={locationFieldId}
            value={locationId}
            size="md"
            onChange={(value) => setLocationId(value)}
          >
            {locations.length === 0 && <option value="">No hay sedes disponibles</option>}
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="form-field">
          <label htmlFor={codeId}>
            Código de caja<em>*</em>
          </label>
          <input
            id={codeId}
            type="text"
            className="custom-form-input font-mono uppercase"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Ej: CAJA-01, POS-PRINCIPAL"
            required
            autoFocus
          />
        </div>

        <div className="form-field">
          <label htmlFor={nameId}>
            Nombre descriptivo<em>*</em>
          </label>
          <input
            id={nameId}
            type="text"
            className="custom-form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Caja rápida mostrador 1"
            required
          />
        </div>

        <div className="modal-footer">
          <button type="button" className={`outline-button compact ${REDUCED_MOTION_CLASS}`} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" disabled={submitting} className={`primary-button compact disabled:opacity-50 ${REDUCED_MOTION_CLASS}`}>
            <AppIcon name="plus" size={14} />
            <span>{submitting ? 'Guardando...' : 'Crear caja'}</span>
          </button>
        </div>
      </form>
    </CashModal>
  )
}
