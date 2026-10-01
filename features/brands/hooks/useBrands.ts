'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BrandWithRelations,
  BrandFilters,
  BrandStats,
} from '../types'
import { brandService } from '../services/brand.service'
import { BrandFormData } from '../schemas/brand.schema'

export function useBrands(initialFilters?: Partial<BrandFilters>) {
  const [brands, setBrands] = useState<BrandWithRelations[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [stats, setStats] = useState<BrandStats>({
    totalBrands: 0,
    activeBrands: 0,
    inactiveBrands: 0,
    brandsWithProducts: 0,
  })

  const [filters, setFilters] = useState<BrandFilters>({
    query: '',
    status: 'ALL',
    sortBy: 'NAME_ASC',
    page: 1,
    pageSize: 50,
    ...initialFilters,
  })

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const [listResult, statsResult] = await Promise.all([
        brandService.listBrands(filters),
        brandService.getStats(),
      ])
      setBrands(listResult.data)
      setTotalCount(listResult.total)
      setStats(statsResult)
    } catch (err: any) {
      console.error('Error al cargar marcas:', err)
      setError(err?.message || 'Error al cargar marcas desde la base de datos.')
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadData()
  }, [loadData])

  const createBrand = async (data: BrandFormData) => {
    const created = await brandService.createBrand(data)
    await loadData()
    return created
  }

  const updateBrand = async (id: string, data: Partial<BrandFormData>) => {
    const updated = await brandService.updateBrand(id, data)
    await loadData()
    return updated
  }

  const toggleActive = async (id: string, isActive: boolean) => {
    const updated = await brandService.toggleBrandActive(id, isActive)
    await loadData()
    return updated
  }

  const deleteBrand = async (id: string) => {
    await brandService.deleteBrand(id)
    await loadData()
  }

  return {
    brands,
    totalCount,
    stats,
    filters,
    setFilters,
    isLoading,
    error,
    reload: loadData,
    createBrand,
    updateBrand,
    toggleActive,
    deleteBrand,
  }
}
