'use client'

import React, { useId, useState } from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import type { CashSession, CashSessionSummary } from '../../types'
import { CashFormError, CashModal } from './CashModal'
import {
  CashDifferenceKind,
  REDUCED_MOTION_CLASS,
  formatCOP,
  formatSignedCOP,
  getDifferenceKind,
  getErrorMessage,
} from './cashUi'

export interface CloseCashSessionValues {
  countedCashAmount: number
  supervisorNotes?: string
}

const DIFFERENCE_DISPLAY: Record<CashDifferenceKind, { label: string; icon: LightIconName; className: string }> = {
  BALANCED: { label: 'Caja cuadrada exacta', icon: 'check', className: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  SURPLUS: { label: 'Sobrante de caja', icon: 'arrowUpRight', className: 'bg-blue-50 border-blue-200 text-blue-800' },
  SHORTAGE: { label: 'Faltante de caja', icon: 'warning', className: 'bg-red-50 border-red-200 text-red-800' },
}

interface SummaryRowProps {
  label: string
  value: number
  valueClassName?: string
}

function SummaryRow({ label, value, valueClassName = 'text-gray-800' }: SummaryRowProps) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-gray-600">{label}</dt>
      <dd className={`font-mono font-medium text-right ${valueClassName}`}>{formatCOP(value)}</dd>
    </div>
  )
}

interface CloseCashSessionFormProps {
  summary: CashSessionSummary
  onClose: () => void
  onSubmit: (values: CloseCashSessionValues) => Promise<void>
}

function CloseCashSessionForm({ summary, onClose, onSubmit }: CloseCashSessionFormProps) {
  const [countedCash, setCountedCash] = useState<number>(summary.expectedCashAmount)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const countedId = useId()
  const notesId = useId()

  const difference = countedCash - summary.expectedCashAmount
  const differenceDisplay = DIFFERENCE_DISPLAY[getDifferenceKind(difference)]

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      setSubmitting(true)
      setError(null)
      await onSubmit({ countedCashAmount: Number(countedCash), supervisorNotes: notes || undefined })
    } catch (err) {
      setError(getErrorMessage(err, 'No fue posible cerrar la caja.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="modal-form text-xs">
      <CashFormError message={error} />

      <section className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2" aria-labelledby={`${countedId}-flow`}>
        <h4 id={`${countedId}-flow`} className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--navy)]">
          Flujo de efectivo en turno
        </h4>
        <dl className="space-y-1.5">
          <SummaryRow label="Base inicial (+)" value={summary.openingFloat} />
          <SummaryRow label="Ventas en efectivo (+)" value={summary.salesCash} valueClassName="text-emerald-700" />
          <SummaryRow label="Entradas manuales (+)" value={summary.cashIn} />
          <SummaryRow label="Salidas / retiros manuales (-)" value={summary.cashOut} valueClassName="text-red-700" />
          <div className="flex justify-between gap-3 pt-2 border-t border-slate-200 text-sm font-extrabold text-gray-900">
            <dt>Efectivo esperado en gaveta</dt>
            <dd className="font-mono text-emerald-800">{formatCOP(summary.expectedCashAmount)}</dd>
          </div>
        </dl>
      </section>

      <section className="p-3 rounded-xl bg-white border border-slate-200 space-y-1.5 text-[11px]" aria-labelledby={`${countedId}-other`}>
        <h4 id={`${countedId}-other`} className="font-bold text-gray-700">
          Otros medios de pago (ventas electrónicas)
        </h4>
        <dl className="space-y-1">
          <SummaryRow label="Tarjetas débito/crédito" value={summary.salesCard} valueClassName="text-gray-500" />
          <SummaryRow label="Transferencias bancarias" value={summary.salesTransfer} valueClassName="text-gray-500" />
          <SummaryRow label="Ventas a crédito" value={summary.salesCredit} valueClassName="text-gray-500" />
          <div className="flex justify-between gap-3 pt-1 border-t border-slate-100 font-bold text-gray-800">
            <dt>Total ventas del turno ({summary.transactionsCount} transacciones)</dt>
            <dd className="font-mono">{formatCOP(summary.totalSales)}</dd>
          </div>
        </dl>
      </section>

      <div className="form-field">
        <label htmlFor={countedId}>
          Efectivo físico contado en gaveta (COP)<em>*</em>
        </label>
        <div className="input-wrap">
          <span className="input-prefix">$</span>
          <input
            id={countedId}
            type="number"
            min="0"
            step="any"
            value={countedCash}
            onChange={(e) => setCountedCash(Number(e.target.value))}
            required
            autoFocus
            className="font-mono font-bold"
          />
        </div>
      </div>

      <div
        className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 font-bold transition-colors ${differenceDisplay.className}`}
        aria-live="polite"
      >
        <span className="flex items-center gap-2">
          <AppIcon name={differenceDisplay.icon} size={18} />
          <span>{differenceDisplay.label}</span>
        </span>
        <span className="font-mono text-sm font-black">{formatSignedCOP(difference)}</span>
      </div>

      <div className="form-field">
        <label htmlFor={notesId}>Observaciones de cierre / supervisor (opcional)</label>
        <textarea
          id={notesId}
          className="custom-form-textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Indicar motivo de diferencias si aplica, novedades del turno..."
          rows={2}
        />
      </div>

      <div className="modal-footer">
        <button type="button" className={`outline-button compact ${REDUCED_MOTION_CLASS}`} onClick={onClose}>
          Volver
        </button>
        <button type="submit" disabled={submitting} className={`primary-button compact disabled:opacity-50 ${REDUCED_MOTION_CLASS}`}>
          <AppIcon name="lock" size={14} />
          <span>{submitting ? 'Cerrando turno...' : 'Confirmar cierre y arqueo'}</span>
        </button>
      </div>
    </form>
  )
}

interface CloseCashSessionModalProps {
  session: CashSession
  summary: CashSessionSummary | null
  onClose: () => void
  onSubmit: (values: CloseCashSessionValues) => Promise<void>
}

export function CloseCashSessionModal({ session, summary, onClose, onSubmit }: CloseCashSessionModalProps) {
  const subtitle = summary
    ? `${summary.cashRegisterName} (${summary.cashRegisterCode}) — Cajero: ${summary.cashierName}`
    : session.cashRegisterName || 'Caja'

  return (
    <CashModal title="Arqueo y cierre de caja" subtitle={subtitle} icon="fileText" tone="red" size="lg" onClose={onClose}>
      {summary ? (
        <CloseCashSessionForm key={summary.sessionId} summary={summary} onClose={onClose} onSubmit={onSubmit} />
      ) : (
        <div className="py-12 flex flex-col items-center gap-2 text-xs text-gray-500" aria-busy="true" aria-live="polite">
          <AppIcon name="refresh" size={20} className="animate-spin motion-reduce:animate-none" />
          <span>Consolidando ventas y movimientos...</span>
        </div>
      )}
    </CashModal>
  )
}
