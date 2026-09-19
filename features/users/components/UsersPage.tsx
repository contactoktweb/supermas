'use client'

import React, { useState } from 'react'
import { useUsers } from '../hooks/useUsers'
import { useUserPermissions } from '../hooks/useUserPermissions'
import { UsersHeader } from './UsersHeader'
import { UsersStats } from './UsersStats'
import { UsersFilters } from './UsersFilters'
import { UsersTable } from './UsersTable'
import { UserFormDrawer } from './UserFormDrawer'
import { UserDetailDrawer } from './UserDetailDrawer'
import { UserDeactivateDialog } from './UserDeactivateDialog'
import { UsersSkeleton } from './UsersSkeleton'
import { UsersErrorState } from './UsersErrorState'
import { UserToastContainer, UserToastMessage } from './UsersToast'
import { UserRole } from '../types'

interface UsersPageProps {
  currentRole?: UserRole
}

export function UsersPage({ currentRole = 'SUPERADMIN' }: UsersPageProps) {
  const permissions = useUserPermissions(currentRole)

  const {
    users,
    stats,
    locations,
    filters,
    isLoading,
    error,
    selectedUser,
    isDetailOpen,
    userActivity,
    isLoadingActivity,
    isFormOpen,
    editingUser,
    isDeactivateDialogOpen,
    userToToggleStatus,
    handleUpdateFilter,
    handleResetFilters,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseForm,
    handleSaveUser,
    handleOpenDetail,
    handleCloseDetail,
    handlePromptToggleStatus,
    handleConfirmToggleStatus,
    handleCloseDeactivateDialog,
    handleExportCSV,
    reload,
  } = useUsers(currentRole)

  // Sistema de notificaciones Toast
  const [toasts, setToasts] = useState<UserToastMessage[]>([])

  const showToast = (title: string, description: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToasts((prev) => [...prev, { id: Math.random().toString(), title, description, type }])
  }

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  // Envoltorios con feedback visual
  const onSaveUserWithToast = async (data: any) => {
    try {
      await handleSaveUser(data)
      showToast(
        editingUser ? 'Colaborador actualizado' : 'Colaborador registrado',
        `Los datos de ${data.firstName} ${data.lastName} se guardaron exitosamente.`,
        'success'
      )
    } catch (err: any) {
      showToast('Error al guardar', err.message || 'No se pudo guardar el usuario.', 'error')
      throw err
    }
  }

  const onConfirmToggleStatusWithToast = async (reason?: string) => {
    if (!userToToggleStatus) return
    const userName = userToToggleStatus.name
    const isDeactivating = userToToggleStatus.status === 'ACTIVE'
    try {
      await handleConfirmToggleStatus(reason)
      showToast(
        isDeactivating ? 'Usuario desactivado' : 'Usuario habilitado',
        `El acceso de ${userName} ha sido ${isDeactivating ? 'bloqueado' : 'activado'} en el sistema.`,
        'info'
      )
    } catch (err: any) {
      showToast('Error al cambiar estado', err.message || 'Ocurrió un error inesperado.', 'error')
    }
  }

  const onExportWithToast = async () => {
    try {
      await handleExportCSV()
      showToast('Exportación completada', 'El archivo CSV de colaboradores se descargó correctamente.', 'success')
    } catch (err: any) {
      showToast('Error en exportación', err.message || 'No se pudo exportar la lista de usuarios.', 'error')
    }
  }

  return (
    <div className="page-shell users-module-page">
      {/* Encabezado principal */}
      <UsersHeader
        onRefresh={reload}
        onExport={onExportWithToast}
        onCreateUser={handleOpenCreate}
        canExport={permissions.canExport}
        canCreate={permissions.canCreate}
        isLoading={isLoading}
      />

      {/* Manejo de error global */}
      {error && <UsersErrorState message={error} onRetry={reload} />}

      {/* Estado cargando / skeleton */}
      {isLoading && users.length === 0 ? (
        <UsersSkeleton />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Tarjetas estadísticas de usuarios */}
          <UsersStats
            stats={stats}
            isLoading={isLoading}
            onFilterActive={() => handleUpdateFilter('status', 'ACTIVE')}
            onFilterInactive={() => handleUpdateFilter('status', 'INACTIVE')}
          />

          {/* Barra de filtros */}
          <UsersFilters
            filters={filters}
            locations={locations}
            onUpdateFilter={handleUpdateFilter}
            onResetFilters={handleResetFilters}
            isLoading={isLoading}
          />

          {/* Tabla principal de colaboradores */}
          <UsersTable
            users={users}
            onViewUser={handleOpenDetail}
            onEditUser={handleOpenEdit}
            onToggleStatus={handlePromptToggleStatus}
            onViewActivity={handleOpenDetail}
            canUpdate={permissions.canUpdate}
            canActivate={permissions.canActivate}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Drawer para Crear o Editar */}
      <UserFormDrawer
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSave={onSaveUserWithToast}
        initialData={editingUser}
        locations={locations}
      />

      {/* Drawer para Detalle y Permisos */}
      <UserDetailDrawer
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
        user={selectedUser}
        activity={userActivity}
        isLoadingActivity={isLoadingActivity}
        onEditUser={handleOpenEdit}
        onToggleStatus={handlePromptToggleStatus}
        canUpdate={permissions.canUpdate}
        canActivate={permissions.canActivate}
      />

      {/* Diálogo para Cambiar Estado (Activo / Inactivo) */}
      <UserDeactivateDialog
        isOpen={isDeactivateDialogOpen}
        onClose={handleCloseDeactivateDialog}
        onConfirm={onConfirmToggleStatusWithToast}
        user={userToToggleStatus}
      />

      {/* Contenedor de Alertas Toast */}
      <UserToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
