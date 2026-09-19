/**
 * SUPER MÁS ERP/POS - Servicio de Negocio de Usuarios y Roles Predefinidos
 *
 * Coordina la administración de colaboradores, asignaciones a bodegas,
 * validación de permisos derivados y registro transversal en auditoría.
 */

import { userRepository } from '../repositories/user.repository'
import { auditService } from '@/features/audit/services/audit.service'
import { User, UserFilters, UserStats, UserPermission, UserRole, UserStatus } from '../types'
import { CreateUserInput, UpdateUserInput, CreateUserSchema, UpdateUserSchema } from '../schemas/user.schema'
import { hasPermission } from './role-permissions'

export class UserService {
  /**
   * Verifica si un rol cuenta con un permiso específico del módulo de usuarios.
   */
  hasUserPermission(permission: UserPermission, userRole: UserRole = 'SUPERADMIN'): boolean {
    return hasPermission(userRole, permission)
  }

  private assertPermission(permission: UserPermission, userRole: UserRole = 'SUPERADMIN'): void {
    if (!this.hasUserPermission(permission, userRole)) {
      throw new Error(`Permiso denegado: Se requiere autorización '${permission}' para esta operación.`)
    }
  }

  /**
   * Consulta la lista de usuarios con filtros aplicados.
   */
  async list(filters: UserFilters = {}, userRole: UserRole = 'SUPERADMIN'): Promise<User[]> {
    this.assertPermission('users.read', userRole)
    return userRepository.getUsers(filters)
  }

  /**
   * Obtiene un usuario específico por su ID.
   */
  async getById(id: string, userRole: UserRole = 'SUPERADMIN'): Promise<User | null> {
    this.assertPermission('users.read', userRole)
    return userRepository.getUserById(id)
  }

  /**
   * Obtiene métricas e indicadores de usuarios.
   */
  async getUserStats(userRole: UserRole = 'SUPERADMIN'): Promise<UserStats> {
    this.assertPermission('users.read', userRole)
    return userRepository.getStats()
  }

  /**
   * Registra un nuevo usuario en el sistema y emite evento de auditoría.
   */
  async create(
    input: CreateUserInput,
    actor: { id: string; name: string; role: string },
    userRole: UserRole = 'SUPERADMIN'
  ): Promise<User> {
    this.assertPermission('users.create', userRole)
    const validated = CreateUserSchema.parse(input)

    // Validar duplicidad de email o username
    const existingUsers = await userRepository.getUsers()
    const emailExists = existingUsers.some(
      (u) => u.email.toLowerCase() === validated.email.toLowerCase()
    )
    if (emailExists) {
      throw new Error(`El correo electrónico ${validated.email} ya se encuentra registrado.`)
    }

    const usernameExists = existingUsers.some(
      (u) => u.username.toLowerCase() === validated.username.toLowerCase()
    )
    if (usernameExists) {
      throw new Error(`El nombre de usuario '${validated.username}' ya está en uso.`)
    }

    const created = await userRepository.createUser(validated)

    // Registrar en auditoría
    await auditService.log({
      action: 'USER_CREATED',
      module: 'USERS',
      entityType: 'USER',
      entityId: created.id,
      entityReference: `${created.name} (${created.username})`,
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      level: 'INFO',
      result: 'SUCCESS',
      details: `Creación de nuevo usuario ${created.name} con rol ${created.role} asignado a ${created.locationName}.`,
    })

    return created
  }

  /**
   * Actualiza los datos de un usuario existente. Si el rol cambia, genera evento crítico en auditoría.
   */
  async update(
    id: string,
    input: UpdateUserInput,
    actor: { id: string; name: string; role: string },
    userRole: UserRole = 'SUPERADMIN'
  ): Promise<User> {
    this.assertPermission('users.update', userRole)
    const validated = UpdateUserSchema.parse(input)

    const current = await userRepository.getUserById(id)
    if (!current) {
      throw new Error(`El usuario ${id} no existe.`)
    }

    // Comprobar si el rol cambió para auditoría crítica
    const isRoleChanged = validated.role && validated.role !== current.role

    const updated = await userRepository.updateUser(id, validated)

    if (isRoleChanged) {
      await auditService.log({
        action: 'USER_ROLE_UPDATED',
        module: 'USERS',
        entityType: 'USER',
        entityId: updated.id,
        entityReference: `${updated.name} (${updated.username})`,
        userId: actor.id,
        userName: actor.name,
        userRole: actor.role,
        level: 'CRITICAL',
        result: 'SUCCESS',
        details: `Modificación de rol para el usuario ${updated.name}. Nuevo rol: ${updated.role}.`,
        changes: [
          {
            field: 'role',
            label: 'Rol del usuario',
            previousValue: current.role,
            newValue: updated.role,
          },
        ],
      })
    } else {
      await auditService.log({
        action: 'CONFIG_CHANGED',
        module: 'USERS',
        entityType: 'USER',
        entityId: updated.id,
        entityReference: `${updated.name} (${updated.username})`,
        userId: actor.id,
        userName: actor.name,
        userRole: actor.role,
        level: 'INFO',
        result: 'SUCCESS',
        details: `Actualización de perfil/asignaciones del usuario ${updated.name}.`,
      })
    }

    return updated
  }

