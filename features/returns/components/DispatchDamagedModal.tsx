'use client'

import React, { useEffect, useRef, useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { ModalPortal } from '@/components/ui/ModalPortal'
import { DamagedReturnItem } from '../types'
import { DAMAGED_DESTINATION_LABELS } from '../constants'

interface DispatchDamagedModalProps {
  item: DamagedReturnItem
  submitting: boolean
  error: string | null
  onCancel: () => void
  onConfirm: (values: { dispatchReference: string; notes: string }) => void
}

/** Confirmación de envío de mercancía en mal estado a producción o al proveedor. */
export function DispatchDamagedModal({ item, submitting, error, onCancel, onConfirm }: DispatchDamagedModalProps) {
  const [dispatchReference, setDispatchReference] = useState('')
  const [notes, setNotes] = useState('')
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const titleId = `dispatch-title-${item.id}`

  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onCancel, submitting])

  const destinationText =
    item.destination === 'PROVEEDOR'
      ? `al proveedor ${item.supplierName || ''}`.trim()
      : `a producción${item.productionLocationName ? ` (${item.productionLocationName})` : ''}`

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-2xl motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95"
        >
          <div className="flex items-start justify-between gap-3 border-b pb-3">
            <div className="flex items-center gap-2">
              <AppIcon name={item.destination === 'PROVEEDOR' ? 'suppliers' : 'warehouse'} size={20} className="text-blue-700" />
              <h3 id={titleId} className="text-base font-bold text-slate-900">
                Marcar como enviado a {DAMAGED_DESTINATION_LABELS[item.destination].toLowerCase()}
              </h3>
            </div>
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 motion-reduce:transition-none"
              aria-label="Cerrar"
            >
              <AppIcon name="closeSimple" size={18} />
            </button>
          </div>

          <form
            className="mt-4 space-y-4 text-sm"
            onSubmit={(e) => {
              e.preventDefault()
              onConfirm({ dispatchReference, notes })
            }}
          >
            <p className="text-slate-700">
              {item.quantity} und de <strong>{item.productName}</strong> (devolución {item.returnCode}) se registran como
              enviadas {destinationText}. Queda la fecha, el usuario y el movimiento informativo en Kardex.
            </p>
            {item.destination === 'PROVEEDOR' && (
              <p className="rounded-lg border border-blue-100 bg-blue-50 p-2.5 text-xs text-blue-800">
                Si la devolución tuvo comprobante DV, se genera el comprobante DC de devolución en compra contra la cuenta
                por pagar del proveedor.
              </p>
            )}

            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                <AppIcon name="warning" size={16} />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor={`${titleId}-ref`} className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Referencia del envío (opcional)
              </label>
              <input
                ref={firstFieldRef}
                id={`${titleId}-ref`}
                type="text"
                maxLength={100}
                value={dispatchReference}
                onChange={(e) => setDispatchReference(e.target.value)}
                placeholder="Guía, acta o remisión"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <div>
              <label htmlFor={`${titleId}-notes`} className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Observaciones (opcional)
              </label>
              <textarea
                id={`${titleId}-notes`}
                rows={2}
                maxLength={500}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Quién recibe, transportador o condiciones"
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <div className="flex flex-col-reverse gap-2 border-t pt-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="h-10 rounded-lg bg-slate-100 px-4 font-medium text-slate-700 transition-colors hover:bg-slate-200 active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 font-medium text-white transition-colors hover:bg-blue-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                <AppIcon name={submitting ? 'refresh' : 'check'} size={16} className={submitting ? 'motion-safe:animate-spin' : ''} />
                {submitting ? 'Registrando...' : 'Confirmar envío'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  )
}
