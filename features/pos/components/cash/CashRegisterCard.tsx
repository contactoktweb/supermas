'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import type { CashRegister, CashRegisterStatus, CashSession } from '../../types'
import { REDUCED_MOTION_CLASS, formatCOP, formatTime } from './cashUi'

const STATUS_BADGE: Record<CashRegisterStatus, { label: string; className: string }> = {
  OPEN: { label: 'Turno abierto', className: 'state disponible' },
  CLOSED: { label: 'Cerrada', className: 'state publicado' },
  MAINTENANCE: { label: 'Mantenimiento', className: 'state pendiente' },
}

interface CashRegisterCardProps {
  register: CashRegister
  activeSession?: CashSession
  index: number
  onOpenSession: (register: CashRegister) => void
  onRecordMovement: (session: CashSession) => void
  onCloseSession: (session: CashSession) => void
}

export function CashRegisterCard({
  register,
  activeSession,
  index,
  onOpenSession,
  onRecordMovement,
  onCloseSession,
}: CashRegisterCardProps) {
  const status = STATUS_BADGE[register.currentStatus] ?? STATUS_BADGE.CLOSED
  const isOpen = register.currentStatus === 'OPEN'

  return (
    <article
      className={`page-enter w-full flex flex-col justify-between bg-white rounded-xl border shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        isOpen ? 'border-emerald-200 hover:border-emerald-300' : 'border-gray-200 hover:border-blue-300'
      } ${REDUCED_MOTION_CLASS}`}
      style={{ animationDelay: `${Math.min(index, 8) * 0.04}s` }}
    >
      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center ${
                isOpen ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-900'
              }`}
              aria-hidden="true"
            >
              <AppIcon name="cashRegisters" size={18} />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-gray-900 truncate">{register.name}</h3>
              <span className="block text-[11px] text-gray-500 font-mono">{register.code}</span>
            </div>
          </div>
          <span className={status.className}>
            {isOpen && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse motion-reduce:animate-none"
                aria-hidden="true"
              />
            )}
            <span>{status.label}</span>
          </span>
        </div>

        <p className="flex items-center gap-1.5 text-xs text-gray-500">
          <AppIcon name="warehouse" size={13} />
          <span>{register.locationName || 'Sede sin nombre'}</span>
        </p>

        {isOpen && activeSession && (
          <dl className="text-xs bg-emerald-50/60 border border-emerald-100 rounded-lg p-3 space-y-1.5">
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Cajero a cargo</dt>
              <dd className="font-bold text-gray-900 text-right">{activeSession.cashierName || '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Base inicial</dt>
              <dd className="font-mono font-bold text-emerald-800">{formatCOP(activeSession.openingFloat)}</dd>
            </div>
            <div className="flex justify-between gap-3 text-[11px]">
              <dt className="text-gray-500">Apertura</dt>
              <dd className="text-gray-600">{formatTime(activeSession.openingTime)}</dd>
            </div>
          </dl>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-xl">
        {isOpen && activeSession ? (
          <>
            <button
              type="button"
              className={`outline-button compact flex-1 ${REDUCED_MOTION_CLASS}`}
              onClick={() => onRecordMovement(activeSession)}
            >
              <AppIcon name="arrowLeftRight" size={14} />
              <span>Movimiento</span>
            </button>
            <button
              type="button"
              className={`primary-button compact flex-1 ${REDUCED_MOTION_CLASS}`}
              onClick={() => onCloseSession(activeSession)}
            >
              <AppIcon name="check" size={14} />
              <span>Arqueo y cierre</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            className={`primary-button compact w-full ${REDUCED_MOTION_CLASS}`}
            onClick={() => onOpenSession(register)}
          >
            <AppIcon name="lock" size={14} />
            <span>Abrir turno de caja</span>
          </button>
        )}
      </div>
    </article>
  )
}