  /**
   * Activa o desactiva lógicamente el acceso de un usuario.
   */
  async toggleStatus(
    id: string,
    statusOrActive: UserStatus | boolean,
    actor: { id: string; name: string; role: string },
    userRole: UserRole = 'SUPERADMIN',
    reason?: string
  ): Promise<User> {
    this.assertPermission('users.activate', userRole)

    const targetStatus: UserStatus =
      typeof statusOrActive === 'boolean'
        ? statusOrActive
          ? 'ACTIVE'
          : 'INACTIVE'
        : statusOrActive

    const isActivating = targetStatus === 'ACTIVE'
    const updated = await userRepository.setStatus(id, targetStatus)

    await auditService.log({
      action: 'CONFIG_CHANGED',
      module: 'USERS',
      entityType: 'USER',
      entityId: updated.id,
      entityReference: `${updated.name} (${updated.username})`,
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      level: isActivating ? 'INFO' : 'WARNING',
      result: 'SUCCESS',
      details: `Usuario ${updated.name} ${isActivating ? 'activado' : 'desactivado'} en el sistema.${
        reason ? ` Motivo: ${reason}` : ''
      }`,
      changes: [
        {
          field: 'status',
          label: 'Estado de cuenta',
          previousValue: isActivating ? 'INACTIVE' : 'ACTIVE',
          newValue: targetStatus,
        },
      ],
    })

    return updated
  }

  /**
   * Consulta la actividad histórica reciente de un usuario.
   */
  async getUserActivity(userId: string, userRole: UserRole = 'SUPERADMIN') {
    this.assertPermission('users.view_activity', userRole)
    return userRepository.getUserActivity(userId)
  }

  /**
   * Obtiene la lista de sedes/bodegas/puntos disponibles.
   */
  async getLocations() {
    return userRepository.getLocations()
  }

  /**
   * Exporta el directorio de usuarios a formato CSV sanitizado (sin credenciales).
   */
  async exportUsers(
    filters: UserFilters = {},
    actor: { id: string; name: string; role: string },
    userRole: UserRole = 'SUPERADMIN'
  ): Promise<{ fileName: string; content: string; totalRecords: number }> {
    this.assertPermission('users.export', userRole)

    const users = await this.list(filters, userRole)

    const headers = ['ID', 'Nombre Completo', 'Usuario', 'Email', 'Teléfono', 'Rol', 'Bodega Asignada', 'Estado', 'Fecha Creación', 'Último Acceso']

    const rows = users.map((u) => [
      u.id,
      `"${u.name}"`,
      `"${u.username}"`,
      `"${u.email}"`,
      `"${u.phone || 'N/A'}"`,
      `"${u.role}"`,
      `"${u.locationName}"`,
      u.status,
      u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : 'N/A',
      u.lastLoginAt ? new Date(u.lastLoginAt).toISOString().split('T')[0] : 'Nunca',
    ])

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const fileName = `usuarios_supermas_${new Date().toISOString().split('T')[0]}.csv`

    await auditService.log({
      action: 'EXPORT_EXECUTED',
      module: 'USERS',
      entityType: 'USER_DIRECTORY',
      entityId: `exp-users-${Date.now()}`,
      entityReference: fileName,
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      level: 'INFO',
      result: 'SUCCESS',
      details: `Exportación del directorio de ${users.length} usuarios realizada por ${actor.name}.`,
    })

    return {
      fileName,
      content: csvContent,
      totalRecords: users.length,
    }
  }
}

export const userService = new UserService()
