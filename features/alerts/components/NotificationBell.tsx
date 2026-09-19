'use client'

import React, { useState, useEffect, useRef } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { alertNotificationService } from '../services/alert-notification.service'
import { AlertItem } from '../types'
import { useRouter } from 'next/navigation'

interface NotificationBellProps {
  onNavigateToAlerts?: () => void
  onSelectAlert?: (alert: AlertItem) => void
}

export function NotificationBell({ onNavigateToAlerts, onSelectAlert }: NotificationBellProps) {
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(0)
  const [recentAlerts, setRecentAlerts] = useState<AlertItem[]>([])
  const [hasCritical, setHasCritical] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  const loadNotifications = async () => {
    try {
      setIsLoading(true)
      const [count, recents, critical] = await Promise.all([
        alertNotificationService.getUnreadCount(),
        alertNotificationService.getRecentAlerts(5),
        alertNotificationService.hasCriticalAlerts(),
      ])
      setUnreadCount(count)
      setRecentAlerts(recents)
      setHasCritical(critical)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
    const interval = setInterval(loadNotifications, 60000)
    return () => clearInterval(interval)
  }, [])

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleOpenAlerts = () => {
    setIsOpen(false)
    if (onNavigateToAlerts) {
      onNavigateToAlerts()
    } else {
      router.push('/alertas')
    }
  }

  const handleAlertClick = (alert: AlertItem) => {
    setIsOpen(false)
    if (onSelectAlert) {
      onSelectAlert(alert)
    } else {
      router.push('/alertas')
    }
  }

  return (
    <div className="relative inline-block text-left" ref={popoverRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen)
          if (!isOpen) loadNotifications()
        }}
        className="notification icon-button relative focus:outline-none"
        aria-label="Centro de notificaciones y alertas"
        title="Centro de notificaciones"
      >
        <AppIcon
          name="alerts"
          size={18}
          className={hasCritical ? 'text-rose-500 animate-bounce' : 'text-slate-600'}
        />

        {unreadCount > 0 && (
          <i
            className={`absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white shadow-xs ${
              hasCritical ? 'bg-rose-600 animate-pulse' : 'bg-red-600'
            }`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </i>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200 shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 origin-top-right">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-slate-800">Notificaciones</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  {unreadCount} pendientes
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleOpenAlerts}
              className="text-[11px] font-bold text-red-600 hover:text-red-700 transition-colors"
            >
              Ver todas
            </button>
          </div>

          {/* List of Recent Alerts */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {isLoading ? (
              <div className="p-6 text-center text-xs text-slate-400 font-medium">Cargando alertas...</div>
            ) : recentAlerts.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
                  <AppIcon name="check" size={18} />
                </div>
                <p className="text-xs text-slate-800 font-bold">Sin alertas pendientes</p>
                <p className="text-[11px] text-slate-500 font-medium">No hay situaciones críticas que requieran atención inmediata.</p>
              </div>
            ) : (
              recentAlerts.map((alt) => {
                const isCrit = alt.priority === 'CRITICA'
                return (
                  <div
                    key={alt.id}
                    onClick={() => handleAlertClick(alt)}
                    className="p-3 hover:bg-slate-50 transition-colors cursor-pointer flex items-start gap-2.5"
                  >
                    <span
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        isCrit ? 'bg-rose-500 animate-ping' : alt.status === 'NEW' ? 'bg-red-500' : 'bg-slate-300'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-[10px] text-slate-500 font-bold">{alt.code}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(alt.createdAt).toLocaleDateString('es-CO', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-800 line-clamp-1 mt-0.5">{alt.title}</p>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 font-normal">{alt.description}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 text-center">
            <button
              type="button"
              onClick={handleOpenAlerts}
              className="w-full py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 transition-colors shadow-2xs"
            >
              Ir al Módulo de Alertas
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
