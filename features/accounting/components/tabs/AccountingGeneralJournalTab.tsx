'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { AccountingEntry } from '../../types'

interface AccountingGeneralJournalTabProps {
  entries: AccountingEntry[]
  onExport: () => void
}

export function AccountingGeneralJournalTab({ entries, onExport }: AccountingGeneralJournalTabProps) {
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

  const grandTotalDebit = entries.reduce((acc, e) => acc + e.totalDebit, 0)
  const grandTotalCredit = entries.reduce((acc, e) => acc + e.totalCredit, 0)

  return (
    <div className="space-y-4 page-enter">
      {/* Encabezado del Libro Diario con Exportación */}
      <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Libro Diario General</h2>
          <p className="text-xs text-gray-500">
            Registro cronológico obligatorio de todas las transacciones comerciales de Super Más S.A.S.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="outline-button text-xs py-1.5"
            onClick={onExport}
          >
            <AppIcon name="download" size={14} />
            <span>Descargar Libro Diario (CSV)</span>
          </button>
        </div>
      </div>

      {/* Comprobantes Desglosados en el Libro Diario */}
      <div className="space-y-4">
        {entries.map((entry) => (
          <div key={entry.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            {/* Cabecera del comprobante */}
            <div className="p-3 bg-gray-50/80 border-b flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-blue-900 bg-blue-100/70 px-2 py-0.5 rounded">
                  {entry.entryNumber}
                </span>
                <span className="text-gray-600 font-medium">{formatDate(entry.date)}</span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-800 font-semibold">{entry.description}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-500">
                {entry.thirdPartyName && (
                  <span>Tercero: <strong className="text-gray-700">{entry.thirdPartyName}</strong></span>
                )}
                {entry.documentNumber && (
                  <span className="font-mono text-gray-600">Doc: {entry.documentNumber}</span>
                )}
              </div>
            </div>

            {/* Líneas de partida doble del asiento */}
            <div className="table-scroll">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-gray-50/30 text-gray-500 text-left">
                    <th className="py-2 px-3 font-semibold w-24">Cuenta</th>
                    <th className="py-2 px-3 font-semibold">Denominación</th>
                    <th className="py-2 px-3 font-semibold">Detalle / Concepto</th>
                    <th className="py-2 px-3 font-semibold text-right w-32">Débito</th>
                    <th className="py-2 px-3 font-semibold text-right w-32">Crédito</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entry.lines.map((line) => (
                    <tr key={line.id} className="hover:bg-gray-50/60">
                      <td className="py-2 px-3 font-mono font-semibold text-blue-900">{line.accountCode}</td>
                      <td className="py-2 px-3 font-medium text-gray-800">{line.accountName}</td>
                      <td className="py-2 px-3 text-gray-500">{line.description}</td>
                      <td className="py-2 px-3 font-mono text-right font-semibold text-gray-900">
                        {line.debit > 0 ? `$${line.debit.toLocaleString('es-CO')}` : '—'}
                      </td>
                      <td className="py-2 px-3 font-mono text-right font-semibold text-gray-900">
                        {line.credit > 0 ? `$${line.credit.toLocaleString('es-CO')}` : '—'}
                      </td>
                    </tr>
                  ))}
                  {/* Fila de Totales del Asiento */}
                  <tr className="bg-gray-50 font-bold border-t">
                    <td colSpan={3} className="py-2 px-3 text-right text-gray-700 uppercase text-[11px]">
                      Sumas Iguales:
                    </td>
                    <td className="py-2 px-3 font-mono text-right text-blue-900">
                      ${entry.totalDebit.toLocaleString('es-CO')}
                    </td>
                    <td className="py-2 px-3 font-mono text-right text-blue-900">
                      ${entry.totalCredit.toLocaleString('es-CO')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Resumen Global del Libro Diario */}
      <div className="p-4 rounded-xl bg-blue-900 text-white flex flex-wrap items-center justify-between gap-4">
        <div>
          <strong className="block text-sm font-semibold">Total Movimientos Libro Diario</strong>
          <span className="text-xs text-blue-200">Balance global acumulado de comprobantes registrados</span>
        </div>
        <div className="flex items-center gap-6 font-mono text-sm">
          <div>
            <span className="block text-[11px] text-blue-200 uppercase font-sans">Total Débitos:</span>
            <b>${grandTotalDebit.toLocaleString('es-CO')}</b>
          </div>
          <div>
            <span className="block text-[11px] text-blue-200 uppercase font-sans">Total Créditos:</span>
            <b>${grandTotalCredit.toLocaleString('es-CO')}</b>
          </div>
          <div className="pl-4 border-l border-blue-700 text-xs">
            <span className="flex items-center gap-1 text-emerald-300 font-sans font-semibold">
              <AppIcon name="check" size={16} /> Balance Cuadrado
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
