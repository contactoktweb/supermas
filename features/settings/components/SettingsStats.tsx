'use client'

import React, { useState, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { SettingsStats } from '../types'

interface SettingsStatsProps {
  stats: SettingsStats | null
}

function useCountUp(target: number, duration = 800) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let start = 0
    const end = target
    if (start === end) {
      setCount(end)
      return
    }

    const stepTime = Math.abs(Math.floor(duration / (end || 1)))
    const timer = setInterval(() => {
      start += 1
      setCount(start)
      if (start >= end) {
        clearInterval(timer)
        setCount(end)
      }
    }, Math.max(stepTime, 20))

    return () => clearInterval(timer)
  }, [target, duration])

  return count
}

export function SettingsStatsCards({ stats }: SettingsStatsProps) {
  const totalActive = useCountUp(stats?.totalActiveSettings || 0)
  const totalCritical = useCountUp(stats?.totalCriticalSettings || 0)
  const categoriesCount = useCountUp(stats?.categoriesCount || 16)

  const formatLastModified = (iso?: string) => {
    if (!iso) return 'Hoy'
    try {
      const d = new Date(iso)
      return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return 'Hoy'
    }
  }

  return (
    <section className="stats-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Activas */}
      <article className="stat-card hover:border-slate-700 transition-all duration-300">
        <div className="stat-icon blue">
          <AppIcon name="settings" size={18} />
        </div>
        <div className="stat-text">
          <span>Configuraciones Activas</span>
          <strong>{totalActive}</strong>
          <small className="positive">
            <AppIcon name="check" size={13} />
            En funcionamiento
          </small>
        </div>
      </article>

      {/* 2. Última Modificación */}
      <article className="stat-card hover:border-slate-700 transition-all duration-300">
        <div className="stat-icon teal">
          <AppIcon name="kardex" size={18} />
        </div>
        <div className="stat-text">
          <span>Último Cambio</span>
          <strong className="text-sm sm:text-base truncate">
            {formatLastModified(stats?.lastModifiedAt)}
          </strong>
          <small className="text-slate-400 truncate">
            por {stats?.lastModifiedBy || 'Admin Mauricio'}
          </small>
        </div>
      </article>

      {/* 3. Parámetros Críticos */}
      <article className="stat-card hover:border-rose-900/50 transition-all duration-300">
        <div className="stat-icon red">
          <AppIcon name="warning" size={18} />
        </div>
        <div className="stat-text">
          <span>Parámetros Críticos</span>
          <strong className="text-rose-400">{totalCritical}</strong>
          <small className="warning-text">
            <AppIcon name="alerts" size={13} />
            Requieren confirmación
          </small>
        </div>
      </article>

      {/* 4. Categorías Globales */}
      <article className="stat-card hover:border-slate-700 transition-all duration-300">
        <div className="stat-icon amber">
          <AppIcon name="dashboard" size={18} />
        </div>
        <div className="stat-text">
          <span>Categorías Globales</span>
          <strong>{categoriesCount}</strong>
          <small className="positive">
            <AppIcon name="check" size={13} />
            Módulos integrados
          </small>
        </div>
      </article>
    </section>
  )
}
