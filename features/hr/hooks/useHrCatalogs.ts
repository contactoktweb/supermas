'use client'

import { useCallback, useMemo } from 'react'
import { hrOrgService, type HrCatalogs } from '../services/hr-org.service'
import { useHrQuery } from './useHrQuery'

const EMPTY_CATALOGS: HrCatalogs = { areas: [], positions: [], locations: [] }

/** Áreas, cargos y sedes de la empresa para formularios y filtros. */
export function useHrCatalogs(enabled: boolean = true) {
  const loader = useCallback(() => hrOrgService.getCatalogs(), [])
  const query = useHrQuery(loader, enabled)

  const catalogs = query.data ?? EMPTY_CATALOGS
  const options = useMemo(
    () => ({
      areas: catalogs.areas.map((a) => ({ value: a.id, label: a.name, badge: a.isActive ? undefined : 'Inactiva' })),
      activeAreas: catalogs.areas.filter((a) => a.isActive).map((a) => ({ value: a.id, label: a.name })),
      positions: catalogs.positions.map((p) => ({ value: p.id, label: p.name, badge: p.isActive ? undefined : 'Inactivo' })),
      activePositions: catalogs.positions
        .filter((p) => p.isActive)
        .map((p) => ({ value: p.id, label: p.name, description: p.areaName ?? undefined })),
      locations: catalogs.locations.map((l) => ({ value: l.id, label: l.name })),
    }),
    [catalogs]
  )

  return { ...query, catalogs, options }
}
