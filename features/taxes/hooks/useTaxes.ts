'use client'

import { useState, useEffect, useCallback } from 'react'
import { taxService } from '../services/tax.service'
import { TaxConfig, TaxFilters, TaxStats } from '../types'
import { TaxConfigFormData } from '../schemas/tax.schema'
import { UserRoleType } from './useTaxPermissions'

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
      const [listRes, statsRes] = await Promise.all([
        taxService.list(filters, userRole),
        taxService.getTaxStats(userRole),
      ])
      setTaxes(listRes.data)
      setTotal(listRes.total)
      setStats(statsRes)
    } catch (err: any) {
      setError(err.message || 'Error al cargar las configuraciones tributarias.')
    } finally {
      setIsLoading(false)
    }
  }, [filters, userRole])

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

  const createTax = async (data: TaxConfigFormData, user = { id: 'usr-admin', name: 'Admin Mauricio' }) => {
    const created = await taxService.createTaxConfig(data, user, userRole)
    await loadData()
    return created
  }

  const updateTax = async (
    id: string,
    data: Partial<TaxConfigFormData>,
    user = { id: 'usr-admin', name: 'Admin Mauricio' }
  ) => {
    const updated = await taxService.updateTaxConfig(id, data, user, userRole)
    await loadData()
    return updated
  }

  const deactivateTax = async (
    id: string,
    reason: string,
    user = { id: 'usr-admin', name: 'Admin Mauricio' }
  ) => {
    const deactivated = await taxService.deactivateTaxConfig(id, reason, user, userRole)
    await loadData()
    return deactivated
  }

  const activateTax = async (
    id: string,
    user = { id: 'usr-admin', name: 'Admin Mauricio' }
  ) => {
    const activated = await taxService.activateTaxConfig(id, user, userRole)
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
