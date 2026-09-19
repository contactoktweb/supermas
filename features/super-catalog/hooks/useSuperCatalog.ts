'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  SuperCatalogProduct,
  SuperCatalogFilters,
  SuperCatalogStats,
  ProductWebConfigUpdate,
  SuperBulkActionType,
} from '../types'
import { superCatalogService } from '../services/super-catalog.service'

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'info'
  text: string
}

export function useSuperCatalog(userRole: string = 'SUPERADMIN') {
  const [products, setProducts] = useState<SuperCatalogProduct[]>([])
  const [stats, setStats] = useState<SuperCatalogStats | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [taxConfigs, setTaxConfigs] = useState<any[]>([])

  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros y paginación
  const [filters, setFilters] = useState<SuperCatalogFilters>({
    search: '',
    category: 'ALL',
    brand: 'ALL',
    availability: 'ALL',
    catalogStatus: 'ALL',
    purchaseStatus: 'ALL',
    sortBy: 'name',
    sortOrder: 'asc',
    page: 1,
    pageSize: 10,
  })

  const [searchInput, setSearchInput] = useState('')
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Selección múltiple
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Modales y Drawers
  const [detailProduct, setDetailProduct] = useState<SuperCatalogProduct | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const [previewProduct, setPreviewProduct] = useState<SuperCatalogProduct | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  const [priceProduct, setPriceProduct] = useState<SuperCatalogProduct | null>(null)
  const [isPriceOpen, setIsPriceOpen] = useState(false)

  const [imagesProduct, setImagesProduct] = useState<SuperCatalogProduct | null>(null)
  const [isImagesOpen, setIsImagesOpen] = useState(false)

  const [isBulkActionOpen, setIsBulkActionOpen] = useState(false)
  const [bulkActionType, setBulkActionType] = useState<SuperBulkActionType>('PUBLISH')

  // Toast feedback
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, type, text }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Cargar metadatos iniciales (categorías, marcas, impuestos)
  useEffect(() => {
    async function loadMetadata() {
      try {
        const [cats, brs, taxes] = await Promise.all([
          superCatalogService.getCategories(),
          superCatalogService.getBrands(),
          superCatalogService.getTaxConfigs(),
        ])
        setCategories(cats)
        setBrands(brs)
        setTaxConfigs(taxes)
      } catch (err: any) {
        console.error('Error cargando metadatos:', err)
      }
    }
    loadMetadata()
  }, [])

  // Cargar estadísticas
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true)
      const data = await superCatalogService.getStats()
      setStats(data)
    } catch (err: any) {
      console.error('Error cargando estadísticas:', err)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Debounce para búsqueda
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const handleSearchChange = (val: string) => {
    setSearchInput(val)
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: val, page: 1 }))
    }, 350)
  }

  // Cargar productos
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await superCatalogService.getProducts(filters)
      setProducts(result.products)
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } catch (err: any) {
      setError(err.message || 'Error al cargar productos del catálogo.')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  // Selección de productos
  const toggleSelectProduct = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }, [])

  const toggleSelectAllCurrentPage = useCallback(() => {
    const pageIds = products.map((p) => p.id)
    const allSelected = pageIds.every((id) => selectedIds.includes(id))

    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])))
    }
  }, [products, selectedIds])

  const clearSelection = useCallback(() => {
    setSelectedIds([])
  }, [])

  // Operaciones
  const publishProduct = useCallback(
    async (productId: string) => {
      try {
        await superCatalogService.publishProduct(productId)
        addToast('success', 'Producto publicado en la tienda online.')
        await Promise.all([fetchProducts(), fetchStats()])
      } catch (err: any) {
        addToast('error', err.message || 'No se pudo publicar el producto.')
      }
    },
    [fetchProducts, fetchStats, addToast]
  )

  const hideProduct = useCallback(
    async (productId: string) => {
      try {
        await superCatalogService.hideProduct(productId)
        addToast('info', 'Producto ocultado de la tienda online.')
        await Promise.all([fetchProducts(), fetchStats()])
      } catch (err: any) {
        addToast('error', err.message || 'No se pudo ocultar el producto.')
      }
    },
    [fetchProducts, fetchStats, addToast]
  )

  const updateProductConfig = useCallback(
    async (productId: string, config: ProductWebConfigUpdate) => {
      try {
        const updated = await superCatalogService.updateProductConfig(productId, config)
        addToast('success', 'Configuración web actualizada exitosamente.')
        await Promise.all([fetchProducts(), fetchStats()])
        return updated
      } catch (err: any) {
        addToast('error', err.message || 'Error al actualizar configuración.')
        throw err
      }
    },
    [fetchProducts, fetchStats, addToast]
  )

  const updatePrice = useCallback(
    async (productId: string, price: number, showPrice: boolean, taxConfigId: string) => {
      try {
        const updated = await superCatalogService.updatePrice(productId, price, showPrice, taxConfigId)
        addToast('success', `Precio actualizado a $${price.toLocaleString('es-CO')}`)
        await Promise.all([fetchProducts(), fetchStats()])
        return updated
      } catch (err: any) {
        addToast('error', err.message || 'Error al modificar precio.')
        throw err
      }
    },
    [fetchProducts, fetchStats, addToast]
  )

  const updateImages = useCallback(
    async (productId: string, imageUrl?: string, images: string[] = []) => {
      try {
        const updated = await superCatalogService.updateImages(productId, imageUrl, images)
        addToast('success', 'Galería de imágenes actualizada correctamente.')
        await fetchProducts()
        return updated
      } catch (err: any) {
        addToast('error', err.message || 'Error al actualizar imágenes.')
        throw err
      }
    },
    [fetchProducts, addToast]
  )

  const executeBulkAction = useCallback(
    async (action: SuperBulkActionType) => {
      if (selectedIds.length === 0) return

      try {
        const result = await superCatalogService.bulkUpdate(selectedIds, action)
        addToast(
          'success',
          `Acción masiva aplicada a ${result.updatedCount} productos.`
        )
        clearSelection()
        setIsBulkActionOpen(false)
        await Promise.all([fetchProducts(), fetchStats()])
      } catch (err: any) {
        addToast('error', err.message || 'Error en la acción en lote.')
      }
    },
    [selectedIds, clearSelection, fetchProducts, fetchStats, addToast]
  )

  const exportCsv = useCallback(async () => {
    try {
      const csv = await superCatalogService.exportToCsv(filters)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `catalogo_supermas_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      addToast('success', 'Catálogo exportado exitosamente.')
    } catch (err: any) {
      addToast('error', err.message || 'Error al exportar catálogo.')
    }
  }, [filters, addToast])

  const handleSimulateAddToCart = useCallback(
    async (productId: string, qty: number = 1) => {
      try {
        const res = await superCatalogService.simulateAddToCart(productId, qty)
        if (res.success) {
          addToast('success', res.message)
        } else {
          addToast('error', res.message)
        }
        return res
      } catch (err: any) {
        addToast('error', err.message || 'Error al agregar al carrito.')
        return { success: false, message: err.message }
      }
    },
    [addToast]
  )

  return {
    products,
    stats,
    categories,
    brands,
    taxConfigs,
    loading,
    statsLoading,
    error,
    filters,
    setFilters,
    searchInput,
    handleSearchChange,
    page: filters.page || 1,
    totalPages,
    total,
    selectedIds,
    toggleSelectProduct,
    toggleSelectAllCurrentPage,
    clearSelection,
    // Modales y Drawers
    detailProduct,
    setDetailProduct,
    isDetailOpen,
    setIsDetailOpen,
    previewProduct,
    setPreviewProduct,
    isPreviewOpen,
    setIsPreviewOpen,
    priceProduct,
    setPriceProduct,
    isPriceOpen,
    setIsPriceOpen,
    imagesProduct,
    setImagesProduct,
    isImagesOpen,
    setIsImagesOpen,
    isBulkActionOpen,
    setIsBulkActionOpen,
    bulkActionType,
    setBulkActionType,
    // Toasts
    toasts,
    removeToast,
    // Acciones
    publishProduct,
    hideProduct,
    updateProductConfig,
    updatePrice,
    updateImages,
    executeBulkAction,
    exportCsv,
    handleSimulateAddToCart,
    refresh: async () => {
      await Promise.all([fetchProducts(), fetchStats()])
    },
  }
}
