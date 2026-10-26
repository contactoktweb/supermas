import { displayLabel, LabelMap } from '@/lib/labels/display-labels'

/** Áreas del sistema según el prefijo del permiso ("warehouses.read" → "Bodegas"). */
const PERMISSION_AREA_LABELS: LabelMap = {
  sales: 'Ventas',
  pos: 'Punto de venta',
  invoices: 'Facturación electrónica',
  remissions: 'Remisiones',
  customers: 'Clientes',
  products: 'Productos',
  prices: 'Precios',
  inventory: 'Inventario',
  kardex: 'Kardex',
  warehouses: 'Bodegas',
  purchases: 'Compras',
  suppliers: 'Proveedores',
  treasury: 'Tesorería',
  accounting: 'Contabilidad',
  financial: 'Reportes financieros',
  reports: 'Reportes',
  taxes: 'Impuestos',
  exogena: 'Exógena',
  cost: 'Costos',
  costs: 'Costos',
  hr: 'Recursos humanos',
  users: 'Usuarios',
  settings: 'Configuración',
  audit: 'Auditoría',
}

/** Acción permitida según el sufijo del permiso ("warehouses.read" → "Consultar"). */
const PERMISSION_ACTION_LABELS: LabelMap = {
  read: 'Consultar',
  create: 'Crear',
  update: 'Editar',
  write: 'Editar',
  delete: 'Eliminar',
  cancel: 'Anular',
  approve: 'Aprobar',
  request: 'Solicitar',
  adjust: 'Ajustar',
  transfer: 'Trasladar',
  post: 'Contabilizar',
  export: 'Exportar',
  manage: 'Administrar',
  access: 'Acceso',
  cash_register: 'Manejar caja',
  petty_cash: 'Caja menor',
  activate: 'Activar',
  documents: 'Documentos',
  sensitive: 'Datos sensibles',
  assign: 'Asignar',
  configure: 'Configurar',
  generate: 'Generar',
  validate: 'Validar',
  view_activity: 'Ver actividad',
  critical: 'Eventos críticos',
  security: 'Seguridad',
  financial: 'Financieros',
}

/** Nombre legible de un permiso: "warehouses.read" → "Bodegas: Consultar". */
export function permissionDisplayName(permission: string): string {
  const [area, ...rest] = permission.split('.')
  const action = rest.join('.')
  const areaLabel = displayLabel(PERMISSION_AREA_LABELS, area)
  return action ? `${areaLabel}: ${displayLabel(PERMISSION_ACTION_LABELS, action)}` : areaLabel
}
