'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CategoryWithRelations,
  CategoryFilters,
  CategoryStats,
} from '../types'
import { categoryService } from '../services/category.service'
import { CategoryFormData } from '../schemas/category.schema'

export function useCategories(initialFilters?: Partial<CategoryFilters>) {
  const [categories, setCategories] = useState<CategoryWithRelations[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [stats, setStats] = useState<CategoryStats>({
    totalCategories: 0,
    activeCategories: 0,
    inactiveCategories: 0,
    rootCategories: 0,
    subcategories: 0,
  })

  const [filters, setFilters] = useState<CategoryFilters>({
    query: '',
    status: 'ALL',
    parentId: 'ALL',
    sortBy: 'SORT_ORDER_ASC',
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
        categoryService.listCategories(filters),
        categoryService.getStats(),
      ])
      setCategories(listResult.data)
      setTotalCount(listResult.total)
      setStats(statsResult)
    } catch (err: any) {
      console.error('Error al cargar categorías:', err)
      setError(err?.message || 'Error al cargar categorías desde la base de datos.')
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadData()
  }, [loadData])

  const createCategory = async (data: CategoryFormData) => {
    const created = await categoryService.createCategory(data)
    await loadData()
    return created
  }

  const updateCategory = async (id: string, data: Partial<CategoryFormData>) => {
    const updated = await categoryService.updateCategory(id, data)
    await loadData()
    return updated
  }

  const toggleActive = async (id: string, isActive: boolean) => {
    const updated = await categoryService.toggleCategoryActive(id, isActive)
    await loadData()
    return updated
  }

  const deleteCategory = async (id: string) => {
    await categoryService.deleteCategory(id)
    await loadData()
  }

  return {
    categories,
    totalCount,
    stats,
    filters,
    setFilters,
    isLoading,
    error,
    reload: loadData,
    createCategory,
    updateCategory,
    toggleActive,
    deleteCategory,
  }
}
