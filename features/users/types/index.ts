/**
 * SUPER MÁS ERP/POS - Tipos del Módulo de Usuarios y Roles Predefinidos
 */

export type UserRole =
  // 7 Roles Definitivos del ERP
  | 'ADMIN'
  | 'JEFE_INGRESOS_SALIDAS'
  | 'FACTURACION_POS'
  | 'ENCARGADA_VENTA'
  | 'VENDEDORES'
  | 'JEFE_BODEGA'
  | 'RECURSOS_HUMANOS'
  // Roles Legacy preservados
  | 'SUPERADMIN'
  | 'WAREHOUSE_ADMIN'
  | 'POINT_ADMIN'
  | 'ACCOUNTANT'
  | 'SELLER'
  | 'CASHIER'

export type UserStatus = 'ACTIVE' | 'INACTIVE'

export interface User {
  id: string
  name: string
  firstName: string
  lastName: string
  email: string
  username: string
  phone: string
  role: UserRole
  status: UserStatus
  locationIds: string[]
  locationName: string
  assignedCashRegisterId?: string | null
  assignedCashRegisterName?: string | null
  avatar: string
  createdAt: string
  lastLoginAt: string | null
}

export interface RoleDefinition {
  code: UserRole
  name: string
  description: string
  badgeColor: string
  badgeBg: string
  permissions: string[]
  scope: 'ALL_LOCATIONS' | 'ASSIGNED_LOCATION'
}

export interface UserStats {
  totalUsersCount: number
  activeUsersCount: number
  inactiveUsersCount: number
  recentlyConnectedCount: number
  usersByRole: Record<string, number>
}

export interface UserFilters {
  role?: string
  locationId?: string
  status?: 'ALL' | 'ACTIVE' | 'INACTIVE'
  searchQuery?: string
}

export type UserPermission =
  | 'users.read'
  | 'users.create'
  | 'users.update'
  | 'users.activate'
  | 'users.assign'
  | 'users.view_activity'
  | 'users.export'
