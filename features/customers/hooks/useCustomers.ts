'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { customerService } from '../services/customer.service'
import {
  Customer,
  CustomerFilterParams,
  CustomerStats,
  CreateCustomerDTO,
  UpdateCustomerDTO,
} from '../types'

export function useCustomers(initialFilters: CustomerFilterParams = {}) {
  const [items, setItems] = useState<Customer[]>([])
  const [stats, setStats] = useState<CustomerStats | null>(null)
  const [filters, setFilters] = useState<CustomerFilterParams>({
    page: 1,
    pageSize: 10,
    sortBy: 'displayName',
    sortDirection: 'asc',
    status: 'ALL',
    customerType: 'ALL',
    category: 'ALL',
    priceList: 'ALL',
    ...initialFilters,
  })
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isMountedRef = useRef(true)

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true)
      const data = await customerService.getCustomerStats()
      if (isMountedRef.current) {
        setStats(data)
      }
    } catch (err: unknown) {
      console.error('Error al cargar estadísticas de clientes:', err)
    } finally {
      if (isMountedRef.current) {
        setStatsLoading(false)
      }
    }
  }, [])

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await customerService.list(filters)
      if (isMountedRef.current) {
        setItems(res.items)
        setTotal(res.total)
        setTotalPages(res.totalPages)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar clientes'
      if (isMountedRef.current) {
        setError(msg)
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [filters])

  useEffect(() => {
    isMountedRef.current = true
    fetchCustomers()
    return () => {
      isMountedRef.current = false
    }
  }, [fetchCustomers])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const setFilter = useCallback((key: keyof CustomerFilterParams, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? value : 1, // Reset to page 1 unless paging
    }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters({
      query: '',
      documentNumber: '',
      customerType: 'ALL',
      category: 'ALL',
      city: 'ALL',
      status: 'ALL',
      priceList: 'ALL',
      hasPurchases: undefined,
      hasBalance: undefined,
      startDate: undefined,
      endDate: undefined,
      page: 1,
      pageSize: 10,
      sortBy: 'displayName',
      sortDirection: 'asc',
    })
  }, [])

  const createCustomer = async (dto: CreateCustomerDTO): Promise<Customer> => {
    const created = await customerService.create(dto)
    await fetchCustomers()
    await fetchStats()
    return created
  }

  const updateCustomer = async (id: string, dto: UpdateCustomerDTO): Promise<Customer> => {
    const updated = await customerService.update(id, dto)
    await fetchCustomers()
    await fetchStats()
    return updated
  }

  const deactivateCustomer = async (id: string, reason?: string): Promise<Customer> => {
    const deactivated = await customerService.deactivate(id, reason)
    await fetchCustomers()
    await fetchStats()
    return deactivated
  }

  const reactivateCustomer = async (id: string): Promise<Customer> => {
    const reactivated = await customerService.reactivate(id)
    await fetchCustomers()
    await fetchStats()
    return reactivated
  }

  return {
    items,
    stats,
    filters,
    total,
    page: filters.page || 1,
    pageSize: filters.pageSize || 10,
    totalPages,
    loading,
    statsLoading,
    error,
    setFilter,
    resetFilters,
    refresh: fetchCustomers,
    refreshStats: fetchStats,
    createCustomer,
    updateCustomer,
    deactivateCustomer,
    reactivateCustomer,
  }
}
