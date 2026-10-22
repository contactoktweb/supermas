'use client'

import { useEffect, useState } from 'react'
import { DEFAULT_RUNTIME_SETTINGS, getRuntimeSettings, type RuntimeSettings } from '../services/runtime-settings'

/** Parámetros de Configuración General para componentes de cliente; inicia con los valores por defecto. */
export function useRuntimeSettings(): { settings: RuntimeSettings; isLoaded: boolean } {
  const [settings, setSettings] = useState<RuntimeSettings>(DEFAULT_RUNTIME_SETTINGS)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    let active = true
    getRuntimeSettings()
      .then((value) => {
        if (active) setSettings(value)
      })
      .finally(() => {
        if (active) setIsLoaded(true)
      })
    return () => {
      active = false
    }
  }, [])

  return { settings, isLoaded }
}
