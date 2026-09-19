/**
 * SUPER MÁS ERP/POS - Catálogo de Roles Predefinidos y Matriz de Permisos
 *
 * Los roles son inmutables desde la UI y están definidos estrictamente en código.
 * La relación de seguridad es: Usuario -> Rol Predefinido -> Permisos derivados.
 */

import { UserRole, RoleDefinition } from '../types'

export const SYSTEM_ROLES: Record<UserRole, RoleDefinition> = {
  SUPERADMIN: {
    code: 'SUPERADMIN',
    name: 'Superadministrador',
    description: 'Control total operativo, administrativo, financiero, de seguridad y configuración de todas las sedes.',
    badgeColor: '#1e3a8a',
    badgeBg: '#dbeafe',
    scope: 'ALL_LOCATIONS',
    permissions: [
      // Bodegas e Inventario
      'warehouses.read',
      'warehouses.write',
      'inventory.read',
      'inventory.adjust',
      'inventory.transfer',
      'kardex.read',
      // Compras y Proveedores
      'purchases.read',
      'purchases.create',
      'suppliers.read',
      'suppliers.write',
      // Ventas y POS
      'sales.read',
      'sales.create',
      'sales.cancel',
      'pos.access',
      'pos.cash_register',
      'invoices.read',
      'invoices.create',
      'invoices.cancel',
      'remissions.read',
      'remissions.create',
      // Clientes
      'customers.read',
      'customers.write',
      // Fiscal y Contabilidad
      'taxes.read',
      'taxes.write',
      'exogena.read',
      'exogena.configure',
      'exogena.generate',
      'exogena.validate',
      'exogena.export',
      // Reportes y Auditoría
      'reports.read',
      'reports.financial',
      'reports.export',
      'audit.read',
      'audit.export',
      'audit.critical',
      'audit.security',
      // Usuarios
      'users.read',
      'users.create',
      'users.update',
      'users.activate',
      'users.assign',
      'users.view_activity',
      'users.export',
    ],
  },
  WAREHOUSE_ADMIN: {
    code: 'WAREHOUSE_ADMIN',
    name: 'Administrador de Bodega',
    description: 'Gestión de existencias, recepción de compras, despacho de transferencias y conteos físicos en bodegas asignadas.',
    badgeColor: '#15803d',
    badgeBg: '#dcfce7',
    scope: 'ASSIGNED_LOCATION',
    permissions: [
      'warehouses.read',
      'inventory.read',
      'inventory.adjust',
      'inventory.transfer',
      'kardex.read',
      'purchases.read',
      'purchases.create',
      'suppliers.read',
      'remissions.read',
      'reports.read',
      'audit.read',
      'audit.export',
    ],
  },
  POINT_ADMIN: {
    code: 'POINT_ADMIN',
    name: 'Administrador de Punto (POS)',
    description: 'Supervisión de cajas, arqueos, facturación electrónica y atención a clientes en el punto de venta.',
    badgeColor: '#0369a1',
    badgeBg: '#e0f2fe',
    scope: 'ASSIGNED_LOCATION',
    permissions: [
      'sales.read',
      'sales.create',
      'pos.access',
      'pos.cash_register',
      'invoices.read',
      'invoices.create',
      'customers.read',
      'customers.write',
      'remissions.read',
      'remissions.create',
      'inventory.read',
      'reports.read',
      'audit.read',
    ],
  },
  ACCOUNTANT: {
    code: 'ACCOUNTANT',
    name: 'Contabilidad y Revisoría',
    description: 'Supervisión de libros fiscales, liquidación de IVA, medios magnéticos (Exógena) y auditoría contable.',
    badgeColor: '#7e22ce',
    badgeBg: '#f3e8ff',
    scope: 'ALL_LOCATIONS',
    permissions: [
      'taxes.read',
      'taxes.write',
      'exogena.read',
      'exogena.configure',
      'exogena.generate',
      'exogena.validate',
      'exogena.export',
      'invoices.read',
      'purchases.read',
      'reports.read',
      'reports.financial',
      'reports.export',
      'audit.read',
      'audit.export',
      'audit.critical',
    ],
  },
  SELLER: {
    code: 'SELLER',
    name: 'Asesor Comercial / Preventa',
    description: 'Emisión de cotizaciones, pedidos, remisiones y consulta de catálogo y disponibilidad de inventario.',
    badgeColor: '#c2410c',
    badgeBg: '#ffedd5',
    scope: 'ASSIGNED_LOCATION',
    permissions: [
      'sales.read',
      'sales.create',
      'customers.read',
      'customers.write',
      'inventory.read',
      'remissions.read',
    ],
  },
  CASHIER: {
    code: 'CASHIER',
    name: 'Cajero de Punto de Venta',
    description: 'Registro de cobros presenciales en caja registradora, emisión de tirillas POS y arqueos de turno.',
    badgeColor: '#475569',
    badgeBg: '#f1f5f9',
    scope: 'ASSIGNED_LOCATION',
    permissions: [
      'pos.access',
      'sales.create',
      'pos.cash_register',
      'customers.read',
    ],
  },
}

/**
 * Consulta la definición y metadatos de un rol predefinido.
 */
export function getRoleDefinition(role: UserRole): RoleDefinition {
  return SYSTEM_ROLES[role] || SYSTEM_ROLES.SELLER
}

/**
 * Retorna el arreglo de permisos asociados a un rol.
 */
export function getRolePermissions(role: UserRole): string[] {
  return getRoleDefinition(role).permissions
}

/**
 * Helper universal para verificar si un rol posee un permiso específico.
 */
export function hasPermission(role: UserRole, permission: string): boolean {
  if (role === 'SUPERADMIN') return true
  const permissions = getRolePermissions(role)
  return permissions.includes(permission)
}

/**
 * Helper para verificar si un rol posee al menos uno de los permisos indicados.
 */
export function hasAnyPermission(role: UserRole, permissions: string[]): boolean {
  if (role === 'SUPERADMIN') return true
  const rolePerms = getRolePermissions(role)
  return permissions.some((p) => rolePerms.includes(p))
}

/**
 * Helper para verificar si un rol posee todos los permisos solicitados.
 */
export function hasAllPermissions(role: UserRole, permissions: string[]): boolean {
  if (role === 'SUPERADMIN') return true
  const rolePerms = getRolePermissions(role)
  return permissions.every((p) => rolePerms.includes(p))
}
