/**
 * Estados de una compra tal como los escriben las funciones del servidor
 * (fn_create/confirm/receive/cancel_purchase_order). inventory_status va en español y
 * payment_status en inglés; se aceptan también los equivalentes antiguos en inglés.
 */

export const INVENTORY_STATUS = {
  DRAFT: ['BORRADOR', 'DRAFT'],
  CONFIRMED: ['CONFIRMADA', 'CONFIRMED', 'PENDING_RECEPTION'],
  PARTIALLY_RECEIVED: ['RECIBIDA_PARCIALMENTE', 'PARTIALLY_RECEIVED'],
  RECEIVED: ['RECIBIDA', 'RECEIVED'],
  CANCELLED: ['CANCELADA', 'CANCELLED'],
} as const

/** Compras que generan una obligación con el proveedor (excluye borradores y anuladas). */
export const PAYABLE_INVENTORY_STATUSES: string[] = [
  ...INVENTORY_STATUS.CONFIRMED,
  ...INVENTORY_STATUS.PARTIALLY_RECEIVED,
  ...INVENTORY_STATUS.RECEIVED,
]

/** Órdenes que todavía esperan mercancía en bodega. */
export const PENDING_RECEPTION_STATUSES: string[] = [
  ...INVENTORY_STATUS.CONFIRMED,
  ...INVENTORY_STATUS.PARTIALLY_RECEIVED,
]

const has = (group: readonly string[], status: string | null | undefined) =>
  group.includes((status || '').toUpperCase())

export const isDraftPurchase = (status?: string | null) => has(INVENTORY_STATUS.DRAFT, status)
export const isCancelledPurchase = (status?: string | null) => has(INVENTORY_STATUS.CANCELLED, status)
export const isReceivedPurchase = (status?: string | null) => has(INVENTORY_STATUS.RECEIVED, status)

/** Ya entró mercancía a bodega (recepción total o parcial). */
export const hasReceivedGoods = (status?: string | null) =>
  has(INVENTORY_STATUS.RECEIVED, status) || has(INVENTORY_STATUS.PARTIALLY_RECEIVED, status)

/** Genera deuda con el proveedor: confirmada, recibida o recibida parcialmente. */
export const isPayablePurchase = (status?: string | null) => has(PAYABLE_INVENTORY_STATUSES, status)

/** Se puede registrar recepción de mercancía. */
export const canReceivePurchase = (status?: string | null) => has(PENDING_RECEPTION_STATUSES, status)

/** Saldo pendiente de pago de una compra que genera deuda (0 si es borrador, anulada o pagada). */
export function pendingPurchaseBalance(row: {
  inventory_status?: string | null
  payment_status?: string | null
  total_amount?: number | string | null
  paid_amount?: number | string | null
}): number {
  if (!isPayablePurchase(row.inventory_status) || row.payment_status === 'PAID') return 0
  return Math.max(0, Number(row.total_amount || 0) - Number(row.paid_amount || 0))
}

/** Fecha de hoy en Bogotá (YYYY-MM-DD); toISOString usa UTC y cambia de día a las 7 p. m. */
export function todayBogota(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}
