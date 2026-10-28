/**
 * Etiquetas en español para los códigos internos que guarda la base de datos (estados, tipos, métodos de pago…).
 * Ningún código interno debe llegar tal cual a la pantalla: use `displayLabel(MAPA, valor)`.
 */

export type LabelMap = Readonly<Record<string, string>>

/** Etiqueta del código; si no está en el mapa, lo vuelve legible ("POR_VENCER" → "Por vencer") en lugar de mostrarlo crudo. */
export function displayLabel(map: LabelMap, code: string | null | undefined, fallback = '—'): string {
  if (code === null || code === undefined || code === '') return fallback
  const key = String(code)
  const label = map[key] ?? map[key.toUpperCase()]
  if (label) return label
  const words = key.replace(/[_\-.]+/g, ' ').trim().toLowerCase()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : fallback
}

/** Métodos de pago: códigos en inglés (ventas, pagos a proveedores) y en español (cartera, POS, tesorería). */
export const PAYMENT_METHOD_LABELS: LabelMap = {
  CASH: 'Efectivo',
  BANK_TRANSFER: 'Transferencia',
  TRANSFER: 'Transferencia',
  CREDIT_CARD: 'Tarjeta de crédito',
  DEBIT_CARD: 'Tarjeta débito',
  CARD: 'Tarjeta',
  CREDIT: 'Crédito',
  MIXED: 'Mixto',
  CHECK: 'Cheque',
  ONLINE: 'Pago en línea',
  OTHER: 'Otro',
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  TARJETA: 'Tarjeta',
  TARJETA_CREDITO: 'Tarjeta de crédito',
  TARJETA_DEBITO: 'Tarjeta débito',
  CHEQUE: 'Cheque',
  CONSIGNACION: 'Consignación',
  CREDITO: 'Crédito',
  MIXTO: 'Mixto',
  OTRO: 'Otro',
}

/** Estado de una venta. */
export const SALE_STATUS_LABELS: LabelMap = {
  ISSUED: 'Emitida',
  EMITIDA: 'Emitida',
  COMPLETED: 'Completada',
  PENDING: 'Pendiente',
  PENDIENTE: 'Pendiente',
  CANCELLED: 'Anulada',
  ANULADA: 'Anulada',
  DRAFT: 'Borrador',
  BORRADOR: 'Borrador',
}

/** Estado de cobro o pago de facturas y cuentas (cartera y cuentas por pagar). */
export const PAYMENT_STATUS_LABELS: LabelMap = {
  PENDING: 'Pendiente',
  PENDIENTE: 'Pendiente',
  PARTIAL: 'Pago parcial',
  PAGO_PARCIAL: 'Pago parcial',
  PARCIAL: 'Pago parcial',
  PAID: 'Pagada',
  PAGADA: 'Pagada',
  OVERDUE: 'Vencida',
  VENCIDA: 'Vencida',
  POR_VENCER: 'Por vencer',
  CANCELLED: 'Anulada',
  ANULADA: 'Anulada',
  FAILED: 'Fallido',
  REFUNDED: 'Reembolsado',
}

/** Documento que acompaña una venta. */
export const SALE_DOCUMENT_LABELS: LabelMap = {
  FACTURA_POS: 'Factura POS',
  FACTURA_ELECTRONICA: 'Factura electrónica',
  REMISION: 'Remisión',
  NINGUNO: 'Sin documento',
}

/** Estado de una remisión. */
export const REMISSION_STATUS_LABELS: LabelMap = {
  CREATED: 'Creada',
  PENDING: 'Pendiente',
  DISPATCHED: 'Despachada',
  DELIVERED: 'Entregada',
  CANCELLED: 'Anulada',
  INVOICED: 'Facturada',
}

