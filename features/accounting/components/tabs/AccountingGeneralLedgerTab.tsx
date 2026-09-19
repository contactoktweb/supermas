'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { GeneralLedgerReport, AccountingAccount } from '../../types'

interface AccountingGeneralLedgerTabProps {
  accounts: AccountingAccount[]
  selectedLedger: GeneralLedgerReport | null
  onSelectAccount: (accountId: string) => void
}

export function AccountingGeneralLedgerTab({
  accounts,
  selectedLedger,
  onSelectAccount,
}: AccountingGeneralLedgerTabProps) {
  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr)
      return d.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      })
    } catch {
      return isoStr
    }
  }

  return (
    <div className="space-y-4 page-enter">
      {/* Selector de Cuenta para el Libro Mayor */}
      <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex-1 min-w-[280px]">
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Seleccionar Cuenta PUC para Mayorización:
          </label>
          <select
            className="filter-select w-full text-xs font-medium"
            value={selectedLedger?.accountId || ''}
            onChange={(e) => onSelectAccount(e.target.value)}
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.code} — {acc.name} (${acc.balance.toLocaleString('es-CO')})
              </option>
            ))}
          </select>
        </div>

        {selectedLedger && (
          <div className="flex items-center gap-4 text-xs">
            <div className="p-2.5 bg-blue-50 rounded-lg text-blue-900">
              <span className="text-[11px] block text-blue-600 font-medium">Saldo Inicial</span>
              <strong className="text-sm font-mono">${selectedLedger.initialBalance.toLocaleString('es-CO')}</strong>
            </div>
            <div className="p-2.5 bg-emerald-50 rounded-lg text-emerald-900">
              <span className="text-[11px] block text-emerald-600 font-medium">Total Débitos</span>
              <strong className="text-sm font-mono">${selectedLedger.totalDebit.toLocaleString('es-CO')}</strong>
            </div>
            <div className="p-2.5 bg-amber-50 rounded-lg text-amber-900">
              <span className="text-[11px] block text-amber-600 font-medium">Total Créditos</span>
              <strong className="text-sm font-mono">${selectedLedger.totalCredit.toLocaleString('es-CO')}</strong>
            </div>
            <div className="p-2.5 bg-blue-900 rounded-lg text-white">
              <span className="text-[11px] block text-blue-200 font-medium">Saldo Final Actual</span>
              <strong className="text-sm font-mono">${selectedLedger.finalBalance.toLocaleString('es-CO')}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Tabla del Libro Mayor */}
      <div className="table-panel animated-table">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: 110 }}>Fecha</th>
                <th style={{ width: 140 }}>Comprobante</th>
                <th style={{ width: 130 }}>Doc. Origen</th>
                <th>Detalle del Movimiento</th>
                <th style={{ width: 170 }}>Tercero</th>
                <th style={{ width: 120, textAlign: 'right' }}>Débito</th>
                <th style={{ width: 120, textAlign: 'right' }}>Crédito</th>
              </tr>
            </thead>
            <tbody>
              {!selectedLedger || selectedLedger.movements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    No se registran movimientos en el periodo para la cuenta seleccionada.
                  </td>
                </tr>
              ) : (
                selectedLedger.movements.map((mov) => (
                  <tr key={mov.id} className="hover:bg-blue-50/40 transition-colors">
                    <td>
                      <span className="text-xs text-gray-600">{formatDate(mov.date)}</span>
                    </td>
                    <td>
                      <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded">
                        {mov.entryNumber}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono text-xs text-gray-700">
                        {mov.sourceDocumentNumber || '—'}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-gray-900">{mov.description}</span>
                    </td>
                    <td>
                      <span className="text-xs text-gray-700">{mov.thirdPartyName || '—'}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {mov.debit > 0 ? (
                        <span className="font-mono text-xs font-semibold text-emerald-800">
                          ${mov.debit.toLocaleString('es-CO')}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {mov.credit > 0 ? (
                        <span className="font-mono text-xs font-semibold text-rose-800">
                          ${mov.credit.toLocaleString('es-CO')}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
