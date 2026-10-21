'use client'

import React, { useId, useState } from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import type { CashSession } from '../../types'
import { CashFormError, CashModal } from './CashModal'
import { REDUCED_MOTION_CLASS, getErrorMessage } from './cashUi'

export type CashMovementType = 'CASH_IN' | 'CASH_OUT'

export interface CashMovementValues {
  type: CashMovementType
  amount: number
  reason: string
}

const MOVEMENT_OPTIONS: {
  type: CashMovementType
  label: string
  icon: LightIconName
  selectedClass: string
}[] = [
  {
    type: 'CASH_IN',
    label: 'Entrada (inyección)',
    icon: 'arrowDownLeft',
    selectedClass: 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-100',
  },
  {
    type: 'CASH_OUT',
    label: 'Salida (retiro)',
    icon: 'arrowUpRight',
    selectedClass: 'border-red-500 bg-red-50 text-red-800 ring-2 ring-red-100',
  },
]

interface CashMovementModalProps {
  session: CashSession
  onClose: () => void
  onSubmit: (values: CashMovementValues) => Promise<void>
}

export function CashMovementModal({ session, onClose, onSubmit }: CashMovementModalProps) {
  const [type, setType] = useState<CashMovementType>('CASH_OUT')
  const [amount, setAmount] = useState<number>(0)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const amountId = useId()
  const reasonId = useId()
  const typeLabelId = useId()

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (amount <= 0) {
      setError('El monto debe ser estrictamente mayor a 0.')
      return
    }
    if (!reason.trim()) {
      setError('Debe ingresar un motivo.')
      return
    }
    try {
      setSubmitting(true)
      setError(null)
      await onSubmit({ type, amount: Number(amount), reason: reason.trim() })
    } catch (err) {
      setError(getErrorMessage(err, 'No fue posible registrar el movimiento.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CashModal
      title="Movimiento de caja"
      subtitle={`Caja: ${session.cashRegisterName || 'Caja'}`}
      icon="arrowLeftRight"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="modal-form">
        <CashFormError message={error} />

        <div className="form-field">
          <span id={typeLabelId} className="text-xs font-bold text-slate-700">
            Tipo de movimiento
          </span>
          <div role="radiogroup" aria-labelledby={typeLabelId} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {MOVEMENT_OPTIONS.map((option) => {
              const selected = type === option.type
              return (
                <button
                  key={option.type}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setType(option.type)}
                  className={`min-h-11 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--navy)] ${
                    selected ? option.selectedClass : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <AppIcon name={option.icon} size={14} />
                  <span>{option.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="form-field">
          <label htmlFor={amountId}>
            Monto en efectivo (COP)<em>*</em>
          </label>
          <div className="input-wrap">
            <span className="input-prefix">$</span>
            <input
              id={amountId}
              type="number"
              min="1"
              step="100"
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="0"
              required
              autoFocus
              className="font-mono font-bold"
            />
          </div>
        </div>

        <div className="form-field">
          <label htmlFor={reasonId}>
            Motivo / justificación<em>*</em>
          </label>
          <input
            id={reasonId}
            type="text"
            className="custom-form-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: Pago de flete urgente, traslado a bóveda..."
            required
          />
        </div>

        <div className="modal-footer">
          <button type="button" className={`outline-button compact ${REDUCED_MOTION_CLASS}`} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" disabled={submitting} className={`primary-button compact disabled:opacity-50 ${REDUCED_MOTION_CLASS}`}>
            <AppIcon name="save" size={14} />
            <span>{submitting ? 'Registrando...' : 'Registrar movimiento'}</span>
          </button>
        </div>
      </form>
    </CashModal>
  )
}
