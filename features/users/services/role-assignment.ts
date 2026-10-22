/**
 * SUPER MÁS ERP/POS - Matriz de asignación de roles
 *
 * Fuente única (servidor y UI) de qué rol puede asignar qué rol a otro usuario.
 * - Solo ADMIN y SUPERADMIN asignan roles.
 * - SUPERADMIN nunca se asigna desde la aplicación (solo bootstrap del servidor).
 * La base de datos aplica la misma regla con el trigger trg_users_privilege_guard (076).
 */

import { UserRole } from '../types'
import { UserRoleSchema } from '../schemas/user.schema'

export const PROTECTED_ROLE: UserRole = 'SUPERADMIN'
export const ADMIN_ROLES: readonly UserRole[] = ['ADMIN', 'SUPERADMIN']

const ASSIGNABLE_BY_ADMIN: readonly UserRole[] = UserRoleSchema.options.filter(
  (role) => role !== PROTECTED_ROLE
)

export const ROLE_ASSIGNMENT_MATRIX: Readonly<Partial<Record<UserRole, readonly UserRole[]>>> = {
  SUPERADMIN: ASSIGNABLE_BY_ADMIN,
  ADMIN: ASSIGNABLE_BY_ADMIN,
}

export function isAdminRole(role: string | null | undefined): boolean {
  return ADMIN_ROLES.includes(role as UserRole)
}

/** Roles que `actorRole` puede asignar a otro usuario. */
export function getAssignableRoles(actorRole: string | null | undefined): readonly UserRole[] {
  return ROLE_ASSIGNMENT_MATRIX[actorRole as UserRole] ?? []
}

export function canAssignRole(actorRole: string | null | undefined, targetRole: string): boolean {
  return getAssignableRoles(actorRole).includes(targetRole as UserRole)
}