/** Tipos de movimiento de inventario (kardex), tanto los de la base de datos como los del módulo de Kardex. */
export const MOVEMENT_TYPE_LABELS: LabelMap = {
  PURCHASE_ENTRY: 'Entrada por compra',
  SALE_OUT: 'Salida por venta',
  TRANSFER_IN: 'Traslado (entrada)',
  TRANSFER_OUT: 'Traslado (salida)',
  POSITIVE_ADJUSTMENT: 'Ajuste de entrada',
  NEGATIVE_ADJUSTMENT: 'Ajuste de salida',
  CUSTOMER_RETURN: 'Devolución de cliente',
  SUPPLIER_RETURN: 'Devolución a proveedor',
  DAMAGED_RETURN: 'Devolución en mal estado',
  REMISSION_OUT: 'Salida por remisión',
  REMISSION_RETURN: 'Reingreso de remisión',
  INITIAL_STOCK: 'Inventario inicial',
  INVENTARIO_INICIAL: 'Inventario inicial',
  REVERSION: 'Reversión',
  REVERSION_ENTRY: 'Reversión',
  COMPRA: 'Compra',
  VENTA: 'Venta',
  TRANSFERENCIA_ENTRADA: 'Traslado (entrada)',
  TRANSFERENCIA_SALIDA: 'Traslado (salida)',
  AJUSTE_ENTRADA: 'Ajuste de entrada',
  AJUSTE_SALIDA: 'Ajuste de salida',
  DEVOLUCION: 'Devolución',
  REMISION: 'Remisión',
  PURCHASE: 'Compra',
  SALE: 'Venta',
  RETURN_IN: 'Devolución (entrada)',
  RETURN_OUT: 'Devolución (salida)',
}

/** Documento que originó un movimiento o un registro. */
export const SOURCE_DOCUMENT_LABELS: LabelMap = {
  SALE: 'Venta',
  POS_SALE: 'Venta POS',
  PURCHASE: 'Compra',
  PURCHASE_INVOICE: 'Factura de compra',
  PURCHASE_ORDER: 'Orden de compra',
  WAREHOUSE_TRANSFER: 'Traslado',
  TRANSFER: 'Traslado',
  STOCK_ADJUSTMENT: 'Ajuste de inventario',
  REVERSION_ENTRY: 'Reversión',
  REMISSION: 'Remisión',
  RETURN: 'Devolución',
  CUSTOMER_RETURN: 'Devolución de cliente',
  SUPPLIER_RETURN: 'Devolución a proveedor',
  SUPPLIER_PAYMENT: 'Pago a proveedor',
  CUSTOMER_PAYMENT: 'Recaudo de cliente',
  COST_OF_SALES: 'Costo de ventas',
  CASH_SESSION: 'Cierre de caja',
  PAYROLL: 'Nómina',
  MANUAL: 'Manual',
  PRODUCT: 'Producto',
  INVOICE: 'Factura',
  CREDIT_NOTE: 'Nota crédito',
  DEBIT_NOTE: 'Nota débito',
  REVERSAL: 'Reversión',
}

/** Tipos de documento de identidad. */
export const ID_DOCUMENT_LABELS: LabelMap = {
  CC: 'CC',
  NIT: 'NIT',
  CE: 'CE',
  TI: 'TI',
  RC: 'Registro civil',
  PP: 'Pasaporte',
  PA: 'Pasaporte',
  PASSPORT: 'Pasaporte',
  PASAPORTE: 'Pasaporte',
  PEP: 'PEP',
  PPT: 'PPT',
  DIE: 'Documento extranjero',
  OTHER: 'Otro',
  OTRO: 'Otro',
}

/** Tipos de ubicación (bodegas y puntos de venta). */
export const LOCATION_TYPE_LABELS: LabelMap = {
  WAREHOUSE: 'Bodega',
  STORE_POINT: 'Punto de venta',
  STORE: 'Punto de venta',
  DISTRIBUTION_CENTER: 'Centro de distribución',
  PRODUCTION: 'Producción',
}

/** Estado activo / inactivo. */
export const ACTIVE_STATUS_LABELS: LabelMap = {
  ACTIVE: 'Activa',
  INACTIVE: 'Inactiva',
}

/** Módulos del sistema (auditoría, alertas, actividad). */
export const MODULE_LABELS: LabelMap = {
  INVENTORY: 'Inventario',
  PRODUCTS: 'Productos',
  SALES: 'Ventas',
  POS: 'Punto de venta',
  PURCHASES: 'Compras',
  SUPPLIERS: 'Proveedores',
  CUSTOMERS: 'Clientes',
  INVOICES: 'Facturación',
  BILLING: 'Facturación',
  ACCOUNTING: 'Contabilidad',
  TREASURY: 'Tesorería',
  CASH: 'Cajas',
  CASH_REGISTERS: 'Cajas',
  WAREHOUSES: 'Bodegas',
  TRANSFERS: 'Traslados',
  REMISSIONS: 'Remisiones',
  RETURNS: 'Devoluciones',
  WEB_ORDERS: 'Pedidos web',
  USERS: 'Usuarios',
  ROLES: 'Roles',
  SETTINGS: 'Configuración',
  AUTH: 'Acceso',
  SECURITY: 'Seguridad',
  HR: 'Recursos humanos',
  TAXES: 'Impuestos',
  EXOGENA: 'Información exógena',
  REPORTS: 'Reportes',
  ALERTS: 'Alertas',
  DIAN: 'Facturación electrónica',
  PRICES: 'Precios',
  KARDEX: 'Kardex',
  INVOICING: 'Facturación',
  SYSTEM: 'Sistema',
  CATALOG: 'Catálogo',
}

