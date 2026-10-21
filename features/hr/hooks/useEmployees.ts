'use client'

import { useCallback, useState } from 'react'
import { hrEmployeeService } from '../services/hr-employee.service'
import { useHrQuery } from './useHrQuery'
import type { EmployeeFilters } from '../types'

export const DEFAULT_EMPLOYEE_FILTERS: EmployeeFilters = {
  query: '',
  status: 'VIGENTES',
  areaId: '',
  positionId: '',
  locationId: '',
  contractType: 'ALL',
}

/** Listado paginado de empleados con filtros (búsqueda, estado, área, cargo, sede, contrato). */
export function useEmployees(enabled: boolean) {
  const [filters, setFilters] = useState<EmployeeFilters>(DEFAULT_EMPLOYEE_FILTERS)
  const [page, setPage] = useState(1)

  const loader = useCallback(() => hrEmployeeService.list(filters, page), [filters, page])
  const query = useHrQuery(loader, enabled)

  const updateFilters = useCallback((patch: Partial<EmployeeFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }))
    setPage(1)
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_EMPLOYEE_FILTERS)
    setPage(1)
  }, [])

  return {
    employees: query.data?.data ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    reload: query.reload,
    filters,
    updateFilters,
    resetFilters,
    page,
    setPage,
  }
}
