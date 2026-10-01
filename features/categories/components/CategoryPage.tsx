'use client'

import React, { useState, useCallback } from 'react'
import { CategoryWithRelations } from '../types'
import { useCategories } from '../hooks/useCategories'
import { useCategoryPermissions } from '../hooks/useCategoryPermissions'
import { CategoryHeader } from './CategoryHeader'
import { CategoryStats } from './CategoryStats'
import { CategoryFilters } from './CategoryFilters'
import { CategoryTable } from './CategoryTable'
import { CategoryFormDrawer } from './CategoryFormDrawer'
import { CategoryDeleteDialog } from './CategoryDeleteDialog'
import { CategoryToastContainer, CategoryToastMessage } from './CategoryToast'
import { CategoryFormData } from '../schemas/category.schema'

export function CategoryPage() {
  const permissions = useCategoryPermissions()
  const {
    categories,
    totalCount,
    stats,
    filters,
    setFilters,
    isLoading,
    error,
    reload,
    createCategory,
    updateCategory,
    toggleActive,
    deleteCategory,
  } = useCategories()

  // Estados de Drawer / Modales
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create')
  const [editingCategory, setEditingCategory] = useState<CategoryWithRelations | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const [deletingCategory, setDeletingCategory] = useState<CategoryWithRelations | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  // Notificaciones Toast
  const [toasts, setToasts] = useState<CategoryToastMessage[]>([])

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
    setEditingCategory(null)
    setDrawerMode('create')
    setIsDrawerOpen(true)
  }

  const handleOpenEdit = (category: CategoryWithRelations) => {
    setEditingCategory(category)
    setDrawerMode('edit')
    setIsDrawerOpen(true)
  }

  const handleOpenDelete = (category: CategoryWithRelations) => {
    setDeletingCategory(category)
    setIsDeleteOpen(true)
  }

  const handleDrawerSubmit = async (data: CategoryFormData) => {
    if (drawerMode === 'create') {
      await createCategory(data)
      addToast('success', 'Categoría creada', `La categoría "${data.name}" fue registrada correctamente.`)
    } else if (editingCategory) {
      await updateCategory(editingCategory.id, data)
      addToast(
        'success',
        'Categoría actualizada',
        `Los cambios en "${data.name}" fueron guardados exitosamente.`
      )
    }
  }

  const handleToggleActive = async (category: CategoryWithRelations) => {
    try {
      const nextActive = !category.isActive
      await toggleActive(category.id, nextActive)
      addToast(
        'info',
        nextActive ? 'Categoría activada' : 'Categoría desactivada',
        `La categoría "${category.name}" ahora está ${nextActive ? 'activa' : 'inactiva'}.`
      )
    } catch (err: any) {
      addToast('error', 'Error al cambiar estado', err?.message)
    }
  }

  const handleConfirmDelete = async (id: string) => {
    try {
      const catName = deletingCategory?.name || 'Categoría'
      await deleteCategory(id)
      addToast('success', 'Categoría eliminada', `"${catName}" fue removida permanentemente.`)
    } catch (err: any) {
      addToast('error', 'Error al eliminar', err?.message)
      throw err
    }
  }

  const handleDeactivateAlternative = async (category: CategoryWithRelations) => {
    try {
      await toggleActive(category.id, false)
      addToast(
        'info',
        'Categoría desactivada',
        `"${category.name}" fue desactivada para preservar la integridad de los productos asociados.`
      )
    } catch (err: any) {
      addToast('error', 'Error al desactivar', err?.message)
      throw err
    }
  }

  const hasActiveFilters = Boolean(
    filters.query ||
      (filters.status && filters.status !== 'ALL') ||
      (filters.parentId && filters.parentId !== 'ALL') ||
      (filters.sortBy && filters.sortBy !== 'SORT_ORDER_ASC')
  )

  const handleResetFilters = () => {
    setFilters({
      query: '',
      status: 'ALL',
      parentId: 'ALL',
      sortBy: 'SORT_ORDER_ASC',
      page: 1,
      pageSize: 50,
    })
  }

  return (
    <div className="warehouse-page-container">
      <CategoryHeader
        totalCount={totalCount}
        canCreate={permissions.canCreate}
        onCreateClick={handleOpenCreate}
        onRefreshClick={reload}
        isLoading={isLoading}
      />

      <CategoryStats stats={stats} />

      <CategoryFilters
        filters={filters}
        onFilterChange={(newFilters) => setFilters((prev) => ({ ...prev, ...newFilters }))}
        onResetFilters={handleResetFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {error ? (
        <div className="form-error-banner" role="alert" style={{ margin: '16px 0' }}>
          <strong>Error al cargar categorías:</strong> {error}
        </div>
      ) : (
        <CategoryTable
          categories={categories}
          permissions={permissions}
          onEdit={handleOpenEdit}
          onToggleActive={handleToggleActive}
          onDelete={handleOpenDelete}
          isLoading={isLoading}
        />
      )}

      {/* Drawer para Crear / Editar */}
      <CategoryFormDrawer
        mode={drawerMode}
        category={editingCategory}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSubmit={handleDrawerSubmit}
      />

      {/* Modal para Confirmar Eliminación / Verificar dependencias */}
      <CategoryDeleteDialog
        category={deletingCategory}
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        onDeactivateAlternative={handleDeactivateAlternative}
      />

      {/* Contenedor de Alertas Toast */}
      <CategoryToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  )
}
