'use client'

import { useCallback, useEffect, useState } from 'react'
import { productService } from '../services/product.service'
import { PriceChangeRequest, PriceChangeRequestFilters } from '../types'

interface UsePriceChangeRequestsResult {
  requests: PriceChangeRequest[]
  isLoading: boolean
  error: string | null
  reload: () => Promise<void>
}

/**
 * Carga solicitudes de cambio de precio bajo RLS. `filters` debe ser estable (memoizado)
 * o `null` mientras no se conozca el usuario.
 */
export function usePriceChangeRequests(filters: PriceChangeRequestFilters | null): UsePriceChangeRequestsResult {
  const [requests, setRequests] = useState<PriceChangeRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!filters) return
    setIsLoading(true)
    setError(null)
    try {
      setRequests(await productService.getPriceChangeRequests(filters))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las solicitudes de precio.')
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  useEffect(() => {
    reload()
  }, [reload])

  return { requests, isLoading, error, reload }
}
