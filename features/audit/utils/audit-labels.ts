/**
 * Textos en español para los códigos internos que guarda la auditoría (tablas, columnas, roles, valores).
 */

import { ACTION_LABELS, MODULE_LABELS, displayLabel } from '@/lib/labels/display-labels'
import { SYSTEM_ROLES } from '@/features/users/services/role-permissions'

const ENTITY_LABELS: Readonly<Record<string, string>> = {
  customers: 'Cliente',
  products: 'Producto',
  product_prices: 'Precio de producto',
  stock_levels: 'Existencias',
  inventory_movements: 'Movimiento de inventario',
  sales: 'Venta',
  sale_items: 'Detalle de venta',
  purchases: 'Compra',
  purchase_items: 'Detalle de compra',
  users: 'Usuario',
  roles: 'Rol',
  suppliers: 'Proveedor',
  locations: 'Bodega',
  warehouses: 'Bodega',
  transfers: 'Traslado',
  warehouse_transfers: 'Traslado',
  remissions: 'Remisión',
  invoices: 'Factura',
  cash_sessions: 'Sesión de caja',
  cash_registers: 'Caja',
  cash_movements: 'Movimiento de caja',
  taxes: 'Impuesto',
  tax_configs: 'Impuesto',
  settings: 'Configuración',
  company_settings: 'Configuración',
  companies: 'Empresa',
  categories: 'Categoría',
  brands: 'Marca',
  alerts: 'Alerta',
  employees: 'Empleado',
  web_orders: 'Pedido web',
  accounting_entries: 'Asiento contable',
  audit_logs: 'Auditoría',
}

const FIELD_LABELS: Readonly<Record<string, string>> = {
  name: 'Nombre',
  full_name: 'Nombre completo',
  first_name: 'Nombres',
  last_name: 'Apellidos',
  description: 'Descripción',
  code: 'Código',
  sku: 'Código (SKU)',
  barcode: 'Código de barras',
  email: 'Correo',
  phone: 'Teléfono',
  address: 'Dirección',
  city: 'Ciudad',
  city_code: 'Código de ciudad',
  document_type: 'Tipo de documento',
  document_number: 'Número de documento',
  verification_digit: 'Dígito de verificación',
  status: 'Estado',
  is_active: 'Activo',
  active: 'Activo',
  role: 'Rol',
  role_code: 'Rol',
  price: 'Precio',
  sale_price: 'Precio de venta',
  cost: 'Costo',
  cost_price: 'Costo',
  average_cost: 'Costo promedio',
  unit_cost: 'Costo unitario',
  quantity: 'Cantidad',
  stock: 'Existencias',
  min_stock: 'Existencia mínima',
  max_stock: 'Existencia máxima',
  reserved_quantity: 'Cantidad reservada',
  available_quantity: 'Cantidad disponible',
  total: 'Total',
  subtotal: 'Subtotal',
  tax: 'Impuesto',
  tax_rate: 'Tarifa de impuesto',
  iva_rate: 'Tarifa de IVA',
  discount: 'Descuento',
  payment_method: 'Método de pago',
  payment_status: 'Estado de pago',
  notes: 'Notas',
  category_id: 'Categoría',
  brand_id: 'Marca',
  supplier_id: 'Proveedor',
  customer_id: 'Cliente',
  product_id: 'Producto',
  location_id: 'Bodega',
  user_id: 'Usuario',
  invoice_number: 'Número de factura',
  purchase_number: 'Número de compra',
  credit_limit: 'Cupo de crédito',
  type: 'Tipo',
  value: 'Valor',
  registro: 'Registro',
}

function humanize(code: string): string {
  const words = code.replace(/[_\-.]+/g, ' ').trim().toLowerCase()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : '—'
}

export function auditActionLabel(action: string): string {
  return displayLabel(ACTION_LABELS, action)
}

export function auditModuleLabel(module: string): string {
  return displayLabel(MODULE_LABELS, module)
}

/** Nombre legible del tipo de registro ("stock_levels" → "Existencias"). */
export function auditEntityLabel(entity: string | null | undefined): string {
  if (!entity) return '—'
  return ENTITY_LABELS[entity.toLowerCase()] ?? humanize(entity)
}

export function auditFieldLabel(field: string): string {
  return FIELD_LABELS[field.toLowerCase()] ?? humanize(field)
}

export function auditRoleLabel(role: string | null | undefined): string {
  if (!role) return '—'
  const definition = (SYSTEM_ROLES as Record<string, { name: string } | undefined>)[role.toUpperCase()]
  return definition?.name ?? humanize(role)
}

/** Valor legible de un campo modificado: textos y números tal cual, booleanos en español, objetos resumidos. */
export function formatAuditValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '(Vacío)'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) {
    return value.every((v) => typeof v !== 'object' || v === null)
      ? value.map((v) => formatAuditValue(v)).join(', ')
      : `${value.length} elemento(s)`
  }
  if (typeof value === 'object') {
    const parts = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v === null || typeof v !== 'object')
      .map(([k, v]) => `${auditFieldLabel(k)}: ${formatAuditValue(v)}`)
    return parts.length > 0 ? parts.join('; ').slice(0, 160) : '(Datos detallados)'
  }
  return String(value)
}
