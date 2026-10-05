import { LightIconName } from '@/components/ui/Icon'

export type AppModuleItem = [string, LightIconName, string]

export interface NavItem {
  id: string
  label: string
  icon: LightIconName
  path: string
  permission?: string
  badge?: string | number
}

export interface NavSection {
  id: string
  title: string
  items: NavItem[]
}

/**
 * Módulo independiente raíz: Dashboard
 */
export const DASHBOARD_ITEM: NavItem = {
  id: 'dashboard',
  label: 'Dashboard',
  icon: 'dashboard',
  path: '/',
}

/**
 * Secciones organizadas y desplegables del ERP/POS Super Más
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'inventario',
    title: 'INVENTARIO',
    items: [
      { id: 'productos', label: 'Productos', icon: 'products', path: '/productos', permission: 'products.read' },
      { id: 'categorias', label: 'Categorías', icon: 'layers', path: '/categorias', permission: 'products.read' },
      { id: 'marcas', label: 'Marcas', icon: 'award', path: '/marcas', permission: 'products.read' },
      { id: 'bodegas', label: 'Bodegas', icon: 'warehouse', path: '/bodegas', permission: 'warehouses.read' },
      { id: 'inventario', label: 'Inventario', icon: 'inventory', path: '/inventario', permission: 'inventory.read' },
      { id: 'kardex', label: 'Kardex', icon: 'kardex', path: '/kardex', permission: 'kardex.read' },
      { id: 'transferencias', label: 'Transferencias', icon: 'transfers', path: '/transferencias', permission: 'inventory.transfer' },
    ],
  },
  {
    id: 'compras',
    title: 'COMPRAS',
    items: [
      { id: 'proveedores', label: 'Proveedores', icon: 'suppliers', path: '/proveedores', permission: 'suppliers.read' },
      { id: 'compras', label: 'Órdenes de compra', icon: 'purchases', path: '/compras', permission: 'purchases.read' },
      { id: 'recepciones', label: 'Recepciones', icon: 'warehouse', path: '/recepciones', permission: 'purchases.read' },
      { id: 'cuentas-por-pagar', label: 'Cuentas por Pagar', icon: 'wallet', path: '/cuentas-por-pagar', permission: 'purchases.read' },
    ],
  },
  {
    id: 'clientes-cartera',
    title: 'CLIENTES Y CARTERA',
    items: [
      { id: 'clientes', label: 'Clientes', icon: 'customers', path: '/clientes', permission: 'customers.read' },
      { id: 'cuentas-por-cobrar', label: 'Cuentas por cobrar', icon: 'wallet', path: '/cuentas-por-cobrar', permission: 'customers.read' },
      { id: 'pagos-recibidos', label: 'Pagos recibidos', icon: 'receipt', path: '/pagos-recibidos', permission: 'customers.read' },
      { id: 'estado-de-cuenta', label: 'Estado de cuenta', icon: 'fileText', path: '/estado-de-cuenta', permission: 'customers.read' },
    ],
  },
  {
    id: 'ventas',
    title: 'VENTAS',
    items: [
      { id: 'ventas', label: 'Ventas', icon: 'sales', path: '/ventas', permission: 'sales.read' },
      { id: 'pos', label: 'POS', icon: 'pos', path: '/pos', permission: 'pos.access' },
      { id: 'facturacion', label: 'Facturación', icon: 'invoices', path: '/facturacion', permission: 'invoices.read' },
      { id: 'remisiones', label: 'Remisiones', icon: 'remisiones', path: '/remisiones', permission: 'remissions.read' },
      { id: 'devoluciones', label: 'Devoluciones', icon: 'returns', path: '/devoluciones', permission: 'sales.read' },
      { id: 'cajas', label: 'Cajas', icon: 'cashRegisters', path: '/cajas', permission: 'pos.cash_register' },
      { id: 'tesoreria', label: 'Tesorería', icon: 'wallet', path: '/tesoreria', permission: 'reports.financial' },
    ],
  },
  {
    id: 'canales',
    title: 'CANALES Y CATÁLOGOS',
    items: [
      { id: 'pedidos-web', label: 'Pedidos Web', icon: 'webOrders', path: '/pedidos-web', permission: 'sales.read' },
      { id: 'catalogo-supermas', label: 'Catálogo Super Más', icon: 'ecommerceSM', path: '/catalogo-supermas', permission: 'products.read' },
      { id: 'catalogo-distribuidora', label: 'Catálogo Distribuidora', icon: 'ecommerceDist', path: '/catalogo-distribuidora', permission: 'products.read' },
    ],
  },
  {
    id: 'contabilidad',
    title: 'CONTABILIDAD',
    items: [
      { id: 'contabilidad', label: 'Contabilidad', icon: 'accounting', path: '/contabilidad', permission: 'reports.financial' },
      { id: 'impuestos', label: 'Impuestos', icon: 'taxes', path: '/impuestos', permission: 'taxes.read' },
      { id: 'exogena', label: 'Exógena', icon: 'exogena', path: '/exogena', permission: 'exogena.read' },
    ],
  },
  {
    id: 'gestion',
    title: 'GESTIÓN Y CONTROL',
    items: [
      { id: 'reportes', label: 'Reportes', icon: 'reports', path: '/reportes', permission: 'reports.read' },
      { id: 'alertas', label: 'Alertas', icon: 'alerts', path: '/alertas', permission: 'audit.read', badge: 3 },
      { id: 'auditoria', label: 'Auditoría', icon: 'audit', path: '/auditoria', permission: 'audit.read' },
    ],
  },
  {
    id: 'administracion',
    title: 'ADMINISTRACIÓN',
    items: [
      { id: 'usuarios', label: 'Usuarios', icon: 'users', path: '/usuarios', permission: 'users.read' },
      { id: 'roles', label: 'Roles', icon: 'roles', path: '/roles', permission: 'users.read' },
      { id: 'configuracion', label: 'Configuración', icon: 'settings', path: '/configuracion', permission: 'users.update' },
    ],
  },
]

/**
 * Módulos canónicos planos para compatibilidad total con consumidores existentes
 */
export const APP_MODULES: AppModuleItem[] = [
  [DASHBOARD_ITEM.label, DASHBOARD_ITEM.icon, DASHBOARD_ITEM.path],
  ...NAV_SECTIONS.flatMap((s) =>
    s.items.map((i) => [i.label, i.icon, i.path] as AppModuleItem)
  ),
]
