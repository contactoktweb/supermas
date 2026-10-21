'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { ScrollableTabs } from '@/components/ui/ScrollableTabs'
import { warehouseRepository } from '@/features/warehouses/repositories/warehouse.repository'
import { cashSessionService } from '../services/cash-session.service'
import type { CashRegister, CashSession, CashSessionSummary } from '../types'
import { CashFeedbackBanner } from './cash/CashFeedbackBanner'
import { CashKpiGrid } from './cash/CashKpiGrid'
import { CashRegistersPanel } from './cash/CashRegistersPanel'
import { CashSessionsHistoryTable } from './cash/CashSessionsHistoryTable'
import { OpenCashSessionModal, OpenCashSessionValues } from './cash/OpenCashSessionModal'
import { CashMovementModal, CashMovementValues } from './cash/CashMovementModal'
import { CloseCashSessionModal, CloseCashSessionValues } from './cash/CloseCashSessionModal'
import { NewCashRegisterModal, NewCashRegisterValues } from './cash/NewCashRegisterModal'
import {
  ALL_LOCATIONS,
  CashLocationOption,
  REDUCED_MOTION_CLASS,
  TOAST_DURATION_MS,
  formatCOP,
  getErrorMessage,
} from './cash/cashUi'

type CashTab = 'REGISTERS' | 'HISTORY'

const TABS: { id: CashTab; label: string; icon: LightIconName }[] = [
  { id: 'REGISTERS', label: 'Cajas en vivo', icon: 'cashRegisters' },
  { id: 'HISTORY', label: 'Historial de arqueos y cierres', icon: 'clock' },
]

const TAB_PANEL_ID: Record<CashTab, string> = {
  REGISTERS: 'cash-panel-registers',
  HISTORY: 'cash-panel-history',
}

