/**
 * SUPER MÁS ERP/POS - Tipos Centralizados de Autenticación y Sesión
 *
 * Mapea la relación:
 * auth.users -> public.users -> public.roles -> role_permissions -> permissions
 */

export type UserRoleCode =
  // 7 Roles Definitivos del ERP
  | 'ADMIN'
  | 'JEFE_INGRESOS_SALIDAS'
  | 'FACTURACION_POS'
  | 'ENCARGADA_VENTA'
  | 'VENDEDORES'
  | 'JEFE_BODEGA'
  | 'RECURSOS_HUMANOS'
  // Roles Legacy preservados para compatibilidad
  | 'SUPERADMIN'
  | 'ACCOUNTANT'
  | 'WAREHOUSE_ADMIN'
  | 'POINT_ADMIN'
  | 'SELLER'
  | 'CASHIER'

export interface AuthRole {
  id: string
  code: UserRoleCode
  name: string
  description?: string | null
}

export interface AuthUser {
  id: string // UUID idéntico en auth.users y public.users
  email: string
  fullName: string
  phone: string | null
  avatar: string
  avatarUrl: string | null
  companyId: string | null
  roleId: string
  roleCode: UserRoleCode
  roleName: string
  roleDescription: string | null
  permissions: string[] // Códigos de permisos obtenidos directamente desde PostgreSQL
  locationIds: string[]
  isActive: boolean
  lastLoginAt: string | null
}

export interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
}

export interface LoginCredentials {
  email: string
  password: string
}
