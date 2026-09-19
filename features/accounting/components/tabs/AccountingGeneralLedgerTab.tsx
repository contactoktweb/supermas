'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { GeneralLedgerReport, AccountingAccount } from '../../types'

interface AccountingGeneralLedgerTabProps {
  accounts: AccountingAccount[]
  selectedLedger: GeneralLedgerReport | null
  onSelectAccount: (accountId: string) => void
}

function formatCOP(val: number): string {
  return `$${val.toLocaleString('es-CO')}`
}

function formatDate(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    })
  } catch {
    return isoStr
  }
}

export function AccountingGeneralLedgerTab({
  accounts,
  selectedLedger,
  onSelectAccount,
}: AccountingGeneralLedgerTabProps) {
  const hasMovements = selectedLedger && selectedLedger.movements.length > 0

  return (
    <div className="space-y-4 page-enter">

      {/* Encabezado del Libro Mayor */}
      <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Libro Mayor General</h2>
          <p className="text-xs text-gray-500">
            Mayorización por cuenta PUC — mueve y clasifica cada movimiento del Libro Diario por cuenta.
          </p>
        </div>
        {selectedLedger && (
          <span className="text-xs text-blue-700 font-mono bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
            Período: {selectedLedger.period}
          </span>
        )}
      </div>

      {/* Selector de Cuenta + Resumen de Saldos */}
      <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[260px]">
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Seleccionar Cuenta PUC para Mayorización:
          </label>
          <select
            className="filter-select w-full text-xs font-medium"
            value={selectedLedger?.accountId || ''}
            onChange={(e) => onSelectAccount(e.target.value)}
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.code} — {acc.name} ({formatCOP(acc.balance)})
              </option>
            ))}
          </select>
        </div>

        {selectedLedger && (
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-[11px] block text-slate-500 font-medium mb-0.5">Saldo Inicial</span>
              <strong className="text-sm font-mono text-slate-900">
                {formatCOP(selectedLedger.initialBalance)}
              </strong>
            </div>
            <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
              <span className="text-[11px] block text-emerald-600 font-medium mb-0.5">Total Débitos</span>
              <strong className="text-sm font-mono text-emerald-900">
                {formatCOP(selectedLedger.totalDebit)}
              </strong>
            </div>
            <div className="p-2.5 bg-rose-50 rounded-lg border border-rose-100">
              <span className="text-[11px] block text-rose-600 font-medium mb-0.5">Total Créditos</span>
              <strong className="text-sm font-mono text-rose-900">
                {formatCOP(selectedLedger.totalCredit)}
              </strong>
            </div>
            <div className="p-2.5 bg-blue-900 rounded-lg text-white">
              <span className="text-[11px] block text-blue-200 font-medium mb-0.5">Saldo Final</span>
              <strong className="text-sm font-mono">
                {formatCOP(selectedLedger.finalBalance)}
              </strong>
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
                <th style={{ width: 145 }}>Comprobante</th>
                <th style={{ width: 130 }}>Doc. Origen</th>
                <th>Detalle del Movimiento</th>
                <th style={{ width: 175 }}>Tercero</th>
                <th style={{ width: 125, textAlign: 'right' }}>Débito</th>
                <th style={{ width: 125, textAlign: 'right' }}>Crédito</th>
              </tr>
            </thead>
            <tbody>
              {!selectedLedger ? (
                <tr>
                  <td colSpan={7}>
                    <div className="table-empty-state" style={{ padding: '48px 20px' }}>
                      <div style={{
                        display: 'grid', placeItems: 'center',
                        width: 48, height: 48, borderRadius: 12,
                        background: '#e9eef8', color: 'var(--navy)',
                        margin: '0 auto 12px',
                      }}>
                        <AppIcon name="accounting" size={24} />
                      </div>
                      <strong style={{ fontSize: 14 }}>Selecciona una cuenta PUC</strong>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                        Elige una cuenta en el selector superior para ver su mayorización.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : !hasMovements ? (
                <tr>
                  <td colSpan={7}>
                    <div className="table-empty-state" style={{ padding: '48px 20px' }}>
                      <div style={{
                        display: 'grid', placeItems: 'center',
                        width: 48, height: 48, borderRadius: 12,
                        background: '#fef2f2', color: 'var(--red)',
                        margin: '0 auto 12px',
                      }}>
                        <AppIcon name="fileText" size={24} />
                      </div>
                      <strong style={{ fontSize: 14 }}>
                        Sin movimientos en el período
                      </strong>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                        La cuenta <strong>{selectedLedger.accountCode} — {selectedLedger.accountName}</strong>{' '}
                        no registra movimientos en el período <strong>{selectedLedger.period}</strong>.
                        Selecciona otra cuenta o revisa el filtro de período.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {selectedLedger.movements.map((mov) => (
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
                            {formatCOP(mov.debit)}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {mov.credit > 0 ? (
                          <span className="font-mono text-xs font-semibold text-rose-800">
                            {formatCOP(mov.credit)}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {/* Fila de Totales */}
                  <tr className="bg-gray-50 font-bold border-t">
                    <td colSpan={5} className="py-2 px-3 text-right text-gray-700 uppercase text-[11px]">
                      Totales del Período:
                    </td>
                    <td className="py-2 px-3 font-mono text-right text-emerald-900 text-xs">
                      {formatCOP(selectedLedger.totalDebit)}
                    </td>
                    <td className="py-2 px-3 font-mono text-right text-rose-900 text-xs">
                      {formatCOP(selectedLedger.totalCredit)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumen Final — mismo estilo que Libro Diario */}
      {hasMovements && (
        <div className="p-4 rounded-xl bg-blue-900 text-white flex flex-wrap items-center justify-between gap-4">
          <div>
            <strong className="block text-sm font-semibold">
              Cuenta {selectedLedger!.accountCode} — {selectedLedger!.accountName}
            </strong>
            <span className="text-xs text-blue-200">
              Período {selectedLedger!.period} · {selectedLedger!.movements.length} movimiento(s) registrado(s)
            </span>
          </div>
          <div className="flex items-center gap-6 font-mono text-sm">
            <div>
              <span className="block text-[11px] text-blue-200 uppercase font-sans">Total Débitos:</span>
              <b>{formatCOP(selectedLedger!.totalDebit)}</b>
            </div>
            <div>
              <span className="block text-[11px] text-blue-200 uppercase font-sans">Total Créditos:</span>
              <b>{formatCOP(selectedLedger!.totalCredit)}</b>
            </div>
            <div className="pl-4 border-l border-blue-700">
              <span className="block text-[11px] text-blue-200 uppercase font-sans">Saldo Final:</span>
              <b>{formatCOP(selectedLedger!.finalBalance)}</b>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
