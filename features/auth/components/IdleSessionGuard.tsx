'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { getRuntimeSettings } from '@/features/settings/services/runtime-settings'

/** Última actividad compartida entre pestañas: la sesión es una sola para todo el navegador. */
const LAST_ACTIVITY_KEY = 'supermas:last-activity'
const CHECK_INTERVAL_MS = 30_000
const ACTIVITY_THROTTLE_MS = 15_000
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

const readLastActivity = (): number => {
  try {
    return Number(window.localStorage.getItem(LAST_ACTIVITY_KEY)) || Date.now()
  } catch {
    return Date.now()
  }
}

const writeLastActivity = (value: number) => {
  try {
    window.localStorage.setItem(LAST_ACTIVITY_KEY, String(value))
  } catch {
    // Almacenamiento bloqueado: el control sigue funcionando dentro de esta pestaña.
  }
}

/**
 * Cierra la sesión tras el tiempo de inactividad de Configuración → Seguridad
 * (security.session.timeout_minutes). Sin interfaz propia.
 */
export function IdleSessionGuard() {
  const { user, signOut } = useAuth()
  const lastLocalActivity = useRef(Date.now())

  useEffect(() => {
    if (!user) return
    let timeoutMs = 0
    let lastWrite = 0
    let closing = false
    lastLocalActivity.current = Date.now()
    writeLastActivity(lastLocalActivity.current)

    getRuntimeSettings().then((settings) => {
      timeoutMs = settings.sessionTimeoutMinutes * 60_000
    })

    const markActivity = () => {
      const now = Date.now()
      lastLocalActivity.current = now
      if (now - lastWrite > ACTIVITY_THROTTLE_MS) {
        lastWrite = now
        writeLastActivity(now)
      }
    }

    const check = async () => {
      if (closing || timeoutMs <= 0) return
      const lastActivity = Math.max(lastLocalActivity.current, readLastActivity())
      if (Date.now() - lastActivity < timeoutMs) return
      closing = true
      await signOut()
      window.location.assign('/login?motivo=inactividad')
    }

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, markActivity, { passive: true }))
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    const interval = window.setInterval(() => void check(), CHECK_INTERVAL_MS)

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, markActivity))
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(interval)
    }
  }, [user, signOut])

  return null
}
