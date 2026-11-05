import type { POSCustomer } from '../types'

/** Documento del consumidor final: nunca se le vende a crédito. */
export const FINAL_CONSUMER_DOCUMENT = '222222222222'

export interface CustomerCreditStatus {
  allowed: boolean
  available: number
  reason?: string
}

/**
 * Cupo de crédito del cliente para una venta POS. Es una validación previa para el cajero:
 * el servidor vuelve a verificar el cupo con el total que él mismo calcula.
 */
export function getCustomerCreditStatus(customer: POSCustomer | null, amount: number): CustomerCreditStatus {
  if (!customer || customer.documentNumber === FINAL_CONSUMER_DOCUMENT) {
    return { allowed: false, available: 0, reason: 'Seleccione un cliente registrado para vender a crédito.' }
  }
  if (customer.isActive === false) {
    return { allowed: false, available: 0, reason: 'El cliente está inactivo.' }
  }
  const limit = Number(customer.creditLimit || 0)
  if (limit <= 0) {
    return { allowed: false, available: 0, reason: 'El cliente no tiene cupo de crédito asignado.' }
  }
  const available = Math.max(0, limit - Number(customer.currentBalance || 0))
  if (amount > available) {
    return { allowed: false, available, reason: 'La venta supera el cupo de crédito disponible del cliente.' }
  }
  return { allowed: true, available }
}
