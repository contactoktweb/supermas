'use client'

import React, { useState, useCallback } from 'react'
import { BrandWithRelations } from '../types'
import { useBrands } from '../hooks/useBrands'
import { useBrandPermissions } from '../hooks/useBrandPermissions'
import { BrandHeader } from './BrandHeader'
import { BrandStats } from './BrandStats'
import { BrandFilters } from './BrandFilters'
import { BrandTable } from './BrandTable'
import { BrandFormDrawer } from './BrandFormDrawer'
import { BrandDeleteDialog } from './BrandDeleteDialog'
import { BrandToastContainer, BrandToastMessage } from './BrandToast'
import { BrandFormData } from '../schemas/brand.schema'

export function BrandPage() {
  const permissions = useBrandPermissions()
  const {
    brands,
    totalCount,
    stats,
    filters,
    setFilters,
    isLoading,
    error,
    reload,
    createBrand,
    updateBrand,
    toggleActive,
    deleteBrand,
  } = useBrands()

  // Estados de Drawer / Modales
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create')
  const [editingBrand, setEditingBrand] = useState<BrandWithRelations | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const [deletingBrand, setDeletingBrand] = useState<BrandWithRelations | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  // Notificaciones Toast
  const [toasts, setToasts] = useState<BrandToastMessage[]>([])

  const addToast = useCallback(
    (type: 'success' | 'error' | 'info', title: string, description?: string) => {
      setToasts((prev) => [
        ...prev,
        { id: `toast-${Date.now()}-${Math.random()}`, type, title, description },
      ])
    },
    []
  )

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Handlers de UI
  const handleOpenCreate = () => {
    setEditingBrand(null)
    setDrawerMode('create')
    setIsDrawerOpen(true)
  }

  const handleOpenEdit = (brand: BrandWithRelations) => {
    setEditingBrand(brand)
    setDrawerMode('edit')
    setIsDrawerOpen(true)
  }

  const handleOpenDelete = (brand: BrandWithRelations) => {
    setDeletingBrand(brand)
    setIsDeleteOpen(true)
  }

  const handleDrawerSubmit = async (data: BrandFormData) => {
    if (drawerMode === 'create') {
      await createBrand(data)
      addToast('success', 'Marca creada', `La marca "${data.name}" fue registrada correctamente.`)
    } else if (editingBrand) {
      await updateBrand(editingBrand.id, data)
      addToast(
        'success',
        'Marca actualizada',
        `Los cambios en "${data.name}" fueron guardados exitosamente.`
      )
    }
  }

  const handleToggleActive = async (brand: BrandWithRelations) => {
    try {
      const nextActive = !brand.isActive
      await toggleActive(brand.id, nextActive)
      addToast(
        'info',
        nextActive ? 'Marca activada' : 'Marca desactivada',
        `La marca "${brand.name}" ahora está ${nextActive ? 'activa' : 'inactiva'}.`
      )
    } catch (err: any) {
      addToast('error', 'Error al cambiar estado', err?.message)
    }
  }

  const handleConfirmDelete = async (id: string) => {
    try {
      const brandName = deletingBrand?.name || 'Marca'
      await deleteBrand(id)
      addToast('success', 'Marca eliminada', `"${brandName}" fue removida permanentemente.`)
    } catch (err: any) {
      addToast('error', 'Error al eliminar', err?.message)
      throw err
    }
  }

  const handleDeactivateAlternative = async (brand: BrandWithRelations) => {
    try {
      await toggleActive(brand.id, false)
      addToast(
        'info',
        'Marca desactivada',
        `"${brand.name}" fue desactivada para preservar la integridad de los productos asociados.`
      )
    } catch (err: any) {
      addToast('error', 'Error al desactivar', err?.message)
      throw err
    }
  }

  const hasActiveFilters = Boolean(
    filters.query ||
      (filters.status && filters.status !== 'ALL') ||
      (filters.sortBy && filters.sortBy !== 'NAME_ASC')
  )

  const handleResetFilters = () => {
    setFilters({
      query: '',
      status: 'ALL',
      sortBy: 'NAME_ASC',
      page: 1,
      pageSize: 50,
    })
  }

  return (
    <div className="warehouse-page-container">
      <BrandHeader
        totalCount={totalCount}
        canCreate={permissions.canCreate}
        onCreateClick={handleOpenCreate}
        onRefreshClick={reload}
        isLoading={isLoading}
      />

      <BrandStats stats={stats} />

      <BrandFilters
        filters={filters}
        onFilterChange={(newFilters) => setFilters((prev) => ({ ...prev, ...newFilters }))}
        onResetFilters={handleResetFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {error ? (
        <div className="form-error-banner" role="alert" style={{ margin: '16px 0' }}>
          <strong>Error al cargar marcas:</strong> {error}
        </div>
      ) : (
        <BrandTable
          brands={brands}
          permissions={permissions}
          onEdit={handleOpenEdit}
          onToggleActive={handleToggleActive}
          onDelete={handleOpenDelete}
          isLoading={isLoading}
        />
      )}

      {/* Drawer para Crear / Editar */}
      <BrandFormDrawer
        mode={drawerMode}
        brand={editingBrand}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSubmit={handleDrawerSubmit}
      />

      {/* Modal para Confirmar Eliminación / Verificar dependencias */}
      <BrandDeleteDialog
        brand={deletingBrand}
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        onDeactivateAlternative={handleDeactivateAlternative}
      />

      {/* Contenedor de Alertas Toast */}
      <BrandToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  )
}
