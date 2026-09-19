'use client'

import React, { useCallback } from 'react'
import { useSuperCatalog } from '../hooks/useSuperCatalog'
import { useSuperCatalogPermissions } from '../hooks/useSuperCatalogPermissions'
import { SuperCatalogHeader } from './SuperCatalogHeader'
import { SuperCatalogStatsSection } from './SuperCatalogStats'
import { SuperCatalogFiltersBar } from './SuperCatalogFilters'
import { SuperCatalogTable } from './SuperCatalogTable'
import { SuperProductDetailDrawer } from './drawers/SuperProductDetailDrawer'
import { SuperProductPreviewModal } from './drawers/SuperProductPreviewModal'
import { SuperBulkActionModal } from './modals/SuperBulkActionModal'
import { SuperProductPriceModal } from './modals/SuperProductPriceModal'
import { SuperProductImagesModal } from './modals/SuperProductImagesModal'
import { SuperCatalogToast } from './SuperCatalogToast'
import { SuperCatalogProduct, SuperBulkActionType } from '../types'

export function SuperCatalogPage() {
  const permissions = useSuperCatalogPermissions('SUPERADMIN')
  const {
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
    page,
    totalPages,
    total,
    selectedIds,
    toggleSelectProduct,
    toggleSelectAllCurrentPage,
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
    toasts,
    removeToast,
    publishProduct,
    hideProduct,
    updateProductConfig,
    updatePrice,
    updateImages,
    executeBulkAction,
    exportCsv,
    handleSimulateAddToCart,
    refresh,
  } = useSuperCatalog('SUPERADMIN')

  const handleOpenDetail = useCallback(
    (product: SuperCatalogProduct) => {
      setDetailProduct(product)
      setIsDetailOpen(true)
    },
    [setDetailProduct, setIsDetailOpen]
  )

  const handleOpenPreview = useCallback(
    (product: SuperCatalogProduct) => {
      setPreviewProduct(product)
      setIsPreviewOpen(true)
    },
    [setPreviewProduct, setIsPreviewOpen]
  )

  const handleOpenGeneralPreview = useCallback(() => {
    const pub = products.find((p) => p.webSuperMas) || products[0]
    if (pub) {
      handleOpenPreview(pub)
    }
  }, [products, handleOpenPreview])

  const handleOpenPriceModal = useCallback(
    (product: SuperCatalogProduct) => {
      setPriceProduct(product)
      setIsPriceOpen(true)
    },
    [setPriceProduct, setIsPriceOpen]
  )

  const handleOpenImagesModal = useCallback(
    (product: SuperCatalogProduct) => {
      setImagesProduct(product)
      setIsImagesOpen(true)
    },
    [setImagesProduct, setIsImagesOpen]
  )

  const handleOpenBulkModal = useCallback(
    (action: SuperBulkActionType) => {
      setBulkActionType(action)
      setIsBulkActionOpen(true)
    },
    [setBulkActionType, setIsBulkActionOpen]
  )

  return (
    <div className="super-catalog-page space-y-6">
      {/* Notificaciones flotantes */}
      <SuperCatalogToast toasts={toasts} onRemove={removeToast} />

      {/* Encabezado semántico con H1 y acciones */}
      <SuperCatalogHeader
        onRefresh={refresh}
        onExport={exportCsv}
        canExport={permissions.canExport}
      />

      {/* Dashboard KPI animado */}
      <SuperCatalogStatsSection stats={stats} loading={statsLoading} />

      {/* Barra de filtros */}
      <SuperCatalogFiltersBar
        filters={filters}
        setFilters={setFilters}
        searchInput={searchInput}
        onSearchChange={handleSearchChange}
        categories={categories}
        brands={brands}
      />

      {/* Tabla principal */}
      <SuperCatalogTable
        products={products}
        loading={loading}
        error={error}
        selectedIds={selectedIds}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={(p) => setFilters((prev) => ({ ...prev, page: p }))}
        onToggleSelect={toggleSelectProduct}
        onToggleSelectAll={toggleSelectAllCurrentPage}
        onViewDetail={handleOpenDetail}
        onEditPrice={handleOpenPriceModal}
        onManageImages={handleOpenImagesModal}
        onOpenPreview={handleOpenPreview}
        onPublish={publishProduct}
        onHide={hideProduct}
        onOpenBulkModal={handleOpenBulkModal}
        canPublish={permissions.canPublish}
        canPrice={permissions.canPrice}
        canImages={permissions.canImages}
        canUpdate={permissions.canUpdate}
      />

      {/* Drawer de Configuración Técnica */}
      <SuperProductDetailDrawer
        isOpen={isDetailOpen}
        product={detailProduct}
        taxConfigs={taxConfigs}
        onClose={() => setIsDetailOpen(false)}
        onSaveConfig={async (id, config) => {
          const updated = await updateProductConfig(id, config)
          setDetailProduct(updated)
        }}
        onOpenPreview={handleOpenPreview}
        canUpdate={permissions.canUpdate}
      />

      {/* Modal de Vista Previa Cliente Ecommerce B2C */}
      <SuperProductPreviewModal
        isOpen={isPreviewOpen}
        product={previewProduct}
        onClose={() => setIsPreviewOpen(false)}
        onAddToCart={handleSimulateAddToCart}
      />

      {/* Modal de Acciones Masivas */}
      <SuperBulkActionModal
        isOpen={isBulkActionOpen}
        actionType={bulkActionType}
        selectedCount={selectedIds.length}
        onClose={() => setIsBulkActionOpen(false)}
        onConfirm={async (action) => {
          await executeBulkAction(action)
        }}
      />

      {/* Modal de Edición Rápida de Precios */}
      <SuperProductPriceModal
        isOpen={isPriceOpen}
        product={priceProduct}
        taxConfigs={taxConfigs}
        onClose={() => setIsPriceOpen(false)}
        onSavePrice={async (id, price, showPrice, taxConfigId) => {
          const updated = await updatePrice(id, price, showPrice, taxConfigId)
          setPriceProduct(updated)
        }}
      />

      {/* Modal de Gestión de Galería Fotográfica */}
      <SuperProductImagesModal
        isOpen={isImagesOpen}
        product={imagesProduct}
        onClose={() => setIsImagesOpen(false)}
        onSaveImages={async (id, imageUrl, images) => {
          const updated = await updateImages(id, imageUrl, images)
          setImagesProduct(updated)
        }}
      />
    </div>
  )
}
