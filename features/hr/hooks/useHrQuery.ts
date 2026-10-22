'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { extractErrorMessage } from '@/lib/utils'

export interface HrQueryState<T> {
  data: T | null
  isLoading: boolean
  error: string | null
  reload: () => Promise<void>
}

/**
 * Carga asíncrona con estados de carga/error y descarte de respuestas obsoletas.
 * `loader` debe ser estable (useCallback) y cambia cuando cambian sus dependencias.
 */
export function useHrQuery<T>(loader: () => Promise<T>, enabled: boolean = true): HrQueryState<T> {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const reload = useCallback(async () => {
    if (!enabled) return
    const current = ++requestId.current
    setIsLoading(true)
    setError(null)
    try {
      const result = await loader()
      if (current === requestId.current) setData(result)
    } catch (err) {
      if (current === requestId.current) setError(extractErrorMessage(err, 'No se pudo cargar la información.'))
    } finally {
      if (current === requestId.current) setIsLoading(false)
    }
  }, [loader, enabled])

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false)
      return
    }
    void reload()
  }, [reload, enabled])

  return { data, isLoading, error, reload }
}