/** Acciones generales de auditoría e historial. */
export const ACTION_LABELS: LabelMap = {
  CREATE: 'Creación',
  CREATED: 'Creación',
  INSERT: 'Creación',
  UPDATE: 'Actualización',
  UPDATED: 'Actualización',
  DELETE: 'Eliminación',
  DELETED: 'Eliminación',
  READ: 'Leída',
  ATTENDED: 'En atención',
  RESOLVED: 'Resuelta',
  NOTE_ADDED: 'Nota agregada',
  LOGIN: 'Inicio de sesión',
  LOGOUT: 'Cierre de sesión',
  LOGIN_FAILED: 'Intento de acceso fallido',
  ACTIVATE: 'Activación',
  DEACTIVATE: 'Desactivación',
  CANCEL: 'Anulación',
  CANCELLED: 'Anulación',
  APPROVE: 'Aprobación',
  APPROVED: 'Aprobación',
  REJECT: 'Rechazo',
  REJECTED: 'Rechazo',
  EXPORT: 'Exportación',
  IMPORT: 'Importación',
  SETTING_UPDATED: 'Configuración actualizada',
  WEB_ORDER_CONFIRMED: 'Pedido web confirmado',
  STOCK_ADJUSTED: 'Ajuste de inventario',
  PRICE_CHANGED: 'Cambio de precio',
  PASSWORD_CHANGED: 'Cambio de contraseña',
  ACCOUNTING_ENTRY_CREATED: 'Asiento contable creado',
  ACCOUNTING_ENTRY_REVERSED: 'Asiento contable reversado',
  BRAND_CREATED: 'Marca creada',
  CASH_SESSION_OPENED: 'Apertura de caja',
  CASH_SESSION_CLOSED: 'Cierre de caja',
  CATEGORY_CREATED: 'Categoría creada',
  CATEGORY_UPDATED: 'Categoría actualizada',
  CATEGORY_DELETED: 'Categoría eliminada',
  CLIENT_CREATED: 'Cliente creado',
  CLIENT_DEACTIVATED: 'Cliente desactivado',
  CLIENT_UPDATED: 'Cliente actualizado',
  CREDIT_NOTE_NUMBERED: 'Nota crédito numerada',
  DEBIT_NOTE_NUMBERED: 'Nota débito numerada',
  TEST_INSERT: 'Registro de prueba',
  CONFIG_CHANGED: 'Configuración actualizada',
  ELECTRONIC_INVOICE_NUMBERED: 'Factura electrónica numerada',
  EXPORT_EXECUTED: 'Exportación de datos',
  LOCATION_CREATED: 'Bodega creada',
  LOCATION_UPDATED: 'Bodega actualizada',
  LOCATION_ACTIVATED: 'Bodega activada',
  LOCATION_DEACTIVATED: 'Bodega desactivada',
  PRICE_CHANGE_APPLIED_DIRECT: 'Cambio de precio aplicado',
  PRODUCT_BULK_IMPORT: 'Importación de productos',
  PRODUCT_CREATED: 'Producto creado',
  PRODUCT_UPDATED: 'Producto actualizado',
  PRODUCT_DEACTIVATED: 'Producto desactivado',
  PRODUCT_DELETED: 'Producto eliminado',
  PRODUCT_PRICE_CREATED: 'Precio creado',
  PRODUCT_PRICE_CHANGED: 'Cambio de precio',
  PRODUCT_PRICE_DELETED: 'Precio eliminado',
  PROVEEDOR_CREATED: 'Proveedor creado',
  PROVEEDOR_DELETED: 'Proveedor eliminado',
  PURCHASE_DELETED: 'Compra eliminada',
  PURCHASE_PAYMENT: 'Pago de compra',
  RECEIVABLE_CREATED: 'Cuenta por cobrar creada',
  SALE_CREATED: 'Venta creada',
  USER_CREATED: 'Usuario creado',
  USER_DEACTIVATED: 'Usuario desactivado',
  TRANSFER_APPROVED: 'Traslado aprobado',
  TRANSFER_CREATED: 'Traslado creado',
  SALE_CANCELLED: 'Venta anulada',
  PRICE_MODIFIED: 'Precio modificado',
  CASH_REGISTER_OPENED: 'Apertura de caja',
  CASH_REGISTER_CLOSED: 'Cierre de caja',
  INVOICE_ISSUED: 'Factura emitida',
  INVOICE_CANCELLED: 'Factura anulada',
  INVOICE_DIAN_REJECTED: 'Factura rechazada por la DIAN',
  PURCHASE_CREATED: 'Compra registrada',
  TAX_CONFIG_MODIFIED: 'Impuesto modificado',
  USER_ROLE_UPDATED: 'Rol de usuario actualizado',
  EXOGENA_GENERATED: 'Exógena generada',
  SETTING_BATCH_UPDATED: 'Configuración actualizada',
  CRITICAL_CONFIG_CHANGED: 'Configuración crítica modificada',
  WEB_ORDER_PREPARED: 'Pedido web preparado',
  WEB_ORDER_DISPATCHED: 'Pedido web despachado',
  WEB_ORDER_DELIVERED: 'Pedido web entregado',
  WEB_ORDER_CANCELLED: 'Pedido web anulado',
  CATALOG_PRODUCT_UPDATED: 'Producto del catálogo actualizado',
  CATALOG_BULK_UPDATED: 'Catálogo actualizado en bloque',
  SUPER_CATALOG_PRODUCT_UPDATED: 'Producto del catálogo actualizado',
  SUPER_CATALOG_BULK_UPDATED: 'Catálogo actualizado en bloque',
  REPORT_GENERATED: 'Reporte generado',
  REPORT_EXPORTED: 'Reporte exportado',
  REPORT_SENSITIVE_ACCESSED: 'Consulta de reporte sensible',
  ALERT_CREATED: 'Alerta creada',
  ALERT_READ: 'Alerta leída',
  ALERT_ATTENDED: 'Alerta en atención',
  ALERT_RESOLVED: 'Alerta resuelta',
  ALERT_CLOSED: 'Alerta cerrada',
  ALERT_RULE_MODIFIED: 'Regla de alerta modificada',
}

