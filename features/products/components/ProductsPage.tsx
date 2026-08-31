'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Product,
  ProductFilterParams,
  GlobalProductsStats,
  ProductColumnVisibility,
  ProductSortField,
  CreateProductInput,
  UpdateProductInput,
  UserPermissionContext,
} from '../types'
import { productService } from '../services/product.service'
import { ProductHeader } from './ProductHeader'
import { ProductStats } from './ProductStats'
import { ProductFilters } from './ProductFilters'
import { ProductTable } from './ProductTable'
import { ProductGrid } from './ProductGrid'
import { ProductColumnSelector } from './ProductColumnSelector'
import { ProductFormDrawer } from './ProductFormDrawer'
import { ProductDetailDrawer } from './ProductDetailDrawer'
import { ProductDeactivateDialog } from './ProductDeactivateDialog'
import { ProductImportModal } from './ProductImportModal'
import { ProductExportModal } from './ProductExportModal'
import { ProductSkeleton } from './ProductSkeleton'
import { ProductEmptyState } from './ProductEmptyState'
import { ProductErrorState } from './ProductErrorState'
import { ProductToastContainer, ToastMessage } from './ProductToast'

const DEFAULT_COLUMN_VISIBILITY: ProductColumnVisibility = {
  image: true,
  sku: true,
  barcode: true,
  name: true,
  category: true,
  brand: true,
  stock: true,
  status: true,
  cost: true,
  normalPrice: true,
  wholesalePrice: true,
  margin: true,
  webSuperMas: true,
  webDistribuidora: true,
  actions: true,
}

interface ProductsPageProps {
  onNavigate?: (view: string) => void
  userContext?: UserPermissionContext
}

