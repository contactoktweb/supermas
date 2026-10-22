'use client'

import { useEffect, useState } from 'react'
import { accountingService } from '../services/accounting.service'

export interface AccountingLocationOption {
  id: string
  name: string
}

/** Sedes activas para los filtros de los reportes contables (una sola consulta compartida). */
export function useAccountingLocations(): AccountingLocationOption[] {
  const [locations, setLocations] = useState<AccountingLocationOption[]>([])

  useEffect(() => {
    let isActive = true
    accountingService
      .getActiveLocations()
      .then((data) => {
        if (isActive) setLocations(data)
      })
      .catch(() => undefined)
    return () => {
      isActive = false
    }
  }, [])

  return locations
}