/** Movimientos de caja. */
export const CASH_MOVEMENT_LABELS: LabelMap = {
  SALE_CASH: 'Venta en efectivo',
  CASH_IN: 'Ingreso de efectivo',
  CASH_OUT: 'Retiro de efectivo',
  OPENING: 'Apertura',
  CLOSING: 'Cierre',
  EXPENSE: 'Gasto',
  REFUND: 'Devolución',
  CUSTOMER_PAYMENT: 'Recaudo de cliente',
  SUPPLIER_PAYMENT: 'Pago a proveedor',
  SALE: 'Venta',
  INFLOW: 'Ingreso',
  OUTFLOW: 'Egreso',
}

/** Tipos de impuesto y retenciones. */
export const TAX_TYPE_LABELS: LabelMap = {
  IVA: 'IVA',
  INC: 'Impuesto al consumo',
  ICA: 'ICA',
  NO_GRAVADO: 'No gravado',
  EXENTO: 'Exento',
  EXCLUIDO: 'Excluido',
  RETEFUENTE: 'Retención en la fuente',
  RETEICA: 'ReteICA',
  RETEIVA: 'ReteIVA',
}

/** Estados de la facturación electrónica ante la DIAN en el historial de eventos. */
export const DIAN_EVENT_LABELS: LabelMap = {
  ENVIO_INICIAL: 'Envío a la DIAN',
  CONSULTA_ESTADO: 'Consulta de estado',
  ERROR_TECNICO: 'Error técnico',
  RECHAZADO: 'Rechazado',
  ACEPTADO: 'Aceptado',
  ACCEPTED: 'Aceptado',
  REJECTED: 'Rechazado',
}

/** Tarifa de IVA de una línea ("IVA_19" → "IVA 19%"). */
export function ivaRateLabel(code: string | null | undefined): string {
  if (!code) return '—'
  const upper = code.toUpperCase()
  if (upper === 'EXCLUIDO') return 'Excluido'
  if (upper === 'EXENTO') return 'Exento'
  const rate = upper.match(/IVA_?(\d+(?:\.\d+)?)/)?.[1]
  if (rate === '0') return 'Exento'
  return rate ? `IVA ${rate}%` : displayLabel(TAX_TYPE_LABELS, code)
}
