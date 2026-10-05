'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { cashSessionService } from '../services/cash-session.service'
import {
  CashRegister,
  CashSession,
  CashSessionSummary,
  CashMovement,
} from '../types'
import { warehouseRepository } from '@/features/warehouses/repositories/warehouse.repository'

export function CashSessionsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successToast, setSuccessToast] = useState<string | null>(null)

  // Data states
  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [sessions, setSessions] = useState<CashSession[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])

  // Filter states
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL')
  const [activeTab, setActiveTab] = useState<'REGISTERS' | 'HISTORY'>('REGISTERS')

  // Modals states
  const [openModalRegister, setOpenModalRegister] = useState<CashRegister | null>(null)
  const [openingFloat, setOpeningFloat] = useState<number>(100000)
  const [openingNotes, setOpeningNotes] = useState<string>('')
  const [openingLoading, setOpeningLoading] = useState(false)

  // Movement modal
  const [activeSessionForMovement, setActiveSessionForMovement] = useState<CashSession | null>(null)
  const [movementType, setMovementType] = useState<'CASH_IN' | 'CASH_OUT'>('CASH_OUT')
  const [movementAmount, setMovementAmount] = useState<number>(0)
  const [movementReason, setMovementReason] = useState<string>('')
  const [movementLoading, setMovementLoading] = useState(false)

  // Arqueo / Close modal
  const [activeSessionForClose, setActiveSessionForClose] = useState<CashSession | null>(null)
  const [sessionSummary, setSessionSummary] = useState<CashSessionSummary | null>(null)
  const [countedCash, setCountedCash] = useState<number>(0)
  const [closeNotes, setCloseNotes] = useState<string>('')
  const [closeLoading, setCloseLoading] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)

  // New register modal
  const [showNewRegisterModal, setShowNewRegisterModal] = useState(false)
  const [newRegCode, setNewRegCode] = useState('')
  const [newRegName, setNewRegName] = useState('')
  const [newRegLocationId, setNewRegLocationId] = useState('')
  const [newRegLoading, setNewRegLoading] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [regs, sess, whsRes] = await Promise.all([
        cashSessionService.getCashRegisters(selectedLocation),
        cashSessionService.getSessions({ locationId: selectedLocation }),
        warehouseRepository.findAll(),
      ])
      const whList = whsRes?.data || []
      setRegisters(regs)
      setSessions(sess)
      setWarehouses(whList)
      if (whList.length > 0 && !newRegLocationId) {
        setNewRegLocationId(whList[0].id)
      }
    } catch (err: any) {
      console.error('Error al cargar datos de cajas:', err)
      setError(err.message || 'Error al consultar cajas y arqueos.')
    } finally {
      setLoading(false)
    }
  }, [selectedLocation, newRegLocationId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const formatCOP = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '$0 COP'
    return `$${Number(val).toLocaleString('es-CO')} COP`
  }

  // Handle open cash session
  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!openModalRegister) return
    try {
      setOpeningLoading(true)
      await cashSessionService.openSession({
        cashRegisterId: openModalRegister.id,
        openingFloat: Number(openingFloat) || 0,
        notes: openingNotes || undefined,
      })
      setOpenModalRegister(null)
      setOpeningNotes('')
      setSuccessToast(`Caja ${openModalRegister.name} abierta con éxito.`)
      setTimeout(() => setSuccessToast(null), 5000)
      await loadData()
    } catch (err: any) {
      alert(`Error al abrir caja: ${err.message}`)
    } finally {
      setOpeningLoading(false)
    }
  }

  // Handle manual movement
  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeSessionForMovement) return
    if (movementAmount <= 0) {
      alert('El monto debe ser estrictamente mayor a 0.')
      return
    }
    if (!movementReason.trim()) {
      alert('Debe ingresar un motivo.')
      return
    }
    try {
      setMovementLoading(true)
      await cashSessionService.recordMovement({
        sessionId: activeSessionForMovement.id,
        type: movementType,
        amount: Number(movementAmount),
        reason: movementReason.trim(),
      })
      setActiveSessionForMovement(null)
      setMovementAmount(0)
      setMovementReason('')
      setSuccessToast(`Movimiento de ${movementType === 'CASH_IN' ? 'Entrada' : 'Retiro'} registrado exitosamente.`)
      setTimeout(() => setSuccessToast(null), 5000)
      await loadData()
    } catch (err: any) {
      alert(`Error al registrar movimiento: ${err.message}`)
    } finally {
      setMovementLoading(false)
    }
  }

  // Open close/arqueo modal and fetch summary
  const openArqueoModal = async (session: CashSession) => {
    try {
      setActiveSessionForClose(session)
      setSummaryLoading(true)
      const summary = await cashSessionService.getSessionSummary(session.id)
      setSessionSummary(summary)
      setCountedCash(summary.expectedCashAmount)
      setCloseNotes('')
    } catch (err: any) {
      alert(`Error al preparar arqueo: ${err.message}`)
      setActiveSessionForClose(null)
    } finally {
      setSummaryLoading(false)
    }
  }

  // Handle close session and arqueo
  const handleCloseSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeSessionForClose) return
    try {
      setCloseLoading(true)
      const res = await cashSessionService.closeSession({
        sessionId: activeSessionForClose.id,
        countedCashAmount: Number(countedCash),
        supervisorNotes: closeNotes || undefined,
      })
      setActiveSessionForClose(null)
      setSessionSummary(null)
      setSuccessToast(
        `Turno de caja cerrado exitosamente. Resultado de arqueo: ${
          res.difference_type === 'BALANCED'
            ? 'Caja Exacta'
            : res.difference_type === 'SURPLUS'
            ? `Sobrante de ${formatCOP(res.difference_amount)}`
            : `Faltante de ${formatCOP(res.difference_amount)}`
        }`
      )
      setTimeout(() => setSuccessToast(null), 7000)
      await loadData()
    } catch (err: any) {
      alert(`Error al cerrar caja: ${err.message}`)
    } finally {
      setCloseLoading(false)
    }
  }

  // Handle create register
  const handleCreateRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRegCode.trim() || !newRegName.trim() || !newRegLocationId) {
      alert('Todos los campos son requeridos.')
      return
    }
    try {
      setNewRegLoading(true)
      await cashSessionService.createCashRegister({
        locationId: newRegLocationId,
        code: newRegCode.trim(),
        name: newRegName.trim(),
      })
      setShowNewRegisterModal(false)
      setNewRegCode('')
      setNewRegName('')
      setSuccessToast('Caja registradora creada exitosamente.')
      setTimeout(() => setSuccessToast(null), 5000)
      await loadData()
    } catch (err: any) {
      alert(`Error al crear caja: ${err.message}`)
    } finally {
      setNewRegLoading(false)
    }
  }

  // Computed summary metrics
  const totalRegisters = registers.length
  const openSessionsCount = registers.filter((r) => r.currentStatus === 'OPEN').length
  const closedRegistersCount = totalRegisters - openSessionsCount

  return (
    <div className="space-y-6 animate-fade-in p-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {successToast && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-center justify-between shadow-sm animate-slide-down">
          <div className="flex items-center gap-2">
            <AppIcon name="check" size={18} className="text-emerald-600" />
            <span className="font-medium">{successToast}</span>
          </div>
          <button
            type="button"
            className="text-emerald-700 hover:text-emerald-900 font-bold"
            onClick={() => setSuccessToast(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Header Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-600 mb-1">
            <AppIcon name="creditCard" size={14} />
            <span>Punto de Venta & Tesorería</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Control de Cajas & Arqueos
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Gestión en tiempo real de turnos, movimientos de efectivo, arqueos y conciliaciones por sede.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="px-3 py-2 text-xs font-medium border border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors focus:ring-2 focus:ring-rose-500 focus:outline-none"
          >
            <option value="ALL">Todas las Bodegas / Sedes</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowNewRegisterModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            <AppIcon name="plus" size={16} />
            <span>Nueva Caja</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Cajas Registradoras</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{totalRegisters}</div>
            <span className="text-[11px] text-slate-400">Total registradas</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600">
            <AppIcon name="creditCard" size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Turnos Abiertos</span>
            <div className="text-2xl font-black text-emerald-600 mt-1">{openSessionsCount}</div>
            <span className="text-[11px] text-emerald-600 font-semibold">Operando en vivo</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <AppIcon name="check" size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Cajas Cerradas</span>
            <div className="text-2xl font-black text-slate-600 mt-1">{closedRegistersCount}</div>
            <span className="text-[11px] text-slate-400">Listas para apertura</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
            <AppIcon name="clock" size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Historial Arqueos</span>
            <div className="text-2xl font-black text-rose-600 mt-1">{sessions.length}</div>
            <span className="text-[11px] text-slate-400">Auditoría completa</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
            <AppIcon name="fileText" size={24} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          onClick={() => setActiveTab('REGISTERS')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'REGISTERS'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AppIcon name="creditCard" size={16} />
          <span>Cajas en Vivo ({registers.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('HISTORY')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'HISTORY'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AppIcon name="clock" size={16} />
          <span>Historial de Arqueos & Cierres ({sessions.length})</span>
        </button>
      </div>

      {/* Tab: Cajas en Vivo */}
      {activeTab === 'REGISTERS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full text-center py-12 text-slate-400">
              <AppIcon name="refresh" className="animate-spin inline-block mr-2" size={20} />
              Cargando cajas registradoras...
            </div>
          ) : registers.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
              <AppIcon name="creditCard" size={40} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">No hay cajas registradoras para esta ubicación.</p>
              <p className="text-xs text-slate-400 mt-1">Crea una nueva caja para comenzar a operar turnos y ventas POS.</p>
              <button
                onClick={() => setShowNewRegisterModal(true)}
                className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Crear Primera Caja
              </button>
            </div>
          ) : (
            registers.map((reg) => {
              const isOpen = reg.currentStatus === 'OPEN'
              const activeSession = sessions.find(
                (s) => s.cashRegisterId === reg.id && s.status === 'OPEN'
              )

              return (
                <div
                  key={reg.id}
                  className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm flex flex-col justify-between ${
                    isOpen ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-slate-100 hover:border-slate-300'
                  }`}
                >
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-slate-400 font-mono tracking-wider">
                        {reg.code}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase ${
                          isOpen
                            ? 'bg-emerald-100 text-emerald-800 flex items-center gap-1'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {isOpen && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                        {isOpen ? 'Turno Abierto' : 'Cerrada'}
                      </span>
                    </div>

                    <h3 className="text-base font-extrabold text-slate-900">{reg.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <AppIcon name="warehouse" size={12} />
                      {reg.locationName}
                    </p>

                    {isOpen && activeSession && (
                      <div className="mt-4 p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 space-y-1.5 text-xs">
                        <div className="flex justify-between text-slate-600">
                          <span>Cajero a cargo:</span>
                          <span className="font-bold text-slate-800">{activeSession.cashierName}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Base inicial:</span>
                          <span className="font-bold text-emerald-800 font-mono">
                            {formatCOP(activeSession.openingFloat)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-500 text-[11px]">
                          <span>Apertura:</span>
                          <span>{new Date(activeSession.openingTime).toLocaleTimeString('es-CO')}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                    {isOpen && activeSession ? (
                      <>
                        <button
                          onClick={() => setActiveSessionForMovement(activeSession)}
                          className="flex-1 py-2 px-3 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-2xs"
                        >
                          <AppIcon name="arrowLeftRight" size={14} />
                          <span>Movimiento</span>
                        </button>
                        <button
                          onClick={() => openArqueoModal(activeSession)}
                          className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-sm active:scale-95"
                        >
                          <AppIcon name="check" size={14} />
                          <span>Arqueo / Cierre</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setOpenModalRegister(reg)
                          setOpeningFloat(100000)
                        }}
                        className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                      >
                        <AppIcon name="lock" size={14} />
                        <span>Abrir Turno de Caja</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Tab: Historial de Arqueos */}
      {activeTab === 'HISTORY' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Histórico de Turnos y Arqueos</h2>
            <span className="text-xs text-slate-400 font-medium">Registros fiduciarios inmutables</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Caja / Sede</th>
                  <th className="py-3 px-4">Cajero</th>
                  <th className="py-3 px-4">Apertura</th>
                  <th className="py-3 px-4">Cierre</th>
                  <th className="py-3 px-4 text-right">Base</th>
                  <th className="py-3 px-4 text-right">Esperado</th>
                  <th className="py-3 px-4 text-right">Contado</th>
                  <th className="py-3 px-4 text-right">Diferencia</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No se han registrado sesiones aún.
                    </td>
                  </tr>
                ) : (
                  sessions.map((sess) => {
                    const diff = sess.differenceAmount || 0
                    const isBalanced = diff === 0
                    const isSurplus = diff > 0

                    return (
                      <tr key={sess.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{sess.cashRegisterName || 'Caja'}</div>
                          <div className="text-[11px] text-slate-400">{sess.locationName}</div>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700">{sess.cashierName}</td>
                        <td className="py-3 px-4 text-slate-500">
                          {new Date(sess.openingTime).toLocaleString('es-CO', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {sess.closingTime
                            ? new Date(sess.closingTime).toLocaleString('es-CO', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700">
                          {formatCOP(sess.openingFloat)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700">
                          {formatCOP(sess.expectedCashAmount)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {sess.countedCashAmount !== null ? formatCOP(sess.countedCashAmount) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold">
                          {sess.status === 'CLOSED' ? (
                            <span
                              className={
                                isBalanced
                                  ? 'text-emerald-600'
                                  : isSurplus
                                  ? 'text-blue-600'
                                  : 'text-rose-600'
                              }
                            >
                              {diff > 0 ? `+${formatCOP(diff)}` : formatCOP(diff)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              sess.status === 'OPEN'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {sess.status === 'OPEN' ? 'Abierta' : 'Cerrada'}
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
      )}

      {/* Modal: Abrir Turno de Caja */}
      {openModalRegister && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 animate-scale-up">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <AppIcon name="lock" size={16} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Apertura de Caja</h3>
                  <p className="text-xs text-slate-500">{openModalRegister.name} ({openModalRegister.code})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenModalRegister(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleOpenSession} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Base Inicial de Efectivo (COP)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={openingFloat}
                    onChange={(e) => setOpeningFloat(Number(e.target.value))}
                    required
                    className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl font-mono text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Efectivo físico entregado al cajero para dar cambio.
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Notas de Apertura (Opcional)
                </label>
                <textarea
                  value={openingNotes}
                  onChange={(e) => setOpeningNotes(e.target.value)}
                  placeholder="Ej: Turno mañana, billetes de baja denominación..."
                  rows={2}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpenModalRegister(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={openingLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {openingLoading ? 'Abriendo...' : 'Confirmar Apertura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Registrar Movimiento (Ingreso / Retiro) */}
      {activeSessionForMovement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 animate-scale-up">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                  <AppIcon name="arrowLeftRight" size={16} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Movimiento de Caja</h3>
                  <p className="text-xs text-slate-500">Caja: {activeSessionForMovement.cashRegisterName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveSessionForMovement(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleRecordMovement} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tipo de Movimiento</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMovementType('CASH_IN')}
                    className={`p-2.5 rounded-xl border text-center font-bold transition-all flex items-center justify-center gap-1.5 ${
                      movementType === 'CASH_IN'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-200'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <AppIcon name="chevronDown" size={14} />
                    <span>Entrada (Inyección)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType('CASH_OUT')}
                    className={`p-2.5 rounded-xl border text-center font-bold transition-all flex items-center justify-center gap-1.5 ${
                      movementType === 'CASH_OUT'
                        ? 'border-rose-500 bg-rose-50 text-rose-800 ring-2 ring-rose-200'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <AppIcon name="chevronUp" size={14} />
                    <span>Salida (Retiro)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Monto en Efectivo (COP)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    min="1"
                    step="100"
                    value={movementAmount || ''}
                    onChange={(e) => setMovementAmount(Number(e.target.value))}
                    required
                    placeholder="0"
                    className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl font-mono text-sm font-bold text-slate-900 focus:ring-2 focus:ring-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Motivo / Justificación</label>
                <input
                  type="text"
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  placeholder="Ej: Pago de flete urgente, traslado a bóveda..."
                  required
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-800 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSessionForMovement(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={movementLoading}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {movementLoading ? 'Registrando...' : 'Registrar Movimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Arqueo y Cierre de Turno */}
      {activeSessionForClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  <AppIcon name="fileText" size={16} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Arqueo & Cierre de Caja</h3>
                  <p className="text-xs text-slate-500">
                    {sessionSummary?.cashRegisterName} ({sessionSummary?.cashRegisterCode}) — Cajero: {sessionSummary?.cashierName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveSessionForClose(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            {summaryLoading || !sessionSummary ? (
              <div className="py-12 text-center text-slate-400">
                <AppIcon name="refresh" className="animate-spin inline-block mr-2" size={20} />
                Consolidando ventas y movimientos...
              </div>
            ) : (
              <form onSubmit={handleCloseSession} className="space-y-4 text-xs">
                {/* Desglose de Caja */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                  <span className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px] block mb-2">
                    Flujo de Efectivo en Turno
                  </span>
                  <div className="flex justify-between text-slate-600">
                    <span>Base inicial (+):</span>
                    <span className="font-mono font-medium">{formatCOP(sessionSummary.openingFloat)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Ventas en efectivo (+):</span>
                    <span className="font-mono font-medium text-emerald-700">{formatCOP(sessionSummary.salesCash)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Entradas manuales (+):</span>
                    <span className="font-mono font-medium">{formatCOP(sessionSummary.cashIn)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Salidas / Retiros manuales (-):</span>
                    <span className="font-mono font-medium text-rose-700">{formatCOP(sessionSummary.cashOut)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-extrabold text-slate-900 text-sm">
                    <span>Efectivo Esperado en Gaveta:</span>
                    <span className="font-mono text-emerald-800 font-black">
                      {formatCOP(sessionSummary.expectedCashAmount)}
                    </span>
                  </div>
                </div>

                {/* Otros medios de pago registrados */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1 text-[11px]">
                  <span className="font-bold text-slate-700 block mb-1">Otros medios de pago (Ventas electrónicas):</span>
                  <div className="flex justify-between text-slate-500">
                    <span>Tarjetas débito/crédito:</span>
                    <span className="font-mono">{formatCOP(sessionSummary.salesCard)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Transferencias bancarias:</span>
                    <span className="font-mono">{formatCOP(sessionSummary.salesTransfer)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Ventas a crédito:</span>
                    <span className="font-mono">{formatCOP(sessionSummary.salesCredit)}</span>
                  </div>
                  <div className="pt-1 border-t border-slate-100 flex justify-between font-bold text-slate-800">
                    <span>Total ventas globales del turno ({sessionSummary.transactionsCount} txs):</span>
                    <span className="font-mono">{formatCOP(sessionSummary.totalSales)}</span>
                  </div>
                </div>

                {/* Conteo físico y cálculo de diferencia */}
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block font-bold text-slate-900 mb-1">
                      Efectivo Físico Contado en Gaveta (COP)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={countedCash}
                        onChange={(e) => setCountedCash(Number(e.target.value))}
                        required
                        className="w-full pl-8 pr-3 py-2.5 border-2 border-slate-300 rounded-xl font-mono text-base font-black text-slate-900 focus:border-rose-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Visualizador de Diferencia en Vivo */}
                  {(() => {
                    const diff = countedCash - sessionSummary.expectedCashAmount
                    const isBalanced = diff === 0
                    const isSurplus = diff > 0

                    return (
                      <div
                        className={`p-3.5 rounded-xl border flex items-center justify-between font-bold ${
                          isBalanced
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : isSurplus
                            ? 'bg-blue-50 border-blue-200 text-blue-800'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <AppIcon
                            name={isBalanced ? 'check' : isSurplus ? 'chevronUp' : 'warning'}
                            size={18}
                          />
                          <span>
                            {isBalanced ? 'Caja Cuadrada Exacta' : isSurplus ? 'Sobrante de Caja' : 'Faltante de Caja'}
                          </span>
                        </div>
                        <span className="font-mono text-sm font-black">
                          {isSurplus ? `+${formatCOP(diff)}` : formatCOP(diff)}
                        </span>
                      </div>
                    )
                  })()}

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Observaciones de Cierre / Supervisor (Opcional)
                    </label>
                    <textarea
                      value={closeNotes}
                      onChange={(e) => setCloseNotes(e.target.value)}
                      placeholder="Indicar motivo de diferencias si aplica, novedades del turno..."
                      rows={2}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveSessionForClose(null)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition-colors"
                  >
                    Volver
                  </button>
                  <button
                    type="submit"
                    disabled={closeLoading}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <AppIcon name="lock" size={14} />
                    <span>{closeLoading ? 'Cerrando Turno...' : 'Confirmar Cierre & Arqueo'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Crear Nueva Caja */}
      {showNewRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 animate-scale-up">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">Nueva Caja Registradora</h3>
              <button
                type="button"
                onClick={() => setShowNewRegisterModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateRegister} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Bodega / Sede</label>
                <select
                  value={newRegLocationId}
                  onChange={(e) => setNewRegLocationId(e.target.value)}
                  required
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-slate-800 focus:outline-none font-medium"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Código de Caja</label>
                <input
                  type="text"
                  value={newRegCode}
                  onChange={(e) => setNewRegCode(e.target.value.toUpperCase())}
                  placeholder="Ej: CAJA-01, POS-PRINCIPAL"
                  required
                  className="w-full p-2.5 border border-slate-200 rounded-xl font-mono uppercase focus:ring-2 focus:ring-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nombre Descriptivo</label>
                <input
                  type="text"
                  value={newRegName}
                  onChange={(e) => setNewRegName(e.target.value)}
                  placeholder="Ej: Caja Rápida Mostrador 1"
                  required
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-800 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewRegisterModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={newRegLoading}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {newRegLoading ? 'Guardando...' : 'Crear Caja'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
