'use client'

/**
 * SUPER MÁS ERP/POS - Contenedor Principal Catálogo Distribuidora
 *
 * Integra estadísticas con count-up, barra de filtros reactiva,
 * tabla paginada con selección múltiple para acciones masivas,
 * drawer de configuración comercial y modal de vista previa pública.
 */

import React, { useState } from 'react'
import { useDistributorCatalog } from '../hooks/useDistributorCatalog'
import { useDistributorCatalogPermissions } from '../hooks/useDistributorCatalogPermissions'
import { DistributorCatalogProduct, BulkActionType } from '../types'
import { DistributorCatalogHeader } from './DistributorCatalogHeader'
import { DistributorCatalogStats } from './DistributorCatalogStats'
import { DistributorCatalogFilters } from './DistributorCatalogFilters'
import { DistributorCatalogTable } from './DistributorCatalogTable'
import { DistributorCatalogToast } from './DistributorCatalogToast'
import { DistributorProductDetailDrawer } from './drawers/DistributorProductDetailDrawer'
import { DistributorProductPreviewModal } from './drawers/DistributorProductPreviewModal'
import { DistributorBulkActionModal } from './modals/DistributorBulkActionModal'
import { DistributorDirectPurchaseConfigModal } from './modals/DistributorDirectPurchaseConfigModal'

export function DistributorCatalogPage() {
  const permissions = useDistributorCatalogPermissions('SUPERADMIN')

  const {
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
    refresh,
  } = useDistributorCatalog()

  // Estados de Modales y Drawers
  const [detailProduct, setDetailProduct] = useState<DistributorCatalogProduct | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const [previewProduct, setPreviewProduct] = useState<DistributorCatalogProduct | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  const [bulkAction, setBulkAction] = useState<BulkActionType | null>(null)
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)

  const [purchaseConfigProduct, setPurchaseConfigProduct] = useState<DistributorCatalogProduct | null>(null)
  const [isPurchaseConfigModalOpen, setIsPurchaseConfigModalOpen] = useState(false)

  // Acciones UI
  const handleOpenDetail = (product: DistributorCatalogProduct) => {
    setDetailProduct(product)
    setIsDetailOpen(true)
  }

  const handleOpenPreview = (product?: DistributorCatalogProduct) => {
    setPreviewProduct(product || null)
    setIsPreviewOpen(true)
  }

  const handleOpenBulkAction = (action: BulkActionType) => {
    setBulkAction(action)
    setIsBulkModalOpen(true)
  }

  const handleOpenConfigurePurchase = (product: DistributorCatalogProduct) => {
    setPurchaseConfigProduct(product)
    setIsPurchaseConfigModalOpen(true)
  }

  const handleResetFilters = () => {
    setFilters({
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
  }

  return (
    <div className="distributor-catalog-page space-y-6">
      {/* Toast Notification */}
      <DistributorCatalogToast feedback={feedback} onClose={() => {}} />

      {/* Header con Semántica H1 y Acciones */}
      <DistributorCatalogHeader
        onRefresh={refresh}
        onOpenPreview={() => handleOpenPreview()}
        onExport={exportToCsv}
        canExport={permissions.canExport}
        canPreview={permissions.canPreview}
        isRefreshing={actionLoading}
      />

      {/* Métricas KPI Animadas */}
      <DistributorCatalogStats stats={stats} loading={statsLoading} />

      {/* Filtros Reactivos y Acciones Masivas */}
      <DistributorCatalogFilters
        filters={filters}
        categories={categories}
        brands={brands}
        selectedCount={selectedIds.length}
        onSearchChange={handleSearchChange}
        onFilterChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        onReset={handleResetFilters}
        onOpenBulkAction={handleOpenBulkAction}
        onClearSelection={clearSelection}
        canBulkUpdate={permissions.canBulkUpdate}
      />

      {/* Tabla Principal */}
      <DistributorCatalogTable
        products={products}
        loading={loading}
        error={error}
        selectedIds={selectedIds}
        page={filters.page || 1}
        totalPages={totalPages}
        total={total}
        onPageChange={(p) => setFilters((prev) => ({ ...prev, page: p }))}
        onToggleSelect={toggleSelectProduct}
        onToggleSelectAll={toggleSelectAllCurrentPage}
        onViewDetail={handleOpenDetail}
        onOpenPreview={handleOpenPreview}
        onPublish={(p) => publishProduct(p.id)}
        onHide={(p) => hideProduct(p.id)}
        onConfigurePurchase={handleOpenConfigurePurchase}
        canPublish={permissions.canPublish}
        canUpdate={permissions.canUpdate}
        canPreview={permissions.canPreview}
      />

      {/* Drawer de Configuración Detallada */}
      <DistributorProductDetailDrawer
        isOpen={isDetailOpen}
        product={detailProduct}
        onClose={() => setIsDetailOpen(false)}
        onSaveConfig={async (id, config) => {
          const updated = await updateProductConfig(id, config)
          setDetailProduct(updated)
        }}
        onOpenPreview={handleOpenPreview}
        canUpdate={permissions.canUpdate}
      />

      {/* Modal de Vista Previa Cliente Distribuidor */}
      <DistributorProductPreviewModal
        isOpen={isPreviewOpen}
        product={previewProduct}
        catalogProducts={products}
        onClose={() => setIsPreviewOpen(false)}
      />

      {/* Modal de Confirmación de Acción Masiva */}
      <DistributorBulkActionModal
        isOpen={isBulkModalOpen}
        action={bulkAction}
        selectedCount={selectedIds.length}
        onClose={() => setIsBulkModalOpen(false)}
        onConfirm={executeBulkAction}
      />

      {/* Modal de Configuración Rápida de Compra Web */}
      <DistributorDirectPurchaseConfigModal
        isOpen={isPurchaseConfigModalOpen}
        product={purchaseConfigProduct}
        onClose={() => setIsPurchaseConfigModalOpen(false)}
        onSave={async (id, config) => {
          await updateProductConfig(id, config)
        }}
      />
    </div>
  )
}
