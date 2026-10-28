'use client'

import { useEffect, useState } from 'react'
import { alertNotificationService } from '../services/alert-notification.service'

const REFRESH_INTERVAL_MS = 60_000

/** Cantidad de alertas sin leer, actualizada cada minuto. */
export function useUnreadAlertsCount(enabled: boolean): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let active = true
    const load = () =>
      alertNotificationService
        .getUnreadCount()
        .then((value) => {
          if (active) setCount(value)
        })
        .catch(() => {
          // El contador es informativo; si falla se conserva el último valor.
        })
    load()
    const interval = setInterval(load, REFRESH_INTERVAL_MS)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [enabled])

  return enabled ? count : 0
}
