'use client'

/**
 * SUPER MÁS ERP/POS - Hook Principal de Catálogo Distribuidora
 *
 * Encapsula la gestión de productos de catálogo, selección múltiple para
 * operaciones masivas, filtros con debounce, paginación y mutaciones.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { distributorCatalogService } from '../services/distributor-catalog.service'
import {
  DistributorCatalogProduct,
  DistributorCatalogFilters,
  DistributorCatalogStats,
  ProductCatalogConfigUpdate,
  BulkActionType,
} from '../types'

export function useDistributorCatalog() {
  const [products, setProducts] = useState<DistributorCatalogProduct[]>([])
  const [stats, setStats] = useState<DistributorCatalogStats | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [brands, setBrands] = useState<string[]>([])

  const [loading, setLoading] = useState<boolean>(true)
  const [statsLoading, setStatsLoading] = useState<boolean>(true)
  const [actionLoading, setActionLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Selección múltiple
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Filtros reactivos
  const [filters, setFilters] = useState<DistributorCatalogFilters>({
    search: '',
    category: 'ALL',
    brand: 'ALL',
    availability: 'ALL',
    distributorStatus: 'ALL',
    superMasStatus: 'ALL',
    directPurchase: 'ALL',
    sortBy: 'name',
    sortOrder: 'asc',
    page: 1,
    pageSize: 10,
  })

  const [total, setTotal] = useState<number>(0)
  const [totalPages, setTotalPages] = useState<number>(1)

  // Referencia para debounce de búsqueda
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')

  const handleSearchChange = (term: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(term)
      setFilters((prev) => ({ ...prev, page: 1 }))
    }, 300)
  }

  const showToast = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => {
      setFeedback(null)
    }, 4500)
  }

  // Carga de categorías y marcas
  useEffect(() => {
    Promise.all([
      distributorCatalogService.getCategories(),
      distributorCatalogService.getBrands(),
    ]).then(([cats, brs]) => {
      setCategories(cats)
      setBrands(brs)
    })
  }, [])

  // Carga de estadísticas
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true)
      const data = await distributorCatalogService.getStats()
      setStats(data)
    } catch (err: any) {
      console.error('Error al obtener estadísticas del catálogo:', err)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  // Carga de productos
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await distributorCatalogService.getProducts({
        ...filters,
        search: debouncedSearch,
      })
      setProducts(result.products)
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } catch (err: any) {
      setError(err.message || 'Error al cargar productos del catálogo.')
    } finally {
      setLoading(false)
    }
  }, [filters, debouncedSearch])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Operaciones comerciales individuales
  const publishProduct = async (id: string) => {
    try {
      setActionLoading(true)
      const updated = await distributorCatalogService.publishProduct(id)
      showToast('success', `Producto "${updated.name}" publicado en Catálogo Distribuidora.`)
      await Promise.all([fetchProducts(), fetchStats()])
      return updated
    } catch (err: any) {
      showToast('error', err.message || 'Error al publicar producto.')
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  const hideProduct = async (id: string) => {
    try {
      setActionLoading(true)
      const updated = await distributorCatalogService.hideProduct(id)
      showToast('success', `Producto "${updated.name}" ocultado del Catálogo Distribuidora.`)
      await Promise.all([fetchProducts(), fetchStats()])
      return updated
    } catch (err: any) {
      showToast('error', err.message || 'Error al ocultar producto.')
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  const updateProductConfig = async (id: string, config: ProductCatalogConfigUpdate) => {
    try {
      setActionLoading(true)
      const updated = await distributorCatalogService.updateProductConfig(id, config)
      showToast('success', `Configuración comercial de "${updated.name}" actualizada.`)
      await Promise.all([fetchProducts(), fetchStats()])
      return updated
    } catch (err: any) {
      showToast('error', err.message || 'Error al actualizar configuración.')
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  // Operaciones masivas
  const executeBulkAction = async (action: BulkActionType) => {
    if (selectedIds.length === 0) {
      showToast('error', 'No hay productos seleccionados.')
      return
    }

    try {
      setActionLoading(true)
      const result = await distributorCatalogService.bulkUpdate(selectedIds, action)
      showToast('success', `Operación aplicada exitosamente a ${result.updatedCount} productos.`)
      setSelectedIds([])
      await Promise.all([fetchProducts(), fetchStats()])
      return result
    } catch (err: any) {
      showToast('error', err.message || 'Error al ejecutar acción masiva.')
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  // Manejo de selección
  const toggleSelectProduct = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const toggleSelectAllCurrentPage = () => {
    const currentIds = products.map((p) => p.id)
    const allSelected = currentIds.every((id) => selectedIds.includes(id))

    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !currentIds.includes(id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...currentIds])))
    }
  }

  const clearSelection = () => setSelectedIds([])

  // Exportar a CSV
  const exportToCsv = async () => {
    try {
      setActionLoading(true)
      const csv = await distributorCatalogService.exportToCsv(filters)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute(
        'download',
        `catalogo_distribuidora_supermas_${new Date().toISOString().slice(0, 10)}.csv`
      )
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      showToast('success', 'Catálogo exportado exitosamente a CSV.')
    } catch (err: any) {
      showToast('error', err.message || 'Error al exportar catálogo.')
    } finally {
      setActionLoading(false)
    }
  }

  return {
    products,
    stats,
    categories,
    brands,
    loading,
    statsLoading,
    actionLoading,
    error,
    feedback,
    filters,
    total,
    totalPages,
    selectedIds,
    setFilters,
    handleSearchChange,
    publishProduct,
    hideProduct,
    updateProductConfig,
    executeBulkAction,
    toggleSelectProduct,
    toggleSelectAllCurrentPage,
    clearSelection,
    exportToCsv,
    refresh: () => Promise.all([fetchProducts(), fetchStats()]),
  }
}
