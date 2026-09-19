'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface AlertsHeaderProps {
  onScan: () => void
  onMarkAllAsRead: () => void
  onOpenRules: () => void
  isScanning: boolean
  unreadCount: number
}

export function AlertsHeader({
  onScan,
  onMarkAllAsRead,
  onOpenRules,
  isScanning,
  unreadCount,
}: AlertsHeaderProps) {
  return (
    <header className="page-heading page-enter">
      <div>
        <div className="flex items-center gap-2">
          <span className="eyebrow">Centro de Supervisión y Monitoreo</span>
          {unreadCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              {unreadCount} sin leer
            </span>
          )}
        </div>
        <h1>Alertas</h1>
        <p className="welcome-subtitle">
          Supervisa eventos importantes y situaciones que requieren atención dentro del sistema.
        </p>
      </div>

      <div className="heading-actions flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onScan}
          disabled={isScanning}
          className="outline-button"
          title="Escanea las bases de datos del ERP ejecutando las reglas automáticas activas"
        >
          <AppIcon name="refresh" size={15} className={isScanning ? 'animate-spin text-blue-600' : 'text-slate-500'} />
          <span>{isScanning ? 'Escaneando...' : 'Escanear Sistema'}</span>
        </button>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllAsRead}
            className="outline-button"
            title="Marcar todas las alertas no leídas como leídas"
          >
            <AppIcon name="check" size={15} className="text-emerald-600" />
            <span>Marcar todas leídas</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenRules}
          className="primary-button"
          title="Configurar y ajustar umbrales de reglas de monitoreo"
        >
          <AppIcon name="settings" size={15} />
          <span>Configurar Reglas</span>
        </button>
      </div>
    </header>
  )
}
