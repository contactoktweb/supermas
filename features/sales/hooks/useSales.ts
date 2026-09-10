'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { salesService } from '../services/sales.service'
import {
  Sale,
  SaleFilterParams,
  SaleStats,
  CreateSaleDTO,
  CancelSaleDTO,
  CreateInvoiceFromSaleDTO,
  CreateRemissionFromSaleDTO,
} from '../types'

export function useSales(initialFilters: SaleFilterParams = {}) {
  const [items, setItems] = useState<Sale[]>([])
  const [stats, setStats] = useState<SaleStats | null>(null)
  const [filters, setFilters] = useState<SaleFilterParams>({
    page: 1,
    pageSize: 10,
    sortBy: 'date',
    sortDirection: 'desc',
    status: 'ALL',
    paymentMethod: 'ALL',
    documentType: 'ALL',
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
      const data = await salesService.getSalesStats()
      if (isMountedRef.current) {
        setStats(data)
      }
    } catch (err: unknown) {
      console.error('Error al cargar estadísticas de ventas:', err)
    } finally {
      if (isMountedRef.current) {
        setStatsLoading(false)
      }
    }
  }, [])

  const fetchSales = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await salesService.list(filters)
      if (isMountedRef.current) {
        setItems(res.items)
        setTotal(res.total)
        setTotalPages(res.totalPages)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar ventas'
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
    fetchSales()
    return () => {
      isMountedRef.current = false
    }
  }, [fetchSales])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const setFilter = (key: keyof SaleFilterParams, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? value : 1, // Reset page on filter changes
    }))
  }

  const resetFilters = () => {
    setFilters({
      page: 1,
      pageSize: 10,
      sortBy: 'date',
      sortDirection: 'desc',
      status: 'ALL',
      paymentMethod: 'ALL',
      documentType: 'ALL',
    })
  }

  const createSale = async (dto: CreateSaleDTO): Promise<Sale> => {
    const created = await salesService.create(dto)
    await fetchSales()
    await fetchStats()
    return created
  }

  const cancelSale = async (dto: CancelSaleDTO): Promise<Sale> => {
    const cancelled = await salesService.cancelSale(dto)
    await fetchSales()
    await fetchStats()
    return cancelled
  }

  const generateInvoice = async (dto: CreateInvoiceFromSaleDTO): Promise<Sale> => {
    const updated = await salesService.generateInvoiceForSale(dto)
    await fetchSales()
    await fetchStats()
    return updated
  }

  const generateRemission = async (dto: CreateRemissionFromSaleDTO): Promise<Sale> => {
    const updated = await salesService.generateRemissionForSale(dto)
    await fetchSales()
    return updated
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
    refresh: fetchSales,
    refreshStats: fetchStats,
    createSale,
    cancelSale,
    generateInvoice,
    generateRemission,
  }
}