export function CashSessionsPage() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [successToast, setSuccessToast] = useState<string | null>(null)

  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [sessions, setSessions] = useState<CashSession[]>([])
  const [locations, setLocations] = useState<CashLocationOption[]>([])

  const [selectedLocation, setSelectedLocation] = useState<string>(ALL_LOCATIONS)
  const [activeTab, setActiveTab] = useState<CashTab>('REGISTERS')

  const [registerToOpen, setRegisterToOpen] = useState<CashRegister | null>(null)
  const [sessionForMovement, setSessionForMovement] = useState<CashSession | null>(null)
  const [sessionToClose, setSessionToClose] = useState<CashSession | null>(null)
  const [sessionSummary, setSessionSummary] = useState<CashSessionSummary | null>(null)
  const [showNewRegisterModal, setShowNewRegisterModal] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setLoadError(null)
      const [regs, sess, locationsRes] = await Promise.all([
        cashSessionService.getCashRegisters(selectedLocation),
        cashSessionService.getSessions({ locationId: selectedLocation }),
        warehouseRepository.findAll(),
      ])
      setRegisters(regs)
      setSessions(sess)
      setLocations((locationsRes?.data ?? []).map(({ id, name }) => ({ id, name })))
    } catch (err) {
      console.error('Error al cargar datos de cajas:', err)
      setLoadError(getErrorMessage(err, 'Error al consultar cajas y arqueos.'))
    } finally {
      setLoading(false)
    }
  }, [selectedLocation])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!successToast) return
    const timer = setTimeout(() => setSuccessToast(null), TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [successToast])

  const notifySuccess = (message: string) => {
    setActionError(null)
    setSuccessToast(message)
  }

  const handleOpenSession = async ({ openingFloat, notes }: OpenCashSessionValues) => {
    if (!registerToOpen) return
    await cashSessionService.openSession({ cashRegisterId: registerToOpen.id, openingFloat, notes })
    notifySuccess(`Caja ${registerToOpen.name} abierta con éxito.`)
    setRegisterToOpen(null)
    await loadData()
  }

  const handleRecordMovement = async ({ type, amount, reason }: CashMovementValues) => {
    if (!sessionForMovement) return
    await cashSessionService.recordMovement({ sessionId: sessionForMovement.id, type, amount, reason })
    notifySuccess(`Movimiento de ${type === 'CASH_IN' ? 'entrada' : 'retiro'} registrado exitosamente.`)
    setSessionForMovement(null)
    await loadData()
  }

  const openCloseModal = async (session: CashSession) => {
    setSessionToClose(session)
    setSessionSummary(null)
    try {
      setSessionSummary(await cashSessionService.getSessionSummary(session.id))
    } catch (err) {
      setSessionToClose(null)
      setActionError(`Error al preparar arqueo: ${getErrorMessage(err, 'intente nuevamente.')}`)
    }
  }

  const closeCloseModal = useCallback(() => {
    setSessionToClose(null)
    setSessionSummary(null)
  }, [])

  const handleCloseSession = async ({ countedCashAmount, supervisorNotes }: CloseCashSessionValues) => {
    if (!sessionToClose) return
    const res = await cashSessionService.closeSession({
      sessionId: sessionToClose.id,
      countedCashAmount,
      supervisorNotes,
    })
    const result =
      res.difference_type === 'BALANCED'
        ? 'Caja exacta'
        : res.difference_type === 'SURPLUS'
          ? `Sobrante de ${formatCOP(res.difference_amount)}`
          : `Faltante de ${formatCOP(res.difference_amount)}`
    notifySuccess(`Turno de caja cerrado exitosamente. Resultado de arqueo: ${result}.`)
    closeCloseModal()
    await loadData()
  }

  const handleCreateRegister = async (values: NewCashRegisterValues) => {
    await cashSessionService.createCashRegister(values)
    notifySuccess('Caja registradora creada exitosamente.')
    setShowNewRegisterModal(false)
    await loadData()
  }

  const closeOpenModal = useCallback(() => setRegisterToOpen(null), [])
  const closeMovementModal = useCallback(() => setSessionForMovement(null), [])
  const closeNewRegisterModal = useCallback(() => setShowNewRegisterModal(false), [])

  const openRegistersCount = registers.filter((r) => r.currentStatus === 'OPEN').length
  const defaultNewRegisterLocation =
    selectedLocation !== ALL_LOCATIONS ? selectedLocation : locations[0]?.id ?? ''

  return (
    <div className={`cash-module page-enter space-y-6 ${REDUCED_MOTION_CLASS}`}>
      {successToast && (
        <CashFeedbackBanner variant="success" message={successToast} onDismiss={() => setSuccessToast(null)} />
      )}
      {actionError && (
        <CashFeedbackBanner variant="error" message={actionError} onDismiss={() => setActionError(null)} />
      )}

      <header className="page-heading">
        <div>
          <p className="eyebrow">Punto de venta y tesorería</p>
          <h1>Cajas y arqueos</h1>
          <p className="welcome-subtitle">
            Control de cajas registradoras: apertura de turnos, movimientos de efectivo, arqueos y cierres por sede.
          </p>
        </div>

        <div className="heading-actions flex-wrap lg:flex-nowrap lg:shrink-0">
          <label className="filter-select-wrap gap-2">
            <AppIcon name="warehouse" size={15} />
            <span className="sr-only">Filtrar por sede</span>
            <select
              className="filter-select"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
            >
              <option value={ALL_LOCATIONS}>Todas las sedes</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={`outline-button ${REDUCED_MOTION_CLASS}`}
            onClick={loadData}
            disabled={loading}
          >
            <AppIcon name="refresh" size={16} className={loading ? 'animate-spin motion-reduce:animate-none' : ''} />
            <span>Actualizar</span>
          </button>
          <button
            type="button"
            className={`primary-button ${REDUCED_MOTION_CLASS}`}
            onClick={() => setShowNewRegisterModal(true)}
          >
            <AppIcon name="plus" size={16} />
            <span>Nueva caja</span>
          </button>
        </div>
      </header>

      <CashKpiGrid
        totalRegisters={registers.length}
        openRegisters={openRegistersCount}
        closedRegisters={registers.length - openRegistersCount}
        sessionsCount={sessions.length}
      />

      <ScrollableTabs>
        {TABS.map((tab) => {
          const count = tab.id === 'REGISTERS' ? registers.length : sessions.length
          const selected = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${TAB_PANEL_ID[tab.id]}-tab`}
              aria-selected={selected}
              aria-controls={TAB_PANEL_ID[tab.id]}
              className={`drawer-tab flex items-center gap-2 ${selected ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <AppIcon name={tab.icon} size={15} />
              <span>{tab.label}</span>
              <span className="px-1.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">{count}</span>
            </button>
          )
        })}
      </ScrollableTabs>

      <section
        id={TAB_PANEL_ID[activeTab]}
        role="tabpanel"
        aria-labelledby={`${TAB_PANEL_ID[activeTab]}-tab`}
        className="space-y-4"
      >
        <div>
          <h2 className="text-sm font-bold text-gray-900">
            {activeTab === 'REGISTERS' ? 'Cajas registradoras' : 'Histórico de turnos y arqueos'}
          </h2>
          <p className="text-xs text-gray-500">
            {activeTab === 'REGISTERS'
              ? 'Estado en tiempo real de cada caja y su turno activo.'
              : 'Registros de apertura, cierre y diferencias de arqueo.'}
          </p>
        </div>

        {loadError ? (
          <div
            role="alert"
            className="flex flex-col items-center text-center gap-3 py-10 px-6 bg-white rounded-xl border border-red-200"
          >
            <span className="w-11 h-11 rounded-xl bg-red-50 text-red-600 grid place-items-center" aria-hidden="true">
              <AppIcon name="warning" size={22} />
            </span>
            <p className="text-sm font-semibold text-gray-900">{loadError}</p>
            <button type="button" className={`outline-button compact ${REDUCED_MOTION_CLASS}`} onClick={loadData}>
              <AppIcon name="refresh" size={14} />
              <span>Reintentar</span>
            </button>
          </div>
        ) : activeTab === 'REGISTERS' ? (
          <CashRegistersPanel
            loading={loading}
            registers={registers}
            sessions={sessions}
            onCreateRegister={() => setShowNewRegisterModal(true)}
            onOpenSession={setRegisterToOpen}
            onRecordMovement={setSessionForMovement}
            onCloseSession={openCloseModal}
          />
        ) : (
          <CashSessionsHistoryTable loading={loading} sessions={sessions} />
        )}
      </section>

      {registerToOpen && (
        <OpenCashSessionModal register={registerToOpen} onClose={closeOpenModal} onSubmit={handleOpenSession} />
      )}

      {sessionForMovement && (
        <CashMovementModal session={sessionForMovement} onClose={closeMovementModal} onSubmit={handleRecordMovement} />
      )}

      {sessionToClose && (
        <CloseCashSessionModal
          session={sessionToClose}
          summary={sessionSummary}
          onClose={closeCloseModal}
          onSubmit={handleCloseSession}
        />
      )}

      {showNewRegisterModal && (
        <NewCashRegisterModal
          locations={locations}
          defaultLocationId={defaultNewRegisterLocation}
          onClose={closeNewRegisterModal}
          onSubmit={handleCreateRegister}
        />
      )}
    </div>
  )
}
