'use client'

import React, { useState, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { POSUserContext } from '../types'

interface POSHeaderProps {
  userContext?: POSUserContext
  locationName?: string
  cashierName?: string
  cashRegisterNumber?: string
  onOpenDailySales: () => void
  onToggleFullscreen?: () => void
  isFullscreen?: boolean
  onExit?: () => void
  onExitPOS?: () => void
}

export function POSHeader({
  userContext,
  locationName,
  cashierName,
  cashRegisterNumber,
  onOpenDailySales,
  onToggleFullscreen,
  isFullscreen,
  onExit,
  onExitPOS,
}: POSHeaderProps) {
  const [timeStr, setTimeStr] = useState<string>('')

  const activeLocation = locationName || userContext?.locationName || 'Punto de Venta Centro'
  const activeCashier = cashierName || userContext?.userName || 'Cajero Operativo'
  const activeRole = userContext?.userRole || 'Cajero'
  const activeRegister = cashRegisterNumber || userContext?.cashRegisterNumber || 'CAJA-01'
  const handleExit = onExit || onExitPOS

  const handleReturnToAdmin = () => {
    if (handleExit) {
      handleExit()
    } else {
      if (typeof window !== 'undefined') {
        window.location.href = '/'
      }
    }
  }

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTimeStr(
        now.toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      )
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  const handleFullscreen = () => {
    if (onToggleFullscreen) {
      onToggleFullscreen()
      return
    }
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }

  return (
    <header
      style={{
        height: 56,
        background: 'var(--navy)',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
        flexShrink: 0,
      }}
    >
      {/* Left: Brand & Location & Quick Return */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/super-mas-logo.svg"
            alt="Super Más"
            style={{ height: 26, filter: 'brightness(0) invert(1)' }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.08em',
              background: 'var(--red)',
              color: '#ffffff',
              padding: '2px 6px',
              borderRadius: 4,
              textTransform: 'uppercase',
            }}
          >
            POS Terminal
          </span>
        </div>

        {/* Botón Principal: Regresar al Panel Administrativo */}
        <button
          type="button"
          onClick={handleReturnToAdmin}
          className="outline-button"
          style={{
            height: 32,
            fontSize: 11,
            fontWeight: 700,
            gap: 6,
            background: 'rgba(255, 255, 255, 0.12)',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: 6,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px',
            transition: 'all 0.15s ease',
          }}
          title="Regresar al panel administrativo del ERP"
        >
          <AppIcon name="chevronLeft" size={14} color="#38bdf8" />
          <span>Regresar al Panel</span>
        </button>

        <div
          style={{
            height: 18,
            width: 1,
            background: 'rgba(255, 255, 255, 0.2)',
          }}
        />

        {/* Location & Cash Register */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255, 255, 255, 0.1)',
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <AppIcon name="warehouse" size={14} color="#93c5fd" />
            <span>{activeLocation}</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'rgba(34, 197, 94, 0.2)',
              border: '1px solid rgba(34, 197, 94, 0.4)',
              color: '#4ade80',
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#4ade80',
                boxShadow: '0 0 8px #4ade80',
              }}
            />
            <span>{activeRegister}</span>
          </div>
        </div>
      </div>

      {/* Center: Live Clock */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: 'monospace',
          fontSize: 14,
          fontWeight: 700,
          background: 'rgba(0, 0, 0, 0.25)',
          padding: '4px 12px',
          borderRadius: 8,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          color: '#e2e8f0',
        }}
      >
        <AppIcon name="clock" size={14} color="#38bdf8" />
        <span>{timeStr || 'Cargando...'}</span>
      </div>

      {/* Right: Actions & Cashier profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Daily Sales Button */}
        <button
          type="button"
          onClick={onOpenDailySales}
          className="outline-button"
          style={{
            height: 34,
            fontSize: 12,
            gap: 6,
            background: 'rgba(255, 255, 255, 0.08)',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
          title="Ver ventas del turno"
        >
          <AppIcon name="sales" size={14} color="#38bdf8" />
          <span>Mis Ventas del Turno</span>
        </button>

        {/* Fullscreen Button */}
        <button
          type="button"
          onClick={handleFullscreen}
          className="icon-button"
          style={{
            color: '#ffffff',
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            width: 34,
            height: 34,
          }}
          title={isFullscreen ? 'Salir de Pantalla Completa' : 'Pantalla Completa'}
          aria-label="Pantalla completa"
        >
          <AppIcon name="dashboard" size={16} />
        </button>

        {/* Cashier Info */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            paddingLeft: 8,
            borderLeft: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--red)',
              color: '#ffffff',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 800,
              fontSize: 11,
            }}
          >
            {activeCashier.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <strong style={{ fontSize: 12, color: '#ffffff', lineHeight: 1.1 }}>
              {activeCashier}
            </strong>
            <small style={{ fontSize: 10, color: '#94a3b8' }}>
              {activeRole}
            </small>
          </div>
        </div>

        {/* Additional Exit POS / Back button */}
        <button
          type="button"
          onClick={handleReturnToAdmin}
          className="icon-button"
          style={{
            color: '#ffffff',
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            width: 34,
            height: 34,
            marginLeft: 6,
          }}
          title="Salir del POS"
          aria-label="Salir del POS"
        >
          <AppIcon name="logout" size={16} />
        </button>
      </div>
    </header>
  )
}
