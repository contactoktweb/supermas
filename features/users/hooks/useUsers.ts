'use client'

import { useState, useEffect, useCallback } from 'react'
import { userService } from '../services/user.service'
import { User, UserFilters, UserStats, UserRole, UserStatus } from '../types'
import { CreateUserInput, UpdateUserInput } from '../schemas/user.schema'
import { AuditLogEntry } from '@/features/audit/types'

const DEFAULT_STATS: UserStats = {
  totalUsersCount: 0,
  activeUsersCount: 0,
  inactiveUsersCount: 0,
  recentlyConnectedCount: 0,
  usersByRole: {
    SUPERADMIN: 0,
    WAREHOUSE_ADMIN: 0,
    POINT_ADMIN: 0,
    ACCOUNTANT: 0,
    SELLER: 0,
    CASHIER: 0,
  },
}

export function useUsers(userRole: UserRole = 'SUPERADMIN') {
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<UserStats>(DEFAULT_STATS)
  const [locations, setLocations] = useState<Array<{ id: string; code: string; name: string; type: string }>>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [filters, setFilters] = useState<UserFilters>({
    role: 'ALL',
    status: 'ALL',
    locationId: 'ALL',
    searchQuery: '',
  })

  // Drawer de detalle
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false)
  const [userActivity, setUserActivity] = useState<AuditLogEntry[]>([])
  const [isLoadingActivity, setIsLoadingActivity] = useState<boolean>(false)

  // Drawer de formulario (Crear / Editar)
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  // Diálogo de activación / desactivación
  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState<boolean>(false)
  const [userToToggleStatus, setUserToToggleStatus] = useState<User | null>(null)

  // Carga inicial y por cambio de filtros
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const [usersRes, statsRes, locsRes] = await Promise.all([
        userService.list(filters, userRole),
        userService.getUserStats(userRole),
        userService.getLocations(),
      ])
      setUsers(usersRes)
      setStats(statsRes)
      setLocations(locsRes)
    } catch (err: any) {
      setError(err.message || 'Error al cargar los usuarios del sistema.')
    } finally {
      setIsLoading(false)
    }
  }, [filters, userRole])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Actualizar un filtro específico
  const handleUpdateFilter = (key: keyof UserFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  // Restablecer filtros
  const handleResetFilters = () => {
    setFilters({
      role: 'ALL',
      status: 'ALL',
      locationId: 'ALL',
      searchQuery: '',
    })
  }

  // Apertura de Drawer Crear
  const handleOpenCreate = () => {
    setEditingUser(null)
    setIsFormOpen(true)
  }

  // Apertura de Drawer Editar
  const handleOpenEdit = (user: User) => {
    setEditingUser(user)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingUser(null)
  }

  // Guardar usuario (Crear o Editar)
  const handleSaveUser = async (data: CreateUserInput | UpdateUserInput) => {
    const actor = { id: 'usr-001', name: 'Mauricio Andrade', role: 'Superadministrador' }
    if (editingUser) {
      await userService.update(editingUser.id, data as UpdateUserInput, actor, userRole)
    } else {
      await userService.create(data as CreateUserInput, actor, userRole)
    }
    await loadData()
    handleCloseForm()
  }

  // Apertura de Detalle y carga bajo demanda de actividad
  const handleOpenDetail = async (user: User) => {
    setSelectedUser(user)
    setIsDetailOpen(true)
    setIsLoadingActivity(true)
    try {
      const activity = await userService.getUserActivity(user.id, userRole)
      setUserActivity(activity)
    } catch (e) {
      console.error('Error al cargar la actividad del usuario', e)
      setUserActivity([])
    } finally {
      setIsLoadingActivity(false)
    }
  }

  const handleCloseDetail = () => {
    setIsDetailOpen(false)
    setSelectedUser(null)
    setUserActivity([])
  }

  // Apertura de Diálogo Activar / Desactivar
  const handlePromptToggleStatus = (user: User) => {
    setUserToToggleStatus(user)
    setIsDeactivateDialogOpen(true)
  }

  const handleCloseDeactivateDialog = () => {
    setIsDeactivateDialogOpen(false)
    setUserToToggleStatus(null)
  }

  // Confirmar cambio de estado
  const handleConfirmToggleStatus = async (reason?: string) => {
    if (!userToToggleStatus) return
    const actor = { id: 'usr-001', name: 'Mauricio Andrade', role: 'Superadministrador' }
    const newStatus: UserStatus = userToToggleStatus.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    await userService.toggleStatus(userToToggleStatus.id, newStatus, actor, userRole, reason)
    handleCloseDeactivateDialog()
    await loadData()
    if (selectedUser && selectedUser.id === userToToggleStatus.id) {
      setSelectedUser((prev) => (prev ? { ...prev, status: newStatus } : null))
    }
  }

  // Exportar a CSV
  const handleExportCSV = async () => {
    const actor = { id: 'usr-001', name: 'Mauricio Andrade', role: 'Superadministrador' }
    const res = await userService.exportUsers(filters, actor, userRole)

    const blob = new Blob([res.content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', res.fileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return {
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
    reload: loadData,
  }
}
