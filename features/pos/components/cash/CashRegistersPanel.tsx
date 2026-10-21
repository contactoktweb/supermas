'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import type { CashRegister, CashSession } from '../../types'
import { CashRegisterCard } from './CashRegisterCard'
import { REDUCED_MOTION_CLASS } from './cashUi'

const SKELETON_CARDS = 3

interface CashRegistersPanelProps {
  loading: boolean
  registers: CashRegister[]
  sessions: CashSession[]
  onCreateRegister: () => void
  onOpenSession: (register: CashRegister) => void
  onRecordMovement: (session: CashSession) => void
  onCloseSession: (session: CashSession) => void
}

export function CashRegistersPanel({
  loading,
  registers,
  sessions,
  onCreateRegister,
  onOpenSession,
  onRecordMovement,
  onCloseSession,
}: CashRegistersPanelProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" aria-busy="true" aria-live="polite">
        <span className="sr-only">Cargando cajas registradoras...</span>
        {Array.from({ length: SKELETON_CARDS }, (_, i) => (
          <div
            key={i}
            className="h-52 rounded-xl border border-gray-200 bg-white p-5 space-y-3 animate-pulse motion-reduce:animate-none"
            aria-hidden="true"
          >
            <div className="h-9 w-2/3 rounded-lg bg-gray-100" />
            <div className="h-3 w-1/2 rounded bg-gray-100" />
            <div className="h-16 rounded-lg bg-gray-50" />
          </div>
        ))}
      </div>
    )
  }

  if (registers.length === 0) {
    return (
      <div className="flex flex-col items-center text-center gap-2 py-12 px-6 bg-white rounded-xl border border-dashed border-gray-300">
        <span className="w-12 h-12 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center" aria-hidden="true">
          <AppIcon name="cashRegisters" size={24} />
        </span>
        <h3 className="text-sm font-bold text-gray-900">No hay cajas registradoras para esta sede</h3>
        <p className="text-xs text-gray-500 max-w-sm">
          Crea una caja para comenzar a operar turnos y ventas POS.
        </p>
        <button type="button" className={`primary-button compact mt-2 ${REDUCED_MOTION_CLASS}`} onClick={onCreateRegister}>
          <AppIcon name="plus" size={14} />
          <span>Crear primera caja</span>
        </button>
      </div>
    )
  }

  return (
    <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" aria-label="Cajas registradoras">
      {registers.map((register, index) => (
        <li key={register.id} className="flex">
          <CashRegisterCard
            register={register}
            activeSession={sessions.find((s) => s.cashRegisterId === register.id && s.status === 'OPEN')}
            index={index}
            onOpenSession={onOpenSession}
            onRecordMovement={onRecordMovement}
            onCloseSession={onCloseSession}
          />
        </li>
      ))}
    </ul>
  )
}
