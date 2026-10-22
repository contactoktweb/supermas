'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { AccountingAccount, AccountingVoucherType, ThirdParty } from '../../types'
import {
  DEFAULT_MANUAL_VOUCHER_TYPE_CODE,
  MANUAL_VOUCHER_TYPE_CODES,
  ManualEntryFormData,
  ManualVoucherTypeCode,
} from '../../schemas/accounting.schema'
import { supabaseClient } from '@/lib/supabase/client'
import { DatePicker } from '@/components/ui/DatePicker'

interface NewManualEntryDrawerProps {
  isOpen: boolean
  onClose: () => void
  accounts: AccountingAccount[]
  /** Catálogo de tipos de comprobante: el manual admite CC, AJ, CM y TR (si están activos). */
  voucherTypes?: AccountingVoucherType[]
  thirdParties?: ThirdParty[]
  onOpenNewThirdParty?: () => void
  onSubmit: (data: ManualEntryFormData) => Promise<void>
}

interface TempLine {
  id: string
  accountId: string
  accountCode: string
  accountName: string
  debit: number
  credit: number
}

export function NewManualEntryDrawer({
  isOpen,
  onClose,
  accounts,
  voucherTypes = [],
  thirdParties = [],
  onOpenNewThirdParty,
  onSubmit,
}: NewManualEntryDrawerProps) {
  const [mounted, setMounted] = useState(false)
  const [voucherTypeCode, setVoucherTypeCode] = useState<ManualVoucherTypeCode>(DEFAULT_MANUAL_VOUCHER_TYPE_CODE)
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')
  const [locationId, setLocationId] = useState('')
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const [thirdPartyId, setThirdPartyId] = useState('')
  const [thirdPartyName, setThirdPartyName] = useState('')
  const [thirdPartyDoc, setThirdPartyDoc] = useState('')
  const [observation, setObservation] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    if (!isOpen) return

    const loadLocations = async () => {
      try {
        const { data, error } = await supabaseClient
          .from('locations')
          .select('id, name, code, status')
          .neq('status', 'INACTIVE')
          .order('name', { ascending: true })

        if (!error && data && data.length > 0) {
          setLocations(data)
          setLocationId((prev) => prev || data[0].id)
          return
        }

        const { data: fallback, error: fbErr } = await supabaseClient
          .from('locations')
          .select('id, name')
          .order('name', { ascending: true })

        if (!fbErr && fallback && fallback.length > 0) {
          setLocations(fallback)
          setLocationId((prev) => prev || fallback[0].id)
        }
      } catch (err) {
        console.warn('Advertencia al cargar bodegas:', err)
      }
    }

    loadLocations()
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Separar cuentas imputables para la selección
  const imputableAccounts = accounts.filter(
    (a) => a.level === 'SUBACCOUNT' || a.level === 'AUXILIARY'
  )
  const auxiliaryAccounts = imputableAccounts.filter((a) => a.level === 'AUXILIARY')
  const subAccounts = imputableAccounts.filter((a) => a.level === 'SUBACCOUNT')

  const [lines, setLines] = useState<TempLine[]>([
    {
      id: 'line-1',
      accountId: '',
      accountCode: '',
      accountName: '',
      debit: 0,
      credit: 0,
    },
    {
      id: 'line-2',
      accountId: '',
      accountCode: '',
      accountName: '',
      debit: 0,
      credit: 0,
    },
  ])

  // Sincronizar con cuentas imputables reales cuando se abra el modal o carguen las cuentas
  useEffect(() => {
    if (isOpen && accounts.length > 0) {
      setLines((prev) => {
        const hasValidAccs =
          prev.length >= 2 &&
          prev.every((l) => l.accountId && accounts.some((a) => a.id === l.accountId))
        if (hasValidAccs) return prev

        const imp = accounts.filter((a) => a.level === 'AUXILIARY' || a.level === 'SUBACCOUNT')
        if (imp.length === 0) return prev

        // Débito sugerido: Caja o Bancos (auxiliar o subcuenta)
        const defaultDebit =
          imp.find((a) => a.code.startsWith('111005') || a.code.startsWith('110505')) || imp[0]
        // Crédito sugerido: Ventas o Proveedores
        const defaultCredit =
          imp.find((a) => a.code.startsWith('413501') || a.code.startsWith('220505')) ||
          imp[1] ||
          imp[0]

        return [
          {
            id: 'line-1',
            accountId: defaultDebit.id,
            accountCode: defaultDebit.code,
            accountName: defaultDebit.name,
            debit: 0,
            credit: 0,
          },
          {
            id: 'line-2',
            accountId: defaultCredit.id,
            accountCode: defaultCredit.code,
            accountName: defaultCredit.name,
            debit: 0,
            credit: 0,
          },
        ]
      })
    }
  }, [isOpen, accounts])

  if (!isOpen || !mounted) return null

  // Tipos que admite el asiento manual, con el nombre que la empresa les dio y solo si están activos.
  const manualVoucherOptions = MANUAL_VOUCHER_TYPE_CODES.flatMap((code) => {
    const vt = voucherTypes.find((v) => v.code === code)
    return vt && vt.isActive ? [{ code, name: vt.name }] : []
  })

  const totalDebit = lines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((acc, l) => acc + (Number(l.credit) || 0), 0)
  const difference = Math.abs(totalDebit - totalCredit)
  const isBalanced = difference < 0.01 && totalDebit > 0

  const handleAddLine = () => {
    // Buscar la primera cuenta imputable (auxiliar preferentemente o subcuenta)
    const firstAcc = auxiliaryAccounts[0] || subAccounts[0] || accounts[0]
    setLines((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        accountId: firstAcc ? firstAcc.id : '',
        accountCode: firstAcc ? firstAcc.code : '',
        accountName: firstAcc ? firstAcc.name : '',
        debit: 0,
        credit: 0,
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
      if (acc.level === 'ACCOUNT' || acc.level === 'GROUP' || acc.level === 'CLASS') {
        setFormError(`La cuenta ${acc.code} (${acc.name}) es de nivel Mayor y no es imputable. Debe utilizar una subcuenta (nivel 4) o auxiliar (nivel 5, ej: 111005.01).`)
        return
      }
      setFormError(null)
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

    // Validar que ninguna línea use cuenta de nivel Mayor (no imputable)
    for (const l of lines) {
      const acc = accounts.find((a) => a.id === l.accountId || a.code === l.accountCode)
      if (acc && (acc.level === 'CLASS' || acc.level === 'GROUP' || acc.level === 'ACCOUNT')) {
        setFormError(`La cuenta "${acc.code} - ${acc.name}" es de nivel Mayor (no imputable). En los asientos deben utilizarse subcuentas o auxiliares (ej: 111005.01).`)
        return
      }
    }

    try {
      setIsSubmitting(true)
      await onSubmit({
        voucherTypeCode,
        date,
        dueDate: dueDate.trim() || undefined,
        description,
        locationId,
        thirdPartyId: thirdPartyId || undefined,
        thirdPartyName: thirdPartyName.trim() || undefined,
        thirdPartyDoc: thirdPartyDoc.trim() || undefined,
        observation: observation.trim() || undefined,
        lines: lines.map((l) => ({
          accountId: l.accountId,
          accountCode: l.accountCode,
          accountName: l.accountName,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          description: description.trim(),
        })),
      })
      onClose()
    } catch (err: any) {
      setFormError(err.message || 'Error al registrar el asiento contable.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleThirdPartySelect = (id: string) => {
    setThirdPartyId(id)
    if (!id) {
      return
    }
    const tp = thirdParties.find((t) => t.id === id)
    if (tp) {
      setThirdPartyName(tp.companyName)
      const doc = tp.verificationDigit
        ? `${tp.documentNumber}-${tp.verificationDigit}`
        : tp.documentNumber
      setThirdPartyDoc(doc)
    }
  }

  return createPortal(
    <div className="drawer-backdrop modal-center p-3 sm:p-4" onClick={onClose} aria-modal="true" role="dialog">
      <div
        className="modal-card animate-scale-up"
        style={{
          width: '100%',
          maxWidth: 960,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center font-bold shrink-0">
              <AppIcon name="plusMinus" size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Nuevo Asiento Contable Manual</h2>
              <p className="text-xs text-slate-500">
                Registra comprobantes manuales con vencimiento, terceros y partida doble balanceada.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <AppIcon name="close" size={20} />
          </button>
        </div>

        {formError && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
            <AppIcon name="warning" size={16} />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
            {/* Campos Generales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label htmlFor="manual-entry-voucher-type" className="block font-semibold text-slate-700 mb-1">
                  Tipo de Comprobante:
                </label>
                <select
                  id="manual-entry-voucher-type"
                  className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-sm"
                  value={voucherTypeCode}
                  onChange={(e) => setVoucherTypeCode(e.target.value as ManualVoucherTypeCode)}
                  disabled={manualVoucherOptions.length === 0}
                >
                  {manualVoucherOptions.length === 0 ? (
                    <option value={DEFAULT_MANUAL_VOUCHER_TYPE_CODE}>Cargando tipos de comprobante...</option>
                  ) : (
                    manualVoucherOptions.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.code} — {opt.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Fecha del Asiento:</label>
                <DatePicker
                  value={date}
                  required
                  size="sm"
                  onChange={(value) => setDate(value)}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Fecha de Vencimiento:</span>
                  <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">Opcional</span>
                </label>
                <DatePicker
                  value={dueDate}
                  min={date}
                  size="sm"
                  onChange={(value) => setDueDate(value)}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Bodega / Centro de Costos:</label>
                <select
                  className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-sm"
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                >
                  {locations.length === 0 ? (
                    <option value="">Cargando bodegas...</option>
                  ) : (
                    locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Selección o Registro de Tercero */}
            <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                  <AppIcon name="users" size={15} />
                  Tercero del Asiento (Persona Natural o Jurídica)
                </span>
                {onOpenNewThirdParty && (
                  <button
                    type="button"
                    onClick={onOpenNewThirdParty}
                    className="text-[11px] text-blue-700 hover:text-blue-800 font-semibold flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-blue-200 hover:border-blue-300 shadow-2xs transition-all hover:bg-blue-50"
                  >
                    <AppIcon name="plus" size={12} />
                    <span>+ Crear Tercero Antes del Asiento</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Seleccionar Tercero Existente:
                  </label>
                  <select
                    className="w-full h-9 px-2.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                    value={thirdPartyId}
                    onChange={(e) => handleThirdPartySelect(e.target.value)}
                  >
                    <option value="">-- Seleccionar o digitar manual --</option>
                    {/* Proveedores */}
                    {thirdParties.filter((t) => t.thirdPartyType === 'PROVEEDOR').length > 0 && (
                      <optgroup label="── PROVEEDORES (Compras / Insumos) ──">
                        {thirdParties
                          .filter((t) => t.thirdPartyType === 'PROVEEDOR')
                          .map((tp) => (
                            <option key={tp.id} value={tp.id}>
                              {tp.companyName} ({tp.legalNature === 'JURIDICA' ? 'NIT' : 'CC'}: {tp.documentNumber}
                              {tp.verificationDigit ? `-${tp.verificationDigit}` : ''})
                            </option>
                          ))}
                      </optgroup>
                    )}
                    {/* Clientes */}
                    {thirdParties.filter((t) => t.thirdPartyType === 'CLIENTE').length > 0 && (
                      <optgroup label="── CLIENTES (Ventas / Cartera) ──">
                        {thirdParties
                          .filter((t) => t.thirdPartyType === 'CLIENTE')
                          .map((tp) => (
                            <option key={tp.id} value={tp.id}>
                              {tp.companyName} ({tp.legalNature === 'JURIDICA' ? 'NIT' : 'CC'}: {tp.documentNumber}
                              {tp.verificationDigit ? `-${tp.verificationDigit}` : ''})
                            </option>
                          ))}
                      </optgroup>
                    )}
                    {/* Empleados */}
                    {thirdParties.filter((t) => t.thirdPartyType === 'EMPLEADO').length > 0 && (
                      <optgroup label="── EMPLEADOS (Nómina) ──">
                        {thirdParties
                          .filter((t) => t.thirdPartyType === 'EMPLEADO')
                          .map((tp) => (
                            <option key={tp.id} value={tp.id}>
                              {tp.companyName} ({tp.legalNature === 'JURIDICA' ? 'NIT' : 'CC'}: {tp.documentNumber}
                              {tp.verificationDigit ? `-${tp.verificationDigit}` : ''})
                            </option>
                          ))}
                      </optgroup>
                    )}
                    {/* Acreedores y Otros */}
                    {thirdParties.filter(
                      (t) =>
                        t.thirdPartyType !== 'PROVEEDOR' &&
                        t.thirdPartyType !== 'CLIENTE' &&
                        t.thirdPartyType !== 'EMPLEADO'
                    ).length > 0 && (
                      <optgroup label="── ACREEDORES Y OTROS ──">
                        {thirdParties
                          .filter(
                            (t) =>
                              t.thirdPartyType !== 'PROVEEDOR' &&
                              t.thirdPartyType !== 'CLIENTE' &&
                              t.thirdPartyType !== 'EMPLEADO'
                          )
                          .map((tp) => (
                            <option key={tp.id} value={tp.id}>
                              {tp.companyName} ({tp.legalNature === 'JURIDICA' ? 'NIT' : 'CC'}: {tp.documentNumber}
                              {tp.verificationDigit ? `-${tp.verificationDigit}` : ''})
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Documento Tercero (NIT / CC):
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: NIT 900.123.456-1"
                    className="w-full h-9 px-2.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    value={thirdPartyDoc}
                    onChange={(e) => {
                      setThirdPartyDoc(e.target.value)
                      setThirdPartyId('')
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Nombre o Razón Social Tercero:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Distribuidora Aliada S.A.S."
                    className="w-full h-9 px-2.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={thirdPartyName}
                    onChange={(e) => {
                      setThirdPartyName(e.target.value)
                      setThirdPartyId('')
                    }}
                  />
                </div>
              </div>

              {/* Badge Informativo de Tercero Seleccionado */}
              {thirdPartyId && (() => {
                const selectedTp = thirdParties.find((t) => t.id === thirdPartyId)
                if (!selectedTp) return null
                return (
                  <div className="mt-2.5 py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-600">Clasificación:</span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          selectedTp.thirdPartyType === 'CLIENTE'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : selectedTp.thirdPartyType === 'PROVEEDOR'
                            ? 'bg-blue-50 text-blue-900 border-blue-300'
                            : selectedTp.thirdPartyType === 'EMPLEADO'
                            ? 'bg-purple-50 text-purple-800 border-purple-300'
                            : 'bg-amber-50 text-amber-800 border-amber-300'
                        }`}
                      >
                        {selectedTp.thirdPartyType === 'CLIENTE' && (
                          <>
                            <AppIcon name="purchases" size={11} className="text-emerald-700" />
                            CLIENTE
                          </>
                        )}
                        {selectedTp.thirdPartyType === 'PROVEEDOR' && (
                          <>
                            <AppIcon name="package" size={11} className="text-blue-700" />
                            PROVEEDOR
                          </>
                        )}
                        {selectedTp.thirdPartyType === 'EMPLEADO' && (
                          <>
                            <AppIcon name="users" size={11} className="text-purple-700" />
                            EMPLEADO
                          </>
                        )}
                        {selectedTp.thirdPartyType === 'ACREEDOR' && (
                          <>
                            <AppIcon name="warehouse" size={11} className="text-amber-700" />
                            ACREEDOR
                          </>
                        )}
                        {selectedTp.thirdPartyType === 'OTRO' && (
                          <>
                            <AppIcon name="layers" size={11} className="text-slate-600" />
                            OTRO
                          </>
                        )}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {selectedTp.legalNature === 'JURIDICA' ? '• Persona Jurídica (NIT)' : '• Persona Natural (CC)'}
                      </span>
                    </div>
                    {selectedTp.email && (
                      <span className="text-[11px] text-slate-500 font-mono hidden sm:inline-flex items-center gap-1">
                        <AppIcon name="mail" size={11} className="text-slate-400" />
                        <span>{selectedTp.email}</span>
                      </span>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Concepto General */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Descripción / Concepto General:</label>
              <input
                type="text"
                placeholder="Ej: Causación factura proveedor, provisión nómina o ajuste de inventarios..."
                className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            {/* Constructor Dinámico de Líneas de Partida Doble */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Líneas del Asiento (Mínimo 2 líneas para Débito y Crédito)
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Solo se pueden imputar subcuentas (Nivel 4) y auxiliares (Nivel 5 con formato .01).
                  </span>
                </div>
                <button
                  type="button"
                  className="outline-button compact text-xs py-1 px-3 flex items-center gap-1.5"
                  onClick={handleAddLine}
                >
                  <AppIcon name="plus" size={13} />
                  <span>Agregar Línea</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white shadow-sm">
                <table
                  className="w-full text-xs"
                  style={{
                    minWidth: '600px',
                    width: '100%',
                    tableLayout: 'fixed',
                    borderCollapse: 'collapse',
                  }}
                >
                  <colgroup>
                    <col style={{ width: '64%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '4%' }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold text-left">
                      <th className="py-2.5 px-3 text-slate-700 text-xs font-semibold" style={{ padding: '10px 12px' }}>
                        Cuenta PUC (Subcuenta / Auxiliar)
                      </th>
                      <th className="py-2.5 px-3 text-right text-slate-700 text-xs font-semibold" style={{ padding: '10px 12px' }}>
                        DEBE
                      </th>
                      <th className="py-2.5 px-3 text-right text-slate-700 text-xs font-semibold" style={{ padding: '10px 12px' }}>
                        HABER
                      </th>
                      <th className="py-2.5 px-2 text-center" style={{ padding: '10px 6px' }}></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((line, idx) => (
                      <tr key={line.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-2.5" style={{ padding: '8px 10px' }}>
                          <select
                            className="w-full h-8 px-2 text-xs bg-white border border-slate-300 rounded-md font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 truncate"
                            value={line.accountId}
                            onChange={(e) => handleAccountSelect(idx, e.target.value)}
                          >
                            {auxiliaryAccounts.length > 0 && (
                              <optgroup label="── Cuentas Auxiliares (Nivel 5 - ej: 111005.01) ──">
                                {auxiliaryAccounts.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.code} - {a.name}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {subAccounts.length > 0 && (
                              <optgroup label="── Subcuentas (Nivel 4 - 6 dígitos) ──">
                                {subAccounts.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.code} - {a.name}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {imputableAccounts.length === 0 && (
                              <option value="">No hay cuentas imputables disponibles</option>
                            )}
                          </select>
                        </td>
                        <td className="p-2.5" style={{ padding: '8px 10px' }}>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            className="w-full h-8 px-2.5 text-xs text-right font-mono font-semibold bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            value={line.debit || ''}
                            onChange={(e) =>
                              handleUpdateLine(idx, {
                                debit: Number(e.target.value) || 0,
                                credit: 0,
                              })
                            }
                            placeholder="0"
                          />
                        </td>
                        <td className="p-2.5" style={{ padding: '8px 10px' }}>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            className="w-full h-8 px-2.5 text-xs text-right font-mono font-semibold bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            value={line.credit || ''}
                            onChange={(e) =>
                              handleUpdateLine(idx, {
                                credit: Number(e.target.value) || 0,
                                debit: 0,
                              })
                            }
                            placeholder="0"
                          />
                        </td>
                        <td className="p-2.5 text-center" style={{ padding: '8px 6px' }}>
                          {lines.length > 2 && (
                            <button
                              type="button"
                              className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                              onClick={() => handleRemoveLine(idx)}
                              title="Eliminar fila"
                            >
                              <AppIcon name="trash" size={15} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {/* Fila de Totales y Balance */}
                    <tr className="bg-slate-50 font-bold border-t border-slate-200">
                      <td className="py-2.5 px-3 text-right uppercase text-[11px] text-slate-700" style={{ padding: '10px 12px' }}>
                        Sumas Iguales:
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right text-blue-900 text-xs" style={{ padding: '10px 12px' }}>
                        ${totalDebit.toLocaleString('es-CO')}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right text-blue-900 text-xs" style={{ padding: '10px 12px' }}>
                        ${totalCredit.toLocaleString('es-CO')}
                      </td>
                      <td style={{ padding: '10px 6px' }}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Banner Dinámico de Validación de Partida Doble */}
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                isBalanced
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : totalDebit === 0 && totalCredit === 0
                  ? 'bg-slate-50 border-slate-200 text-slate-700'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <AppIcon name={isBalanced ? 'check' : 'warning'} size={18} />
                <span>
                  {isBalanced
                    ? `Partida doble cuadrada: Total Débito == Total Crédito ($${totalDebit.toLocaleString('es-CO')} COP)`
                    : totalDebit === 0 && totalCredit === 0
                    ? 'Ingresa montos en DEBE y HABER para validar el balance de partida doble.'
                    : `Asiento descuadrado: Diferencia de $${difference.toLocaleString('es-CO')} COP`}
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                isBalanced
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
              }`}>
                {isBalanced ? 'LISTO PARA CONFIRMAR' : 'BLOQUEADO'}
              </span>
            </div>
          </div>

          {/* Pie del Formulario */}
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              className="outline-button compact text-xs"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="primary-button compact text-xs"
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

