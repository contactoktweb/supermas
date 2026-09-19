import { LightIconName } from '@/components/ui/Icon'

export type AppModuleItem = [string, LightIconName, string]

/**
 * Módulos canónicos del ERP/POS Super Más
 * Fuente única de verdad para la navegación lateral en todas las vistas.
 */
export const APP_MODULES: AppModuleItem[] = [
  ['Dashboard', 'dashboard', '/'],
  ['Bodegas', 'warehouse', '/bodegas'],
  ['Productos', 'products', '/'],
  ['Inventario', 'inventory', '/inventario'],
  ['Kardex', 'kardex', '/kardex'],
  ['Transferencias', 'transfers', '/transferencias'],
  ['Compras', 'purchases', '/compras'],
  ['Proveedores', 'suppliers', '/proveedores'],
  ['Clientes', 'customers', '/clientes'],
  ['Ventas', 'sales', '/ventas'],
  ['POS', 'pos', '/pos'],
  ['Facturación', 'invoices', '/facturacion'],
  ['Remisiones', 'remisiones', '/remisiones'],
  ['Cajas', 'cashRegisters', '/reportes/cajas'],
  ['Contabilidad', 'accounting', '/contabilidad'],
  ['Impuestos', 'taxes', '/impuestos'],
  ['Exógena', 'exogena', '/exogena'],
  ['Pedidos Web', 'webOrders', '/pedidos-web'],
  ['Catálogo Super Más', 'ecommerceSM', '/catalogo-supermas'],
  ['Catálogo Distribuidora', 'ecommerceDist', '/catalogo-distribuidora'],
  ['Reportes', 'reports', '/reportes'],
  ['Alertas', 'alerts', '/alertas'],
  ['Auditoría', 'audit', '/auditoria'],
  ['Usuarios', 'users', '/usuarios'],
  ['Roles', 'roles', '/roles'],
  ['Configuración', 'settings', '/configuracion'],
]
