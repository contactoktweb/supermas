'use client'

import { useState, useEffect, useCallback } from 'react'
import { taxService } from '../services/tax.service'
import { TaxConfig, TaxFilters, TaxStats } from '../types'
import { TaxConfigFormData } from '../schemas/tax.schema'
import { UserRoleType } from './useTaxPermissions'

import { useAuth } from '@/features/auth'

const DEFAULT_FILTERS: TaxFilters = {
  query: '',
  type: 'ALL',
  status: 'ALL',
  vigencia: 'ALL',
  sortBy: 'RATE_DESC',
  page: 1,
  pageSize: 10,
}

const DEFAULT_STATS: TaxStats = {
  activeConfigsCount: 0,
  taxedProductsCount: 0,
  exemptProductsCount: 0,
  salesWithTaxesCount: 0,
  purchasesWithTaxesCount: 0,
  generatedTaxPeriod: 0,
  deductibleTaxPeriod: 0,
  netTaxPayable: 0,
}

export function useTaxes(userRole: UserRoleType = 'SUPERADMIN') {
  const { user } = useAuth()
  const effectiveUser = {
    id: user?.id || 'usr-system',
    name: user?.fullName || 'Administrador',
  }

  const [filters, setFilters] = useState<TaxFilters>(DEFAULT_FILTERS)
  const [taxes, setTaxes] = useState<TaxConfig[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<TaxStats>(DEFAULT_STATS)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const effectiveFilters: TaxFilters = {
        companyId: user?.companyId || undefined,
        ...filters,
      }
      const [listRes, statsRes] = await Promise.all([
        taxService.list(effectiveFilters, userRole),
        taxService.getTaxStats(userRole, user?.companyId || undefined),
      ])
      setTaxes(listRes.data)
      setTotal(listRes.total)
      setStats(statsRes)
    } catch (err: any) {
      setError(err.message || 'Error al cargar las configuraciones tributarias.')
    } finally {
      setIsLoading(false)
    }
  }, [filters, userRole, user?.companyId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const updateFilters = useCallback((partial: Partial<TaxFilters>) => {
    setFilters((prev) => ({
      ...prev,
      ...partial,
      page: partial.page !== undefined ? partial.page : 1, // Reset a página 1 si cambian otros filtros
    }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
  }, [])

  const createTax = async (data: TaxConfigFormData, actor = effectiveUser) => {
    const created = await taxService.createTaxConfig(data, actor, userRole, user?.companyId || undefined)
    await loadData()
    return created
  }

  const updateTax = async (
    id: string,
    data: Partial<TaxConfigFormData>,
    actor = effectiveUser
  ) => {
    const updated = await taxService.updateTaxConfig(id, data, actor, userRole, user?.companyId || undefined)
    await loadData()
    return updated
  }

  const deactivateTax = async (
    id: string,
    reason: string,
    actor = effectiveUser
  ) => {
    const deactivated = await taxService.deactivateTaxConfig(id, reason, actor, userRole, user?.companyId || undefined)
    await loadData()
    return deactivated
  }

  const activateTax = async (
    id: string,
    actor = effectiveUser
  ) => {
    const activated = await taxService.activateTaxConfig(id, actor, userRole, user?.companyId || undefined)
    await loadData()
    return activated
  }

  const exportCSV = async () => {
    const csvContent = await taxService.exportTaxConfigsToCSV(filters, userRole)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `supermas_impuestos_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return {
    taxes,
    total,
    stats,
    filters,
    isLoading,
    error,
    loadData,
    updateFilters,
    resetFilters,
    createTax,
    updateTax,
    deactivateTax,
    activateTax,
    exportCSV,
  }
}
