'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { AccountingEntry } from '../../types'

interface AccountingEntryDetailDrawerProps {
  entry: AccountingEntry | null
  isOpen: boolean
  onClose: () => void
  onReverse: (entryId: string, reason: string) => Promise<void>
  canCancelEntry: boolean
}

export function AccountingEntryDetailDrawer({
  entry,
  isOpen,
  onClose,
  onReverse,
  canCancelEntry,
}: AccountingEntryDetailDrawerProps) {
  const [mounted, setMounted] = useState(false)
  const [isReversing, setIsReversing] = useState(false)
  const [reversalReason, setReversalReason] = useState('')
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (isConfirmOpen) {
          setIsConfirmOpen(false)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isConfirmOpen, onClose])

  if (!isOpen || !entry || !mounted) return null

  const handleConfirmReversal = async () => {
    if (!reversalReason.trim()) return
    setIsReversing(true)
    try {
      await onReverse(entry.id, reversalReason)
      setIsConfirmOpen(false)
      onClose()
    } finally {
      setIsReversing(false)
    }
  }

  const formatDate = (isoStr: string) => {
    try {
      return new Date(isoStr).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return isoStr
    }
  }

  return createPortal(
    <div className="drawer-backdrop" onClick={onClose} aria-modal="true" role="dialog">
      <div
        className="product-drawer page-enter"
        style={{
          width: 'min(100%, 720px)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          maxHeight: '100vh',
          background: '#ffffff',
          padding: '24px 28px',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Drawer */}
        <div className="drawer-header border-b pb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center font-bold">
              <AppIcon name="receipt" size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900">{entry.entryNumber}</h2>
                <span
                  className={`badge text-xs font-semibold ${
                    entry.status === 'POSTED'
                      ? 'badge-teal'
                      : entry.status === 'REVERSED'
                      ? 'badge-red'
                      : 'badge-amber'
                  }`}
                >
                  {entry.status === 'POSTED'
                    ? 'Confirmado'
                    : entry.status === 'REVERSED'
                    ? 'Reversado / Anulado'
                    : 'Borrador'}
                </span>
              </div>
              <p className="text-xs text-gray-500">{entry.description}</p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar detalle">
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Banner de Reversión si ya fue anulado */}
        {entry.status === 'REVERSED' && (
          <div className="p-3 my-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2">
            <AppIcon name="warning" size={18} />
            <div>
              <strong>Comprobante Reversado:</strong> {entry.reversalReason || 'Reversión contable oficial.'}
            </div>
          </div>
        )}

        <div className="drawer-body space-y-5 py-4 text-xs">
          {/* Ficha de Metadatos */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div>
              <span className="text-gray-400 block text-[11px]">Fecha Contable</span>
              <strong className="text-gray-800 font-medium">{formatDate(entry.date)}</strong>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">Tipo de Origen</span>
              <strong className="text-gray-800 font-medium">{entry.sourceType}</strong>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">Documento Fuente</span>
              <strong className="font-mono text-blue-900">{entry.documentNumber || '—'}</strong>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px]">Bodega / CEDI</span>
              <strong className="text-gray-800 font-medium">{entry.locationName || 'Bodega Principal'}</strong>
            </div>
          </div>

          {/* Tercero Relacionado */}
          {entry.thirdPartyName && (
            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-center justify-between">
              <div>
                <span className="text-blue-600 block text-[11px]">Tercero Asociado</span>
                <strong className="text-sm text-blue-950">{entry.thirdPartyName}</strong>
              </div>
              {entry.thirdPartyDoc && (
                <span className="font-mono text-xs text-blue-800 bg-white px-2 py-1 rounded border border-blue-200">
                  {entry.thirdPartyDoc}
                </span>
              )}
            </div>
          )}

          {/* Tabla de Partida Doble (DEBE vs HABER) */}
          <div>
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-2">
              Líneas del Asiento Contable (Partida Doble)
            </h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-100 text-gray-700 text-left border-b font-semibold">
                    <th className="py-2.5 px-3 w-24">Cuenta</th>
                    <th className="py-2.5 px-3">Nombre y Detalle</th>
                    <th className="py-2.5 px-3 text-right w-28">DEBE</th>
                    <th className="py-2.5 px-3 text-right w-28">HABER</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entry.lines.map((line) => (
                    <tr key={line.id} className="hover:bg-gray-50/60">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{line.accountCode}</td>
                      <td className="py-2.5 px-3">
                        <strong className="text-gray-900 block">{line.accountName}</strong>
                        <span className="text-[11px] text-gray-500">{line.description}</span>
                        {line.baseAmount && line.taxRatePercent ? (
                          <span className="text-[10px] text-gray-400 block font-mono">
                            Base: ${line.baseAmount.toLocaleString('es-CO')} (Tarifa {line.taxRatePercent}%)
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right font-semibold text-gray-900">
                        {line.debit > 0 ? `$${line.debit.toLocaleString('es-CO')}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right font-semibold text-gray-900">
                        {line.credit > 0 ? `$${line.credit.toLocaleString('es-CO')}` : '—'}
                      </td>
                    </tr>
                  ))}
                  {/* Totales y Verificación */}
                  <tr className="bg-gray-50 font-bold border-t">
                    <td colSpan={2} className="py-2.5 px-3 text-right uppercase text-[11px] text-gray-700">
                      Sumas Iguales:
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right text-blue-900">
                      ${entry.totalDebit.toLocaleString('es-CO')}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right text-blue-900">
                      ${entry.totalCredit.toLocaleString('es-CO')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Comprobación de Partida Doble */}
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-900 text-xs flex items-center justify-between font-medium">
            <div className="flex items-center gap-2">
              <AppIcon name="check" size={16} />
              <span>Total Débitos ($ {entry.totalDebit.toLocaleString('es-CO')}) = Total Créditos ($ {entry.totalCredit.toLocaleString('es-CO')})</span>
            </div>
            <span className="font-semibold text-emerald-700">Partida Doble Cuadrada</span>
          </div>
        </div>

        {/* Pie del Drawer y Botón de Reversión */}
        <div className="drawer-footer border-t pt-3 flex items-center justify-between">
          <span className="text-[11px] text-gray-400">
            {entry.createdByUserName ? `Registrado por ${entry.createdByUserName}` : 'Generado automáticamente por el ERP'}
          </span>

          <div className="flex items-center gap-2">
            {canCancelEntry && entry.status === 'POSTED' && (
              <button
                type="button"
                className="outline-button text-xs py-1.5 text-rose-600 border-rose-200 hover:bg-rose-50"
                onClick={() => setIsConfirmOpen(true)}
              >
                <AppIcon name="powerOff" size={14} />
                <span>Revertir Asiento</span>
              </button>
            )}
            <button type="button" className="outline-button text-xs py-1.5" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Confirmación de Reversión */}
      {isConfirmOpen && (
        <div
          className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsConfirmOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <AppIcon name="warning" size={20} />
              <span>Confirmar Reversión Contable</span>
            </div>

            <p className="text-xs text-gray-600">
              Esta acción no borrará el registro histórico (principio de trazabilidad). Generará un
              comprobante de reversión contable invertido por <strong>${entry.totalDebit.toLocaleString('es-CO')} COP</strong> y
              marcará el asiento original como REVERSED.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Motivo / Justificación de la anulación (Obligatorio):
              </label>
              <textarea
                className="filter-select w-full text-xs h-20"
                placeholder="Indica el motivo contable o administrativo para la reversión..."
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                className="outline-button text-xs"
                onClick={() => setIsConfirmOpen(false)}
                disabled={isReversing}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button bg-rose-600 hover:bg-rose-700 text-xs"
                onClick={handleConfirmReversal}
                disabled={isReversing || !reversalReason.trim()}
              >
                {isReversing ? 'Procesando...' : 'Confirmar Reversión'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
