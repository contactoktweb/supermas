'use client'

import React from 'react'
import type { CashSession } from '../../types'
import { formatCOP, formatDateTime, formatSignedCOP, getDifferenceKind } from './cashUi'

const DIFFERENCE_TEXT_CLASS = {
  BALANCED: 'text-emerald-700',
  SURPLUS: 'text-blue-700',
  SHORTAGE: 'text-red-700',
} as const

const COLUMN_COUNT = 9

interface CashSessionsHistoryTableProps {
  loading: boolean
  sessions: CashSession[]
}

export function CashSessionsHistoryTable({ loading, sessions }: CashSessionsHistoryTableProps) {
  return (
    <div className="table-panel animated-table">
      <div className="table-scroll">
        <table>
          <caption className="sr-only">Histórico de turnos de caja y resultados de arqueo</caption>
          <thead>
            <tr>
              <th scope="col">Caja / Sede</th>
              <th scope="col">Cajero</th>
              <th scope="col">Apertura</th>
              <th scope="col">Cierre</th>
              <th scope="col" style={{ textAlign: 'right' }}>Base</th>
              <th scope="col" style={{ textAlign: 'right' }}>Esperado</th>
              <th scope="col" style={{ textAlign: 'right' }}>Contado</th>
              <th scope="col" style={{ textAlign: 'right' }}>Diferencia</th>
              <th scope="col" style={{ textAlign: 'center' }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={COLUMN_COUNT} className="text-center py-8 text-gray-500" aria-busy="true">
                  Cargando historial de arqueos...
                </td>
              </tr>
            ) : sessions.length === 0 ? (
              <tr>
                <td colSpan={COLUMN_COUNT} className="text-center py-8 text-gray-500">
                  No se han registrado turnos de caja para esta sede.
                </td>
              </tr>
            ) : (
              sessions.map((session) => {
                const difference = session.differenceAmount ?? 0
                const differenceKind = getDifferenceKind(difference)
                const isClosed = session.status === 'CLOSED'

                return (
                  <tr key={session.id}>
                    <td>
                      <div className="flex flex-col">
                        <span className="font-bold text-xs text-gray-900">{session.cashRegisterName || 'Caja'}</span>
                        <span className="text-[11px] text-gray-500">{session.locationName}</span>
                      </div>
                    </td>
                    <td>
                      <span className="text-xs text-gray-700">{session.cashierName || '—'}</span>
                    </td>
                    <td>
                      <span className="text-xs text-gray-600">{formatDateTime(session.openingTime)}</span>
                    </td>
                    <td>
                      <span className="text-xs text-gray-600">{formatDateTime(session.closingTime)}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="font-mono text-xs text-gray-700">{formatCOP(session.openingFloat)}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="font-mono text-xs text-gray-700">{formatCOP(session.expectedCashAmount)}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="font-mono text-xs font-bold text-gray-900">
                        {session.countedCashAmount != null ? formatCOP(session.countedCashAmount) : '—'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {isClosed ? (
                        <span className={`font-mono text-xs font-bold ${DIFFERENCE_TEXT_CLASS[differenceKind]}`}>
                          {formatSignedCOP(difference)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={isClosed ? 'state publicado' : 'state disponible'}>
                        {isClosed ? 'Cerrada' : 'Abierta'}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
