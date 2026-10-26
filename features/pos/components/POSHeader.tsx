'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { AppIcon } from '@/components/ui/Icon'
import { SelectField } from '@/components/ui/SelectField'
import type { POSOpenCashSession, POSUserContext } from '../types'
import { openCustomerDisplayWindow } from '../customer-display/customerDisplayChannel'

interface POSHeaderProps {
  userContext: POSUserContext
  locations: Array<{ id: string; code: string; name: string }>
  onLocationChange: (locationId: string) => void
  locationsLoading: boolean
  cashSession: POSOpenCashSession | null
  cashSessionLoading: boolean
  onOpenDailySales: () => void
  onToggleFullscreen: () => void
  isFullscreen: boolean
  onExit?: () => void
}

const CLOCK_INTERVAL_MS = 15_000

function useClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const update = () =>
      setTime(new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }))
    update()
    const timer = window.setInterval(update, CLOCK_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [])
  return time
}

export function POSHeader({
  userContext,
  locations,
  onLocationChange,
  locationsLoading,
  cashSession,
  cashSessionLoading,
  onOpenDailySales,
  onToggleFullscreen,
  isFullscreen,
  onExit,
}: POSHeaderProps) {
  const time = useClock()
  const initials = userContext.userName
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const exit = () => (onExit ? onExit() : window.location.assign('/'))

  return (
    <header className="pos-header">
      <div className="pos-header-group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-distribuidora-blanco.png" alt="Distribuidora Super Más" className="pos-header-logo" />

        <button type="button" onClick={exit} className="pos-header-button" title="Volver al panel administrativo">
          <AppIcon name="chevronLeft" size={15} />
          <span className="pos-header-hide-md">Panel</span>
        </button>

        <div className="pos-header-location">
          <AppIcon name="warehouse" size={15} />
          {locations.length > 0 ? (
            <SelectField
              id="pos-warehouse-select"
              value={userContext.locationId}
              disabled={locationsLoading}
              aria-label="Sede de venta"
              size="sm"
              onChange={onLocationChange}
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </SelectField>
          ) : (
            <span>{userContext.locationName}</span>
          )}
        </div>

        {cashSessionLoading ? (
          <span className="pos-header-cash is-loading">Verificando caja…</span>
        ) : cashSession ? (
          <span className="pos-header-cash is-open" title={`${cashSession.registerName} abierta`}>
            <i aria-hidden="true" />
            {cashSession.registerCode || cashSession.registerName}
          </span>
        ) : (
          <Link href="/cajas" className="pos-header-cash is-closed" title="Solo transferencias hasta abrir la caja">
            <AppIcon name="lock" size={13} />
            <span>Caja cerrada · Abrir</span>
          </Link>
        )}
      </div>

      <div className="pos-header-group">
        <span className="pos-header-clock pos-header-hide-md" aria-label="Hora actual">
          <AppIcon name="clock" size={14} />
          {time}
        </span>

        <button type="button" onClick={openCustomerDisplayWindow} className="pos-header-button" title="Abrir la pantalla que ve el cliente">
          <AppIcon name="laptop" size={15} />
          <span className="pos-header-hide-md">Pantalla cliente</span>
        </button>

        <button type="button" onClick={onOpenDailySales} className="pos-header-button" title="Ventas del turno (F9)">
          <AppIcon name="sales" size={15} />
          <span className="pos-header-hide-md">Mis ventas</span>
        </button>

        <button
          type="button"
          onClick={onToggleFullscreen}
          className="pos-header-icon"
          aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
        >
          <AppIcon name="dashboard" size={16} />
        </button>

        <div className="pos-header-user">
          <span className="pos-header-avatar" aria-hidden="true">
            {initials || 'CJ'}
          </span>
          <span className="pos-header-user-text pos-header-hide-lg">
            <strong>{userContext.userName}</strong>
            <small>{userContext.userRole}</small>
          </span>
        </div>

        <button type="button" onClick={exit} className="pos-header-icon" aria-label="Salir del POS" title="Salir del POS">
          <AppIcon name="logout" size={16} />
        </button>
      </div>
    </header>
  )
}
