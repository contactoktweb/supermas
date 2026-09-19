'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { AccountingAccount } from '../../types'
import { ManualEntryFormData } from '../../schemas/accounting.schema'
import { db } from '@/lib/supabase/db'

interface NewManualEntryDrawerProps {
  isOpen: boolean
  onClose: () => void
  accounts: AccountingAccount[]
  onSubmit: (data: ManualEntryFormData) => Promise<void>
}

interface TempLine {
  id: string
  accountId: string
  accountCode: string
  accountName: string
  debit: number
  credit: number
  description: string
}

export function NewManualEntryDrawer({
  isOpen,
  onClose,
  accounts,
  onSubmit,
}: NewManualEntryDrawerProps) {
  const [mounted, setMounted] = useState(false)
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [locationId, setLocationId] = useState('loc-001')
  const [thirdPartyName, setThirdPartyName] = useState('')
  const [thirdPartyDoc, setThirdPartyDoc] = useState('')
  const [observation, setObservation] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const [lines, setLines] = useState<TempLine[]>([
    {
      id: 'line-1',
      accountId: 'acc-110505',
      accountCode: '110505',
      accountName: 'Caja General y Puntos de Venta',
      debit: 0,
      credit: 0,
      description: '',
    },
    {
      id: 'line-2',
      accountId: 'acc-413501',
      accountCode: '413501',
      accountName: 'Venta de Abarrotes y Víveres',
      debit: 0,
      credit: 0,
      description: '',
    },
  ])

  if (!isOpen || !mounted) return null

  const locations = db.locations || []

  const totalDebit = lines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((acc, l) => acc + (Number(l.credit) || 0), 0)
  const difference = Math.abs(totalDebit - totalCredit)
  const isBalanced = difference < 0.01 && totalDebit > 0

  const handleAddLine = () => {
    const firstAcc = accounts[0]
    setLines((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        accountId: firstAcc ? firstAcc.id : '',
        accountCode: firstAcc ? firstAcc.code : '',
        accountName: firstAcc ? firstAcc.name : '',
        debit: 0,
        credit: 0,
        description: description || '',
      },
    ])
  }

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 2) return
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpdateLine = (index: number, updates: Partial<TempLine>) => {
    setLines((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...updates }
      return next
    })
  }

  const handleAccountSelect = (index: number, accountId: string) => {
    const acc = accounts.find((a) => a.id === accountId)
    if (acc) {
      handleUpdateLine(index, {
        accountId: acc.id,
        accountCode: acc.code,
        accountName: acc.name,
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!description.trim()) {
      setFormError('La descripción general del asiento es obligatoria.')
      return
    }

    if (!isBalanced) {
      setFormError('Partida doble descuadrada: El Total Débito debe ser exactamente igual al Total Crédito y mayor a cero.')
      return
    }

    try {
      setIsSubmitting(true)
      await onSubmit({
        date,
        description,
        locationId,
        thirdPartyName: thirdPartyName.trim() || undefined,
        thirdPartyDoc: thirdPartyDoc.trim() || undefined,
        observation: observation.trim() || undefined,
        lines: lines.map((l) => ({
          accountId: l.accountId,
          accountCode: l.accountCode,
          accountName: l.accountName,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          description: l.description.trim() || description,
        })),
      })
      onClose()
    } catch (err: any) {
      setFormError(err.message || 'Error al registrar el asiento contable.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div className="drawer-backdrop" onClick={onClose} aria-modal="true" role="dialog">
      <div
        className="product-drawer page-enter"
        style={{
          width: 'min(100%, 820px)',
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
        {/* Cabecera */}
        <div className="drawer-header border-b pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center font-bold">
              <AppIcon name="plusMinus" size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Nuevo Asiento Contable Manual</h2>
              <p className="text-xs text-gray-500">
                Registra comprobantes manuales garantizando estricto balance de partida doble.
              </p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar modal">
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {formError && (
          <div className="my-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
            <AppIcon name="warning" size={16} />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="drawer-body space-y-4 py-3 text-xs">
          {/* Campos Generales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Fecha del Asiento:</label>
              <input
                type="date"
                className="filter-select w-full"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Bodega / Centro de Costos:</label>
              <select
                className="filter-select w-full"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Documento Tercero (NIT / CC):</label>
              <input
                type="text"
                placeholder="Ej: NIT 900.123.456-1"
                className="filter-select w-full"
                value={thirdPartyDoc}
                onChange={(e) => setThirdPartyDoc(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Descripción / Concepto General:</label>
              <input
                type="text"
                placeholder="Ej: Ajuste por depreciación acumulada o provisión cartera..."
                className="filter-select w-full"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Nombre o Razón Social Tercero:</label>
              <input
                type="text"
                placeholder="Ej: Distribuidora Aliada S.A.S."
                className="filter-select w-full"
                value={thirdPartyName}
                onChange={(e) => setThirdPartyName(e.target.value)}
              />
            </div>
          </div>

          {/* Constructor Dinámico de Líneas de Partida Doble */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                Líneas del Asiento (Mínimo 2 líneas para Débito y Crédito)
              </h3>
              <button
                type="button"
                className="outline-button text-xs py-1"
                onClick={handleAddLine}
              >
                <AppIcon name="plus" size={13} />
                <span>Agregar Línea</span>
              </button>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-100 text-gray-700 border-b font-semibold text-left">
                    <th className="py-2 px-3 w-5/12">Cuenta PUC</th>
                    <th className="py-2 px-3 w-3/12">Detalle Línea</th>
                    <th className="py-2 px-3 w-2/12 text-right">DEBE</th>
                    <th className="py-2 px-3 w-2/12 text-right">HABER</th>
                    <th className="py-2 px-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.map((line, idx) => (
                    <tr key={line.id} className="hover:bg-gray-50/50">
                      <td className="p-2">
                        <select
                          className="filter-select w-full text-xs font-mono"
                          value={line.accountId}
                          onChange={(e) => handleAccountSelect(idx, e.target.value)}
                        >
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} - {a.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          className="filter-select w-full text-xs"
                          placeholder="Concepto específico..."
                          value={line.description}
                          onChange={(e) => handleUpdateLine(idx, { description: e.target.value })}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className="filter-select w-full text-xs text-right font-mono font-semibold"
                          value={line.debit || ''}
                          onChange={(e) =>
                            handleUpdateLine(idx, {
                              debit: Number(e.target.value) || 0,
                              credit: 0, // Si ingresa débito, limpia crédito
                            })
                          }
                          placeholder="0"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className="filter-select w-full text-xs text-right font-mono font-semibold"
                          value={line.credit || ''}
                          onChange={(e) =>
                            handleUpdateLine(idx, {
                              credit: Number(e.target.value) || 0,
                              debit: 0, // Si ingresa crédito, limpia débito
                            })
                          }
                          placeholder="0"
                        />
                      </td>
                      <td className="p-2 text-center">
                        {lines.length > 2 && (
                          <button
                            type="button"
                            className="text-gray-400 hover:text-rose-600 p-1"
                            onClick={() => handleRemoveLine(idx)}
                            title="Eliminar fila"
                          >
                            <AppIcon name="trash" size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {/* Fila de Totales y Balance */}
                  <tr className="bg-gray-50 font-bold border-t">
                    <td colSpan={2} className="py-2.5 px-3 text-right uppercase text-[11px] text-gray-700">
                      Sumas Iguales:
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right text-blue-900 text-sm">
                      ${totalDebit.toLocaleString('es-CO')}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right text-blue-900 text-sm">
                      ${totalCredit.toLocaleString('es-CO')}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Banner Dinámico de Validación de Partida Doble */}
          <div
            className={`p-3 rounded-lg border flex items-center justify-between text-xs font-semibold ${
              isBalanced
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <AppIcon name={isBalanced ? 'check' : 'warning'} size={18} />
              <span>
                {isBalanced
                  ? 'Partida doble cuadrada: Total Débito == Total Crédito'
                  : totalDebit === 0 && totalCredit === 0
                  ? 'Ingresa montos para debitar y acreditar el asiento'
                  : `Asiento descuadrado: Diferencia de $${difference.toLocaleString('es-CO')} COP`}
              </span>
            </div>
            <span>{isBalanced ? 'LISTO PARA CONFIRMAR' : 'BLOQUEADO'}</span>
          </div>

          {/* Pie del Formulario */}
          <div className="drawer-footer border-t pt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              className="outline-button text-xs py-1.5"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="primary-button text-xs py-1.5"
              disabled={isSubmitting || !isBalanced}
              title={isBalanced ? 'Guardar y confirmar asiento' : 'Cuadra el asiento antes de guardar'}
            >
              {isSubmitting ? 'Guardando Asiento...' : 'Confirmar Asiento Contable'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
