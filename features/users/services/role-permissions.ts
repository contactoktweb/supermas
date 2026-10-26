/**
 * SUPER MÁS ERP/POS - Catálogo de Roles Predefinidos y Matriz de Permisos
 *
 * Los roles son inmutables desde la UI y están definidos estrictamente en código.
 * La relación de seguridad es: Usuario -> Rol Predefinido -> Permisos derivados.
 */

import { UserRole, RoleDefinition } from '../types'
import { displayLabel } from '@/lib/labels/display-labels'

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
      // Productos y Catálogo
      'products.read',
      'products.create',
      'products.update',
      'products.delete',
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
  ADMIN: {
    code: 'ADMIN',
    name: 'Administrador General',
    description: 'Control administrativo, operativo, financiero y de seguridad completo del ERP en todas las sedes.',
    badgeColor: '#1d4ed8',
    badgeBg: '#eff6ff',
    scope: 'ALL_LOCATIONS',
    permissions: [
      'accounting.post',
      'accounting.read',
      'audit.read',
      'audit.export',
      'cost.read',
      'costs.manage',
      'customers.read',
      'customers.write',
      'exogena.export',
      'exogena.read',
      'financial.read',
      'inventory.adjust',
      'inventory.read',
      'inventory.transfer',
      'invoices.cancel',
      'invoices.create',
      'invoices.read',
      'kardex.read',
      'pos.access',
      'pos.cash_register',
      'prices.approve',
      'prices.request',
      'products.create',
      'products.delete',
      'products.read',
      'products.update',
      'purchases.create',
      'purchases.read',
      'remissions.create',
      'remissions.read',
      'sales.cancel',
      'sales.create',
      'sales.read',
      'settings.manage',
      'suppliers.read',
      'suppliers.write',
      'taxes.read',
      'taxes.write',
      'treasury.create',
      'treasury.petty_cash',
      'treasury.read',
      'users.activate',
      'users.create',
      'users.read',
      'users.update',
      'warehouses.read',
      'warehouses.write',
    ],
  },
  JEFE_INGRESOS_SALIDAS: {
    code: 'JEFE_INGRESOS_SALIDAS',
    name: 'Jefe de Ingresos y Salidas Operativa',
    description: 'Gestión de entradas y salidas operativas, transferencias, costos, caja menor y solicitud de cambios de precios.',
    badgeColor: '#b45309',
    badgeBg: '#fef3c7',
    scope: 'ALL_LOCATIONS',
    permissions: [
      'audit.read',
      'cost.read',
      'costs.manage',
      'customers.read',
      'customers.write',
      'inventory.adjust',
      'inventory.read',
      'inventory.transfer',
      'kardex.read',
      'prices.request',
      'products.read',
      'purchases.read',
      'remissions.create',
      'remissions.read',
      'treasury.create',
      'treasury.petty_cash',
      'treasury.read',
      'warehouses.read',
    ],
  },
  FACTURACION_POS: {
    code: 'FACTURACION_POS',
    name: 'Facturación POS',
    description: 'Operación de terminal de facturación POS y consulta de facturas POS emitidas en su sede.',
    badgeColor: '#0284c7',
    badgeBg: '#e0f2fe',
    scope: 'ASSIGNED_LOCATION',
    permissions: [
      'customers.read',
      'inventory.read',
      'invoices.read',
      'pos.access',
      'products.read',
      'sales.create',
      'sales.read',
    ],
  },
  ENCARGADA_VENTA: {
    code: 'ENCARGADA_VENTA',
    name: 'Encargada de Venta',
    description: 'Operación de caja asignada, recepción y cobro de tickets de venta, movimiento y descargo de inventario en su punto.',
    badgeColor: '#7c3aed',
    badgeBg: '#ede9fe',
    scope: 'ASSIGNED_LOCATION',
    permissions: [
      'customers.read',
      'inventory.adjust',
      'inventory.read',
      'invoices.read',
      'pos.access',
      'pos.cash_register',
      'products.read',
      'remissions.create',
      'remissions.read',
      'sales.create',
      'sales.read',
    ],
  },
  VENDEDORES: {
    code: 'VENDEDORES',
    name: 'Vendedores',
    description: 'Creación y registro de ventas comerciales y generación de tickets preventa para cobro posterior.',
    badgeColor: '#ea580c',
    badgeBg: '#ffedd5',
    scope: 'ASSIGNED_LOCATION',
    permissions: [
      'customers.read',
      'customers.write',
      'inventory.read',
      'products.read',
      'sales.create',
      'sales.read',
    ],
  },
  JEFE_BODEGA: {
    code: 'JEFE_BODEGA',
    name: 'Jefe de Bodega',
    description: 'Gestión física, consulta de existencias, recepciones y transferencias de la bodega asignada.',
    badgeColor: '#16a34a',
    badgeBg: '#dcfce7',
    scope: 'ASSIGNED_LOCATION',
    permissions: [
      'inventory.adjust',
      'inventory.read',
      'inventory.transfer',
      'kardex.read',
      'products.read',
      'purchases.read',
      'remissions.read',
      'warehouses.read',
    ],
  },
  RECURSOS_HUMANOS: {
    code: 'RECURSOS_HUMANOS',
    name: 'Recursos Humanos',
    description: 'Gestión de colaboradores, información laboral, terceros de nómina y consulta de personal.',
    badgeColor: '#db2777',
    badgeBg: '#fce7f3',
    scope: 'ALL_LOCATIONS',
    permissions: [
      'audit.read',
      'customers.read',
      'users.activate',
      'users.create',
      'users.read',
      'users.update',
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
      'products.read',
      'products.create',
      'products.update',
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
      'products.read',
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
      'products.read',
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
      'products.read',
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
      'products.read',
    ],
  },
}

/**
 * Los 7 Roles Definitivos del ERP Super Más
 */
export const DEFINITIVE_ROLES: UserRole[] = [
  'ADMIN',
  'JEFE_INGRESOS_SALIDAS',
  'FACTURACION_POS',
  'ENCARGADA_VENTA',
  'VENDEDORES',
  'JEFE_BODEGA',
  'RECURSOS_HUMANOS',
]

/**
 * Consulta la definición y metadatos de un rol predefinido.
 */
export function getRoleDefinition(role: UserRole): RoleDefinition {
  return SYSTEM_ROLES[role] || SYSTEM_ROLES.SELLER
}

/** Roles de asignación por sede que no forman parte del catálogo de roles del sistema. */
const LOCATION_ROLE_NAMES: Record<string, string> = {
  STORE_ADMIN: 'Administrador de sede',
  INVENTORY_CLERK: 'Auxiliar de inventario',
}

/** Nombre del rol para mostrar en pantalla; nunca devuelve el código interno. */
export function roleDisplayName(role: string | null | undefined): string {
  if (!role) return '—'
  return SYSTEM_ROLES[role as UserRole]?.name ?? LOCATION_ROLE_NAMES[role] ?? displayLabel({}, role)
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