export function ProductsPage({ onNavigate, userContext }: ProductsPageProps) {
  // View mode
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')

  // Filter & Pagination state
  const [filters, setFilters] = useState<ProductFilterParams>({
    query: '',
    category: 'ALL',
    brand: 'ALL',
    status: 'ALL',
    stockHealth: 'ALL',
    webChannel: 'ALL',
    page: 1,
    pageSize: 10,
    sortField: 'name',
    sortDirection: 'asc',
  })

  // Column visibility
  const [columnVisibility, setColumnVisibility] =
    useState<ProductColumnVisibility>(DEFAULT_COLUMN_VISIBILITY)
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false)

  // Data states
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isCostRedacted, setIsCostRedacted] = useState(false)
  const [stats, setStats] = useState<GlobalProductsStats>({
    totalProducts: 0,
    activeProducts: 0,
    outOfStockProducts: 0,
    lowStockProducts: 0,
    totalInventoryValueAtCost: 0,
    webPublishedProducts: 0,
    isCostRedacted: false,
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modals and Drawers
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [formDrawer, setFormDrawer] = useState<{
    isOpen: boolean
    mode: 'create' | 'edit'
    product: Product | null
  }>({
    isOpen: false,
    mode: 'create',
    product: null,
  })

  const [deactivateDialog, setDeactivateDialog] = useState<{
    isOpen: boolean
    product: Product | null
  }>({
    isOpen: false,
    product: null,
  })

  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)

  // Toast Notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const showToast = useCallback(
    (title: string, message: string, type: 'success' | 'error' | 'info' = 'success') => {
      const id = `toast-${Date.now()}`
      setToasts((prev) => [...prev, { id, title, message, type }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 4500)
    },
    []
  )

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  // Fetch Data Function
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [productsRes, statsRes] = await Promise.all([
        productService.listProducts(filters, userContext),
        productService.getGlobalStats(userContext),
      ])

      setProducts(productsRes.items)
      setTotal(productsRes.total)
      setTotalPages(productsRes.totalPages)
      setIsCostRedacted(productsRes.isCostRedacted)
      setStats(statsRes)
    } catch (err: any) {
      setError(err.message || 'Error al cargar productos')
    } finally {
      setLoading(false)
    }
  }, [filters, userContext])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filter change handler
  const handleFilterChange = (key: keyof ProductFilterParams, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? value : 1, // Reset to page 1 on filter changes
    }))
  }

  // Reset all filters
  const handleResetFilters = () => {
    setFilters({
      query: '',
      category: 'ALL',
      brand: 'ALL',
      status: 'ALL',
      stockHealth: 'ALL',
      webChannel: 'ALL',
      page: 1,
      pageSize: filters.pageSize || 10,
      sortField: 'name',
      sortDirection: 'asc',
    })
    showToast('Filtros restablecidos', 'Se muestran todos los productos del catálogo.', 'info')
  }

  // Column visibility toggle
  const handleColumnToggle = (key: keyof ProductColumnVisibility) => {
    setColumnVisibility((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Sort handler
  const handleSort = (field: ProductSortField) => {
    setFilters((prev) => ({
      ...prev,
      sortField: field,
      sortDirection:
        prev.sortField === field && prev.sortDirection === 'asc' ? 'desc' : 'asc',
    }))
  }

  // Create Product handler
  const handleCreateProduct = async (data: CreateProductInput | UpdateProductInput) => {
    try {
      const created = await productService.createProduct(
        data as CreateProductInput,
        userContext
      )
      showToast(
        'Producto creado con éxito',
        `Se registró "${created.name}" (SKU: ${created.sku}) correctamente.`,
        'success'
      )
      loadData()
    } catch (err: any) {
      showToast('Error al crear producto', err.message || 'No se pudo crear el producto', 'error')
      throw err
    }
  }

  // Edit Product handler
  const handleUpdateProduct = async (data: CreateProductInput | UpdateProductInput) => {
    if (!formDrawer.product) return

    try {
      const updated = await productService.updateProduct(
        formDrawer.product.id,
        data,
        userContext
      )
      showToast(
        'Producto actualizado',
        `Se guardaron los cambios para "${updated.name}".`,
        'success'
      )
      if (selectedProduct?.id === updated.id) {
        setSelectedProduct(updated)
      }
      loadData()
    } catch (err: any) {
      showToast('Error al actualizar', err.message || 'No se pudo actualizar el producto', 'error')
      throw err
    }
  }

  // Deactivate Product handler
  const handleDeactivateProduct = async (id: string, reason: string) => {
    try {
      const deactivated = await productService.deactivateProduct(
        id,
        reason,
        userContext
      )
      showToast(
        'Producto desactivado',
        `"${deactivated.name}" fue marcado como inactivo de forma segura.`,
        'info'
      )
      if (selectedProduct?.id === id) {
        setSelectedProduct(deactivated)
      }
      loadData()
    } catch (err: any) {
      showToast('Error al desactivar', err.message || 'No se pudo desactivar el producto', 'error')
      throw err
    }
  }

  // Navigation callbacks
  const handleViewKardex = (product: Product) => {
    if (onNavigate) {
      onNavigate('Kardex')
    } else {
      showToast('Kardex', `Navegando a trazabilidad de "${product.name}"...`, 'info')
    }
  }

  const handleTransfer = (product: Product) => {
    if (onNavigate) {
      onNavigate('Transferencias')
    } else {
      showToast('Transferencia', `Iniciando transferencia de "${product.name}"...`, 'info')
    }
  }

  const handleAdjustStock = (product: Product) => {
    showToast(
      'Ajuste de Inventario',
      `Para ajustar el stock de "${product.name}", dirígete al módulo de Bodegas correspondiente.`,
      'info'
    )
  }

  const hasActiveFilters = Boolean(
    filters.query?.trim() ||
      (filters.category && filters.category !== 'ALL') ||
      (filters.brand && filters.brand !== 'ALL') ||
      (filters.status && filters.status !== 'ALL') ||
      (filters.stockHealth && filters.stockHealth !== 'ALL') ||
      (filters.webChannel && filters.webChannel !== 'ALL')
  )

  return (
    <div className="products-module-wrapper">
      {/* Toast Notifications */}
      <ProductToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header with Title and Actions */}
      <ProductHeader
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onNewProduct={() =>
          setFormDrawer({ isOpen: true, mode: 'create', product: null })
        }
        onImport={() => setIsImportModalOpen(true)}
        onExport={() => setIsExportModalOpen(true)}
      />

      {/* Global Statistics Cards */}
      <ProductStats stats={stats} />

      {/* Filters and Search Bar */}
      <div style={{ position: 'relative' }}>
        <ProductFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onResetFilters={handleResetFilters}
          onToggleColumnSelector={() =>
            setIsColumnSelectorOpen(!isColumnSelectorOpen)
          }
          isColumnSelectorOpen={isColumnSelectorOpen}
        />

        {/* Column Selector Popover */}
        <ProductColumnSelector
          isOpen={isColumnSelectorOpen}
          onClose={() => setIsColumnSelectorOpen(false)}
          visibility={columnVisibility}
          onChange={handleColumnToggle}
          onReset={() => setColumnVisibility(DEFAULT_COLUMN_VISIBILITY)}
        />
      </div>

      {/* Content Area (Skeleton, Error, Empty or Main Table/Grid) */}
      {loading ? (
        <ProductSkeleton />
      ) : error ? (
        <ProductErrorState message={error} onRetry={loadData} />
      ) : products.length === 0 ? (
        <ProductEmptyState
          hasFilters={hasActiveFilters}
          onResetFilters={handleResetFilters}
          onNewProduct={() =>
            setFormDrawer({ isOpen: true, mode: 'create', product: null })
          }
        />
      ) : viewMode === 'table' ? (
        <ProductTable
          products={products}
          total={total}
          page={filters.page || 1}
          pageSize={filters.pageSize || 10}
          totalPages={totalPages}
          isCostRedacted={isCostRedacted}
          sortField={filters.sortField}
          sortDirection={filters.sortDirection}
          visibility={columnVisibility}
          userContext={userContext}
          onSort={handleSort}
          onPageChange={(page) => handleFilterChange('page', page)}
          onPageSizeChange={(size) => handleFilterChange('pageSize', size)}
          onSelectProduct={(p) => setSelectedProduct(p)}
          onEditProduct={(p) =>
            setFormDrawer({ isOpen: true, mode: 'edit', product: p })
          }
          onDeactivateProduct={(p) =>
            setDeactivateDialog({ isOpen: true, product: p })
          }
          onViewKardex={handleViewKardex}
          onTransferProduct={handleTransfer}
          onAdjustStock={handleAdjustStock}
        />
      ) : (
        <ProductGrid
          products={products}
          isCostRedacted={isCostRedacted}
          onSelectProduct={(p) => setSelectedProduct(p)}
          onEditProduct={(p) =>
            setFormDrawer({ isOpen: true, mode: 'edit', product: p })
          }
        />
      )}

      {/* Unified Create / Edit Form Drawer */}
      <ProductFormDrawer
        isOpen={formDrawer.isOpen}
        mode={formDrawer.mode}
        initialProduct={formDrawer.product}
        onClose={() =>
          setFormDrawer({ isOpen: false, mode: 'create', product: null })
        }
        onSubmit={
          formDrawer.mode === 'create' ? handleCreateProduct : handleUpdateProduct
        }
      />

      {/* Product Detail Drawer */}
      <ProductDetailDrawer
        product={selectedProduct}
        isOpen={Boolean(selectedProduct)}
        isCostRedacted={isCostRedacted}
        userContext={userContext}
        onClose={() => setSelectedProduct(null)}
        onEdit={(p) => {
          setSelectedProduct(null)
          setFormDrawer({ isOpen: true, mode: 'edit', product: p })
        }}
        onViewKardex={handleViewKardex}
        onTransfer={handleTransfer}
        onAdjustStock={handleAdjustStock}
      />

      {/* Soft Delete Deactivation Dialog */}
      <ProductDeactivateDialog
        product={deactivateDialog.product}
        isOpen={deactivateDialog.isOpen}
        onClose={() => setDeactivateDialog({ isOpen: false, product: null })}
        onConfirm={handleDeactivateProduct}
      />

      {/* Import Modal */}
      <ProductImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={(count) => {
          showToast('Importación completada', `Se importaron ${count} productos correctamente.`, 'success')
          loadData()
        }}
      />

      {/* Export Modal */}
      <ProductExportModal
        isOpen={isExportModalOpen}
        products={products}
        isCostRedacted={isCostRedacted}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  )
}
