'use client'

import { useEffect, useState } from 'react'
import { accountingService } from '../services/accounting.service'
import { AccountingAccount, AccountingCompanyHeader } from '../types'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

/**
 * Catálogo PUC completo (no la página visible del Plan de Cuentas) para selectores de rango y
 * reportes. Sale de la caché del repositorio: abrir varios modales no repite la consulta.
 */
export function useAccountingCatalog(enabled = true, userRole = 'SUPERADMIN') {
  const [accounts, setAccounts] = useState<AccountingAccount[]>([])
  const [state, setState] = useState<LoadState>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    let isActive = true
    setState('loading')
    accountingService
      .getAllAccounts(userRole)
      .then((data) => {
        if (!isActive) return
        setAccounts(data)
        setState('ready')
        setError(null)
      })
      .catch((err: unknown) => {
        if (!isActive) return
        setState('error')
        setError(err instanceof Error ? err.message : 'No se pudo cargar el Plan de Cuentas.')
      })
    return () => {
      isActive = false
    }
  }, [enabled, userRole])

  return { accounts, state, error }
}

/** Razón social, NIT y DV de la empresa del usuario para encabezados de reportes. */
export function useAccountingCompanyHeader(enabled = true, userRole = 'SUPERADMIN') {
  const [company, setCompany] = useState<AccountingCompanyHeader | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    let isActive = true
    accountingService
      .getCompanyHeader(userRole)
      .then((data) => {
        if (isActive) {
          setCompany(data)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (isActive) setError(err instanceof Error ? err.message : 'No se pudieron consultar los datos de la empresa.')
      })
    return () => {
      isActive = false
    }
  }, [enabled, userRole])

  return { company, error }
}
