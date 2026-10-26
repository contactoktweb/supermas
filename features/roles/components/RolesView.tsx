'use client'

import React, { useEffect, useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { RolesConsultationView } from '@/features/settings/components/views/RolesConsultationView'
import { settingsRepository } from '@/features/settings/repositories/settings.repository'
import type { RoleSummary } from '@/features/settings/types'

export function RolesView() {
  const [rolesList, setRolesList] = useState<RoleSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    settingsRepository
      .getRoles()
      .then((roles) => {
        if (active) setRolesList(roles)
      })
      .catch(() => {
        if (active) setLoadError('No se pudieron cargar los roles. Intente de nuevo.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="products-module-wrapper page-enter">
      <PageHeader
        eyebrow="Administración"
        title="Roles y permisos"
        subtitle="Qué puede hacer cada rol del ERP Super Más."
      />

      {isLoading ? (
        <p className="text-sm text-slate-500" role="status">
          Cargando roles…
        </p>
      ) : loadError ? (
        <p className="text-sm text-red-700" role="alert">
          {loadError}
        </p>
      ) : (
        <RolesConsultationView roles={rolesList} />
      )}
    </div>
  )
}
