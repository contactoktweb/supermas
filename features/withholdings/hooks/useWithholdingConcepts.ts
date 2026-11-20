'use client'

import { useEffect, useState } from 'react'
import { withholdingRepository } from '../repositories/withholding.repository'
import type { WithholdingConcept, WithholdingSide } from '../types'

/** Conceptos activos que aplican a un lado (compras o ventas). */
export function useWithholdingConcepts(side: WithholdingSide) {
  const [concepts, setConcepts] = useState<WithholdingConcept[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setIsLoading(true)
    withholdingRepository
      .listConcepts({ side, onlyActive: true })
      .then((rows) => {
        if (!active) return
        setConcepts(rows)
        setError(null)
      })
      .catch((e: unknown) => active && setError(e instanceof Error ? e.message : 'No se pudieron cargar las retenciones.'))
      .finally(() => active && setIsLoading(false))
    return () => {
      active = false
    }
  }, [side])

  return { concepts, isLoading, error }
}
