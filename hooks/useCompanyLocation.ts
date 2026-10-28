'use client'

import { useEffect, useState } from 'react'
import { getAuthenticatedCompany } from '@/lib/supabase/tenant'

export interface CompanyLocation {
  city: string
  department: string
}

const EMPTY_LOCATION: CompanyLocation = { city: '', department: '' }

let cachedRequest: Promise<CompanyLocation> | null = null

function loadCompanyLocation(): Promise<CompanyLocation> {
  cachedRequest ??= getAuthenticatedCompany()
    .then((company: any) => ({ city: company?.city || '', department: company?.department || '' }))
    .catch(() => {
      cachedRequest = null
      return EMPTY_LOCATION
    })
  return cachedRequest
}

/** Ciudad y departamento de la empresa, usados como valores por defecto en formularios nuevos. */
export function useCompanyLocation(): CompanyLocation {
  const [location, setLocation] = useState<CompanyLocation>(EMPTY_LOCATION)

  useEffect(() => {
    let active = true
    loadCompanyLocation().then((loaded) => {
      if (active) setLocation(loaded)
    })
    return () => {
      active = false
    }
  }, [])

  return location
}
