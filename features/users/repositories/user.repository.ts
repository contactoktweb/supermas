/**
 * SUPER MÁS ERP/POS - Repositorio de Usuarios
 *
 * Conecta con la capa centralizada lib/supabase/db.ts para persistir y consultar
 * usuarios, asignaciones y actividad histórica en el ERP.
 */

import { db } from '@/lib/supabase/db'
import { User, UserFilters, UserStats, UserRole, UserStatus } from '../types'
import { AuditLogEntry } from '@/features/audit/types'

export class UserRepository {
  /**
   * Consulta el listado de usuarios con filtros aplicados.
   */
  async getUsers(filters: UserFilters = {}): Promise<User[]> {
    let users = (db.users as unknown as User[]) || []

    if (filters.role && filters.role !== 'ALL') {
      users = users.filter((u) => u.role === filters.role)
    }

    if (filters.status && filters.status !== 'ALL') {
      users = users.filter((u) => u.status === filters.status)
    }

    if (filters.locationId && filters.locationId !== 'ALL') {
      users = users.filter((u) => u.locationIds?.includes(filters.locationId!))
    }

    if (filters.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase().trim()
      users = users.filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.username?.toLowerCase().includes(q) ||
          u.phone?.toLowerCase().includes(q) ||
          u.role?.toLowerCase().includes(q) ||
          u.locationName?.toLowerCase().includes(q)
      )
    }

    return [...users].sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * Obtiene un usuario por ID.
   */
  async getUserById(id: string): Promise<User | null> {
    const users = (db.users as unknown as User[]) || []
    return users.find((u) => u.id === id) || null
  }

  /**
   * Consulta las estadísticas globales de usuarios.
   */
  async getStats(): Promise<UserStats> {
    const users = (db.users as unknown as User[]) || []

    const totalUsersCount = users.length
    const activeUsersCount = users.filter((u) => u.status === 'ACTIVE').length
    const inactiveUsersCount = users.filter((u) => u.status === 'INACTIVE').length

    // Conectados en los últimos 7 días
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const recentlyConnectedCount = users.filter(
      (u) => u.lastLoginAt && new Date(u.lastLoginAt).getTime() >= sevenDaysAgo
    ).length

    const usersByRole: Record<UserRole, number> = {
      SUPERADMIN: 0,
      WAREHOUSE_ADMIN: 0,
      POINT_ADMIN: 0,
      ACCOUNTANT: 0,
      SELLER: 0,
      CASHIER: 0,
    }

    users.forEach((u) => {
      if (usersByRole[u.role] !== undefined) {
        usersByRole[u.role]++
      }
    })

    return {
      totalUsersCount,
      activeUsersCount,
      inactiveUsersCount,
      recentlyConnectedCount,
      usersByRole,
    }
  }

  /**
   * Registra un nuevo usuario en la base de datos mock.
   */
  async createUser(
    data: Omit<User, 'id' | 'createdAt' | 'lastLoginAt' | 'avatar' | 'name' | 'locationName'>
  ): Promise<User> {
    const users = db.users as unknown as User[]
    const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`
    const initials = `${data.firstName.charAt(0)}${data.lastName.charAt(0)}`.toUpperCase()

    // Resolver nombre de la bodega principal asignada
    const locations = db.locations || []
    const primaryLoc = locations.find((l) => l.id === data.locationIds[0])
    const locationName =
      data.locationIds.length > 1
        ? `Múltiples Sedes (${data.locationIds.length})`
        : primaryLoc?.name || 'Consolidado General'

    const newUser: User = {
      ...data,
      id: `usr-${String(users.length + 1).padStart(3, '0')}`,
      name: fullName,
      avatar: initials,
      locationName,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    }

    users.push(newUser)
    return newUser
  }

  /**
   * Actualiza un usuario existente.
   */
  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const users = db.users as unknown as User[]
    const index = users.findIndex((u) => u.id === id)
    if (index === -1) {
      throw new Error(`No se encontró el usuario con ID ${id}`)
    }

    const current = users[index]
    const updated: User = {
      ...current,
      ...updates,
    }

    if (updates.firstName || updates.lastName) {
      const fName = updates.firstName ?? current.firstName
      const lName = updates.lastName ?? current.lastName
      updated.name = `${fName} ${lName}`.trim()
      updated.avatar = `${fName.charAt(0)}${lName.charAt(0)}`.toUpperCase()
    }

    if (updates.locationIds) {
      const locations = db.locations || []
      const primaryLoc = locations.find((l) => l.id === updates.locationIds![0])
      updated.locationName =
        updates.locationIds.length > 1
          ? `Múltiples Sedes (${updates.locationIds.length})`
          : primaryLoc?.name || 'Consolidado General'
    }

    users[index] = updated
    return updated
  }

  /**
   * Activa o desactiva lógicamente a un usuario.
   */
  async setStatus(id: string, status: UserStatus): Promise<User> {
    return this.updateUser(id, { status })
  }

  /**
   * Consulta la actividad histórica reciente de un usuario desde audit_logs.json.
   */
  async getUserActivity(userId: string): Promise<AuditLogEntry[]> {
    const logs = (db.auditLogs as unknown as AuditLogEntry[]) || []
    return logs
      .filter((l) => l.userId === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  /**
   * Obtiene las bodegas y puntos de venta activos del sistema.
   */
  async getLocations(): Promise<Array<{ id: string; code: string; name: string; type: string }>> {
    const locations = db.locations || []
    return locations.map((loc) => ({
      id: loc.id,
      code: loc.code,
      name: loc.name,
      type: loc.type,
    }))
  }
}

export const userRepository = new UserRepository()
