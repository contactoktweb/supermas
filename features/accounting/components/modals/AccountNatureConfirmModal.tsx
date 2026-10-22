'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { AccountNature } from '../../types'

export interface PendingNatureChange {
  accountId: string
  accountCode: string
  accountName: string
  currentNature: AccountNature
  requestedNature: AccountNature
  movementLines: number
}

interface AccountNatureConfirmModalProps {
  pending: PendingNatureChange | null
  onCancel: () => void
  onConfirm: () => Promise<void>
}

const NATURE_LABEL: Record<AccountNature, string> = { DEBIT: 'Débito', CREDIT: 'Crédito' }

/** Confirma el cambio de naturaleza de una cuenta que ya tiene líneas contables. */
export function AccountNatureConfirmModal({ pending, onCancel, onConfirm }: AccountNatureConfirmModalProps) {
  const [isSaving, setIsSaving] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!pending) return
    setIsSaving(false)
    cancelRef.current?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [pending, onCancel])

  if (!pending || typeof document === 'undefined') return null

  const handleConfirm = async () => {
    setIsSaving(true)
    try {
      await onConfirm()
    } finally {
      setIsSaving(false)
    }
  }

  return createPortal(
    <div
      className="drawer-backdrop modal-center p-3 z-50"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="nature-confirm-title"
      aria-describedby="nature-confirm-description"
      onClick={onCancel}
    >
      <div
        className="modal-card modal-card-flush animate-scale-up w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-amber-100 text-amber-800">
              <AppIcon name="warning" size={20} />
            </span>
            <div className="min-w-0">
              <h2 id="nature-confirm-title" className="text-sm font-bold text-slate-900 m-0">
                Cambiar la naturaleza de {pending.accountCode}
              </h2>
              <p className="text-xs text-slate-500 m-0 truncate">{pending.accountName}</p>
            </div>
          </div>
          <div id="nature-confirm-description" className="text-xs text-slate-700 space-y-2">
            <p className="m-0">
              La cuenta tiene <strong>{pending.movementLines}</strong> líneas contables registradas. Pasar de{' '}
              <strong>{NATURE_LABEL[pending.currentNature]}</strong> a <strong>{NATURE_LABEL[pending.requestedNature]}</strong>{' '}
              no modifica los importes, pero invierte el signo con que se presenta su saldo en libros, balance de
              comprobación y estados financieros.
            </p>
            <p className="m-0">El cambio queda registrado en la auditoría.</p>
          </div>
        </div>
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap justify-end gap-2">
          <button ref={cancelRef} type="button" className="outline-button compact text-xs" onClick={onCancel} disabled={isSaving}>
            Cancelar
          </button>
          <button
            type="button"
            className="primary-button compact text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-transform"
            style={{ background: 'var(--navy, #001B5C)' }}
            onClick={handleConfirm}
            disabled={isSaving}
          >
            <AppIcon name="check" size={13} />
            <span>{isSaving ? 'Guardando...' : `Cambiar a ${NATURE_LABEL[pending.requestedNature]}`}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
